/** A localized authored HTML file may have a same-origin canonical slash
 * redirect at the Cloudflare assets layer. That is not permission to redirect
 * JSON evidence, feeds, or arbitrary generated assets. Content authenticity
 * is checked separately against exact public SHA-256 bytes after this check.
 */
export function qualifyPublicAssetReadPath({origin,path,redirected,responseUrl,contentType}) {
  if(origin!=="https://561.group" || typeof path!=="string" || !path ||
     typeof redirected!=="boolean")
    throw new TypeError("Public artifact route requires exact origin, path and redirect reading");
  if(!redirected) return Object.freeze({mode:"direct"});
  const locale=({"zh-hans/index.html":"zh-hans","lkt/index.html":"lkt"})[path];
  if(!locale || typeof responseUrl!=="string" ||
     !(contentType??"").toLowerCase().startsWith("text/html"))
    throw new TypeError("Only authored localized HTML may follow a canonical public redirect");
  let final;
  try { final=new URL(responseUrl); } catch {
    throw new TypeError("Localized canonical redirect requires an observed public URL");
  }
  if(final.origin!==origin || final.username || final.password ||
     final.search || final.hash || !final.pathname.startsWith("/"+locale+"/"))
    throw new TypeError("Localized public redirect left its canonical language scope");
  return Object.freeze({mode:"localized-html-redirect",canonical:final.href});
}

/** LivingWebServer's Markdown projector escapes hyphens as \- within
 * ordinary source words (e.g., "60\-item"). Those escape markers are
 * presentation syntax, not differences in the received publication counts.
 * Normalize only this reversible Markdown escape, not digits or prose.
 */
export function normalizeMarkdownLiteralHyphens(value) {
  if (typeof value !== "string")
    throw new TypeError("Public Markdown coverage must be received as text");
  return value.replaceAll("\\-", "-");
}

// Read-only release assay for the ONE Group publisher: verifies the same
// source-qualified feed, input receipt and PROV-O graph after public HTTP
// readback. No new publisher, crawler, author or federation identity.
const SHA = /^sha256:[a-f0-9]{64}$/u;
const ID = /^urn:sha256:[a-f0-9]{64}$/u;
const REF = id => ({ "@id": id });
const fail = message => { throw new TypeError("Unreceived public feed evidence: " + message); };
const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const typed = (node, kind) => node?.["@type"] === kind ||
  (Array.isArray(node?.["@type"]) && node["@type"].includes(kind));

