// What the Group is publishing: the four companies' JSON Feeds merged, newest first, and written out as
// JSON Feed 1.1, Atom and RSS. Pure except readFeeds, which tolerates any feed being unreachable.

export const FEED_LIMIT = 60;

const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const time = (item) => (Number.isFinite(Date.parse(item.date_published)) ? Date.parse(item.date_published) : -Infinity);

// Admission happens BEFORE all three public feed formats are generated. The
// blog renderer has its own last-line check, but a bad upstream record must
// neither poison its whole reading nor acquire a company's forged authorship.
const MAX_SOURCE_ITEMS = 500;
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

function sourceItem(company, item) {
  if (!item || typeof item !== "object" || Array.isArray(item))
    return { reason: "not-an-object" };
  const url = articleUrl(company, item.url);
  if (!url) return { reason: "noncanonical-or-foreign-article" };
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
      const feed = await response.json();
      if (!feed || feed.version !== "https://jsonfeed.org/version/1.1" ||
          feed.home_page_url !== company.url ||
          feed.feed_url !== company.feeds.json ||
          !Array.isArray(feed.items) || feed.items.length > MAX_SOURCE_ITEMS) {
        throw new TypeError("invalid or foreign JSON Feed 1.1 identity/size");
      }
      return {
        status: { ...source, state: "received", inputItems: feed.items.length },
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
      const { item, reason } = sourceItem(company, candidate);
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
  return JSON.stringify({
    schema: "561.group/feed-input-receipt/v1",
    origin: home.origin,
    scope: "One build-time read per named company feed; not a complete archive, delivery, indexing or correction receipt",
    sources,
    excludedItemCounts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    emittedItems: items.length,
    completeness: sources.every(source => source.state === "received") ?
      "all-sources-received" : "partial-source-coverage",
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

const updatedOf = (items) => items.map((i) => i.date_modified ?? i.date_published).filter((d) => Number.isFinite(Date.parse(d))).sort().at(-1) ?? "1970-01-01T00:00:00Z";

export function renderAtom(home, items) {
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
<title>${xml(TITLE(home))}</title>
<subtitle>${xml(DESCRIPTION)}</subtitle>
<id>${home.origin}/feed.atom.xml</id>
<link rel="self" type="application/atom+xml" href="${home.origin}/feed.atom.xml"/>
<link rel="alternate" type="text/html" href="${home.origin}/"/>
<updated>${xml(updatedOf(items))}</updated>
${items.map((i) => `<entry>
<id>${xml(i.id)}</id>
<title>${xml(i.title)}</title>
<link rel="alternate" href="${xml(i.url)}"/>
<updated>${xml(i.date_modified ?? i.date_published ?? updatedOf(items))}</updated>
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
