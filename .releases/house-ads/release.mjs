import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const releaseRoot = fileURLToPath(new URL('.', import.meta.url));
const release = JSON.parse(readFileSync(new URL('./release.json', import.meta.url), 'utf8'));
const host = resolve('house-ads');
const work = resolve(process.env.RUNNER_TEMP ?? '.', 'house-ads-release');
const supplier = '@red-cup-engineering/web-advertising-system-engineering-services-section';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (name, value) => writeFileSync(resolve(work, name), JSON.stringify(value, null, 2) + '\n');
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
mkdirSync(work, {recursive:true});

function verifyArchive() {
  const encoded = readFileSync(resolve(releaseRoot, 'advertising-0.3.0-dev.2.tgz.base64'), 'ascii').trim();
  const archive = Buffer.from(encoded, 'base64');
  assert.equal(archive.toString('base64'), encoded, 'Advertising carrier is not canonical base64');
  assert.equal(digest(archive), release.advertisingArchiveSha256, 'Advertising archive changed');
  assert.equal('sha512-' + createHash('sha512').update(archive).digest('base64'), release.advertisingArchiveIntegrity);
  const lockBytes = readFileSync(resolve(releaseRoot, 'package-lock.json'));
  assert.equal(digest(lockBytes), release.lockSha256, 'Dependency lock changed');
  const lock = JSON.parse(lockBytes);
  assert.equal(lock.packages[''].dependencies[supplier], release.advertisingVersion);
  assert.equal(lock.packages['node_modules/' + supplier].integrity, release.advertisingArchiveIntegrity);
  assert.equal(lock.packages['node_modules/' + supplier].resolved, 'file:release-artifacts/advertising-0.3.0-dev.2.tgz');
  assert.equal(lock.packages['node_modules/wrangler'].version, release.wranglerVersion);
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!name || name === 'node_modules/' + supplier) continue;
    const url = new URL(entry.resolved);
    assert.ok(url.protocol === 'https:' && !url.username && !url.password &&
      ['registry.561.group', 'registry.npmjs.org'].includes(url.hostname), 'Unrecognized supplier: ' + name);
    assert.match(entry.integrity, /^sha512-/u, 'Missing immutable supplier integrity: ' + name);
  }
  return archive;
}

async function provider(path) {
  assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID, release.target.accountId, 'Wrong Cloudflare account');
  assert.ok(process.env.CLOUDFLARE_API_TOKEN, 'Missing existing release credential');
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + release.target.accountId +
    '/workers/scripts/' + release.target.worker + path, {
    headers: {authorization:'Bearer ' + process.env.CLOUDFLARE_API_TOKEN, accept:'application/json'},
    redirect:'error', signal:AbortSignal.timeout(15000),
  });
  assert.ok(response.ok, 'Cloudflare read returned HTTP ' + response.status);
  const value = await response.json();
  assert.equal(value.success, true, 'Cloudflare did not accept the read');
  return value.result;
}

async function currentDeployment() {
  const result = await provider('/deployments');
  const latest = result.deployments?.[0];
  assert.match(latest?.id ?? '', uuid, 'No current deployment');
  assert.equal(latest.versions?.length, 1, 'Current Worker has split traffic');
  assert.equal(latest.versions[0].percentage, 100);
  assert.match(latest.versions[0].version_id, uuid);
  return {deploymentId:latest.id, versionId:latest.versions[0].version_id, createdOn:latest.created_on};
}

function receiveBindings(settings, {allowMissingAnalytics = false} = {}) {
  const bindings = settings.bindings ?? [];
  const kv = bindings.find(binding => binding.name === release.target.kvBinding);
  assert.equal(kv?.type, 'kv_namespace', 'Existing paid-receipt KV binding missing');
  assert.equal(kv.namespace_id, release.target.kvNamespace, 'Existing paid-receipt namespace differs');
  const analytics = bindings.find(binding => binding.name === release.target.analyticsBinding);
  if (!release.target.analyticsEnabled) {
    assert.equal(analytics, undefined, 'Release selects unbound analytics');
  } else if (analytics) {
    assert.equal(analytics.type, 'analytics_engine');
    assert.equal(analytics.dataset, release.target.analyticsDataset);
  } else {
    assert.ok(allowMissingAnalytics, 'Selected aggregate analytics binding missing');
  }
  assert.ok(bindings.every(binding =>
    [release.target.kvBinding, release.target.analyticsBinding].includes(binding.name) ||
    ['secret_text', 'plain_text', 'json'].includes(binding.type)), 'Unrepresented stateful binding');
  return {kvNamespace:kv.namespace_id, analyticsDataset:analytics?.dataset ?? null};
}

