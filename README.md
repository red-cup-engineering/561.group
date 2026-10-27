Received 2026-10-24 from 561-group/561.group@384700ec75288831b76e602071aa7744905c11cf

# 561.group

The original public site of the **561 Group** at **https://561.group/** is served from this repository's `main` through the existing Cloudflare Worker `561-group-site`. It is one genuine TUFTE + LivingWebServer application, not a separate static marketing site.

## The Group's publication hub

`/blog/` is an original TUFTE + LivingWebServer page of the same Worker,
not a duplicate CMS or another publisher. The original `scripts/build.mjs`
already reads accepted public JSON Feeds from the four company sites,
combines them into one capped, build-time `public/feed.json`, and writes
RSS/Atom feed representations. The Worker now projects **that same** generated
JSON Feed into human HTML, machine JSON and negotiated Markdown.

- Every entry retains its original canonical company URL and sole attributable
  company author; the Group never creates an ActivityPub post or signs on the
  source company's behalf. The blog links to the original company Actors and
  RSS, Atom and JSON subscription surfaces.
- A required `readFeed` reader is called **only** for authorized `/blog/`
  GET/HEAD; other original pages keep their three source reads. The build now
  admits upstream JSON Feed 1.1 identity against the exact original company
  source URL and checks each article's canonical company origin, identifiers,
  dates and bounded fields **before** generating any RSS/Atom/JSON feeds. A
  refused feed or item is withheld, not given another company's authorship.
  A single invalid upstream item no longer brings down the entire blog.
- The same original `/blog/` TUFTE/LivingWebServer page **shows the
  source receipt to a human**: four named companies and each one's
  received/unavailable/refused status, the count of admitted and rejected
  source items, the number actually syndicated and the number outside the
  60-item cap. The application imports the same generated JSON Feed and
  input receipt that the existing publisher already produces; only authorized
  Blog GET/HEAD reads access them. HTML, Markdown and machine JSON project
  the same admitted state. A partly available feed is explicitly shown as
  partial, not converted into a claim that an unreachable publisher has no
  work. Source input is **one release-time snapshot**, not a current live
  inventory, independent article fact check or correction/withdrawal event.
- `/feed-input-receipt.json` is a public build artifact with one source
  observation per original company (received, unavailable or refused), source
  item counts where known, SHA-256 of the **decoded original HTTP response
  bytes** for received feeds, aggregated item-exclusion reasons, and separately
  the number of valid articles omitted only by the 60-item aggregate limit.
  A source reception count, accepted item count and published aggregate count
  are different observations. Streaming
  intake is capped at 2 MiB per original source. The build rejects source
  items whose declared byline differs from the declared corporate author,
  rather than quietly replacing one author's identity with another's.
- `/feed-provenance.jsonld` is a pure, deterministic PROV-O/Schema.org
  projection over that **same** bounded source admission and resulting
  syndication items. Each generated `schema:DataFeedItem` links its canonical
  original article URL, unchanged source identifier, specific source-feed
  snapshot (`urn:sha256:` of received bytes) and attributed publisher. The
  snapshot entity is itself derived from the original company feed URL.
  Identifiers are stable under input ordering and no agent invents author,
  revision, article verification, quote, correction or research attestation.
- Both artifacts are linked from the actual TUFTE blog and `llms.txt`,
  included in the original exact output digest manifest and exercised in
  deterministic build and public-read tests. They are **not** claims of
  original-archive completeness, claim-level research provenance, site
  indexation, ActivityPub delivery, rights clearance or a transparent
  correction log. Upstream post revisions and correction decisions remain
  source-owned.
- The **original main release** separately fetches the public JSON Feed,
  source-input receipt and PROV-O graph, refuses missing/redirected or
  non-JSON media responses, checks each delivered byte stream against the
  exact source-qualified artifact manifest and calls the pure
  `assayPublicFeedProjection` on those same HTTP response bodies. It verifies
  company identities, bounded snapshots, admission/omission arithmetic,
  original article and publisher references, every graph relation and absent
  forged entries. This check fails the release receiving step when public
  bytes differ or linked-data meaning was corrupted; a green branch test
  or successful Cloudflare upload is not substituted for public receiving.
  The semantic receipt explicitly leaves article fact-checking, signed
  federation delivery and search indexing unproved.
