import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, mkdir, open, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { selectMarketCarrier, verifyMarketCarrier, receiveMarketCarrier } from './release.mjs';

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

test('the exact selection names observation or release, with legacy selections retaining release semantics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'market-operation-selection-'));
  try {
    const file = join(root, 'selection.json'), selected = { kind: '561.market-worker-carrier-selection/v1',
      repository: '561-group/561-group-frontdoor-services-section', revision: 'a'.repeat(40), manifestSha256: 'b'.repeat(64),
      directory: '.service-releases/market/fixture' };
    await writeFile(file, JSON.stringify(selected)); assert.equal((await selectMarketCarrier(file)).operation, 'release');
    for (const operation of ['observe', 'release']) {
      await writeFile(file, JSON.stringify({ ...selected, operation })); assert.equal((await selectMarketCarrier(file)).operation, operation);
    }
    for (const operation of ['deploy', 'release; echo fixture', null, false]) {
      await writeFile(file, JSON.stringify({ ...selected, operation }));
      await assert.rejects(selectMarketCarrier(file), /existing private source/u);
    }
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

const commonArtifacts = ['worker', 'buildReceipt', 'candidateDeclarations', 'incumbentDeclarations', 'nativeQualification', 'receiver', 'receiverInputs'];
const nativeArtifacts = ['sourceInputs', 'packageManifests', 'sourceManifest', 'lockfile', 'configuration', 'metafile', 'sourceMap', 'parameterSourceManifest'];
async function withGzipCarrier(run, { native = false } = {}) {
  const parent = await mkdtemp(join(tmpdir(), 'market-gzip-carrier-')), root = join(parent, 'carrier');
  await mkdir(root);
  const artifacts = {}, original = {};
  for (const key of [...commonArtifacts, ...(native ? nativeArtifacts : [])]) {
    const bytes = Buffer.from(`original fixture ${key}`), path = `${key}.txt`;
    original[key] = bytes;
    artifacts[key] = { path, bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(join(root, path + (key === 'worker' || key === 'sourceMap' ? '.gz' : '')),
      key === 'worker' || key === 'sourceMap' ? gzipSync(bytes) : bytes);
  }
  const manifest = { kind: '561.market-worker-release/v1', target: { scriptName: 'market-561-group', origin: 'https://market.561.group' },
    source: { market: { repository: 'red-cup-engineering/market.561.group', revision: 'a'.repeat(40) } }, artifacts };
  const select = async () => {
    const bytes = Buffer.from(JSON.stringify(manifest)); await writeFile(join(root, 'manifest.json'), bytes); return sha(bytes);
  };
  try { await run({ parent, root, manifest, original, select, digest: await select() }); }
  finally { await rm(parent, { recursive: true, force: true }); }
}

test('explicit gzip receiving restores the exact native fifteen-file closure and is idempotent', async () => {
  await withGzipCarrier(async ({ root, manifest, original, digest }) => {
    await assert.rejects(verifyMarketCarrier(root, digest), { code: 'ENOENT' });
    await assert.rejects(lstat(join(root, manifest.artifacts.worker.path)), { code: 'ENOENT' });
    const received = await receiveMarketCarrier(root, digest);
    assert.deepEqual(received.restoredArtifacts, ['worker', 'sourceMap']);
    for (const [key, item] of Object.entries(manifest.artifacts)) assert.deepEqual(await readFile(join(root, item.path)), original[key]);
    assert.deepEqual((await receiveMarketCarrier(root, digest)).restoredArtifacts, []);
    assert.equal(Object.keys((await verifyMarketCarrier(root, digest)).manifest.artifacts).length, 15);
  }, { native: true });
});

test('an optional original held receipt is received as another exact byte-bound artifact', async () => {
  for (const native of [false, true]) await withGzipCarrier(async ({ root, manifest, select }) => {
    const bytes = Buffer.from('original held fixture receipt');
    manifest.artifacts.priorReleaseReceipt = { path: 'prior-release-receipt.json', bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(join(root, 'prior-release-receipt.json'), bytes);
    const digest = await select();
    const received = await receiveMarketCarrier(root, digest);
    assert.equal(Object.keys(received.manifest.artifacts).length, native ? 16 : 8);
    await writeFile(join(root, 'prior-release-receipt.json'), 'altered held receipt');
    await assert.rejects(verifyMarketCarrier(root, digest), /file (?:size|digest)/u);
  }, { native });
});

test('an unrelated eighth artifact cannot stand in for the original held receipt', async () => {
  await withGzipCarrier(async ({ root, manifest, select }) => {
    const bytes = Buffer.from('unrelated fixture');
    manifest.artifacts.arbitrary = { path: 'arbitrary.txt', bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(join(root, 'arbitrary.txt'), bytes);
    await assert.rejects(receiveMarketCarrier(root, await select()), /carrier closure missing/u);
  });
});

test('malformed and truncated gzip cannot create a selected raw artifact', async () => {
  for (const compressed of [Buffer.from('not a gzip stream'), gzipSync(Buffer.from('original fixture worker')).subarray(0, -4)]) {
    await withGzipCarrier(async ({ root, manifest, digest }) => {
      const target = join(root, manifest.artifacts.worker.path);
      await writeFile(`${target}.gz`, compressed);
      await assert.rejects(receiveMarketCarrier(root, digest), error => ['Z_DATA_ERROR', 'Z_BUF_ERROR'].includes(error.code));
      await assert.rejects(lstat(target), { code: 'ENOENT' });
    });
  }
});

test('gzip length and digest disagreement are refused before any raw write', async () => {
  for (const [bytes, expected] of [[Buffer.from('short'), /file size/u], [Buffer.from('altered! fixture worker'), /file digest/u]]) {
    await withGzipCarrier(async ({ root, manifest, digest }) => {
      const target = join(root, manifest.artifacts.worker.path);
      await writeFile(`${target}.gz`, gzipSync(bytes));
      await assert.rejects(receiveMarketCarrier(root, digest), expected);
      await assert.rejects(lstat(target), { code: 'ENOENT' });
    });
  }
});

test('native gzip expansion is bounded by the selected output size', async () => {
  await withGzipCarrier(async ({ root, manifest, digest }) => {
    const target = join(root, manifest.artifacts.worker.path);
    await writeFile(`${target}.gz`, gzipSync(Buffer.alloc(1024 * 1024, 65)));
    await assert.rejects(receiveMarketCarrier(root, digest), { code: 'ERR_BUFFER_TOO_LARGE' });
    await assert.rejects(lstat(target), { code: 'ENOENT' });
  });
});

test('the compressed input bound is checked before decompression', async () => {
  await withGzipCarrier(async ({ root, manifest, digest }) => {
    const target = join(root, manifest.artifacts.worker.path), file = await open(`${target}.gz`, 'w');
    try { await file.truncate(16 * 1024 * 1024 + 1); } finally { await file.close(); }
    await assert.rejects(receiveMarketCarrier(root, digest), /Compressed carrier file exceeds/u);
    await assert.rejects(lstat(target), { code: 'ENOENT' });
  });
});

test('gzip receiving refuses descriptor traversal and compressed symlink escape', async () => {
  await withGzipCarrier(async ({ parent, root, manifest, original, select }) => {
    manifest.artifacts.worker.path = '../outside-worker';
    await assert.rejects(receiveMarketCarrier(root, await select()), /exact bounded selection/u);
    await assert.rejects(lstat(join(parent, 'outside-worker')), { code: 'ENOENT' });
    manifest.artifacts.worker.path = 'worker.txt';
    await writeFile(join(parent, 'outside.gz'), gzipSync(original.worker));
    await rm(join(root, 'worker.txt.gz'));
    await symlink(join(parent, 'outside.gz'), join(root, 'worker.txt.gz'));
    await assert.rejects(receiveMarketCarrier(root, await select()), /escapes/u);
    await assert.rejects(lstat(join(root, 'worker.txt')), { code: 'ENOENT' });
  });
});

test('a missing artifact cannot be restored through a symlinked write parent', async () => {
  await withGzipCarrier(async ({ root, manifest, original, select }) => {
    await mkdir(join(root, 'actual'));
    await symlink(join(root, 'actual'), join(root, 'alias'));
    manifest.artifacts.worker.path = 'alias/worker.txt';
    await writeFile(join(root, 'actual/worker.txt.gz'), gzipSync(original.worker));
    await assert.rejects(receiveMarketCarrier(root, await select()), /write parent must not be a symlink/u);
    await assert.rejects(lstat(join(root, 'actual/worker.txt')), { code: 'ENOENT' });
  });
});

test('existing raw artifacts are verified without fallback, overwrite or replacement', async () => {
  await withGzipCarrier(async ({ root, manifest, original, digest }) => {
    const target = join(root, manifest.artifacts.worker.path);
    await writeFile(target, original.worker); await writeFile(`${target}.gz`, 'malformed unused sibling');
    assert.deepEqual((await receiveMarketCarrier(root, digest)).restoredArtifacts, []);
    assert.deepEqual(await readFile(target), original.worker);
    const changed = Buffer.from('changed raw fixture'); await writeFile(target, changed);
    await writeFile(`${target}.gz`, gzipSync(original.worker));
    await assert.rejects(receiveMarketCarrier(root, digest), /file (?:size|digest)/u);
    assert.deepEqual(await readFile(target), changed);
    await rm(target); await symlink(join(root, 'missing-raw'), target);
    await assert.rejects(receiveMarketCarrier(root, digest), { code: 'ENOENT' });
    assert.equal((await lstat(target)).isSymbolicLink(), true);
  });
});

test('the actual Group CLI verifies observation without credentials and dispatches only the selected read-only operation', async () => {
  await withGzipCarrier(async ({ parent, root, manifest, select }) => {
    const argsFile = join(parent, 'received-arguments.json');
    const receiver = Buffer.from("require('node:fs').writeFileSync(process.env.FIXTURE_ARGUMENTS, JSON.stringify({args:process.argv.slice(2),credentialPresent:Boolean(process.env.CLOUDFLARE_API_TOKEN)}));\n");
    await writeFile(join(root, manifest.artifacts.receiver.path), receiver);
    manifest.artifacts.receiver.bytes = receiver.length; manifest.artifacts.receiver.sha256 = sha(receiver);
    const digest = await select(); await receiveMarketCarrier(root, digest);
    const selectionRoot = join(parent, '.releases/market'); await mkdir(selectionRoot, { recursive: true });
    await writeFile(join(selectionRoot, 'selection.json'), JSON.stringify({ kind: '561.market-worker-carrier-selection/v1',
      repository: '561-group/561-group-frontdoor-services-section', revision: 'a'.repeat(40),
      directory: '.service-releases/market/fixture', manifestSha256: digest, operation: 'observe' }));
    execFileSync('git', ['init', '--quiet', parent]);
    execFileSync('git', ['-C', parent, 'add', '.releases/market/selection.json']);
    execFileSync('git', ['-C', parent, '-c', 'user.name=Native fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '--quiet', '-m', 'Native observation fixture']);
    const revision = execFileSync('git', ['-C', parent, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const env = { ...process.env, GITHUB_REPOSITORY: 'red-cup-engineering/561.group', GITHUB_REF: 'refs/heads/main',
      GITHUB_EVENT_NAME: 'push', GITHUB_SHA: revision, RUNNER_TEMP: parent, FIXTURE_ARGUMENTS: argsFile, CLOUDFLARE_API_TOKEN: 'fixture-only-token' };
    const cli = fileURLToPath(new URL('./release.mjs', import.meta.url));
    execFileSync(process.execPath, [cli, 'verify', root, digest, 'observe'], { cwd: parent, env });
    assert.deepEqual(JSON.parse(await readFile(argsFile, 'utf8')), { args: ['--verify', root, digest, 'observe'], credentialPresent: false });
    execFileSync(process.execPath, [cli, 'observe', root, digest], { cwd: parent, env });
    assert.deepEqual(JSON.parse(await readFile(argsFile, 'utf8')), { args: ['--observe', root, digest, join(parent, 'market-release/receipt.json'), revision], credentialPresent: true });
    await rm(argsFile);
    assert.throws(() => execFileSync(process.execPath, [cli, 'release', root, digest], { cwd: parent, env, stdio: 'pipe' }),
      error => error.status === 1 && error.stderr.toString().includes('exact Market operation'));
    await assert.rejects(lstat(argsFile), { code: 'ENOENT' });
    assert.throws(() => execFileSync(process.execPath, [cli, 'observe', root, digest], {
      cwd: parent, env: { ...env, GITHUB_REPOSITORY: 'another/repository' }, stdio: 'pipe',
    }), error => error.status === 1 && error.stderr.toString().includes('original reviewed Group main'));
    await assert.rejects(lstat(argsFile), { code: 'ENOENT' });
  });
});
