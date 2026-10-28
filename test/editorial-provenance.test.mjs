import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {renderEditorialQuestionProvenance,assayEditorialQuestionProvenance,compareEditorialQuestionSnapshots,EDITORIAL_GRAPH_PATH,EDITORIAL_GRAPH_SCHEMA} from "../src/editorial-question-provenance.mjs";

const home=JSON.parse(readFileSync(new URL("../data/home.json",import.meta.url),"utf8"));
const bytes=readFileSync(new URL("../data/frontdoor.json",import.meta.url));
const frontdoor=JSON.parse(bytes.toString("utf8"));
const digest=createHash("sha256").update(bytes).digest("hex");
const project=()=>JSON.parse(renderEditorialQuestionProvenance(home,frontdoor,digest));
const assay=graph=>assayEditorialQuestionProvenance({home,frontdoor,frontdoorSha256:digest,graph});

test("six exact Group questions preserve original editorial source byte identity and company citations",()=>{
 const graph=project(),nodes=graph["@graph"].slice(1);
 const original=[...frontdoor.discovery.questions,...frontdoor.ecologicalDiscovery.questions];
 assert.equal(graph["@id"],home.origin+EDITORIAL_GRAPH_PATH);
 assert.equal(graph["@context"].prov,"http://www.w3.org/ns/prov#");
 assert.equal(graph["@type"],"schema:Dataset");
 assert.equal(graph["schema:inLanguage"],"en");
 assert.equal(graph["schema:publisher"]["@id"],home.origin+"/#organization");
 assert.equal(graph["@graph"].length,7);
 assert.deepEqual(graph["@graph"][0]["@type"],["prov:Entity","schema:CreativeWork"]);
 assert.equal(graph["@graph"][0]["@id"],"urn:sha256:"+digest);
 assert.equal(graph["@graph"][0]["schema:identifier"],"sha256:"+digest);
 assert.ok(graph["@graph"][0]["schema:url"].includes("561-group-frontdoor-services-section"));
 assert.deepEqual(graph["schema:hasPart"].map(x=>x["@id"]),nodes.map(x=>x["@id"]));
 assert.equal(new Set(nodes.map(n=>n["@id"])).size,6);
 for(const [i,node] of nodes.entries()){
   const q=original[i],answer=node["schema:suggestedAnswer"];
   assert.equal(node["@id"],home.origin+"/about/#"+q.id);
   assert.equal(node["@type"],"schema:Question");
   assert.equal(node["schema:name"],q.question);
   assert.equal(node["schema:about"]["@id"],q.href);
   assert.equal(node["prov:wasDerivedFrom"]["@id"],"urn:sha256:"+digest);
   assert.equal(node["schema:author"]["@id"],home.origin+"/#organization");
   assert.equal(answer["@type"],"schema:Answer");
   assert.equal(answer["schema:text"],q.answer);
   assert.equal(answer["schema:citation"]["@id"],q.href);
   assert.ok(!Object.hasOwn(node,"schema:acceptedAnswer"),"editorial suggestion is not independently accepted scientific proof");
 }
 assert.match(graph["schema:description"],/not independently attested/u);
});

test("genuine editorial projection is source-bound without invented external verification",()=>{
 const reading=assay(project());
 assert.equal(reading.schema,EDITORIAL_GRAPH_SCHEMA);
 assert.equal(reading.originalQuestions,6);
 assert.equal(reading.originalSourceContentSha256,"sha256:"+digest);
 assert.equal(reading.exactPublicProjectionReceived,true);
 assert.equal(reading.scientificClaimsIndependentlyVerified,false);
 assert.equal(reading.publisherVersionAuthenticated,false);
 assert.equal(reading.externallyIndexed,null);
 assert.equal(reading.signedFederationDelivered,null);
 assert.equal(reading.readerOutcomesObserved,null);
});

