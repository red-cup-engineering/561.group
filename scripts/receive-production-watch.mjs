#!/usr/bin/env node
// Receive a generated release from the original Production Outcome Watch.
// The private content carrier supplies bytes; this application supplies its
// existing production runner. Canonical service code stays with its owner.
import { readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const [mode, directory, expectedManifest] = process.argv.slice(2);
if (!['verify', 'receive'].includes(mode) || !directory || !/^[a-f0-9]{64}$/.test(expectedManifest ?? ''))
  throw new Error('Usage: receive-production-watch.mjs verify|receive DIRECTORY MANIFEST_SHA256');
const root = resolve(directory);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fixedConfig = {
  name: 'production-outcome-watch',
  main: 'outcome-watch.js',
  compatibility_date: '2026-09-01',
  workers_dev: true,
  no_bundle: true,
  upload_source_maps: false,
  version_metadata: { binding: 'CF_VERSION_METADATA' },
  triggers: { crons: ['*/10 * * * *'] },
  r2_buckets: [{ binding: 'STATE', bucket_name: '561-group-working-state' }],
};
async function bytes(name, maximum) {
  const path = join(root, name), info = await lstat(path);
  if (!info.isFile() || info.size < 1 || info.size > maximum)
    throw new Error('Invalid release file: ' + name);
  return readFile(path);
}
const raw = await bytes('manifest.json', 131072);
if (digest(raw) !== expectedManifest) throw new Error('Release manifest changed');
const manifest = JSON.parse(raw);
if (manifest.kind !== '561-group.production-outcome-watch-release/v1' ||
    manifest.target !== fixedConfig.name || manifest.wranglerVersion !== '4.149.0' ||
    !/^[a-f0-9]{64}$/.test(manifest.policyRevision ?? '') ||
    !Array.isArray(manifest.sources) || manifest.sources.length !== 4 ||
    manifest.sources.some(source => !/^[a-f0-9]{40}$/.test(source.commit ?? '')) ||
    JSON.stringify(Object.keys(manifest.files ?? {}).sort()) !== JSON.stringify(['outcome-watch.js', 'wrangler.json']))
  throw new Error('Incomplete original watcher release');
for (const [name, declared] of Object.entries(manifest.files)) {
  const value = await bytes(name, 2097152);
  if (value.length !== declared.bytes || digest(value) !== declared.sha256)
    throw new Error('Generated release file changed: ' + name);
}
const config = JSON.parse(await bytes('wrangler.json', 16384));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
if (JSON.stringify(canonical(config)) !== JSON.stringify(canonical(fixedConfig)))
  throw new Error('Release changes the existing Worker, R2 binding, schedule or build profile');
if (mode === 'verify') {
  console.log(JSON.stringify({ verified: true, worker: manifest.target, manifest: expectedManifest, policyRevision: manifest.policyRevision }));
  process.exit(0);
}

const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
if (!/^[a-f0-9]{32}$/i.test(account ?? '') || !token) throw new Error('Existing deployment credentials unavailable');
const tag = 'watch-' + expectedManifest.slice(0, 32);
const deadline = Date.now() + 120000;
for (let attempt = 0; attempt < 24 && Date.now() < deadline; attempt++) {
  try {
    // Both the provider record and public edge can take time to converge.
    const provider = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account +
      '/workers/scripts/production-outcome-watch/deployments?per_page=10', {
      redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
    });
    if (!provider.ok) throw new Error('Active Worker deployment read failed: HTTP ' + provider.status);
    const deployment = await provider.json(), latest = deployment?.result?.deployments?.[0];
    const versions = latest?.versions;
    if (deployment.success !== true || versions?.length !== 1 || versions[0].percentage !== 100 ||
        !/^[a-f0-9-]{36}$/i.test(versions[0].version_id ?? ''))
      throw new Error('Expected one active Worker version receiving all traffic');
    const version = versions[0].version_id.toLowerCase();
    const response = await fetch('https://production-outcome-watch.561-group.workers.dev/health', {
      redirect: 'error', cache: 'no-store', headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15000),
    });
    if (response.ok) {
      const health = await response.json();
      if (health.service === manifest.target && health.policyRevision === manifest.policyRevision &&
          health.version?.id?.toLowerCase() === version && health.version?.tag === tag) {
        console.log(JSON.stringify({ received: true, worker: manifest.target, version,
          policyRevision: health.policyRevision, observedPolicyRevision: health.observedPolicyRevision,
          lastRun: health.lastRun, receivedAt: new Date().toISOString() }));
        process.exit(0);
      }
    }
  } catch { /* bounded edge propagation wait */ }
  if (attempt < 23) await delay(5000);
}
throw new Error('Public Worker has not received the active provider version and selected policy');
