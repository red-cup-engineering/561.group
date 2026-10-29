#!/usr/bin/env node
// Read-only public delivery witness for the original 561.group site.
// A successful HTTP probe is NOT an authenticated Cloudflare deployment receipt,
// an accepted human journey, or proof that the current source was published.
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { observeSiteOperation, projectSiteConformance } from './site-observation/upstream.mjs';

const ORIGIN = 'https://561.group';
const MAX_BYTES = 2 * 1024 * 1024;
const EXACT_SHA = /^[a-f\d]{40}$/i;
const EXACT_VERSION = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const SIMPLE_CHECKS = Object.freeze([
  { name: 'homepage', path: '/', accept: 'text/html', type: 'html', required: true },
  { name: 'work-journey', path: '/work/', accept: 'text/html', type: 'html', required: true,
    mustContain: 'Areas we can scope' },
  { name: 'projects-journey', path: '/projects/', accept: 'text/html', type: 'html', required: true,
    mustContain: 'Shop, Bazaar and Market' },
  { name: 'about-journey', path: '/about/', accept: 'text/html', type: 'html', required: true,
    mustContain: 'The four accountable companies' },
  { name: 'agent-journey', path: '/for-agents/', accept: 'text/html', type: 'html', required: true,
    mustContain: 'Published machine-readable interfaces' },
  { name: 'contact', path: '/contact/', accept: 'text/html', type: 'html', required: true },
  { name: 'estate', path: '/estate.json', accept: 'application/json', type: 'estate', required: true },
  { name: 'agent-discovery', path: '/llms.txt', accept: 'text/plain', type: 'plain', required: true },
  { name: 'crawl-policy', path: '/robots.txt', accept: 'text/plain', type: 'robots', required: true },
  { name: 'sitemap', path: '/sitemap.xml', accept: 'application/xml', type: 'sitemap', required: true },
  { name: 'security-contact', path: '/.well-known/security.txt', accept: 'text/plain', type: 'plain', required: false },
]);

// This is a reader capability, not a traffic count. Reuse the *same* sampled
// homepage response so monitoring an additional intended journey does not
// double our network, response-body or energy consumption.
const RESEARCH_CHECK = Object.freeze({
  name: 'research-discovery', path: '/', accept: 'text/html',
  type: 'html', required: true,
  mustContain: 'href="https://science.561.group/"',
});

async function limitedBytes(response) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BYTES) throw Object.assign(new RangeError('body too large'), { code: 'BODY_LIMIT' });
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const parts = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw Object.assign(new RangeError('body too large'), { code: 'BODY_LIMIT' });
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}

async function observe(url, accept, fetchImpl, timeoutMs, clock, method = 'GET') {
  let nosniff = false, hsts = false, noHeadBody = null, cors = null;
  const observation = await observeSiteOperation({
    endpoint: '561-group-public-delivery', url, method, redirect: 'manual',
    responseType: method === 'HEAD' ? 'none' : 'text', timeoutMs, maxBodyBytes: MAX_BYTES,
  }, {
    clock, safeErrors: true, readResponseBody: limitedBytes, identityContentCoding: true,
    userAgent: '561-group-public-delivery-witness/1',
    fetchImpl: async (target, options) => {
      const headers = new Headers(options.headers);
      headers.set('accept', accept);
      headers.set('cache-control', 'no-cache');
      const response = await fetchImpl(target, { ...options, cache: 'no-store', headers });
      nosniff = response.headers.get('x-content-type-options') === 'nosniff';
      hsts = Boolean(response.headers.get('strict-transport-security'));
      if (method === 'HEAD') noHeadBody = response.body === null;
      cors = response.headers.get('access-control-allow-origin');
      return response;
    },
  });
  // Full read wall time from original observation timestamps; not TTFB/LCP.
  const startMs = Date.parse(observation.observedAt ?? '');
  const finishMs = Date.parse(observation.completedAt ?? '');
  const readWallMs = Number.isFinite(startMs) && Number.isFinite(finishMs) && finishMs >= startMs
    ? finishMs - startMs : null;
  if (observation.status === 'obstruction' && !/^HTTP \d{3}$/u.test(observation.reason ?? '')) {
    return { observation, readWallMs, unknown: true, errorKind: observation.reason === 'operation-timeout' ? 'timeout'
      : observation.reason === 'response-body-limit' ? 'body-limit' : 'transport' };
  }
  return { observation, readWallMs, status: observation.httpStatus,
    contentType: observation.headers['content-type'] ?? '',
    cacheControl: observation.headers['cache-control'] ?? '',
    location: observation.headers.location ?? '', nosniff, hsts, noHeadBody, cors,
    contentSha256: observation.bodyDigest?.value, bytes: observation.bodyBytes ?? 0,
    body: observation.body ?? '' };
}

