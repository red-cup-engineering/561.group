import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {create561GroupLivingApplication,PUBLIC_ROUTES} from "../src/living-home.mjs";

const read=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const home=read("data/home.json");
const estate={...read("data/estate.json"),revision:"installed-editorial-fixture"};
const frontdoor=read("data/frontdoor.json");
const feed={
  version:"https://jsonfeed.org/version/1.1",
  home_page_url:home.origin+"/",feed_url:home.origin+"/feed.json",
  items:[{id:"science-post-1",url:"https://science.561.group/source-bound-research/",
    title:"Source-bound research",summary:"A company-authored article.",
    date_published:"2026-10-26T11:00:00Z",
    authors:[{name:home.group.companies[0].name,url:home.group.companies[0].url}]}],
};
const htmlText=value=>String(value).replaceAll("&","&amp;").replaceAll("'","&#39;");
function fixture(){
  const reads=[];
  const app=create561GroupLivingApplication({
    releaseHome:home,
    readHome:async context=>{reads.push(["home",context.request.method]);return home;},
    readEstate:async context=>{reads.push(["estate",context.request.method]);return estate;},
    readFrontdoor:async context=>{reads.push(["frontdoor",context.request.method]);return frontdoor;},
    readFeed:async context=>{reads.push(["feed",context.request.method]);return feed;}
  });
  const request=(path="/",options={})=>app.fetch(new Request("https://561.group"+path,options));
  return {app,reads,request};
}
test("real installed TUFTE/LWS gives a useful homepage in HTML, not a pipeline receipt",async()=>{
  const f=fixture();
  const response=await f.request("/",{headers:{accept:"text/html"}});
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type")??"",/text\/html/u);
  const html=await response.text();
  assert.match(html,/<main[^>]*data-tufte/u);
  assert.ok(html.includes(frontdoor.proposition));
  assert.ok(html.includes('href="https://science.561.group/"'),
    "the original Science reader journey must be directly usable in rendered HTML");
  assert.ok(html.includes('href="https://koios.news/"'),
    "distinct independent newsroom route must not disappear");

  for(const term of ["Work with us","Bring us a problem","Persistent AI systems",
    "Indigenous data governance","Shop","Bazaar","Market","Support the Group",
    "Design for a world that does not hold still","Indigenous authority, treaty rights",
    home.public.headline,"Union of Harmonious Colonies",
    "Beyond settler-colonial governance","Toward a second lineage of living matter"]) {
    assert.ok(html.includes(term),"a visitor needs to see "+term);
  }
  for(const path of ["/work/","/projects/","/blog/","/about/","/for-agents/"])
    assert.ok(html.includes('href="'+path+'"'),"one-click meaningful journey "+path);
  assert.match(html,/rel="canonical" href="https:\/\/561\.group\/"/u);
  assert.match(html,/name="fediverse:creator"/u);
  assert.match(html,/type="application\/ld\+json"/u);
  assert.ok(html.includes(":focus-visible"));
  assert.ok(html.includes("max-width:430px"));
  assert.doesNotMatch(html,/conurbanized ecosystem|default Theme/i);
  assert.deepEqual(f.reads.map(x=>x[0]),["home","estate","frontdoor"]);
});
test("the SAME real source yields useful machine-readable TUFTE JSON",async()=>{
  const f=fixture();
  const response=await f.request("/",{headers:{accept:"application/json"}});
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type")??"",/application\/json/u);
  const model=await response.json();
  assert.equal(model.kind,"tufte.projection");
  assert.equal(model.title,home.name);
  assert.equal(model.metadata.description,home.description);
  assert.equal(model.revision,estate.revision);
  assert.ok(model.tiles.find(t=>t.id==="paths")?.html.includes('href="https://science.561.group/"'),
    "machine-readable TUFTE readers must receive the same research path");

  assert.deepEqual(model.tiles.map(t=>t.id),
    ["introduction","self-service","frontiers","paths","services","method","physical-world","explore","trade","companies","agents","support"]);
  assert.equal(model.metadata.structuredData["@graph"][0].subOrganization.length,4);
  assert.ok(model.metadata.structuredData["@graph"][0].knowsAbout.includes("Artificial Abiogenesis and Smartgoo"));
  assert.ok(model.tiles.some(t=>t.id==="frontiers" && t.html.includes("silica")));
  assert.deepEqual(f.reads.map(x=>x[0]),["home","estate","frontdoor"]);
});
test("the original five public pages serve the same source and actionable links as Markdown",async()=>{
  const f=fixture();
  for(const path of PUBLIC_ROUTES){
    const response=await f.request(path,{headers:{accept:"text/markdown"}});
    assert.equal(response.status,200,path);
    assert.match(response.headers.get("content-type")??"",/^text\/markdown/u);
    assert.match(response.headers.get("vary")??"",/Accept/iu);
    const markdown=await response.text();
    assert.match(markdown,/^# .+/mu,path+" source title after original skip link and navigation");
    assert.ok(markdown.includes("https://561.group/work/"),path+" actionable source-owned work link");
    assert.doesNotMatch(markdown,/<script|<style|application\/ld\+json/u);
    assert.equal(response.headers.has("content-signal"),false,"no inferred AI training permission");
    if(["/","/work/","/for-agents/"].includes(path)){
      for(const offer of frontdoor.selfService.examples) assert.ok(markdown.includes(offer.href),path+" exact merchant URL");
    }
    const head=await f.request(path,{method:"HEAD",headers:{accept:"text/markdown"}});
    assert.equal(head.status,200);assert.equal(await head.text(),"");
  }
  assert.equal(f.reads.length,PUBLIC_ROUTES.length*2*3+2);
  const offsite=await f.app.fetch(new Request("https://other.example/",{headers:{accept:"text/markdown"}}));
  assert.equal(offsite.status,421);
  assert.equal(f.reads.length,PUBLIC_ROUTES.length*2*3+2);
});
test("each substantive source-owned page renders different useful HTML AND JSON",async()=>{
  const f=fixture();
  const cells=[
    {path:"/work/",phrase:"Areas we can scope",id:"services"},
    {path:"/projects/",phrase:"Shop, Bazaar and Market",id:"trade"},
    {path:"/blog/",phrase:"Recent published writing",id:"posts"},
    {path:"/about/",phrase:"The four accountable companies",id:"companies"},
    {path:"/for-agents/",phrase:"Published machine-readable interfaces",id:"endpoints"}
  ];
  for(const {path,phrase,id} of cells){
    const page=await f.request(path,{headers:{accept:"text/html"}});
    assert.equal(page.status,200,path);
    const html=await page.text();
    assert.ok(html.includes(phrase),path+" human task");
    assert.ok(html.includes('href="https://561.group'+path+'"'),path+" canonical metadata");
    const machine=await f.request(path,{headers:{accept:"application/json"}});
    assert.equal(machine.status,200,path+" JSON");
    const data=await machine.json();
    assert.equal(data.kind,"tufte.projection");
    assert.equal(data.metadata.canonical,"https://561.group"+path);
    assert.ok(data.tiles.some(t=>t.id===id),path+" relevant TUFTE model");
    if(path==="/work/"){
      const services=data.tiles.find(t=>t.id==="services").html;
      for(const offer of frontdoor.offers.filter(s=>s.evidence)){
        assert.ok(services.includes('href="'+offer.evidence.href+'"'),
          "public TUFTE source evidence link: "+offer.id);
        assert.ok(services.includes(htmlText(offer.evidence.qualification)),
          "public service description is rendered: "+offer.id);
      }
      const pilots=frontdoor.offers.filter(s=>s.paidProposal);
      assert.equal(pilots.length,2,"only two original accepted provider proposals are promoted");
      for(const offer of pilots){
        assert.ok(services.includes('href="'+offer.paidProposal.href+'"'),
          "real LivingWebServer model links to the seller's accepted pilot source");
        assert.ok(services.includes(offer.paidProposal.qualification),
          "the actual machine projection keeps quote/acceptance limitations visible");
        assert.ok(!("price" in offer),
          "machine consumer does not invent a current merchant price");
      }
      const listings=data.metadata.structuredData["@graph"][2].mainEntity;
      assert.equal(listings["@type"],"ItemList");
      assert.equal(listings.itemListElement.length,frontdoor.offers.length);
      assert.ok(listings.itemListElement.every(x=>x.item["@type"]==="Service" &&
        !("offers" in x.item)),"no unauthorized checkout terms");
    }
  }
  assert.equal(f.reads.length,3*cells.length*2+2);
});
test("origin, method and undeclared URL cannot acquire a public source read",async()=>{
  const f=fixture();
  const offsite=await f.app.fetch(new Request("https://other.example/"));
  assert.equal(offsite.status,421);
  assert.deepEqual(f.reads,[]);
  for(const path of ["/","/work/","/projects/","/blog/","/about/","/for-agents/"]){
    const post=await f.request(path,{method:"POST"});
    assert.notEqual(post.status,200);
  }
  assert.notEqual((await f.request("/private/")).status,200);
  assert.notEqual((await f.request("/contact/")).status,200,
    "contact is retained by the original Worker assets, not duplicated by LWS");
  assert.deepEqual(f.reads,[]);
});
test("all admitted pages implement native HEAD without leaking response body",async()=>{
  const f=fixture();
  for(const path of PUBLIC_ROUTES){
    const response=await f.request(path,{method:"HEAD"});
    assert.equal(response.status,200,path);
    assert.equal(await response.text(),"",path+" HEAD response");
  }
});
test("native blog negotiates identical TUFTE original feed as HTML, JSON and Markdown",async()=>{
  const f=fixture();
  const htmlResponse=await f.request("/blog/",{headers:{accept:"text/html"}});
  assert.equal(htmlResponse.status,200);
  const html=await htmlResponse.text();
  assert.ok(html.includes("Source-bound research"));
  assert.ok(html.includes('href="https://science.561.group/source-bound-research/"'));
  assert.ok(html.includes("https://science.561.group/actors/science"));
  assert.ok(html.includes('href="https://561.group/blog/"'));
  assert.ok(html.includes('href="/feed-input-receipt.json"'));
  assert.ok(html.includes('href="/feed-provenance.jsonld"'));
  const json=await (await f.request("/blog/",{headers:{accept:"application/json"}})).json();
  assert.equal(json.kind,"tufte.projection");
  assert.equal(json.metadata.canonical,"https://561.group/blog/");
  assert.deepEqual(json.metadata.structuredData["@graph"][2].mainEntity.itemListElement
    .map(x=>x.item.author.name),[home.group.companies[0].name]);
  const markdown=await (await f.request("/blog/",{headers:{accept:"text/markdown"}})).text();
  assert.match(markdown,/Source\\-bound research/u);
  assert.match(markdown,/science\.561\.group\/source-bound-research/u);
  assert.equal(f.reads.filter(x=>x[0]==="feed").length,3);
  assert.equal(f.reads.filter(x=>x[0]==="home").length,3);
  assert.equal(f.reads.filter(x=>x[0]==="frontdoor").length,3);
});

test("new front-door reader is required; missing source cannot yield a vague blank homepage",()=>{
  assert.throws(()=>create561GroupLivingApplication({
    readHome:()=>home,readEstate:()=>estate,releaseHome:home
  }),/readFrontdoor/);
  assert.throws(()=>create561GroupLivingApplication({
    readHome:()=>home,readEstate:()=>estate,readFrontdoor:()=>frontdoor,releaseHome:home
  }),/readFeed/);
});


test("public about page makes the two long-horizon programs inspectable",async()=>{
  const {request}=fixture();
  const res=await request("/about/",{headers:{accept:"application/json"}});
  assert.equal(res.status,200);
  const model=await res.json();
  const frontier=model.tiles.find(x=>x.id==="frontiers");
  assert.ok(frontier);
  assert.ok(frontier.html.includes("settler-colonial"));
  assert.ok(frontier.html.includes("siloxane"));
  for(const program of frontdoor.vision.frontiers)
    assert.ok(frontier.html.includes(htmlText(program.boundary)),
      "the source-owned account of each program reaches the native page: "+program.id);
  assert.ok(frontier.html.includes("https://science.561.group/"));
});