const mode = process.argv[2];
if (mode === 'prepare') {
  const archive = verifyArchive();
  assert.equal(process.versions.node, release.nodeVersion);
  assert.equal(execFileSync('git', ['rev-parse','HEAD'], {cwd:host, encoding:'utf8'}).trim(), release.hostCommit);
  const manifest = json(resolve(host, 'package.json'));
  assert.equal(manifest.dependencies[supplier], release.advertisingVersion);
  assert.equal(manifest.dependencies.wrangler, release.wranglerVersion);
  assert.equal(manifest.scripts.deploy, 'wrangler deploy');
  const config = json(resolve(host, 'wrangler.jsonc'));
  assert.equal(config.name, release.target.worker);
  assert.deepEqual(config.routes, [{pattern:new URL(release.target.origin).hostname, custom_domain:true}]);
  assert.deepEqual(config.kv_namespaces, [{binding:release.target.kvBinding, id:release.target.kvNamespace}]);
  assert.equal(typeof release.target.analyticsEnabled, 'boolean');
  assert.deepEqual(config.analytics_engine_datasets ?? [], release.target.analyticsEnabled
    ? [{binding:release.target.analyticsBinding, dataset:release.target.analyticsDataset}] : []);
  mkdirSync(resolve(host, 'release-artifacts'), {recursive:true});
  writeFileSync(resolve(host, 'release-artifacts/advertising-0.3.0-dev.2.tgz'), archive);
  copyFileSync(resolve(releaseRoot, 'package-lock.json'), resolve(host, 'package-lock.json'));
  console.log('Prepared original ads host ' + release.hostCommit + ' and source-built advertising ' + release.advertisingVersion);
} else if (mode === 'built') {
  const bytes = readFileSync(resolve(work, 'worker/index.js'));
  assert.equal(bytes.length, release.workerBytes);
  assert.equal(digest(bytes), release.workerSha256, 'Worker differs from qualified original release');
  const site = (await import(resolve(host, 'src/index.mjs'))).default;
  const response = await site.fetch(new Request(release.target.origin + '/catalog'), {});
  assert.equal(response.status, 200);
  assert.equal(digest(await response.text()), release.catalogSha256);
  console.log('Qualified original Worker: ' + release.workerSha256);
} else if (mode === 'before') {
  const deployment = await currentDeployment();
  const settings = await provider('/settings');
  const bindings = receiveBindings(settings, {allowMissingAnalytics:true});
  save('before.json', {...deployment, bindings});
  console.log('Existing ads rollback version: ' + deployment.versionId);
} else if (mode === 'after') {
  const before = json(resolve(work, 'before.json'));
  const log = readFileSync(resolve(work, 'deploy.log'), 'utf8');
  const uploaded = /Current Version ID:\s*([a-f0-9-]{36})/iu.exec(log)?.[1];
  assert.match(uploaded ?? '', uuid, 'Original publisher did not return its Worker version');
  const deployment = await currentDeployment();
  assert.notEqual(deployment.deploymentId, before.deploymentId);
  assert.equal(deployment.versionId, uploaded, 'Uploaded version is not active at 100% traffic');
  const bindings = receiveBindings(await provider('/settings'));
  let observed;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const options = {headers:{'cache-control':'no-cache'}, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(10000)};
      const [catalog, health] = await Promise.all([
        fetch(release.target.origin + '/catalog', options), fetch(release.target.origin + '/health', options),
      ]);
      assert.equal(catalog.status, 200); assert.equal(health.status, 200);
      const text = await catalog.text(), rows = JSON.parse(text).catalog;
      assert.equal(digest(text), release.catalogSha256, 'Public catalog still differs');
      assert.equal(rows.length, release.catalogSize);
      assert.deepEqual(await health.json(), {ok:true, service:'advertising-services-section', catalogSize:release.catalogSize});
      observed = {catalogSha256:digest(text), catalogSize:rows.length, receivedAt:new Date().toISOString()};
      break;
    } catch (error) {
      if (attempt === 11) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  const receipt = {hostCommit:release.hostCommit, advertisingCommit:release.advertisingCommit,
    advertisingVersion:release.advertisingVersion, advertisingArchiveSha256:release.advertisingArchiveSha256,
    workerSha256:release.workerSha256, target:release.target, before, deployment, bindings, public:observed};
  save('receipt.json', receipt);
  console.log(JSON.stringify(receipt, null, 2));
} else {
  throw Error('Expected prepare, built, before or after');
}
