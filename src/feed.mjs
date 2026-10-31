// What the Group is publishing: the four companies' JSON Feeds merged, newest first, and written out as
// JSON Feed 1.1, Atom and RSS. Pure except readFeeds, which tolerates any feed being unreachable.

import { createHash } from "node:crypto";

export const FEED_LIMIT = 60;

const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const time = (item) => (Number.isFinite(Date.parse(item.date_published)) ? Date.parse(item.date_published) : -Infinity);

// Admission happens BEFORE all three public feed formats are generated. The
// blog renderer has its own last-line check, but a bad upstream record must
// neither poison its whole reading nor acquire a company's forged authorship.
const MAX_SOURCE_ITEMS = 500;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_TITLE = 512;
const MAX_SUMMARY = 4096;

function articleUrl(company, value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  let article, owner;
  try { article = new URL(value); owner = new URL(company.url); }
  catch { return null; }
  if (article.protocol !== "https:" || article.origin !== owner.origin ||
      article.username || article.password || article.search || article.hash ||
      !article.pathname.endsWith("/") || article.pathname.includes("//") ||
      article.href !== value) return null;
  return article.href;
}

function admittedDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
      !Number.isFinite(Date.parse(value))) return false;
  const day = value.slice(0, 10);
  return new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day;
}

function sourceItem(company, item, declaredAuthors) {
  if (!item || typeof item !== "object" || Array.isArray(item))
    return { reason: "not-an-object" };
  const url = articleUrl(company, item.url);
  if (!url) return { reason: "noncanonical-or-foreign-article" };
  // A source's corporate origin is evidence of publication custody, not
  // permission to replace an independently named author's byline.
  if (!Array.isArray(declaredAuthors) || declaredAuthors.length !== 1 ||
      declaredAuthors[0]?.url !== company.url ||
      declaredAuthors[0]?.name !== company.name)
    return { reason: "attribution-mismatch" };
  if (item.id !== undefined &&
      (typeof item.id !== "string" || !item.id.trim() || item.id.length > 1024))
    return { reason: "invalid-article-id" };
  if (typeof item.title !== "string" || !item.title.trim() ||
      item.title.length > MAX_TITLE) return { reason: "invalid-title" };
  if (item.summary !== undefined &&
      (typeof item.summary !== "string" || item.summary.length > MAX_SUMMARY))
    return { reason: "invalid-summary" };
  if ((item.date_published !== undefined && !admittedDate(item.date_published)) ||
      (item.date_modified !== undefined && !admittedDate(item.date_modified)))
    return { reason: "invalid-date" };
  if (item.tags !== undefined &&
      (!Array.isArray(item.tags) || item.tags.length > 30 ||
       item.tags.some(tag => typeof tag !== "string" || !tag.trim() || tag.length > 120)))
    return { reason: "invalid-tags" };
  return { item: {
    id: item.id ?? url, url, title: item.title.trim(),
    ...(item.summary === undefined ? {} : { summary: item.summary }),
    ...(item.date_published === undefined ? {} : { date_published: item.date_published }),
    ...(item.date_modified === undefined ? {} : { date_modified: item.date_modified }),
    ...(item.tags === undefined ? {} : { tags: [...item.tags] }),
    authors: [{ name: company.name, url: company.url }],
  }};
}

// Hash the actual decoded HTTP response body bytes, not reserialized JSON.
// Bound streaming intake so an upstream feed cannot exhaust the site builder.
async function readBoundedFeed(response) {
  const indicated = response.headers.get("content-length");
  if (indicated !== null && /^\d+$/u.test(indicated) &&
      Number(indicated) > MAX_SOURCE_BYTES)
    throw new RangeError("oversized source feed");
  if (!response.body?.getReader)
    throw new TypeError("Source feed needs a readable response body");
  const reader = response.body.getReader();
  const chunks = [];
  const digest = createHash("sha256");
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new TypeError("invalid source response chunk");
      bytes += value.byteLength;
      if (bytes > MAX_SOURCE_BYTES) {
        await reader.cancel("oversized source feed");
        throw new RangeError("oversized source feed");
      }
      digest.update(value);
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const content = new TextDecoder("utf-8", { fatal: true }).decode(merged);
  return {
    feed: JSON.parse(content),
    sha256: "sha256:" + digest.digest("hex"),
    bytes,
  };
}

