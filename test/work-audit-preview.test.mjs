import test from "node:test";
import assert from "node:assert/strict";
import {
  PREVIEW_LIMIT,publicRepositoryOf,workContinuityPreview,inspectPublicGitHub
} from "../src/work-audit-preview.mjs";

const SHA_A="a".repeat(40),SHA_B="b".repeat(40);
const when="2026-10-24T12:00:00Z";
const pr=(number,more={})=>({
  number,title:"Deliver concrete Work "+number,state:"closed",
  draft:false,updated_at:when,merged_at:when,
  merge_commit_sha:SHA_B,head:{sha:SHA_A},...more
});

test("same exact public repository address is read without credentials or arbitrary origin",()=>{
  assert.equal(publicRepositoryOf("red-cup-engineering/561.group").fullName,
    "red-cup-engineering/561.group");
  assert.equal(publicRepositoryOf("https://github.com/red-cup-engineering/561.group").fullName,
    "red-cup-engineering/561.group");
  for(const value of [
    "https://evil.example/example/repo","https://github.com/u/r/pull/1",
    "https://github.com/u/r?secret=1","../repo","u//repo","u/r/README.md",
    "https://github.com/u/r#target","https://github.com/u/r@anything"
  ])assert.throws(()=>publicRepositoryOf(value),TypeError);
});

test("a buyer gets an actionable, source-attributed PR report rather than a fabricated delivered outcome",()=>{
  const report=workContinuityPreview({
    repository:"red-cup-engineering/561.group",pulls:[pr(42),pr(43,{state:"open",merged_at:null,merge_commit_sha:null})],
    actions:{workflow_runs:[{id:123,head_sha:SHA_B,status:"completed",conclusion:"success",event:"push"}]},
    deployments:[{sha:SHA_B,id:99}],
    observedAt:when
  });
  assert.equal(report.counts.examined,2);
  assert.equal(report.counts.merged,1);
  assert.equal(report.counts.actionsReportedSuccess,1);
  assert.equal(report.records[0].actions.source,"merge-commit");
  assert.equal(report.records[0].deployment,"recorded-not-verified");
  assert.equal(report.records[0].recipientAcceptance,"not-observed-by-public-github-api");
  assert.ok(report.records[0].gaps.some(x=>x.includes("independent beneficiary acceptance")));
  assert.equal(report.counts.independentCustomerAcceptance,null);
  assert.equal(report.records[1].actions.reading,"unobserved-in-sample");
  assert.ok(report.limits.every(x=>typeof x==="string" && x.length>20));
  assert.ok(!JSON.stringify(report).includes('"accepted":true'));
});

test("a failure, absent evidence and a closed-unmerged PR remain distinct",()=>{
  const unmerged=pr(19,{state:"closed",merged_at:null,merge_commit_sha:null});
  const report=workContinuityPreview({repository:"demo/repo",pulls:[unmerged],
    actions:{workflow_runs:[{id:9,head_sha:SHA_A,status:"completed",conclusion:"failure"}]},
    deployments:null,observedAt:when});
  assert.equal(report.records[0].state,"closed-without-merge");
  assert.equal(report.records[0].actions.reading,"reported-failure");
  assert.equal(report.records[0].deployment,"source-unavailable");
  assert.ok(report.records[0].gaps.some(x=>x.includes("closure reason")));
  assert.equal(report.records[0].recipientAcceptance,"not-observed-by-public-github-api");
});

test("public GitHub reading performs an actual three-source job with no account credentials",async()=>{
  const seen=[];
  const route=async (url,request)=>{
    seen.push({url,request});
    assert.equal(request.method,"GET");
    assert.equal(request.credentials,"omit");
    assert.equal(request.redirect,"error");
    assert.ok(url.startsWith("https://api.github.com/repos/example/public-code"));
    const data=url.includes("/pulls?")?[pr(17)]:
      url.includes("/actions/runs?")?{workflow_runs:[{id:30,head_sha:SHA_B,status:"completed",conclusion:"success"}]}:
      url.includes("/deployments?")?[{id:40,sha:SHA_B}]:
      {full_name:"example/public-code",private:false};
    return Response.json(data);
  };
  const report=await inspectPublicGitHub("https://github.com/example/public-code",route,()=>when);
  assert.equal(seen.length,4);
  assert.equal(report.source.observation,when);
  assert.equal(report.counts.actionsReportedSuccess,1);
  assert.equal(report.records[0].sourceUrl,"https://github.com/example/public-code/pull/17");
  assert.deepEqual(report.sourceWarnings,[]);
});

test("a denied optional Actions read does not erase legitimate PR Work source",async()=>{
  const reader=async url=>{
    if(url.includes("/actions/runs?"))return new Response("denied",{status:403});
    if(url.includes("/deployments?"))return new Response("unavailable",{status:503});
    if(url.includes("/pulls?"))return Response.json([pr(1)]);
    return Response.json({full_name:"example/repo",private:false});
  };
  const report=await inspectPublicGitHub("example/repo",reader,()=>when);
  assert.equal(report.records.length,1);
  assert.equal(report.records[0].actions.reading,"source-unavailable");
  assert.equal(report.records[0].deployment,"source-unavailable");
  assert.equal(report.sourceWarnings.length,2);
});

test("the free preview never silently widens past its contracted Work set",()=>{
  const pulls=Array.from({length:PREVIEW_LIMIT},(_,i)=>pr(i+1,{head:{sha:SHA_A}}));
  const report=workContinuityPreview({repository:"example/repo",pulls,actions:null,deployments:null,observedAt:when});
  assert.equal(report.truncated,true);
  assert.equal(report.records.length,PREVIEW_LIMIT);
  assert.throws(()=>workContinuityPreview({repository:"example/repo",pulls:[...pulls,pr(21)],observedAt:when}),/bounded/u);
});
