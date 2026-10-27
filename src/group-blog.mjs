// Source-admitted, immutable blog reading over the Group's existing generated
// JSON Feed, which is built only from the four original company publications.
// This is not a separate feed scraper, author account, CMS or ActivityPub actor.
export const GROUP_BLOG_LIMIT = 60;
const MAX_TITLE = 512;
const MAX_SUMMARY = 4096;

function validPublicUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError(label + " requires a public HTTPS URL"); }
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname.includes("//") ||
      url.href !== value) {
    throw new TypeError(label + " requires a canonical public HTTPS URL");
  }
  return url;
}

export function admitGroupBlogFeed(home, feed) {
  if (home?.origin !== "https://561.group" ||
      !Array.isArray(home.group?.companies) || home.group.companies.length !== 4) {
    throw new TypeError("Group blog needs the original four corporate source identities");
  }
  if (!feed || feed.version !== "https://jsonfeed.org/version/1.1" ||
      feed.home_page_url !== home.origin + "/" ||
      feed.feed_url !== home.origin + "/feed.json" ||
      !Array.isArray(feed.items) || feed.items.length > GROUP_BLOG_LIMIT) {
    throw new TypeError("Group blog requires the original bounded generated JSON Feed");
  }
  const owners = new Map(home.group.companies.map(company => [
    validPublicUrl(company.url, "Company").origin, company
  ]));
  if (owners.size !== 4) throw new TypeError("Group blog company origins must be distinct");
  const seen = new Set();
  const items = feed.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof item.title !== "string" || !item.title.trim() ||
        item.title.length > MAX_TITLE ||
        (item.summary !== undefined && (typeof item.summary !== "string" ||
          item.summary.length > MAX_SUMMARY))) {
      throw new TypeError("Group blog item must have a bounded original title and summary");
    }
    const url = validPublicUrl(item.url, "Blog article");
    const owner = owners.get(url.origin);
    if (!owner || !url.pathname.endsWith("/") ||
        !Array.isArray(item.authors) || item.authors.length !== 1 ||
        item.authors[0]?.url !== owner.url || item.authors[0]?.name !== owner.name ||
        seen.has(url.href)) {
      throw new TypeError("Group blog article must belong to one original source owner");
    }
    if (item.date_published !== undefined &&
        (typeof item.date_published !== "string" ||
         !Number.isFinite(Date.parse(item.date_published)))) {
      throw new TypeError("Group blog cannot invent or misstate publication dates");
    }
    if (item.date_modified !== undefined &&
        (typeof item.date_modified !== "string" ||
         !Number.isFinite(Date.parse(item.date_modified)))) {
      throw new TypeError("Group blog cannot invent or misstate modification dates");
    }
    seen.add(url.href);
    // Original CAIRN site-home records legitimately enter the shared feed,
    // but a company homepage is not an independently published blog post.
    if (url.pathname === "/") return null;
    return Object.freeze({
      url:url.href, title:item.title.trim(), company:owner,
      ...(item.summary === undefined ? {} : {summary:item.summary}),
      ...(item.date_published === undefined ? {} : {published:item.date_published}),
      ...(item.date_modified === undefined ? {} : {modified:item.date_modified}),
    });
  }).filter(Boolean);
  // The same source assembler already sorts; do not silently change it into
  // another purported timestamp order when a feed item lacks a date.
  return Object.freeze({
    items:Object.freeze(items),
    companies:Object.freeze([...home.group.companies]),
    coverage:"bounded-build-snapshot",
  });
}
