#!/usr/bin/env node
// Recovery of the existing 561-group-site Worker; this file never publishes or rolls back.
// Its provider-native evidence is distinct from a public-HTTP witness or operator approval.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const WORKER = '561-group-site';
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const ACCOUNT = /^[a-f0-9]{32}$/iu;
const RECEIPT = 'observations/561.group-worker-recovery-preflight.json';
const RESULT = 'observations/561.group-worker-recovery-result.json';

function exactUuid(value, name) {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new TypeError(name + ' must be one exact Cloudflare UUID');
  }
  return value.toLowerCase();
}

function singleVersion(deployment) {
  if (!deployment || !Array.isArray(deployment.versions) || deployment.versions.length !== 1) return null;
  const version = deployment.versions[0];
  if (!UUID.test(version?.version_id ?? '') || version.percentage !== 100) return null;
  return version.version_id.toLowerCase();
}

export function deploymentsOf(payload) {
  // The Cloudflare v4 API documents the newest deployment first.
  if (payload?.success !== true || !Array.isArray(payload?.result?.deployments) ||
      payload.result.deployments.length === 0) {
    throw new Error('Cloudflare did not supply its documented deployment list');
  }
  const entries = payload.result.deployments;
  if (entries.length > 100 || entries.some(d => !UUID.test(d?.id ?? '') ||
      !Array.isArray(d?.versions))) {
    throw new Error('Cloudflare deployment evidence is malformed');
  }
  return entries;
}

/** An independently selected historical 100%-traffic version, not a guessed previous upload. */
export function qualifyRollback(payload, {expectedDeploymentId, targetVersionId}) {
  const expected = exactUuid(expectedDeploymentId, 'expected active deployment');
  const target = exactUuid(targetVersionId, 'target version');
  const entries = deploymentsOf(payload);
  const active = entries[0], activeVersion = singleVersion(active);
  if (active.id.toLowerCase() !== expected) {
    throw new Error('Active deployment changed since the recovery decision');
  }
  if (!activeVersion) {
    throw new Error('Active deployment is split or unqualified; do not guess a rollback target');
  }
  if (activeVersion === target) throw new Error('Requested target is already the active version');
  const historical = entries.slice(1).find(d => singleVersion(d) === target);
  if (!historical) {
    throw new Error('Target was not witnessed as an earlier 100%-traffic deployment');
  }
  return Object.freeze({
    schema: '561.group.worker-recovery-preflight/v1',
    worker: WORKER,
    observedAt: new Date().toISOString(),
    activeDeploymentId: expected,
    activeVersionId: activeVersion,
    historicalDeploymentId: historical.id.toLowerCase(),
    targetVersionId: target,
    inspectionScope: 'Cloudflare provider-native deployment history (first 100 entries)',
    providerReceiptAuthenticated: 'API-token-accepted',
    rollbackPerformed: false,
  });
}

/** Check an independently fetched subsequent deployment; do not infer success from Wrangler stdout. */
export function verifyRollback(payload, before) {
  if (before?.schema !== '561.group.worker-recovery-preflight/v1' ||
      before.worker !== WORKER) throw new Error('Missing site-owned provider preflight');
  const entries = deploymentsOf(payload);
  const latest = entries[0];
  if (latest.id.toLowerCase() === before.activeDeploymentId) {
    throw new Error('No new deployment was observed after recovery');
  }
  if (singleVersion(latest) !== before.targetVersionId) {
    throw new Error('Cloudflare is not serving the explicitly selected recovery version at 100%');
  }
  return Object.freeze({
    schema: '561.group.worker-recovery-result/v1',
    worker: WORKER,
    observedAt: new Date().toISOString(),
    priorDeploymentId: before.activeDeploymentId,
    priorVersionId: before.activeVersionId,
    targetVersionId: before.targetVersionId,
    receivedDeploymentId: latest.id.toLowerCase(),
    providerVersionReceived: true,
    publicHttpReceived: false,
    independentReaderAccepted: false,
  });
}

export async function fetchDeployments({accountId, apiToken, fetchImpl=fetch}) {
  if (!ACCOUNT.test(accountId ?? '') || typeof apiToken !== 'string' || !apiToken.trim()) {
    throw new Error('Exact Cloudflare account identity and nonempty private token required');
  }
  const endpoint = 'https://api.cloudflare.com/client/v4/accounts/' +
    accountId + '/workers/scripts/' + WORKER + '/deployments?per_page=100';
  const response = await fetchImpl(endpoint, {
    method: 'GET', redirect: 'error', cache: 'no-store',
    headers: {authorization: 'Bearer ' + apiToken, accept: 'application/json'},
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Cloudflare deployment read refused: HTTP ' + response.status);
  if (Number(response.headers.get('content-length') || 0) > 2_000_000) {
    throw new Error('Cloudflare deployment reading exceeded size bound');
  }
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('Cloudflare deployment reading exceeded size bound');
  return JSON.parse(body);
}

async function main() {
  const mode = process.argv[2];
  if (!['preflight','verify'].includes(mode)) throw new Error('Mode must be preflight or verify');
  if (process.env.GITHUB_REF !== 'refs/heads/main' ||
      process.env.RECOVERY_CONFIRMATION !== 'ROLLBACK 561.group') {
    throw new Error('Explicit main-branch recovery confirmation missing');
  }
  const provider = await fetchDeployments({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  });
  await mkdir('observations',{recursive:true});
  if (mode === 'preflight') {
    const receipt = qualifyRollback(provider,{
      expectedDeploymentId: process.env.EXPECTED_DEPLOYMENT_ID,
      targetVersionId: process.env.TARGET_VERSION_ID,
    });
    await writeFile(RECEIPT,JSON.stringify(receipt,null,2)+'\n');
    console.log('Provider preflight: active '+receipt.activeDeploymentId+
      ', exact historical version '+receipt.targetVersionId+'; no change made');
    return;
  }
  const before = JSON.parse(await readFile(RECEIPT,'utf8'));
  if (before.targetVersionId !== exactUuid(process.env.TARGET_VERSION_ID,'target version') ||
      before.activeDeploymentId !== exactUuid(process.env.EXPECTED_DEPLOYMENT_ID,'expected deployment')) {
    throw new Error('Recovery inputs changed between preflight and verification');
  }
  const result = verifyRollback(provider,before);
  await writeFile(RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('Cloudflare new deployment '+result.receivedDeploymentId+
    ' serves exact restored version '+result.targetVersionId+
    '; separate public HTTP receiving still required');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
