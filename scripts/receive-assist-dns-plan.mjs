#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const PROJECT = 'appgprj_6ade663cbd848191ab2353770323dd60';
const SOURCE = 'red-cup-engineering/cloudflare-dns-record-reconciliation-service';
const HOSTS = [
  'alpaca.assist.561.group', 'assist.561.group', 'gig.assist.561.group',
  'vechain.assist.561.group', 'yield.assist.561.group'
];
const FILES = ['bindings.json', 'service/LICENSE', 'service/src/reconcile-cloudflare-dns-record.mjs',
  'service/scripts/reconcile-cloudflare-dns-record.mjs'];
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^(?!0{40}$)[a-f0-9]{40}$/;
const PROVIDER_ID = /^[a-f0-9]{32}$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

async function readRegular(root, relative, limit = 32768) {
  const file = path.join(root, relative);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) fail(`Invalid release file: ${relative}`);
  if (await realpath(file) !== file) fail(`Release file traverses a link: ${relative}`);
  return readFile(file);
}

async function verify(directory, expectedManifest) {
  if (!SHA256.test(expectedManifest ?? '')) fail('A pinned manifest SHA256 is required');
  const root = await realpath(directory);
  const bytes = await readRegular(root, 'manifest.json');
  if (sha256(bytes) !== expectedManifest) fail('Release manifest digest mismatch');
  const manifest = JSON.parse(bytes);
  if (manifest.kind !== '561-group.assist-dns-plan-release/v1' || manifest.mode !== 'plan-only' ||
      manifest.projectId !== PROJECT || manifest.zone !== '561.group' ||
      manifest.protectedHost !== 'kalshi.assist.561.group' ||
      !isDeepStrictEqual(manifest.hostnames, HOSTS) || manifest.recordCount !== 15 ||
      manifest.source?.repository !== SOURCE || !COMMIT.test(manifest.source?.commit ?? '') ||
      manifest.source?.version !== '0.4.0') fail('Release does not describe the admitted DNS planning scope');
  if (!Array.isArray(manifest.files) ||
      !isDeepStrictEqual(manifest.files.map(file => file.path).sort(), [...FILES].sort())) {
    fail('Release file inventory is not exact');
  }
  for (const entry of manifest.files) {
    const content = await readRegular(root, entry.path);
    if (!SHA256.test(entry.sha256) || sha256(content) !== entry.sha256 || content.length !== entry.bytes) {
      fail(`Release file digest or size mismatch: ${entry.path}`);
    }
    if (entry.path.startsWith('service/')) {
      const originalPath = entry.path.slice('service/'.length);
      const blob = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
      if (entry.originalPath !== originalPath || entry.gitBlob !== blob) fail(`Original service blob mismatch: ${entry.path}`);
    }
  }
  const bindings = JSON.parse(await readRegular(root, 'bindings.json'));
  if (bindings.kind !== '561-group.assist-existing-sites-dns/v1' || bindings.projectId !== PROJECT ||
      bindings.sourceOperation !== 'sites.list_custom_domains' ||
      bindings.protectedHost !== 'kalshi.assist.561.group' ||
      !Number.isFinite(Date.parse(bindings.providerObservedAt)) ||
      !Array.isArray(bindings.records) || bindings.records.length !== 15) fail('Invalid Sites DNS declarations');
  const keys = new Set();
  const domainIds = new Map();
  for (const record of bindings.records) {
    const { hostname, domainId, mapping } = record;
    if (!HOSTS.includes(hostname) || !/^appgdom_[a-f0-9]{32}$/.test(domainId ?? '') || record.source !== 'sites') {
      fail('DNS declaration is outside the existing Sites domains');
    }
    if (domainIds.has(hostname) && domainIds.get(hostname) !== domainId) fail('Domain identifier changes between records');
    domainIds.set(hostname, domainId);
    if (!mapping || mapping.zone !== '561.group' || mapping.proxied !== false || mapping.ttl !== 1 ||
        (mapping.state !== undefined && mapping.state !== 'present') ||
        typeof mapping.content !== 'string' || mapping.content.length > 4096) fail('Invalid DNS mapping');
    const cname = mapping.type === 'CNAME' && mapping.name === hostname && mapping.content === 'custom-domains.chatgpt.site';
    const verification = mapping.type === 'TXT' && mapping.name === `_openai-site-verification.${hostname}` &&
      /^openai-site-verification=[A-Za-z0-9_-]+$/.test(mapping.content);
    const certificate = mapping.type === 'TXT' && mapping.name === `_cf-custom-hostname.${hostname}` &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(mapping.content);
    if (!cname && !verification && !certificate) fail('Unexpected DNS record');
    const key = `${mapping.type}:${mapping.name}`;
    if (keys.has(key)) fail('Duplicate DNS declaration');
    keys.add(key);
  }
  if (domainIds.size !== 5 || new Set(domainIds.values()).size !== 5) fail('The five domain bindings are not distinct');
  return { root, manifest, bindings };
}