/** External HEAD and GET compare one public resource's representation metadata.
 * This cannot observe Worker-internal remote-probe counts or energy. */
function evaluateEstateHead(head, get) {
  const base = { name: 'estate-head-contract', url: `${ORIGIN}/estate.json`,
    required: true, readWallMs: head.readWallMs ?? null,
    httpStatus: head.status ?? null, bytes: head.bytes ?? 0 };
  if (head.unknown || get.unknown)
    return { ...base, outcome: 'unknown', reason: head.errorKind ?? get.errorKind };
  if (head.status !== 200 || get.status !== 200)
    return { ...base, outcome: 'fail', reason: 'estate-get-or-head-status' };
  if (head.noHeadBody !== true || head.bytes !== 0)
    return { ...base, outcome: 'fail', reason: 'head-body-present' };
  // Retain only public response metadata; no request headers, cookies,
  // credentials, query parameters, private data or response bodies.
  const metadata = {
    head: { type: head.contentType, cache: head.cacheControl, cors: head.cors,
      nosniff: head.nosniff, hsts: head.hsts },
    get: { type: get.contentType, cache: get.cacheControl, cors: get.cors,
      nosniff: get.nosniff, hsts: get.hsts },
  };
  if (head.contentType !== get.contentType || head.cacheControl !== get.cacheControl
      || head.cors !== get.cors || head.cacheControl !== 'public, max-age=300'
      || head.cors !== '*' || !head.nosniff || !head.hsts)
    return { ...base, outcome: 'fail', reason: 'head-get-metadata-mismatch',
      metadata };
  return { ...base, outcome: 'pass', cacheControl: head.cacheControl,
    contentType: head.contentType, cors: head.cors,
    qualification: 'public HTTP HEAD/GET representation only; does not measure internal probe count' };
}

function evaluateSimple(def, sample) {
  const common = { name: def.name, url: `${ORIGIN}${def.path}`, required: def.required,
    readWallMs: sample.readWallMs ?? null };
  if (sample.unknown) return { ...common, outcome: 'unknown', reason: sample.errorKind };
  const result = { ...common, httpStatus: sample.status, bytes: sample.bytes,
    contentSha256: sample.contentSha256, contentType: sample.contentType };
  if (sample.status !== 200) return { ...result, outcome: !def.required && sample.status === 404 ? 'not-published' : 'fail', reason: `http-${sample.status}` };
  if (sample.bytes === 0) return { ...result, outcome: 'fail', reason: 'empty-resource' };
  const media = sample.contentType.toLowerCase();
  if (def.type === 'html' && !media.includes('text/html')) return { ...result, outcome: 'fail', reason: 'wrong-media-type' };
  if (def.type === 'estate') {
    if (!media.includes('application/json')) return { ...result, outcome: 'fail', reason: 'wrong-media-type' };
    let estate;
    try { estate = JSON.parse(sample.body); } catch { return { ...result, outcome: 'fail', reason: 'invalid-json' }; }
    if (!estate || !Array.isArray(estate.nodes) || !estate.nodes.length ||
        typeof estate.revision !== 'string' || !estate.revision ||
        estate.nodes.some(n => !['true', 'false', 'both', 'neither'].includes(n.told))) {
      return { ...result, outcome: 'fail', reason: 'invalid-estate-contract' };
    }
    result.estateNodes = estate.nodes.length;
    result.estateRevision = estate.revision;
  }
  if (def.type === 'robots' && !/user-agent\s*:/iu.test(sample.body))
    return { ...result, outcome: 'fail', reason: 'invalid-robots-contract' };
  if (def.type === 'sitemap' && !/<(?:urlset|sitemapindex)(?:\s|>)/iu.test(sample.body))
    return { ...result, outcome: 'fail', reason: 'invalid-sitemap-contract' };
  if (def.type === 'plain' && !media.includes('text/plain'))
    return { ...result, outcome: 'fail', reason: 'wrong-media-type' };
  if (def.mustContain && (!sample.body.includes(def.mustContain) || !sample.body.includes('data-tufte')))
    return { ...result, outcome: 'fail', reason: 'missing-useful-visitor-page' };
  if (def.type === 'html' && (!sample.nosniff || !sample.hsts))
    return { ...result, outcome: 'fail', reason: 'missing-security-headers', nosniff: sample.nosniff, hsts: sample.hsts };
  return { ...result, outcome: 'pass' };
}

