// 561.group: the static page from ./public, plus /estate.json, which re-derives
// every public node's status on request (cached briefly) instead of asserting it.

import estate from "../public/estate-records.json";
import home from "../data/home.json";
import frontdoor from "../data/frontdoor.json";
import groupFeed from "../public/feed.json";
import feedReceipt from "../public/feed-input-receipt.json";
import { create561GroupLivingApplication, PUBLIC_ROUTES } from "./living-home.mjs";
import { toldOf } from "./told.mjs";
import { readSourceRevision } from "./source-revision.mjs";
import { localeOfPath, localeRedirect } from "./locales.mjs";

const LOCALES = ["en", "zh-Hans", "lkt"];

const APEX = "561.group";
const PROBE_TIMEOUT_MS = 4000;
const ESTATE_TTL_S = 300;
// TUFTE is the root-page producer; the existing Worker still owns routing and federation fallback.
const livingHome = create561GroupLivingApplication({
  readHome: () => home, readEstate: () => estate,
  readFrontdoor: () => frontdoor, readFeed: () => groupFeed,
  readFeedReceipt: () => feedReceipt, releaseHome: home
});

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; base-uri 'none'; form-action mailto:; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

function withHeaders(response, extra = {}) {
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(key, value);
  return out;
}

async function probe(node) {
  const started = Date.now();
  const url = node.url ?? `https://${node.host}${node.probe ?? "/"}`;
  try {
    const init = {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "561.group estate probe (+https://561.group/estate.json)" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    };
    const response = await fetch(url, init);
    response.body?.cancel();
    return { host: node.host, url, status: response.status, told: toldOf(response.status), ms: Date.now() - started };
  } catch {
    return { host: node.host, url, status: null, told: toldOf(null), ms: Date.now() - started };
  }
}

async function estateReading(request, ctx) {
  const cache = caches.default;
  const key = new Request(new URL(`/estate.json?revision=${estate.revision}`, request.url).toString());
  const cached = await cache.match(key);
  if (cached) return cached;

  // The machines are read beside the nodes, not listed among them: the page lists services, and a
  // reader of the estate still learns whether the machines behind them answer.
  const [nodes, machines] = await Promise.all([
    Promise.all(estate.nodes.map((node) => probe(node))),
    Promise.all((estate.machines ?? []).map((machine) => probe(machine))),
  ]);
  const body = JSON.stringify({ revision: estate.revision, derivedAt: new Date().toISOString(), ttlSeconds: ESTATE_TTL_S, ...(estate.status ? { status: estate.status } : {}), nodes, machines }, null, 2);
  const response = new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${ESTATE_TTL_S}`,
      "access-control-allow-origin": "*",
    },
  });
  ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

/**
 * Own only this site's routing decision. ActivityPub paths and protocol
 * behavior belong to the separately provisioned, site-origin-bound
 * ACTIVITYPUB_INSTANCE provider, not a second Worker federation codec.
 *
 * Serve authored assets first. Missing resources (including POST inbox
 * targets, for which the assets service may return 405) go to the site's
 * provider. Its own 404 is not promoted into a public site resource.
 * An absent binding preserves the previously installed static-site behavior.
 */
async function websiteOrFederation(request, env) {
  const pathname = new URL(request.url).pathname;
  const hasProvider = typeof env.ACTIVITYPUB_INSTANCE?.fetch === "function";
  const mayForwardBody = hasProvider && !pathname.startsWith("/_private/")
    && request.method !== "GET" && request.method !== "HEAD";
  // Cloudflare static assets cannot accept a non-GET/HEAD request body.
  // Check their route without consuming the original signed ActivityPub
  // stream; the original request must reach its federation provider intact.
  // This is a bodyless static-asset method probe, not a second protocol route.
  const asset = await env.ASSETS.fetch(mayForwardBody
    ? new Request(request.url, { method: request.method })
    : request);
  // Private delivery/queue endpoints belong on the provider's private host.
  if (pathname.startsWith("/_private/")) return asset;
  if ((asset.status !== 404 && !(asset.status === 405 && request.method !== "GET" && request.method !== "HEAD"))
      || !hasProvider) return asset;
  const federated = await env.ACTIVITYPUB_INSTANCE.fetch(request);
  if (!(federated instanceof Response)) throw new TypeError("The site's federation provider must return a Response");
  return federated.status === 404 ? asset : federated;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname !== APEX) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/estate.json") return withHeaders(await estateReading(request, ctx));
    if (url.pathname === "/source-revision.json" && (request.method === "GET" || request.method === "HEAD")) {
      return withHeaders(await readSourceRevision(request, env));
    }
    // The old generated /index.html must not remain a second public homepage.
    if (url.pathname === "/index.html" && (request.method === "GET" || request.method === "HEAD")) {
      return withHeaders(Response.redirect("https://561.group/" + url.search, 301));
    }
    // The root goes to a reader's preferred served language (a stored `lang` choice first); every other path is exact.
    const redirect = localeRedirect(request, { locales: LOCALES });
    if (redirect) return withHeaders(redirect);
    // LWS owns six exact public pages, including its source-bound blog. Do not seize the static contact page,
    // original ActivityPub routes, unknown paths or machine-service endpoints.
    const safeRead = request.method === "GET" || request.method === "HEAD";
    if (safeRead) {
      const canonical = PUBLIC_ROUTES.find(path =>
        path !== "/" && path.slice(0,-1) === url.pathname);
      if (canonical) {
        url.pathname = canonical;
        return withHeaders(Response.redirect(url.toString(), 308));
      }
    }
    if (safeRead && PUBLIC_ROUTES.includes(url.pathname)) {
      const response = await livingHome.fetch(request);
      return withHeaders(response, {
        "content-language":"en", vary:"Accept, Accept-Language, Cookie"
      });
    }
    const language = url.pathname === "/" ? "en" : localeOfPath(url.pathname, LOCALES);
    return withHeaders(await websiteOrFederation(request, env), {
      ...(language ? { "content-language": language } : {}),
      ...(url.pathname === "/" ? { vary: "Accept-Language, Cookie" } : {}),
    });
  },
};
