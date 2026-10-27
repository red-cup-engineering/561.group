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
