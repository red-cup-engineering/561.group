import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import { observeProduction, markdownSummary, HOUSE_CLIMATE_ARTICLES } from '../scripts/observe-production.mjs';
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

test('outside HTTP witness measures complete reads without extra network requests',async()=>{
  let tick=0;
  const start=Date.parse('2026-10-28T12:00:00.000Z');
  const clock=()=>new Date(start+10*tick++).toISOString();
  const source=provider(),requests=[];
  const result=await observeProduction({
    fetchImpl:(url,options)=>{requests.push(url);return source(url,options)},
    now:clock,
  });
  const home=result.checks.find(check=>check.name==='homepage');
  const research=result.checks.find(check=>check.name==='research-discovery');
  assert.ok(Number.isSafeInteger(home.readWallMs) && home.readWallMs>0);
  assert.equal(research.readWallMs,home.readWallMs,
    'reuse the existing homepage HTTP observation, including timing');
  assert.equal(requests.filter(url=>url==='https://561.group/').length,1);
  assert.match(markdownSummary(result),/\\| Read ms \\|/u);
  assert.equal(result.providerDeploymentVerified,false);
});

test('the original observer requests identity bytes and binds public digests to that received representation',async()=>{
  const requests=[],source=provider();
  const expected=Buffer.from(await (await source('https://561.group/')).arrayBuffer());
  const result=await observeProduction({fetchImpl:(url,options)=>{
    const headers=new Headers(options.headers);
    assert.equal(headers.get('accept-encoding'),'identity');
    assert.equal(headers.get('cache-control'),'no-cache');
    assert.equal(options.cache,'no-store');
    assert.equal(options.redirect,'manual');
    requests.push(url);
    return source(url,options);
  },expectedSourceSha:SHA});
  const homepage=result.checks.find(check=>check.name==='homepage');
  assert.equal(result.overall,'public-checks-passed');
  assert.equal(homepage.bytes,expected.byteLength);
  assert.equal(homepage.contentSha256,createHash('sha256').update(expected).digest('hex'));
  assert.equal(requests.filter(url=>url==='https://561.group/').length,1);
});