test("the original public receiver refuses forged answers, authors, citations and extra records",()=>{
 for(const mutate of [
   g=>{g["@graph"][2]["schema:suggestedAnswer"]["schema:text"]="Invented claim";},
   g=>{g["@graph"][3]["schema:about"]["@id"]="https://unrelated.example/";},
   g=>{g["@graph"][1]["prov:wasDerivedFrom"]["@id"]="urn:sha256:"+"f".repeat(64);},
   g=>{g["@graph"].push(structuredClone(g["@graph"][1]));},
   g=>{g["schema:hasPart"].pop();},
   g=>{g["@context"].prov="https://invalid.example/";},
   g=>{g["@graph"][0]["schema:identifier"]="sha256:"+"f".repeat(64);},
   g=>{g["@graph"][1]["schema:suggestedAnswer"]["@type"]="schema:ClaimReview";},
 ]){const g=project();mutate(g);assert.throws(()=>assay(g),/Unqualified original editorial provenance/u);}
 assert.throws(()=>assayEditorialQuestionProvenance({
   home,frontdoor,frontdoorSha256:"f".repeat(64),graph:project()
 }),/public source-backed graph differs/u);
});

test("editorial source itself refuses unauthorized company links and incomplete source questions",()=>{
 assert.throws(()=>renderEditorialQuestionProvenance(home,frontdoor,"badsha"),/byte digest/u);
 const forged=structuredClone(frontdoor);
 forged.discovery.questions[0].href="https://outside.example/claim/";
 assert.throws(()=>renderEditorialQuestionProvenance(home,forged,digest),/canonical original company/u);
 const duplicate=structuredClone(frontdoor);
 duplicate.ecologicalDiscovery.questions[0].id=duplicate.discovery.questions[0].id;
 assert.throws(()=>renderEditorialQuestionProvenance(home,duplicate,digest),/duplicate/u);
 const missing=structuredClone(frontdoor);
 missing.discovery.questions.pop();
 assert.throws(()=>renderEditorialQuestionProvenance(home,missing,digest),/exact original editorial question/u);
});