- **Before replacing a live release**, the same source-qualified pipeline
  reads its previous public `source-revision.json`, `feed.json`,
  `feed-input-receipt.json`, and `feed-provenance.jsonld`. It checks the
  original SHA-256 response manifest and both semantic snapshots, then
  records changed titles, summaries, dates, tags, stable identities,
  newly selected records and departures from the capped Group aggregate.
  Source-feed byte changes alone are observations, **not** evidence that any
  particular article changed. Missing old public evidence is recorded as
  unknown, never interpreted as an empty source archive.
- The original public-delivery GitHub Actions artifact additionally retains
  `observations/561.group-publication-transition-review.json` for 30 days.
  The workflow warns and marks `editorialReviewRequired` for disputed
  identities, changed represented metadata, aggregate departures or partial
  source coverage. These are **proposed review obligations**, not automatic
  editorial judgments: a sixty-item selection change is not an original
  withdrawal, and only subject owners may issue an actual correction or
  retraction. The record contains old and proposed metadata for comparison,
  but it is not a complete or perpetual correction ledger. The source Git
  history and upstream published editions retain their separate identities.
- The hub reflects *up to 60 articles received during the last accepted site
  build*. It is **not** a complete archive, a live crawl, or an observed
  ActivityPub delivery receipt. An empty build-time feed does not mean the
  company archives are empty.
- Original articles, their site-owned publishing and revisions, metadata,
  search and moderation remain with Science/Engineering/Operations/Services.
  Each site's original `site.json` may additionally opt into the upstream
  TUFTE `blog: true` reader projection; no duplicate source store is made.

This is intentionally separate from the open experimental political-economy
homepage work: the blog uses original main's authoritative pinned Group
content. Future source/PR reconciliation may add the research introduction
without changing who owns a published post.

## Jobs the site should make easy

