#!/usr/bin/env node
// Writes the generated files in public/ from data/. Fonts, favicon and card are sources.

import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { renderHumans, renderSecurity, renderIndex, renderLlms, renderLlmsFull, renderRobots, renderSitemap } from "../src/render.mjs";
import { readFeedsWithCoverage, mergeItems, renderFeedInputReceipt, renderFeedItemProvenance, renderJsonFeed, renderAtom, renderRss } from "../src/feed.mjs";
import {renderEditorialQuestionProvenance} from "../src/editorial-question-provenance.mjs";
import {renderStaticAssetHeaders} from "../src/public-delivery.mjs";
import { LOCALES, localePath, siteSpace, speaker } from "../src/locales.mjs";

const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const home = await read("data/home.json");
const frontdoorBytes=await readFile(new URL("data/frontdoor.json",root));
const frontdoor=JSON.parse(frontdoorBytes.toString("utf8"));
const frontdoorSha256=createHash("sha256").update(frontdoorBytes).digest("hex");
// A release advertises the exact site-source commit supplied by its original GitHub checkout.
const sourceCommit = process.env.GITHUB_SHA;
if (sourceCommit !== undefined && !/^[0-9a-f]{40}$/iu.test(sourceCommit)) throw new Error("GITHUB_SHA must be one exact source commit");
const authored = await read("data/estate.json");
// The Group front door is independently publishable; Play owns its full game catalog.
// Visitors reach that live catalog through the one curated play.561.group entry.
// A homepage release must not require installing every independent game checkout.
const publicationDay = process.env.SITE_PUBLICATION_DATE;
if (publicationDay && (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDay) ||
    new Date(publicationDay + "T00:00:00Z").toISOString().slice(0, 10) !== publicationDay)) {
  throw new Error("SITE_PUBLICATION_DATE must be one real YYYY-MM-DD UTC day");
}
if(sourceCommit && !publicationDay) {
  throw new Error("A source-qualified publication requires SITE_PUBLICATION_DATE from the exact git revision");
}
const updated = publicationDay ?? new Date().toISOString().slice(0, 10);
// The market's live offer count, read from its x402 discovery; absent (never guessed) when unreadable.
const marketOffers = await (async () => {
  try {
    const response = await fetch(home.group.marketDiscovery, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
    const { resources } = response.ok ? await response.json() : {};
    return Array.isArray(resources) ? resources.length : undefined;
  } catch {
    return undefined;
  }
})();
const facts = { marketOffers, frontdoor };
// What the Group is publishing: the companies' feeds, merged; any that cannot be read are skipped.
const { feeds: companyFeeds, sources: feedSources } = await readFeedsWithCoverage(home.group.companies);
const withheldFeedItems = [];
const items = mergeItems(companyFeeds, undefined, { onReject: reading => withheldFeedItems.push(reading) });
// Independent release logs can report actual feed source reception without
// mistaking a skipped source for an empty original archive.
console.log("feed input observation", JSON.stringify({
  sources: feedSources.map(({companyId,state,inputItems})=>({
    companyId,state,...(inputItems===undefined?{}:{inputItems})
  })),
  excludedItems:withheldFeedItems.length, emittedItems:items.length
}));

const estate = { ...authored, nodes: [...authored.nodes] };
estate.revision = createHash("sha256").update(JSON.stringify(estate)).digest("hex");

const hosts = new Set(estate.nodes.map((n) => n.host));
for (const door of estate.doors) if (!hosts.has(door)) throw new Error(`door ${door} is not an estate node`);
for (const n of estate.nodes) if (!estate.groups.some((g) => g.id === n.group)) throw new Error(`${n.host}: unknown group ${n.group}`);
if (estate.nodes.length + (estate.machines ?? []).length > 45) throw new Error("estate.json exceeds the Worker's per-request subrequest budget for probing");

// Every language is projected from its original authored ARB source.
// Upstream x-l-space attribution remains evidence only; unverified witness hashes
// never become new "current" claims in the site's limited locale adapter.
const readText = (path) => readFile(new URL(path, root), "utf8");
const space = siteSpace({
  interfaceSource: await readText("locales/en.arb"),
  renderings: await Promise.all(LOCALES.slice(1).map((tag) => readText(`locales/${tag}.arb`))),
  home,
  estate,
});
const speakers = Object.fromEntries(LOCALES.map((tag) => [tag, speaker(space, tag, { origin: home.origin })]));
const files = {
  // Cloudflare deployment configuration: intentionally NOT a public GET path.
  // The source-revision manifest contains only publicly retrievable artifacts.
  "public/_headers":renderStaticAssetHeaders(),
  // Original source-generated Work audit browser program, not a second site.
  "public/work/audit/preview.mjs": await readText("src/work-audit-preview.mjs"),
  "public/estate-records.json": JSON.stringify(estate, null, 2) + "\n",
  // English / is served by TUFTE + LivingWebServer, never by a competing static index.
  ...Object.fromEntries(LOCALES.filter(tag => tag !== "en").map((tag) => [`public${localePath(tag)}index.html`, renderIndex(home, estate, speakers[tag], items)])),
  "public/feed-input-receipt.json": renderFeedInputReceipt(home, feedSources, items, withheldFeedItems),
  "public/feed-provenance.jsonld": renderFeedItemProvenance(home, feedSources, items),
  "public/editorial-question-provenance.jsonld": renderEditorialQuestionProvenance(home,frontdoor,frontdoorSha256),
  "public/feed.json": renderJsonFeed(home, items),
  "public/feed.atom.xml": renderAtom(home, items),
  "public/feed.rss.xml": renderRss(home, items),
  "public/llms.txt": renderLlms(home, estate, facts),
  "public/llms-full.txt": renderLlmsFull(home, estate, facts),
  "public/.well-known/security.txt": renderSecurity(home, new Date(`${updated}T00:00:00Z`)),
  [`public/${home.group.indexNowKey}.txt`]: `${home.group.indexNowKey}\n`,
  "public/humans.txt": renderHumans(home, updated),
  "public/robots.txt": renderRobots(home),
  "public/sitemap.xml": renderSitemap(home, updated, speakers.en.alternates()),
};
// Every generated representation has exact bytes independently observable
// after deployment. External news/market snapshots can change over time;
 // their release-time bytes, not unverifiable source-only equivalence, are
 // bound by this digest map. The receipt itself is deliberately excluded
 // from its own hash to avoid self-reference.
if(sourceCommit){
  const artifactDigests=Object.fromEntries(Object.entries(files)
    .filter(([path])=>path!=="public/_headers") // not a retrievable asset
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([path,body])=>[path.slice("public/".length),
      "sha256:"+createHash("sha256").update(body,"utf8").digest("hex")]));
  files["public/source-revision.json"]=JSON.stringify({
    repository:"561-group/561.group",sourceCommit,renderer:"TUFTE",
    application:"LivingWebServer",origin:home.origin,
    publicationDay:updated,artifactDigests
  },null,2)+"\n";
}
// A prior static English index is never another competing authority for /.
// A local build without a qualified exact source SHA cannot retain an old
// production claim. Do this only AFTER every generated body validates.
await rm(new URL("public/index.html", root), {force:true});
if (!sourceCommit) await rm(new URL("public/source-revision.json", root), {force:true});
for (const [path, body] of Object.entries(files)) {
  await mkdir(new URL(path.slice(0, path.lastIndexOf("/") + 1), root), { recursive: true });
  const destination=new URL(path,root);
  const staging=new URL(path+".staging-"+process.pid,root);
  try {
    await writeFile(staging, body, {flag:"wx"});
    await rename(staging,destination);
  } finally {
    await rm(staging,{force:true});
  }
  console.log(`wrote ${fileURLToPath(destination)} (${body.length} bytes)`);
}