test("original About and machine guides expose the one generated JSON-LD graph",()=>{
 const page=readFileSync(new URL("../src/home-tufte.mjs",import.meta.url),"utf8");
 const guide=readFileSync(new URL("../src/render.mjs",import.meta.url),"utf8");
 assert.match(page,/alternate\("application\/ld\+json","Source-backed public questions and citations","\/editorial-question-provenance\.jsonld"\)/u);
 assert.match(page,/anchor\("\/editorial-question-provenance\.jsonld","Source-bound public questions and citations/u);
 assert.match(guide,/editorial-question-provenance\.jsonld/u);
});

const compare=(oldGraph,newGraph)=>compareEditorialQuestionSnapshots({
  home,previous:oldGraph,proposed:newGraph,observedAt:"2026-10-27T23:59:00.000Z"
});

test("same public editorial questions do not invent an authorized correction",()=>{
  const reading=compare(project(),project());
  assert.equal(reading.schema,"561.group/editorial-question-transition-review/v1");
  assert.equal(reading.editorialReviewRequired,false);
  assert.deepEqual(reading.counts,{contentOrCitationChanges:0,introduced:0,
    omitted:0,orderChanged:false});
  assert.deepEqual(reading.changes,[]);
  assert.equal(reading.correctionPublished,false);
  assert.equal(reading.editorialDecision,"not-admitted");
});

test("unrelated original editorial source bytes can change without six question edits",()=>{
  const other=JSON.parse(JSON.stringify(frontdoor));
  other.proposition+=" (change to unrelated original homepage copy)";
  const revised=JSON.parse(renderEditorialQuestionProvenance(home,other,"f".repeat(64)));
  const reading=compare(project(),revised);
  assert.equal(reading.sourceBytesChanged,true);
  assert.equal(reading.editorialReviewRequired,false);
  assert.equal(reading.counts.contentOrCitationChanges,0);
});

test("changed original editorial answer and company research citation trigger review, not auto-retraction",()=>{
  const edited=JSON.parse(JSON.stringify(frontdoor));
  edited.discovery.questions[0].answer="Proposed explanatory revision requiring original editorial review";
  edited.discovery.questions[0].href="https://science.561.group/";
  const changed=JSON.parse(renderEditorialQuestionProvenance(home,edited,"e".repeat(64)));
  const reading=compare(project(),changed);
  assert.equal(reading.editorialReviewRequired,true);
  assert.equal(reading.counts.contentOrCitationChanges,1);
  assert.deepEqual(reading.changes[0].changedFields,["answer","citation"]);
  assert.equal(reading.changes[0].previous.citation,
    frontdoor.discovery.questions[0].href);
  assert.equal(reading.changes[0].proposed.citation,"https://science.561.group/");
  assert.equal(reading.correctionPublished,false);
});

test("reordered original published questions are not silently treated as unchanged",()=>{
  const reordered=JSON.parse(JSON.stringify(frontdoor));
  const first=reordered.discovery.questions[0];
  reordered.discovery.questions[0]=reordered.discovery.questions[1];
  reordered.discovery.questions[1]=first;
  const reading=compare(project(),JSON.parse(
    renderEditorialQuestionProvenance(home,reordered,"d".repeat(64))));
  assert.equal(reading.counts.orderChanged,true);
  assert.equal(reading.counts.contentOrCitationChanges,0);
  assert.equal(reading.editorialReviewRequired,true);
  assert.equal(reading.correctionPublished,false);
});

test("an inserted false prior source identity or foreign citation cannot masquerade as an editorial change",()=>{
  const forged=project();
  forged["@graph"][0]["schema:identifier"]="sha256:"+"f".repeat(64);
  assert.throws(()=>compare(forged,project()),/source content identity/u);
  const citation=project();
  citation["@graph"][1]["schema:about"]["@id"]="https://outside.example/bogus/";
  citation["@graph"][1]["schema:suggestedAnswer"]["schema:citation"]["@id"]=
    "https://outside.example/bogus/";
  assert.throws(()=>compare(citation,project()),/canonical company/u);
  const missing=project();
  missing["@graph"][1]["prov:wasDerivedFrom"]["@id"]=
    "urn:sha256:"+"c".repeat(64);
  assert.throws(()=>compare(missing,project()),/identity, author, answer or derivation/u);
});


test("original release runs real editorial revision review before Wrangler, retaining its typed source record",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/deploy.yml",import.meta.url),"utf8");
  const start=workflow.indexOf("      - name: Observe previous public feed before replacing it; route changes to editorial review");
  const wrangler=workflow.indexOf("      - uses: cloudflare/wrangler-action@v3",start);
  assert.ok(start>0&&wrangler>start);
  const section=workflow.slice(start,wrangler);
  const script=section.match(/          node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE\n/u);
  assert.ok(script,"one original typed inline release program must exist");
  const source=script[1].split("\n").map(line=>
    line.startsWith("          ")?line.slice(10):line).join("\n");
  const result=spawnSync(process.execPath,["--check","--input-type=module"],
    {input:source,encoding:"utf8",timeout:10000});
  assert.equal(result.status,0,result.stderr);
  for(const term of [
    "const sourceFrontdoorBytes=await readFile('data/frontdoor.json')",
    "frontdoorSha256:originalFrontdoorSha256,graph:proposedEditorial",
    "revision.artifactDigests?.['editorial-question-provenance.jsonld']",
    "previous.editorialGraph=priorEditorial.body",
    "compareEditorialQuestionSnapshots({",
    "report.editorialQuestions=editorialReview",
    "editorialReview.editorialReviewRequired",
    "observations/561.group-publication-transition-review.json",
    "correctionPublished:false",
  ])assert.ok(section.includes(term),"exact predeploy review missing "+term);
});
