import test from "node:test";
import assert from "node:assert/strict";
import {
  PREVIEW_LIMIT,publicRepositoryOf,workContinuityPreview,inspectPublicGitHub,buyerScopeSummary
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
      url.includes("/issues?")?[]:
      {full_name:"example/public-code",private:false};
    return Response.json(data);
  };
  const report=await inspectPublicGitHub("https://github.com/example/public-code",route,()=>when);
  assert.equal(seen.length,5);
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
    if(url.includes("/issues?"))return Response.json([]);
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


test("the paid-audit preview covers original Issues and author-claimed PR realization, not just code PRs",()=>{
  const issue={number:31,title:"Customer order stays unreconciled",state:"open",state_reason:null,
    updated_at:"2026-10-24T14:00:00Z",closed_at:null};
  const report=workContinuityPreview({
    repository:"example/repo",
    pulls:[pr(42,{updated_at:"2026-10-24T13:00:00Z",body:"Fixes #31 after acceptance"})],
    issues:[issue,{...pr(42),pull_request:{url:"https://api.github.com/repos/example/repo/pulls/42"}}],
    actions:{workflow_runs:[]},deployments:[],observedAt:when
  });
  assert.equal(report.counts.examined,2);
  assert.equal(report.counts.issuesExamined,1);
  assert.equal(report.counts.pullRequestsExamined,1);
  assert.equal(report.counts.openIssues,1);
  const issueResult=report.records[0];
  assert.equal(issueResult.workKind,"issue");
  assert.equal(issueResult.sourceUrl,"https://github.com/example/repo/issues/31");
  assert.deepEqual(issueResult.authoredFixClaims,[42]);
  assert.equal(issueResult.recipientAcceptance,"not-observed-by-public-github-api");
  assert.ok(issueResult.gaps.some(g=>g.includes("confirm source/effect")));
});

test("issue and PR order is a single bounded recent Work sample, not two 20-row audit promises",()=>{
  const pulls=Array.from({length:PREVIEW_LIMIT},(_,i)=>pr(i+1,{
    updated_at:"2026-10-24T12:00:00Z"
  }));
  const issues=Array.from({length:PREVIEW_LIMIT},(_,i)=>({
    number:i+101,title:"Demand "+i,state:"open",updated_at:"2026-10-24T13:00:00Z"
  }));
  const report=workContinuityPreview({repository:"example/repo",pulls,issues,observedAt:when});
  assert.equal(report.records.length,20);
  assert.equal(report.counts.issuesExamined,20);
  assert.equal(report.counts.pullRequestsExamined,0);
  assert.equal(report.truncated,true);
});

test("denied public issue access does not invent a Work-closed status",async()=>{
  const reader=async url=>{
    if(url.includes("/issues?"))return new Response("rate limited",{status:403});
    if(url.includes("/pulls?"))return Response.json([pr(1)]);
    if(url.includes("/actions/runs?"))return Response.json({workflow_runs:[]});
    if(url.includes("/deployments?"))return Response.json([]);
    return Response.json({full_name:"example/repo",private:false});
  };
  const result=await inspectPublicGitHub("example/repo",reader,()=>when);
  assert.equal(result.records.length,1);
  assert.equal(result.source.issuesAvailable,false);
  assert.ok(result.sourceWarnings.some(message=>message.includes("Issue")));
});

test("commercial handoff is an attributable, voluntarily copied request for scope not an order",()=>{
 const report=workContinuityPreview({repository:"example/repo",
   pulls:[pr(6)],issues:[{number:9,title:"Buyer sees no delivered data",state:"open",
      updated_at:"2026-10-24T14:00:00Z"}],observedAt:when});
 const value=buyerScopeSummary(report);
 assert.match(value,/Request for a scoped Work-continuity audit/u);
 assert.match(value,/https:\/\/github\.com\/example\/repo/u);
 assert.match(value,/issue #9/u);
 assert.match(value,/pull-request #6/u);
 assert.match(value,/not an accepted order/u);
 assert.match(value,/independent acceptance or payment/u);
});

test("genuine GitHub UTC-second timestamps preserve newest Work order without inventing calendar days",()=>{
 const report=workContinuityPreview({repository:"example/repo",
   pulls:[pr(7,{updated_at:"2026-10-24T21:35:19Z"})],
   issues:[{number:31,title:"Older customer need",state:"open",
     updated_at:"2026-10-24T05:33:30Z"}],observedAt:when});
 assert.equal(report.records[0].workKind,"pull-request");
 assert.equal(report.records[0].updatedAt,"2026-10-24T21:35:19Z");
 assert.equal(report.records[1].updatedAt,"2026-10-24T05:33:30Z");
 const invalid=workContinuityPreview({repository:"example/repo",
    pulls:[pr(8,{updated_at:"2026-02-30T13:00:00Z"})],observedAt:when});
 assert.equal(invalid.records[0].updatedAt,null);
});