function evaluateAlias(sample) {
  const name = 'www-canonical-redirect';
  const url = 'https://www.561.group/contact/?witness=1';
  const expected = 'https://561.group/contact/?witness=1';
  if (sample.unknown) return { name, url, required: true, outcome: 'unknown', reason: sample.errorKind };
  const result = { name, url, required: true, httpStatus: sample.status, location: sample.location };
  return sample.status === 301 && sample.location === expected
    ? { ...result, outcome: 'pass' }
    : { ...result, outcome: 'fail', reason: 'unexpected-canonical-redirect' };
}

function evaluateRevision(sample, expectedSourceSha) {
  const result = { name: 'source-revision-claim', url: `${ORIGIN}/source-revision.json`, required: Boolean(expectedSourceSha) };
  if (sample.unknown) return { ...result, outcome: 'unknown', reason: sample.errorKind };
  if (sample.status === 404) return { ...result, httpStatus: 404, outcome: expectedSourceSha ? 'fail' : 'not-published',
    reason: 'no-public-revision-receipt' };
  if (sample.status !== 200) return { ...result, httpStatus: sample.status, outcome: 'fail', reason: 'unexpected-revision-response' };
  let claim;
  try { claim = JSON.parse(sample.body); } catch { return { ...result, httpStatus: 200, outcome: 'fail', reason: 'invalid-revision-json' }; }
  if (claim?.repository !== '561-group/561.group' || claim?.origin !== ORIGIN || !EXACT_SHA.test(claim?.sourceCommit ?? '') ||
      claim?.renderer !== 'TUFTE' || claim?.application !== 'LivingWebServer')
    return { ...result, httpStatus: 200, outcome: 'fail', reason: 'unexpected-revision-claim' };
  if (!EXACT_VERSION.test(claim.workerVersionId ?? ''))
    return { ...result, httpStatus: 200, outcome: 'fail', reason: 'missing-or-invalid-worker-version' };
  const resultClaim = { ...result, httpStatus: 200, claimedSourceCommit: claim.sourceCommit,
    claimedWorkerVersionId: claim.workerVersionId.toLowerCase(), outcome: 'pass',
    qualification: 'public-self-description-only; not provider-native receipt' };
  if (expectedSourceSha && claim.sourceCommit.toLowerCase() !== expectedSourceSha.toLowerCase())
    return { ...resultClaim, outcome: 'fail', reason: 'does-not-match-expected-source' };
  return resultClaim;
}

