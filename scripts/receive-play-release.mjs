#!/usr/bin/env node
// Receive the original Play build through the existing private content carrier.
// The application, publisher, and tiling engine remain in their source owners.
import { readFile, lstat, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const [mode, directory, expectedManifest, receiptPath] = process.argv.slice(2);
if (!['verify', 'target', 'receive'].includes(mode) || !directory || !/^[a-f0-9]{64}$/.test(expectedManifest ?? '') ||
    (mode === 'receive' && !receiptPath))
  throw new Error('Usage: receive-play-release.mjs verify|target|receive DIRECTORY MANIFEST_SHA256 [RECEIPT_JSON]');
const root = resolve(directory);
const origin = 'https://play.561.group';
const target = 'play-561-group';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const ni = bytes => 'ni:///sha-256;' + createHash('sha256').update(bytes).digest('base64url');
const gitId = value => /^[a-f0-9]{40}$/.test(value ?? '');
const safePath = value => typeof value === 'string' && value.length > 0 && value.length < 512 &&
  !value.startsWith('/') && !value.includes('\\') && value.split('/').every(part => part && part !== '.' && part !== '..');
const equal = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const fixedConfig = {
  $schema: 'node_modules/wrangler/config-schema.json',
  name: target,
  compatibility_date: '2026-08-04',
  workers_dev: false,
  preview_urls: false,
  assets: { directory: './public' },
  observability: { enabled: true, head_sampling_rate: 1 },
  routes: [{ pattern: 'play.561.group', custom_domain: true }],
};
async function bytes(name, maximum = 2097152) {
  if (!safePath(name)) throw new Error('Invalid release path');
  let location = root;
  const parts = name.split('/');
  for (const [index, part] of parts.entries()) {
    location = join(location, part);
    const info = await lstat(location);
    if (index < parts.length - 1 ? !info.isDirectory() : !info.isFile() || info.size < 1 || info.size > maximum)
      throw new Error('Invalid release file: ' + name);
  }
  return readFile(location);
}
async function fileSet(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (!safePath(name) || (!entry.isFile() && !entry.isDirectory())) throw new Error('Invalid release entry: ' + name);
    if (entry.isDirectory()) files.push(...await fileSet(join(directory, entry.name), name + '/'));
    else files.push(name);
    if (files.length > 128) throw new Error('Play release file limit exceeded');
  }
  return files.sort();
}
const raw = await bytes('manifest.json', 131072);
if (digest(raw) !== expectedManifest) throw new Error('Play release manifest changed');
const manifest = JSON.parse(raw);
const sourceOwners = ['red-cup-engineering/play', 'red-cup-engineering/static-site-publisher', 'red-cup-engineering/web-page-tiling-engine'];
const supplierNames = ['@red-cup-engineering/static-site-publisher', '@red-cup-engineering/web-page-tiling-engine'];
if (manifest.kind !== '561-group.play-release/v1' || manifest.target !== target || manifest.origin !== origin ||
    manifest.wranglerVersion !== '4.123.0' || manifest.feeds !== false ||
    !Array.isArray(manifest.sources) || manifest.sources.length !== 3 ||
    !equal(manifest.sources.map(source => source.repository).sort(), sourceOwners) ||
    manifest.sources.some(source => !gitId(source.commit) || !gitId(source.tree)) ||
    !Array.isArray(manifest.suppliers) || manifest.suppliers.length !== 2 ||
    !equal(manifest.suppliers.map(supplier => supplier.name).sort(), supplierNames) ||
    manifest.suppliers.some(supplier => !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(supplier.version ?? '') ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(supplier.integrity ?? '') ||
      !manifest.sources.some(source => source.repository === supplier.repository && source.commit === supplier.commit)) ||
    !manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== 'object')
  throw new Error('Incomplete original Play release');
const names = Object.keys(manifest.files).sort();
if (names.length < 10 || names.length > 64 || names.some(name =>
    !safePath(name) || (!name.startsWith('public/') && !['wrangler.jsonc', 'source-bindings.json', 'build-report.json'].includes(name))) ||
    !equal(await fileSet(root), ['manifest.json', ...names].sort()))
  throw new Error('Play carrier file set differs from its reviewed manifest');
