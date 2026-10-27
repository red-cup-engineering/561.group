import { mkdtemp, cp, readFile, writeFile } from "node:fs/promises";
import {createHash} from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

// Qualifies the actual unchanged publication producer with a single original
// site-owned estate, not a copied test-game catalogue or a second renderer.
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const scratch=await mkdtemp(path.join(tmpdir(),"apex-publish-"));
const app=path.join(scratch,"app");
await cp(ROOT,app,{recursive:true,filter:p=>!p.includes("node_modules")});
const preload=path.join(scratch,"offline.mjs");
await writeFile(preload,"globalThis.fetch=()=>{throw Error('Offline publication fixture');};\n");
const sourceCommit="0123456789abcdef0123456789abcdef01234567";
const base={...process.env,SITE_PUBLICATION_DATE:"2026-10-22",GITHUB_SHA:sourceCommit};
const run=(extra={})=>{
  const env={...base,...extra};
  for(const [key,value] of Object.entries(env))if(value===null)delete env[key];
  return spawnSync(process.execPath,["--import",preload,"scripts/build.mjs"],{
    cwd:app,env,encoding:"utf8"
  });
};
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log("PASS",name);};
await writeFile(path.join(app,"public/index.html"),"obsolete unqualified static homepage");
await writeFile(path.join(app,"public/source-revision.json"),"stale source claim");
const first=run();
check("actual original build executes with authored ARB inputs and no unavailable language package",()=>assert.equal(first.status,0,first.stderr));
const obsolete=await readFile(path.join(app,"public/index.html"),"utf8").then(()=>true,
  error=>{if(error.code==="ENOENT")return false;throw error;});
check("root has one TUFTE authority and stale static index is removed",()=>assert.equal(obsolete,false));
const names=["source-revision.json","estate-records.json","zh-hans/index.html",
  "lkt/index.html","llms.txt","llms-full.txt","feed.json","feed.atom.xml",
  "feed.rss.xml","feed-input-receipt.json",".well-known/security.txt","8d232583e7cba18a83bf5c0325fcc7c9.txt",
  "humans.txt","robots.txt","sitemap.xml"];
const readOutputs=async()=>Object.fromEntries(await Promise.all(names.map(async name=>[
  name,await readFile(path.join(app,"public",name),"utf8")])));
const before=await readOutputs();
check("offline source-input receipt distinguishes missing inputs from absent original publications",()=>{
  assert.ok(before["llms.txt"].includes("https://561.group/feed-input-receipt.json"), "machine guide links to original source admission receipt");
  const receipt=JSON.parse(before["feed-input-receipt.json"]);
  assert.equal(receipt.schema,"561.group/feed-input-receipt/v1");
  assert.equal(receipt.origin,"https://561.group");
  assert.equal(receipt.sources.length,4);
  assert.deepEqual(receipt.sources.map(s=>s.state),
    ["unavailable","unavailable","unavailable","unavailable"]);
  assert.equal(receipt.completeness,"partial-source-coverage");
  assert.equal(receipt.emittedItems,0);
  assert.equal(receipt.sources.some(s=>s.inputItems!==undefined),false);
});

check("the published site guides humans and agents to every real public page",()=>{
  for(const route of ["/work/","/projects/","/blog/","/about/","/for-agents/"]){
    assert.ok(before["sitemap.xml"].includes("<loc>https://561.group"+route+"</loc>"),
      "sitemap must list actual TUFTE page "+route);
    assert.ok(before["llms.txt"].includes("https://561.group"+route),
      "machine guide must expose practical site entry "+route);
  }
  for(const name of ["Persistent AI systems","Indigenous data governance","Operational reliability"])
    assert.ok(before["llms.txt"].includes(name),"source-backed service "+name);
});
const generated=JSON.parse(before["estate-records.json"]);
const authored=JSON.parse(await readFile(path.join(ROOT,"data/estate.json"),"utf8"));
check("public estate is exactly the original curated site source",()=>{
  assert.deepEqual(generated.nodes,authored.nodes);
  assert.deepEqual(generated.machines,authored.machines);
  assert.deepEqual(generated.doors,authored.doors);
});
check("original Play project stays discoverable without importing its full build",()=>{
  assert.equal(generated.nodes.filter(n=>n.host==="play.561.group").length,1);
  assert.equal(generated.nodes.some(n=>n.host==="fixture.invalid"),false);
});
check("current release binds exact source and every generated public representation",()=>{
  const receipt=JSON.parse(before["source-revision.json"]);
  assert.equal(receipt.repository,"561-group/561.group");
  assert.equal(receipt.sourceCommit,sourceCommit);
  assert.equal(receipt.renderer,"TUFTE");
  assert.equal(receipt.application,"LivingWebServer");
  assert.equal(receipt.origin,"https://561.group");
  assert.equal(receipt.publicationDay,"2026-10-22");
  const expected=Object.fromEntries(Object.entries(before)
    .filter(([name])=>name!=="source-revision.json")
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([name,bytes])=>[name,
      "sha256:"+createHash("sha256").update(bytes,"utf8").digest("hex")]));
  assert.deepEqual(receipt.artifactDigests,expected);
});
check("UTC publication date fixes original security and sitemap output",()=>{
  assert.match(before["sitemap.xml"],/2026-10-22/);
  assert.match(before[".well-known/security.txt"],/Expires: 2027-10-22/);
});
check("repeat original build succeeds",()=>{const second=run();assert.equal(second.status,0,second.stderr);});
const after=await readOutputs();
check("original human and machine artifacts are deterministic",()=>assert.deepEqual(after,before));
const noSourceDay=run({SITE_PUBLICATION_DATE:null});
check("a source-qualified build without an exact publication day refuses",()=>{
  assert.notEqual(noSourceDay.status,0);
  assert.match(noSourceDay.stderr,/requires SITE_PUBLICATION_DATE/);
});
const local=run({GITHUB_SHA:null});
check("unqualified local build succeeds without a counterfeit production receipt",()=>{
  assert.equal(local.status,0,local.stderr);
});
const oldReceipt=await readFile(path.join(app,"public/source-revision.json"),"utf8")
  .then(()=>true,error=>{if(error.code==="ENOENT")return false;throw error;});
check("unqualified local build discards a previous source-revision assertion",()=>assert.equal(oldReceipt,false));
for(const [name,extra,pattern] of [
  ["invalid publication day",{SITE_PUBLICATION_DATE:"2026-02-30"},/real YYYY-MM-DD UTC day/],
  ["invalid source commit",{GITHUB_SHA:"not-a-commit"},/one exact source commit/]
]){
  const v=run(extra);
  check(name+" is refused",()=>{
    assert.notEqual(v.status,0);
    assert.match(v.stderr,pattern);
  });
}
const edited=structuredClone(authored);
for(let i=0;i<46;i++)edited.nodes.push({host:"fixture"+i+".invalid",name:"Fixture",group:"games",line:"Not real"});
await writeFile(path.join(app,"data/estate.json"),JSON.stringify(edited));
const oversized=run();
check("existing Worker probing budget still refuses an oversized owned estate",()=>{
  assert.notEqual(oversized.status,0);
  assert.match(oversized.stderr,/subrequest budget/);
});
console.log(JSON.stringify({passed,scope:"Actual site build + site-owned ARB message projection with upstream witness provenance marked unverified, with offline feed/market observations. No private Play checkout, live deployment or public reader implied."}));