// The original Public Web issue #23 already owns these source-accepted
// articles. This samples external reader visibility ONLY: it does not create
// a site, source license, provider receipt, indexing record, or correction.
export const HOUSE_CLIMATE_ARTICLES = Object.freeze([
  Object.freeze({house:'science',domain:'science.561.group',
    sourceRepository:'lenticule-science/science-services-section',
    slug:'climate-breakdown-ergodicity-and-water-governance',
    title:'Climate breakdown changes the baseline'}),
  Object.freeze({house:'engineering',domain:'engineering.561.group',
    sourceRepository:'red-cup-engineering/engineering-services-section',
    slug:'engineering-nonstationary-water-decisions',
    title:'From watershed observations to warranted decisions'}),
  Object.freeze({house:'operations',domain:'operations.561.group',
    sourceRepository:'coesite-operations/operations-services-section',
    slug:'operating-with-changing-baselines',
    title:'Operating with changing baselines'}),
  Object.freeze({house:'services',domain:'services.561.group',
    sourceRepository:'causeway-services/public-services-section',
    slug:'climate-water-and-energy-exposure-worksheet',
    title:'Free worksheet: where changing water and energy conditions affect your work'}),
]);

function canonicalLinkInBody(body,url) {
  if(typeof body!=='string')return false;
  return [...body.matchAll(/<link\b[^>]*>/giu)].some(([tag]) =>
    /\brel\s*=\s*["']canonical["']/iu.test(tag) &&
    (tag.includes('href="'+url+'"') || tag.includes("href='"+url+"'")));
}
function publicHouseSample(sample,url) {
  if(sample.unknown)return {url,state:'unknown',reason:sample.errorKind};
  return {url,state:'observed',httpStatus:sample.status,
    bytes:sample.bytes,contentSha256:sample.contentSha256,
    mediaType:sample.contentType,
    // These security headers are observed, not a conformance certificate.
    nosniff:sample.nosniff,hsts:sample.hsts};
}
/** One bounded, read-only outside reader traversal per original company.
 * 200 with an expected title and canonical address remains an HTTP
 * observation, NEVER a source->build->provider custody or readership proof.
 * Unreachable, missing and changed content are preserved distinctly. */
export function qualifyHouseClimateVisibility(def,article,homepage) {
  const origin='https://'+def.domain;
  const articleUrl=origin+'/'+def.slug+'/';
  const homeUrl=origin+'/';
  const articleResult=publicHouseSample(article,articleUrl);
  const homeResult=publicHouseSample(homepage,homeUrl);
  const base={house:def.house,sourceRepository:def.sourceRepository,
    articleUrl,homepageUrl:homeUrl,article:articleResult,homepage:homeResult,
    providerReceiptAuthenticated:false,sourceByteEquivalenceVerified:false,
    externallyIndexed:null,independentHumanAcceptance:null};
  if(article.unknown || homepage.unknown)
    return {...base,status:'incomplete-public-observation',
      reason:article.unknown?'article-unreadable':'homepage-unreadable'};
  if(article.status===404)
    return {...base,status:'article-not-found-on-observed-origin',reason:'http-404'};
  if(article.status!==200)
    return {...base,status:'article-not-served-as-200',reason:'http-'+article.status};
  if(!article.contentType.toLowerCase().includes('text/html') || !article.body)
    return {...base,status:'article-unqualified',reason:'invalid-article-media'};
  if(!canonicalLinkInBody(article.body,articleUrl))
    return {...base,status:'article-unqualified',reason:'missing-exact-article-canonical'};
  if(!article.body.includes(def.title))
    return {...base,status:'article-unqualified',reason:'source-title-not-observed'};
  if(homepage.status!==200 || !homepage.contentType.toLowerCase().includes('text/html'))
    return {...base,status:'homepage-unqualified',reason:'home-http-or-media'};
  const escaped='/'+def.slug+'/';
  const linked=homepage.body?.includes('href="'+escaped+'"') ||
    homepage.body?.includes('href="'+articleUrl+'"') ||
    homepage.body?.includes("href='"+escaped+"'") ||
    homepage.body?.includes("href='"+articleUrl+"'");
  if(!linked)
    return {...base,status:'homepage-unqualified',reason:'article-not-linked-from-home'};
  return {...base,status:'public-page-and-home-link-observed',
    qualification:'independent HTTP title/canonical/navigation only; original publisher source, provider release, exact article bytes and human receiving still require separate evidence'};
}
export async function observeHouseClimateVisibility({fetchImpl,timeoutMs,clock}) {
  const pages=await Promise.all(HOUSE_CLIMATE_ARTICLES.map(async def=>{
    const origin='https://'+def.domain;
    const [article,homepage]=await Promise.all([
      observe(origin+'/'+def.slug+'/', 'text/html',fetchImpl,timeoutMs,clock),
      observe(origin+'/', 'text/html',fetchImpl,timeoutMs,clock),
    ]);
    return qualifyHouseClimateVisibility(def,article,homepage);
  }));
  return {
    schema:'561.group.house-climate-reader-observations/v1',
    scope:'Four source-authorized climate article routes: independent bounded public GET only; does not establish exact source build, Cloudflare version, published claims, search inclusion, remote federation or human results',
    observedVisible:pages.filter(p=>p.status==='public-page-and-home-link-observed').length,
    missing:pages.filter(p=>p.status==='article-not-found-on-observed-origin').length,
    incomplete:pages.filter(p=>p.status==='incomplete-public-observation').length,
    pages,
  };
}

/**
 * Public, non-privileged evidence. Does not assert active Cloudflare version,
 * correctness of self-reported revision, acceptance, or satisfaction of Work.
 * expectedSourceSha is an independently selected release input, never guessed
 * from the current repository's default branch.
 */
export async function observeProduction({ fetchImpl = fetch, expectedSourceSha = null,
  timeoutMs = 10000, now = () => new Date().toISOString(), searchConsole = null } = {}) {
  if (expectedSourceSha !== null && !EXACT_SHA.test(expectedSourceSha))
    throw new TypeError('expected source must be a 40-character hexadecimal commit');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 60000)
    throw new RangeError('timeout must be between 500 and 60000ms');
  const [simpleSamples, estateHead, alias, revision, houseClimateVisibility] = await Promise.all([
    Promise.all(SIMPLE_CHECKS.map(def =>
      observe(`${ORIGIN}${def.path}`, def.accept, fetchImpl, timeoutMs, now))),
    observe(`${ORIGIN}/estate.json`, 'application/json', fetchImpl, timeoutMs, now, 'HEAD'),
    observe('https://www.561.group/contact/?witness=1', 'text/html', fetchImpl, timeoutMs, now),
    observe(`${ORIGIN}/source-revision.json`, 'application/json', fetchImpl, timeoutMs, now),
    observeHouseClimateVisibility({fetchImpl,timeoutMs,clock:now}),
  ]);
  const observedAt = now();
  // The same exact HTTP responses feed the original conformance engine. This
  // owner declares six public entrypoints indexable and self-canonical; the
  // engine owns Googlebot, noindex and canonical semantics, including unknowns.
  const searchConformance = projectSiteConformance({
    site: ORIGIN + '/', owner: '561-group/561-group-frontdoor-services-section',
    sourceContext: { policyRevision: '561.group/public-indexable-entrypoints.v1' },
    evaluatedAt: observedAt, maxAgeMs: 600000, robotsUserAgent: 'Googlebot',
    routes: SIMPLE_CHECKS.filter(def => def.type === 'html').map(def => ({
      url: ORIGIN + def.path, method: 'GET', intent: 'index', canonicalUrl: ORIGIN + def.path,
    })),
    observations: simpleSamples.map(sample => sample.observation),
    ...(searchConsole === null ? {} : { searchConsole }),
  });
  const searchChecks = searchConformance.records.map(record => ({
    name: 'search-indexability:' + new URL(record.url).pathname, url: record.url, required: true,
    outcome: record.status === 'conformant' ? 'pass' : record.status === 'nonconformant' ? 'fail' : 'unknown',
    observationId: record.observation?.id,
    reason: record.checks.filter(check => check.status !== 'conformant').map(check => check.code).join(', ') || undefined,
  }));
  const simple = SIMPLE_CHECKS.map((def, i) => evaluateSimple(def, simpleSamples[i]));
  const researchRaw = evaluateSimple(RESEARCH_CHECK, simpleSamples[0]);
  const research = researchRaw.reason === 'missing-useful-visitor-page'
    ? { ...researchRaw, reason: 'missing-research-discovery-link' } : researchRaw;
  const checks = [simple[0], research, ...simple.slice(1),
    evaluateEstateHead(estateHead, simpleSamples[SIMPLE_CHECKS.findIndex(def => def.name === 'estate')]),
    ...searchChecks, evaluateAlias(alias), evaluateRevision(revision, expectedSourceSha)];
  const requiredChecks = checks.filter(check => check.required);
  const failed = checks.some(check => check.outcome === 'fail');
  const passed = requiredChecks.every(check => check.outcome === 'pass');
  return {
    schema: '561.group.public-delivery-observation/v1',
    observedAt, origin: ORIGIN, observerKind: 'read-only-external-http',
    selectedReleaseSource: expectedSourceSha, sourceSelection: expectedSourceSha ? 'operator-supplied' : 'not-selected',
    overall: failed ? 'public-checks-failed' : passed ? 'public-checks-passed' : 'receiving-incomplete',
    providerDeploymentVerified: false, independentHumanAcceptance: false,
    checks, searchConformance, houseClimateVisibility,
    providerNoticeCoverage: searchConsole === null ? 'not-supplied' : 'source-selected-notices',
  };
}

