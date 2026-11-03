import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, mkdir, open, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  admitMarketFabricationWorkOrder,
  checkoutMarketFabricationSources,
  checkoutPinnedGitRepository,
  fabricateMarketCarrier,
  installFrozenMarketSuppliers,
  readMarketFabricationWorkOrder,
  receiveMarketPackageTestEvidence,
  receiveMarketCarrier,
  selectMarketCarrier,
  verifyInstalledMarketSuppliers,
  verifyMarketCarrier,
  verifyMarketFabricationInputs,
} from './release.mjs';

const defaultExec = promisify(execFile);

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
    const bytes = Buffer.from(`original fixture ${key}`), path = key === "receiver" ? "receiver.cjs" : `${key}.txt`;
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
      error => error.status === 1 && error.stderr.toString().trim() === 'MARKET_OPERATION_FAILED');
    await assert.rejects(lstat(argsFile), { code: 'ENOENT' });
    assert.throws(() => execFileSync(process.execPath, [cli, 'observe', root, digest], {
      cwd: parent, env: { ...env, GITHUB_REPOSITORY: 'another/repository' }, stdio: 'pipe',
    }), error => error.status === 1 && error.stderr.toString().trim() === 'MARKET_OPERATION_FAILED');
    await assert.rejects(lstat(argsFile), { code: 'ENOENT' });
  });
});

