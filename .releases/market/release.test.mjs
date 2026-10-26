import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { selectMarketCarrier, verifyMarketCarrier } from './release.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('no selected artifact never becomes implicit release authority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'market-carrier-selection-'));
  try {
    assert.deepEqual(await selectMarketCarrier(join(root, 'missing.json')), { ready: false });
    const file = join(root, 'selection.json');
    await writeFile(file, JSON.stringify({ kind: '561.market-worker-carrier-selection/v1', repository: 'unselected/other-service', revision: 'a'.repeat(40), manifestSha256: 'b'.repeat(64), directory: '.service-releases/market/fixture' }));
    await assert.rejects(selectMarketCarrier(file), /existing private source/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the Group verifies every selected original byte before executing any receiver', async () => {
  const root = await mkdtemp(join(tmpdir(), 'market-carrier-bytes-'));
  try {
    const artifacts = {};
    for (const key of ['worker', 'buildReceipt', 'candidateDeclarations', 'incumbentDeclarations', 'nativeQualification', 'receiver', 'receiverInputs']) {
      const bytes = Buffer.from(`fixture ${key}`), path = `${key}.txt`;
      await writeFile(join(root, path), bytes); artifacts[key] = { path, bytes: bytes.length, sha256: sha(bytes) };
    }
    const manifest = { kind: '561.market-worker-release/v1', target: { scriptName: 'market-561-group', origin: 'https://market.561.group' },
      source: { market: { repository: 'red-cup-engineering/market.561.group', revision: 'a'.repeat(40) } }, artifacts };
    const bytes = Buffer.from(JSON.stringify(manifest)); await writeFile(join(root, 'manifest.json'), bytes);
    assert.equal((await verifyMarketCarrier(root, sha(bytes))).manifest.source.market.revision, 'a'.repeat(40));
    await writeFile(join(root, artifacts.receiver.path), 'changed receiver');
    await assert.rejects(verifyMarketCarrier(root, sha(bytes)), /file (?:size|digest)/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an exact digest never authorizes reading a carrier symlink outside its pinned directory', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'market-carrier-escape-'));
  const root = await mkdtemp(join(parent, 'carrier-'));
  try {
    const bytes = Buffer.from('outside fixture'); await writeFile(join(parent, 'outside'), bytes);
    const artifacts = {};
    for (const key of ['worker', 'buildReceipt', 'candidateDeclarations', 'incumbentDeclarations', 'nativeQualification', 'receiver', 'receiverInputs']) {
      const path = `${key}.txt`; await symlink(join(parent, 'outside'), join(root, path));
      artifacts[key] = { path, bytes: bytes.length, sha256: sha(bytes) };
    }
    const manifest = Buffer.from(JSON.stringify({ kind: '561.market-worker-release/v1', target: { scriptName: 'market-561-group', origin: 'https://market.561.group' },
      source: { market: { repository: 'red-cup-engineering/market.561.group', revision: 'a'.repeat(40) } }, artifacts }));
    await writeFile(join(root, 'manifest.json'), manifest);
    await assert.rejects(verifyMarketCarrier(root, sha(manifest)), /escapes/u);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('the native carrier retains all fifteen files and refuses omitted or changed Parameters bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'market-native-carrier-bytes-'));
  try {
    const artifacts = {};
    for (const key of ['worker', 'buildReceipt', 'candidateDeclarations', 'incumbentDeclarations', 'nativeQualification', 'receiver', 'receiverInputs',
      'sourceInputs', 'packageManifests', 'sourceManifest', 'lockfile', 'configuration', 'metafile', 'sourceMap', 'parameterSourceManifest']) {
      const bytes = Buffer.from(`fixture ${key}`), path = key === 'parameterSourceManifest' ? 'parameters-package.json' : `${key}.txt`;
      await writeFile(join(root, path), bytes); artifacts[key] = { path, bytes: bytes.length, sha256: sha(bytes) };
    }
    const manifest = { kind: '561.market-worker-release/v1', target: { scriptName: 'market-561-group', origin: 'https://market.561.group' },
      source: { market: { repository: 'red-cup-engineering/market.561.group', revision: 'a'.repeat(40) } }, artifacts };
    const bytes = Buffer.from(JSON.stringify(manifest)); await writeFile(join(root, 'manifest.json'), bytes);
    assert.equal(Object.keys((await verifyMarketCarrier(root, sha(bytes))).manifest.artifacts).length, 15);
    await writeFile(join(root, artifacts.parameterSourceManifest.path), 'changed Parameters');
    await assert.rejects(verifyMarketCarrier(root, sha(bytes)), /file (?:size|digest)/u);
    delete artifacts.parameterSourceManifest;
    const incomplete = Buffer.from(JSON.stringify(manifest)); await writeFile(join(root, 'manifest.json'), incomplete);
    await assert.rejects(verifyMarketCarrier(root, sha(incomplete)), /carrier closure missing/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