/** One actual read per source. Missing/rejected sources have an explicit status,
 * rather than silently turning a partial build into a purported complete archive. */
export async function readFeedsWithCoverage(companies, { fetchImpl = fetch, log = console.warn } = {}) {
  const reads = await Promise.all(companies.map(async company => {
    const source = { companyId: company.id, feedUrl: company.feeds.json };
    let response;
    try {
      response = await fetchImpl(company.feeds.json, {
        signal: AbortSignal.timeout(8000),
        headers: { accept: "application/feed+json, application/json" },
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
    } catch (error) {
      log('feed of ' + company.name + ' unavailable (' + error.message + '); continuing without it');
      return { status: { ...source, state: "unavailable" } };
    }
    try {
      const { feed, sha256, bytes } = await readBoundedFeed(response);
      if (!feed || feed.version !== "https://jsonfeed.org/version/1.1" ||
          feed.home_page_url !== company.url ||
          feed.feed_url !== company.feeds.json ||
          !Array.isArray(feed.items) || feed.items.length > MAX_SOURCE_ITEMS) {
        throw new TypeError("invalid or foreign JSON Feed 1.1 identity/size");
      }
      return {
        status: { ...source, state: "received", inputItems: feed.items.length, bytes, sha256 },
        received: { company, feed },
      };
    } catch (error) {
      log('feed of ' + company.name + ' refused (' + error.message + '); continuing without it');
      return { status: { ...source, state: "refused" } };
    }
  }));
  return {
    feeds: reads.flatMap(read => read.received ? [read.received] : []),
    sources: reads.map(read => read.status), // stable original company order
  };
}

/** Compatibility reader for the original callers; use the coverage variant to
 * emit a public build receipt without fetching any source a second time. */
export async function readFeeds(companies, options = {}) {
  return (await readFeedsWithCoverage(companies, options)).feeds;
}

/** Merge source-admitted items only, newest first, cap output, and retain the
 * original author, item identifier and URL. Invalid items are withheld alone. */
export function mergeItems(feeds, limit = FEED_LIMIT, { onReject = () => {} } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > FEED_LIMIT)
    throw new TypeError("Group feed output limit must be bounded");
  const seen = new Set();
  const seenUrls = new Set();
  const items = [];
  for (const { company, feed } of feeds) {
    for (const candidate of feed.items) {
      const { item, reason } = sourceItem(company, candidate,
        candidate?.authors === undefined ? feed.authors : candidate.authors);
      if (!item) {
        onReject({ companyId: company.id, reason });
        continue;
      }
      if (seen.has(item.id) || seenUrls.has(item.url)) {
        onReject({ companyId: company.id, reason: "duplicate-id-or-url" });
        continue;
      }
      seen.add(item.id);
      seenUrls.add(item.url);
      items.push(item);
    }
  }
  return items.sort((a, b) => time(b) - time(a) || a.url.localeCompare(b.url)).slice(0, limit);
}

/** Build-time admission evidence only: no crawl, index, federation delivery or
 * completeness claim beyond the four named source read attempts. */
export function renderFeedInputReceipt(home, sources, items, excluded = []) {
  const counts = {};
  for (const { reason } of excluded) counts[reason] = (counts[reason] ?? 0) + 1;
  for (const source of sources) {
    if (source.state === "received" &&
        (!Number.isSafeInteger(source.inputItems) || source.inputItems < 0))
      throw new TypeError("A received source must disclose its observed item count");
  }
  const sourceItemCount = sources.reduce((total, source) =>
    total + (source.state === "received" ? source.inputItems : 0), 0);
  const admittedItems = sourceItemCount - excluded.length;
  if (admittedItems < items.length || !Number.isSafeInteger(admittedItems))
    throw new TypeError("Published item counts exceed witnessed admitted source items");
  return JSON.stringify({
    schema: "561.group/feed-input-receipt/v1",
    origin: home.origin,
    scope: "One build-time read per named company feed; not a complete archive, delivery, indexing or correction receipt",
    sources,
    excludedItemCounts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    sourceItemCount,
    admittedItems,
    omittedByAggregateLimit: admittedItems - items.length,
    selectionPolicy: "newest first by parseable publication timestamp then canonical URL; at most " + FEED_LIMIT + " items",
    emittedItems: items.length,
    expectedSourceCount: home.group.companies.length,
    completeness: sources.length === home.group.companies.length &&
      sources.every((source, index) => source.state === "received" &&
        source.companyId === home.group.companies[index].id) ?
      "all-sources-received" : "partial-source-coverage",
  }, null, 2) + "\n";
}

/** Linked-data projection of the original *feed metadata* transmission.
 * This does not independently verify the articles or their individual claims,
 * assert ownership of source writing, or serve as a correction ledger.
 */
export function renderFeedItemProvenance(home, sources, items) {
  if (!Array.isArray(home?.group?.companies) || !Array.isArray(sources) ||
      !Array.isArray(items))
    throw new TypeError("Provenance requires actual source and publication inventories");
  const owners = new Map(home.group.companies.map(company => [company.url, company]));
  const received = new Map(sources.filter(s => s.state === "received").map(s => [s.companyId, s]));
  const snapshot = source => "urn:sha256:" + source.sha256.slice(7);
  const snapshots = [];
  for (const source of received.values()) {
    if (!/^sha256:[a-f0-9]{64}$/u.test(source.sha256) ||
        !Number.isSafeInteger(source.bytes) || source.bytes < 0 ||
        source.bytes > MAX_SOURCE_BYTES)
      throw new TypeError("Original received source requires bounded byte evidence");
    snapshots.push({
      "@id": snapshot(source), "@type": "prov:Entity",
      "prov:wasDerivedFrom": { "@id": source.feedUrl },
      "schema:encodingFormat": "application/feed+json",
      "schema:contentSize": String(source.bytes) + " B",
    });
  }
  const entries = items.map(item => {
    const company = owners.get(item.authors?.[0]?.url);
    const source = company && received.get(company.id);
    if (!source || !company || item.authors.length !== 1 ||
        item.authors[0].name !== company.name)
      throw new TypeError("An aggregated item cannot acquire unobserved source provenance");
    const id = home.origin + "/feed.json#item-" +
      createHash("sha256").update(item.url).digest("hex");
    return {
      "@id": id, "@type": ["schema:DataFeedItem", "prov:Entity"],
      "schema:item": { "@id": item.url },
      "schema:identifier": item.id,
      "prov:wasDerivedFrom": { "@id": snapshot(source) },
      "prov:wasAttributedTo": { "@id": company.url },
      ...(item.date_published === undefined ? {} : { "schema:datePublished": item.date_published }),
      ...(item.date_modified === undefined ? {} : { "schema:dateModified": item.date_modified }),
    };
  });
  return JSON.stringify({
    "@context": {
      "prov": "http://www.w3.org/ns/prov#",
      "schema": "https://schema.org/",
    },
    "@id": home.origin + "/feed-provenance.jsonld",
    "@type": "prov:Entity",
    "prov:wasDerivedFrom": { "@id": home.origin + "/feed.json" },
    "@graph": [
      {
        "@id": home.origin + "/feed.json",
        "@type": ["schema:DataFeed", "prov:Entity"],
        "prov:wasDerivedFrom": snapshots.map(x => ({ "@id": x["@id"] })),
        "schema:dataFeedElement": entries.map(x => ({ "@id": x["@id"] })),
      },
      ...snapshots, ...entries,
    ],
  }, null, 2) + "\n";
}

const TITLE = (home) => `${home.name}: what the Group is publishing`;
const DESCRIPTION = "The latest from Lenticule Science, Red Cup Engineering, Coesite Operations and Causeway Services.";

export function renderJsonFeed(home, items) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: TITLE(home),
    home_page_url: `${home.origin}/`,
    feed_url: `${home.origin}/feed.json`,
    description: DESCRIPTION,
    language: "en",
    authors: [{ name: home.name, url: `${home.origin}/` }],
    items,
  }, null, 2) + "\n";
}

