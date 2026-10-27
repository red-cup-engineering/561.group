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


/** Reader-readable description of the SAME build's public input receipt.
 * This refuses claims of complete coverage that lack all original publisher
 * source observations. It is not a fresh fetch, fact-check, correction
 * acceptance, or a claim that sixty items represent the whole archive. */
export function admitGroupBlogCoverage(home,feed,receipt){
  if(home?.origin!=="https://561.group"||
     !Array.isArray(home.group?.companies)||home.group.companies.length!==4||
     !receipt||receipt.schema!=="561.group/feed-input-receipt/v1"||
     receipt.origin!==home.origin||receipt.expectedSourceCount!==4||
     !Array.isArray(receipt.sources)||receipt.sources.length!==4)
    throw new TypeError("Blog source coverage requires the original four-company build receipt");
  const companies=home.group.companies;
  const digest=/^sha256:[a-f0-9]{64}$/u;
  const validCount=n=>Number.isSafeInteger(n)&&n>=0;
  let observedItems=0,received=0;
  const sources=companies.map((company,i)=>{
    const entry=receipt.sources[i];
    if(!entry||entry.companyId!==company.id||
       entry.feedUrl!==company.feeds?.json||
       !["received","unavailable","refused"].includes(entry.state))
      throw new TypeError("Blog input receipt does not preserve original source order and custody");
    if(entry.state==="received"){
      if(!validCount(entry.inputItems)||!validCount(entry.bytes)||
         entry.bytes>2*1024*1024||!digest.test(entry.sha256))
        throw new TypeError("Blog source lacks bounded original feed evidence");
      observedItems+=entry.inputItems;
      received++;
    }else if(entry.inputItems!==undefined||entry.bytes!==undefined||
             entry.sha256!==undefined)
      throw new TypeError("Unread company feeds cannot claim observed content or bytes");
    return Object.freeze({company,state:entry.state,
      ...(entry.state==="received"?{inputItems:entry.inputItems}:{})});
  });
  if(!receipt.excludedItemCounts||typeof receipt.excludedItemCounts!=="object"||
     Array.isArray(receipt.excludedItemCounts))
    throw new TypeError("Blog build cannot hide invalid feed-exclusion counts");
  let rejected=0;
  for(const [reason,count] of Object.entries(receipt.excludedItemCounts)){
    if(!/^[a-z][a-z0-9-]{0,79}$/u.test(reason)||!Number.isSafeInteger(count)||count<1)
      throw new TypeError("Blog exclusion accounting is malformed");
    rejected+=count;
  }
  const admitted=observedItems-rejected;
  if(!validCount(receipt.sourceItemCount)||
     !validCount(receipt.admittedItems)||
     !validCount(receipt.emittedItems)||
     !validCount(receipt.omittedByAggregateLimit)||
     !Array.isArray(feed?.items)||
     observedItems!==receipt.sourceItemCount||
     admitted<0||admitted!==receipt.admittedItems||
     feed.items.length!==receipt.emittedItems||
     receipt.emittedItems!==Math.min(admitted,GROUP_BLOG_LIMIT)||
     admitted-receipt.emittedItems!==receipt.omittedByAggregateLimit)
    throw new TypeError("Blog received and selected article counts disagree");
  const complete=received===4;
  if(receipt.completeness!==(complete?"all-sources-received":"partial-source-coverage"))
    throw new TypeError("Blog source snapshot claims unwitnessed completeness");
  return Object.freeze({sources:Object.freeze(sources),
    received,expected:4,observedItems,admitted,rejected,
    selected:receipt.emittedItems,omittedByLimit:receipt.omittedByAggregateLimit,
    complete});
}