function invokeOriginalCli(cli, request, token) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [cli], {
      timeout: 25000, maxBuffer: 131072,
      env: { CLOUDFLARE_API_TOKEN: token }
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || error.message).split(token).join('[redacted]').slice(0, 2048);
        reject(new Error(`Original DNS planner refused: ${detail}`));
        return;
      }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Original DNS planner returned invalid JSON')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(`${JSON.stringify(request)}\n`);
  });
}

async function plan(release, manifestDigest, output) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const expectedAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (typeof token !== 'string' || !token) fail('The existing Cloudflare API token is unavailable');
  if (!PROVIDER_ID.test(expectedAccountId ?? '')) fail('The existing Cloudflare account ID is unavailable');
  const report = {
    kind: '561-group.assist-dns-provider-plan/v1', status: 'collecting', dryRun: true,
    projectId: PROJECT, zone: '561.group', expectedAccountId,
    protectedHost: 'kalshi.assist.561.group', manifestSha256: manifestDigest,
    source: release.manifest.source, startedAt: new Date().toISOString(),
    declarationsObservedAt: release.bindings.providerObservedAt, records: []
  };
  const outputPath = path.resolve(output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const save = () => writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  await save();
  try {
    for (const declaration of release.bindings.records) {
      const request = {
        dryRun: true,
        authentication: { token: { environmentVariable: 'CLOUDFLARE_API_TOKEN' }, expectedAccountId, scopes: ['dns:read'] },
        mapping: declaration.mapping
      };
      const receipt = await invokeOriginalCli(path.join(release.root, 'service/scripts/reconcile-cloudflare-dns-record.mjs'), request, token);
      if (receipt.type !== 'CloudflareDnsReconciliationReceipt' || receipt.disposition !== 'planned' ||
          receipt.dryRun !== true || receipt.credentialReturned !== false ||
          !['create', 'update', 'none', 'blocked'].includes(receipt.action) || !Array.isArray(receipt.conflicts) ||
          !PROVIDER_ID.test(receipt.zoneId ?? '') ||
          !isDeepStrictEqual(receipt.mapping, { ...declaration.mapping, state: 'present' }) ||
          receipt.inspection?.mode !== 'environment-token' || receipt.inspection?.credentialReturned !== false ||
          receipt.inspection?.environmentVariable !== 'CLOUDFLARE_API_TOKEN') fail('Unexpected receipt from original DNS planner');
      if (JSON.stringify(receipt).includes(token)) fail('Refusing to save a credential-bearing receipt');
      report.records.push({ hostname: declaration.hostname, domainId: declaration.domainId, receipt });
      await save();
      console.log(JSON.stringify({ hostname: declaration.hostname, type: receipt.mapping.type, name: receipt.mapping.name, action: receipt.action, dryRun: true }));
    }
    report.status = 'complete';
    report.finishedAt = new Date().toISOString();
    await save();
    console.log(JSON.stringify({ status: report.status, records: report.records.length, dryRun: true, output: outputPath }));
  } catch (error) {
    report.status = 'refused';
    report.finishedAt = new Date().toISOString();
    report.refusal = String(error.message).split(token).join('[redacted]').slice(0, 2048);
    await save();
    throw error;
  }
}

try {
  const [mode, directory, manifestDigest, output] = process.argv.slice(2);
  if (!['verify', 'plan'].includes(mode) || !directory || !manifestDigest || (mode === 'plan' && !output)) {
    fail('Usage: receive-assist-dns-plan.mjs verify|plan DIRECTORY MANIFEST_SHA256 [OUTPUT_JSON]');
  }
  const release = await verify(directory, manifestDigest);
  if (mode === 'verify') console.log(JSON.stringify({ verified: true, mode: 'plan-only', projectId: PROJECT, records: 15, source: release.manifest.source }));
  else await plan(release, manifestDigest, output);
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