// Atom requires a real RFC 3339 updated timestamp for each entry. JSON Feed
// permits undated items, and RSS permits omission of pubDate. Do not assign
// one article another publisher's time or fabricate 1970 for an empty feed.
// Retain the source item in the other two formats and disclose Atom omissions.
const sourceUpdated=(item)=>item.date_modified??item.date_published;
const latestUpdated=(items)=>{
  const dated=items.map(sourceUpdated).filter(date=>admittedDate(date));
  return dated.sort((a,b)=>Date.parse(b)-Date.parse(a)||a.localeCompare(b))[0]??null;
};

/** A source-qualified Atom projection of only records whose original
 * publishers supplied a real date. When none is dated, the feed-level
 * modification time comes from the original build's selected publication
 * timestamp, not a synthetic article history. */
export function renderAtom(home, items, publicationTimestamp) {
  const dated=items.filter(item=>{
    const timestamp=sourceUpdated(item);
    if(timestamp===undefined)return false;
    if(!admittedDate(timestamp))
      throw new TypeError("Atom source updated date must be original valid RFC 3339");
    return true;
  });
  const omitted=items.length-dated.length;
  const updated=latestUpdated(dated)??publicationTimestamp;
  if(!admittedDate(updated))
    throw new TypeError("Empty or undated Atom feed needs the source-qualified publication timestamp");
  const disclosure=omitted
    ? ` ${omitted} undated source ${omitted===1?"entry is":"entries are"} available in JSON Feed and RSS but omitted from Atom rather than assigned a fictional updated date.`
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
<title>${xml(TITLE(home))}</title>
<subtitle>${xml(DESCRIPTION+disclosure)}</subtitle>
<id>${home.origin}/feed.atom.xml</id>
<author><name>${xml(home.name)}</name><uri>${home.origin}/</uri></author>
<link rel="self" type="application/atom+xml" href="${home.origin}/feed.atom.xml"/>
<link rel="alternate" type="text/html" href="${home.origin}/blog/"/>
<link rel="related" type="application/feed+json" href="${home.origin}/feed.json"/>
<updated>${xml(updated)}</updated>
${dated.map((i) => `<entry>
<id>${xml(i.id)}</id>
<title>${xml(i.title)}</title>
<link rel="alternate" href="${xml(i.url)}"/>
<updated>${xml(sourceUpdated(i))}</updated>
${i.date_published ? `<published>${xml(i.date_published)}</published>\n` : ""}<author><name>${xml(i.authors[0].name)}</name><uri>${xml(i.authors[0].url)}</uri></author>
${i.summary ? `<summary>${xml(i.summary)}</summary>\n` : ""}${(i.tags ?? []).map((t) => `<category term="${xml(t)}"/>\n`).join("")}</entry>`).join("\n")}
</feed>
`;
}

export function renderRss(home, items) {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xml(TITLE(home))}</title>
<link>${home.origin}/</link>
<description>${xml(DESCRIPTION)}</description>
<language>en</language>
<atom:link rel="self" type="application/rss+xml" href="${home.origin}/feed.rss.xml"/>
${items.map((i) => `<item>
<title>${xml(i.title)}</title>
<link>${xml(i.url)}</link>
<guid isPermaLink="false">${xml(i.id)}</guid>
${Number.isFinite(Date.parse(i.date_published)) ? `<pubDate>${new Date(i.date_published).toUTCString()}</pubDate>\n` : ""}${i.summary ? `<description>${xml(i.summary)}</description>\n` : ""}<source url="${xml(i.authors[0].url)}feed.json">${xml(i.authors[0].name)}</source>
${(i.tags ?? []).map((t) => `<category>${xml(t)}</category>\n`).join("")}</item>`).join("\n")}
</channel>
</rss>
`;
}
