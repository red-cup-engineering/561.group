// A machine projection of the ONE Group editorial source, not a new claims
// database, fact-checker, search ranking assertion or publisher. Each answer
// is the text already authored in the original Group front-door JSON.
export const EDITORIAL_GRAPH_PATH="/editorial-question-provenance.jsonld";
export const EDITORIAL_GRAPH_SCHEMA="561.group/source-authored-question-provenance/v1";
const SOURCE_PATH="https://github.com/561-group/561-group-frontdoor-services-section/blob/main/data/frontdoor.json";
const SHA256=/^[a-f0-9]{64}$/u;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SOURCE_GROUPS=[
  ["discovery","political-economy"],
  ["ecologicalDiscovery","ecology-and-adaptation"],
];
const fail=reason=>{throw new TypeError("Unqualified original editorial provenance: "+reason);};
const REF=id=>({"@id":id});
function sourceQuestions(home,frontdoor) {
  if(home?.origin!=="https://561.group" ||
     !Array.isArray(home.group?.companies)||home.group.companies.length!==4)
    fail("one Group source with four original company publishers is required");
  const origins=new Set(home.group.companies.map(c=>c.url));
  if(origins.size!==4)fail("original company origins must be distinct");
  const seen=new Set();
  return SOURCE_GROUPS.flatMap(([key,section])=>{
    const collection=frontdoor?.[key];
    if(!collection||!Array.isArray(collection.questions)||
       collection.questions.length!==3)fail("exact original editorial question sets are required: "+key);
    return collection.questions.map(q=>{
      if(!q||!SLUG.test(q.id??"")||seen.has(q.id)||
         !["question","answer","href","label"].every(field=>
           typeof q[field]==="string" && q[field].trim())||
         q.question.length>512||q.answer.length>8192)
        fail("duplicate, missing, overlong or ill-formed original editorial question");
      let target;
      try{target=new URL(q.href);}catch{fail("editorial citation has no valid URL");}
      if(target.protocol!=="https:"||target.username||target.password||
         target.search||target.hash||target.href!==q.href||
         !origins.has(target.origin+"/"))
        fail("editorial citation must link to a canonical original company public source");
      seen.add(q.id);
      return {section,id:q.id,question:q.question,answer:q.answer,
        href:q.href,label:q.label};
    });
  });
}

/** Source byte digest identifies the EXACT original frontdoor.json consumed
 * by this site, not a Git SHA of the application and not a scientific proof.
 * Link destinations remain citations chosen by the original editor. */
export function renderEditorialQuestionProvenance(home,frontdoor,frontdoorSha256){
  if(!SHA256.test(frontdoorSha256??""))fail("immutable original editorial byte digest required");
  const questions=sourceQuestions(home,frontdoor);
  const sourceId="urn:sha256:"+frontdoorSha256;
  const graphId=home.origin+EDITORIAL_GRAPH_PATH;
  const questionNodes=questions.map(q=>{
    const id=home.origin+"/about/#"+q.id;
    return {
      "@id":id,"@type":"schema:Question",
      "schema:name":q.question,
      "schema:keywords":q.section,
      "schema:author":REF(home.origin+"/#organization"),
      "schema:about":REF(q.href),
      "prov:wasDerivedFrom":REF(sourceId),
      "schema:suggestedAnswer":{
        "@type":"schema:Answer","schema:text":q.answer,
        "schema:citation":REF(q.href),
        "schema:description":"Original Group editorial explanation citing a related primary publisher reading; not an independently established scientific fact."
      }
    };
  });
  const graph={
    "@context":{"schema":"https://schema.org/","prov":"http://www.w3.org/ns/prov#"},
    "@id":graphId,"@type":"schema:Dataset",
    "schema:name":"561 Group source-authored public questions and cited readings",
    "schema:inLanguage":"en",
    "schema:description":"Six original editorial questions, suggested answers, and publisher citations. Source byte identity is checked; the research claims, current publisher version, rights, outside indexing and outcomes are not independently attested here.",
    "schema:publisher":REF(home.origin+"/#organization"),
    "schema:isBasedOn":REF(home.origin+"/about/"),
    "schema:hasPart":questionNodes.map(node=>REF(node["@id"])),
    "@graph":[
      {"@id":sourceId,"@type":["prov:Entity","schema:CreativeWork"],
        "schema:name":"Original Group source-owned front-door editorial JSON",
        "schema:url":SOURCE_PATH,
        "schema:identifier":"sha256:"+frontdoorSha256,
        "schema:encodingFormat":"application/json",
        "schema:description":"Immutable digest of the original authored JSON bytes, not an independently checked article or a claim of current Git branch revision."},
      ...questionNodes
    ]
  };
  return JSON.stringify(graph,null,2)+"\n";
}

/** Exact-source semantic assent on the SAME public response bytes.
 * Unknown/extra graph entities and changed answer/citation text are refused.
 * This says only that the readback matches authored editorial bytes. */
export function assayEditorialQuestionProvenance({home,frontdoor,frontdoorSha256,graph}){
  const expected=JSON.parse(renderEditorialQuestionProvenance(home,frontdoor,frontdoorSha256));
  if(JSON.stringify(graph)!==JSON.stringify(expected))
    fail("public source-backed graph differs from original editorial questions");
  return Object.freeze({
    schema:EDITORIAL_GRAPH_SCHEMA,originalQuestions:6,
    originalSourceContentSha256:"sha256:"+frontdoorSha256,
    exactPublicProjectionReceived:true,
    scientificClaimsIndependentlyVerified:false,
    publisherVersionAuthenticated:false,
    externallyIndexed:null,
    signedFederationDelivered:null,
    readerOutcomesObserved:null
  });
}


