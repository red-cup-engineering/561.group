import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  readFeeds, readFeedsWithCoverage, mergeItems, renderFeedInputReceipt,
  renderFeedItemProvenance, renderJsonFeed, renderAtom, renderRss
} from "../src/feed.mjs";

const home = JSON.parse(readFileSync(new URL("../data/home.json", import.meta.url), "utf8"));
const [science, engineering, operations, services] = home.group.companies;
const item = (company, id, date, extra = {}) => ({
  id, url: company.url + encodeURIComponent(id) + "/",
  title: "T " + id, summary: "S " + id, date_published: date, tags: ["a"],
  authors: [{ name: company.name, url: company.url }],
  content_html: "<p>never copied into the merged feed</p>", ...extra,
});
const feed = (company, items) => ({
  version: "https://jsonfeed.org/version/1.1",
  home_page_url: company.url, feed_url: company.feeds.json,
  authors: [{ name: company.name, url: company.url }], items,
});

test("feeds merge newest first with the company as author, drop bodies, dedupe and cap", () => {
  const merged = mergeItems([
    { company: science, feed: feed(science, [
      item(science, "a", "2026-10-01T00:00:00Z"),
      item(science, "dup", "2026-10-05T00:00:00Z")]) },
    { company: services, feed: feed(services, [
      item(services, "b", "2026-10-10T00:00:00Z"),
      item(services, "dup", "2026-10-06T00:00:00Z"),
      item(services, "undated", undefined)]) },
  ]);
  assert.deepEqual(merged.map(i => i.id), ["b", "dup", "a", "undated"]);
  assert.deepEqual(merged[0].authors, [{ name: "Causeway Services", url: services.url }]);
  assert.equal(merged[1].authors[0].name, "Lenticule Science");
  assert.equal(merged[0].content_html, undefined);
  assert.equal(mergeItems([{ company: science, feed: feed(science,
    Array.from({ length: 100 }, (_, i) => item(science, "n" + i,
      "2026-01-" + String(1 + i % 28).padStart(2, "0") + "T00:00:00Z"))) }]).length, 60);
});

test("an unreachable or malformed feed is logged and skipped, never fatal", async () => {
  const logs = [];
  const fetchImpl = async url => {
    if (url.includes("science")) throw new Error("down");
    if (url.includes("engineering")) return new Response("nope", { status: 503 });
    if (url.includes("operations")) return new Response(JSON.stringify({ nothing: true }));
    return new Response(JSON.stringify(feed(services, [item(services, "ok", "2026-10-10T00:00:00Z")])));
  };
  const observed = await readFeedsWithCoverage([science, engineering, operations, services], {
    fetchImpl, log: message => logs.push(message),
  });
  assert.deepEqual(observed.feeds.map(read => read.company.id), [services.id]);
  assert.deepEqual(observed.sources.map(source => source.state),
    ["unavailable", "unavailable", "refused", "received"]);
  assert.deepEqual(observed.sources.at(-1).inputItems, 1);
  const bytes = JSON.stringify(feed(services, [item(services, "ok", "2026-10-10T00:00:00Z")]));
  assert.equal(observed.sources.at(-1).sha256,
    "sha256:" + createHash("sha256").update(bytes).digest("hex"));
  assert.equal(observed.sources.at(-1).bytes, Buffer.byteLength(bytes));
  assert.equal(logs.length, 3);
  assert.deepEqual((await readFeeds([science, engineering, operations, services],
    { fetchImpl, log: () => {} })).map(read => read.company.id), [services.id]);
  assert.deepEqual(mergeItems([]), []);
});

test("three independently parseable syndication formats carry the same admitted items", () => {
  const items = mergeItems([{ company: services, feed: feed(services, [
    item(services, "a&b", "2026-10-10T00:00:00Z")]) }]);
  const json = JSON.parse(renderJsonFeed(home, items));
  assert.equal(json.version, "https://jsonfeed.org/version/1.1");
  assert.equal(json.feed_url, "https://561.group/feed.json");
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].url, services.url + "a%26b/");
  assert.match(renderAtom(home, items),
    /<entry>\s*<id>a&amp;b<\/id>[\s\S]*<published>2026-10-10T00:00:00Z<\/published>/u);
  assert.match(renderRss(home, items),
    /<guid isPermaLink="false">a&amp;b<\/guid>[\s\S]*<pubDate>Sat, 10 Oct 2026 00:00:00 GMT<\/pubDate>/u);
});

