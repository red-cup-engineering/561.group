import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {qualifyRelease,awaitPublishedRevision} from "../scripts/release-preflight.mjs";

const sha="0123456789abcdef0123456789abcdef01234567";
const receipt={repository:"561-group/561.group",origin:"https://561.group",
  renderer:"TUFTE",application:"LivingWebServer",sourceCommit:sha};
const requiredAssets=["public/estate-records.json","public/contact/index.html",
  "public/llms.txt","public/llms-full.txt","public/sitemap.xml",
  "public/robots.txt","public/zh-hans/index.html","public/lkt/index.html"];
const valid={mainBranch:"main",sourceSha:sha,checkoutSha:sha,receipt,
  lockPresent:true,dependenciesInstalled:true,requiredAssets,duplicateIndex:false};
test("one qualified local source is not mistaken for a deployed provider release",()=>{
  const result=qualifyRelease(valid);
  assert.equal(result.sourceCommit,sha);
  assert.equal(result.providerDeployed,false);
  assert.equal(result.independentlyAccepted,false);
  assert.equal(result.application,"LivingWebServer");
});
test("unqualified branches, missing checkout identity, and stale source receipts refuse",()=>{
  for(const variant of [
    {mainBranch:"feature"},{sourceSha:"main"},
    {checkoutSha:"f".repeat(40)},
    {receipt:{...receipt,sourceCommit:"f".repeat(40)}},
    {receipt:{...receipt,renderer:"Other"}}
  ])assert.throws(()=>qualifyRelease({...valid,...variant}));
});
test("no original supplier lock, installed Fetch runtime, or intact public assets means no release",()=>{
  for(const variant of [
    {lockPresent:false},{dependenciesInstalled:false},
    {requiredAssets:requiredAssets.slice(1)},
    {duplicateIndex:true}
  ])assert.throws(()=>qualifyRelease({...valid,...variant}));
});
test("ordinary npm deploy script cannot bypass source and native tests with bare Wrangler",()=>{
  const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  assert.match(pkg.scripts.deploy,/npm run check/u);
  assert.match(pkg.scripts.deploy,/npm test/u);
  assert.match(pkg.scripts.deploy,/npm run build/u);
  assert.match(pkg.scripts.deploy,/node scripts\/release-preflight\.mjs/u);
  assert.match(pkg.scripts.deploy,/wrangler deploy/u);
  assert.equal(pkg.dependencies["@red-cup-engineering/l-space"],undefined);
  assert.ok(pkg.dependencies["@red-cup-engineering/living-web-server"]);
});


test("public edge may serve the previous revision briefly; bounded receiving waits for the exact one",async()=>{
  const calls=[],delays=[];
  const old={...receipt,sourceCommit:"f".repeat(40)};
  const now={...receipt};
  const fake=async(url,opts)=>{
    calls.push({url,opts});
    return new Response(JSON.stringify(calls.length<3?old:now),{
      status:200,headers:{"content-type":"application/json"}});
  };
  const observed=await awaitPublishedRevision({sourceSha:sha,fetchImpl:fake,
    wait:async ms=>{delays.push(ms);},attempts:4,intervalMs:3000});
  assert.equal(observed.sourceCommit,sha);
  assert.equal(calls.length,3);
  assert.deepEqual(delays,[3000,3000]);
  assert.ok(calls.every(call=>call.url==="https://561.group/source-revision.json"));
  assert.ok(calls.every(call=>call.opts.method==="GET" &&
    call.opts.cache==="no-store" && call.opts.redirect==="manual"));
});

test("never treat an upload, a repeated stale edge or unreadable response as received public revision",async()=>{
  let observations=0;
  await assert.rejects(awaitPublishedRevision({sourceSha:sha,attempts:3,intervalMs:0,
    wait:async()=>{},fetchImpl:async()=>{
      observations++;return new Response(JSON.stringify({...receipt,sourceCommit:"f".repeat(40)}),{
        status:200,headers:{"content-type":"application/json"}});}}),
    /failed exact.*after 3 bounded attempts \(source-mismatch\)/u);
  assert.equal(observations,3);
  await assert.rejects(awaitPublishedRevision({sourceSha:sha,attempts:2,intervalMs:0,
    wait:async()=>{},fetchImpl:async()=>new Response("temporary outage",{status:503})}),
    /http-503/u);
  await assert.rejects(awaitPublishedRevision({sourceSha:sha,attempts:1,
    fetchImpl:async()=>new Response(JSON.stringify({...receipt,repository:"different"}))}),
    /after 1 bounded attempts/u);
});

test("original publisher refuses unchecked source, domain, retry budget and untrusted workflows",async()=>{
  for(const invalid of [
    {sourceSha:"main"},{sourceSha:sha,origin:"https://attacker.invalid"},
    {sourceSha:sha,attempts:0},{sourceSha:sha,attempts:99},
    {sourceSha:sha,intervalMs:-1},{sourceSha:sha,intervalMs:5000}
  ])await assert.rejects(awaitPublishedRevision(invalid),/bounded, exact-source/u);
  const workflow=readFileSync(new URL("../.github/workflows/deploy.yml",import.meta.url),"utf8");
  assert.match(workflow,/awaitPublishedRevision\(\{sourceSha:process\.env\.GITHUB_SHA\}\)/u);
  assert.doesNotMatch(workflow,/const manifest=await read\('\/source-revision\.json'\)/u);
  assert.match(workflow,/latest\.versions\[0\]\.version_id/u);
  assert.match(workflow,/Deployed public bytes differ from original release receipt/u);
});