export function assayPublicFeedProjection({ home, feed, receipt, graph }) {
  if (home?.origin !== "https://561.group" ||
      !Array.isArray(home.group?.companies) || home.group.companies.length !== 4)
    fail("original four companies are required");
  const companies = home.group.companies;
  if (receipt?.schema !== "561.group/feed-input-receipt/v1" ||
      receipt.origin !== home.origin ||
      receipt.expectedSourceCount !== companies.length ||
      !Array.isArray(receipt.sources) || receipt.sources.length !== companies.length)
    fail("source receipt identity or original source count");
  const received = new Map();
  for (let i = 0; i < companies.length; i++) {
    const source = receipt.sources[i], company = companies[i];
    if (!isRecord(source) || source.companyId !== company.id ||
        source.feedUrl !== company.feeds?.json ||
        !["received", "refused", "unavailable"].includes(source.state))
      fail("source order, custody or state at " + i);
    if (source.state === "received") {
      if (!SHA.test(source.sha256) || !Number.isSafeInteger(source.bytes) ||
          source.bytes < 0 || source.bytes > 2 * 1024 * 1024 ||
          !Number.isSafeInteger(source.inputItems) ||
          source.inputItems < 0 || source.inputItems > 500)
        fail("received feed lacks witnessed bounded bytes or source count");
      received.set(company.id, source);
    } else if (source.sha256 !== undefined || source.inputItems !== undefined)
      fail("unreceived source claims input evidence");
  }
  const coverage = received.size === companies.length ?
    "all-sources-received" : "partial-source-coverage";
  if (receipt.completeness !== coverage) fail("false completeness");
  const sourceItemCount = [...received.values()].reduce((n, s) => n + s.inputItems, 0);
  if (!isRecord(receipt.excludedItemCounts)) fail("missing exclusion accounting");
  let excluded = 0;
  for (const [kind, count] of Object.entries(receipt.excludedItemCounts)) {
    if (!/^[a-z][a-z0-9-]{0,79}$/u.test(kind) ||
        !Number.isSafeInteger(count) || count < 1)
      fail("malformed exclusion accounting");
    excluded += count;
  }
  const admitted = sourceItemCount - excluded;
  if (admitted < 0 || receipt.sourceItemCount !== sourceItemCount ||
      receipt.admittedItems !== admitted ||
      !Number.isSafeInteger(receipt.emittedItems) ||
      receipt.emittedItems < 0 || receipt.emittedItems > 60 ||
      receipt.omittedByAggregateLimit !== admitted - receipt.emittedItems ||
      receipt.omittedByAggregateLimit < 0)
    fail("source, admission, omission and selected counts disagree");
  if (feed?.version !== "https://jsonfeed.org/version/1.1" ||
      feed.home_page_url !== home.origin + "/" ||
      feed.feed_url !== home.origin + "/feed.json" ||
      !Array.isArray(feed.items) || feed.items.length !== receipt.emittedItems)
    fail("public feed identity or emitted selection disagrees");

  if (graph?.["@id"] !== home.origin + "/feed-provenance.jsonld" ||
      graph["@context"]?.prov !== "http://www.w3.org/ns/prov#" ||
      graph["@context"]?.schema !== "https://schema.org/" ||
      !Array.isArray(graph["@graph"]))
    fail("public JSON-LD identity and context");
  const datafeeds = graph["@graph"].filter(x => typed(x, "schema:DataFeed"));
  const entities = graph["@graph"].filter(x => x?.["@type"] === "prov:Entity");
  const entries = graph["@graph"].filter(x => typed(x, "schema:DataFeedItem"));
  if (datafeeds.length !== 1 ||
      datafeeds[0]["@id"] !== feed.feed_url ||
      entities.length !== received.size ||
      entries.length !== feed.items.length)
    fail("feed and provenance node cardinality");
  const unique = new Set(graph["@graph"].map(x => x?.["@id"]));
  if (unique.size !== graph["@graph"].length ||
      [...unique].some(x => typeof x !== "string" || !x.trim()))
    fail("unidentified or duplicate graph nodes");

  const snapshots = new Map();
  for (const [id, source] of received) {
    const snapshotId = "urn:sha256:" + source.sha256.slice(7);
    if (!ID.test(snapshotId)) fail("source snapshot identifier");
    const entity = entities.find(x => x["@id"] === snapshotId);
    if (!entity || entity["prov:wasDerivedFrom"]?.["@id"] !== source.feedUrl ||
        entity["schema:contentSize"] !== String(source.bytes) + " B" ||
        entity["schema:encodingFormat"] !== "application/feed+json")
      fail("source feed bytes are not traceable to their original origin");
    snapshots.set(id, snapshotId);
  }
  if (entities.some(x => ![...snapshots.values()].includes(x["@id"])))
    fail("source graph has an unobserved snapshot");
  if (JSON.stringify(datafeeds[0]["prov:wasDerivedFrom"]) !==
      JSON.stringify([...snapshots.values()].map(REF)))
    fail("aggregate source-feed snapshot list changed");

  const referencedItems = [];
  const seenUrls = new Set(), seenItemIds = new Set();
  for (const item of feed.items) {
    if (!isRecord(item) || typeof item.url !== "string" ||
        typeof item.id !== "string" || !item.id ||
        !Array.isArray(item.authors) || item.authors.length !== 1)
      fail("malformed syndicated entry");
    // Reconstruct the public reader's bounded source summary independently
    // of the producer. JSON Feed 1.1 needs content; a copied HTML body,
    // invented prose, or an altered original link is not a received edition.
    const sourceSummary=typeof item.summary==="string"&&item.summary.trim()
      ? "Publisher-supplied summary: "+item.summary.trim()+"\n\n" : "";
    const expectedText=sourceSummary+"Read the complete original article: "+item.url;
    if(item.content_html!==undefined || item.content_text!==expectedText)
      fail("JSON Feed content must be the bounded source summary and original link");
    if (seenUrls.has(item.url) || seenItemIds.has(item.id))
      fail("duplicate syndicated URL or original identifier");
    seenUrls.add(item.url); seenItemIds.add(item.id);
    const company = companies.find(x => x.url === item.authors[0]?.url &&
      x.name === item.authors[0]?.name);
    if (!company || !received.has(company.id) ||
        new URL(item.url).origin !== new URL(company.url).origin)
      fail("syndicated author or article not admitted by original company");
    const entryId = feed.feed_url + "#item-" +
      createHashOfUrl(item.url);
    const entity = entries.find(x => x["@id"] === entryId);
    if (!entity || entity["schema:item"]?.["@id"] !== item.url ||
        entity["schema:identifier"] !== item.id ||
        entity["prov:wasDerivedFrom"]?.["@id"] !== snapshots.get(company.id) ||
        entity["prov:wasAttributedTo"]?.["@id"] !== company.url ||
        (item.date_published !== undefined &&
         entity["schema:datePublished"] !== item.date_published) ||
        (item.date_modified !== undefined &&
         entity["schema:dateModified"] !== item.date_modified))
      fail("item source/author/date lineage does not match original feed");
    referencedItems.push(REF(entryId));
  }
  if (JSON.stringify(datafeeds[0]["schema:dataFeedElement"]) !==
      JSON.stringify(referencedItems))
    fail("aggregate item list and original provenance graph differ");
  return Object.freeze({
    schema: "561.group/public-feed-receiving/v1",
    origin: home.origin,
    observedSourceFeeds: received.size,
    sourceItems: sourceItemCount,
    admittedItems: admitted,
    excludedItems: excluded,
    omittedByAggregateLimit: receipt.omittedByAggregateLimit,
    emittedItems: feed.items.length,
    semanticProjectionReceived: true,
    independentlyFactChecked: false,
    externallyIndexed: null,
    signedFederationDelivered: null,
  });
}