let totalBytes = 0;
const content = new Map();
for (const name of names) {
  const value = await bytes(name), declared = manifest.files[name];
  if (value.length !== declared.bytes || digest(value) !== declared.sha256) throw new Error('Play release file changed: ' + name);
  totalBytes += value.length;
  if (totalBytes > 16777216) throw new Error('Play release byte limit exceeded');
  content.set(name, value);
}
const json = name => {
  if (!content.has(name)) throw new Error('Required Play artifact absent: ' + name);
  return JSON.parse(content.get(name));
};
if (!equal(json('wrangler.jsonc'), fixedConfig)) throw new Error('Release changes the existing Play target or Wrangler configuration');
const bindings = json('source-bindings.json');
if (bindings.kind !== 'play-catalog-source-bindings/v1' || !Array.isArray(bindings.sources) || bindings.sources.length !== 16 ||
    new Set(bindings.sources.map(source => source.repository)).size !== 16 ||
    bindings.sources.some(source => !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(source.repository ?? '') ||
      !gitId(source.commit) || !gitId(source.tree) || !Array.isArray(source.catalogRoots) || !source.catalogRoots.length ||
      source.catalogRoots.some(path => path !== '.' && !safePath(path)) || !Array.isArray(source.gameSiteRoots) ||
      source.gameSiteRoots.some(path => path !== '.' && !safePath(path)) || !Array.isArray(source.files) || !source.files.length ||
      new Set(source.files.map(file => file.path)).size !== source.files.length ||
      source.files.some(file => !safePath(file.path) || !gitId(file.blob) || !/^[a-f0-9]{64}$/.test(file.sha256 ?? '') ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 0)))
  throw new Error('Incomplete original game source bindings');
const report = json('build-report.json'), nativeRelease = json('public/release-manifest.json');
const publisher = manifest.suppliers.find(supplier => supplier.name === supplierNames[0]);
if (report.releasable !== true || !Array.isArray(report.refusals) || report.refusals.length ||
    report.cellCount !== 0 || report.publishedCount !== 0 || report.victorVersion !== publisher.version ||
    nativeRelease.kind !== 'web-release-manifest' || nativeRelease.version !== 1 || nativeRelease.baseUrl !== origin + '/' ||
    nativeRelease.digest !== manifest.nativeReleaseDigest || report.releaseCandidate?.digest !== nativeRelease.digest ||
    !Array.isArray(nativeRelease.artifacts) || nativeRelease.artifacts.length !== nativeRelease.artifactCount ||
    new Set(nativeRelease.artifacts.map(artifact => artifact.path)).size !== nativeRelease.artifactCount ||
    !equal(nativeRelease.artifacts.map(artifact => 'public/' + artifact.path).sort(), names.filter(name => name.startsWith('public/') && name !== 'public/release-manifest.json')))
  throw new Error('Original VICTOR build was not received as a releasable catalog');
let nativeBytes = 0;
for (const artifact of nativeRelease.artifacts) {
  const value = content.get('public/' + artifact.path);
  if (!value || artifact.bytes !== value.length || artifact.digest !== ni(value))
    throw new Error('Native release artifact changed: ' + artifact.path);
  nativeBytes += value.length;
}
if (nativeBytes !== nativeRelease.byteCount) throw new Error('Native release byte count changed');
const catalog = json('public/catalog.json');
if (!Array.isArray(catalog.games) || catalog.games.length !== 21 || !Array.isArray(manifest.gameIds) ||
    new Set(manifest.gameIds).size !== 21 || !equal(catalog.games.map(game => game.id).sort(), [...manifest.gameIds].sort()) ||
    catalog.generated !== manifest.generatedDate || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.generatedDate ?? ''))
  throw new Error('The original 21-game catalog or its generation date changed');
