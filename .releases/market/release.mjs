#!/usr/bin/env node
// The Group owns only the existing credential/carrier lane. Market owns the
// release algorithm and Cloudflare owns its effects; both arrive as pinned
// original source-derived bytes in the already-established private carrier.
import { readFile, realpath, stat, lstat, appendFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const SHA = /^[a-f0-9]{64}$/u, COMMIT = /^[a-f0-9]{40}$/u;
const ROOT = '561-group/561-group-frontdoor-services-section';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function requireThat(condition, message) { if (!condition) throw new Error(message); }

export async function selectMarketCarrier(file = '.releases/market/selection.json') {
  let bytes;
  try { bytes = await readFile(file); }
  catch (error) { if (error.code === 'ENOENT') return { ready: false }; throw error; }
  requireThat(bytes.length <= 16 * 1024, 'Market carrier selection exceeds its bound');
  const selection = JSON.parse(bytes);
  requireThat(selection.kind === '561.market-worker-carrier-selection/v1' && selection.repository === ROOT &&
    COMMIT.test(selection.revision ?? '') && SHA.test(selection.manifestSha256 ?? '') &&
    /^\.service-releases\/market\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/u.test(selection.directory ?? ''),
  'Select one exact original Market carrier in the existing private source');
  return { ready: true, ...selection };
}

async function selectedMarketManifest(directory, expectedManifestSha256) {
  requireThat(SHA.test(expectedManifestSha256 ?? ''), 'Exact selected carrier manifest digest required');
  const root = await realpath(directory);
  const info = await stat(resolve(root, 'manifest.json'));
  requireThat(info.isFile() && info.size < 128 * 1024, 'Carrier manifest must be a bounded file');
  const bytes = await readFile(resolve(root, 'manifest.json'));
  requireThat(hash(bytes) === expectedManifestSha256, 'Selected original carrier manifest changed');
  const manifest = JSON.parse(bytes);
  requireThat(manifest.kind === '561.market-worker-release/v1' &&
    manifest.target?.scriptName === 'market-561-group' && manifest.target?.origin === 'https://market.561.group' &&
    manifest.source?.market?.repository === 'red-cup-engineering/market.561.group' && COMMIT.test(manifest.source.market.revision),
  'This credential lane is restricted to the existing original Market target');
  requireThat(manifest.artifacts?.receiver && [7, 15].includes(Object.keys(manifest.artifacts).length), 'Original Market carrier closure missing');
  const seen = new Set();
  for (const [name, item] of Object.entries(manifest.artifacts)) {
    requireThat(typeof item.path === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,220}$/u.test(item.path) &&
      !item.path.split('/').some(part => !part || part === '.' || part === '..') && !seen.has(item.path) &&
      SHA.test(item.sha256 ?? '') && Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= (name === 'sourceMap' ? 64 : 32) * 1024 * 1024,
    'Every carrier file must have one exact bounded selection');
    seen.add(item.path);
  }
  return { root, manifest };
}

async function containedCarrierPath(root, selectedPath) {
  const file = await realpath(resolve(root, selectedPath)), rel = relative(root, file);
  requireThat(rel && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'Carrier path escapes the selected source');
  return file;
}

async function verifyCarrierFile(root, item) {
  const file = await containedCarrierPath(root, item.path), info = await stat(file);
  requireThat(info.isFile() && info.size === item.bytes, 'Carrier file size differs from selected bytes');
  requireThat(hash(await readFile(file)) === item.sha256, 'Carrier file digest differs from selected bytes');
}

export async function verifyMarketCarrier(directory, expectedManifestSha256) {
  const { root, manifest } = await selectedMarketManifest(directory, expectedManifestSha256);
  for (const item of Object.values(manifest.artifacts)) await verifyCarrierFile(root, item);
  return { manifest, receiver: resolve(root, manifest.artifacts.receiver.path), root };
}

/** Explicit local transport effect before read-only verification. The original
 * manifest still selects uncompressed bytes. A missing file can arrive only as
 * its standard gzip sibling in the same pinned carrier, never as an archive or
 * a replacement manifest. No existing raw file is overwritten or bypassed. */
