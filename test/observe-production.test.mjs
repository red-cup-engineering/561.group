import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { observeProduction, markdownSummary } from '../scripts/observe-production.mjs';
const SHA = '1234567890abcdef1234567890abcdef12345678';
const estate = { revision: 'dated-original-archive', nodes: [{host:'node.561.group',told:'both'}] };
const revision = { repository:'561-group/561.group', origin:'https://561.group', sourceCommit:SHA,
  renderer:'TUFTE', application:'LivingWebServer', workerVersionId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' };
const headers = { 'x-content-type-options':'nosniff', 'strict-transport-security':'max-age=31536000' };
function provider({ revisionStatus = 200, aliasStatus = 301, aliasLocation = 'https://561.group/contact/?witness=1',
 estateBody = JSON.stringify(estate), abortPath = null, blankPath = null,
 secure = true, claim = revision,
 htmlDirective = '', extraHeaders = {}, canonical = path => 'https://561.group' + path,
 robotsBody = 'User-agent: *\nAllow: /',
 researchHref = 'https://science.561.group/', researchAsText = false } = {}) {
  return async url => {
    const path = new URL(url).pathname;
    if (path === abortPath) throw new Error('no route observed');
    if (url.includes('www.561.group')) return new Response('',{status:aliasStatus,headers:{location:aliasLocation}});
    const security = secure ? headers : {};
    const head = '<head><link rel="canonical" href="' + canonical(path) + '">' + htmlDirective + '</head>';
    if (path === '/') {
      const research = researchAsText ? researchHref
        : '<a href="' + researchHref + '">Read original research</a>';
      return new Response('<html>' + head + '<main data-tufte>Group ' + research + '</main></html>',
        {headers:{'content-type':'text/html',...security,...extraHeaders}});
    }
    const journeys = {
      '/work/':'Areas we can scope',
      '/projects/':'Shop, Bazaar and Market',
      '/about/':'The four accountable companies',
      '/for-agents/':'Published machine-readable interfaces'
    };
    if (Object.hasOwn(journeys,path)) return new Response(
      path===blankPath?'<html>'+head+'<main>Empty alpha placeholder</main></html>':
        '<html>'+head+'<main data-tufte><h2>'+journeys[path]+'</h2></main></html>',
      {headers:{'content-type':'text/html',...security,...extraHeaders}}
    );
    if (path === '/contact/') return new Response('<html>'+head+'Contact</html>',{headers:{'content-type':'text/html',...security,...extraHeaders}});
    if (path === '/estate.json') return new Response(estateBody,{headers:{'content-type':'application/json'}});
    if (path === '/llms.txt') return new Response('# 561 Group',{headers:{'content-type':'text/plain'}});
    if (path === '/robots.txt') return new Response(robotsBody,{headers:{'content-type':'text/plain'}});
    if (path === '/sitemap.xml') return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',{headers:{'content-type':'application/xml'}});
    if (path === '/.well-known/security.txt') return new Response('Contact: mailto:emsenn@561.group',{headers:{'content-type':'text/plain'}});
    if (path === '/source-revision.json') return revisionStatus === 404
      ? new Response('',{status:404}) : new Response(JSON.stringify(claim),{headers:{'content-type':'application/json'}});
    throw new Error('fixture lacks path: '+path);
  };
}

test('exact selected source readback and public resources qualify only HTTP observations',async()=>{
  const r=await observeProduction({fetchImpl:provider(),expectedSourceSha:SHA,now:()=> '2026-10-22T00:00:00.000Z'});
  assert.equal(r.overall,'public-checks-passed');
  assert.equal(r.providerDeploymentVerified,false);
  assert.equal(r.independentHumanAcceptance,false);
  assert.ok(r.checks.every(c=>c.outcome==='pass'));
  assert.equal(r.checks.find(c=>c.name==='estate').estateNodes,1);
  assert.equal(r.checks.at(-1).claimedWorkerVersionId,'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  assert.match(r.checks.at(-1).qualification,/public-self-description-only/u);
  assert.match(markdownSummary(r),/not.*established/u);
});

test('a live primary research pathway is checked separately without duplicate homepage requests',async()=>{
  const requests=[];
  const source=provider();
  const r=await observeProduction({fetchImpl:(url,...rest)=>{
    requests.push(url);
    return source(url,...rest);
  },expectedSourceSha:SHA});
  assert.equal(r.overall,'public-checks-passed');
  const c=r.checks.find(x=>x.name==='research-discovery');
  assert.equal(c.outcome,'pass');
  assert.equal(c.httpStatus,200);
  assert.equal(c.contentSha256,r.checks.find(x=>x.name==='homepage').contentSha256);
  assert.equal(requests.filter(url=>url==='https://561.group/').length,1,
    'an additional public journey must reuse the same raw HTTP observation');
  assert.equal(requests.filter(url=>url==='https://561.group/robots.txt').length,1,
    'native indexing checks reuse the original robots observation');
  assert.equal(r.searchConformance.complete,true);
  assert.equal(r.searchConformance.records.length,6);
});

test('HTTP200 does not mask noindex, a foreign canonical, or a Googlebot denial',async()=>{
  for(const [settings,code] of [
    [{htmlDirective:'<meta name="robots" content="noindex">'},'indexing-directive'],
    [{extraHeaders:{'x-robots-tag':'googlebot: noindex'}},'indexing-directive'],
    [{canonical:()=> 'https://example.org/'},'canonical-target'],
    [{robotsBody:'User-agent: *\nAllow: /\n\nUser-agent: Googlebot\nDisallow: /'},'robots-access'],
  ]){
    const r=await observeProduction({fetchImpl:provider(settings)});
    assert.equal(r.checks.find(c=>c.name==='homepage').outcome,'pass');
    assert.equal(r.overall,'public-checks-failed');
    assert.ok(r.searchConformance.records.every(record=>record.checks.some(check=>
      check.code===code && check.status==='nonconformant')));
    assert.ok(r.searchConformance.findings.some(finding=>finding.code===code && finding.action==='repair'));
  }
});

test('native robots uncertainty stays unknown and cannot mask a separate measured fault',async()=>{
  const unknown=await observeProduction({fetchImpl:provider({robotsBody:'User-agent: *\nDisallow: /*?secret='})});
  assert.equal(unknown.overall,'receiving-incomplete');
  assert.ok(unknown.searchConformance.records.some(record=>record.checks.some(check=>
    check.code==='robots-access' && check.status==='unknown')));
  const mixed=await observeProduction({fetchImpl:provider({abortPath:'/robots.txt',htmlDirective:'<meta name="robots" content="noindex">'})});
  assert.equal(mixed.overall,'public-checks-failed','a measured noindex must remain actionable during incomplete robots coverage');
});

test('unknown affected URLs in a GSC notice remain investigation work after current HTTP passes',async()=>{
  const notice={id:'mail-report:synthetic-fixture',property:'sc-domain:561.group',
    reason:'Server error (5xx)',url:null,observedAt:'2026-10-22T07:35:24Z',source:'test-fixture'};
  const r=await observeProduction({fetchImpl:provider(),searchConsole:[notice],now:()=> '2026-10-26T18:00:00Z'});
  assert.equal(r.overall,'public-checks-passed');
  assert.equal(r.searchConformance.complete,false);
  assert.equal(r.searchConformance.providerNotices[0].classification,'unbound');
  assert.ok(r.searchConformance.findings.some(finding=>finding.url===null && finding.action==='investigate'));
  assert.match(markdownSummary(r),/unresolved provider notices remain separate/u);
});

test('loss of research destination is a visible failure, not homepage uptime success',async()=>{
  for(const settings of [
    {researchHref:'https://other.example/'},
    {researchAsText:true}
  ]){
    const r=await observeProduction({fetchImpl:provider(settings),expectedSourceSha:SHA});
    assert.equal(r.checks.find(x=>x.name==='homepage').outcome,'pass');
    assert.equal(r.overall,'public-checks-failed');
    const c=r.checks.find(x=>x.name==='research-discovery');
    assert.equal(c.outcome,'fail');
    assert.equal(c.reason,'missing-research-discovery-link');
  }
  const unknown=await observeProduction({fetchImpl:provider({abortPath:'/'}),expectedSourceSha:SHA});
  assert.equal(unknown.overall,'receiving-incomplete');
  assert.equal(unknown.checks.find(x=>x.name==='research-discovery').outcome,'unknown');
});

test('legacy 404 revision is observed absence, not a false match to source',async()=>{
  const r=await observeProduction({fetchImpl:provider({revisionStatus:404})});
  assert.equal(r.overall,'public-checks-passed');
  assert.equal(r.checks.at(-1).outcome,'not-published');
  assert.equal(r.selectedReleaseSource,null);
  assert.equal(r.providerDeploymentVerified,false);
});

test('expecting a release commit fails closed when revision is absent or mismatched',async()=>{
  for(const setting of [{revisionStatus:404},{claim:{...revision,sourceCommit:'f'.repeat(40)}}]){
    const r=await observeProduction({fetchImpl:provider(setting),expectedSourceSha:SHA});
    assert.equal(r.overall,'public-checks-failed');
    assert.equal(r.checks.at(-1).outcome,'fail');
  }
});

test('a redirect to a different origin or path is not accepted',async()=>{
  const r=await observeProduction({fetchImpl:provider({aliasLocation:'https://example.org/contact/?witness=1'})});
  assert.equal(r.overall,'public-checks-failed');
  assert.equal(r.checks.find(c=>c.name==='www-canonical-redirect').outcome,'fail');
});

test('missing HTTP observation is coverage uncertainty, not declared downtime',async()=>{
  const r=await observeProduction({fetchImpl:provider({abortPath:'/estate.json'})});
  assert.equal(r.overall,'receiving-incomplete');
  assert.equal(r.checks.find(c=>c.name==='estate').outcome,'unknown');
});

test('public information requires actual media/contract and security headers',async()=>{
  const a=await observeProduction({fetchImpl:provider({estateBody:'not JSON'})});
  assert.equal(a.overall,'public-checks-failed');
  assert.equal(a.checks.find(c=>c.name==='estate').reason,'invalid-json');
  const b=await observeProduction({fetchImpl:provider({secure:false})});
  assert.equal(b.overall,'public-checks-failed');
  assert.equal(b.checks.find(c=>c.name==='homepage').reason,'missing-security-headers');
});

test('no ill-formed exact revision selection is silently normalized',async()=>{
  await assert.rejects(observeProduction({fetchImpl:provider(),expectedSourceSha:'main'}),/40-character/u);
});

test('a source-only revision without the actual Worker version cannot certify an installed release',async()=>{
  const r=await observeProduction({fetchImpl:provider({claim:{...revision,workerVersionId:null}}),expectedSourceSha:SHA});
  assert.equal(r.overall,'public-checks-failed');
  assert.equal(r.checks.at(-1).reason,'missing-or-invalid-worker-version');
});

test('the independent public witness rejects an alpha placeholder for a real visitor journey',async()=>{
  const r=await observeProduction({fetchImpl:provider({blankPath:'/work/'}),expectedSourceSha:SHA});
  assert.equal(r.overall,'public-checks-failed');
  assert.equal(r.checks.find(c=>c.name==='work-journey').reason,'missing-useful-visitor-page');
  const normal=await observeProduction({fetchImpl:provider(),expectedSourceSha:SHA});
  assert.ok(['work-journey','projects-journey','about-journey','agent-journey'].every(name=>
    normal.checks.find(c=>c.name===name).outcome==='pass'));
});


test('read-only public witness is executed after an accepted production release, not on main push',()=>{
  const witness=readFileSync(new URL('../.github/workflows/public-delivery-witness.yml',import.meta.url),'utf8');
  const producer=readFileSync(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8');
  assert.match(producer,/^name: Publish and receive 561\.group \(TUFTE \+ LivingWebServer\)$/mu);
  assert.doesNotMatch(witness,/^\s{2}(?:push|workflow_run):\s*$/mu,
    'there is no premature push witness or unobserved chained workflow after release');
  assert.match(witness,/^\s{2}pull_request:\s*$/mu);
  assert.match(witness,/^\s{2}workflow_dispatch:\s*$/mu);
  assert.match(witness,/if: github\.event_name == 'workflow_dispatch'/u,
    'standalone provider diagnostics are manual and cannot reach PR secrets');
  const released=producer.indexOf("Received deployed Group source '+receipt.sourceCommit");
  const recheck=producer.indexOf("name: Record original public delivery observation after release");
  assert.ok(released>0 && recheck>released,
    'actual public/source/provider release readback must precede the original HTTP witness');
  assert.match(producer,/EXPECTED_SOURCE_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/u,
    'source identity must be the checked and deployed original source');
  assert.match(producer,/run: node scripts\/observe-production\.mjs/u);
  assert.match(producer,/name: 561-group-post-release-public-observation/u);
  assert.match(producer,/observations\/561\.group-public-delivery\.json/u);
});