export function markdownSummary(result) {
  const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    `### 561.group public delivery observation: ${result.overall}`,
    '', `Observed: ${result.observedAt}; selected release source: ${result.selectedReleaseSource ?? 'none'}.`,
    'Provider-native deployment and independent human acceptance are **not** established by these HTTP checks.',
    `Search evidence: ${result.searchConformance.summary.routes} declared entrypoints; ${result.searchConformance.summary.findings} findings; provider notices ${result.providerNoticeCoverage}. Google indexing and unresolved provider notices remain separate from current HTTP checks.`,
    '',
    '**Four house climate article routes — independent public HTTP visibility, not original source/provider-release qualification:** ' +
      result.houseClimateVisibility.observedVisible + '/4 article-and-home paths sampled as recognizable; ' +
      result.houseClimateVisibility.missing + ' observed HTTP 404; ' +
      result.houseClimateVisibility.incomplete + ' transport/reader observations incomplete.',
    '', '| House | Public route observation | Article HTTP | Qualification |',
    '|---|---|---:|---|',
    ...result.houseClimateVisibility.pages.map(p =>
      '| ' + escape(p.house) + ' | ' + escape(p.status) + ' | ' +
      (p.article.httpStatus ?? '—') + ' | ' + escape(p.reason ??
        'No provider/source-byte, indexing, corrected-claim or reader-acceptance receipt') + ' |'),
    '', '| Check | Outcome | HTTP | Read ms | Notes |', '|---|---|---:|---:|---|',
    ...result.checks.map(c => `| ${escape(c.name)} | ${escape(c.outcome)} | ${c.httpStatus ?? '—'} | ${c.readWallMs ?? '—'} | ${escape(c.reason ?? (c.claimedSourceCommit ?? ''))} |`),
  ].join('\n') + '\n';
}

async function main() {
  const sha = process.env.EXPECTED_SOURCE_SHA || null;
  const result = await observeProduction({ expectedSourceSha: sha });
  await mkdir('observations', { recursive: true });
  await writeFile('observations/561.group-public-delivery.json', JSON.stringify(result, null, 2) + '\n');
  console.log(markdownSummary(result));
  console.log(JSON.stringify({ overall: result.overall, providerDeploymentVerified: false, sourceClaim: result.checks.at(-1).outcome }));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdownSummary(result));
  if (result.overall !== 'public-checks-passed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
