/** The original Web application's one security policy for both dynamic
 * Cloudflare Worker responses and explicitly admitted static edge assets.
 * A static-asset bypass must never silently drop these protections.
 */
export const SECURITY_HEADERS=Object.freeze({
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.github.com https://cloudflareinsights.com; base-uri 'none'; form-action 'self' mailto:; frame-ancestors 'none'",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer",
  "permissions-policy":"camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "strict-transport-security":"max-age=31536000; includeSubDomains"
});

// These named, source-public files need no Actor/ActivityPub resolution, locale
// redirect, estate probe, dynamic TUFTE projection or authenticated authority.
// Every other route stays Worker-first, including unknown paths. Wrangler's
// negative patterns win over the wildcard; the site tests verify exact parity.
export const STATIC_FAST_PATHS=Object.freeze([
  "/fonts/*",
  "/favicon.svg",
  "/logo.png",
  "/card.png",
  "/apple-touch-icon.png",
  "/work/audit/preview.mjs"
]);
export const STATIC_CACHE_SECONDS=300;

// Cloudflare's _headers is deployed configuration, not a publicly readable
// editorial artifact. Retain one source of truth with Worker response headers;
// build must select this exact output and tests must check the route exclusions.
export function renderStaticAssetHeaders(){
  const headers=Object.entries(SECURITY_HEADERS)
    .map(([name,value])=>"  "+name+": "+value).join("\n");
  return [
    "# 561.group public static edge assets; generated from original Engineering source.",
    "# The dynamic Worker always owns publication, contact, estate, receipt and federation.",
    ...STATIC_FAST_PATHS.map(path=>
      path+"\n"+headers+"\n  cache-control: public, max-age="+STATIC_CACHE_SECONDS)
  ].join("\n\n")+"\n";
}