test('the reviewed selection binds the exact forward native fabrication work order and incumbent carrier', async t => {
  const workOrderPath = fileURLToPath(new URL('./work-order.json', import.meta.url));
  const bytes = await readFile(workOrderPath), order = JSON.parse(bytes);
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'market-native-order-fixture-'));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const selectionPath = join(fixtureRoot, 'selection.json');
  await writeFile(join(fixtureRoot, 'work-order.json'), bytes);
  await writeFile(selectionPath, JSON.stringify({
    kind: '561.market-worker-carrier-selection/v1',
    repository: order.incumbentCarrier.repository,
    revision: order.incumbentCarrier.revision,
    directory: order.incumbentCarrier.directory,
    manifestSha256: order.incumbentCarrier.manifestSha256,
    operation: 'release', workOrder: '.releases/market/work-order.json',
    workOrderSha256: sha(bytes),
  }));
  const selected = await selectMarketCarrier(selectionPath);
  assert.equal(selected.ready, true);
  assert.ok(['observe', 'release'].includes(selected.operation), `operation must be supported: ${selected.operation}`);
  assert.equal(selected.repository, '561-group/561-group-frontdoor-services-section');
  assert.equal(selected.revision, '55f6acb95782ad6d99f0141aba6e5888d9fd7379');
  assert.equal(selected.directory, '.service-releases/market/20261028-bounded-source-6e5dec1');
  assert.equal(selected.manifestSha256, '79139faa073d12010e5768082a0df12880760307306b7e139be01d79f65b30d9');
  assert.equal(selected.workOrder, '.releases/market/work-order.json');
  assert.equal(selected.workOrderSha256, '2decc835ec643f88cb2c9cd708c839281c5c8f381f168ed1138c359dca2c2ad1');

  const { workOrder, workOrderSha256 } = await readMarketFabricationWorkOrder(workOrderPath, selected.workOrderSha256);
  assert.equal(workOrderSha256, selected.workOrderSha256);
  assert.equal(workOrder.source.market.revision, 'cb766e1a552f35ce2eba0bb4c66c76fd593c9463');
  assert.equal(workOrder.source.market.tree, '5eaff94ebf60c21f83869a8133ee80d1bc9db926');
  assert.equal(workOrder.source.receiver.revision, workOrder.source.market.revision);
  assert.equal(workOrder.source.public.revision, 'e954fc7b670ea20d1fabc9a5570bbf87d9abaaaf');
  assert.equal(workOrder.source.public.gitlink, 'e954fc7b670ea20d1fabc9a5570bbf87d9abaaaf');
  assert.equal(workOrder.source.public.tree, 'cb559cdf232be39cb45bb042b5d4157c29985ace');
  assert.equal(workOrder.baseline.versionId, 'd75303e5-53b4-471a-9ada-93aedf7046f9');
  assert.equal(workOrder.baseline.deploymentId, 'f4f600f9-9559-4270-9724-9981e077a849');
  assert.equal(workOrder.baseline.latestVersionId, workOrder.baseline.versionId);
  assert.equal(workOrder.baseline.sourceRevision, '6e5dec1576b0ba6701ad218a7131d4e1f1aeb06f');
  assert.equal(workOrder.suppliers.length, 1);
  assert.equal(workOrder.suppliers[0].name, '@red-cup-engineering/mcp-engineering-services-section');
  assert.equal(workOrder.suppliers[0].version, '0.1.9');
  assert.equal(workOrder.packageTests.kind, '561.market-source-package-test-selection/v1');
  assert.equal(workOrder.packageTests.script, 'node --test test/*.test.mjs');
  assert.equal(workOrder.packageTests.files.length, 54);
  assert.equal(workOrder.packageTests.sourceManifestSha256, workOrder.sourceInputs.sourceManifest.sha256);
  assert.equal(workOrder.packageTests.lockfileSha256, workOrder.sourceInputs.lockfile.sha256);
  assert.equal(workOrder.packageTests.installedSuppliersSha256, sha(JSON.stringify(workOrder.suppliers)));
  assert.equal(sha(JSON.stringify(workOrder.packageTests)), '36647a633dc1028e9eab4f39df41e50f26c556a632d5e612f5c45e972b60f208');
  assert.equal(workOrder.packageTests.skipDisposition.kind, 'source-declared-counts');
  assert.equal(workOrder.packageTests.skipDisposition.skipped, 0);
  assert.equal(workOrder.packageTests.skipDisposition.todo, 0);

  const root = await mkdtemp(join(tmpdir(), 'market-work-order-selection-'));
  try {
    const tempSelection = join(root, 'selection.json');
    const rawSelection = JSON.parse(await readFile(selectionPath, 'utf8'));
    await writeFile(join(root, 'work-order.json'), await readFile(workOrderPath));

    for (const op of ['observe', 'release']) {
      await writeFile(tempSelection, JSON.stringify({ ...rawSelection, operation: op }));
      const sel = await selectMarketCarrier(tempSelection);
      assert.equal(sel.ready, true);
      assert.equal(sel.operation, op);
      assert.equal(sel.workOrderSha256, selected.workOrderSha256);
    }

    await writeFile(tempSelection, JSON.stringify({ ...rawSelection, workOrderSha256: '0'.repeat(64) }));
    await assert.rejects(selectMarketCarrier(tempSelection), { code: 'FABRICATION_WORK_ORDER_BYTES_CHANGED' });

    const mismatchedWorkOrder = structuredClone(workOrder);
    mismatchedWorkOrder.incumbentCarrier.revision = 'c'.repeat(40);
    const mismatchedBytes = Buffer.from(JSON.stringify(mismatchedWorkOrder));
    await writeFile(join(root, 'work-order.json'), mismatchedBytes);
    await writeFile(tempSelection, JSON.stringify({ ...rawSelection, workOrderSha256: sha(mismatchedBytes) }));
    await assert.rejects(selectMarketCarrier(tempSelection), { code: 'INCUMBENT_CARRIER_SELECTION_MISMATCH' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createCanonicalMarketFabricationFixture() {
  const root = await mkdtemp(join(tmpdir(), 'market-native-fabrication-fixture-'));
  const sourceRoot = join(root, 'source');
  const parametersRoot = join(sourceRoot, 'parameters');
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(parametersRoot, { recursive: true });

  const git = (cwd, ...args) => execFileSync(
    'git',
    ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '--no-optional-locks', '-C', cwd, ...args],
    { encoding: 'utf8' },
  ).trim();

  git(parametersRoot, 'init', '--quiet');
  git(parametersRoot, 'remote', 'add', 'origin', 'https://github.com/causeway-services/public-market-services-section.git');
  await mkdir(join(parametersRoot, 'data/catalog'), { recursive: true });
  const parametersPkgBytes = Buffer.from(`${JSON.stringify({
    name: '@561-group/public-market-services-section',
    version: '0.1.0',
    private: true,
    type: 'module',
    repository: {
      type: 'git',
      url: 'https://github.com/causeway-services/public-market-services-section.git',
    },
  }, null, 2)}\n`);
  const catalogBytes = Buffer.from(`${JSON.stringify({ offers: [{ id: 'fixture-offer' }] }, null, 2)}\n`);
  await writeFile(join(parametersRoot, 'package.json'), parametersPkgBytes);
  await writeFile(join(parametersRoot, 'data/catalog/offers.json'), catalogBytes);
  git(parametersRoot, 'add', 'package.json', 'data/catalog/offers.json');
  git(parametersRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Parameters fixture');
  const parametersRevision = git(parametersRoot, 'rev-parse', 'HEAD');
  const parametersTree = git(parametersRoot, 'rev-parse', 'HEAD^{tree}');

  git(sourceRoot, 'init', '--quiet');
  git(sourceRoot, 'remote', 'add', 'origin', 'https://github.com/red-cup-engineering/market.561.group.git');
  for (const dir of ['src', 'scripts', 'ops', 'test']) {
    await mkdir(join(sourceRoot, dir), { recursive: true });
  }

  const supplierIntegrity = 'sha512-jbeC9siAiTmnXzs8zw8ZqUk9ZnkNrq0+AOmILhDQrjiDWk/D/lXQCncMZEQxxUMKUCKZKRMhZKOPJW7uYaq6bw==';
  const files = {
    'package.json': Buffer.from(`${JSON.stringify({
      name: '@causeway-services/market.561.group',
      version: '0.1.0',
      private: true,
      type: 'module',
      packageManager: 'pnpm@10.0.0',
      imports: { '#parameters/*': './parameters/*' },
      dependencies: {
        '@red-cup-engineering/mcp-engineering-services-section': '0.1.9',
      },
      devDependencies: {
        wrangler: '4.152.0',
      },
    }, null, 2)}\n`),
    'pnpm-lock.yaml': Buffer.from(
      `lockfileVersion: '9.0'\npackages:\n  '@red-cup-engineering/mcp-engineering-services-section@0.1.9':\n    resolution: {integrity: ${supplierIntegrity}}\n`,
    ),
    'pnpm-workspace.yaml': Buffer.from('onlyBuiltDependencies:\n  - esbuild\n  - workerd\n'),
    '.npmrc': Buffer.from('registry=https://registry.npmjs.org/\n@red-cup-engineering:registry=https://registry.561.group/\n'),
    'wrangler.jsonc': Buffer.from(`${JSON.stringify({
      name: 'market-561-group',
      main: 'src/worker.mjs',
      compatibility_date: '2026-08-31',
      compatibility_flags: ['nodejs_compat'],
    }, null, 2)}\n`),
    'src/worker.mjs': Buffer.from('export default { async fetch() { return new Response("ok"); } };\n'),
    'src/compiled-offers.mjs': Buffer.from('export const COMPILED_DECLARATIONS = [{ id: "offer-1", runtime: "worker" }, { id: "node-only", runtime: "node" }];\n'),
    'src/catalog.mjs': Buffer.from('export const catalog = true;\n'),
    'scripts/build-native-worker.mjs': Buffer.from('export async function selectNativeMarketBuildRequest() {}\nexport async function buildNativeMarketWorker() {}\n'),
    'scripts/replay-retained-worker.mjs': Buffer.from('export async function replayRetainedWorker() {}\n'),
    'scripts/build-worker-release-receiver.mjs': Buffer.from('export async function buildMarketWorkerReleaseReceiver() {}\n'),
    'ops/receive-native-worker.mjs': Buffer.from('export async function receiveNativeMarketWorker() {}\n'),
    'ops/receive-deployment.mjs': Buffer.from('export function admitMarketSourceBindings(v) { return v; }\n'),
    'ops/release-worker.mjs': Buffer.from('export async function releaseWorker() {}\n'),
    'test/worker.test.mjs': Buffer.from('export const workerSuite = true;\n'),
    'test/source-cell-Realization.test.mjs': Buffer.from('export const cellSuite = true;\n'),
    'test/workspace-package-graph.test.mjs': Buffer.from('export const graphSuite = true;\n'),
  };

  for (const [relPath, content] of Object.entries(files)) {
    await writeFile(join(sourceRoot, relPath), content);
  }
  await writeFile(join(sourceRoot, '.gitignore'), 'node_modules/\n.wrangler/\n');
  git(sourceRoot, 'add', '.gitignore', ...Object.keys(files));
  git(sourceRoot, 'update-index', '--add', '--cacheinfo', `160000,${parametersRevision},parameters`);
  git(sourceRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Market fixture');
  const marketRevision = git(sourceRoot, 'rev-parse', 'HEAD');
  const marketTree = git(sourceRoot, 'rev-parse', 'HEAD^{tree}');

  const supplierRoot = join(sourceRoot, 'node_modules/@red-cup-engineering/mcp-engineering-services-section');
  await mkdir(join(supplierRoot, 'src'), { recursive: true });
  const supplierManifestBytes = Buffer.from(`${JSON.stringify({
    name: '@red-cup-engineering/mcp-engineering-services-section',
    version: '0.1.9',
    type: 'module',
    exports: { '.': './src/index.mjs' },
  }, null, 2)}\n`);
  const supplierIndexBytes = Buffer.from('export const mcpVersion = "0.1.9";\n');
  await writeFile(join(supplierRoot, 'package.json'), supplierManifestBytes);
  await writeFile(join(supplierRoot, 'src/index.mjs'), supplierIndexBytes);

  const wranglerRoot = join(sourceRoot, 'node_modules/wrangler');
  const esbuildRoot = join(sourceRoot, 'node_modules/esbuild');
  const workerdRoot = join(sourceRoot, 'node_modules/workerd');
  await mkdir(wranglerRoot, { recursive: true });
  await mkdir(esbuildRoot, { recursive: true });
  await mkdir(workerdRoot, { recursive: true });
  await writeFile(join(wranglerRoot, 'package.json'), `${JSON.stringify({
    name: 'wrangler',
    version: '4.152.0',
    dependencies: {
      esbuild: '0.25.2',
      workerd: '1.20260405.1',
    },
  }, null, 2)}\n`);
  await writeFile(join(esbuildRoot, 'package.json'), `${JSON.stringify({ name: 'esbuild', version: '0.25.2' }, null, 2)}\n`);
  await writeFile(join(workerdRoot, 'package.json'), `${JSON.stringify({ name: 'workerd', version: '1.20260405.1' }, null, 2)}\n`);

  const descriptor = (relPath, bytes) => ({ path: relPath, bytes: bytes.length, sha256: sha(bytes) });
  const edgeDeclarationsBytes = Buffer.from(`${JSON.stringify([{ id: 'offer-1', runtime: 'worker' }], null, 2)}\n`);
  const incumbentCarrierRoot = join(root, 'incumbent-carrier');
  await mkdir(incumbentCarrierRoot, { recursive: true });
  const incumbentManifest = {
    kind: '561.market-worker-release/v1',
    target: { scriptName: 'market-561-group', origin: 'https://market.561.group' },
    source: { market: { repository: 'red-cup-engineering/market.561.group', revision: 'a1ddfe2151b40292deb756f3c465f9d39ddab007' } },
    artifacts: {
      candidateDeclarations: descriptor('candidate-declarations.json', edgeDeclarationsBytes),
    },
  };
  const incumbentManifestBytes = Buffer.from(`${JSON.stringify(incumbentManifest, null, 2)}\n`);
  await writeFile(join(incumbentCarrierRoot, 'manifest.json'), incumbentManifestBytes);
  await writeFile(join(incumbentCarrierRoot, 'candidate-declarations.json.gz'), gzipSync(edgeDeclarationsBytes));

  const workOrder = admitMarketFabricationWorkOrder({
    kind: '561.market-worker-fabrication-work-order/v1',
    target: {
      accountId: '337e54ee6dc7d488933f473204a6d89e',
      scriptName: 'market-561-group',
      origin: 'https://market.561.group',
      aliases: ['https://shop.561.group', 'https://bazaar.561.group'],
    },
    source: {
      market: {
        repository: 'red-cup-engineering/market.561.group',
        revision: marketRevision,
        tree: marketTree,
      },
      public: {
        repository: 'causeway-services/public-market-services-section',
        path: 'parameters',
        mode: '160000',
        revision: parametersRevision,
        gitlink: parametersRevision,
        tree: parametersTree,
      },
      cloudflare: {
        repository: 'red-cup-engineering/cloudflare-engineering-services-section',
        revision: 'fb54f04252796fdd29d965a714d7af6de1e86fa3',
      },
      receiver: {
        repository: 'red-cup-engineering/market.561.group',
        revision: marketRevision,
      },
    },
    candidateCatalogPresentation: 'native',
    baseline: {
      versionId: '21c53a1e-8001-49c4-a186-fa1b0ea0ae5c',
      deploymentId: 'f3841d23-aece-4997-88fa-2eb4a152d56c',
      latestVersionId: '21c53a1e-8001-49c4-a186-fa1b0ea0ae5c',
      sourceRevision: 'a1ddfe2151b40292deb756f3c465f9d39ddab007',
      catalogPresentation: 'native',
    },
    payment: {
      payTo: '0x6c42421f9f9c3f3f48f5c72c56e9895ca1262271',
      network: 'eip155:8453',
      asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      facilitator: 'https://facilitator.xpay.sh',
    },
    incumbentCarrier: {
      repository: '561-group/561-group-frontdoor-services-section',
      revision: '4d9c747aa6d5f039417671d1b26e2d44ef1ea23c',
      directory: '.service-releases/market/20261027-lakota-memory-a1ddfe2',
      manifestSha256: sha(incumbentManifestBytes),
      incumbentDeclarationsArtifact: 'candidateDeclarations',
    },
    compiler: {
      wrangler: { name: 'wrangler', version: '4.152.0' },
      esbuild: { name: 'esbuild', version: '0.25.2' },
      workerd: { name: 'workerd', version: '1.20260405.1' },
      pnpm: { name: 'pnpm', version: '10.0.0' },
    },
    sourceInputs: {
      sourceManifest: descriptor('package.json', files['package.json']),
      lockfile: descriptor('pnpm-lock.yaml', files['pnpm-lock.yaml']),
      workspaceManifest: descriptor('pnpm-workspace.yaml', files['pnpm-workspace.yaml']),
      npmrc: descriptor('.npmrc', files['.npmrc']),
      configuration: descriptor('wrangler.jsonc', files['wrangler.jsonc']),
      parameterSourceManifest: descriptor('parameters/package.json', parametersPkgBytes),
      parameterCatalog: descriptor('parameters/data/catalog/offers.json', catalogBytes),
      workerEntry: descriptor('src/worker.mjs', files['src/worker.mjs']),
      compiledOffers: descriptor('src/compiled-offers.mjs', files['src/compiled-offers.mjs']),
      nativeProducer: descriptor('scripts/build-native-worker.mjs', files['scripts/build-native-worker.mjs']),
      retainedProducer: descriptor('scripts/replay-retained-worker.mjs', files['scripts/replay-retained-worker.mjs']),
      receiverBuilder: descriptor('scripts/build-worker-release-receiver.mjs', files['scripts/build-worker-release-receiver.mjs']),
      nativeReceiver: descriptor('ops/receive-native-worker.mjs', files['ops/receive-native-worker.mjs']),
      deploymentReceiver: descriptor('ops/receive-deployment.mjs', files['ops/receive-deployment.mjs']),
      releaseOperator: descriptor('ops/release-worker.mjs', files['ops/release-worker.mjs']),
      applicationInputs: [
        descriptor('src/catalog.mjs', files['src/catalog.mjs']),
      ],
    },
    suppliers: [
      {
        name: '@red-cup-engineering/mcp-engineering-services-section',
        version: '0.1.9',
        integrity: supplierIntegrity,
        manifest: descriptor('package.json', supplierManifestBytes),
        files: [
          descriptor('src/index.mjs', supplierIndexBytes),
        ],
      },
    ],
    qualificationSuites: {
      sourceSuite: descriptor('test/worker.test.mjs', files['test/worker.test.mjs']),
      sourceCellSuite: descriptor('test/source-cell-Realization.test.mjs', files['test/source-cell-Realization.test.mjs']),
      workspaceGraphSuite: descriptor('test/workspace-package-graph.test.mjs', files['test/workspace-package-graph.test.mjs']),
    },
    declarations: {
      candidate: descriptor('candidate-declarations.json', edgeDeclarationsBytes),
      incumbent: descriptor('incumbent-declarations.json', edgeDeclarationsBytes),
    },
  });

  return {
    root,
    sourceRoot,
    parametersRoot,
    supplierRoot,
    wranglerRoot,
    esbuildRoot,
    incumbentCarrierRoot,
    files,
    parametersPkgBytes,
    supplierManifestBytes,
    supplierIndexBytes,
    edgeDeclarationsBytes,
    workOrder,
    git,
  };
}

test('native fabrication input and supplier verification refuses unreceived revisions, dirty checkouts, altered bytes, credential leaks and external symlinks', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const {
      root,
      sourceRoot,
      parametersRoot,
      supplierRoot,
      wranglerRoot,
      files,
      supplierManifestBytes,
      supplierIndexBytes,
      workOrder,
      git,
    } = fixture;

    const verifiedInputs = await verifyMarketFabricationInputs(sourceRoot, workOrder);
    assert.equal(verifiedInputs.marketCheckout.revision, workOrder.source.market.revision);
    assert.equal(verifiedInputs.parametersCheckout.revision, workOrder.source.public.revision);

    const verifiedSuppliers = await verifyInstalledMarketSuppliers(sourceRoot, workOrder);
    assert.equal(verifiedSuppliers.compiler.wrangler.version, '4.152.0');
    assert.equal(verifiedSuppliers.compiler.esbuild.version, '0.25.2');
    assert.equal(verifiedSuppliers.compiler.workerd.version, '1.20260405.1');
    assert.equal(verifiedSuppliers.suppliers[0].version, '0.1.9');

    // Non-canonical Git directory is refused
    await assert.rejects(verifyMarketFabricationInputs(join(sourceRoot, 'src'), workOrder), {
      code: 'CANONICAL_GIT_CHECKOUT_REQUIRED',
    });

    // Fake remote origin is refused
    git(sourceRoot, 'remote', 'set-url', 'origin', 'https://github.com/another/merchant.git');
    await assert.rejects(verifyMarketFabricationInputs(sourceRoot, workOrder), {
      code: 'CANONICAL_GIT_ORIGIN_REQUIRED',
    });
    git(sourceRoot, 'remote', 'set-url', 'origin', 'https://github.com/red-cup-engineering/market.561.group.git');

    // Wrong Market revision or tree is refused
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        source: { ...workOrder.source, market: { ...workOrder.source.market, revision: 'a'.repeat(40) } },
      }),
      { code: 'MARKET_SOURCE_REVISION_MISMATCH' },
    );
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        source: { ...workOrder.source, market: { ...workOrder.source.market, tree: 'b'.repeat(40) } },
      }),
      { code: 'MARKET_SOURCE_TREE_MISMATCH' },
    );

    // Wrong Parameters gitlink or Parameters revision is refused
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        source: {
          ...workOrder.source,
          public: { ...workOrder.source.public, revision: 'c'.repeat(40), gitlink: 'c'.repeat(40) },
        },
      }),
      { code: 'PARAMETERS_GITLINK_MISMATCH' },
    );

    // Dirty or untracked files in Market or Parameters checkout are refused
    await writeFile(join(sourceRoot, 'untracked.mjs'), 'export const dirty = true;\n');
    await assert.rejects(verifyMarketFabricationInputs(sourceRoot, workOrder), {
      code: 'SOURCE_CHECKOUT_DIRTY',
    });
    await rm(join(sourceRoot, 'untracked.mjs'));

    await writeFile(join(parametersRoot, 'untracked.json'), '{}\n');
    await assert.rejects(verifyMarketFabricationInputs(sourceRoot, workOrder), {
      code: 'SOURCE_CHECKOUT_DIRTY',
    });
    await rm(join(parametersRoot, 'untracked.json'));

    // Altered source input or qualification suite digest is refused
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        sourceInputs: {
          ...workOrder.sourceInputs,
          workerEntry: { ...workOrder.sourceInputs.workerEntry, sha256: '0'.repeat(64) },
        },
      }),
      { code: 'SOURCE_INPUT_BYTES_CHANGED' },
    );
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        qualificationSuites: {
          ...workOrder.qualificationSuites,
          sourceSuite: { ...workOrder.qualificationSuites.sourceSuite, sha256: '0'.repeat(64) },
        },
      }),
      { code: 'QUALIFICATION_SUITE_BYTES_CHANGED' },
    );

    // Altered supplier SRI in lockfile is refused
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        suppliers: [
          {
            ...workOrder.suppliers[0],
            integrity: `sha512-${'A'.repeat(86)}==`,
          },
        ],
      }),
      { code: 'SUPPLIER_SRI_UNRECEIVED' },
    );

    // Credential leak in .npmrc is refused even if its hash matches the descriptor
    const leakedNpmrc = Buffer.from(
      'registry=https://registry.npmjs.org/\n//registry.561.group/:_authToken=leaked-token\n',
    );
    await writeFile(join(sourceRoot, '.npmrc'), leakedNpmrc);
    git(sourceRoot, 'add', '.npmrc');
    git(sourceRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Leaked npmrc');
    const leakedCommit = git(sourceRoot, 'rev-parse', 'HEAD');
    const leakedTree = git(sourceRoot, 'rev-parse', 'HEAD^{tree}');
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        source: {
          ...workOrder.source,
          market: { ...workOrder.source.market, revision: leakedCommit, tree: leakedTree },
        },
        sourceInputs: {
          ...workOrder.sourceInputs,
          npmrc: { path: '.npmrc', bytes: leakedNpmrc.length, sha256: sha(leakedNpmrc) },
        },
      }),
      { code: 'NPMRC_CREDENTIAL_LEAK_REFUSED' },
    );
    git(sourceRoot, 'reset', '--hard', '--quiet', workOrder.source.market.revision);

    // Same-byte external symlink substitution for a source input is refused even if committed
    const outsideSourceFile = join(root, 'outside-catalog.mjs');
    await writeFile(outsideSourceFile, files['src/catalog.mjs']);
    await rm(join(sourceRoot, 'src/catalog.mjs'));
    await symlink(outsideSourceFile, join(sourceRoot, 'src/catalog.mjs'));
    git(sourceRoot, 'add', 'src/catalog.mjs');
    git(sourceRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Symlinked catalog');
    const symlinkCommit = git(sourceRoot, 'rev-parse', 'HEAD');
    const symlinkTree = git(sourceRoot, 'rev-parse', 'HEAD^{tree}');
    await assert.rejects(
      verifyMarketFabricationInputs(sourceRoot, {
        ...workOrder,
        source: {
          ...workOrder.source,
          market: { ...workOrder.source.market, revision: symlinkCommit, tree: symlinkTree },
        },
      }),
      { code: 'EXTERNAL_SOURCE_PATH_REFUSED' },
    );
    git(sourceRoot, 'reset', '--hard', '--quiet', workOrder.source.market.revision);

    // Wrong compiler version or altered supplier manifest/file bytes are refused
    await assert.rejects(
      verifyInstalledMarketSuppliers(sourceRoot, {
        ...workOrder,
        compiler: { ...workOrder.compiler, wrangler: { name: 'wrangler', version: '4.151.0' } },
      }),
      { code: 'COMPILER_SELECTION_UNRECEIVED' },
    );
    await writeFile(join(supplierRoot, 'src/index.mjs'), 'export const mcpVersion = "tampered";\n');
    await assert.rejects(verifyInstalledMarketSuppliers(sourceRoot, workOrder), {
      code: 'SUPPLIER_BYTES_UNRECEIVED',
    });
    await writeFile(join(supplierRoot, 'src/index.mjs'), supplierIndexBytes);

    await writeFile(join(supplierRoot, 'package.json'), `${JSON.stringify({
      name: '@red-cup-engineering/mcp-engineering-services-section',
      version: '0.1.8',
    }, null, 2)}\n`);
    await assert.rejects(verifyInstalledMarketSuppliers(sourceRoot, workOrder), {
      code: 'SUPPLIER_MANIFEST_UNRECEIVED',
    });
    await writeFile(join(supplierRoot, 'package.json'), supplierManifestBytes);

    // Same-byte external symlink inside node_modules is refused
    const outsideSupplierFile = join(root, 'outside-supplier-index.mjs');
    await writeFile(outsideSupplierFile, supplierIndexBytes);
    await rm(join(supplierRoot, 'src/index.mjs'));
    await symlink(outsideSupplierFile, join(supplierRoot, 'src/index.mjs'));
    await assert.rejects(verifyInstalledMarketSuppliers(sourceRoot, workOrder), {
      code: 'EXTERNAL_SUPPLIER_PATH_REFUSED',
    });
    await rm(join(supplierRoot, 'src/index.mjs'));
    await writeFile(join(supplierRoot, 'src/index.mjs'), supplierIndexBytes);

    const outsideWrangler = join(root, 'outside-wrangler');
    await mkdir(outsideWrangler, { recursive: true });
    await writeFile(join(outsideWrangler, 'package.json'), await readFile(join(wranglerRoot, 'package.json')));
    await rm(wranglerRoot, { recursive: true, force: true });
    await symlink(outsideWrangler, wranglerRoot, 'dir');
    await assert.rejects(verifyInstalledMarketSuppliers(sourceRoot, workOrder), {
      code: 'EXTERNAL_SUPPLIER_PATH_REFUSED',
    });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('checkoutMarketFabricationSources and fabricateMarketCarrier assemble the fifteen-file carrier, refuse undeclared outputs or missing keys, and dispose the private workspace', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const {
      root,
      sourceRoot,
      parametersRoot,
      incumbentCarrierRoot,
      files,
      parametersPkgBytes,
      supplierManifestBytes,
      workOrder,
    } = fixture;

    // Missing repository-scoped GitHub tokens are refused before any Git checkout
    await assert.rejects(
      checkoutMarketFabricationSources(join(root, 'missing-token'), workOrder, {
        marketGitHubToken: '',
        parametersGitHubToken: 'dummy-token',
      }),
      { code: 'MARKET_SOURCE_GITHUB_TOKEN_REQUIRED' },
    );
    await assert.rejects(
      checkoutMarketFabricationSources(join(root, 'missing-param-token'), workOrder, {
        marketGitHubToken: 'dummy-token',
        parametersGitHubToken: '',
      }),
      { code: 'PARAMETERS_GITHUB_TOKEN_REQUIRED' },
    );

    // Checkout from pinned local Git remotes verifies commits, trees, gitlink, and canonical origins
    const checkedOut = await checkoutMarketFabricationSources(join(root, 'checked-out-workspace'), workOrder, {
      marketGitHubToken: 'fixture-token',
      parametersGitHubToken: 'fixture-token',
      marketRemoteUrl: sourceRoot,
      parametersRemoteUrl: parametersRoot,
    });
    assert.equal(checkedOut.marketCheckout.revision, workOrder.source.market.revision);
    assert.equal(checkedOut.parametersCheckout.revision, workOrder.source.public.revision);

    async function writeMockBuildOutputs(outputRoot, currentSourceRoot, { extraFile = false, externalSourcePath = false } = {}) {
      await mkdir(outputRoot, { recursive: true });
      const workerBytes = Buffer.from('export default { async fetch() { return new Response("built-worker"); } };\n');
      const mapBytes = Buffer.from(JSON.stringify({ version: 3, sources: ['src/worker.mjs'], sourcesContent: [files['src/worker.mjs'].toString('utf8')] }));
      const metafileBytes = Buffer.from(JSON.stringify({ inputs: {}, outputs: { 'worker.js': { entryPoint: 'src/worker.mjs' } } }));
      const sourceInputsData = [
        {
          path: 'src/worker.mjs',
          kind: 'physical',
          source: externalSourcePath ? join(root, 'outside.mjs') : join(currentSourceRoot, 'src/worker.mjs'),
          bytes: files['src/worker.mjs'].length,
          sha256: sha(files['src/worker.mjs']),
          packageManifestSha256: sha(files['package.json']),
        },
      ];
      const sourceInputsBytes = Buffer.from(`${JSON.stringify(sourceInputsData, null, 2)}\n`);
      const packageManifestsData = [
        {
          path: join(currentSourceRoot, 'package.json'),
          name: '@causeway-services/market.561.group',
          version: '0.1.0',
          bytes: files['package.json'].length,
          sha256: sha(files['package.json']),
          sideEffects: null,
          manifestBase64: files['package.json'].toString('base64'),
        },
        {
          path: join(currentSourceRoot, 'node_modules/@red-cup-engineering/mcp-engineering-services-section/package.json'),
          name: '@red-cup-engineering/mcp-engineering-services-section',
          version: '0.1.9',
          bytes: supplierManifestBytes.length,
          sha256: sha(supplierManifestBytes),
          sideEffects: null,
          manifestBase64: supplierManifestBytes.toString('base64'),
        },
      ];
      const packageManifestsBytes = Buffer.from(`${JSON.stringify(packageManifestsData, null, 2)}\n`);

      await writeFile(join(outputRoot, 'worker.js'), workerBytes);
      await writeFile(join(outputRoot, 'worker.js.map'), mapBytes);
      await writeFile(join(outputRoot, 'esbuild.metafile.json'), metafileBytes);
      await writeFile(join(outputRoot, 'source-inputs.json'), sourceInputsBytes);
      await writeFile(join(outputRoot, 'package-manifests.json'), packageManifestsBytes);
      await writeFile(join(outputRoot, 'source-package.json'), files['package.json']);
      await writeFile(join(outputRoot, 'parameters-package.json'), parametersPkgBytes);
      await writeFile(join(outputRoot, 'pnpm-lock.yaml'), files['pnpm-lock.yaml']);
      await writeFile(join(outputRoot, 'wrangler.jsonc'), files['wrangler.jsonc']);
      if (extraFile) {
        await writeFile(join(outputRoot, 'undeclared-extra.js'), 'export const undeclared = true;\n');
      }

      const descriptor = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) });
      const receipt = {
        kind: 'native-market-worker-build',
        source: { repository: 'red-cup-engineering/market.561.group', revision: workOrder.source.market.revision },
        sourceBindings: {
          parameters: {
            repository: 'causeway-services/public-market-services-section',
            path: 'parameters',
            mode: '160000',
            revision: workOrder.source.public.revision,
            gitlink: workOrder.source.public.gitlink,
          },
        },
        deploymentBindings: { MARKET_BUILD_SHA: workOrder.source.market.revision },
        predecessorClosureReplayed: false,
        nativeMetadataComplete: true,
        output: join(outputRoot, 'worker.js'),
        bytes: workerBytes.length,
        sha256: sha(workerBytes),
        inputs: 1,
        physicalInputs: 1,
        generatedInputs: 0,
        sourceInputs: descriptor('source-inputs.json', sourceInputsBytes),
        packageManifests: descriptor('package-manifests.json', packageManifestsBytes),
        sourceManifest: descriptor('source-package.json', files['package.json']),
        parameterSourceManifest: descriptor('parameters-package.json', parametersPkgBytes),
        lockfile: descriptor('pnpm-lock.yaml', files['pnpm-lock.yaml']),
        configuration: descriptor('wrangler.jsonc', files['wrangler.jsonc']),
        metafile: descriptor('esbuild.metafile.json', metafileBytes),
        sourceMap: descriptor('worker.js.map', mapBytes),
      };
      await writeFile(join(outputRoot, 'build-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
      return receipt;
    }

    const receiveWorker = async request => {
      await mkdir(request.outputRoot, { recursive: true });
      const qualification = {
        kind: '561.market-worker-native-qualification/v1',
        sourceRevision: request.source.revision,
        workerSha256: request.artifact.sha256,
        outsidePaymentReceived: false,
        artifactInternalComputationInstrumented: false,
        checks: {
          startup: { passed: true },
          sourceSuite: { passed: true },
        },
      };
      await writeFile(join(request.outputRoot, 'native-qualification.json'), `${JSON.stringify(qualification, null, 2)}\n`);
    };

    const buildReceiver = async request => {
      await mkdir(request.outputRoot, { recursive: true });
      const receiverBytes = Buffer.from(
        "require('node:fs').writeFileSync(process.env.FIXTURE_ARGUMENTS, JSON.stringify({args:process.argv.slice(2),credentialPresent:Boolean(process.env.CLOUDFLARE_API_TOKEN)}));\n",
      );
      await writeFile(join(request.outputRoot, 'receiver.cjs'), receiverBytes);
      const receiverInputs = {
        kind: '561.market-worker-receiver-build/v1',
        source: { repository: 'red-cup-engineering/market.561.group', revision: request.sourceRevision },
        cloudflare: { repository: 'red-cup-engineering/cloudflare-engineering-services-section', revision: request.cloudflareRevision },
        output: { path: 'receiver.cjs', bytes: receiverBytes.length, sha256: sha(receiverBytes) },
      };
      await writeFile(join(request.outputRoot, 'receiver-inputs.json'), `${JSON.stringify(receiverInputs, null, 2)}\n`);
    };

    // Undeclared build output file is refused before carrier assembly
    await assert.rejects(
      fabricateMarketCarrier(workOrder, {
        destination: join(root, 'refused-extra-output'),
        sourceRoot,
        incumbentCarrierDirectory: incumbentCarrierRoot,
        installSuppliers: false,
        buildWorker: ({ outputRoot, sourceRoot: sr }) => writeMockBuildOutputs(outputRoot, sr, { extraFile: true }),
        receiveWorker,
        buildReceiver,
      }),
      { code: 'UNDECLARED_BUILD_OUTPUT_REFUSED' },
    );

    // External physical path in build provenance is refused
    await writeFile(join(root, 'outside.mjs'), files['src/worker.mjs']);
    await assert.rejects(
      fabricateMarketCarrier(workOrder, {
        destination: join(root, 'refused-external-provenance'),
        sourceRoot,
        incumbentCarrierDirectory: incumbentCarrierRoot,
        installSuppliers: false,
        buildWorker: ({ outputRoot, sourceRoot: sr }) => writeMockBuildOutputs(outputRoot, sr, { externalSourcePath: true }),
        receiveWorker,
        buildReceiver,
      }),
      { code: 'EXTERNAL_SUPPLIER_PATH_REFUSED' },
    );

    // Valid fabrication assembles all 15 files, verifies the carrier, writes fabrication-receipt.json, and disposes workspace/
    const workOrderBytes = Buffer.from(`${JSON.stringify(workOrder, null, 2)}\n`);
    const workOrderSha256 = sha(workOrderBytes);
    const fabricatedRoot = join(root, 'fabricated');
    const fabricated = await fabricateMarketCarrier(workOrder, {
      destination: fabricatedRoot,
      workOrderSha256,
      operation: 'release',
      sourceRoot,
      incumbentCarrierDirectory: incumbentCarrierRoot,
      installSuppliers: false,
      buildWorker: ({ outputRoot, sourceRoot: sr }) => writeMockBuildOutputs(outputRoot, sr),
      receiveWorker,
      buildReceiver,
    });

    assert.equal(Object.keys(fabricated.manifest.artifacts).length, 15);
    assert.equal(fabricated.fabricationReceipt.kind, '561.market-worker-native-fabrication/v1');
    assert.equal(fabricated.fabricationReceipt.workOrderSha256, workOrderSha256);
    assert.equal(fabricated.fabricationReceipt.incumbentManifestSha256, workOrder.incumbentCarrier.manifestSha256);
    assert.equal(fabricated.fabricationReceipt.manifestSha256, fabricated.manifestSha256);
    assert.equal(fabricated.fabricationReceipt.workspaceDisposed, true);
    assert.equal(fabricated.fabricationReceipt.providerAccess, false);
    assert.equal(fabricated.fabricationReceipt.outsidePaymentReceived, false);
    await assert.rejects(lstat(join(fabricatedRoot, 'workspace')), { code: 'ENOENT' });

    const verifiedCarrier = await verifyMarketCarrier(fabricated.carrierDirectory, fabricated.manifestSha256);
    assert.equal(verifiedCarrier.manifest.source.market.revision, workOrder.source.market.revision);
    assert.equal(verifiedCarrier.manifest.source.public.revision, workOrder.source.public.revision);

    // Extra unreviewed file in the carrier directory is refused by verifyMarketCarrier
    const unreviewedCarrierFile = join(fabricated.carrierDirectory, 'unreviewed-extra.txt');
    await writeFile(unreviewedCarrierFile, 'unreviewed');
    await assert.rejects(
      verifyMarketCarrier(fabricated.carrierDirectory, fabricated.manifestSha256),
      { code: 'EXTRA_CARRIER_INPUT_REFUSED' },
    );
    await rm(unreviewedCarrierFile);

    // CLI verify and release accept the fabricated carrier when bound by selection.json + fabrication-receipt.json
    const groupRepo = join(root, 'group-repo');
    await mkdir(join(groupRepo, '.releases/market'), { recursive: true });
    await writeFile(join(groupRepo, '.releases/market/work-order.json'), workOrderBytes);
    await writeFile(join(groupRepo, '.releases/market/selection.json'), `${JSON.stringify({
      kind: '561.market-worker-carrier-selection/v1',
      repository: '561-group/561-group-frontdoor-services-section',
      revision: workOrder.incumbentCarrier.revision,
      directory: workOrder.incumbentCarrier.directory,
      manifestSha256: workOrder.incumbentCarrier.manifestSha256,
      workOrder: '.releases/market/work-order.json',
      workOrderSha256,
      operation: 'release',
    }, null, 2)}\n`);
    execFileSync('git', ['init', '--quiet', groupRepo]);
    execFileSync('git', ['-C', groupRepo, 'add', '.releases/market/selection.json', '.releases/market/work-order.json']);
    execFileSync('git', ['-C', groupRepo, '-c', 'user.name=Native fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Select fabricated release']);
    const groupRevision = execFileSync('git', ['-C', groupRepo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const argsFile = join(root, 'cli-arguments.json');
    const cli = fileURLToPath(new URL('./release.mjs', import.meta.url));
    const env = {
      ...process.env,
      GITHUB_REPOSITORY: 'red-cup-engineering/561.group',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_SHA: groupRevision,
      RUNNER_TEMP: root,
      FIXTURE_ARGUMENTS: argsFile,
      CLOUDFLARE_API_TOKEN: 'fixture-only-token',
      MARKET_SOURCE_GITHUB_TOKEN: 'fixture-source-token',
    };

    execFileSync(process.execPath, [cli, 'verify', fabricated.carrierDirectory, fabricated.manifestSha256, 'release'], { cwd: groupRepo, env });
    assert.deepEqual(JSON.parse(await readFile(argsFile, 'utf8')), {
      args: ['--verify', fabricated.carrierDirectory, fabricated.manifestSha256, 'release'],
      credentialPresent: false,
    });

    execFileSync(process.execPath, [cli, 'release', fabricated.carrierDirectory, fabricated.manifestSha256], { cwd: groupRepo, env });
    assert.deepEqual(JSON.parse(await readFile(argsFile, 'utf8')), {
      args: [fabricated.carrierDirectory, fabricated.manifestSha256, join(root, 'market-release/receipt.json'), groupRevision],
      credentialPresent: true,
    });

    // Tampered fabrication-receipt.json is refused before executing release
    await rm(argsFile);
    await writeFile(
      fabricated.receiptFile,
      JSON.stringify({ ...fabricated.fabricationReceipt, workOrderSha256: '0'.repeat(64) }),
    );
    assert.throws(
      () => execFileSync(process.execPath, [cli, 'release', fabricated.carrierDirectory, fabricated.manifestSha256], {
        cwd: groupRepo,
        env,
        stdio: 'pipe',
      }),
      error => error.status === 1 && error.stderr.toString().trim() === 'MARKET_OPERATION_FAILED',
    );
    await assert.rejects(lstat(argsFile), { code: 'ENOENT' });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('deploy-market.yml confines private source keys to receive, Cloudflare credentials to the final operation, and artifact upload to receipt.json', async () => {
  const workflowPath = fileURLToPath(new URL('../../.github/workflows/deploy-market.yml', import.meta.url));
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /work_order_sha256: \$\{\{ steps\.selection\.outputs\.work_order_sha256 \}\}/u);
  assert.match(workflow, /corepack enable pnpm/u);
  assert.doesNotMatch(workflow, /corepack prepare pnpm@10\.0\.0/u);
  assert.match(workflow, /node \.releases\/market\/release\.mjs receive "\$RELEASE_DIRECTORY" "\$RELEASE_MANIFEST" "\$RELEASE_WORK_ORDER"/u);
  assert.match(workflow, /node \.releases\/market\/release\.mjs verify "\$ACTIVE_RELEASE_DIRECTORY" "\$ACTIVE_RELEASE_MANIFEST" "\$MARKET_OPERATION"/u);
  assert.match(workflow, /node \.releases\/market\/release\.mjs "\$MARKET_OPERATION" "\$ACTIVE_RELEASE_DIRECTORY" "\$ACTIVE_RELEASE_MANIFEST"/u);
  assert.match(workflow, /rm -rf \.market-release "\$\{\{ runner\.temp \}\}\/market-fabricated-carrier"/u);

  const receiveIndex = workflow.indexOf('id: receive');
  const verifyIndex = workflow.indexOf('Receive selected bytes, original source owners and native qualification');
  const executeIndex = workflow.indexOf('Execute the selected original Market observation or release');
  const disposeIndex = workflow.indexOf('Dispose ephemeral private carrier and fabrication workspace');
  const retainIndex = workflow.indexOf('Retain provider and public receiving, including any guarded rollback');
  assert.ok(receiveIndex > 0 && verifyIndex > receiveIndex && executeIndex > verifyIndex && disposeIndex > executeIndex && retainIndex > disposeIndex);

  const receiveBlock = workflow.slice(receiveIndex, verifyIndex);
  const verifyBlock = workflow.slice(verifyIndex, executeIndex);
  const executeBlock = workflow.slice(executeIndex, disposeIndex);
  const retainBlock = workflow.slice(retainIndex);
  assert.match(retainBlock, /path: \$\{\{ runner\.temp \}\}\/market-release\/receipt\.json/u);
  assert.doesNotMatch(retainBlock, /market-fabricated-carrier/u);
  assert.doesNotMatch(retainBlock, /\.market-release/u);
  assert.match(receiveBlock, /MARKET_SOURCE_GITHUB_TOKEN/u);
  assert.match(receiveBlock, /MARKET_PARAMETERS_GITHUB_TOKEN/u);
  assert.doesNotMatch(receiveBlock, /CLOUDFLARE_API_TOKEN/u);
  assert.doesNotMatch(verifyBlock, /GITHUB_TOKEN/u);
  assert.doesNotMatch(verifyBlock, /DEPLOY_KEY/u);
  assert.doesNotMatch(verifyBlock, /CLOUDFLARE_/u);
  assert.match(executeBlock, /CLOUDFLARE_API_TOKEN/u);
  assert.match(executeBlock, /CLOUDFLARE_ACCOUNT_ID/u);
  assert.doesNotMatch(executeBlock, /GITHUB_TOKEN/u);
  assert.doesNotMatch(executeBlock, /DEPLOY_KEY/u);
});

test('frozen install receives the selected effective PNPM version before install and records its custody', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const calls = [];
    const received = await installFrozenMarketSuppliers(fixture.sourceRoot, fixture.workOrder, {
      exec: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return { stdout: args.includes('--version') ? '10.0.0\n' : '' };
      },
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], { command: 'corepack', args: ['pnpm@10.0.0', '--version'], cwd: fixture.sourceRoot });
    assert.deepEqual(calls[1].args.slice(0, 4), ['pnpm@10.0.0', 'install', '--frozen-lockfile', '--ignore-scripts']);
    assert.deepEqual(received.compiler.pnpm, { name: 'pnpm', version: '10.0.0', command: 'corepack', arguments: ['pnpm@10.0.0'] });
    let attempts = 0;
    await assert.rejects(installFrozenMarketSuppliers(fixture.sourceRoot, fixture.workOrder, {
      exec: async () => { attempts++; return { stdout: '11.28.5\n' }; },
    }), /PACKAGE_MANAGER_VERSION_MISMATCH/u);
    assert.equal(attempts, 1);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('actual CLI contains receiver failure diagnostics in private custody and emits only a static public failure', async () => {
  await withGzipCarrier(async ({ parent, root, manifest, select }) => {
    const marker = 'SYNTHETIC_PRIVATE_RECEIVER_DIAGNOSTIC_83e645';
    const receiver = Buffer.from(`console.log('${marker}');console.error('${marker}');throw Error('${marker}');\n`);
    await writeFile(join(root, manifest.artifacts.receiver.path), receiver);
    manifest.artifacts.receiver.bytes = receiver.length; manifest.artifacts.receiver.sha256 = sha(receiver);
    const digest = await select(); await receiveMarketCarrier(root, digest);
    const cli = fileURLToPath(new URL('./release.mjs', import.meta.url));
    assert.throws(() => execFileSync(process.execPath, [cli, 'verify', root, digest, 'observe'], {
      env: { ...process.env, RUNNER_TEMP: parent }, stdio: 'pipe',
    }), error => error.status === 1 && error.stdout.length === 0 && error.stderr.toString().trim() === 'MARKET_OPERATION_FAILED');
    const directory = join(parent, 'market-private-diagnostics');
    const diagnostic = await readFile(join(directory, 'failure.log'));
    assert.ok(diagnostic.includes(Buffer.from(marker)));
    assert.ok(diagnostic.length <= 65536);
    assert.equal((await lstat(directory)).mode & 0o777, 0o700);
    assert.equal((await lstat(join(directory, 'failure.log'))).mode & 0o777, 0o600);
  });
});

test('Git HTTP Basic source authentication uses ephemeral child config with distinct sentinels, host/path matching, and excludes tokens from argv, config, and URLs', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const fakeMarketSentinel = 'FAKE_RAW_TOKEN_MARKET_SENTINEL_ALPHA_109283';
    const fakeParametersSentinel = 'FAKE_RAW_TOKEN_PARAMETERS_SENTINEL_BETA_475829';
    const expectedMarketBasic = Buffer.from(`x-access-token:${fakeMarketSentinel}`).toString('base64');
    const expectedParametersBasic = Buffer.from(`x-access-token:${fakeParametersSentinel}`).toString('base64');

    const recordedCalls = [];
    const capturingExec = async (cmd, args, opts) => {
      recordedCalls.push({
        cmd,
        args: [...args],
        env: opts?.env ? { ...opts.env } : undefined,
        cwd: opts?.cwd,
      });
      return defaultExec(cmd, args, opts);
    };

    const destination = join(fixture.root, 'sentinel-checkout');
    const checkedOut = await checkoutMarketFabricationSources(destination, fixture.workOrder, {
      marketGitHubToken: fakeMarketSentinel,
      parametersGitHubToken: fakeParametersSentinel,
      marketRemoteUrl: fixture.sourceRoot,
      parametersRemoteUrl: fixture.parametersRoot,
      exec: capturingExec,
    });

    assert.equal(checkedOut.marketCheckout.revision, fixture.workOrder.source.market.revision);
    assert.equal(checkedOut.parametersCheckout.revision, fixture.workOrder.source.public.revision);

    const fetchCalls = recordedCalls.filter(call => call.cmd === 'git' && call.args.includes('fetch'));
    assert.equal(fetchCalls.length, 2, 'Expected exactly two fetch calls (market and parameters)');

    const [marketFetch, paramFetch] = fetchCalls;

    // Verify market fetch argv does not contain any token or basic auth
    assert.ok(!marketFetch.args.some(arg => arg.includes(fakeMarketSentinel)));
    assert.ok(!marketFetch.args.some(arg => arg.includes(expectedMarketBasic)));
    assert.ok(!marketFetch.args.some(arg => arg.includes('x-access-token')));

    // Verify market fetch ephemeral child env
    assert.equal(marketFetch.env.GIT_CONFIG_COUNT, '1');
    assert.equal(marketFetch.env.GIT_CONFIG_KEY_0, 'http.https://github.com/red-cup-engineering/market.561.group.git.extraheader');
    assert.equal(marketFetch.env.GIT_CONFIG_VALUE_0, `Authorization: Basic ${expectedMarketBasic}`);
    assert.ok(!JSON.stringify(marketFetch.env).includes(fakeParametersSentinel));
    assert.ok(!JSON.stringify(marketFetch.env).includes(expectedParametersBasic));

    // Verify parameters fetch argv does not contain any token or basic auth
    assert.ok(!paramFetch.args.some(arg => arg.includes(fakeParametersSentinel)));
    assert.ok(!paramFetch.args.some(arg => arg.includes(expectedParametersBasic)));
    assert.ok(!paramFetch.args.some(arg => arg.includes('x-access-token')));

    // Verify parameters fetch ephemeral child env
    assert.equal(paramFetch.env.GIT_CONFIG_COUNT, '1');
    assert.equal(paramFetch.env.GIT_CONFIG_KEY_0, 'http.https://github.com/causeway-services/public-market-services-section.git.extraheader');
    assert.equal(paramFetch.env.GIT_CONFIG_VALUE_0, `Authorization: Basic ${expectedParametersBasic}`);
    assert.ok(!JSON.stringify(paramFetch.env).includes(fakeMarketSentinel));
    assert.ok(!JSON.stringify(paramFetch.env).includes(expectedMarketBasic));

    // Verify all git calls: no token or auth in any argv, and config keys not leaked to non-fetch calls
    for (const call of recordedCalls) {
      for (const arg of call.args) {
        assert.ok(!arg.includes(fakeMarketSentinel), `Token found in git argv: ${arg}`);
        assert.ok(!arg.includes(fakeParametersSentinel), `Token found in git argv: ${arg}`);
        assert.ok(!arg.includes(expectedMarketBasic), `Basic auth found in git argv: ${arg}`);
        assert.ok(!arg.includes(expectedParametersBasic), `Basic auth found in git argv: ${arg}`);
      }
      if (!call.args.includes('fetch') && call.env) {
        assert.equal(call.env.GIT_CONFIG_COUNT, undefined, 'GIT_CONFIG_COUNT leaked to non-fetch call');
        assert.equal(call.env.GIT_CONFIG_KEY_0, undefined, 'GIT_CONFIG_KEY_0 leaked to non-fetch call');
        assert.equal(call.env.GIT_CONFIG_VALUE_0, undefined, 'GIT_CONFIG_VALUE_0 leaked to non-fetch call');
      }
    }

    // Verify actual host/path Git matching with real git subprocess
    const marketMatched = execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', 'config', '--get-urlmatch', 'http.extraheader', 'https://github.com/red-cup-engineering/market.561.group.git'], {
      env: marketFetch.env,
      encoding: 'utf8',
    }).trim();
    assert.equal(marketMatched, `Authorization: Basic ${expectedMarketBasic}`);

    let wrongPathMatch = '';
    try {
      wrongPathMatch = execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', 'config', '--get-urlmatch', 'http.extraheader', 'https://github.com/causeway-services/public-market-services-section.git'], {
        env: marketFetch.env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
    } catch { wrongPathMatch = ''; }
    assert.equal(wrongPathMatch, '');

    let wrongHostMatch = '';
    try {
      wrongHostMatch = execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', 'config', '--get-urlmatch', 'http.extraheader', 'https://gitlab.com/red-cup-engineering/market.561.group.git'], {
        env: marketFetch.env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
    } catch { wrongHostMatch = ''; }
    assert.equal(wrongHostMatch, '');

    const paramMatched = execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', 'config', '--get-urlmatch', 'http.extraheader', 'https://github.com/causeway-services/public-market-services-section.git'], {
      env: paramFetch.env,
      encoding: 'utf8',
    }).trim();
    assert.equal(paramMatched, `Authorization: Basic ${expectedParametersBasic}`);

    // Verify persisted .git/config on disk does not contain any credentials
    const marketGitConfig = await readFile(join(destination, 'source/.git/config'), 'utf8');
    assert.ok(!marketGitConfig.includes(fakeMarketSentinel));
    assert.ok(!marketGitConfig.includes(expectedMarketBasic));
    assert.ok(!marketGitConfig.includes('x-access-token'));
    assert.ok(marketGitConfig.includes('https://github.com/red-cup-engineering/market.561.group.git'));

    const paramGitConfig = await readFile(join(destination, 'source/parameters/.git/config'), 'utf8');
    assert.ok(!paramGitConfig.includes(fakeParametersSentinel));
    assert.ok(!paramGitConfig.includes(expectedParametersBasic));
    assert.ok(!paramGitConfig.includes('x-access-token'));
    assert.ok(paramGitConfig.includes('https://github.com/causeway-services/public-market-services-section.git'));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('failed fetch cleans up workspace, leaves clean canonical git config without tokens, and prevents factory callbacks from executing', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    let buildWorkerCalled = false;
    let receiveWorkerCalled = false;
    let buildReceiverCalled = false;
    const failDest = join(fixture.root, 'failed-fetch-fabrication');
    await assert.rejects(
      fabricateMarketCarrier(fixture.workOrder, {
        destination: failDest,
        marketGitHubToken: 'fake-fail-market-token',
        parametersGitHubToken: 'fake-fail-param-token',
        marketRemoteUrl: join(fixture.root, 'nonexistent-remote'),
        parametersRemoteUrl: fixture.parametersRoot,
        buildWorker: async () => { buildWorkerCalled = true; },
        receiveWorker: async () => { receiveWorkerCalled = true; },
        buildReceiver: async () => { buildReceiverCalled = true; },
      }),
    );
    assert.equal(buildWorkerCalled, false, 'buildWorker callback must not run after failed checkout');
    assert.equal(receiveWorkerCalled, false, 'receiveWorker callback must not run after failed checkout');
    assert.equal(buildReceiverCalled, false, 'buildReceiver callback must not run after failed checkout');
    await assert.rejects(lstat(join(failDest, 'workspace')), { code: 'ENOENT' }, 'Workspace directory must be cleaned up on failed checkout');

    const standaloneFail = join(fixture.root, 'standalone-fail-checkout');
    await assert.rejects(
      checkoutPinnedGitRepository(standaloneFail, {
        repository: 'red-cup-engineering/market.561.group',
        revision: fixture.workOrder.source.market.revision,
        tree: fixture.workOrder.source.market.tree,
        token: 'fake-fail-token-xyz',
        remoteUrl: join(fixture.root, 'nonexistent-remote'),
      }),
    );
    const failGitConfig = await readFile(join(standaloneFail, '.git/config'), 'utf8');
    assert.ok(!failGitConfig.includes('fake-fail-token-xyz'));
    assert.ok(!failGitConfig.includes('x-access-token'));
    assert.ok(failGitConfig.includes('https://github.com/red-cup-engineering/market.561.group.git'));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function writeMockBuildOutputs(outputRoot, currentSourceRoot, fixture, { extraFile = false, externalSourcePath = false } = {}) {
  const { root, files, supplierManifestBytes, parametersPkgBytes, workOrder } = fixture;
  await mkdir(outputRoot, { recursive: true });
  const workerBytes = Buffer.from('export default { async fetch() { return new Response("built-worker"); } };\n');
  const mapBytes = Buffer.from(JSON.stringify({ version: 3, sources: ['src/worker.mjs'], sourcesContent: [files['src/worker.mjs'].toString('utf8')] }));
  const metafileBytes = Buffer.from(JSON.stringify({ inputs: {}, outputs: { 'worker.js': { entryPoint: 'src/worker.mjs' } } }));
  const sourceInputsData = [
    {
      path: 'src/worker.mjs',
      kind: 'physical',
      source: externalSourcePath ? join(root, 'outside.mjs') : join(currentSourceRoot, 'src/worker.mjs'),
      bytes: files['src/worker.mjs'].length,
      sha256: sha(files['src/worker.mjs']),
      packageManifestSha256: sha(files['package.json']),
    },
  ];
  const sourceInputsBytes = Buffer.from(`${JSON.stringify(sourceInputsData, null, 2)}\n`);
  const packageManifestsData = [
    {
      path: join(currentSourceRoot, 'package.json'),
      name: '@causeway-services/market.561.group',
      version: '0.1.0',
      bytes: files['package.json'].length,
      sha256: sha(files['package.json']),
      sideEffects: null,
      manifestBase64: files['package.json'].toString('base64'),
    },
    {
      path: join(currentSourceRoot, 'node_modules/@red-cup-engineering/mcp-engineering-services-section/package.json'),
      name: '@red-cup-engineering/mcp-engineering-services-section',
      version: '0.1.9',
      bytes: supplierManifestBytes.length,
      sha256: sha(supplierManifestBytes),
      sideEffects: null,
      manifestBase64: supplierManifestBytes.toString('base64'),
    },
  ];
  const packageManifestsBytes = Buffer.from(`${JSON.stringify(packageManifestsData, null, 2)}\n`);

  await writeFile(join(outputRoot, 'worker.js'), workerBytes);
  await writeFile(join(outputRoot, 'worker.js.map'), mapBytes);
  await writeFile(join(outputRoot, 'esbuild.metafile.json'), metafileBytes);
  await writeFile(join(outputRoot, 'source-inputs.json'), sourceInputsBytes);
  await writeFile(join(outputRoot, 'package-manifests.json'), packageManifestsBytes);
  await writeFile(join(outputRoot, 'source-package.json'), files['package.json']);
  await writeFile(join(outputRoot, 'parameters-package.json'), parametersPkgBytes);
  await writeFile(join(outputRoot, 'pnpm-lock.yaml'), files['pnpm-lock.yaml']);
  await writeFile(join(outputRoot, 'wrangler.jsonc'), files['wrangler.jsonc']);
  if (extraFile) {
    await writeFile(join(outputRoot, 'undeclared-extra.js'), 'export const undeclared = true;\n');
  }

  const descriptor = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) });
  const receipt = {
    kind: 'native-market-worker-build',
    source: { repository: 'red-cup-engineering/market.561.group', revision: workOrder.source.market.revision },
    sourceBindings: {
      parameters: {
        repository: 'causeway-services/public-market-services-section',
        path: 'parameters',
        mode: '160000',
        revision: workOrder.source.public.revision,
        gitlink: workOrder.source.public.gitlink,
      },
    },
    deploymentBindings: { MARKET_BUILD_SHA: workOrder.source.market.revision },
    predecessorClosureReplayed: false,
    nativeMetadataComplete: true,
    output: join(outputRoot, 'worker.js'),
    bytes: workerBytes.length,
    sha256: sha(workerBytes),
    inputs: 1,
    physicalInputs: 1,
    generatedInputs: 0,
    sourceInputs: descriptor('source-inputs.json', sourceInputsBytes),
    packageManifests: descriptor('package-manifests.json', packageManifestsBytes),
    sourceManifest: descriptor('source-package.json', files['package.json']),
    parameterSourceManifest: descriptor('parameters-package.json', parametersPkgBytes),
    lockfile: descriptor('pnpm-lock.yaml', files['pnpm-lock.yaml']),
    configuration: descriptor('wrangler.jsonc', files['wrangler.jsonc']),
    metafile: descriptor('esbuild.metafile.json', metafileBytes),
    sourceMap: descriptor('worker.js.map', mapBytes),
  };
  await writeFile(join(outputRoot, 'build-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

const mockReceiveWorker = async request => {
  await mkdir(request.outputRoot, { recursive: true });
  const qualification = {
    kind: '561.market-worker-native-qualification/v1',
    sourceRevision: request.source.revision,
    workerSha256: request.artifact.sha256,
    outsidePaymentReceived: false,
    artifactInternalComputationInstrumented: false,
    checks: {
      startup: { passed: true },
      sourceSuite: { passed: true },
    },
  };
  await writeFile(join(request.outputRoot, 'native-qualification.json'), `${JSON.stringify(qualification, null, 2)}\n`);
};

const mockBuildReceiver = async request => {
  await mkdir(request.outputRoot, { recursive: true });
  const receiverBytes = Buffer.from(
    "require('node:fs').writeFileSync(process.env.FIXTURE_ARGUMENTS, JSON.stringify({args:process.argv.slice(2),credentialPresent:Boolean(process.env.CLOUDFLARE_API_TOKEN)}));\n",
  );
  await writeFile(join(request.outputRoot, 'receiver.cjs'), receiverBytes);
  const receiverInputs = {
    kind: '561.market-worker-receiver-build/v1',
    source: { repository: 'red-cup-engineering/market.561.group', revision: request.sourceRevision },
    cloudflare: { repository: 'red-cup-engineering/cloudflare-engineering-services-section', revision: request.cloudflareRevision },
    output: { path: 'receiver.cjs', bytes: receiverBytes.length, sha256: sha(receiverBytes) },
  };
  await writeFile(join(request.outputRoot, 'receiver-inputs.json'), `${JSON.stringify(receiverInputs, null, 2)}\n`);
};

test('source auth isolates full five-name credentials during callbacks and restores caller phase environment on both success and failure', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const fiveNames = [
      'MARKET_SOURCE_GITHUB_TOKEN',
      'MARKET_PARAMETERS_GITHUB_TOKEN',
      'MARKET_SOURCE_DEPLOY_KEY',
      'MARKET_PARAMETERS_DEPLOY_KEY',
      'SITE_CONTENT_DEPLOY_KEY',
    ];
    const originalValues = {};
    for (const name of fiveNames) {
      originalValues[name] = process.env[name];
      process.env[name] = `SENTINEL_VAL_PHASE_${name}`;
    }

    let observedInBuildWorker = {};
    let observedInReceiveWorker = {};
    let observedInBuildReceiver = {};

    const successDest = join(fixture.root, 'phase-isolation-success');
    await fabricateMarketCarrier(fixture.workOrder, {
      destination: successDest,
      sourceRoot: fixture.sourceRoot,
      incumbentCarrierDirectory: fixture.incumbentCarrierRoot,
      installSuppliers: false,
      marketGitHubToken: 'SENTINEL_VAL_PHASE_MARKET_SOURCE_GITHUB_TOKEN',
      parametersGitHubToken: 'SENTINEL_VAL_PHASE_MARKET_PARAMETERS_GITHUB_TOKEN',
      buildWorker: async ({ outputRoot, sourceRoot: sr }) => {
        for (const name of fiveNames) {
          observedInBuildWorker[name] = process.env[name];
        }
        await writeMockBuildOutputs(outputRoot, sr, fixture);
      },
      receiveWorker: async request => {
        for (const name of fiveNames) {
          observedInReceiveWorker[name] = process.env[name];
        }
        await mockReceiveWorker(request);
      },
      buildReceiver: async request => {
        for (const name of fiveNames) {
          observedInBuildReceiver[name] = process.env[name];
        }
        await mockBuildReceiver(request);
      },
    });

    for (const name of fiveNames) {
      assert.equal(observedInBuildWorker[name], undefined, `${name} must be undefined in buildWorker`);
      assert.equal(observedInReceiveWorker[name], undefined, `${name} must be undefined in receiveWorker`);
      assert.equal(observedInBuildReceiver[name], undefined, `${name} must be undefined in buildReceiver`);
    }

    for (const name of fiveNames) {
      assert.equal(process.env[name], `SENTINEL_VAL_PHASE_${name}`, `${name} must be restored on success`);
    }

    const failureDest = join(fixture.root, 'phase-isolation-failure');
    await assert.rejects(
      fabricateMarketCarrier(fixture.workOrder, {
        destination: failureDest,
        sourceRoot: fixture.sourceRoot,
        incumbentCarrierDirectory: fixture.incumbentCarrierRoot,
        installSuppliers: false,
        marketGitHubToken: 'SENTINEL_VAL_PHASE_MARKET_SOURCE_GITHUB_TOKEN',
        parametersGitHubToken: 'SENTINEL_VAL_PHASE_MARKET_PARAMETERS_GITHUB_TOKEN',
        buildWorker: async () => {
          throw new Error('deliberate-build-worker-phase-failure');
        },
      }),
      /deliberate-build-worker-phase-failure/u,
    );

    for (const name of fiveNames) {
      assert.equal(process.env[name], `SENTINEL_VAL_PHASE_${name}`, `${name} must be restored on failure`);
    }

    for (const name of fiveNames) {
      if (originalValues[name] !== undefined) {
        process.env[name] = originalValues[name];
      } else {
        delete process.env[name];
      }
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

// The package profile is an opt-in protocol, not a new test command runner.
async function selectFixturePackageTests(fixture) {
  const manifest = JSON.parse(fixture.files['package.json']);
  manifest.packageManager = 'pnpm@11.28.5';
  manifest.scripts = { test: 'node --test test/*.test.mjs' };
  manifest.devDependencies['@red-cup-engineering/npm-workspace-publication-service'] = '0.14.18';
  fixture.files['package.json'] = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(fixture.sourceRoot, 'package.json'), fixture.files['package.json']);
  fixture.git(fixture.sourceRoot, 'add', 'package.json');
  fixture.git(fixture.sourceRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Select original package test profile');
  const order = fixture.workOrder;
  order.source.market.revision = fixture.git(fixture.sourceRoot, 'rev-parse', 'HEAD');
  order.source.market.tree = fixture.git(fixture.sourceRoot, 'rev-parse', 'HEAD^{tree}');
  order.source.receiver.revision = order.source.market.revision;
  order.compiler.pnpm.version = '11.28.5';
  order.sourceInputs.sourceManifest = { path: 'package.json', bytes: fixture.files['package.json'].length, sha256: sha(fixture.files['package.json']) };
  order.packageTests = {
    kind: '561.market-source-package-test-selection/v1', script: manifest.scripts.test,
    sourceManifestSha256: order.sourceInputs.sourceManifest.sha256,
    lockfileSha256: order.sourceInputs.lockfile.sha256,
    installedSuppliersSha256: sha(JSON.stringify(order.suppliers)),
    files: Object.keys(fixture.files).filter(file => /^test\/[^/]+\.test\.mjs$/u.test(file)).sort()
      .map(path => ({ path, bytes: fixture.files[path].length, sha256: sha(fixture.files[path]) })),
    skipDisposition: { kind: 'source-declared-counts', skipped: 0, todo: 0, reason: 'Fixture declares no skips or todo.' },
  };
  return order;
}

test('package test admission binds one fixed original recipe, complete inventory and frozen selection', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const order = await selectFixturePackageTests(fixture);
    assert.equal(admitMarketFabricationWorkOrder(order), order);
    await verifyMarketFabricationInputs(fixture.sourceRoot, order);
    for (const change of [
      o => { o.packageTests = null; },
      o => { o.packageTests.script = 'npm test'; },
      o => { o.packageTests.sourceManifestSha256 = '0'.repeat(64); },
      o => { o.packageTests.lockfileSha256 = '0'.repeat(64); },
      o => { o.packageTests.installedSuppliersSha256 = '0'.repeat(64); },
      o => { o.packageTests.files = []; },
      o => { o.packageTests.files.reverse(); },
      o => { o.packageTests.files.push(o.packageTests.files[0]); },
      o => { o.packageTests.files[0].path = 'test/nested/case.test.mjs'; },
      o => { o.packageTests.files[0].bytes = 0; },
      o => { o.packageTests.skipDisposition.skipped = -1; },
      o => { o.packageTests.skipDisposition.reason = ''; },
      o => { o.compiler.pnpm.version = '10.0.0'; },
    ]) {
      const altered = structuredClone(order); change(altered);
      assert.throws(() => admitMarketFabricationWorkOrder(altered), /PACKAGE_TEST_/u);
    }
    const incomplete = structuredClone(order); incomplete.packageTests.files.pop();
    await assert.rejects(verifyMarketFabricationInputs(fixture.sourceRoot, incomplete), /PACKAGE_TEST_INVENTORY/u);
    const changed = structuredClone(order); changed.packageTests.files[0].sha256 = '0'.repeat(64);
    await assert.rejects(verifyMarketFabricationInputs(fixture.sourceRoot, changed), /PACKAGE_TEST_INPUT/u);
    const manifest = JSON.parse(fixture.files['package.json']); manifest.scripts.pretest = 'node private-hook.mjs';
    const bytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
    await writeFile(join(fixture.sourceRoot, 'package.json'), bytes);
    fixture.git(fixture.sourceRoot, 'add', 'package.json');
    fixture.git(fixture.sourceRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Undesired hook fixture');
    const hookOrder = structuredClone(order);
    hookOrder.source.market.revision = fixture.git(fixture.sourceRoot, 'rev-parse', 'HEAD');
    hookOrder.source.market.tree = fixture.git(fixture.sourceRoot, 'rev-parse', 'HEAD^{tree}');
    hookOrder.sourceInputs.sourceManifest = { path: 'package.json', bytes: bytes.length, sha256: sha(bytes) };
    hookOrder.packageTests.sourceManifestSha256 = sha(bytes);
    await assert.rejects(verifyMarketFabricationInputs(fixture.sourceRoot, hookOrder), /PACKAGE_TEST_RECIPE/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('selected package tests require actual frozen install and are forwarded without changing legacy selection', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const order = await selectFixturePackageTests(fixture);
    let built = false, received = false;
    await assert.rejects(fabricateMarketCarrier(order, {
      destination: join(fixture.root, 'no-install'), sourceRoot: fixture.sourceRoot, installSuppliers: false,
      buildWorker: async () => { built = true; },
    }), /PACKAGE_TEST_FROZEN_INSTALLATION_REQUIRED/u);
    assert.equal(built, false);
    const commands = [];
    await assert.rejects(fabricateMarketCarrier(order, {
      destination: join(fixture.root, 'selected-profile'), sourceRoot: fixture.sourceRoot, installSuppliers: true,
      incumbentCarrierDirectory: fixture.incumbentCarrierRoot,
      exec: async (command, argv, options) => {
        if (command !== 'corepack') return defaultExec(command, argv, options);
        commands.push(argv); return { stdout: argv.includes('--version') ? '11.28.5\n' : '' };
      },
      buildWorker: ({ outputRoot, sourceRoot }) => writeMockBuildOutputs(outputRoot, sourceRoot, fixture),
      receiveWorker: async request => {
        received = true;
        assert.deepEqual(request.packageTests, order.packageTests);
        assert.deepEqual(request.frozenInstallation, {
          kind: '561.market-frozen-installation/v1', source: request.source,
          lockfileSha256: order.sourceInputs.lockfile.sha256,
          installedSuppliersSha256: sha(JSON.stringify(order.suppliers)),
          nodeModulesRoot: join(fixture.sourceRoot, 'node_modules'),
          packageManager: { name: 'pnpm', version: '11.28.5' }, frozenLockfile: true, ignoreScripts: true,
        });
        await mockReceiveWorker(request); // An old native result cannot silently satisfy this selection.
      },
      buildReceiver: async () => { assert.fail('Missing package evidence must refuse before receiver build'); },
    }), /PACKAGE_TEST_EVIDENCE/u);
    assert.equal(received, true);
    assert.deepEqual(commands.map(args => args.slice(0, 4)), [
      ['pnpm@11.28.5', '--version'], ['pnpm@11.28.5', 'install', '--frozen-lockfile', '--ignore-scripts'],
    ]);
    await assert.rejects(lstat(join(fixture.root, 'selected-profile/workspace')), { code: 'ENOENT' });
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

function packageEvidenceFixture({ skipped = 0, todo = 0, requestOverride, summaryOwnerOverride, compilerManifestOverride, stdoutOverride } = {}) {
  const source = requestOverride?.source ?? { repository: 'red-cup-engineering/market.561.group', revision: 'a'.repeat(40) };
  const selection = requestOverride?.packageTests ?? {
    kind: '561.market-source-package-test-selection/v1', script: 'node --test test/*.test.mjs',
    sourceManifestSha256: 'b'.repeat(64), lockfileSha256: 'c'.repeat(64), installedSuppliersSha256: 'd'.repeat(64),
    files: [{ path: 'test/fixture.test.mjs', bytes: 20, sha256: 'e'.repeat(64) }],
    skipDisposition: { kind: 'source-declared-counts', skipped, todo, reason: 'Explicit fixture disposition.' },
  };
  const request = requestOverride ?? { source, sourceRoot: '/fixture/source', packageTests: selection,
    artifact: { bytes: 100, sha256: 'f'.repeat(64) }, buildReceipt: { sha256: '1'.repeat(64) }, configuration: { sha256: '2'.repeat(64) },
    frozenInstallation: { kind: '561.market-frozen-installation/v1', source, lockfileSha256: selection.lockfileSha256,
      installedSuppliersSha256: selection.installedSuppliersSha256, nodeModulesRoot: '/fixture/source/node_modules',
      packageManager: { name: 'pnpm', version: '11.28.5' }, frozenLockfile: true, ignoreScripts: true },
  };
  const documents = [];
  const issue = (path, text) => {
    const descriptor = { path, bytes: Buffer.byteLength(text), sha256: sha(text) };
    documents.push({ ...descriptor, text }); return descriptor;
  };
  const privateMarker = 'PRIVATE_PACKAGE_OUTPUT_FIXTURE_NOT_FOR_PUBLIC_SUMMARY';
  const stdoutText = stdoutOverride ?? `TAP version 13\n# ${privateMarker}\n1..1\nok 1 - fixture\n# tests ${1 + skipped + todo}\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped ${skipped}\n# todo ${todo}\n`;
  const result = { tests: 1 + skipped + todo, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped, todo,
    outcome: skipped + todo ? 'execution-observed-with-declared-skips' : 'execution-observed',
    countsScope: 'native-node-reported-outcomes-including-file-wrappers', executionObserved: true,
    registeredCaseAdmission: 'not-requested', requirementsCoverage: 'not-claimed',
    skipDisposition: selection.skipDisposition };
  const summaryOwner = summaryOwnerOverride ?? { path: '/fixture/source/node_modules/summary/test-run-summary.mjs', bytes: 50, sha256: '3'.repeat(64) };
  const compilerManifest = compilerManifestOverride ?? '/fixture/source/node_modules/esbuild/package.json';
  const observation = {
    kind: '561.market-source-package-tests/v1', source, scope: 'original-manifest-source-tests', selection,
    selectionSha256: sha(JSON.stringify(selection)),
    command: { executable: process.execPath, nodeVersion: process.version, argv: ['--test', '--test-reporter=tap', ...selection.files.map(file => file.path)] },
    installedRoot: request.frozenInstallation.nodeModulesRoot, frozenInstallation: request.frozenInstallation,
    nativeCompilerManifest: compilerManifest, summaryOwner,
    execution: { exited: true, exitCode: 0, signal: null, error: false, outputComplete: true },
    stdout: issue('package-tests.tap', stdoutText), stderr: issue('package-tests.stderr.txt', ''), ...result,
    selectedInputSnapshot: { kind: '561.market-native-selected-test-inputs/v1', files: 1, sha256: '4'.repeat(64),
      unchanged: true, scope: 'compiler-selected-physical-inputs-and-manifests-plus-enrolled-tests-and-summary-compiler-owners',
      limits: { files: 16384, bytes: 268435456 }, everyDevelopmentImportReceived: false,
      completeInstalledByteContinuityReceived: false, importerTopologyReceived: false, mutationProofSandboxReceived: false },
    caseNameCompletenessIndependentlyReceived: false,
    custody: { rawOutput: 'embedded-private-carrier', privateCarrierReceived: false, durableRetention: 'unreceived', authorizedRecipient: null },
    productionDeploymentReceived: false, outsidePaymentReceived: false,
  };
  const qualification = {
    kind: '561.market-worker-native-qualification/v1', source, sourceRevision: source.revision,
    workerSha256: request.artifact.sha256, workerBytes: request.artifact.bytes,
    buildReceiptSha256: request.buildReceipt.sha256, configurationSha256: request.configuration.sha256,
    evidence: {}, evidenceDocuments: documents,
  };
  const refresh = () => {
    const index = documents.findIndex(d => d.path === 'package-tests-observations.json');
    if (index !== -1) documents.splice(index, 1);
    qualification.evidence.packageTests = issue('package-tests-observations.json', JSON.stringify(observation));
  };
  refresh();
  let ownerCalls = 0;
  const owners = { summaryOwner, compilerManifest,
    parseTestRunSummary: text => { assert.equal(text, stdoutText); return { tests: result.tests, pass: 1, fail: 0 }; },
    receiveResult: (processResult, summary, disposition) => {
      ownerCalls++;
      assert.equal(processResult.stdout, stdoutText); assert.equal(processResult.stderr, '');
      assert.deepEqual(summary, { tests: result.tests, pass: 1, fail: 0 });
      assert.deepEqual(disposition, selection.skipDisposition);
      if (!processResult.exited || processResult.exitCode !== 0 || processResult.signal !== null ||
          processResult.error || !processResult.outputComplete) throw new Error('Original owner refuses process');
      return result;
    },
  };
  return { request, qualification, observation, owners, result, refresh, privateMarker, ownerCalls: () => ownerCalls };
}

test('bridge receives actual private package streams through original owners and exports only bounded result metadata', () => {
  for (const disposition of [{}, { skipped: 2 }, { todo: 1 }]) {
    const fixture = packageEvidenceFixture(disposition);
    const summary = receiveMarketPackageTestEvidence(fixture.qualification, fixture.request, fixture.owners);
    assert.equal(fixture.ownerCalls(), 1);
    assert.equal(summary.outcome, fixture.result.outcome);
    assert.equal(summary.executionObserved, true);
    assert.equal(summary.countsScope, 'native-node-reported-outcomes-including-file-wrappers');
    assert.equal(summary.registeredCaseAdmission, 'not-requested');
    assert.equal(summary.requirementsCoverage, 'not-claimed');
    for (const name of ['allCasesPassed', 'registeredCasesReceived', 'testCoverageQualified', 'acceptanceProvider'])
      assert.equal(Object.hasOwn(summary, name), false);
    assert.equal(summary.tests, fixture.result.tests);
    assert.equal(summary.durableRetention, 'unreceived');
    assert.equal(summary.caseNameCompletenessIndependentlyReceived, false);
    assert.ok(!JSON.stringify(summary).includes(fixture.privateMarker));
    assert.ok(!JSON.stringify(summary).includes('/fixture/'));
    assert.ok(!Object.hasOwn(summary, 'text'));
  }
});

test('selected package evidence refuses omission, forgery, process failure and invented custody rather than downgrading', () => {
  for (const change of [
    f => { delete f.qualification.evidence.packageTests; },
    f => { f.qualification.evidenceDocuments.shift(); },
    f => { f.qualification.evidenceDocuments.push(f.qualification.evidenceDocuments[0]); },
    f => { f.qualification.evidenceDocuments[0].text += 'changed'; },
    f => { f.observation.selectionSha256 = '0'.repeat(64); f.refresh(); },
    f => { f.observation.selection = { ...f.observation.selection, script: 'npm test' }; f.refresh(); },
    f => { f.observation.source = { ...f.observation.source, revision: '0'.repeat(40) }; f.refresh(); },
    f => { f.observation.frozenInstallation = { ...f.observation.frozenInstallation, frozenLockfile: false }; f.refresh(); },
    f => { f.observation.command.argv.push('test/extra.test.mjs'); f.refresh(); },
    f => { f.observation.nativeCompilerManifest = '/outside/compiler.json'; f.refresh(); },
    f => { f.observation.summaryOwner = { ...f.observation.summaryOwner, sha256: '0'.repeat(64) }; f.refresh(); },
    f => { f.observation.tests++; f.refresh(); },
    f => { f.observation.pass++; f.refresh(); },
    f => { f.observation.fail = 1; f.refresh(); },
    f => { f.observation.cancelled = 1; f.refresh(); },
    f => { f.observation.skipped = 1; f.refresh(); },
    f => { f.observation.outcome = 'unreceived'; f.refresh(); },
    f => { f.observation.execution.exitCode = 1; f.refresh(); },
    f => { f.observation.execution.signal = 'SIGTERM'; f.refresh(); },
    f => { f.observation.execution.error = true; f.refresh(); },
    f => { f.observation.execution.outputComplete = false; f.refresh(); },
    f => { f.observation.custody.durableRetention = 'received'; f.refresh(); },
    f => { f.observation.custody.privateCarrierReceived = true; f.refresh(); },
    f => { f.observation.caseNameCompletenessIndependentlyReceived = true; f.refresh(); },
    f => { f.observation.selectedInputSnapshot.unchanged = false; f.refresh(); },
    f => { f.observation.selectedInputSnapshot.sha256 = ['4'.repeat(64)]; f.refresh(); },
    f => { f.observation.selectedInputSnapshot.importerTopologyReceived = true; f.refresh(); },
    f => { f.observation.selectedInputSnapshot.everyDevelopmentImportReceived = true; f.refresh(); },
  ]) {
    const fixture = packageEvidenceFixture(); change(fixture);
    assert.throws(() => receiveMarketPackageTestEvidence(fixture.qualification, fixture.request, fixture.owners), /PACKAGE_TEST_|Original owner refuses/u);
  }
});

test('selected profile completes the existing fabrication path with raw evidence private in the unchanged fifteen-file carrier', async () => {
  const fixture = await createCanonicalMarketFabricationFixture();
  try {
    const order = await selectFixturePackageTests(fixture);
    // Explicit component doubles: the native owner separately qualifies the real
    // result semantics. The public bridge must bind and invoke these exact owners.
    const receiverBytes = Buffer.from(`export function receiveNativeMarketPackageTestResult(process, summary, skipDisposition) {
      if (process.exitCode !== 0 || process.stderr !== '' || summary.tests !== 1) throw Error('fixture owner refusal');
      return { tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0,
        outcome: 'execution-observed', executionObserved: true,
        countsScope: 'native-node-reported-outcomes-including-file-wrappers',
        registeredCaseAdmission: 'not-requested', requirementsCoverage: 'not-claimed', skipDisposition };
    }\n`);
    fixture.files['ops/receive-native-worker.mjs'] = receiverBytes;
    await writeFile(join(fixture.sourceRoot, 'ops/receive-native-worker.mjs'), receiverBytes);
    fixture.git(fixture.sourceRoot, 'add', 'ops/receive-native-worker.mjs');
    fixture.git(fixture.sourceRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Native result owner double');
    order.source.market.revision = fixture.git(fixture.sourceRoot, 'rev-parse', 'HEAD');
    order.source.market.tree = fixture.git(fixture.sourceRoot, 'rev-parse', 'HEAD^{tree}');
    order.source.receiver.revision = order.source.market.revision;
    order.sourceInputs.nativeReceiver = { path: 'ops/receive-native-worker.mjs', bytes: receiverBytes.length, sha256: sha(receiverBytes) };
    const summaryRoot = join(fixture.sourceRoot, 'node_modules/@red-cup-engineering/npm-workspace-publication-service');
    await mkdir(summaryRoot, { recursive: true });
    const summaryBytes = Buffer.from('export const parseTestRunSummary = () => ({ tests: 1, pass: 1, fail: 0 });\n');
    const summaryPath = join(summaryRoot, 'test-run-summary.mjs');
    await writeFile(summaryPath, summaryBytes);
    await writeFile(join(summaryRoot, 'package.json'), JSON.stringify({
      name: '@red-cup-engineering/npm-workspace-publication-service', version: '0.14.18', type: 'module',
      exports: { './test-run-summary': './test-run-summary.mjs', './package.json': './package.json' },
    }));
    let selectedEvidence, narrowEnrollment = false;
    const options = {
      destination: join(fixture.root, 'private-package-carrier'), sourceRoot: fixture.sourceRoot, installSuppliers: true,
      incumbentCarrierDirectory: fixture.incumbentCarrierRoot,
      exec: async (command, argv, options) => command === 'corepack'
        ? { stdout: argv.includes('--version') ? '11.28.5\n' : '' } : defaultExec(command, argv, options),
      buildWorker: ({ outputRoot, sourceRoot }) => writeMockBuildOutputs(outputRoot, sourceRoot, fixture),
      receiveWorker: async request => {
        if (narrowEnrollment) request.packageTests.files.pop();
        selectedEvidence = packageEvidenceFixture({ requestOverride: request,
          summaryOwnerOverride: { path: summaryPath, bytes: summaryBytes.length, sha256: sha(summaryBytes) },
          compilerManifestOverride: join(fixture.esbuildRoot, 'package.json') });
        Object.assign(selectedEvidence.qualification, {
          outsidePaymentReceived: false, artifactInternalComputationInstrumented: false,
          checks: { startup: { passed: true }, sourceSuite: { passed: true } },
        });
        await mkdir(request.outputRoot, { recursive: true });
        await writeFile(join(request.outputRoot, 'native-qualification.json'), JSON.stringify(selectedEvidence.qualification));
      },
      buildReceiver: mockBuildReceiver,
    };
    const result = await fabricateMarketCarrier(order, options);
    assert.equal(Object.keys(result.manifest.artifacts).length, 15);
    assert.equal(result.fabricationReceipt.packageTests.privateCarrierReceived, true);
    assert.equal(result.fabricationReceipt.packageTests.durableRetention, 'unreceived');
    assert.equal(result.fabricationReceipt.packageTests.everyDevelopmentImportReceived, false);
    assert.equal(result.fabricationReceipt.workspaceDisposed, true);
    assert.ok(!JSON.stringify(result.fabricationReceipt).includes(selectedEvidence.privateMarker));
    const received = await verifyMarketCarrier(result.carrierDirectory, result.manifestSha256);
    const retained = await readFile(join(received.root, received.manifest.artifacts.nativeQualification.path), 'utf8');
    assert.ok(retained.includes(selectedEvidence.privateMarker));
    assert.equal((await lstat(join(received.root, received.manifest.artifacts.nativeQualification.path))).mode & 0o777, 0o600);
    await assert.rejects(lstat(join(fixture.root, 'private-package-carrier/workspace')), { code: 'ENOENT' });
    narrowEnrollment = true;
    await assert.rejects(fabricateMarketCarrier(order, { ...options, destination: join(fixture.root, 'narrowed-package-carrier') }),
      /PACKAGE_TEST_OBSERVATION_MISMATCH/u);
    assert.equal(order.packageTests.files.length, 3);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('actual Node module outcomes are received as execution facts, not registered cases or requirements coverage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'market-node-outcome-boundary-'));
  try {
    for (const [name, source] of [
      ['empty', '// Intentionally empty source module: no registered test cases.\n'],
      ['top-level-assertion', "import assert from 'node:assert/strict'; assert.equal(2 + 2, 4);\n"],
      ['registered-test', "import test from 'node:test'; import assert from 'node:assert/strict'; test('registered fixture', () => assert.equal(2 + 2, 4));\n"],
    ]) {
      const file = join(root, `${name}.test.mjs`);
      await writeFile(file, source);
      const actual = await defaultExec(process.execPath, ['--test', '--test-reporter=tap', file], {
        cwd: root, timeout: 10000, maxBuffer: 1024 * 1024,
        env: { PATH: process.env.PATH ?? '', NO_COLOR: '1' },
      });
      assert.equal(actual.stderr, '');
      // These are assertions on the actual counterexample, not a replacement
      // production parser. All three distinct module forms report the same count.
      assert.match(actual.stdout, /^# tests 1$/mu);
      assert.match(actual.stdout, /^# pass 1$/mu);
      assert.match(actual.stdout, /^# fail 0$/mu);
      const fixture = packageEvidenceFixture({ stdoutOverride: actual.stdout });
      const summary = receiveMarketPackageTestEvidence(fixture.qualification, fixture.request, fixture.owners);
      assert.equal(summary.outcome, 'execution-observed');
      assert.equal(summary.executionObserved, true);
      assert.equal(summary.registeredCaseAdmission, 'not-requested');
      assert.equal(summary.requirementsCoverage, 'not-claimed');
      assert.equal(Object.hasOwn(summary, 'allCasesPassed'), false);
      for (const [claim, value] of [
        ['allCasesPassed', true], ['registeredCasesReceived', true], ['testCoverageQualified', true],
        ['acceptanceProvider', { state: 'received' }], ['registeredCaseAdmission', 'received'],
        ['requirementsCoverage', 'qualified'], ['countsScope', 'registered-test-cases'],
      ]) {
        const changed = packageEvidenceFixture({ stdoutOverride: actual.stdout });
        changed.observation[claim] = value; changed.refresh();
        assert.throws(() => receiveMarketPackageTestEvidence(changed.qualification, changed.request, changed.owners),
          /PACKAGE_TEST_CLAIM_SCOPE_MISMATCH/u);
      }
      // A falsely stronger result returned by an owner cannot be laundered into
      // the safe summary even when the observation itself stays scoped.
      const overclaim = packageEvidenceFixture({ stdoutOverride: actual.stdout });
      overclaim.owners.receiveResult = () => ({ ...overclaim.result, allCasesPassed: true });
      assert.throws(() => receiveMarketPackageTestEvidence(overclaim.qualification, overclaim.request, overclaim.owners),
        /PACKAGE_TEST_CLAIM_SCOPE_MISMATCH/u);
      const legacy = packageEvidenceFixture({ stdoutOverride: actual.stdout });
      legacy.observation.outcome = 'passed'; legacy.observation.allCasesPassed = true; legacy.refresh();
      assert.throws(() => receiveMarketPackageTestEvidence(legacy.qualification, legacy.request, legacy.owners),
        /PACKAGE_TEST_COUNTS_MISMATCH/u);
    }
    const failing = join(root, 'failed-assertion.test.mjs');
    await writeFile(failing, "import assert from 'node:assert/strict'; assert.equal(2 + 2, 5);\n");
    await assert.rejects(defaultExec(process.execPath, ['--test', '--test-reporter=tap', failing], {
      cwd: root, timeout: 10000, maxBuffer: 1024 * 1024,
      env: { PATH: process.env.PATH ?? '', NO_COLOR: '1' },
    }), error => {
      assert.equal(error.code, 1);
      const fixture = packageEvidenceFixture({ stdoutOverride: error.stdout });
      fixture.observation.execution.exitCode = 1; fixture.observation.execution.error = true; fixture.refresh();
      assert.throws(() => receiveMarketPackageTestEvidence(fixture.qualification, fixture.request, fixture.owners),
        /Original owner refuses/u);
      return true;
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
