#!/usr/bin/env node
// Read the live Cloudflare deployment identity for the same Worker that serves 561.group.
// Provider-native observation; NOT an assertion that any Git commit was published.
// Unattended observer uses only a dedicated read token, not production deployment authority.
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {deploymentsOf,fetchDeployments} from './worker-recovery.mjs';

const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const ACCOUNT=/^[a-f0-9]{32}$/iu;
const OUTPUT='observations/561.group-provider-deployment.json';

/**
 * Observable provider version metadata is not the source commit, HTTP
 * availability, a human acceptance, or the authorization to roll back.
 * Unknown access is recorded as unknown coverage rather than site failure.
 */
export async function observeProviderDeployment({
  accountId,apiToken,fetchImpl=fetch,now=()=>new Date().toISOString()
}={}) {
  const base={schema:'561.group.provider-deployment-observation/v1',
    origin:'https://561.group',worker:'561-group-site',
    observedAt:now(),observationKind:'provider-native-api',
    sourceCommitVerified:false,publicHttpVerified:false,operatorAccepted:false};
  if(!ACCOUNT.test(accountId??'')||!apiToken){
    return {...base,status:'coverage-unmounted',reason:'no-configured-provider-read-credential'};
  }
  let latest;
  try {
    latest=deploymentsOf(await fetchDeployments({accountId,apiToken,fetchImpl}))[0];
  } catch {
    return {...base,status:'unknown',reason:'provider-request-or-response-not-received'};
  }
  const releases=latest.versions;
  if(releases.length<1||releases.length>2||
     releases.some(v=>!UUID.test(v?.version_id??'')||
       !Number.isFinite(v.percentage)||v.percentage<=0||v.percentage>100)||
     Math.abs(releases.reduce((sum,v)=>sum+v.percentage,0)-100)>0.001){
    return {...base,status:'unknown',reason:'provider-version-distribution-not-qualified'};
  }
  return {
    ...base,status:'observed',deploymentId:latest.id.toLowerCase(),
    deploymentCreatedAt:latest.created_on??null,
    versions:releases.map(v=>({versionId:v.version_id.toLowerCase(),trafficPercentage:v.percentage})),
    evidenceScope:'Cloudflare API accepted the token and identified its active deployment; site source revision not established'
  };
}

async function main() {
  const observation=await observeProviderDeployment({
    accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken:process.env.CLOUDFLARE_READ_API_TOKEN
  });
  await mkdir('observations',{recursive:true});
  await writeFile(OUTPUT,JSON.stringify(observation,null,2)+'\n');
  const detail=observation.status==='observed'
    ? 'active deployment '+observation.deploymentId+', versions '+observation.versions.map(v=>v.versionId+'@'+v.trafficPercentage+'%').join(', ')
    : observation.status+' ('+observation.reason+')';
  console.log('561.group provider-native read: '+detail+
    '; no source-to-version equality or independent reader acceptance claimed');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
