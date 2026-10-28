#!/usr/bin/env node
// The Group owns only the existing credential/carrier lane. Market owns the
// release algorithm and Cloudflare owns its effects; both arrive as pinned
// original source-derived bytes in the already-established private carrier or
// are fabricated on the runner from an exact byte-bound native work order.
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';

const defaultExec = promisify(execFile);
const SHA = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
const SRI_SHA512 = /^sha512-[A-Za-z0-9+/=]{86,90}$/u;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const DIRECTORY = /^\.service-releases\/market\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/u;
const RELATIVE_PATH = /^[a-zA-Z0-9_.][a-zA-Z0-9_./-]{0,220}$/u;
const ROOT = '561-group/561-group-frontdoor-services-section';
const MARKET_REPOSITORY = 'red-cup-engineering/market.561.group';
const PARAMETERS_REPOSITORY = 'causeway-services/public-market-services-section';
const CLOUDFLARE_REPOSITORY = 'red-cup-engineering/cloudflare-engineering-services-section';
const TARGET_ACCOUNT_ID = '337e54ee6dc7d488933f473204a6d89e';
const TARGET_SCRIPT_NAME = 'market-561-group';
const TARGET_ORIGIN = 'https://market.561.group';
const TARGET_ALIASES = ['https://shop.561.group', 'https://bazaar.561.group'];
const PAYMENT_NETWORK = 'eip155:8453';
const PAYMENT_ASSET = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const PAYMENT_FACILITATOR = 'https://facilitator.xpay.sh';
const OPERATION = new Set(['release', 'observe']);
const PRESENTATION = new Set(['native', 'scrubbed']);
const REQUIRED_FILES = ['worker', 'buildReceipt', 'candidateDeclarations', 'incumbentDeclarations', 'nativeQualification', 'receiver', 'receiverInputs'];
const NATIVE_FILES = ['sourceInputs', 'packageManifests', 'sourceManifest', 'lockfile', 'configuration', 'metafile', 'sourceMap', 'parameterSourceManifest'];
const REQUIRED_SOURCE_INPUT_KEYS = [
  'sourceManifest',
  'lockfile',
  'workspaceManifest',
  'npmrc',
  'configuration',
  'parameterSourceManifest',
  'parameterCatalog',
  'workerEntry',
  'compiledOffers',
  'nativeProducer',
  'retainedProducer',
  'receiverBuilder',
  'nativeReceiver',
  'deploymentReceiver',
  'releaseOperator',
];
const ADMITTED_BUILD_OUTPUT_NAMES = new Set([
  'worker.js',
  'worker.js.map',
  'worker.mjs',
  'worker.mjs.map',
  'README.md',
  'esbuild.metafile.json',
  'native-build.stdout.log',
  'native-build.stderr.log',
  'source-inputs.json',
  'package-manifests.json',
  'source-package.json',
  'parameters-package.json',
  'pnpm-lock.yaml',
  'wrangler.jsonc',
  'request.json',
  'build-receipt.json',
]);
const SOURCE_AUTH_ENV_KEYS = [
  'MARKET_SOURCE_GITHUB_TOKEN',
  'MARKET_PARAMETERS_GITHUB_TOKEN',
  'MARKET_SOURCE_DEPLOY_KEY',
  'MARKET_PARAMETERS_DEPLOY_KEY',
  'SITE_CONTENT_DEPLOY_KEY',
];
const PACKAGE_TEST_SCRIPT = 'node --test test/*.test.mjs';
const PACKAGE_TEST_SUMMARY = '@red-cup-engineering/npm-workspace-publication-service';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = isDeepStrictEqual;
function requireThat(condition, message, code = message) {
  if (!condition) throw Object.assign(new Error(message), { code });
}
const inside = (root, file) => {
  const rel = relative(root, file);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
const safeRelativePath = value => typeof value === 'string' && RELATIVE_PATH.test(value) &&
  !value.split('/').some(part => !part || part === '.' || part === '..');
const canonicalOrigins = repository => [
  `https://github.com/${repository}`,
  `https://github.com/${repository}.git`,
  `git@github.com:${repository}.git`,
  `ssh://git@github.com/${repository}.git`,
];
const fileIdentity = (path, bytes) => ({ path, bytes: bytes.length, sha256: hash(bytes) });

function checkDescriptor(descriptor, code = 'EXACT_ARTIFACT_BYTES_REQUIRED', maxBytes = 32 * 1024 * 1024) {
  requireThat(
    descriptor && safeRelativePath(descriptor.path) && SHA.test(descriptor.sha256 ?? '') &&
      Number.isSafeInteger(descriptor.bytes) && descriptor.bytes > 0 && descriptor.bytes <= maxBytes,
    code,
    code,
  );
  return descriptor;
}

// Public selection admission mirrors the original native profile; execution and
// result interpretation remain with the pinned original receiver and summary owner.
function admitMarketPackageTests(selected, workOrder) {
  requireThat(selected?.kind === '561.market-source-package-test-selection/v1' &&
    selected.script === PACKAGE_TEST_SCRIPT, 'PACKAGE_TEST_PROFILE_REQUIRED');
  requireThat(selected.sourceManifestSha256 === workOrder.sourceInputs.sourceManifest.sha256 &&
    selected.lockfileSha256 === workOrder.sourceInputs.lockfile.sha256 &&
    selected.installedSuppliersSha256 === hash(JSON.stringify(workOrder.suppliers)) &&
    workOrder.sourceInputs.sourceManifest.path === 'package.json' &&
    workOrder.sourceInputs.lockfile.path === 'pnpm-lock.yaml' &&
    workOrder.compiler.pnpm?.version === '11.28.5', 'PACKAGE_TEST_SELECTION_MISMATCH');
  requireThat(Array.isArray(selected.files) && selected.files.length > 0 && selected.files.length <= 256,
    'PACKAGE_TEST_INVENTORY_REQUIRED');
  const paths = [];
  for (const file of selected.files) {
    checkDescriptor(file, 'PACKAGE_TEST_INPUT_REQUIRED', 1024 * 1024);
    requireThat(/^test\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.test\.mjs$/u.test(file.path) &&
      !paths.includes(file.path), 'PACKAGE_TEST_INVENTORY_REQUIRED');
    paths.push(file.path);
  }
  requireThat(equal(paths, [...paths].sort()), 'PACKAGE_TEST_INVENTORY_REQUIRED');
  const disposition = selected.skipDisposition;
  requireThat(disposition?.kind === 'source-declared-counts' &&
    ['skipped', 'todo'].every(name => Number.isSafeInteger(disposition[name]) &&
      disposition[name] >= 0 && disposition[name] <= 256) &&
    typeof disposition.reason === 'string' && disposition.reason.trim().length > 0 &&
    disposition.reason.length <= 1024, 'PACKAGE_TEST_SKIP_DISPOSITION_REQUIRED');
}

export function admitMarketFabricationWorkOrder(workOrder) {
  requireThat(workOrder?.kind === '561.market-worker-fabrication-work-order/v1', 'INVALID_FABRICATION_WORK_ORDER');
  const { target, source, baseline, payment, incumbentCarrier, compiler, sourceInputs, suppliers, qualificationSuites, declarations } = workOrder;
  requireThat(
    target?.accountId === TARGET_ACCOUNT_ID && target?.scriptName === TARGET_SCRIPT_NAME &&
      target?.origin === TARGET_ORIGIN && equal(target?.aliases, TARGET_ALIASES),
    'WRONG_EXISTING_MARKET_TARGET',
  );
  requireThat(
    source?.market?.repository === MARKET_REPOSITORY && COMMIT.test(source.market.revision ?? '') &&
      COMMIT.test(source.market.tree ?? ''),
    'MARKET_SOURCE_SELECTION_REQUIRED',
  );
  requireThat(
    source?.public?.repository === PARAMETERS_REPOSITORY && COMMIT.test(source.public.revision ?? '') &&
      COMMIT.test(source.public.gitlink ?? '') && source.public.revision === source.public.gitlink &&
      COMMIT.test(source.public.tree ?? ''),
    'PARAMETERS_SOURCE_SELECTION_REQUIRED',
  );
  requireThat(
    source?.cloudflare?.repository === CLOUDFLARE_REPOSITORY && COMMIT.test(source.cloudflare.revision ?? ''),
    'CLOUDFLARE_SOURCE_SELECTION_REQUIRED',
  );
  requireThat(
    source.receiver === undefined || (source.receiver?.repository === MARKET_REPOSITORY &&
      COMMIT.test(source.receiver.revision ?? '')),
    'RECEIVER_SOURCE_SELECTION_REQUIRED',
  );
  requireThat(
    workOrder.candidateCatalogPresentation === undefined || PRESENTATION.has(workOrder.candidateCatalogPresentation),
    'CANDIDATE_CATALOG_PRESENTATION_REQUIRED',
  );
  requireThat(
    UUID.test(baseline?.versionId ?? '') && (baseline.sourceRevision === null || COMMIT.test(baseline?.sourceRevision ?? '')) &&
      PRESENTATION.has(baseline?.catalogPresentation) &&
      (baseline.deploymentId === undefined || UUID.test(baseline.deploymentId)) &&
      (baseline.latestVersionId === undefined || UUID.test(baseline.latestVersionId)),
    'INDEPENDENT_BASELINE_REQUIRED',
  );
  requireThat(
    /^0x[0-9a-fA-F]{40}$/u.test(payment?.payTo ?? '') && payment?.network === PAYMENT_NETWORK &&
      payment?.asset?.toLowerCase() === PAYMENT_ASSET && payment?.facilitator === PAYMENT_FACILITATOR,
    'EXISTING_PAYMENT_RAIL_REQUIRED',
  );
  if (incumbentCarrier !== undefined) {
    requireThat(
      incumbentCarrier?.repository === ROOT && COMMIT.test(incumbentCarrier.revision ?? '') &&
        DIRECTORY.test(incumbentCarrier.directory ?? '') && SHA.test(incumbentCarrier.manifestSha256 ?? '') &&
        ['candidateDeclarations', 'incumbentDeclarations'].includes(incumbentCarrier.incumbentDeclarationsArtifact ?? 'candidateDeclarations'),
      'INCUMBENT_CARRIER_SELECTION_REQUIRED',
    );
  }
  requireThat(
    compiler?.wrangler?.name === 'wrangler' && VERSION.test(compiler.wrangler.version ?? '') &&
      compiler?.esbuild?.name === 'esbuild' && VERSION.test(compiler.esbuild.version ?? '') &&
      compiler?.workerd?.name === 'workerd' && VERSION.test(compiler.workerd.version ?? '') &&
      (compiler.pnpm === undefined || (compiler.pnpm?.name === 'pnpm' && VERSION.test(compiler.pnpm.version ?? ''))),
    'COMPILER_SELECTION_UNRECEIVED',
  );
  requireThat(sourceInputs && typeof sourceInputs === 'object', 'SOURCE_INPUT_SELECTION_REQUIRED');
  for (const key of REQUIRED_SOURCE_INPUT_KEYS) {
    checkDescriptor(sourceInputs[key], 'SOURCE_INPUT_SELECTION_REQUIRED');
  }
  requireThat(
    Array.isArray(sourceInputs.applicationInputs) && sourceInputs.applicationInputs.length > 0 &&
      sourceInputs.applicationInputs.length <= 256,
    'SOURCE_INPUT_SELECTION_REQUIRED',
  );
  const seenInputPaths = new Set();
  for (const item of sourceInputs.applicationInputs) {
    checkDescriptor(item, 'SOURCE_INPUT_SELECTION_REQUIRED');
    requireThat(!seenInputPaths.has(item.path), 'DUPLICATE_SOURCE_INPUT_PATH');
    seenInputPaths.add(item.path);
  }
  requireThat(Array.isArray(suppliers) && suppliers.length > 0 && suppliers.length <= 64, 'SUPPLIER_SELECTION_REQUIRED');
  for (const supplier of suppliers) {
    requireThat(
      typeof supplier?.name === 'string' && /^@[a-z0-9-]+\/[a-z0-9._-]+$|^[a-z0-9._-]+$/u.test(supplier.name) &&
        VERSION.test(supplier.version ?? '') && SRI_SHA512.test(supplier.integrity ?? ''),
      'SUPPLIER_SELECTION_REQUIRED',
    );
    checkDescriptor(supplier.manifest, 'SUPPLIER_SELECTION_REQUIRED', 1024 * 1024);
    requireThat(supplier.manifest.path === 'package.json', 'SUPPLIER_SELECTION_REQUIRED');
    requireThat(Array.isArray(supplier.files) && supplier.files.length > 0 && supplier.files.length <= 256, 'SUPPLIER_SELECTION_REQUIRED');
    for (const file of supplier.files) checkDescriptor(file, 'SUPPLIER_SELECTION_REQUIRED');
  }
  requireThat(qualificationSuites && typeof qualificationSuites === 'object', 'QUALIFICATION_SUITE_SELECTION_REQUIRED');
  checkDescriptor(qualificationSuites.sourceSuite, 'QUALIFICATION_SUITE_SELECTION_REQUIRED', 1024 * 1024);
  if (qualificationSuites.sourceCellSuite !== undefined) {
    checkDescriptor(qualificationSuites.sourceCellSuite, 'QUALIFICATION_SUITE_SELECTION_REQUIRED', 1024 * 1024);
  }
  if (qualificationSuites.workspaceGraphSuite !== undefined) {
    checkDescriptor(qualificationSuites.workspaceGraphSuite, 'QUALIFICATION_SUITE_SELECTION_REQUIRED', 1024 * 1024);
  }
  if (workOrder.packageTests !== undefined) admitMarketPackageTests(workOrder.packageTests, workOrder);
  requireThat(declarations && typeof declarations === 'object', 'DECLARATION_SELECTION_REQUIRED');
  checkDescriptor(declarations.candidate, 'DECLARATION_SELECTION_REQUIRED');
  checkDescriptor(declarations.incumbent, 'DECLARATION_SELECTION_REQUIRED');
  return workOrder;
}

export async function readMarketFabricationWorkOrder(file = '.releases/market/work-order.json', expectedSha256) {
  requireThat(SHA.test(expectedSha256 ?? ''), 'FABRICATION_WORK_ORDER_DIGEST_REQUIRED');
  const bytes = await readFile(resolve(file));
  requireThat(bytes.length <= 256 * 1024 && hash(bytes) === expectedSha256, 'FABRICATION_WORK_ORDER_BYTES_CHANGED');
  return { workOrder: admitMarketFabricationWorkOrder(JSON.parse(bytes.toString('utf8'))), workOrderSha256: expectedSha256 };
}

async function resolveSelectionWorkOrderPath(selectionFile, workOrderPath) {
  requireThat(safeRelativePath(workOrderPath), 'Select one exact original Market carrier in the existing private source', 'FABRICATION_WORK_ORDER_PATH_REQUIRED');
  const candidates = [
    resolve(dirname(resolve(selectionFile)), workOrderPath),
    resolve(dirname(resolve(selectionFile)), basename(workOrderPath)),
    resolve(workOrderPath),
  ];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  throw Object.assign(new Error('FABRICATION_WORK_ORDER_MISSING'), { code: 'FABRICATION_WORK_ORDER_MISSING' });
}

export async function selectMarketCarrier(file = '.releases/market/selection.json') {
  let bytes;
  try { bytes = await readFile(file); }
  catch (error) { if (error.code === 'ENOENT') return { ready: false }; throw error; }
  requireThat(bytes.length <= 16 * 1024, 'Market carrier selection exceeds its bound', 'CARRIER_SELECTION_TOO_LARGE');
  const selection = JSON.parse(bytes);
  const operation = selection.operation === undefined ? 'release' : selection.operation;
  requireThat(
    selection.kind === '561.market-worker-carrier-selection/v1' && selection.repository === ROOT &&
      COMMIT.test(selection.revision ?? '') && SHA.test(selection.manifestSha256 ?? '') &&
      OPERATION.has(operation) &&
      DIRECTORY.test(selection.directory ?? ''),
    'Select one exact original Market carrier in the existing private source',
    'INVALID_CARRIER_SELECTION',
  );
  if (selection.workOrder !== undefined || selection.workOrderSha256 !== undefined) {
    requireThat(
      safeRelativePath(selection.workOrder) && SHA.test(selection.workOrderSha256 ?? ''),
      'Select one exact original Market carrier in the existing private source',
      'FABRICATION_WORK_ORDER_SELECTION_REQUIRED',
    );
    const workOrderFile = await resolveSelectionWorkOrderPath(file, selection.workOrder);
    const { workOrder } = await readMarketFabricationWorkOrder(workOrderFile, selection.workOrderSha256);
    if (workOrder.incumbentCarrier !== undefined) {
      requireThat(
        workOrder.incumbentCarrier.repository === selection.repository &&
          workOrder.incumbentCarrier.revision === selection.revision &&
          workOrder.incumbentCarrier.directory === selection.directory &&
          workOrder.incumbentCarrier.manifestSha256 === selection.manifestSha256,
        'INCUMBENT_CARRIER_SELECTION_MISMATCH',
      );
    }
  }
  return { ready: true, ...selection, operation };
}

async function listCarrierFilesRecursive(root, current = root, out = []) {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(current, entry.name);
    const rel = relative(root, full).split(sep).join('/');
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      await listCarrierFilesRecursive(root, full, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

async function selectedMarketManifest(directory, expectedManifestSha256) {
  requireThat(SHA.test(expectedManifestSha256 ?? ''), 'Exact selected carrier manifest digest required', 'CARRIER_MANIFEST_DIGEST_REQUIRED');
  const root = await realpath(directory);
  const info = await stat(resolve(root, 'manifest.json'));
  requireThat(info.isFile() && info.size < 128 * 1024, 'Carrier manifest must be a bounded file', 'CARRIER_MANIFEST_TOO_LARGE');
  const bytes = await readFile(resolve(root, 'manifest.json'));
  requireThat(hash(bytes) === expectedManifestSha256, 'Selected original carrier manifest changed', 'CARRIER_MANIFEST_BYTES_CHANGED');
  const manifest = JSON.parse(bytes);
  requireThat(
    manifest.kind === '561.market-worker-release/v1' &&
      manifest.target?.scriptName === TARGET_SCRIPT_NAME && manifest.target?.origin === TARGET_ORIGIN &&
      manifest.source?.market?.repository === MARKET_REPOSITORY && COMMIT.test(manifest.source.market.revision),
    'This credential lane is restricted to the existing original Market target',
    'INVALID_RELEASE_MANIFEST',
  );
  const hasPriorReceipt = Object.hasOwn(manifest.artifacts ?? {}, 'priorReleaseReceipt');
  const originalFileCount = Object.keys(manifest.artifacts ?? {}).length - (hasPriorReceipt ? 1 : 0);
  const keys = Object.keys(manifest.artifacts ?? {}).sort();
  const retained = [...REQUIRED_FILES, ...(hasPriorReceipt ? ['priorReleaseReceipt'] : [])].sort();
  const native = [...REQUIRED_FILES, ...NATIVE_FILES, ...(hasPriorReceipt ? ['priorReleaseReceipt'] : [])].sort();
  requireThat(
    manifest.artifacts?.receiver && [7, 15].includes(originalFileCount) &&
      (equal(keys, retained) || equal(keys, native)),
    'Original Market carrier closure missing',
    'CARRIER_ARTIFACT_SET_CHANGED',
  );
  const seen = new Set();
  const allowedCarrierPaths = new Set(['manifest.json']);
  for (const [name, item] of Object.entries(manifest.artifacts)) {
    requireThat(
      typeof item.path === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,220}$/u.test(item.path) &&
        !item.path.split('/').some(part => !part || part === '.' || part === '..') && !seen.has(item.path) &&
        SHA.test(item.sha256 ?? '') && Number.isSafeInteger(item.bytes) && item.bytes > 0 &&
        item.bytes <= (name === 'priorReleaseReceipt' ? 128 * 1024 : (name === 'sourceMap' ? 64 : 32) * 1024 * 1024),
      'Every carrier file must have one exact bounded selection',
      'EXACT_ARTIFACT_BYTES_REQUIRED',
    );
    seen.add(item.path);
    allowedCarrierPaths.add(item.path);
    allowedCarrierPaths.add(`${item.path}.gz`);
  }
  return { root, manifest, allowedCarrierPaths };
}

async function containedCarrierPath(root, selectedPath) {
  const file = await realpath(resolve(root, selectedPath)), rel = relative(root, file);
  requireThat(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'Carrier path escapes the selected source', 'ARTIFACT_OUTSIDE_CARRIER');
  return file;
}

async function verifyCarrierFile(root, item) {
  const file = await containedCarrierPath(root, item.path), info = await stat(file);
  requireThat(info.isFile() && info.size === item.bytes, 'Carrier file size differs from selected bytes', 'CARRIER_ARTIFACT_SIZE_CHANGED');
  requireThat(hash(await readFile(file)) === item.sha256, 'Carrier file digest differs from selected bytes', 'CARRIER_ARTIFACT_BYTES_CHANGED');
}

export async function verifyMarketCarrier(directory, expectedManifestSha256) {
  const { root, manifest, allowedCarrierPaths } = await selectedMarketManifest(directory, expectedManifestSha256);
  for (const item of Object.values(manifest.artifacts)) await verifyCarrierFile(root, item);
  for (const actualPath of await listCarrierFilesRecursive(root)) {
    requireThat(allowedCarrierPaths.has(actualPath), 'Extra unreviewed carrier file refused', 'EXTRA_CARRIER_INPUT_REFUSED');
  }
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
    requireThat(await realpath(parent) === parent, 'Carrier write parent must not be a symlink', 'SYMLINK_WRITE_PARENT_REFUSED');
    const compressedFile = await containedCarrierPath(root, `${item.path}.gz`), info = await stat(compressedFile);
    requireThat(info.isFile() && info.size > 0 && info.size <= 16 * 1024 * 1024, 'Compressed carrier file exceeds its bound', 'COMPRESSED_ARTIFACT_TOO_LARGE');
    const compressed = await readFile(compressedFile);
    requireThat(compressed.length === info.size, 'Compressed carrier file changed while receiving', 'COMPRESSED_ARTIFACT_CHANGED');
    const bytes = gunzipSync(compressed, { maxOutputLength: item.bytes });
    requireThat(bytes.length === item.bytes, 'Expanded carrier file size differs from selected bytes', 'COMPRESSED_ARTIFACT_SIZE_CHANGED');
    requireThat(hash(bytes) === item.sha256, 'Expanded carrier file digest differs from selected bytes', 'COMPRESSED_ARTIFACT_BYTES_CHANGED');
    // Recheck the parent immediately before an exclusive write. A racing raw
    // file is refused by wx; receiving never replaces pre-existing material.
    requireThat(await realpath(parent) === parent, 'Carrier write parent must not be a symlink', 'SYMLINK_WRITE_PARENT_REFUSED');
    await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
    restoredArtifacts.push(name);
  }
  return { ...await verifyMarketCarrier(root, expectedManifestSha256), restoredArtifacts };
}

export async function checkoutPinnedGitRepository(checkoutRoot, {
  repository,
  revision,
  tree,
  sparseDirectory,
  token,
  remoteUrl,
  canonicalOriginUrl = `https://github.com/${repository}.git`,
  exec = defaultExec,
  revisionMismatchCode = 'CARRIER_COMMIT_MISMATCH',
  treeMismatchCode = 'CARRIER_TREE_MISMATCH',
}) {
  await mkdir(checkoutRoot, { recursive: true, mode: 0o700 });
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? tmpdir(),
  };
  const git = (...args) => exec('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '--no-optional-locks', ...args], {
    cwd: checkoutRoot,
    env,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  await git('init', '--quiet');
  const baseRemoteUrl = remoteUrl ?? `https://github.com/${repository}.git`;
  await git('remote', 'add', 'origin', baseRemoteUrl);
  if (sparseDirectory) {
    await git('sparse-checkout', 'init', '--cone');
    await git('sparse-checkout', 'set', sparseDirectory);
  }
  const fetchArgs = ['-c', 'protocol.version=2'];
  const fetchEnv = { ...env };
  if (token) {
    const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
    fetchEnv.GIT_CONFIG_COUNT = '1';
    fetchEnv.GIT_CONFIG_KEY_0 = `http.https://github.com/${repository}.git.extraheader`;
    fetchEnv.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${basicAuth}`;
  }
  const gitFetch = (...args) => exec('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '--no-optional-locks', ...args], {
    cwd: checkoutRoot,
    env: fetchEnv,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  fetchArgs.push('fetch', '--quiet', '--depth', '1', '--no-tags', '--no-recurse-submodules', 'origin', revision);
  try {
    await gitFetch(...fetchArgs);
    await git('checkout', '--quiet', '--detach', 'FETCH_HEAD');
  } finally {
    if (canonicalOriginUrl) {
      await git('remote', 'set-url', 'origin', canonicalOriginUrl).catch(() => {});
    }
  }
  const head = (await git('rev-parse', '--verify', 'HEAD')).stdout.trim();
  requireThat(head === revision, revisionMismatchCode);
  const headTree = (await git('rev-parse', '--verify', 'HEAD^{tree}')).stdout.trim();
  requireThat(COMMIT.test(headTree) && (tree === undefined || headTree === tree), treeMismatchCode);
  return { checkoutRoot, revision: head, tree: headTree };
}

export async function verifyMarketFabricationInputs(sourceRoot, workOrder, {
  exec = defaultExec,
} = {}) {
  admitMarketFabricationWorkOrder(workOrder);
  const resolvedSourceRoot = await realpath(sourceRoot);
  const git = async (root, ...args) => (await exec('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '--no-optional-locks', '-C', root, ...args], {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? tmpdir() },
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  })).stdout.trim();

  async function verifyCanonicalCheckout(root, repository, expectedRevision, expectedTree, revisionCode, treeCode) {
    let toplevel;
    try {
      toplevel = await realpath(await git(root, 'rev-parse', '--show-toplevel'));
    } catch {
      requireThat(false, 'CANONICAL_GIT_CHECKOUT_REQUIRED');
    }
    requireThat(toplevel === root, 'CANONICAL_GIT_CHECKOUT_REQUIRED');
    const origin = await git(root, 'remote', 'get-url', 'origin');
    requireThat(canonicalOrigins(repository).includes(origin), 'CANONICAL_GIT_ORIGIN_REQUIRED');
    const head = await git(root, 'rev-parse', '--verify', 'HEAD');
    requireThat(head === expectedRevision, revisionCode);
    const tree = await git(root, 'rev-parse', '--verify', 'HEAD^{tree}');
    requireThat(tree === expectedTree, treeCode);
    const status = await git(root, 'status', '--porcelain', '--untracked-files=all');
    requireThat(status === '', 'SOURCE_CHECKOUT_DIRTY');
    return { revision: head, tree, origin };
  }

  const marketCheckout = await verifyCanonicalCheckout(
    resolvedSourceRoot,
    MARKET_REPOSITORY,
    workOrder.source.market.revision,
    workOrder.source.market.tree,
    'MARKET_SOURCE_REVISION_MISMATCH',
    'MARKET_SOURCE_TREE_MISMATCH',
  );
  const lsTreeEntry = await git(resolvedSourceRoot, 'ls-tree', marketCheckout.revision, '--', 'parameters');
  const gitlink = /^160000 commit ([a-f0-9]{40})\tparameters$/u.exec(lsTreeEntry)?.[1];
  requireThat(gitlink === workOrder.source.public.gitlink, 'PARAMETERS_GITLINK_MISMATCH');

  let resolvedParametersRoot;
  try {
    resolvedParametersRoot = await realpath(resolve(resolvedSourceRoot, 'parameters'));
  } catch {
    requireThat(false, 'PARAMETERS_CHECKOUT_MISSING');
  }
  requireThat(
    inside(resolvedSourceRoot, resolvedParametersRoot) && resolvedParametersRoot !== resolvedSourceRoot,
    'PARAMETERS_CHECKOUT_OUTSIDE_SOURCE',
  );
  const parametersCheckout = await verifyCanonicalCheckout(
    resolvedParametersRoot,
    PARAMETERS_REPOSITORY,
    workOrder.source.public.revision,
    workOrder.source.public.tree,
    'PARAMETERS_REVISION_MISMATCH',
    'PARAMETERS_TREE_MISMATCH',
  );
  requireThat(parametersCheckout.revision === gitlink, 'PARAMETERS_GITLINK_MISMATCH');

  async function verifyPinnedFile(descriptor, code = 'SOURCE_INPUT_BYTES_CHANGED') {
    const candidate = resolve(resolvedSourceRoot, descriptor.path);
    requireThat(inside(resolvedSourceRoot, candidate), 'EXTERNAL_SOURCE_PATH_REFUSED');
    const linkInfo = await lstat(candidate).catch(() => null);
    requireThat(linkInfo && !linkInfo.isSymbolicLink(), 'EXTERNAL_SOURCE_PATH_REFUSED');
    const resolvedFile = await realpath(candidate);
    requireThat(inside(resolvedSourceRoot, resolvedFile), 'EXTERNAL_SOURCE_PATH_REFUSED');
    const info = await stat(resolvedFile);
    requireThat(info.isFile() && info.size === descriptor.bytes, code);
    const bytes = await readFile(resolvedFile);
    requireThat(bytes.length === descriptor.bytes && hash(bytes) === descriptor.sha256, code);
    return { path: resolvedFile, bytes };
  }

  const verifiedInputs = {};
  for (const key of REQUIRED_SOURCE_INPUT_KEYS) {
    verifiedInputs[key] = await verifyPinnedFile(workOrder.sourceInputs[key]);
  }
  for (const descriptor of workOrder.sourceInputs.applicationInputs) {
    await verifyPinnedFile(descriptor);
  }
  for (const suite of Object.values(workOrder.qualificationSuites)) {
    if (suite !== undefined) await verifyPinnedFile(suite, 'QUALIFICATION_SUITE_BYTES_CHANGED');
  }

  const npmrcText = verifiedInputs.npmrc.bytes.toString('utf8');
  requireThat(!/(?:_auth|_authToken|password|username|\/\/[^\s]+=)/iu.test(npmrcText), 'NPMRC_CREDENTIAL_LEAK_REFUSED');

  const sourceManifest = JSON.parse(verifiedInputs.sourceManifest.bytes.toString('utf8'));
  if (workOrder.packageTests !== undefined) {
    requireThat(sourceManifest.scripts?.test === PACKAGE_TEST_SCRIPT &&
      sourceManifest.scripts.pretest === undefined && sourceManifest.scripts.posttest === undefined &&
      sourceManifest.devDependencies?.[PACKAGE_TEST_SUMMARY] === '0.14.18', 'PACKAGE_TEST_RECIPE_CHANGED');
    const tracked = (await git(resolvedSourceRoot, 'ls-files', '-z', '--', 'test')).split('\0')
      .filter(file => /^test\/[^/]+\.test\.mjs$/u.test(file)).sort();
    requireThat(equal(tracked, workOrder.packageTests.files.map(file => file.path)), 'PACKAGE_TEST_INVENTORY_CHANGED');
    for (const file of workOrder.packageTests.files) await verifyPinnedFile(file, 'PACKAGE_TEST_INPUT_CHANGED');
  }
  const declaredWrangler = sourceManifest.devDependencies?.wrangler ?? sourceManifest.dependencies?.wrangler;
  requireThat(declaredWrangler === workOrder.compiler.wrangler.version, 'COMPILER_SELECTION_UNRECEIVED');
  if (workOrder.compiler.pnpm !== undefined) {
    requireThat(sourceManifest.packageManager === `pnpm@${workOrder.compiler.pnpm.version}`, 'COMPILER_SELECTION_UNRECEIVED');
  }

  const parameterManifest = JSON.parse(verifiedInputs.parameterSourceManifest.bytes.toString('utf8'));
  requireThat(
    parameterManifest?.name === '@561-group/public-market-services-section' &&
      parameterManifest.repository?.url === 'https://github.com/causeway-services/public-market-services-section.git',
    'PARAMETERS_SOURCE_MANIFEST_UNRECEIVED',
  );

  const lockfileText = verifiedInputs.lockfile.bytes.toString('utf8');
  for (const supplier of workOrder.suppliers) {
    const header = `${supplier.name}@${supplier.version}`;
    const index = lockfileText.indexOf(header);
    requireThat(index !== -1, 'SUPPLIER_SRI_UNRECEIVED');
    const windowText = lockfileText.slice(index, index + 400);
    requireThat(windowText.includes(`integrity: ${supplier.integrity}`), 'SUPPLIER_SRI_UNRECEIVED');
  }

  return {
    sourceRoot: resolvedSourceRoot,
    parametersRoot: resolvedParametersRoot,
    marketCheckout,
    parametersCheckout,
  };
}

export async function checkoutMarketFabricationSources(destination, workOrder, {
  marketGitHubToken = process.env.MARKET_SOURCE_GITHUB_TOKEN ?? '',
  parametersGitHubToken = process.env.MARKET_PARAMETERS_GITHUB_TOKEN ?? '',
  marketRemoteUrl,
  parametersRemoteUrl,
  exec = defaultExec,
} = {}) {
  admitMarketFabricationWorkOrder(workOrder);
  requireThat(typeof marketGitHubToken === 'string' && marketGitHubToken.trim().length > 0, 'MARKET_SOURCE_GITHUB_TOKEN_REQUIRED');
  requireThat(typeof parametersGitHubToken === 'string' && parametersGitHubToken.trim().length > 0, 'PARAMETERS_GITHUB_TOKEN_REQUIRED');
  const root = resolve(destination);
  const sourceRoot = join(root, 'source');
  const parametersRoot = join(sourceRoot, 'parameters');
  await rm(sourceRoot, { recursive: true, force: true });

  await checkoutPinnedGitRepository(sourceRoot, {
    repository: MARKET_REPOSITORY,
    revision: workOrder.source.market.revision,
    tree: workOrder.source.market.tree,
    token: marketGitHubToken,
    remoteUrl: marketRemoteUrl,
    exec,
    revisionMismatchCode: 'MARKET_SOURCE_REVISION_MISMATCH',
    treeMismatchCode: 'MARKET_SOURCE_TREE_MISMATCH',
  });

  await rm(parametersRoot, { recursive: true, force: true });
  await checkoutPinnedGitRepository(parametersRoot, {
    repository: PARAMETERS_REPOSITORY,
    revision: workOrder.source.public.revision,
    tree: workOrder.source.public.tree,
    token: parametersGitHubToken,
    remoteUrl: parametersRemoteUrl,
    exec,
    revisionMismatchCode: 'PARAMETERS_REVISION_MISMATCH',
    treeMismatchCode: 'PARAMETERS_TREE_MISMATCH',
  });

  return verifyMarketFabricationInputs(sourceRoot, workOrder, { exec });
}

export async function installFrozenMarketSuppliers(sourceRoot, workOrder, {
  storeDir,
  cacheDir,
  pnpmCommand = 'corepack',
  exec = defaultExec,
} = {}) {
  admitMarketFabricationWorkOrder(workOrder);
  const resolvedSourceRoot = await realpath(sourceRoot);
  const resolvedStoreDir = resolve(storeDir ?? join(dirname(resolvedSourceRoot), 'pnpm-store'));
  const resolvedCacheDir = resolve(cacheDir ?? join(dirname(resolvedSourceRoot), 'pnpm-cache'));
  requireThat(
    !inside(resolvedSourceRoot, resolvedStoreDir) && !inside(resolvedSourceRoot, resolvedCacheDir),
    'SUPPLIER_STORE_INSIDE_SOURCE_REFUSED',
  );
  await mkdir(resolvedStoreDir, { recursive: true, mode: 0o700 });
  await mkdir(resolvedCacheDir, { recursive: true, mode: 0o700 });
  const expectedVersion = workOrder.compiler.pnpm?.version;
  requireThat(VERSION.test(expectedVersion ?? ''), 'PACKAGE_MANAGER_SELECTION_REQUIRED');
  const commandPrefix = [`pnpm@${expectedVersion}`];
  const executionOptions = {
    cwd: resolvedSourceRoot,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? tmpdir(),
      CI: 'true',
      NODE_USE_ENV_PROXY: '1',
    },
    timeout: 300_000,
    maxBuffer: 32 * 1024 * 1024,
  };
  const { stdout: versionOutput } = await exec(pnpmCommand, [...commandPrefix, '--version'], executionOptions);
  requireThat(String(versionOutput).trim() === expectedVersion, 'PACKAGE_MANAGER_VERSION_MISMATCH');
  const args = [
    ...commandPrefix,
    'install',
    '--frozen-lockfile',
    '--ignore-scripts',
    '--config.manage-package-manager-versions=false',
    `--store-dir=${resolvedStoreDir}`,
    `--cache-dir=${resolvedCacheDir}`,
  ];
  await exec(pnpmCommand, args, executionOptions);
  const received = await verifyInstalledMarketSuppliers(resolvedSourceRoot, workOrder);
  return {
    ...received,
    frozenInstallation: {
      kind: '561.market-frozen-installation/v1',
      source: { repository: MARKET_REPOSITORY, revision: workOrder.source.market.revision },
      lockfileSha256: workOrder.sourceInputs.lockfile.sha256,
      installedSuppliersSha256: hash(JSON.stringify(workOrder.suppliers)),
      nodeModulesRoot: join(resolvedSourceRoot, 'node_modules'),
      packageManager: { name: 'pnpm', version: expectedVersion },
      frozenLockfile: true,
      ignoreScripts: true,
    },
    compiler: {
      ...received.compiler,
      pnpm: { name: 'pnpm', version: expectedVersion, command: pnpmCommand, arguments: commandPrefix },
    },
  };
}

async function assertTreeInsideRoot(root, currentDirectory, visited = new Set()) {
  const resolvedDirectory = await realpath(currentDirectory);
  requireThat(inside(root, resolvedDirectory), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
  if (visited.has(resolvedDirectory)) return;
  visited.add(resolvedDirectory);
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentDirectory, entry.name);
    const resolvedEntry = await realpath(fullPath).catch(() => null);
    requireThat(resolvedEntry !== null && inside(root, resolvedEntry), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
    const info = await stat(resolvedEntry);
    if (info.isDirectory()) {
      await assertTreeInsideRoot(root, resolvedEntry, visited);
    }
  }
}

export async function verifyInstalledMarketSuppliers(sourceRoot, workOrder) {
  admitMarketFabricationWorkOrder(workOrder);
  const resolvedSourceRoot = await realpath(sourceRoot);
  const nodeModulesRoot = join(resolvedSourceRoot, 'node_modules');
  const nodeModulesInfo = await lstat(nodeModulesRoot).catch(() => null);
  requireThat(nodeModulesInfo && nodeModulesInfo.isDirectory() && !nodeModulesInfo.isSymbolicLink(), 'SUPPLIER_CLOSURE_MISSING');
  await assertTreeInsideRoot(resolvedSourceRoot, nodeModulesRoot);

  const localRequire = createRequire(join(resolvedSourceRoot, 'package.json'));
  let wranglerManifestPath;
  try {
    wranglerManifestPath = await realpath(localRequire.resolve('wrangler/package.json'));
  } catch {
    requireThat(false, 'COMPILER_SELECTION_UNRECEIVED');
  }
  requireThat(inside(resolvedSourceRoot, wranglerManifestPath), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
  const wranglerManifestBytes = await readFile(wranglerManifestPath);
  const wranglerManifest = JSON.parse(wranglerManifestBytes.toString('utf8'));
  requireThat(
    wranglerManifest.name === 'wrangler' && wranglerManifest.version === workOrder.compiler.wrangler.version,
    'COMPILER_SELECTION_UNRECEIVED',
  );

  const wranglerRequire = createRequire(wranglerManifestPath);
  const compilerIdentities = {
    wrangler: {
      name: 'wrangler',
      version: wranglerManifest.version,
      manifestSha256: hash(wranglerManifestBytes),
    },
  };
  for (const compilerName of ['esbuild', 'workerd']) {
    let compilerPkgPath;
    try {
      compilerPkgPath = await realpath(wranglerRequire.resolve(`${compilerName}/package.json`));
    } catch {
      requireThat(false, 'COMPILER_SELECTION_UNRECEIVED');
    }
    requireThat(inside(resolvedSourceRoot, compilerPkgPath), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
    const bytes = await readFile(compilerPkgPath);
    const pkg = JSON.parse(bytes.toString('utf8'));
    requireThat(
      pkg.name === compilerName &&
        pkg.version === workOrder.compiler[compilerName].version &&
        pkg.version === wranglerManifest.dependencies?.[compilerName],
      'COMPILER_SELECTION_UNRECEIVED',
    );
    compilerIdentities[compilerName] = {
      name: compilerName,
      version: pkg.version,
      manifestSha256: hash(bytes),
      manifestPath: compilerPkgPath,
    };
  }

  const verifiedSuppliers = [];
  for (const supplier of workOrder.suppliers) {
    const supplierCandidate = join(nodeModulesRoot, ...supplier.name.split('/'));
    const supplierRoot = await realpath(supplierCandidate).catch(() => null);
    requireThat(supplierRoot !== null && inside(resolvedSourceRoot, supplierRoot), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
    const manifestPath = await realpath(join(supplierRoot, 'package.json')).catch(() => null);
    requireThat(manifestPath !== null && inside(supplierRoot, manifestPath), 'SUPPLIER_MANIFEST_UNRECEIVED');
    const manifestBytes = await readFile(manifestPath);
    requireThat(
      manifestBytes.length === supplier.manifest.bytes && hash(manifestBytes) === supplier.manifest.sha256,
      'SUPPLIER_MANIFEST_UNRECEIVED',
    );
    const manifestJson = JSON.parse(manifestBytes.toString('utf8'));
    requireThat(manifestJson.name === supplier.name && manifestJson.version === supplier.version, 'SUPPLIER_VERSION_UNRECEIVED');

    for (const fileDescriptor of supplier.files) {
      const targetCandidate = resolve(supplierRoot, fileDescriptor.path);
      requireThat(inside(supplierRoot, targetCandidate), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
      const targetReal = await realpath(targetCandidate).catch(() => null);
      requireThat(targetReal !== null && inside(supplierRoot, targetReal), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
      const fileBytes = await readFile(targetReal);
      requireThat(
        fileBytes.length === fileDescriptor.bytes && hash(fileBytes) === fileDescriptor.sha256,
        'SUPPLIER_BYTES_UNRECEIVED',
      );
    }
    verifiedSuppliers.push({
      name: supplier.name,
      version: supplier.version,
      integrity: supplier.integrity,
      manifestSha256: supplier.manifest.sha256,
    });
  }

  return {
    sourceRoot: resolvedSourceRoot,
    compiler: compilerIdentities,
    suppliers: verifiedSuppliers,
  };
}

/** Receive the original owner's embedded bytes, not a public TAP interpretation.
 * The caller binds both interpreting functions to the exact private source and
 * locked installed supplier. No raw text or private path is returned here. */
export function receiveMarketPackageTestEvidence(qualification, request, {
  receiveResult, parseTestRunSummary, summaryOwner, compilerManifest,
}) {
  const selected = request.packageTests;
  requireThat(selected && equal(qualification.source, request.source) &&
    qualification.sourceRevision === request.source.revision &&
    qualification.workerSha256 === request.artifact.sha256 && qualification.workerBytes === request.artifact.bytes &&
    qualification.buildReceiptSha256 === request.buildReceipt.sha256 &&
    qualification.configurationSha256 === request.configuration.sha256, 'PACKAGE_TEST_QUALIFICATION_MISMATCH');
  const documents = qualification.evidenceDocuments;
  requireThat(Array.isArray(documents), 'PACKAGE_TEST_EVIDENCE_REQUIRED');
  const receiveDocument = (descriptor, expectedPath, maximum, empty = false) => {
    requireThat(descriptor?.path === expectedPath && SHA.test(descriptor.sha256 ?? '') &&
      Number.isSafeInteger(descriptor.bytes) && descriptor.bytes >= (empty ? 0 : 1) && descriptor.bytes <= maximum,
      'PACKAGE_TEST_EVIDENCE_REQUIRED');
    const matching = documents.filter(document => document?.path === expectedPath);
    requireThat(matching.length === 1, 'PACKAGE_TEST_EVIDENCE_REQUIRED');
    const document = matching[0];
    requireThat(typeof document.text === 'string' && document.bytes === descriptor.bytes &&
      document.sha256 === descriptor.sha256 && Buffer.byteLength(document.text) === descriptor.bytes &&
      hash(document.text) === descriptor.sha256, 'PACKAGE_TEST_EVIDENCE_BYTES_CHANGED');
    return document.text;
  };
  const descriptor = qualification.evidence?.packageTests;
  let observation;
  const text = receiveDocument(descriptor, 'package-tests-observations.json', 1024 * 1024);
  try { observation = JSON.parse(text); }
  catch { requireThat(false, 'PACKAGE_TEST_EVIDENCE_INVALID'); }
  requireThat(observation?.kind === '561.market-source-package-tests/v1' &&
    observation.scope === 'original-manifest-source-tests' && equal(observation.source, request.source) &&
    equal(observation.selection, selected) && observation.selectionSha256 === hash(JSON.stringify(selected)) &&
    equal(observation.frozenInstallation, request.frozenInstallation) &&
    observation.installedRoot === join(request.sourceRoot, 'node_modules') &&
    observation.nativeCompilerManifest === compilerManifest && equal(observation.summaryOwner, summaryOwner) &&
    equal(observation.command, {
      executable: process.execPath, nodeVersion: process.version,
      argv: ['--test', '--test-reporter=tap', ...selected.files.map(file => file.path)],
    }), 'PACKAGE_TEST_OBSERVATION_MISMATCH');
  requireThat(equal(observation.custody, {
    rawOutput: 'embedded-private-carrier', privateCarrierReceived: false,
    durableRetention: 'unreceived', authorizedRecipient: null,
  }) && observation.caseNameCompletenessIndependentlyReceived === false &&
    observation.productionDeploymentReceived === false && observation.outsidePaymentReceived === false,
    'PACKAGE_TEST_CUSTODY_UNRECEIVED');
  const snapshot = observation.selectedInputSnapshot;
  requireThat(snapshot?.kind === '561.market-native-selected-test-inputs/v1' &&
    snapshot.scope === 'compiler-selected-physical-inputs-and-manifests-plus-enrolled-tests-and-summary-compiler-owners' &&
    Number.isSafeInteger(snapshot.files) && snapshot.files > 0 && snapshot.files <= 16384 &&
    typeof snapshot.sha256 === 'string' && SHA.test(snapshot.sha256) && snapshot.unchanged === true &&
    equal(snapshot.limits, { files: 16384, bytes: 268435456 }) &&
    snapshot.everyDevelopmentImportReceived === false && snapshot.completeInstalledByteContinuityReceived === false &&
    snapshot.importerTopologyReceived === false && snapshot.mutationProofSandboxReceived === false,
    'PACKAGE_TEST_SNAPSHOT_UNRECEIVED');
  const stdout = receiveDocument(observation.stdout, 'package-tests.tap', 8 * 1024 * 1024);
  const stderr = receiveDocument(observation.stderr, 'package-tests.stderr.txt', 8 * 1024 * 1024, true);
  requireThat(typeof receiveResult === 'function' && typeof parseTestRunSummary === 'function',
    'PACKAGE_TEST_ORIGINAL_RESULT_OWNER_REQUIRED');
  const result = receiveResult({ ...observation.execution, stdout, stderr },
    parseTestRunSummary(stdout), selected.skipDisposition);
  for (const name of ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    requireThat(Number.isSafeInteger(result?.[name]) && result[name] >= 0 &&
      observation[name] === result[name], 'PACKAGE_TEST_COUNTS_MISMATCH');
  }
  requireThat(result.tests > 0 && result.pass > 0 && result.fail === 0 && result.cancelled === 0 &&
    result.tests === result.pass + result.skipped + result.todo &&
    result.skipped === selected.skipDisposition.skipped && result.todo === selected.skipDisposition.todo &&
    equal(result.skipDisposition, selected.skipDisposition) && equal(observation.skipDisposition, selected.skipDisposition) &&
    result.outcome === (result.skipped + result.todo === 0 ? 'passed' : 'completed-with-declared-skips') &&
    result.allCasesPassed === (result.skipped + result.todo === 0) &&
    observation.outcome === result.outcome && observation.allCasesPassed === result.allCasesPassed,
    'PACKAGE_TEST_COUNTS_MISMATCH');
  // Deliberate allowlist: no raw output, source paths, case names or free text.
  return {
    selectionSha256: observation.selectionSha256, evidenceSha256: descriptor.sha256,
    stdoutSha256: observation.stdout.sha256, stderrSha256: observation.stderr.sha256,
    tests: result.tests, suites: result.suites, pass: result.pass, fail: result.fail,
    cancelled: result.cancelled, skipped: result.skipped, todo: result.todo,
    outcome: result.outcome, allCasesPassed: result.allCasesPassed,
    selectedInputSnapshotSha256: snapshot.sha256,
    everyDevelopmentImportReceived: false, completeInstalledByteContinuityReceived: false,
    importerTopologyReceived: false, mutationProofSandboxReceived: false,
    caseNameCompletenessIndependentlyReceived: false, durableRetention: 'unreceived',
  };
}

export async function fabricateMarketCarrier(workOrder, {
  destination,
  workOrderSha256,
  operation = 'release',
  sourceRoot: suppliedSourceRoot,
  incumbentCarrierDirectory,
  incumbentDeclarationsBytes: suppliedIncumbentDeclarationsBytes,
  candidateDeclarationsBytes: suppliedCandidateDeclarationsBytes,
  installSuppliers = suppliedSourceRoot === undefined,
  retainWorkspace = false,
  marketGitHubToken = process.env.MARKET_SOURCE_GITHUB_TOKEN ?? '',
  parametersGitHubToken = process.env.MARKET_PARAMETERS_GITHUB_TOKEN ?? '',
  marketDeployKey,
  parametersDeployKey,
  marketRemoteUrl,
  parametersRemoteUrl,
  pnpmCommand,
  exec = defaultExec,
  buildWorker,
  receiveWorker,
  buildReceiver,
  now = () => new Date().toISOString(),
} = {}) {
  admitMarketFabricationWorkOrder(workOrder);
  requireThat(OPERATION.has(operation), 'MARKET_OPERATION_UNSELECTED');
  requireThat(workOrder.packageTests === undefined || installSuppliers === true, 'PACKAGE_TEST_FROZEN_INSTALLATION_REQUIRED');
  requireThat(typeof destination === 'string' && destination.trim().length > 0, 'FABRICATION_DESTINATION_REQUIRED');
  if (workOrderSha256 !== undefined) requireThat(SHA.test(workOrderSha256), 'FABRICATION_WORK_ORDER_DIGEST_REQUIRED');

  const root = resolve(destination);
  const workspaceRoot = join(root, 'workspace');
  const carrierDirectory = join(root, 'carrier');
  const receiptFile = join(root, 'fabrication-receipt.json');
  await rm(workspaceRoot, { recursive: true, force: true });
  await rm(carrierDirectory, { recursive: true, force: true });
  await rm(receiptFile, { force: true });
  await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });

  let workspaceDisposed = false;
  const originalEnv = {};
  for (const key of SOURCE_AUTH_ENV_KEYS) {
    if (Object.hasOwn(process.env, key)) {
      originalEnv[key] = process.env[key];
    }
  }

  try {
    if (marketGitHubToken) process.env.MARKET_SOURCE_GITHUB_TOKEN = marketGitHubToken;
    if (parametersGitHubToken) process.env.MARKET_PARAMETERS_GITHUB_TOKEN = parametersGitHubToken;

    const verifiedInputs = suppliedSourceRoot
      ? await verifyMarketFabricationInputs(suppliedSourceRoot, workOrder, { exec })
      : await checkoutMarketFabricationSources(workspaceRoot, workOrder, {
        marketGitHubToken,
        parametersGitHubToken,
        marketRemoteUrl,
        parametersRemoteUrl,
        exec,
      });
    const { sourceRoot } = verifiedInputs;

    // Source authentication must be consumed/isolated BEFORE original native producer,
    // receiver, qualification, compiler, install and test callbacks/children,
    // including IN-PROCESS environment access.
    for (const key of SOURCE_AUTH_ENV_KEYS) {
      delete process.env[key];
    }

    const supplierVerification = installSuppliers
      ? await installFrozenMarketSuppliers(sourceRoot, workOrder, {
        storeDir: join(workspaceRoot, 'pnpm-store'),
        cacheDir: join(workspaceRoot, 'pnpm-cache'),
        pnpmCommand,
        exec,
      })
      : await verifyInstalledMarketSuppliers(sourceRoot, workOrder);

    await verifyMarketFabricationInputs(sourceRoot, workOrder, { exec });

    const nativeWorkerOutputRoot = join(workspaceRoot, 'native-worker');
    const nativeReceivingOutputRoot = join(workspaceRoot, 'native-receiving');
    const nativeReceiverOutputRoot = join(workspaceRoot, 'native-receiver');

    const producerModulePath = join(sourceRoot, workOrder.sourceInputs.nativeProducer.path);
    const runBuildWorker = buildWorker ?? (async () => {
      const producerModule = await import(pathToFileURL(producerModulePath).href);
      const selectedRequest = await producerModule.selectNativeMarketBuildRequest({
        sourceRoot,
        outputRoot: nativeWorkerOutputRoot,
      });
      requireThat(
        selectedRequest.source?.repository === MARKET_REPOSITORY &&
          selectedRequest.source?.revision === workOrder.source.market.revision &&
          selectedRequest.sourceBindings?.parameters?.repository === PARAMETERS_REPOSITORY &&
          selectedRequest.sourceBindings?.parameters?.revision === workOrder.source.public.revision &&
          selectedRequest.sourceBindings?.parameters?.gitlink === workOrder.source.public.gitlink &&
          selectedRequest.sourceSelection?.applicationTree === workOrder.source.market.tree &&
          selectedRequest.sourceSelection?.parametersTree === workOrder.source.public.tree &&
          selectedRequest.sourceManifestSha256 === workOrder.sourceInputs.sourceManifest.sha256 &&
          selectedRequest.lockfileSha256 === workOrder.sourceInputs.lockfile.sha256 &&
          selectedRequest.configurationSha256 === workOrder.sourceInputs.configuration.sha256,
        'NATIVE_BUILD_REQUEST_MISMATCH',
      );
      return producerModule.buildNativeMarketWorker(selectedRequest);
    });

    await runBuildWorker({
      sourceRoot,
      outputRoot: nativeWorkerOutputRoot,
      workOrder,
    });

    const buildOutputEntries = await readdir(nativeWorkerOutputRoot);
    requireThat(buildOutputEntries.every(name => ADMITTED_BUILD_OUTPUT_NAMES.has(name)), 'UNDECLARED_BUILD_OUTPUT_REFUSED');

    const buildReceiptPath = join(nativeWorkerOutputRoot, 'build-receipt.json');
    const buildReceiptBytes = await readFile(buildReceiptPath);
    const parsedBuildReceipt = JSON.parse(buildReceiptBytes.toString('utf8'));
    requireThat(
      parsedBuildReceipt?.kind === 'native-market-worker-build' &&
        parsedBuildReceipt.source?.repository === MARKET_REPOSITORY &&
        parsedBuildReceipt.source?.revision === workOrder.source.market.revision &&
        parsedBuildReceipt.deploymentBindings?.MARKET_BUILD_SHA === workOrder.source.market.revision &&
        parsedBuildReceipt.sourceBindings?.parameters?.repository === PARAMETERS_REPOSITORY &&
        parsedBuildReceipt.sourceBindings?.parameters?.revision === workOrder.source.public.revision &&
        parsedBuildReceipt.sourceBindings?.parameters?.gitlink === workOrder.source.public.gitlink &&
        parsedBuildReceipt.predecessorClosureReplayed === false &&
        parsedBuildReceipt.nativeMetadataComplete === true,
      'ORIGINAL_WORKER_BUILD_UNRECEIVED',
    );

    const workerFileName = basename(parsedBuildReceipt.output ?? 'worker.js');
    requireThat(['worker.js', 'worker.mjs'].includes(workerFileName), 'UNDECLARED_BUILD_OUTPUT_REFUSED');
    const workerPath = join(nativeWorkerOutputRoot, workerFileName);
    const workerBytes = await readFile(workerPath);
    requireThat(workerBytes.length === parsedBuildReceipt.bytes && hash(workerBytes) === parsedBuildReceipt.sha256, 'WORKER_BYTES_CHANGED');

    const sourceInputsBytes = await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.sourceInputs.path));
    requireThat(
      sourceInputsBytes.length === parsedBuildReceipt.sourceInputs.bytes &&
        hash(sourceInputsBytes) === parsedBuildReceipt.sourceInputs.sha256,
      'NATIVE_PROVENANCE_BYTES_UNRECEIVED',
    );
    const sourceInputsList = JSON.parse(sourceInputsBytes.toString('utf8'));
    requireThat(Array.isArray(sourceInputsList) && sourceInputsList.length === parsedBuildReceipt.inputs, 'NATIVE_PROVENANCE_BYTES_UNRECEIVED');
    for (const inputRow of sourceInputsList) {
      if (inputRow.kind === 'physical') {
        requireThat(
          typeof inputRow.source === 'string' && isAbsolute(inputRow.source) && inside(sourceRoot, inputRow.source),
          'EXTERNAL_SUPPLIER_PATH_REFUSED',
        );
        const resolvedInput = await realpath(inputRow.source).catch(() => null);
        requireThat(resolvedInput === inputRow.source && inside(sourceRoot, resolvedInput), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
      }
    }

    const packageManifestsBytes = await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.packageManifests.path));
    requireThat(
      packageManifestsBytes.length === parsedBuildReceipt.packageManifests.bytes &&
        hash(packageManifestsBytes) === parsedBuildReceipt.packageManifests.sha256,
      'NATIVE_PROVENANCE_BYTES_UNRECEIVED',
    );
    const packageManifestsList = JSON.parse(packageManifestsBytes.toString('utf8'));
    requireThat(Array.isArray(packageManifestsList) && packageManifestsList.length > 0, 'NATIVE_PROVENANCE_BYTES_UNRECEIVED');
    for (const manifestRow of packageManifestsList) {
      requireThat(
        typeof manifestRow?.path === 'string' && isAbsolute(manifestRow.path) && inside(sourceRoot, manifestRow.path),
        'EXTERNAL_SUPPLIER_PATH_REFUSED',
      );
      const resolvedManifest = await realpath(manifestRow.path).catch(() => null);
      requireThat(resolvedManifest === manifestRow.path && inside(sourceRoot, resolvedManifest), 'EXTERNAL_SUPPLIER_PATH_REFUSED');
    }

    const receivingRequest = {
      source: {
        repository: MARKET_REPOSITORY,
        revision: workOrder.source.market.revision,
      },
      sourceRoot,
      outputRoot: nativeReceivingOutputRoot,
      artifact: {
        path: workerPath,
        bytes: workerBytes.length,
        sha256: hash(workerBytes),
      },
      buildReceipt: {
        path: buildReceiptPath,
        bytes: buildReceiptBytes.length,
        sha256: hash(buildReceiptBytes),
      },
      configuration: {
        path: join(nativeWorkerOutputRoot, parsedBuildReceipt.configuration.path),
        bytes: parsedBuildReceipt.configuration.bytes,
        sha256: parsedBuildReceipt.configuration.sha256,
      },
      sourceSuiteSha256: workOrder.qualificationSuites.sourceSuite.sha256,
      ...(workOrder.qualificationSuites.sourceCellSuite
        ? { sourceCellSuiteSha256: workOrder.qualificationSuites.sourceCellSuite.sha256 }
        : {}),
      ...(workOrder.qualificationSuites.workspaceGraphSuite
        ? { workspaceGraphSuiteSha256: workOrder.qualificationSuites.workspaceGraphSuite.sha256 }
        : {}),
      ...(workOrder.packageTests !== undefined ? {
        packageTests: structuredClone(workOrder.packageTests),
        frozenInstallation: structuredClone(supplierVerification.frozenInstallation),
      } : {}),
      timeoutMs: workOrder.timeoutMs ?? 180_000,
    };

    const receiverModulePath = join(sourceRoot, workOrder.sourceInputs.nativeReceiver.path);
    const runReceiveWorker = receiveWorker ?? (async request => {
      const receiverModule = await import(pathToFileURL(receiverModulePath).href);
      return receiverModule.receiveNativeMarketWorker(request);
    });
    // Keep the selected expectation independent of the invoked receiver's
    // request object, so it cannot narrow enrollment in the receiving comparison.
    await runReceiveWorker(structuredClone(receivingRequest));

    const qualificationPath = join(nativeReceivingOutputRoot, 'native-qualification.json');
    const qualificationBytes = await readFile(qualificationPath);
    const parsedQualification = JSON.parse(qualificationBytes.toString('utf8'));
    requireThat(
      parsedQualification?.kind === '561.market-worker-native-qualification/v1' &&
        parsedQualification.sourceRevision === workOrder.source.market.revision &&
        parsedQualification.workerSha256 === parsedBuildReceipt.sha256 &&
        parsedQualification.outsidePaymentReceived === false &&
        parsedQualification.artifactInternalComputationInstrumented === false &&
        Object.values(parsedQualification.checks ?? {}).every(item => item?.passed === true),
      'NATIVE_WORKER_RECEIVING_REQUIRED',
    );

    let packageTestReceiving;
    if (workOrder.packageTests !== undefined) {
      requireThat(parsedQualification.evidence?.packageTests, 'PACKAGE_TEST_EVIDENCE_REQUIRED');
      // Re-receive the exact native result owner before importing it. The
      // original receiver owns pre/post execution; source movement is refused.
      await verifyMarketFabricationInputs(sourceRoot, workOrder, { exec });
      const localRequire = createRequire(join(sourceRoot, 'package.json'));
      const modulesRoot = join(sourceRoot, 'node_modules');
      const summaryPath = await realpath(localRequire.resolve(`${PACKAGE_TEST_SUMMARY}/test-run-summary`));
      const summaryManifestPath = await realpath(localRequire.resolve(`${PACKAGE_TEST_SUMMARY}/package.json`));
      requireThat(inside(modulesRoot, summaryPath) && inside(modulesRoot, summaryManifestPath),
        'PACKAGE_TEST_SUMMARY_OWNER_UNRECEIVED');
      const summaryManifest = JSON.parse(await readFile(summaryManifestPath, 'utf8'));
      requireThat(summaryManifest.name === PACKAGE_TEST_SUMMARY && summaryManifest.version === '0.14.18',
        'PACKAGE_TEST_SUMMARY_OWNER_UNRECEIVED');
      const summaryOwner = fileIdentity(summaryPath, await readFile(summaryPath));
      const nativeReceiver = await import(pathToFileURL(receiverModulePath).href);
      const { parseTestRunSummary } = await import(pathToFileURL(summaryPath).href);
      packageTestReceiving = receiveMarketPackageTestEvidence(parsedQualification, receivingRequest, {
        receiveResult: nativeReceiver.receiveNativeMarketPackageTestResult, parseTestRunSummary,
        summaryOwner, compilerManifest: supplierVerification.compiler.esbuild.manifestPath,
      });
    }

    const receiverSourceRevision = (workOrder.source.receiver ?? workOrder.source.market).revision;
    const receiverBuilderModulePath = join(sourceRoot, workOrder.sourceInputs.receiverBuilder.path);
    const runBuildReceiver = buildReceiver ?? (async request => {
      const builderModule = await import(pathToFileURL(receiverBuilderModulePath).href);
      return builderModule.buildMarketWorkerReleaseReceiver(request);
    });
    await runBuildReceiver({
      sourceRevision: receiverSourceRevision,
      cloudflareRevision: workOrder.source.cloudflare.revision,
      compilerManifest: supplierVerification.compiler.esbuild.manifestPath,
      outputRoot: nativeReceiverOutputRoot,
    });

    const receiverPath = join(nativeReceiverOutputRoot, 'receiver.cjs');
    const receiverBytes = await readFile(receiverPath);
    const receiverInputsPath = join(nativeReceiverOutputRoot, 'receiver-inputs.json');
    const receiverInputsBytes = await readFile(receiverInputsPath);
    const parsedReceiverInputs = JSON.parse(receiverInputsBytes.toString('utf8'));
    requireThat(
      parsedReceiverInputs?.kind === '561.market-worker-receiver-build/v1' &&
        parsedReceiverInputs.source?.repository === MARKET_REPOSITORY &&
        parsedReceiverInputs.source?.revision === receiverSourceRevision &&
        parsedReceiverInputs.cloudflare?.repository === CLOUDFLARE_REPOSITORY &&
        parsedReceiverInputs.cloudflare?.revision === workOrder.source.cloudflare.revision &&
        parsedReceiverInputs.output?.bytes === receiverBytes.length &&
        parsedReceiverInputs.output?.sha256 === hash(receiverBytes),
      'ORIGINAL_RECEIVER_BUILD_UNRECEIVED',
    );

    let candidateDeclarationsBytes = suppliedCandidateDeclarationsBytes;
    if (!candidateDeclarationsBytes) {
      const compiledOffersPath = join(sourceRoot, workOrder.sourceInputs.compiledOffers.path);
      const { COMPILED_DECLARATIONS } = await import(`${pathToFileURL(compiledOffersPath).href}?sha256=${workOrder.sourceInputs.compiledOffers.sha256}`);
      requireThat(Array.isArray(COMPILED_DECLARATIONS), 'ORIGINAL_COMPILER_DECLARATIONS_REQUIRED');
      const edgeDeclarations = COMPILED_DECLARATIONS.filter(row => row.runtime !== 'node');
      candidateDeclarationsBytes = Buffer.from(`${JSON.stringify(edgeDeclarations, null, 2)}\n`);
    }
    requireThat(
      candidateDeclarationsBytes.length === workOrder.declarations.candidate.bytes &&
        hash(candidateDeclarationsBytes) === workOrder.declarations.candidate.sha256,
      'CANDIDATE_DECLARATIONS_BYTES_CHANGED',
    );

    let incumbentDeclarationsBytes = suppliedIncumbentDeclarationsBytes;
    if (!incumbentDeclarationsBytes && incumbentCarrierDirectory) {
      const artifactKey = workOrder.incumbentCarrier?.incumbentDeclarationsArtifact ?? 'candidateDeclarations';
      const incumbentManifestBytes = await readFile(join(incumbentCarrierDirectory, 'manifest.json'));
      if (workOrder.incumbentCarrier?.manifestSha256) {
        requireThat(hash(incumbentManifestBytes) === workOrder.incumbentCarrier.manifestSha256, 'INCUMBENT_CARRIER_MANIFEST_CHANGED');
      }
      const incumbentManifest = JSON.parse(incumbentManifestBytes.toString('utf8'));
      const descriptor = incumbentManifest?.artifacts?.[artifactKey];
      requireThat(descriptor && safeRelativePath(descriptor.path), 'INCUMBENT_DECLARATIONS_MISSING');
      const rawPath = join(incumbentCarrierDirectory, descriptor.path);
      const gzPath = `${rawPath}.gz`;
      try {
        incumbentDeclarationsBytes = await readFile(rawPath);
      } catch {
        incumbentDeclarationsBytes = gunzipSync(await readFile(gzPath), { maxOutputLength: descriptor.bytes });
      }
    }
    if (!incumbentDeclarationsBytes &&
        workOrder.declarations.incumbent.sha256 === workOrder.declarations.candidate.sha256 &&
        workOrder.declarations.incumbent.bytes === workOrder.declarations.candidate.bytes) {
      incumbentDeclarationsBytes = candidateDeclarationsBytes;
    }
    requireThat(
      incumbentDeclarationsBytes instanceof Uint8Array &&
        incumbentDeclarationsBytes.length === workOrder.declarations.incumbent.bytes &&
        hash(incumbentDeclarationsBytes) === workOrder.declarations.incumbent.sha256,
      'INCUMBENT_DECLARATIONS_BYTES_CHANGED',
    );

    await mkdir(carrierDirectory, { recursive: true, mode: 0o700 });
    const nativeArtifactFiles = [
      ['worker', workerFileName, workerBytes],
      ['buildReceipt', 'build-receipt.json', buildReceiptBytes],
      ['sourceInputs', parsedBuildReceipt.sourceInputs.path, sourceInputsBytes],
      ['packageManifests', parsedBuildReceipt.packageManifests.path, packageManifestsBytes],
      ['sourceManifest', parsedBuildReceipt.sourceManifest.path, await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.sourceManifest.path))],
      ['lockfile', parsedBuildReceipt.lockfile.path, await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.lockfile.path))],
      ['configuration', parsedBuildReceipt.configuration.path, await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.configuration.path))],
      ['metafile', parsedBuildReceipt.metafile.path, await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.metafile.path))],
      ['sourceMap', parsedBuildReceipt.sourceMap.path, await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.sourceMap.path))],
      ['parameterSourceManifest', parsedBuildReceipt.parameterSourceManifest.path, await readFile(join(nativeWorkerOutputRoot, parsedBuildReceipt.parameterSourceManifest.path))],
      ['candidateDeclarations', workOrder.declarations.candidate.path, candidateDeclarationsBytes],
      ['incumbentDeclarations', workOrder.declarations.incumbent.path, incumbentDeclarationsBytes],
      ['nativeQualification', 'native-qualification.json', qualificationBytes],
      ['receiver', 'receiver.cjs', receiverBytes],
      ['receiverInputs', 'receiver-inputs.json', receiverInputsBytes],
    ];

    const artifacts = {};
    for (const [artifactKey, fileName, bytes] of nativeArtifactFiles) {
      requireThat(safeRelativePath(fileName) && !fileName.includes('/'), 'INVALID_CARRIER_ARTIFACT_PATH');
      await writeFile(join(carrierDirectory, fileName), bytes, { mode: 0o600, flag: 'wx' });
      artifacts[artifactKey] = fileIdentity(fileName, bytes);
    }

    const manifest = {
      kind: '561.market-worker-release/v1',
      target: structuredClone(workOrder.target),
      source: {
        market: {
          repository: workOrder.source.market.repository,
          revision: workOrder.source.market.revision,
        },
        public: {
          repository: workOrder.source.public.repository,
          revision: workOrder.source.public.revision,
        },
        cloudflare: {
          repository: workOrder.source.cloudflare.repository,
          revision: workOrder.source.cloudflare.revision,
        },
        ...(workOrder.source.receiver ? { receiver: structuredClone(workOrder.source.receiver) } : {}),
      },
      ...(workOrder.candidateCatalogPresentation
        ? { candidateCatalogPresentation: workOrder.candidateCatalogPresentation }
        : {}),
      baseline: structuredClone(workOrder.baseline),
      payment: structuredClone(workOrder.payment),
      artifacts,
    };

    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(carrierDirectory, 'manifest.json'), manifestBytes, { mode: 0o600, flag: 'wx' });
    const manifestSha256 = hash(manifestBytes);
    await verifyMarketCarrier(carrierDirectory, manifestSha256);

    if (!retainWorkspace) {
      await rm(workspaceRoot, { recursive: true, force: true });
      workspaceDisposed = true;
    }

    const fabricationReceipt = {
      kind: '561.market-worker-native-fabrication/v1',
      at: now(),
      operation,
      workOrderSha256: workOrderSha256 ?? null,
      incumbentManifestSha256: workOrder.incumbentCarrier?.manifestSha256 ?? null,
      manifestSha256,
      source: manifest.source,
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      compiler: supplierVerification.compiler,
      suppliers: supplierVerification.suppliers,
      inputs: {
        total: parsedBuildReceipt.inputs,
        physical: parsedBuildReceipt.physicalInputs,
        generated: parsedBuildReceipt.generatedInputs,
      },
      artifacts: {
        worker: artifacts.worker,
        buildReceipt: artifacts.buildReceipt,
        nativeQualification: artifacts.nativeQualification,
        receiver: artifacts.receiver,
      },
      workspaceDisposed,
      providerAccess: false,
      outsidePaymentReceived: false,
      ...(packageTestReceiving ? { packageTests: {
        ...packageTestReceiving, privateCarrierReceived: true,
      } } : {}),
    };
    await writeFile(receiptFile, `${JSON.stringify(fabricationReceipt, null, 2)}\n`, { mode: 0o600 });

    return {
      carrierDirectory,
      manifest,
      manifestSha256,
      fabricationReceipt,
      receiptFile,
    };
  } finally {
    for (const key of SOURCE_AUTH_ENV_KEYS) {
      if (Object.hasOwn(originalEnv, key)) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }

    if (!retainWorkspace && !workspaceDisposed) {
      await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function verifySelectedManifestOrFabricationReceipt(selected, carrierRoot, expectedManifestSha256, command) {
  if (selected.manifestSha256 === expectedManifestSha256 && !selected.workOrderSha256) return;
  if (selected.workOrderSha256) {
    const receiptPath = resolve(dirname(carrierRoot), 'fabrication-receipt.json');
    let receipt;
    try {
      receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    } catch {
      requireThat(false, 'The original Group selection must name this exact Market operation and manifest', 'FABRICATION_RECEIPT_REQUIRED');
    }
    requireThat(
      receipt?.kind === '561.market-worker-native-fabrication/v1' &&
        receipt.workOrderSha256 === selected.workOrderSha256 &&
        receipt.incumbentManifestSha256 === selected.manifestSha256 &&
        receipt.manifestSha256 === expectedManifestSha256 &&
        receipt.operation === command &&
        receipt.workspaceDisposed === true,
      'The original Group selection must name this exact Market operation and manifest',
      'FABRICATION_RECEIPT_UNRECEIVED',
    );
    return;
  }
  requireThat(false, 'The original Group selection must name this exact Market operation and manifest', 'WORKFLOW_MANIFEST_MISMATCH');
}

if (import.meta.main) {
  try {
  const [command, directory, expectedManifestSha256, ...extra] = process.argv.slice(2);
  if (command === 'select') {
    requireThat(directory === undefined && !extra.length, 'Selection is read only from reviewed Group main');
    const selected = await selectMarketCarrier();
    if (process.env.GITHUB_OUTPUT) {
      const outputs = [`ready=${selected.ready}`];
      if (selected.ready) {
        outputs.push(
          `revision=${selected.revision}`,
          `directory=${selected.directory}`,
          `manifest=${selected.manifestSha256}`,
          `operation=${selected.operation}`,
          `mode=${selected.workOrderSha256 ? 'fabricate' : 'carrier'}`,
        );
        if (selected.workOrderSha256) {
          outputs.push(`work_order=${selected.workOrder}`, `work_order_sha256=${selected.workOrderSha256}`);
        }
      }
      await appendFile(process.env.GITHUB_OUTPUT, `${outputs.join('\n')}\n`);
    }
    console.log(JSON.stringify({
      ready: selected.ready,
      ...(selected.ready ? {
        mode: selected.workOrderSha256 ? 'fabricate' : 'carrier',
        operation: selected.operation,
        ...(selected.workOrderSha256 ? { workOrder: selected.workOrder, workOrderSha256: selected.workOrderSha256 } : {}),
      } : {}),
      reason: selected.ready
        ? (selected.workOrderSha256
          ? 'Exact original Market native fabrication work order and incumbent carrier selected'
          : 'Exact original Market carrier selected')
        : 'No received Market artifact selected; no provider access',
    }));
  } else if (command === 'receive') {
    requireThat(
      extra.length <= 1,
      'Use receive with the selected carrier directory, manifest digest and optional work-order digest',
    );
    const received = await receiveMarketCarrier(directory, expectedManifestSha256);
    const expectedWorkOrderSha256 = extra[0] || process.env.RELEASE_WORK_ORDER || '';
    if (expectedWorkOrderSha256) {
      const selected = await selectMarketCarrier();
      requireThat(
        selected.ready && selected.manifestSha256 === expectedManifestSha256 &&
          selected.workOrderSha256 === expectedWorkOrderSha256,
        'The original Group selection must name this exact Market carrier and fabrication work order',
        'WORKFLOW_WORK_ORDER_MISMATCH',
      );
      const workOrderFile = await resolveSelectionWorkOrderPath('.releases/market/selection.json', selected.workOrder);
      const { workOrder } = await readMarketFabricationWorkOrder(workOrderFile, selected.workOrderSha256);
      const fabricationRoot = resolve(process.env.RUNNER_TEMP ?? tmpdir(), 'market-fabricated-carrier');
      const fabricated = await fabricateMarketCarrier(workOrder, {
        destination: fabricationRoot,
        workOrderSha256: selected.workOrderSha256,
        operation: selected.operation,
        incumbentCarrierDirectory: received.root,
      });
      if (process.env.GITHUB_OUTPUT) {
        await appendFile(
          process.env.GITHUB_OUTPUT,
          `directory=${fabricated.carrierDirectory}\nmanifest=${fabricated.manifestSha256}\n`,
        );
      }
      console.log(JSON.stringify({
        received: true,
        mode: 'fabricate',
        restoredArtifacts: received.restoredArtifacts,
        carrierDirectory: fabricated.carrierDirectory,
        manifestSha256: fabricated.manifestSha256,
        workOrderSha256: selected.workOrderSha256,
        workspaceDisposed: fabricated.fabricationReceipt.workspaceDisposed,
        providerAccess: false,
      }));
    } else {
      if (process.env.GITHUB_OUTPUT) {
        await appendFile(process.env.GITHUB_OUTPUT, `directory=${received.root}\nmanifest=${expectedManifestSha256}\n`);
      }
      console.log(JSON.stringify({ received: true, restoredArtifacts: received.restoredArtifacts, providerAccess: false }));
    }
  } else {
    requireThat(
      ['verify', 'release', 'observe'].includes(command) &&
        (command === 'verify' ? extra.length <= 1 && ['release', 'observe'].includes(extra[0] ?? 'release') : !extra.length),
      'Use select, receive, verify with its operation, or the selected release/observe operation',
    );
    const received = await verifyMarketCarrier(directory, expectedManifestSha256);
    if (command === 'verify') {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !key.startsWith('CLOUDFLARE_') &&
            !SOURCE_AUTH_ENV_KEYS.includes(key),
        ),
      );
      execFileSync(
        process.execPath,
        [received.receiver, '--verify', received.root, expectedManifestSha256, extra[0] ?? 'release'],
        { env, stdio: 'pipe', timeout: 120_000 },
      );
    } else {
      requireThat(
        process.env.GITHUB_REPOSITORY === 'red-cup-engineering/561.group' &&
          process.env.GITHUB_REF === 'refs/heads/main' &&
          ['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME) &&
          COMMIT.test(process.env.GITHUB_SHA ?? '') &&
          process.env.RUNNER_TEMP,
        'Only the original reviewed Group main credential lane may run this effect',
      );
      const revision = execFileSync(
        'git',
        ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', 'rev-parse', 'HEAD'],
        { encoding: 'utf8', maxBuffer: 4096 },
      ).trim();
      requireThat(revision === process.env.GITHUB_SHA, 'Carrier checkout is not the selected Group edition');
      const selected = await selectMarketCarrier();
      requireThat(
        selected.ready && selected.operation === command,
        'The original Group selection must name this exact Market operation and manifest',
      );
      await verifySelectedManifestOrFabricationReceipt(selected, received.root, expectedManifestSha256, command);
      execFileSync(
        process.execPath,
        [
          received.receiver,
          ...(command === 'observe' ? ['--observe'] : []),
          received.root,
          expectedManifestSha256,
          resolve(process.env.RUNNER_TEMP, 'market-release/receipt.json'),
          revision,
        ],
        { stdio: 'pipe', timeout: 18 * 60_000 },
      );
    }
  }
  } catch (error) {
    // Private child diagnostics never become public Actions logs or receipts.
    try {
      const directory = resolve(process.env.RUNNER_TEMP ?? tmpdir(), 'market-private-diagnostics');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const info = await lstat(directory);
      requireThat(info.isDirectory() && !info.isSymbolicLink() &&
        (info.mode & 0o777) === 0o700 && info.uid === process.getuid(), 'PRIVATE_DIAGNOSTIC_CUSTODY_REQUIRED');
      const diagnostic = Buffer.from([error?.stack, error?.stdout, error?.stderr].map(value =>
        typeof value === 'string' || Buffer.isBuffer(value) ? String(value) : '').join('\n'));
      await writeFile(join(directory, 'failure.log'), diagnostic.subarray(0, 65536), { mode: 0o600, flag: 'wx' });
    } catch { /* Public failure remains sanitized even if private custody fails. */ }
    console.error('MARKET_OPERATION_FAILED');
    process.exitCode = 1;
  }
}