/** Read a previously PUBLIC, exact release-digest-bound editorial graph.
 * Its earlier authored source bytes are not available here, so this checks
 * internal original contract only, without pretending to re-fact-check it. */
function readEditorialSnapshot(graph,home) {
  const root=home?.origin+EDITORIAL_GRAPH_PATH;
  if(!graph||graph["@id"]!==root||graph["@type"]!=="schema:Dataset"||
     graph["@context"]?.prov!=="http://www.w3.org/ns/prov#"||
     graph["@context"]?.schema!=="https://schema.org/"||
     !Array.isArray(graph["@graph"])||graph["@graph"].length!==7||
     !Array.isArray(graph["schema:hasPart"])||graph["schema:hasPart"].length!==6)
    fail("a previous claimed public editorial graph violates original shape");
  const source=graph["@graph"][0],digest=source?.["schema:identifier"]?.slice(7);
  if(!SHA256.test(digest??"")||
     source["@id"]!=="urn:sha256:"+digest||
     source["schema:url"]!==SOURCE_PATH)
    fail("prior editorial source content identity is not attestable");
  const originalOwners=new Set(home.group.companies.map(x=>x.url));
  const indexed=new Map(),ordered=[];
  for(const node of graph["@graph"].slice(1)){
    const id=node?.["@id"];
    const qid=typeof id==="string" && id.startsWith(home.origin+"/about/#") ?
      id.slice((home.origin+"/about/#").length):"";
    const answer=node?.["schema:suggestedAnswer"];
    const cited=node?.["schema:about"]?.["@id"];
    if(!SLUG.test(qid)||indexed.has(qid)||node["@type"]!=="schema:Question"||
       !["political-economy","ecology-and-adaptation"].includes(node["schema:keywords"])||
       !node["schema:name"]?.trim()||!answer?.["schema:text"]?.trim()||
       answer["@type"]!=="schema:Answer"||
       answer["schema:citation"]?.["@id"]!==cited||
       node["prov:wasDerivedFrom"]?.["@id"]!==source["@id"]||
       node["schema:author"]?.["@id"]!==home.origin+"/#organization")
      fail("previous public question identity, author, answer or derivation invalid");
    let citation;
    try{citation=new URL(cited)}catch{fail("public question citation invalid");}
    if(citation.protocol!=="https:"||citation.search||citation.hash||
       citation.username||citation.password||citation.href!==cited||
       !originalOwners.has(citation.origin+"/"))
      fail("prior public citation is not a canonical company primary-source reading");
    indexed.set(qid,Object.freeze({
      id:qid,question:node["schema:name"],answer:answer["schema:text"],
      citation:cited,section:node["schema:keywords"]
    }));
    ordered.push(qid);
  }
  if(JSON.stringify(graph["schema:hasPart"].map(x=>x["@id"]))!==
     JSON.stringify(ordered.map(id=>home.origin+"/about/#"+id)))
    fail("original editorial graph and advertised question identifiers disagree");
  return {sourceContentSha256:digest,indexed,ordered};
}

/** One PURE before/after reading. No article edit, auto-retraction, or claim
 * verification. Public release caller must independently check BOTH graphs'
 * own exact HTTP bytes against their respective original release manifests. */
export function compareEditorialQuestionSnapshots({
  home,previous,proposed,observedAt
}={}){
  if(typeof observedAt!=="string"||!Number.isFinite(Date.parse(observedAt)))
    fail("change review requires an exact recorded timestamp");
  const before=readEditorialSnapshot(previous,home);
  const after=readEditorialSnapshot(proposed,home);
  const changes=[],introduced=[],omitted=[];
  for(const [id,old] of before.indexed){
    const next=after.indexed.get(id);
    if(!next){omitted.push(id);continue;}
    const changedFields=["question","answer","citation","section"].filter(
      field=>old[field]!==next[field]);
    if(changedFields.length)
      changes.push({id,changedFields,previous:old,proposed:next});
  }
  for(const id of after.indexed.keys())if(!before.indexed.has(id))introduced.push(id);
  const orderChanged=JSON.stringify(before.ordered)!==JSON.stringify(after.ordered);
  changes.sort((a,b)=>a.id.localeCompare(b.id));
  introduced.sort();omitted.sort();
  const editorialReviewRequired=changes.length>0||omitted.length>0||
    introduced.length>0||orderChanged;
  return {
    schema:"561.group/editorial-question-transition-review/v1",
    observedAt,
    scope:"Six source-authored About-page explanations and cited first-party readings; no original source-company article, scientific fact-check, provider version, signed update, indexing or audience effect inferred",
    previousSourceContentSha256:"sha256:"+before.sourceContentSha256,
    proposedSourceContentSha256:"sha256:"+after.sourceContentSha256,
    sourceBytesChanged:before.sourceContentSha256!==after.sourceContentSha256,
    originalQuestionCountBefore:before.ordered.length,
    originalQuestionCountProposed:after.ordered.length,
    counts:{contentOrCitationChanges:changes.length,introduced:introduced.length,
      omitted:omitted.length,orderChanged},
    editorialReviewRequired,
    editorialDecision:"not-admitted",
    correctionPublished:false,
    changes,introduced,omitted
  };
}
