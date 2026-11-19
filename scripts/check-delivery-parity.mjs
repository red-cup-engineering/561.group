#!/usr/bin/env node
// Compare independently observed public Worker identity and Cloudflare's active
// deployment. These witnesses do not by themselves authenticate source code or
// constitute human acceptance, and neither observation authorizes mutation.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const HEX40=/^[a-f0-9]{40}$/iu;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const ORIGIN='https://561.group';
const REQUIRED_ROUTES=['homepage','contact','estate','agent-discovery','crawl-policy','sitemap','www-canonical-redirect'];
const OUTPUT='observations/561.group-public-provider-parity.json';

export function compareDelivery({publicObservation,providerObservation}={}){
  const pub=publicObservation,provider=providerObservation;
  const claim=pub?.checks?.find(c=>c.name==='source-revision-claim');
  const notes=[];
  const report=code=>{if(!notes.includes(code))notes.push(code)};
  const expected=pub?.selectedReleaseSource;
  const source=claim?.claimedSourceCommit;
  const publicVersion=claim?.claimedWorkerVersionId;
  const providerVersions=provider?.versions;
  const native=provider?.status==='observed'&&provider?.origin===ORIGIN&&provider.worker==='561-group-site';
  const single=native&&Array.isArray(providerVersions)&&providerVersions.length===1&&
    UUID.test(providerVersions[0].versionId??'')&&providerVersions[0].trafficPercentage===100;
  const providerVersion=single?providerVersions[0].versionId.toLowerCase():null;
  if(!pub||pub.origin!==ORIGIN||!Array.isArray(pub.checks))report('public-coverage-unavailable');
  if(!claim||claim.outcome!=='pass')report('public-source-claim-unreceived');
  if(!HEX40.test(expected??'')||!HEX40.test(source??''))
    report('exact-source-selection-unavailable');
  else if(expected.toLowerCase()!==source.toLowerCase())
    report('source-commit-mismatch');
  if(!UUID.test(publicVersion??''))report('public-worker-version-unavailable');
  if(!native)report(provider?.status==='coverage-unmounted'?
    'provider-credential-coverage-unmounted':'provider-identity-unobserved');
  else if(!single)report('provider-active-version-not-single-100-percent');
  if(single&&UUID.test(publicVersion??'')&&providerVersion!==publicVersion.toLowerCase())
    report('public-provider-version-disagreement');
  // Release identity is a separate seam: a missing receipt cannot turn seven
  // independently successful public routes into a route-failure finding.
  const publicRoutes=new Map((pub?.checks??[]).map(c=>[c.name,c]));
  if(REQUIRED_ROUTES.some(name=>publicRoutes.get(name)?.outcome!=='pass'))
    report('public-routes-not-independently-received');
  return {
    schema:'561.group.public-provider-correspondence/v1',origin:ORIGIN,
    observedAt:new Date().toISOString(),
    sourceSelected:HEX40.test(expected??'')?expected:null,
    sourceClaimed:HEX40.test(source??'')?source:null,
    publicWorkerVersion:UUID.test(publicVersion??'')?publicVersion.toLowerCase():null,
    providerWorkerVersion:providerVersion,
    providerDeploymentId:native?provider.deploymentId:null,
    status:notes.includes('public-provider-version-disagreement')?'contradicted':
      notes.length?'receiving-incomplete':'version-correspondence-observed',
    diagnostics:notes,providerCoverage:provider?.status??'unknown',
    sourceIntegrityIndependentlyAuthenticated:false,
    independentReaderAccepted:false
  };
}
const read=async path=>{try{return JSON.parse(await readFile(path,'utf8'))}catch{return null}};
async function main(){
  const result=compareDelivery({
    publicObservation:await read('observations/561.group-public-delivery.json'),
    providerObservation:await read('observations/561.group-provider-deployment.json')
  });
  await mkdir('observations',{recursive:true});
  await writeFile(OUTPUT,JSON.stringify(result,null,2)+'\n');
  console.log('561.group public/provider correspondence: '+result.status+
    ' ('+result.diagnostics.join(', ')+'); no separate human acceptance claimed');
  if(result.status!=='version-correspondence-observed')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