// This deterministic exact URL identity matches the original build's
// createHash('sha256').update(item.url).digest('hex'), without any network I/O.
import { createHash } from "node:crypto";
function createHashOfUrl(url) {
  return createHash("sha256").update(url).digest("hex");
}


/** Compare two separately attested Group feed snapshots. This is NOT an
 * article-body diff, upstream archive, editorial correction or retraction.
 * An aggregate exit is ambiguous under the original sixty-item cap. */
export function comparePublicFeedRevisions({home,previous,proposed,observedAt}){
  for(const [label,snapshot] of [["previous",previous],["proposed",proposed]]){
    if(!snapshot?.sourceRevision ||
       snapshot.sourceRevision.repository!=="561-group/561.group" ||
       snapshot.sourceRevision.origin!==home?.origin ||
       !/^[a-f0-9]{40}$/u.test(snapshot.sourceRevision.sourceCommit??""))
      fail("missing exact "+label+" release identity");
    assayPublicFeedProjection({home,feed:snapshot.feed,
      receipt:snapshot.receipt,graph:snapshot.graph});
  }
  if(typeof observedAt!=="string"||!Number.isFinite(Date.parse(observedAt)))
    fail("transition requires an explicit observation timestamp");
  const past=previous.feed.items,now=proposed.feed.items;
  const nowByUrl=new Map(now.map(item=>[item.url,item]));
  const nowById=new Map(now.map(item=>[item.id,item]));
  const pastUrls=new Set(past.map(item=>item.url));
  const pastIds=new Set(past.map(item=>item.id));
  const metadataFields=["title","summary","date_published","date_modified","tags","authors"];
  const revisions=[],identityChanges=[],aggregateExits=[],newlySelected=[];
  let unchanged=0;
  for(const old of past){
    const sameUrl=nowByUrl.get(old.url),sameId=nowById.get(old.id);
    if(sameUrl?.id===old.id){
      const fields=metadataFields.filter(field=>
        JSON.stringify(old[field]??null)!==JSON.stringify(sameUrl[field]??null));
      if(fields.length)revisions.push({url:old.url,id:old.id,changedFields:fields,
        previous:old,proposed:sameUrl});
      else unchanged++;
    }else if(sameUrl||sameId){
      const candidate=sameUrl??sameId;
      identityChanges.push({previous:{id:old.id,url:old.url},
        proposed:{id:candidate.id,url:candidate.url},
        classification:sameUrl?"same-url-new-id":"same-id-new-url"});
    }else{
      aggregateExits.push({id:old.id,url:old.url,
        classification:"absent-from-new-sixty-item-aggregate",
        qualification:"Not evidence of deletion, correction or retraction"});
    }
  }
  for(const item of now)if(!pastUrls.has(item.url)&&!pastIds.has(item.id))
    newlySelected.push({id:item.id,url:item.url});
  const byUrl=(a,b)=>(a.url??a.previous.url).localeCompare(b.url??b.previous.url);
  for(const list of [revisions,identityChanges,aggregateExits,newlySelected])
    list.sort(byUrl);
  const sourceChanges=previous.receipt.sources.map((source,i)=>{
    const next=proposed.receipt.sources[i];
    return {companyId:source.companyId,previousState:source.state,
      proposedState:next.state,previousSha256:source.sha256??null,
      proposedSha256:next.sha256??null,
      snapshotChanged:source.state!==next.state||source.sha256!==next.sha256};
  });
  const coverageComplete=previous.receipt.completeness==="all-sources-received" &&
    proposed.receipt.completeness==="all-sources-received";
  const editorialReviewRequired=!coverageComplete||revisions.length>0||
    identityChanges.length>0||aggregateExits.length>0;
  return {
    schema:"561.group/publication-transition-review/v1",observedAt,
    scope:"Capped public feed metadata only; no original article text, corrections, full archives, index, signed federation or readership",
    previousRelease:{sourceCommit:previous.sourceRevision.sourceCommit,
      workerVersionId:previous.sourceRevision.workerVersionId??null},
    proposedRelease:{sourceCommit:proposed.sourceRevision.sourceCommit,deployed:false},
    coverageBefore:previous.receipt.completeness,
    coverageProposed:proposed.receipt.completeness,
    sourceChanges,
    counts:{previousSelected:past.length,proposedSelected:now.length,
      unchanged,metadataRevisions:revisions.length,
      identityConflicts:identityChanges.length,
      aggregateExits:aggregateExits.length,newlySelected:newlySelected.length},
    editorialReviewRequired,editorialDecision:"not-admitted",
    originalCorrectionPublished:false,
    metadataRevisions:revisions,identityChanges,aggregateExits,newlySelected,
  };
}