test("a foreign, malformed or duplicate entry cannot gain the company's author in any feed", () => {
  const date = "2026-10-20T00:00:00Z";
  const rejected = [];
  const items = mergeItems([{ company: services, feed: feed(services, [
    item(services, "valid", date),
    item(services, "forged", date, { url: "https://science.561.group/forged/" }),
    item(services, "fragment", date, { url: services.url + "article/#forged" }),
    item(services, "bad-day", "2026-02-30T00:00:00Z"),
    item(services, "oversized", date, { summary: "x".repeat(4097) }),
    item(services, "bad-tags", date, { tags: ["valid", { code: "bad" }] }),
    item(services, "duplicate-url", date, { url: services.url + "valid/" }),
  ]) }], undefined, { onReject: detail => rejected.push(detail) });
  assert.deepEqual(items.map(i => i.id), ["valid"]);
  assert.deepEqual(rejected.map(r => r.reason), [
    "noncanonical-or-foreign-article", "noncanonical-or-foreign-article",
    "invalid-date", "invalid-summary", "invalid-tags", "duplicate-id-or-url",
  ]);
  for (const output of [renderJsonFeed(home, items), renderAtom(home, items), renderRss(home, items)])
    assert.doesNotMatch(output, /forged|bad-day|duplicate-url/u);
  assert.equal(items[0].authors[0].url, services.url);
  const receipt = JSON.parse(renderFeedInputReceipt(home, [
    { companyId: services.id, feedUrl: services.feeds.json, state: "received", inputItems: 7 },
  ], items, rejected));
  assert.equal(receipt.emittedItems, 1);
  assert.equal(receipt.excludedItemCounts["noncanonical-or-foreign-article"], 2);
  assert.equal(receipt.excludedItemCounts["duplicate-id-or-url"], 1);
  assert.equal(receipt.completeness, "partial-source-coverage");
  assert.equal(receipt.expectedSourceCount, 4);
  assert.match(receipt.scope, /not a complete archive/);
});

test("source-receiving refuses a foreign feed identity and retains original order", async () => {
  const source = [science, engineering, operations, services];
  const results = await readFeedsWithCoverage(source, {
    fetchImpl: async url => {
      const company = source.find(c => c.feeds.json === url);
      if (company === operations) return new Response("down", { status: 502 });
      const f = feed(company, [item(company, company.id + "-real", "2026-10-20T00:00:00Z")]);
      if (company === engineering) f.home_page_url = "https://wrong.example/";
      return new Response(JSON.stringify(f));
    },
    log: () => {},
  });
  assert.deepEqual(results.feeds.map(f => f.company.id), [science.id, services.id]);
  assert.deepEqual(results.sources.map(s => s.state),
    ["received", "refused", "unavailable", "received"]);
  const published = mergeItems(results.feeds);
  const receipt = JSON.parse(renderFeedInputReceipt(home, results.sources, published));
  assert.equal(receipt.completeness, "partial-source-coverage");
  assert.equal(receipt.sources[1].feedUrl, engineering.feeds.json);
  assert.equal(receipt.sources[1].inputItems, undefined);
  assert.equal(receipt.emittedItems, 2);
  assert.ok(results.sources[0].sha256?.startsWith("sha256:"));
  assert.ok(results.sources[0].bytes > 0);
  const graph = JSON.parse(renderFeedItemProvenance(home, results.sources, published));
  assert.equal(graph["@id"], "https://561.group/feed-provenance.jsonld");
  assert.equal(graph["@context"].prov, "http://www.w3.org/ns/prov#");
  const entries = graph["@graph"].filter(node => node["@type"]?.includes("schema:DataFeedItem"));
  assert.equal(entries.length, 2);
  for (const item of published) {
    const entry = entries.find(x => x["schema:item"]["@id"] === item.url);
    const company = source.find(c => c.url === item.authors[0].url);
    const digest = results.sources.find(x => x.companyId === company.id).sha256.slice(7);
    assert.equal(entry["prov:wasDerivedFrom"]["@id"], "urn:sha256:" + digest);
    assert.equal(entry["prov:wasAttributedTo"]["@id"], company.url);
    assert.equal(entry["schema:identifier"], item.id);
  }
  const snapshots = graph["@graph"].filter(node => node["@type"] === "prov:Entity");
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots.every(x => x["@id"].startsWith("urn:sha256:")));
});

test("declared bylines cannot be overwritten with another company's publisher identity", () => {
  const date="2026-10-20T00:00:00Z";
  const withheld=[];
  const items=mergeItems([{company:services,feed:feed(services,[
    item(services,"foreign-byline",date,{
      authors:[{name:"Other author",url:"https://another.example/"}]}),
    item(services,"missing-byline",date,{authors:null}),
    item(services,"proper-byline",date),
  ])}],undefined,{onReject:r=>withheld.push(r)});
  assert.deepEqual(items.map(x=>x.id),["proper-byline"]);
  assert.deepEqual(withheld.map(x=>x.reason),["attribution-mismatch","attribution-mismatch"]);
});

test("bounded feed intake refuses oversized bodies and non-UTF-8 JSON, never promoting unknown evidence",async()=>{
  const fetchImpl=async url=>new Response(url.includes("science") ? "x".repeat(2*1024*1024+1) :
    new Uint8Array([0xff,0xfe]),{headers:{"content-type":"application/json"}});
  const observed=await readFeedsWithCoverage([science,services],{fetchImpl,log:()=>{}});
  assert.deepEqual(observed.sources.map(x=>x.state),["refused","refused"]);
  assert.deepEqual(observed.feeds,[]);
  assert.equal(observed.sources.some(x=>x.sha256),false);
  const graph=JSON.parse(renderFeedItemProvenance(home,observed.sources,[]));
  assert.equal(graph["@graph"].filter(x=>x["@type"]?.includes("schema:DataFeedItem")).length,0);
  assert.throws(()=>renderFeedItemProvenance(home,observed.sources,[
    {id:"unwitnessed",url:services.url+"ghost/",authors:[{name:services.name,url:services.url}]}
  ]),/unobserved source provenance/);
});
