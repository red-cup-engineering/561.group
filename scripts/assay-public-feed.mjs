// Read-only release assay for the ONE Group publisher: verifies the same
// source-qualified feed, input receipt and PROV-O graph after public HTTP
// readback. No new publisher, crawler, author or federation identity.
const SHA = /^sha256:[a-f0-9]{64}$/u;
const ID = /^urn:sha256:[a-f0-9]{64}$/u;
const REF = id => ({ "@id": id });
const fail = message => { throw new TypeError("Unreceived public feed evidence: " + message); };
const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const typed = (node, kind) => node?.["@type"] === kind ||
  (Array.isArray(node?.["@type"]) && node["@type"].includes(kind));

export function assayPublicFeedProjection({ home, feed, receipt, graph }) {
  if (home?.origin !== "https://561.group" ||
      !Array.isArray(home.group?.companies) || home.group.companies.length !== 4)
    fail("original four companies are required");
  const companies = home.group.companies;
  if (receipt?.schema !== "561.group/feed-input-receipt/v1" ||
      receipt.origin !== home.origin ||
      receipt.expectedSourceCount !== companies.length ||
      !Array.isArray(receipt.sources) || receipt.sources.length !== companies.length)
    fail("source receipt identity or original source count");
  const received = new Map();
  for (let i = 0; i < companies.length; i++) {
    const source = receipt.sources[i], company = companies[i];
    if (!isRecord(source) || source.companyId !== company.id ||
        source.feedUrl !== company.feeds?.json ||
        !["received", "refused", "unavailable"].includes(source.state))
      fail("source order, custody or state at " + i);
    if (source.state === "received") {
      if (!SHA.test(source.sha256) || !Number.isSafeInteger(source.bytes) ||
          source.bytes < 0 || source.bytes > 2 * 1024 * 1024 ||
          !Number.isSafeInteger(source.inputItems) ||
          source.inputItems < 0 || source.inputItems > 500)
        fail("received feed lacks witnessed bounded bytes or source count");
      received.set(company.id, source);
    } else if (source.sha256 !== undefined || source.inputItems !== undefined)
      fail("unreceived source claims input evidence");
  }
  const coverage = received.size === companies.length ?
    "all-sources-received" : "partial-source-coverage";
  if (receipt.completeness !== coverage) fail("false completeness");
  const sourceItemCount = [...received.values()].reduce((n, s) => n + s.inputItems, 0);
  if (!isRecord(receipt.excludedItemCounts)) fail("missing exclusion accounting");
  let excluded = 0;
  for (const [kind, count] of Object.entries(receipt.excludedItemCounts)) {
    if (!/^[a-z][a-z0-9-]{0,79}$/u.test(kind) ||
        !Number.isSafeInteger(count) || count < 1)
      fail("malformed exclusion accounting");
    excluded += count;
  }
  const admitted = sourceItemCount - excluded;
  if (admitted < 0 || receipt.sourceItemCount !== sourceItemCount ||
      receipt.admittedItems !== admitted ||
      !Number.isSafeInteger(receipt.emittedItems) ||
      receipt.emittedItems < 0 || receipt.emittedItems > 60 ||
      receipt.omittedByAggregateLimit !== admitted - receipt.emittedItems ||
      receipt.omittedByAggregateLimit < 0)
    fail("source, admission, omission and selected counts disagree");
  if (feed?.version !== "https://jsonfeed.org/version/1.1" ||
      feed.home_page_url !== home.origin + "/" ||
      feed.feed_url !== home.origin + "/feed.json" ||
      !Array.isArray(feed.items) || feed.items.length !== receipt.emittedItems)
    fail("public feed identity or emitted selection disagrees");

  if (graph?.["@id"] !== home.origin + "/feed-provenance.jsonld" ||
      graph["@context"]?.prov !== "http://www.w3.org/ns/prov#" ||
      graph["@context"]?.schema !== "https://schema.org/" ||
      !Array.isArray(graph["@graph"]))
    fail("public JSON-LD identity and context");
  const datafeeds = graph["@graph"].filter(x => typed(x, "schema:DataFeed"));
  const entities = graph["@graph"].filter(x => x?.["@type"] === "prov:Entity");
  const entries = graph["@graph"].filter(x => typed(x, "schema:DataFeedItem"));
  if (datafeeds.length !== 1 ||
      datafeeds[0]["@id"] !== feed.feed_url ||
      entities.length !== received.size ||
      entries.length !== feed.items.length)
    fail("feed and provenance node cardinality");
  const unique = new Set(graph["@graph"].map(x => x?.["@id"]));
  if (unique.size !== graph["@graph"].length ||
      [...unique].some(x => typeof x !== "string" || !x.trim()))
    fail("unidentified or duplicate graph nodes");

  const snapshots = new Map();
  for (const [id, source] of received) {
    const snapshotId = "urn:sha256:" + source.sha256.slice(7);
    if (!ID.test(snapshotId)) fail("source snapshot identifier");
    const entity = entities.find(x => x["@id"] === snapshotId);
    if (!entity || entity["prov:wasDerivedFrom"]?.["@id"] !== source.feedUrl ||
        entity["schema:contentSize"] !== String(source.bytes) + " B" ||
        entity["schema:encodingFormat"] !== "application/feed+json")
      fail("source feed bytes are not traceable to their original origin");
    snapshots.set(id, snapshotId);
  }
  if (entities.some(x => ![...snapshots.values()].includes(x["@id"])))
    fail("source graph has an unobserved snapshot");
  if (JSON.stringify(datafeeds[0]["prov:wasDerivedFrom"]) !==
      JSON.stringify([...snapshots.values()].map(REF)))
    fail("aggregate source-feed snapshot list changed");

  const referencedItems = [];
  const seenUrls = new Set(), seenItemIds = new Set();
  for (const item of feed.items) {
    if (!isRecord(item) || typeof item.url !== "string" ||
        typeof item.id !== "string" || !item.id ||
        !Array.isArray(item.authors) || item.authors.length !== 1)
      fail("malformed syndicated entry");
    if (seenUrls.has(item.url) || seenItemIds.has(item.id))
      fail("duplicate syndicated URL or original identifier");
    seenUrls.add(item.url); seenItemIds.add(item.id);
    const company = companies.find(x => x.url === item.authors[0]?.url &&
      x.name === item.authors[0]?.name);
    if (!company || !received.has(company.id) ||
        new URL(item.url).origin !== new URL(company.url).origin)
      fail("syndicated author or article not admitted by original company");
    const entryId = feed.feed_url + "#item-" +
      createHashOfUrl(item.url);
    const entity = entries.find(x => x["@id"] === entryId);
    if (!entity || entity["schema:item"]?.["@id"] !== item.url ||
        entity["schema:identifier"] !== item.id ||
        entity["prov:wasDerivedFrom"]?.["@id"] !== snapshots.get(company.id) ||
        entity["prov:wasAttributedTo"]?.["@id"] !== company.url ||
        (item.date_published !== undefined &&
         entity["schema:datePublished"] !== item.date_published) ||
        (item.date_modified !== undefined &&
         entity["schema:dateModified"] !== item.date_modified))
      fail("item source/author/date lineage does not match original feed");
    referencedItems.push(REF(entryId));
  }
  if (JSON.stringify(datafeeds[0]["schema:dataFeedElement"]) !==
      JSON.stringify(referencedItems))
    fail("aggregate item list and original provenance graph differ");
  return Object.freeze({
    schema: "561.group/public-feed-receiving/v1",
    origin: home.origin,
    observedSourceFeeds: received.size,
    sourceItems: sourceItemCount,
    admittedItems: admitted,
    excludedItems: excluded,
    omittedByAggregateLimit: receipt.omittedByAggregateLimit,
    emittedItems: feed.items.length,
    semanticProjectionReceived: true,
    independentlyFactChecked: false,
    externallyIndexed: null,
    signedFederationDelivered: null,
  });
}

// This deterministic exact URL identity matches the original build's
// createHash('sha256').update(item.url).digest('hex'), without any network I/O.
import { createHash } from "node:crypto";
function createHashOfUrl(url) {
  return createHash("sha256").update(url).digest("hex");
}
