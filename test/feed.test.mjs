import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
  const sourceItems=Array.from({length:100},(_,i)=>item(science,"capped-"+i,
    "2026-01-"+String(1+i%28).padStart(2,"0")+"T00:00:00Z"));
  const selected=mergeItems([{company:science,feed:feed(science,sourceItems)}]);
  const capReceipt=JSON.parse(renderFeedInputReceipt(home,[
    {companyId:science.id,feedUrl:science.feeds.json,state:"received",inputItems:sourceItems.length}
  ],selected));
  assert.equal(capReceipt.sourceItemCount,100);
  assert.equal(capReceipt.admittedItems,100);
  assert.equal(capReceipt.omittedByAggregateLimit,40);
  assert.equal(capReceipt.emittedItems,60);
  assert.equal(capReceipt.completeness,"partial-source-coverage");

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

import { assayPublicFeedProjection, qualifyPublicAssetReadPath, comparePublicFeedRevisions } from "../scripts/assay-public-feed.mjs";

function aCompletePublication() {
  const submitted=home.group.companies.map((company,i)=>{
    const one=feed(company,[item(company,company.id+"-observed","2026-10-2"+i+"T00:00:00Z")]);
    const body=JSON.stringify(one);
    return {
      company,feed:one,
      source:{companyId:company.id,feedUrl:company.feeds.json,state:"received",
        inputItems:1,bytes:Buffer.byteLength(body),
        sha256:"sha256:"+createHash("sha256").update(body).digest("hex")}
    };
  });
  const items=mergeItems(submitted.map(x=>({company:x.company,feed:x.feed})));
  const sources=submitted.map(x=>x.source);
  return {
    home,
    feed:JSON.parse(renderJsonFeed(home,items)),
    receipt:JSON.parse(renderFeedInputReceipt(home,sources,items)),
    graph:JSON.parse(renderFeedItemProvenance(home,sources,items)),
  };
}
test("real public release assessor joins original feed, receipt and every PROV-O author/source item",()=>{
  const publication=aCompletePublication();
  const observed=assayPublicFeedProjection(publication);
  assert.equal(observed.schema,"561.group/public-feed-receiving/v1");
  assert.equal(observed.observedSourceFeeds,4);
  assert.equal(observed.sourceItems,4);
  assert.equal(observed.admittedItems,4);
  assert.equal(observed.excludedItems,0);
  assert.equal(observed.emittedItems,4);
  assert.equal(observed.omittedByAggregateLimit,0);
  assert.equal(observed.semanticProjectionReceived,true);
  assert.equal(observed.independentlyFactChecked,false);
  assert.equal(observed.externallyIndexed,null);
  assert.equal(observed.signedFederationDelivered,null);
});

test("release refuses forged or orphaned public article-to-source mappings",()=>{
  const original=aCompletePublication();
  for(const sabotage of [
    x=>x.graph["@graph"].find(y=>Array.isArray(y["@type"])&&y["@type"].includes("schema:DataFeedItem"))["prov:wasDerivedFrom"]["@id"]="urn:sha256:"+"f".repeat(64),
    x=>x.graph["@graph"].find(y=>Array.isArray(y["@type"])&&y["@type"].includes("schema:DataFeedItem"))["schema:item"]["@id"]="https://other.invalid/forged/",
    x=>x.graph["@graph"].find(y=>Array.isArray(y["@type"])&&y["@type"].includes("schema:DataFeedItem"))["prov:wasAttributedTo"]["@id"]="https://other.invalid/",
    x=>x.graph["@graph"].push(structuredClone(x.graph["@graph"][0])),
    x=>x.feed.items[0].authors[0].name="Unverified Source",
    x=>x.graph["@context"].prov="http://forged.example/ns#",
    x=>x.receipt.sources[1].sha256="sha256:"+"f".repeat(64),
    x=>x.receipt.sourceItemCount+=1,
    x=>x.receipt.completeness="partial-source-coverage",
    x=>x.receipt.sources[0].feedUrl="https://imposter.invalid/feed.json",
    x=>x.receipt.omittedByAggregateLimit=1,
  ]){
    const damaged=structuredClone(original);
    sabotage(damaged);
    assert.throws(()=>assayPublicFeedProjection(damaged),/Unreceived public feed evidence/);
  }
});

