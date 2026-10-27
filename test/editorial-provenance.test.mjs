import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {renderEditorialQuestionProvenance,assayEditorialQuestionProvenance,EDITORIAL_GRAPH_PATH,EDITORIAL_GRAPH_SCHEMA} from "../src/editorial-question-provenance.mjs";

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
