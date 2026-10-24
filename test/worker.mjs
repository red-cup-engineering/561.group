import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const estate=JSON.parse(await readFile(path.join(root,'data/estate.json'),'utf8'));estate.revision='local-source-fixture';
const probes=[],puts=[],waits=[],keys=[];let cached;
const statuses=[200,301,401,402,403,404,500];
const context=vm.createContext({Request,Response,URL,AbortSignal,Date,JSON,Promise,fetch:async(url,init)=>{probes.push({url,init});if(probes.length===8)throw Error('fixture timeout');return new Response('fixture',{status:statuses[(probes.length-1)%statuses.length]})},caches:{default:{match:async key=>{keys.push(key.url);return cached},put:async(key,value)=>{puts.push({key:key.url,value})}}}});
const told=new vm.SourceTextModule(await readFile(path.join(root,'src/told.mjs'),'utf8'),{context,identifier:'authored-told'});
const sourceRevision=new vm.SourceTextModule(await readFile(path.join(root,'src/source-revision.mjs'),'utf8'),{context,identifier:'source-revision'});
const data=new vm.SyntheticModule(['default'],function(){this.setExport('default',estate)},{context,identifier:'fixture-estate-records'});
const homeData=JSON.parse(await readFile(path.join(root,'data/home.json'),'utf8'));
const frontdoorData=JSON.parse(await readFile(path.join(root,'data/frontdoor.json'),'utf8'));
const frontdoorModule=new vm.SyntheticModule(['default'],function(){this.setExport('default',frontdoorData)},{context,identifier:'fixture-public-frontdoor'});
const homeModule=new vm.SyntheticModule(['default'],function(){this.setExport('default',homeData)},{context,identifier:'fixture-public-home'});
const livingCalls=[];
const livingModule=new vm.SyntheticModule(['create561GroupLivingApplication','PUBLIC_ROUTES'],function(){
  this.setExport('PUBLIC_ROUTES',['/','/work/','/work/audit/','/projects/','/about/','/for-agents/']);
  this.setExport('create561GroupLivingApplication', ({readHome,readEstate,readFrontdoor}) => ({
    fetch: async request => {
      livingCalls.push({url:request.url,accept:request.headers.get('accept'),home:readHome(),estate:readEstate(),frontdoor:readFrontdoor()});
      return request.headers.get('accept')==='application/json'
        ? Response.json({kind:'tufte.fixture',site:'561.group'})
        : new Response('<main data-tufte>Group living home fixture</main>',{headers:{'content-type':'text/html; charset=utf-8'}});
    }
  }));
},{context,identifier:'fixture-living-web-consumer'});
const worker=new vm.SourceTextModule(await readFile(path.join(root,'src/worker.mjs'),'utf8'),{context,identifier:'authored-worker'});
// Package dependencies (the l-space HTTP edge) load from their real files into the same context.
const { fileURLToPath, pathToFileURL } = await import('node:url');
const loaded=new Map();
const moduleAt=async file=>{if(!loaded.has(file))loaded.set(file,new vm.SourceTextModule(await readFile(file,'utf8'),{context,identifier:file}));return loaded.get(file)};
const resolveFrom=(spec,referrer)=>spec.startsWith('.')?fileURLToPath(new URL(spec,pathToFileURL(referrer))):fileURLToPath(import.meta.resolve(spec));
await worker.link(async(spec,referrer)=>{if(spec==='../public/estate-records.json')return data;if(spec==='../data/home.json')return homeModule;if(spec==='../data/frontdoor.json')return frontdoorModule;if(spec==='./living-home.mjs')return livingModule;if(spec==='./told.mjs')return told;if(spec==='./source-revision.mjs')return sourceRevision;if(spec==='./locales.mjs')return moduleAt(path.join(root,'src/locales.mjs'));if(referrer.identifier.startsWith('/'))return moduleAt(resolveFrom(spec,referrer.identifier));throw Error('unexpected dependency '+spec)});await worker.evaluate();
let count=0;const check=(n,f)=>{f();count++;console.log('PASS',n)};const fetchWorker=worker.namespace.default.fetch;const ctx={waitUntil:p=>waits.push(p)};let assetRequest;
const env={ASSETS:{fetch:async request=>{assetRequest=request;return new Response('original asset body',{status:200,headers:{'content-type':'text/html'}})}}};
const originalReceipt={repository:'561-group/561.group',origin:'https://561.group',
  sourceCommit:'0123456789abcdef0123456789abcdef01234567',renderer:'TUFTE',application:'LivingWebServer'};