test("partial feed reception stays visibly partial without counterfeiting missing source evidence",()=>{
  const fixture=aCompletePublication();
  const held=fixture.receipt.sources[1];
  fixture.receipt.sources[1]={companyId:held.companyId,feedUrl:held.feedUrl,state:"unavailable"};
  fixture.receipt.sourceItemCount=3;
  fixture.receipt.admittedItems=3;
  fixture.receipt.emittedItems=3;
  fixture.receipt.completeness="partial-source-coverage";
  fixture.feed.items=fixture.feed.items.filter(x=>x.authors[0].url!==home.group.companies[1].url);
  fixture.graph=JSON.parse(renderFeedItemProvenance(home,fixture.receipt.sources,fixture.feed.items));
  const accepted=assayPublicFeedProjection(fixture);
  assert.equal(accepted.observedSourceFeeds,3);
  assert.equal(accepted.emittedItems,3);
  fixture.receipt.sources[1].inputItems=1;
  assert.throws(()=>assayPublicFeedProjection(fixture),/unreceived source claims input evidence/);
});

test("original main release witnesses exact public provenance bytes, MIME and semantic relations",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/deploy.yml",import.meta.url),"utf8");
  assert.match(workflow,/feed-input-receipt\.json/u);
  assert.match(workflow,/feed-provenance\.jsonld/u);
  assert.match(workflow,/Deployed public bytes differ from original release receipt/u);
  assert.match(workflow,/assayPublicFeedProjection\(\{/u);
  assert.match(workflow,/publicationBodies\.get\('feed\.json'\)/u);
  assert.match(workflow,/new TextDecoder\('utf-8',\{fatal:true\}\)/u);
  assert.match(workflow,/Public syndication evidence lacks bounded JSON media type/u);
});

test("original release accepts only same-language canonical HTML redirects, never evidence redirects",()=>{
  const origin="https://561.group";
  assert.deepEqual(qualifyPublicAssetReadPath({
    origin,path:"feed-provenance.jsonld",redirected:false,
    responseUrl:origin+"/feed-provenance.jsonld",contentType:"application/ld+json"
  }),{mode:"direct"});
  for(const [path,language] of [
    ["zh-hans/index.html","zh-hans"],["lkt/index.html","lkt"]
  ]){
    assert.deepEqual(qualifyPublicAssetReadPath({
      origin,path,redirected:true,responseUrl:origin+"/"+language+"/",
      contentType:"text/html; charset=utf-8"
    }),{mode:"localized-html-redirect",canonical:origin+"/"+language+"/"});
  }
  for(const [path,redirectedTo,type] of [
    ["feed.json","/feed.json?rewrite=1","application/feed+json"],
    ["feed-input-receipt.json","/feed-input-receipt.json","application/json"],
    ["feed-provenance.jsonld","/feed-provenance.jsonld","application/ld+json"],
    ["llms.txt","/llms.txt","text/plain"],
    ["zh-hans/index.html","/lkt/","text/html"],
    ["lkt/index.html","/zh-hans/","text/html"],
    ["lkt/index.html","https://foreign.invalid/lkt/","text/html"],
    ["lkt/index.html","/lkt/?token=1","text/html"],
    ["zh-hans/index.html","/zh-hans/","application/json"],
  ]){
    const responseUrl=redirectedTo.startsWith("https://")?
      redirectedTo:origin+redirectedTo;
    assert.throws(()=>qualifyPublicAssetReadPath({
      origin,path,redirected:true,responseUrl,contentType:type
    }),/redirect|canonical/i,"must refuse unqualified redirect "+path);
  }
  const workflow=readFileSync(new URL("../.github/workflows/deploy.yml",import.meta.url),"utf8");
  assert.match(workflow,/qualifyPublicAssetReadPath\(\{/u);
  assert.match(workflow,/asset\.url,contentType:asset\.headers\.get\('content-type'\)/u);
  assert.match(workflow,/Deployed public bytes differ from original release receipt/u);
});


const RELEASE_SHA_A="1".repeat(40),RELEASE_SHA_B="2".repeat(40);
function publicationWithRevision(){
  const snapshot=aCompletePublication();
  snapshot.sourceRevision={
    repository:"561-group/561.group",origin:home.origin,renderer:"TUFTE",
    application:"LivingWebServer",sourceCommit:RELEASE_SHA_A,
    workerVersionId:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  };
  return snapshot;
}
function proposedFrom(snapshot){
  const proposed=structuredClone(snapshot);
  proposed.sourceRevision.sourceCommit=RELEASE_SHA_B;
  return proposed;
}
const revisionDelta=(past,next)=>comparePublicFeedRevisions({
  home,previous:past,proposed:next,observedAt:"2026-10-27T18:00:00.000Z"
});
test("unchanged public metadata is not invented into an editorial correction",()=>{
  const before=publicationWithRevision(),after=proposedFrom(before);
  const report=revisionDelta(before,after);
  assert.equal(report.editorialReviewRequired,false);
  assert.equal(report.counts.unchanged,4);
  assert.deepEqual(report.metadataRevisions,[]);
  assert.deepEqual(report.aggregateExits,[]);
  assert.equal(report.originalCorrectionPublished,false);
  assert.equal(report.proposedRelease.deployed,false);
});
test("source metadata revisions trigger review with both prior and proposed versions",()=>{
  const before=publicationWithRevision(),after=proposedFrom(before);
  after.feed.items[0].title="Correction candidate: pending source editorial review";
  after.feed.items[0].summary="Changed claimed summary; not a scientific verification";
  const report=revisionDelta(before,after);
  assert.equal(report.editorialReviewRequired,true);
  assert.equal(report.counts.metadataRevisions,1);
  assert.deepEqual(report.metadataRevisions[0].changedFields,["title","summary"]);
  assert.equal(report.metadataRevisions[0].previous.url,
    report.metadataRevisions[0].proposed.url);
  assert.match(report.metadataRevisions[0].previous.title,/T /u);
  assert.equal(report.editorialDecision,"not-admitted");
  assert.equal(report.originalCorrectionPublished,false);
});
test("a new admitted company item is selection, not an implied correction",()=>{
  const before=publicationWithRevision(),after=proposedFrom(before);
  const addition={
    id:"science-new-post",url:science.url+"science-new-post/",
    title:"New accepted science post",summary:"No earlier Group aggregate representation",
    date_published:"2026-10-27T18:00:00Z",
    authors:[{name:science.name,url:science.url}],tags:["research"]
  };
  after.feed.items.unshift(addition);
  after.receipt.sources[0].inputItems++;
  after.receipt.sourceItemCount++;
  after.receipt.admittedItems++;
  after.receipt.emittedItems++;
  after.receipt.sources[0].sha256="sha256:"+"f".repeat(64);
  after.graph=JSON.parse(renderFeedItemProvenance(home,after.receipt.sources,after.feed.items));
  const report=revisionDelta(before,after);
  assert.equal(report.editorialReviewRequired,false);
  assert.equal(report.counts.newlySelected,1);
  assert.equal(report.counts.metadataRevisions,0);
  assert.equal(report.sourceChanges[0].snapshotChanged,true);
});
test("leaving the capped aggregate is a review signal, never a declared withdrawal",()=>{
  const before=publicationWithRevision(),after=proposedFrom(before);
  const omitted=after.feed.items.pop();
  after.receipt.emittedItems--;
  after.receipt.omittedByAggregateLimit++;
  after.graph=JSON.parse(renderFeedItemProvenance(home,after.receipt.sources,after.feed.items));
  const report=revisionDelta(before,after);
  assert.equal(report.editorialReviewRequired,true);
  assert.equal(report.counts.aggregateExits,1);
  assert.equal(report.aggregateExits[0].url,omitted.url);
  assert.equal(report.aggregateExits[0].classification,"absent-from-new-sixty-item-aggregate");
  assert.match(report.aggregateExits[0].qualification,/Not evidence of deletion/);
  assert.equal(report.originalCorrectionPublished,false);
});
test("canonical identifiers cannot move silently to new original articles",()=>{
  const before=publicationWithRevision(),after=proposedFrom(before);
  after.feed.items[0].id="changed-identifier";
  after.graph=JSON.parse(renderFeedItemProvenance(home,after.receipt.sources,after.feed.items));
  const report=revisionDelta(before,after);
  assert.equal(report.editorialReviewRequired,true);
  assert.equal(report.counts.identityConflicts,1);
  assert.equal(report.identityChanges[0].classification,"same-url-new-id");
  assert.equal(report.counts.newlySelected,0);
});
test("partial source coverage is never represented as an authorized retraction",()=>{
  const before=publicationWithRevision(),after=proposedFrom(before);
  const unavailable=after.receipt.sources[1];
  after.receipt.sources[1]={companyId:unavailable.companyId,feedUrl:unavailable.feedUrl,state:"unavailable"};
  after.receipt.sourceItemCount--;
  after.receipt.admittedItems--;
  after.receipt.emittedItems--;
  after.receipt.completeness="partial-source-coverage";
  after.feed.items=after.feed.items.filter(x=>x.authors[0].url!==engineering.url);
  after.graph=JSON.parse(renderFeedItemProvenance(home,after.receipt.sources,after.feed.items));
  const report=revisionDelta(before,after);
  assert.equal(report.coverageProposed,"partial-source-coverage");
  assert.equal(report.editorialReviewRequired,true);
  assert.equal(report.originalCorrectionPublished,false);
});
test("previous live publication is observed before Wrangler, saved in original artifact",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/deploy.yml",import.meta.url),"utf8");
  const observe=workflow.indexOf("Observe previous public feed before replacing it");
  const deploy=workflow.indexOf("uses: cloudflare/wrangler-action@v3");
  const preflight=workflow.indexOf("Refuse incomplete release, duplicate homepage");
  assert.ok(preflight>=0 && observe>preflight && deploy>observe);
  assert.match(workflow,/comparePublicFeedRevisions\(\{home,previous,proposed:current,observedAt\}\)/u);
  assert.match(workflow,/sourceRevision\.artifactDigests\?\.\[name\]/u);
  assert.match(workflow,/observations\/561\.group-publication-transition-review\.json/u);
  assert.match(workflow,/observations\/561\.group-public-delivery\.json/u);
  assert.match(workflow,/originalCorrectionPublished:false/u);
});


test("inline original predeploy observation is a parseable Node module, not dead workflow prose",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/deploy.yml",import.meta.url),"utf8");
  const start=workflow.indexOf("      - name: Observe previous public feed before replacing it;");
  const end=workflow.indexOf("      - uses: cloudflare/wrangler-action@v3",start);
  assert.ok(start>0 && end>start);
  const section=workflow.slice(start,end);
  const found=section.match(/          node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE\n/u);
  assert.ok(found,"original release includes a bounded inline Node script");
  const source=found[1].split("\n").map(line=>
    line.startsWith("          ")?line.slice(10):line).join("\n");
  const result=spawnSync(process.execPath,["--check","--input-type=module"],
    {input:source,encoding:"utf8",timeout:10000});
  assert.equal(result.status,0,result.stderr);
});


test("original deployed blog receiving checks all three public media views against the same response bytes",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/deploy.yml",import.meta.url),"utf8");
  const start=workflow.indexOf("      - name: Receive independent public revision, human/agent and retained site routes");
  const end=workflow.indexOf("      - name: Record original public delivery observation after release",start);
  assert.ok(start>0&&end>start,"public inspection must follow original Wrangler deploy");
  const current=workflow.slice(start,end);
  const script=current.match(/          node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE\n/u);
  assert.ok(script,"the original deployment uses a bounded native Node source verifier");
  const unindented=script[1].split("\n").map(s=>
    s.startsWith("          ")?s.slice(10):s).join("\n");
  const outcome=spawnSync(process.execPath,["--check","--input-type=module"],{
    input:unindented,encoding:"utf8",timeout:10000
  });
  assert.equal(outcome.status,0,outcome.stderr);
  for(const required of [
    "Independent published blog reader coverage",
    "blogHtmlResponse=await read('/blog/','text/html')",
    "blogJsonResponse=await read('/blog/','application/json')",
    "blogMarkdownResponse=await read('/blog/','text/markdown')",
    "blogModel.metadata?.canonical!==host+'/blog/'",
    "originalCoverageTile.html.includes(company.feeds.json)",
    "inputReceipt.emittedItems!==feedReceipt.emittedItems",
    "expected.every(term=>blogHtml.includes(term))",
    "expected.every(term=>originalCoverageTile.html?.includes(term))",
    "expected.every(term=>blogMarkdown.includes(term))",
  ])assert.ok(current.includes(required),"original public receiving must verify "+required);
});