export async function receiveMarketCarrier(directory, expectedManifestSha256) {
  const { root, manifest } = await selectedMarketManifest(directory, expectedManifestSha256);
  const restoredArtifacts = [];
  for (const [name, item] of Object.entries(manifest.artifacts)) {
    const target = resolve(root, item.path);
    let existing;
    try { existing = await lstat(target); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) { await verifyCarrierFile(root, item); continue; }
    const parent = dirname(target);
    requireThat(await realpath(parent) === parent, 'Carrier write parent must not be a symlink');
    const compressedFile = await containedCarrierPath(root, `${item.path}.gz`), info = await stat(compressedFile);
    requireThat(info.isFile() && info.size > 0 && info.size <= 16 * 1024 * 1024, 'Compressed carrier file exceeds its bound');
    const compressed = await readFile(compressedFile);
    requireThat(compressed.length === info.size, 'Compressed carrier file changed while receiving');
    const bytes = gunzipSync(compressed, { maxOutputLength: item.bytes });
    requireThat(bytes.length === item.bytes, 'Expanded carrier file size differs from selected bytes');
    requireThat(hash(bytes) === item.sha256, 'Expanded carrier file digest differs from selected bytes');
    // Recheck the parent immediately before an exclusive write. A racing raw
    // file is refused by wx; receiving never replaces pre-existing material.
    requireThat(await realpath(parent) === parent, 'Carrier write parent must not be a symlink');
    await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
    restoredArtifacts.push(name);
  }
  return { ...await verifyMarketCarrier(root, expectedManifestSha256), restoredArtifacts };
}

if (import.meta.main) {
  const [command, directory, expectedManifestSha256, ...extra] = process.argv.slice(2);
  if (command === 'select') {
    requireThat(directory === undefined && !extra.length, 'Selection is read only from reviewed Group main');
    const selected = await selectMarketCarrier();
    if (process.env.GITHUB_OUTPUT) {
      const outputs = [`ready=${selected.ready}`];
      if (selected.ready) outputs.push(`revision=${selected.revision}`, `directory=${selected.directory}`, `manifest=${selected.manifestSha256}`);
      await appendFile(process.env.GITHUB_OUTPUT, `${outputs.join('\n')}\n`);
    }
    console.log(JSON.stringify({ ready: selected.ready, reason: selected.ready ? 'Exact original Market carrier selected' : 'No received Market artifact selected; no provider access' }));
  } else if (command === 'receive') {
    requireThat(!extra.length, 'Use receive with the selected carrier directory and manifest digest');
    const received = await receiveMarketCarrier(directory, expectedManifestSha256);
    console.log(JSON.stringify({ received: true, restoredArtifacts: received.restoredArtifacts, providerAccess: false }));
  } else {
    requireThat(['verify', 'release'].includes(command) && !extra.length, 'Use select, verify, or release');
    const received = await verifyMarketCarrier(directory, expectedManifestSha256);
    if (command === 'verify') {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLOUDFLARE_')));
      execFileSync(process.execPath, [received.receiver, '--verify', received.root, expectedManifestSha256], { env, stdio: 'inherit', timeout: 120_000 });
    } else {
      requireThat(process.env.GITHUB_REPOSITORY === 'red-cup-engineering/561.group' && process.env.GITHUB_REF === 'refs/heads/main' &&
        ['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME) && COMMIT.test(process.env.GITHUB_SHA ?? '') &&
        process.env.RUNNER_TEMP, 'Only the original reviewed Group main credential lane may run this effect');
      const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', maxBuffer: 4096 }).trim();
      requireThat(revision === process.env.GITHUB_SHA, 'Carrier checkout is not the selected Group edition');
      execFileSync(process.execPath, [received.receiver, received.root, expectedManifestSha256,
        resolve(process.env.RUNNER_TEMP, 'market-release/receipt.json'), revision], { stdio: 'inherit', timeout: 18 * 60_000 });
    }
  }
}