const originalVersion='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const receiptMethods=[];
const releaseEnv={CF_VERSION_METADATA:{id:originalVersion},ASSETS:{fetch:async request=>{
  receiptMethods.push(request.method);
  return Response.json(originalReceipt);
}}};
let versionResponse=await fetchWorker(new Request('https://561.group/source-revision.json'),releaseEnv,ctx);
const deliveredReceipt=await versionResponse.json();
check('original source receipt is enriched with the executing Cloudflare version',()=>{
  assert.equal(versionResponse.status,200);
  assert.equal(versionResponse.headers.get('cache-control'),'no-store');
  assert.equal(versionResponse.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(deliveredReceipt,{...originalReceipt,workerVersionId:originalVersion});
});
versionResponse=await fetchWorker(new Request('https://561.group/source-revision.json',{method:'HEAD'}),releaseEnv,ctx);
check('HEAD is bound to the same exact original release with no body',()=>{
  assert.equal(versionResponse.status,200);
  assert.deepEqual(receiptMethods,['GET','GET']);
});
assert.equal(await versionResponse.text(),'');
versionResponse=await fetchWorker(new Request('https://561.group/source-revision.json'),{ASSETS:releaseEnv.ASSETS},ctx);
check('absence of platform version binding refuses release equivalence',()=>assert.equal(versionResponse.status,503));

let response=await fetchWorker(new Request('https://561.group/',{headers:{'accept-language':'zh-CN,zh;q=0.9,en;q=0.5'}}),env,ctx);
check('a reader preferring Mandarin is sent from the root to the Mandarin page',()=>{assert.equal(response.status,302);assert.equal(response.headers.get('location'),'https://561.group/zh-hans/');assert.equal(response.headers.get('vary'),'Accept-Language, Cookie');assert.equal(response.headers.get('x-content-type-options'),'nosniff')});
response=await fetchWorker(new Request('https://561.group/',{headers:{'accept-language':'zh-CN',cookie:'lang=en'}}),env,ctx);
check('a stored English choice reaches the one TUFTE Living Web site',()=>{assert.equal(response.status,200);assert.equal(response.headers.get('content-language'),'en');assert.equal(response.headers.get('vary'),'Accept, Accept-Language, Cookie');assert.equal(livingCalls.length,1);assert.equal(livingCalls[0].home,homeData);assert.equal(livingCalls[0].estate,estate);assert.equal(livingCalls[0].frontdoor,frontdoorData)});
check('root response comes from the TUFTE source, not static assets',()=>assert.equal(response.headers.get('content-type'),'text/html; charset=utf-8'));
response=await fetchWorker(new Request('https://561.group/',{headers:{'accept':'application/json',cookie:'lang=en'}}),env,ctx);
check('the same root preserves machine JSON negotiation',()=>{assert.equal(response.status,200);assert.equal(response.headers.get('content-language'),'en');assert.equal(livingCalls[1].accept,'application/json')});
for(const path of ['/work/','/work/audit/','/projects/','/about/','/for-agents/']){
  response=await fetchWorker(new Request('https://561.group'+path),env,ctx);
  check('public Work/Projects/About/Agents page '+path+' is served by one original TUFTE application',()=>{
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-language'),'en');
    assert.equal(livingCalls.at(-1).url,'https://561.group'+path);
    assert.equal(livingCalls.at(-1).frontdoor,frontdoorData);
  });
  response=await fetchWorker(new Request('https://561.group'+path.slice(0,-1)+'?src=directory'),env,ctx);
  check('extensionless route '+path+' canonicalizes without losing query',()=>{
    assert.equal(response.status,308);
    assert.equal(response.headers.get('location'),'https://561.group'+path+'?src=directory');
  });
}
response=await fetchWorker(new Request('https://561.group/index.html?read=1'),env,ctx);
check('old static index canonicalizes to the one original TUFTE page',()=>{
  assert.equal(response.status,301);
  assert.equal(response.headers.get('location'),'https://561.group/?read=1');
});
response=await fetchWorker(new Request('https://561.group/lkt/'),env,ctx);
check('a locale path is served as is and says its language',()=>{assert.equal(response.status,200);assert.equal(assetRequest.url,'https://561.group/lkt/');assert.equal(response.headers.get('content-language'),'lkt')});
response=await fetchWorker(new Request('https://www.561.group/contact/?a=b'),env,ctx);
check('original alias redirects with exact path/query',()=>{assert.equal(response.status,301);assert.equal(response.headers.get('location'),'https://561.group/contact/?a=b')});
response=await fetchWorker(new Request('https://561.group/contact/'),env,ctx);
check('existing asset route receives unchanged request',()=>assert.equal(assetRequest.url,'https://561.group/contact/'));
check('authored security/contact headers retained',()=>{assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-security-policy'),/form-action 'self' mailto:/)});
check('asset body retained',()=>assert.equal(response.status,200));assert.equal(await response.text(),'original asset body');
response=await fetchWorker(new Request('https://561.group/estate.json?arbitrary=x'),env,ctx);await Promise.all(waits);const body=await response.json();
check('every authored public node and machine probed',()=>assert.equal(probes.length,estate.nodes.length+estate.machines.length));
check('probes use exact paths/manual redirects/timeout',()=>{assert.ok(probes.every(p=>p.init.method==='GET'&&p.init.redirect==='manual'&&p.init.signal instanceof AbortSignal));assert.ok(probes.some(p=>p.url==='https://cold-red-gate.561.group/healthz'))});
check('first responses keep authored four-value semantics',()=>assert.deepEqual(body.nodes.slice(0,8).map(n=>n.told),['true','true','both','both','both','false','false','false']));
check('source revision cache key ignores arbitrary request query',()=>{assert.equal(keys[0],'https://561.group/estate.json?revision=local-source-fixture');assert.equal(puts[0].key,keys[0])});
check('cached estate retains public cache contract',()=>{assert.equal(response.headers.get('cache-control'),'public, max-age=300');assert.equal(body.ttlSeconds,300);assert.equal(body.revision,estate.revision)});
cached=puts[0].value;const probeCount=probes.length;response=await fetchWorker(new Request('https://561.group/estate.json'),env,ctx);
check('cache hit does not re-probe or lose headers',()=>{assert.equal(probes.length,probeCount);assert.equal(response.headers.get('x-content-type-options'),'nosniff')});
check('all four told values preserved including not read',()=>{assert.equal(told.namespace.toldOf(undefined),'neither');assert.equal(told.namespace.toldOf(null),'false');assert.equal(told.namespace.toldOf(204),'true');assert.equal(told.namespace.toldOf(403),'both')});
// An independently installed ACTIVITYPUB_INSTANCE receives only routes the
// site's authored static assets do not serve; no protocol implementation is
// duplicated inside the public-site Worker.
const federatedRequests=[], assetPaths=[];
const federatedEnv={
  ASSETS:{fetch:async request=>{
    const {pathname}=new URL(request.url);
    assetPaths.push([request.method,pathname]);
    if(pathname==='/contact/')return new Response('contact remains a public asset',{status:200});
    return new Response('missing static route',{status:request.method==='POST'?405:404});
  }},
  ACTIVITYPUB_INSTANCE:{fetch:async request=>{
    federatedRequests.push([request.method,new URL(request.url).origin,new URL(request.url).pathname]);
    const {pathname}=new URL(request.url);
    if(pathname==='/actors/group')return new Response(JSON.stringify({id:'https://561.group/actors/group'}),{status:200,headers:{'content-type':'application/activity+json'}});
    if(pathname==='/actors/group/inbox'&&request.method==='POST')return new Response(null,{status:202});
    return new Response(null,{status:404});
  }}
};
response=await fetchWorker(new Request('https://561.group/actors/group'),federatedEnv,ctx);
check('missing static actor route delegates to site-bound ActivityPub instance',()=>{assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/activity+json');assert.equal(response.headers.get('x-content-type-options'),'nosniff')});
const actorPayload=await response.clone().json();
check('returned ActivityPub actor belongs to exact origin',()=>assert.equal(actorPayload.id,'https://561.group/actors/group'));
response=await fetchWorker(new Request('https://561.group/actors/group/inbox',{method:'POST'}),federatedEnv,ctx);
check('POST inbox reaches the real provider after assets 405',()=>assert.equal(response.status,202));
response=await fetchWorker(new Request('https://561.group/contact/'),federatedEnv,ctx);
check('existing public page never calls federation provider',()=>{assert.equal(response.status,200);assert.equal(federatedRequests.length,2)});
response=await fetchWorker(new Request('https://561.group/no-such-route'),federatedEnv,ctx);
check('provider 404 does not replace authored static 404',()=>assert.equal(response.status,404));
response=await fetchWorker(new Request('https://561.group/_private/deliver',{method:'POST'}),federatedEnv,ctx);
check('public origin never forwards private provider queue routes',()=>{assert.equal(response.status,405);assert.equal(federatedRequests.length,3)});
response=await fetchWorker(new Request('https://561.group/actors/group'),{ASSETS:federatedEnv.ASSETS},ctx);
check('without installed provider binding old Worker remains intact',()=>assert.equal(response.status,404));
check('actor and inbox URLs keep canonical origin at provider',()=>assert.deepEqual(federatedRequests,[
 ['GET','https://561.group','/actors/group'],
 ['POST','https://561.group','/actors/group/inbox'],
 ['GET','https://561.group','/no-such-route']
]));

// Semaday: an incoming signed activity must reach the rightful provider
// *unchanged*, even when the assets adapter attempts to read the body before
// declining the POST. No duplicate protocol parser or alternate inbox.
const authoredActivity = JSON.stringify({
  '@context': 'https://www.w3.org/ns/activitystreams',
  id: 'https://peer.example/activities/complete-1',
  type: 'Create',
  actor: 'https://peer.example/actors/sender',
  object: { type: 'Note', content: 'actual activity bytes remain intact' },
});
const assetProbeBodies = [], receivedActivities = [];
const signedEnv = {
  ASSETS: { fetch: async request => {
    assetProbeBodies.push(await request.text());
    return new Response('static method refused', { status: 405 });
  } },
  ACTIVITYPUB_INSTANCE: { fetch: async request => {
    receivedActivities.push({
      method: request.method,
      url: request.url,
      contentType: request.headers.get('content-type'),
      signature: request.headers.get('signature'),
      body: await request.text(),
    });
    return new Response(null, { status: 202 });
  } },
};
response = await fetchWorker(new Request('https://561.group/actors/group/inbox', {
  method: 'POST',
  headers: {
    'content-type': 'application/activity+json',
    signature: 'keyId="https://peer.example/actors/sender#main-key",headers="date digest",signature="fixture"',
  },
  body: authoredActivity,
}), signedEnv, ctx);
check('static asset method probe never consumes the signed federation body', () => {
  assert.deepEqual(assetProbeBodies, ['']);
  assert.equal(response.status, 202);
});
check('original sender, headers, origin and exact activity bytes reach one provider', () => {
  assert.equal(receivedActivities.length, 1);
  const arrived = receivedActivities[0];
  assert.equal(arrived.method, 'POST');
  assert.equal(arrived.url, 'https://561.group/actors/group/inbox');
  assert.equal(arrived.contentType, 'application/activity+json');
  assert.match(arrived.signature, /peer.example/);
  assert.equal(arrived.body, authoredActivity);
});

console.log(JSON.stringify({passed:count,scope:'Actual authored Worker/told modules with deterministic assets and ActivityPub binding fixtures; not evidence of deployed provider.'}));