test('unsupported response coding, charset and invalid UTF-8 remain unread evidence in the original consumer',async()=>{
  for(const response of [
    ()=>new Response('<html><head><link rel="canonical" href="https://561.group/"></head></html>',{headers:{'content-type':'text/html','content-encoding':'gzip',...headers}}),
    ()=>new Response('unreceived charset',{headers:{'content-type':'text/html; charset=utf-16',...headers}}),
    ()=>new Response(new Uint8Array([0xc3,0x28]),{headers:{'content-type':'text/html; charset=utf-8',...headers}}),
  ]){
    const source=provider();let homepageRequests=0;
    const result=await observeProduction({fetchImpl:(url,options)=>{
      assert.equal(new Headers(options.headers).get('accept-encoding'),'identity');
      if(url==='https://561.group/'){homepageRequests++;return response();}
      return source(url,options);
    },expectedSourceSha:SHA});
    const homepage=result.checks.find(check=>check.name==='homepage');
    assert.equal(homepage.outcome,'unknown');
    assert.equal(homepage.contentSha256,undefined);
    assert.equal(result.checks.find(check=>check.name==='research-discovery').outcome,'unknown');
    assert.equal(result.overall,'receiving-incomplete');
    assert.equal(result.searchConformance.records.find(record=>record.url==='https://561.group/').status,'unknown');
    assert.equal(homepageRequests,1,'an unread representation is not authority to retry the public resource');
  }
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


// The original four URLs are public reader candidates. Fake responses can
// confirm the detector semantics, not certify any real publisher deployment.
function withHouseClimateEvidence({missing=null,missingLink=null,changedTitle=null,
  wrongCanonical=null,transportUnknown=null}={}) {
  const app=provider();
  return (url,options)=>{
    const target=new URL(url);
    const house=HOUSE_CLIMATE_ARTICLES.find(row=>row.domain===target.hostname);
    if(!house)return app(url,options);
    if(house.house===transportUnknown && target.pathname!=="/")
      throw new Error("Simulated remote publisher cannot be observed");
    const articlePath="/"+house.slug+"/";
    if(target.pathname===articlePath) {
      if(house.house===missing)return new Response("not found",{status:404});
      const canonical=house.house===wrongCanonical?"https://other.example/wrong/":url;
      const title=house.house===changedTitle?"An unrelated publication":house.title;
      return new Response('<!doctype html><html><head><link rel="canonical" href="'+canonical+
        '"></head><body><main><h1>'+title+'</h1><p>Original material is a source claim, not a deployed intervention.</p></main></body></html>',{
        headers:{'content-type':'text/html; charset=utf-8',
          'x-content-type-options':'nosniff','strict-transport-security':'max-age=31536000'}
      });
    }
    if(target.pathname==="/")return new Response(
      '<!doctype html><html><head><link rel="canonical" href="'+url+
      '"></head><body><main><h1>Original company</h1>'+
      (house.house===missingLink?'':'<a href="'+articlePath+'">Read article</a>')+
      '</main></body></html>',{
        headers:{'content-type':'text/html; charset=utf-8',
          'x-content-type-options':'nosniff','strict-transport-security':'max-age=31536000'}
      });
    throw Error("Unqualified fake house route "+url);
  };
}

test('the existing public delivery observer records four exact external climate reader paths without inventing provider receipts',async()=>{
  const calls=[];
  const source=withHouseClimateEvidence();
  const result=await observeProduction({fetchImpl:(url,options)=>{
    calls.push(url);
    return source(url,options);
  },expectedSourceSha:SHA,now:()=>"2026-10-27T20:00:00.000Z"});
  assert.equal(result.overall,'public-checks-passed');
  assert.equal(result.houseClimateVisibility.schema,'561.group.house-climate-reader-observations/v1');
  assert.equal(result.houseClimateVisibility.observedVisible,4);
  assert.equal(result.houseClimateVisibility.missing,0);
  assert.equal(result.houseClimateVisibility.incomplete,0);
  assert.equal(result.houseClimateVisibility.pages.length,4);
  for(const record of result.houseClimateVisibility.pages){
    assert.equal(record.status,'public-page-and-home-link-observed');
    assert.equal(record.article.httpStatus,200);
    assert.equal(record.homepage.httpStatus,200);
    assert.equal(record.article.contentSha256.length,64);
    assert.equal(record.providerReceiptAuthenticated,false);
    assert.equal(record.sourceByteEquivalenceVerified,false);
    assert.equal(record.externallyIndexed,null);
    assert.equal(record.independentHumanAcceptance,null);
    assert.ok(record.articleUrl.startsWith('https://'+record.house+'.561.group/'));
    assert.equal(calls.filter(url=>url===record.articleUrl).length,1);
    assert.equal(calls.filter(url=>url===record.homepageUrl).length,1);
  }
  assert.match(markdownSummary(result),/Four house climate article routes/u);
  assert.match(markdownSummary(result),/not original source\/provider-release qualification/u);
});

test('missing, altered, orphaned and inaccessible house articles remain different observations and never fail the Group release',async()=>{
  const result=await observeProduction({
    fetchImpl:withHouseClimateEvidence({missing:'science',wrongCanonical:'engineering',
      transportUnknown:'operations',missingLink:'services'}),expectedSourceSha:SHA
  });
  assert.equal(result.overall,'public-checks-passed',
    'independent house-source gaps are recorded but cannot revoke a verified Group Worker');
  const byHouse=Object.fromEntries(result.houseClimateVisibility.pages.map(item=>[item.house,item]));
  assert.equal(byHouse.science.status,'article-not-found-on-observed-origin');
  assert.equal(byHouse.science.article.httpStatus,404);
  assert.equal(byHouse.engineering.status,'article-unqualified');
  assert.equal(byHouse.engineering.reason,'missing-exact-article-canonical');
  assert.equal(byHouse.operations.status,'incomplete-public-observation');
  assert.equal(byHouse.operations.reason,'article-unreadable');
  assert.equal(byHouse.services.status,'homepage-unqualified');
  assert.equal(byHouse.services.reason,'article-not-linked-from-home');
  assert.equal(result.houseClimateVisibility.missing,1);
  assert.equal(result.houseClimateVisibility.incomplete,1);
  assert.equal(result.houseClimateVisibility.observedVisible,0);
  assert.ok(result.houseClimateVisibility.pages.every(p=>
    p.providerReceiptAuthenticated===false && p.externallyIndexed===null));
});

test('an article with an unrelated title is not accepted merely because the HTTP route is 200',async()=>{
  const result=await observeProduction({fetchImpl:withHouseClimateEvidence({changedTitle:'science'})});
  assert.equal(result.houseClimateVisibility.pages[0].status,'article-unqualified');
  assert.equal(result.houseClimateVisibility.pages[0].reason,'source-title-not-observed');
  assert.equal(result.houseClimateVisibility.observedVisible,3);
  assert.equal(result.overall,'public-checks-passed');
});

test('external target list remains four original owner-controlled, fully qualified and distinct pages',()=>{
  assert.deepEqual(HOUSE_CLIMATE_ARTICLES.map(x=>x.house),
    ['science','engineering','operations','services']);
  assert.equal(new Set(HOUSE_CLIMATE_ARTICLES.map(x=>x.domain)).size,4);
  assert.equal(new Set(HOUSE_CLIMATE_ARTICLES.map(x=>x.slug)).size,4);
  for(const target of HOUSE_CLIMATE_ARTICLES){
    assert.match(target.domain,/^[a-z-]+\.561\.group$/u);
    assert.match(target.sourceRepository,/^[a-z-]+\/[a-z-]+$/u);
    assert.match(target.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.ok(target.title.length>18);
  }
});