const feedPaths = ['/feed.rss.xml', '/feed.atom.xml', '/feed.json'];
const advertisedFeed = /<link\b[^>]*(?:type=["']application\/(?:rss\+xml|atom\+xml|feed\+json)["']|href=["'][^"']*\/feed\.(?:rss\.xml|atom\.xml|json)["'])[^>]*>/i;
if (feedPaths.some(path => content.has('public' + path)) || names.some(name => name.endsWith('.html') && advertisedFeed.test(content.get(name).toString('utf8'))))
  throw new Error('The catalog still publishes or advertises a document feed');
for (const name of ['public/index.html', 'public/today.html', 'public/atlas/index.html', 'public/404.html'])
  if (!content.has(name)) throw new Error('Original public page absent: ' + name);
if (mode === 'verify') {
  console.log(JSON.stringify({ verified: true, worker: target, manifest: expectedManifest, nativeReleaseDigest: nativeRelease.digest,
    fileCount: names.length, gameCount: catalog.games.length, sourceBindings: bindings.sources.length }));
  process.exit(0);
}

const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
if (!/^[a-f0-9]{32}$/i.test(account ?? '') || !token) throw new Error('Existing deployment credentials unavailable');
const tag = 'play-' + expectedManifest.slice(0, 32);
const receipt = { kind: '561-group.play-production-receipt/v1', target, manifest: expectedManifest,
  nativeReleaseDigest: nativeRelease.digest, expectedTag: tag, received: false, observations: [] };
async function saveReceipt() {
  await mkdir(dirname(resolve(receiptPath)), { recursive: true });
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
}
async function responseBytes(response, maximum = 2097152) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > maximum) throw new Error('Response byte limit exceeded');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
async function provider(path) {
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account + '/workers/scripts/' + target + path, {
    redirect: 'error', signal: AbortSignal.timeout(15000), headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
  });
  const data = JSON.parse(await responseBytes(response));
  if (!response.ok || data.success !== true) {
    const error = new Error('Cloudflare release read failed: HTTP ' + response.status + ', codes ' +
      (data.errors ?? []).map(error => error.code).filter(Number.isSafeInteger).join(','));
    error.permanent = response.status === 401 || response.status === 403;
    throw error;
  }
  return data.result;
}
async function activeVersion() {
  const deployment = (await provider('/deployments?per_page=10'))?.deployments?.[0];
  if (deployment?.versions?.length !== 1 || deployment.versions[0].percentage !== 100 ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(deployment.versions[0].version_id ?? ''))
    throw new Error('Expected one active Play version receiving all traffic');
  return deployment.versions[0].version_id.toLowerCase();
}
async function publicResponse(path) {
  let url = new URL(path, origin);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'cache-control': 'no-cache', 'user-agent': '561-Group-Play-Release/1.0' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new Error('Public redirect has no destination: ' + path);
      const next = new URL(location, url);
      if (next.origin !== origin || next.username || next.password || next.search || next.hash || hop === 3)
        throw new Error('Unexpected public redirect: ' + path);
      url = next; continue;
    }
    return { path, url: url.href, status: response.status, mediaType: (response.headers.get('content-type') ?? '').split(';')[0].toLowerCase(),
      body: await responseBytes(response) };
  }
  throw new Error('Public redirect limit reached: ' + path);
}
// The existing zone inserts one analytics module immediately before </body>.
// All original document bytes must still match. Other changes remain failures.
const analyticsInsertion = /^<script (?:type="module"|defer) src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/[A-Za-z0-9]+" integrity="sha512-[A-Za-z0-9+/=]+" data-cf-beacon='[^'<>]*' crossorigin="anonymous"><\/script>\n?$/;
function htmlReceived(actual, expected) {
  if (actual.equals(expected)) return 'exact-bytes';
  const document = expected.toString('utf8'), observed = actual.toString('utf8'), end = document.lastIndexOf('</body>');
  if (end < 0) throw new Error('Expected HTML has no body close');
  const prefix = document.slice(0, end), suffix = document.slice(end);
  if (!observed.startsWith(prefix) || !observed.endsWith(suffix) ||
      !analyticsInsertion.test(observed.slice(prefix.length, observed.length - suffix.length)))
    throw new Error('Public HTML differs from the original generated document');
  return 'original-bytes-with-cloudflare-analytics';
}
const publicPages = [
  ['/', 'public/index.html'], ['/today', 'public/today.html'], ['/atlas/', 'public/atlas/index.html'],
  ['/catalog.json', 'public/catalog.json'], ['/release-manifest.json', 'public/release-manifest.json'],
  ['/robots.txt', 'public/robots.txt'],
];
if (mode === 'target') {
  const version = await activeVersion(), details = await provider('/versions/' + version);
  if (details?.id?.toLowerCase() !== version) throw new Error('Existing Play version details do not match the active deployment');
  console.log(JSON.stringify({ existingTarget: true, worker: target, activeVersion: version,
    alreadyCurrent: details.annotations?.['workers/tag'] === tag }));
  process.exit(0);
}
const deadline = Date.now() + 360000;
for (let attempt = 0; attempt < 18 && Date.now() < deadline; attempt++) {
  try {
    const version = await activeVersion(), details = await provider('/versions/' + version);
    if (details?.id?.toLowerCase() !== version || details.annotations?.['workers/tag'] !== tag)
      throw new Error('The active Play version does not carry the reviewed release tag');
    const pages = await Promise.all(publicPages.map(async ([path, name]) => {
      const result = await publicResponse(path), expected = content.get(name);
      if (result.status !== 200) throw new Error('Public page returned HTTP ' + result.status + ': ' + path);
      let comparison = 'exact-bytes';
      if (name.endsWith('.html')) {
        if (result.mediaType !== 'text/html' || advertisedFeed.test(result.body.toString('utf8')))
          throw new Error('Public page has the wrong type or advertises a feed: ' + path);
        comparison = htmlReceived(result.body, expected);
      } else if (!result.body.equals(expected) || (name.endsWith('.json') && result.mediaType !== 'application/json') ||
          (name.endsWith('.txt') && result.mediaType !== 'text/plain')) throw new Error('Public artifact differs: ' + path);
      return { path, finalUrl: result.url, status: result.status, mediaType: result.mediaType, comparison,
        observedSha256: digest(result.body), expectedSha256: digest(expected) };
    }));
    const absentFeeds = await Promise.all(feedPaths.map(async path => {
      const result = await publicResponse(path);
      const nativeEmpty404 = result.body.length === 0 && ['', 'text/plain'].includes(result.mediaType);
      if (result.status !== 404 || (!nativeEmpty404 && result.mediaType !== 'text/html') ||
          /<rss\b|<feed\b|https?:\/\/jsonfeed\.org\/version\//i.test(result.body.toString('utf8')))
        throw new Error('Feed absence not received: HTTP ' + result.status + ' ' + result.mediaType + ' at ' + path);
      const comparison = nativeEmpty404 ? 'native-empty-404' : htmlReceived(result.body, content.get('public/404.html'));
      return { path, status: result.status, mediaType: result.mediaType, comparison, observedSha256: digest(result.body) };
    }));
    if (await activeVersion() !== version) throw new Error('Play active version changed during public receiving');
    Object.assign(receipt, { received: true, version, publishedAt: details.metadata?.created_on,
      receivedAt: new Date().toISOString(), gameCount: catalog.games.length, pages, absentFeeds });
    await saveReceipt();
    console.log(JSON.stringify({ received: true, worker: target, version, tag, manifest: expectedManifest,
      nativeReleaseDigest: nativeRelease.digest, gameCount: catalog.games.length, publicPages: pages.length, absentFeeds: absentFeeds.length }));
    process.exit(0);
  } catch (error) {
    receipt.observations.push({ at: new Date().toISOString(), attempt: attempt + 1, error: error.message });
    await saveReceipt();
    console.log(JSON.stringify({ received: false, worker: target, attempt: attempt + 1, state: error.message }));
    if (error.permanent) throw error;
  }
  if (attempt < 17) await delay(10000);
}
throw new Error('The reviewed Play release was not received; see the retained receipt');