| Visitor goal | Real entry |
|---|---|
| Bring research, software, AI operations or governance work | [/work/](https://561.group/work/) → [/contact/#work](https://561.group/contact/#work) |
| Explore actual projects, games, worlds and publications | [/projects/](https://561.group/projects/) |
| Read original Group writing and subscribe | [/blog/](https://561.group/blog/) → [RSS](https://561.group/feed.rss.xml) |
| Distinguish Shop, Bazaar and Market before buying | [/projects/#trade](https://561.group/projects/#trade) |
| Understand accountability and working philosophy | [/about/](https://561.group/about/) |
| Discover public machine interfaces and rights boundaries | [/for-agents/](https://561.group/for-agents/) |
| Submit a human inquiry, supplier offer or public report | [/contact/](https://561.group/contact/) |

Service areas are invitations to scope an actual job—not standing quotes, accepted orders, completed customer outcomes or proof of a scientific result. Public discovery never authorizes software to buy, publish or execute private operations. The recurring sustaining-support checkout is a separate subscription.

## Original sources → one public site

- `data/home.json` owns organization identity, founding, companies, program, authored material-world position, current public support terms and selected featured project identities.
- `data/estate.json` owns projects, published entry URLs and machine interfaces. Do not copy or invent a second project inventory.
- `data/frontdoor.json` is a typed public communication record for visitor journeys and service areas. Its provider IDs must resolve to the original four company records. It is not a new office, order book, rights grant, product or sales ledger.
- `src/home-tufte.mjs` projects those exact sources into meaningful page-specific TUFTE models and validates cross-source IDs, safe URLs and content. Agents receive those same models as JSON.
- `src/public-home-style.mjs` is the narrow/mobile, keyboard-accessible, reduced-motion and print-friendly local style, injected through TUFTE's document head. It is not a second HTML renderer.
- `src/living-home.mjs` defines the one LivingWebServer application with only five explicit authorized public HTML/JSON GET/HEAD routes.
- `src/worker.mjs` retains the original Cloudflare host, contact, locale fallback pages, live estate, source receipt and separately provisioned ActivityPub provider. The new site does not create a second listener, wallet, service actor or private inbox.
- `src/render.mjs` and `scripts/build.mjs` continue the original localized fallback, source-generated feeds, agent guide, sitemap and source-qualified artifact hashes.

**Language disclosure:** English homepage and work/project/about/agent pages use TUFTE. The separately authored Mandarin and Lakota homepage fallbacks remain the original static renderer; translations of the new pages are not claimed.

## Content is bound, not stored

Since 2026-10-24 this repository holds only the application (Worker, renderer, build and release scripts, tests, workflows). The content it publishes is Group data and lives in [561-group/561-group-frontdoor-services-section](https://github.com/561-group/561-group-frontdoor-services-section) (private): `data/*.json`, `locales/*.arb` and the authored static assets under `public/` (contact page, fonts, logo, favicon, card, touch icon). Where this README says `data/home.json`, `data/estate.json`, `data/frontdoor.json` or `locales/`, that is where the file now comes from.

`npm run bind` (`scripts/bind-content.mjs`, also run as the `pre` hook of `check`, `test`, `build`, `dev` and the other content-reading scripts) copies the data repository's `data/`, `locales/` and `public/` onto this tree from `SITE_CONTENT_ROOT`, or from `./content`. The bound files are git-ignored. CI and the production workflow check the data repository out at `./content` at a pinned commit (the `ref:` in `.github/workflows/public-intake-safety.yml` and `deploy.yml`, read with the read-only deploy key in the `SITE_CONTENT_DEPLOY_KEY` secret); to publish a content change, merge it in the data repository and bump that pin in both workflows.

```bash
git clone git@github.com:561-group/561-group-frontdoor-services-section.git content
# or: export SITE_CONTENT_ROOT=/path/to/a/checkout
npm run bind
```

## Build, run, verify

Use Node 24 or newer and the exact committed lockfile with the original scoped registry.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run install:observation # isolated Node observer supplier lock
npm run bind        # needs ./content or SITE_CONTENT_ROOT, see above
npm run check
npm test
npm run build
npm run dev
```

The native test suite exercises the original TUFTE/LivingWebServer HTML, JSON and HEAD representations; human pathways, real company and project references; honest service scopes; Worker route and ActivityPub body boundaries; source-generated language, agent and sitemap artifacts. Source CI also performs a genuine Wrangler Worker **dry run**, never a PR-to-production deployment.

The original serialized production workflow accepts a successful exact-main qualification (or an expressly selected main release), rechecks the frozen dependencies and original build, deploys the configured Cloudflare Worker, and separately reads the live source revision, HTML, JSON, generated-asset SHA-256 digests and Cloudflare active Worker version. The Group must not confuse a green PR, an HTTP response, a deploy, and a customer-received useful result.

## Operating search-conformance observation

The existing post-release `scripts/observe-production.mjs` consumes the original
Website Administration reader `0.2.2-dev.1`. Its bounded HTTP observations feed
that supplier's `projectSiteConformance` for the homepage, work, projects,
about, agent and contact entrypoints. Each is explicitly expected to be
indexable and self-canonical. The same sampled page and robots responses
provide Googlebot access, noindex and canonical evidence without extra probes.
Unsupported or incomplete readings remain unknown; a measured fault remains
actionable even when another check is unknown.

The original report retains the native `searchConformance` product and its
evidence references. Public HTTP observations establish neither Google's
indexed state nor resolution of provider notices with unknown affected URLs.
The public release supplies no private mailbox content; recurring mailbox
intake remains with the existing private conformance application.

`scripts/site-observation` holds only the observer's private Node dependency
closure and direct upstream imports. Its frozen lock leaves the deployed
Worker's original package lock intact. The source, release, public-observation
and recovery workflows install this same closure before using the observer.

Follow the original receiving [issue #17](https://github.com/561-group/561.group/issues/17) for genuine user, accessibility, commerce and content outcomes. Improve the real pages, not just the CI machinery.
