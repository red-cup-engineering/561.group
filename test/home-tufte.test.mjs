import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  PUBLIC_ROUTES,project561GroupHome,project561GroupPage,project561GroupHead
} from "../src/home-tufte.mjs";

const read=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const home=read("data/home.json"),estate=read("data/estate.json"),
  frontdoor=read("data/frontdoor.json");
const originalFeed=Object.freeze({
  version:"https://jsonfeed.org/version/1.1",
  home_page_url:home.origin+"/",feed_url:home.origin+"/feed.json",
  items:[
    {id:"science-article",url:"https://science.561.group/ai-alignment-and-institutions/",
      title:"AI alignment and institutions <draft?>",
      summary:"Questions about ownership & autonomy <script>untrusted</script>",
      date_published:"2026-10-26T12:00:00Z",
      date_modified:"2026-10-27T13:02:03Z",
      authors:[{name:home.group.companies[0].name,url:home.group.companies[0].url}]},
    {id:"engineering-article",url:"https://engineering.561.group/content-addressed-evidence/",
      title:"Content-addressed evidence",date_published:"2026-10-25T12:00:00Z",
      authors:[{name:home.group.companies[1].name,url:home.group.companies[1].url}]},
    {id:"science-home",url:home.group.companies[0].url,
      title:"Science home is not an article",date_published:"2026-10-24T12:00:00Z",
      authors:[{name:home.group.companies[0].name,url:home.group.companies[0].url}]},
  ],
});
const originalReceipt=Object.freeze({
  schema:"561.group/feed-input-receipt/v1",origin:home.origin,
  expectedSourceCount:4,completeness:"all-sources-received",
  sources:home.group.companies.map((company,i)=>({
    companyId:company.id,feedUrl:company.feeds.json,state:"received",
    inputItems:[2,1,0,0][i],bytes:180,
    sha256:"sha256:"+String(i+1).repeat(64)
  })),
  excludedItemCounts:{},sourceItemCount:3,admittedItems:3,
  omittedByAggregateLimit:0,emittedItems:3,
});
const model=path=>project561GroupPage({home,estate,frontdoor,
  feed:originalFeed,feedReceipt:originalReceipt,path});
const tile=(page,id)=>page.tiles.find(t=>t.id===id);

test("a visitor can tell what the Group is, what they can hire, and where to go immediately",()=>{
  const root=project561GroupHome({home,estate,frontdoor});
  assert.equal(root.title,home.name);
  assert.equal(root.metadata.description,home.description);
  assert.equal(root.metadata.canonical,"https://561.group/");
  const organization=root.metadata.structuredData["@graph"][0];
  assert.equal(organization.subOrganization.length,4);
  assert.deepEqual(organization.logo,{
    "@type":"ImageObject",url:home.origin+"/logo.png",width:512,height:512
  }, "the original Group mark identifies the canonical organization");
  assert.deepEqual(organization.sameAs,[home.group.githubOrg,home.group.actor],
    "only source-owned Group identities belong on the canonical organization");
  assert.deepEqual(root.navigation.map(x=>x.href),
    ["/","/work/","/projects/","/blog/","/about/","/for-agents/","/contact/"]);
  assert.deepEqual(root.tiles.map(x=>x.id),
    ["introduction","self-service","frontiers","technology-and-power","paths","services","method","physical-world","explore","trade","companies","agents","support"]);
  const hero=tile(root,"introduction").html;
  assert.ok(hero.includes(frontdoor.proposition));
  assert.ok(hero.includes(frontdoor.promise.replace(/&/gu,"&amp;").replace(/'/gu,"&#39;")));
  assert.ok(hero.includes(home.public.intro));
  assert.ok(hero.includes('href="/work/"'));
  assert.ok(hero.includes('href="/projects/"'));
  assert.doesNotMatch(hero,/conurbanized|Huidu Guanli|type-theoretic/u);
  const horizon=tile(root,"frontiers").html;
  assert.ok(horizon.includes("Union of Harmonious Colonies"));
  assert.ok(horizon.includes("settler-colonial"));
  assert.ok(horizon.includes("silica"));
  assert.ok(horizon.includes("carbon"));
  assert.ok(horizon.includes('href="/about/"'));
  assert.ok(horizon.includes('href="/work/"'));
  assert.ok(!horizon.includes("has already replaced") && !horizon.includes("we created living silica"));
  const wayfinding=tile(root,"paths").html;
  for(const path of frontdoor.paths) {
    assert.ok(wayfinding.includes(path.title));
    assert.ok(wayfinding.includes('href="'+path.href+'"'));
  }
  // The first research-reading path must reach the independently published
  // original Science resource, rather than silently treating news as research.
  assert.equal(frontdoor.paths.find(p=>p.id==="read").href,"https://science.561.group/");
  assert.ok(wayfinding.includes('href="https://science.561.group/"'));
  assert.ok(tile(root,"explore").html.includes('href="https://koios.news/"'),
    "independent newsroom discovery remains a separate, live homepage affordance");
  assert.equal(tile(root,"physical-world").title,home.public.materialApproach.headline);
  assert.ok(tile(root,"physical-world").html.includes(home.public.materialApproach.body));
  assert.ok(tile(root,"physical-world").html.includes(home.public.materialApproach.scope));
  assert.match(tile(root,"physical-world").html,/water-cycle-informed governance/u);
  assert.match(tile(root,"physical-world").html,/Indigenous authority, treaty rights/u);
  assert.ok(root.tiles.findIndex(t=>t.id==="services")<root.tiles.findIndex(t=>t.id==="support"),
    "public sales and use are not hidden behind a donation pitch");
});

test("political-economy readers can find evidence rather than technology hype",()=>{
  const homePage=model("/"), about=model("/about/");
  const invitation=tile(homePage,"technology-and-power").html;
  assert.equal(about.metadata.description,frontdoor.discovery.summary + " " + frontdoor.ecologicalDiscovery.summary);
  assert.ok(invitation.includes(frontdoor.discovery.intro.replace(/&/gu,"&amp;").replace(/'/gu,"&#39;")));
  assert.ok(invitation.includes("Can AI alignment be anti-capitalist?"));
  assert.ok(invitation.includes('href="/about/#technology-and-power"'));
  const full=tile(about,"technology-and-power").html;
  for(const q of frontdoor.discovery.questions){
    assert.ok(full.includes('id="'+q.id+'"'),"question needs an actual fragment identity");
    assert.ok(full.includes(q.question));
    assert.ok(full.includes('href="'+q.href+'"'),"readers can inspect a source");
  }
  assert.ok(full.includes(frontdoor.discovery.boundary.replace(/&/gu,"&amp;").replace(/\x27/gu,"&#39;")),
    "the source-qualified commercial disclosure is preserved in escaped TUFTE HTML");
  for(const x of frontdoor.discovery.nextSteps) assert.ok(full.includes('href="'+x.href+'"'));
  assert.match(full,/does not by itself|not one political program/u);
  const known=homePage.metadata.structuredData["@graph"][0].knowsAbout;
  assert.ok(known.includes("AI alignment and political economy"));
  assert.ok(known.includes("post-capitalist institutional alternatives"));
});


test("different ecological readers find original evidence and explicit limits",()=>{
  const homePage=model("/"), about=model("/about/");
  const homepageMaterial=tile(homePage,"physical-world").html;
  assert.ok(homepageMaterial.includes('href="/about/#ecology-and-adaptation"'),
    "one existing material-world entrance leads to three distinct questions without a new homepage billboard");
  const eco=tile(about,"ecology-and-adaptation");
  assert.equal(eco.title,frontdoor.ecologicalDiscovery.headline);
  const html=eco.html;
  const research=frontdoor.ecologicalDiscovery;
  assert.ok(about.metadata.description.includes(research.summary),
    "About's public metadata should expose the ecological topics to readers and crawlers");
  assert.ok(html.includes(research.intro.replace(/&/gu,"&amp;").replace(/'/gu,"&#39;")));
  assert.equal((html.match(/class="site-card" id="/gu)||[]).length,3);
  assert.equal(new Set(research.questions.map(q=>q.audience)).size,3);
  for (const q of research.questions) {
    assert.ok(html.includes('id="'+q.id+'"'),"each reader problem has its own accessible anchor");
    assert.ok(html.includes(q.question.replace(/&/gu,"&amp;").replace(/\x27/gu,"&#39;")),
      "each entry answers a real public question with escaped HTML");
    assert.ok(html.includes('href="'+q.href+'"'),"each answer links an original primary source");
    assert.ok(html.includes(q.label),"each public source has a human-readable label");
  }
  assert.ok(html.includes("no independently received successful partition test"),
    "a research design must not be misrepresented as a verified disconnected operation");
  assert.ok(html.includes("does not prove a live public edition"),
    "source-admitted Science article must not be misrepresented as publicly received");
  assert.ok(html.includes("does not establish a community"),
    "ecological work cannot silently assert someone else's consent");
  for (const next of research.nextSteps)
    assert.ok(html.includes('href="'+next.href+'"'),"voluntary original reader path");
  assert.ok(html.includes("As of October 27, 2026"),
    "publication-state qualifier is sourced and dated");
  assert.ok(html.includes("Use the released free climate exposure worksheet"),
    "one real already published climate resource is actionable");
  assert.ok(!html.includes("Our published climate analysis"),
    "unreceived science page may not acquire a public release by copy");
  assert.ok(!homePage.tiles.some(t=>t.id==="ecology-and-adaptation"),
    "keep the public homepage focused on institution and jobs, not thematic campaigns");
});


test("services are tied to an existing accountable company, and only inquiry is offered",()=>{
  const root=model("/");
  const services=tile(root,"services").html;
  assert.ok(services.includes("Persistent AI systems"));
  assert.ok(services.includes("Indigenous data governance"));
  assert.ok(!services.includes("Website performance and resource audits"),
    "the original first four homepage service invitations remain in place");
  assert.ok(services.includes('href="/work/#green-web-pilot"'),
    "buyers can reach already-authored paid pilot proposals in one click");
  const work=model("/work/");
  const list=tile(work,"services").html;
  for(const item of frontdoor.offers) {
    assert.ok(list.includes('id="'+item.id+'"'));
    const expected=item.scope.replace(/&/gu,"&amp;").replace(/'/gu,"&#39;");
    assert.ok(list.includes(expected));
    assert.ok(list.includes(home.group.companies.find(c=>c.id===item.provider).name));
  }
  for(const service of frontdoor.offers){
    const href="/contact/?service="+encodeURIComponent(service.title)+"#work";
    assert.ok(list.includes('href="'+href+'"'),
      "each service can open its own existing intake context: "+service.id);
  }
  assert.equal((list.match(/Ask about this work/g)||[]).length,frontdoor.offers.length,
    "do not duplicate the existing inquiry destination or invent an order path");
  for(const item of frontdoor.offers.filter(x=>x.evidence)){
    assert.ok(list.includes('href="'+item.evidence.href+'"'),
      "a reader can inspect directly related public material: "+item.id);
    const escapedLabel=item.evidence.label.replace(/&/gu,"&amp;")
      .replace(/</gu,"&lt;").replace(/>/gu,"&gt;")
      .replace(/"/gu,"&quot;").replace(/'/gu,"&#39;");
    assert.ok(list.includes(escapedLabel),
      "visible links retain escaped HTML labels: "+item.id);
    assert.ok(list.includes(item.evidence.qualification.replace(/&/gu,"&amp;").replace(/'/gu,"&#39;")));
  }
  assert.equal(frontdoor.offers.filter(x=>x.evidence).length,5,
    "only five independently labeled, bounded original evidence entrances are admitted");
  const pilots=frontdoor.offers.filter(x=>x.paidProposal);
  assert.deepEqual(pilots.map(x=>x.id),["green-web-pilot","evidence-marketing-pilot"]);
  assert.equal(frontdoor.offers.length,8);
  for(const service of pilots) {
    const proposal=service.paidProposal;
    assert.equal(service.provider,"services","the original Causeway seller remains responsible");
    assert.ok(proposal.href.startsWith("https://services.561.group/"));
    assert.ok(list.includes('href="'+proposal.href+'"'),"buyer can read original provider scope");
    assert.ok(list.includes(proposal.label));
    const escaped=proposal.qualification.replace(/&/gu,"&amp;")
      .replace(/'/gu,"&#39;");
    assert.ok(list.includes(escaped),"a proposal remains visibly nonbinding");
    assert.ok(!("price" in service) && !("checkout" in service),
      "the corporate source must not duplicate the real seller's prices or merchant");
  }
  assert.doesNotMatch(list,/Buy now|guaranteed earnings|confirmed price|currently available to book/iu);
  const structured=work.metadata.structuredData["@graph"][2].mainEntity;
  assert.equal(structured["@type"],"ItemList");
  assert.deepEqual(structured.itemListElement.map(x=>x.item.name),
    frontdoor.offers.map(x=>x.title));
  for(const [i,x] of structured.itemListElement.entries()){
    const service=frontdoor.offers[i];
    const provider=home.group.companies.find(comp=>comp.id===service.provider);
    assert.equal(x.item.provider["@id"],provider.url+"#organization");
    assert.equal(x.item.url,"https://561.group/work/#"+service.id);
    assert.equal(x.item["@type"],"Service");
    assert.ok(!("offers" in x.item) && !("aggregateRating" in x.item),
      "an inquiry must not silently become a priced or independently reviewed service");
  }
  for(const step of frontdoor.steps)
    assert.ok(tile(work,"process").html.includes(step.detail));
  assert.doesNotMatch(list,/Buy now|guaranteed revenue|instant acceptance/u);
});

test("self-service buyer journeys preserve original offer identities in human and machine projections",()=>{
  for (const path of ["/","/work/","/for-agents/"]) {
    const page=model(path), direct=tile(page,"self-service");
    assert.equal(direct.title,frontdoor.selfService.title);
    assert.ok(page.tiles.indexOf(direct)<page.tiles.findIndex(x=>x.id==="services") || path==="/for-agents/");
    const mentions=page.metadata.structuredData["@graph"][2].mentions;
    for (const example of frontdoor.selfService.examples) {
      assert.ok(direct.html.includes('href="'+example.href+'"'));
      for(const identity of [example.sku,example.cell,example.law]) assert.ok(direct.html.includes(identity));
      const claim=mentions.find(x=>x["@id"]===example.sku);
      assert.equal(claim.url,example.href);
      assert.deepEqual(claim.identifier.map(x=>x.value),[example.cell,example.law]);
    }
    assert.ok(direct.html.includes(home.group.marketDiscovery));
    assert.doesNotMatch(direct.html,/contact\/|Request a scope|\$\d/u,"self-service leads directly to the original merchant without a second price or quote");
  }
});

test("real named projects and distinct buying venues are prominent, not inferred offers",()=>{
  const root=model("/");
  const featured=tile(root,"explore").html;
  for(const entry of home.public.featured) {
    const node=estate.nodes.find(x=>x.host===entry.host);
    assert.ok(featured.includes(entry.action));
    assert.ok(featured.includes("https://"+node.host+"/"));
  }
  for(const venue of home.group.storefronts) {
    assert.ok(tile(root,"trade").html.includes(venue.name));
    assert.ok(tile(root,"trade").html.includes(venue.url));
  }
  const projects=model("/projects/");
  const listing=tile(projects,"directory").html;
  for(const node of estate.nodes) {
    assert.ok(listing.includes(node.name));
    assert.ok(listing.includes("https://"+node.host+"/"));
  }
  assert.ok(listing.includes('href="/estate.json"'));
  assert.match(projects.metadata.canonical,/\/projects\/$/u);
});

test("about and agent pages give real source identities and safe action boundaries",()=>{
  const about=model("/about/");
  assert.equal(tile(about,"companies").html.match(/<strong>/gu)?.length,4);
  const vision=tile(about,"frontiers").html;
  for(const frontier of frontdoor.vision.frontiers){
    assert.ok(vision.includes(frontier.title));
    assert.ok(vision.includes(frontier.thesis));
    assert.ok(vision.includes(frontier.present));
    assert.ok(vision.includes(frontier.boundary));
  }
  assert.match(vision,/Indigenous sovereignty, treaty rights and voluntary self-government/u);
  assert.match(vision,/energy-coupled self-maintenance, heredity, reproduction and evolution/u);
  assert.ok(vision.includes("science.561.group"));
  assert.ok(tile(about,"principles").html.includes(home.public.materialApproach.scope.replace(/&/gu,"&amp;")));
  assert.ok(tile(about,"source").html.includes(home.group.githubOrg));
  const agent=model("/for-agents/");
  const protocols=tile(agent,"endpoints").html;
  for(const entry of estate.machine) {
    assert.ok(protocols.includes(entry.url));
    const safeText=entry.what.replace(/[&<>"']/gu,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    assert.ok(protocols.includes(safeText),
      "the public machine description is preserved through safe HTML escaping: "+entry.url);
  }
  assert.ok(protocols.includes('class="site-method">POST</span><code>'),
    "the website lists but never automatically invokes POST endpoints");
  assert.ok(tile(agent,"boundaries").html.includes("authorization"));
});


test("Group blog receives only exact company-authored feed articles and preserves identities",()=>{
  const blog=model("/blog/");
  assert.equal(blog.metadata.canonical,"https://561.group/blog/");
  assert.equal(blog.metadata.structuredData["@graph"][2]["@type"],"CollectionPage");
  const entries=blog.metadata.structuredData["@graph"][2].mainEntity.itemListElement;
  assert.equal(entries.length,2);
  assert.equal(entries[0].item.url,originalFeed.items[0].url);
  assert.equal(entries[0].item.author.name,home.group.companies[0].name);
  assert.equal(entries[0].item.datePublished,"2026-10-26T12:00:00Z");
  assert.equal(entries[0].item.dateModified,"2026-10-27T13:02:03Z");
  assert.equal(entries[1].item.dateModified,undefined,
    "modification timestamp cannot be invented for a source which omitted it");
  const html=tile(blog,"posts").html;
  assert.ok(html.includes("AI alignment and institutions &lt;draft?&gt;"));
  assert.ok(html.includes('class="dt-published" datetime="2026-10-26T12:00:00Z"'));
  assert.ok(html.includes('class="dt-updated" datetime="2026-10-27T13:02:03Z"'));
  assert.ok(html.includes("Published by source: "));
  assert.ok(html.includes("Source reports updated: "));
  assert.ok(!html.includes("Corrected by 561 Group") && !html.includes("retracted"));
  assert.ok(html.includes("Questions about ownership &amp; autonomy &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("Science home is not an article"),
    "a source-owned homepage feed item is not a blog post");
  assert.ok(html.includes('href="https://science.561.group/ai-alignment-and-institutions/"'));
  assert.ok(!html.includes('href="https://561.group/ai-alignment-and-institutions/"'));
  assert.ok(html.includes("bounded, build-time"));
  assert.match(tile(blog,"posts").html,/original company feeds/);
  assert.ok(tile(blog,"posts").html.includes("A reported update is not itself an accepted correction or retraction"));
  const follow=tile(blog,"follow").html;
  for(const company of home.group.companies){
    assert.ok(follow.includes(company.actor));
    assert.ok(follow.includes(company.feeds.rss));
    assert.ok(follow.includes(company.feeds.json));
  }
  assert.ok(tile(blog,"lead").html.includes("/feed.rss.xml"));
  const coverage=tile(blog,"coverage").html;
  assert.ok(coverage.includes("4 of 4 original company feeds received"));
  assert.ok(coverage.includes("3 source items admitted, 3 selected"));
  assert.ok(coverage.includes("0 source entries rejected"));
  assert.ok(coverage.includes("not current live publication totals"));
  for(const company of home.group.companies){
    assert.ok(coverage.includes(company.name),"source identity: "+company.id);
    assert.ok(coverage.includes(company.feeds.json),"original source feed: "+company.id);
  }
  const empty=project561GroupPage({home,estate,frontdoor,path:"/blog/",
    feed:{...originalFeed,items:[]},
    feedReceipt:{...originalReceipt,
      sources:originalReceipt.sources.map(source=>({...source,inputItems:0})),
      sourceItemCount:0,admittedItems:0,emittedItems:0}});
  assert.match(tile(empty,"posts").html,/not evidence that their archives are empty/u);
});

test("Group blog rejects unauthorized, forged, oversized and broken feed records",()=>{
  const wrong={...originalFeed,items:[{...originalFeed.items[0],
    authors:[{name:"Another publisher",url:"https://another.example/"}]}]};
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",feed:wrong}),/one original source owner/u);
  const external={...originalFeed,items:[{...originalFeed.items[0],
    url:"https://not-in-the-group.example/other/"}]};
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",feed:external}),/one original source owner/u);
  const badUrl={...originalFeed,items:[{...originalFeed.items[0],
    url:"javascript:alert(1)"}]};
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",feed:badUrl}),/canonical public HTTPS/u);
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/"}),/original bounded generated JSON Feed/u);
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",
    feed:{...originalFeed,items:Array(61).fill(originalFeed.items[0])}}),/original bounded generated JSON Feed/u);
});

test("a single original TUFTE application has only exact known public routes",()=>{
  assert.deepEqual(PUBLIC_ROUTES,["/","/work/","/projects/","/blog/","/about/","/for-agents/"]);
  for(const route of PUBLIC_ROUTES) {
    const page=model(route);
    assert.equal(page.metadata.canonical,"https://561.group"+route);
    assert.equal(page.metadata.language,"en");
    assert.equal(page.revision,"unversioned");
    assert.ok(page.tiles.length>=3);
  }
  for(const path of ["/contact/","/actors/group","/work/fake/","/internal/"])
    assert.throws(()=>model(path),/Unadmitted/);
});

test("public editorial records are data, escaped and checked at the original boundary",()=>{
  const copy=structuredClone(frontdoor);
  copy.promise='<img src=x onerror=alert(1)>';
  copy.paths[0].title='<em>not HTML</em>';
  const safe=project561GroupPage({home,estate,frontdoor:copy});
  assert.ok(tile(safe,"introduction").html.includes("&lt;img"));
  assert.ok(!tile(safe,"introduction").html.includes("<img"));
  assert.ok(tile(safe,"paths").html.includes("&lt;em&gt;"));
  const missing=structuredClone(estate);
  missing.nodes=missing.nodes.filter(n=>n.host!==home.public.featured[0].host);
  assert.throws(()=>project561GroupPage({home,estate:missing,frontdoor}),
    /not a published estate entry/);
  const malicious=structuredClone(frontdoor);
  malicious.paths[0].href="javascript:alert(1)";
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:malicious}),/Only public HTTPS/);
  const duplicate=structuredClone(frontdoor);
  duplicate.offers.push({...duplicate.offers[0]});
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:duplicate}),/Duplicate/);
  const incompletePosition=structuredClone(home);
  delete incompletePosition.public.materialApproach.scope;
  assert.throws(()=>project561GroupPage({home:incompletePosition,estate,frontdoor}),/material-world position/u);
  const missingVision=structuredClone(frontdoor);
  missingVision.vision.frontiers.pop();
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:missingVision}),
    /Two complete, distinct/u);
  const injectedVision=structuredClone(frontdoor);
  injectedVision.vision.frontiers[0].thesis='<script>alert(1)</script>';
  const rendered=tile(project561GroupPage({home,estate,frontdoor:injectedVision}),"frontiers").html;
  assert.ok(rendered.includes("&lt;script&gt;"));
  assert.ok(!rendered.includes("<script>"));
  const improper=structuredClone(frontdoor);
  improper.offers[0].provider="nonexistent";
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:improper}),/no original accountable company/);
  const unsafeEvidence=structuredClone(frontdoor);
  unsafeEvidence.offers[0].evidence={href:"javascript:alert(1)",label:"Fake proof",qualification:"No"};
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:unsafeEvidence}),/Only public HTTPS/);
  const unqualifiedEvidence=structuredClone(frontdoor);
  unqualifiedEvidence.offers[0].evidence={href:"https://science.561.group/",label:"Unverified",qualification:""};
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:unqualifiedEvidence}),
    /Inspectable service evidence/);
  const wrongSeller=structuredClone(frontdoor);
  wrongSeller.offers.find(x=>x.id==="green-web-pilot").provider="science";
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:wrongSeller}),
    /competent Causeway seller/);
  const unsafeProposal=structuredClone(frontdoor);
  unsafeProposal.offers.find(x=>x.id==="green-web-pilot").paidProposal.href=
    "https://outside.example/not-a-causeway-publication/";
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:unsafeProposal}),
    /canonical original Causeway publication/);
  const ambiguousProposal=structuredClone(frontdoor);
  ambiguousProposal.offers.find(x=>x.id==="green-web-pilot").paidProposal.href=
    "https://services.561.group/green-web-service-pilot/?unverified=1";
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:ambiguousProposal}),
    /canonical original Causeway publication/);
  const noPriceCaveat=structuredClone(frontdoor);
  noPriceCaveat.offers.find(x=>x.id==="green-web-pilot").paidProposal.qualification="";
  assert.throws(()=>project561GroupPage({home,estate,frontdoor:noPriceCaveat}),
    /qualified proposal/);
  const poisoned=structuredClone(home);
  poisoned.group.sustainingSupport.url="data:text/html,x";
  assert.throws(()=>project561GroupPage({home:poisoned,estate,frontdoor}),/Only public HTTPS/);
});

test("the genuine TUFTE document keeps discoverability, responsive design, keyboard focus and reduced motion",()=>{
  const head=project561GroupHead(home);
  assert.match(head,/name="fediverse:creator" content="@group@561\.group"/u);
  assert.match(head,/rel="me" href="https:\/\/561\.group\/actors\/group"/u);
  assert.match(head,/name="fediverse:creator"/u);
  for(const path of ["/llms.txt","/feed.json","/feed.atom.xml","/feed.rss.xml","/estate.json"])
    assert.ok(head.includes('href="'+path+'"'));
  for(const lang of ["en","zh-Hans","lkt","x-default"])
    assert.ok(head.includes('hreflang="'+lang+'"'));
  assert.ok(head.includes(":focus-visible"));
  assert.ok(head.includes("max-width:430px"));
  assert.ok(head.includes("prefers-reduced-motion:reduce"));
  assert.ok(head.includes("site-display"));
  assert.ok(head.includes('data-561-house="visual-design-bible-v0.4-candidate"'));
  for(const value of ["#F2EAD8","#0A0A0A","#FF4530","#3D5588","Space Grotesk","Roboto Slab","JetBrains Mono"])
    assert.ok(head.includes(value),"original 561 house visual token must survive: "+value);
  assert.ok(head.includes(".tufte-masthead::before"),"preserve the original giant 561 numeral");
  assert.ok(head.includes("#frontiers"),"integrate civilizational vision into the source-owned house design");
  assert.ok(!home.description.startsWith("The Lakota-founded"),"lead with the work, not a founding-identity appeal");
  const modified=structuredClone(home);
  modified.group.handle='<script>alert(1)</script>';
  assert.doesNotMatch(project561GroupHead(modified),/<script>/u);
  assert.throws(()=>project561GroupHead({...home,origin:"https://other.example"}),TypeError);
});


test("original paid Work-receiving pilot exposes an honest, bounded customer inquiry rather than a fake checkout",()=>{
  const service=frontdoor.offers.find(item=>item.id==="agent-operations");
  assert.equal(service.provider,"services");
  assert.match(service.scope,/public GitHub Work\/Actions source/u);
  assert.match(service.scope,/customer-authorized, redacted Asana\/Jira export/u);
  assert.match(service.scope,/without account access, migration or customer-system changes/u);
  assert.match(service.example,/Provisional \$200 pilot estimate \(not a quote\)/u);
  assert.match(service.example,/up to 20 source Work records/u);
  assert.match(service.example,/no-purchase recommendation/u);
  assert.match(service.example,/Do not send tokens or private records/u);
  const homepage=tile(model("/"),"services").html;
  const work=tile(model("/work/"),"services").html;
  for(const html of [homepage,work]){
    assert.ok(html.includes("Provisional $200 pilot estimate"),
      "the actual source-owned service pitch must be visible to prospective customers");
    assert.ok(html.includes("customer-authorized, redacted Asana/Jira export"));
    assert.ok(html.includes("up to 20 source Work records"));
    assert.doesNotMatch(html,/Buy now|guaranteed return|payment complete|instant checkout/u);
  }
  assert.ok(work.includes('href="/contact/?service=Persistent%20AI%20systems#work"'),
    "keep the original accepted customer-inquiry path; no invented payment or lead intake");
  const registered=model("/work/").metadata.structuredData["@graph"][2].mainEntity;
  const entry=registered.itemListElement.find(x=>x.item["@id"].endsWith("#agent-operations"));
  assert.ok(entry);
  assert.equal(entry.item.provider["@id"],
    home.group.companies.find(x=>x.id==="services").url+"#organization");
  assert.equal("offers" in entry.item,false,
    "a provisional service estimate must not become an enforceable schema.org Offer or payment claim");
});

test("the original GitHub Work study gives a prospect a concrete example and source",()=>{
 const service=frontdoor.offers.find(s=>s.id==="agent-operations");
 const source="https://github.com/561-group/561.group/issues/17#issuecomment-6378737097";
 assert.equal(service.evidence.href,source);
 assert.match(service.evidence.label,/20-record Work-continuity sample/u);
 assert.match(service.evidence.qualification,/20 GitHub work records/u);
 for(const page of ["/","/work/"]){
  const markup=tile(model(page),"services").html;
  assert.ok(markup.includes('href="'+source+'"'),
    "real first-party Work source can be reached from the original service card");
  assert.ok(markup.includes(service.evidence.label));
  assert.ok(markup.includes(service.evidence.qualification));
  assert.ok(markup.includes('href="/contact/?service=Persistent%20AI%20systems#work"'),
    "original seller intake survives public source-evidence discovery");
  assert.doesNotMatch(markup,/Buy now|guaranteed savings|validated customer results/u);
 }
 const business=model("/work/").metadata.structuredData["@graph"][2].mainEntity;
 const details=business.itemListElement.find(row=>row.item["@id"].endsWith("#agent-operations")).item;
 assert.equal(details.provider["@id"],home.group.companies.find(p=>p.id==="services").url+"#organization");
 assert.equal("offers" in details,false);
 assert.equal("aggregateRating" in details,false);
 const noEvidence=structuredClone(frontdoor);
 noEvidence.offers.find(s=>s.id==="agent-operations").evidence.href="javascript:alert(1)";
 assert.throws(()=>project561GroupPage({home,estate,frontdoor:noEvidence,path:"/work/"}),
   /Only public HTTPS resources/u);
});


test("source-bound blog exposes partial company coverage and refuses fabricated completeness",()=>{
  const receipt=structuredClone(originalReceipt);
  const last=receipt.sources[3];
  receipt.sources[3]={companyId:last.companyId,feedUrl:last.feedUrl,state:"unavailable"};
  receipt.completeness="partial-source-coverage";
  const page=project561GroupPage({home,estate,frontdoor,path:"/blog/",
    feed:originalFeed,feedReceipt:receipt});
  const coverage=tile(page,"coverage").html;
  assert.ok(coverage.includes("3 of 4 original company feeds received"));
  assert.ok(coverage.includes("Feed unavailable to this build"));
  assert.ok(coverage.includes("not empty archives"));
  assert.ok(coverage.includes("Causeway Services"));
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",
    feed:originalFeed,feedReceipt:{...receipt,completeness:"all-sources-received"}}),
    /unwitnessed completeness/u);
  const spoofed=structuredClone(receipt);
  spoofed.sources[3].inputItems=500;
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",
    feed:originalFeed,feedReceipt:spoofed}),/Unread company feeds/u);
});
test("the same blog source receipt refuses false author, count and cap claims",()=>{
  const broken=[
    {...originalReceipt,expectedSourceCount:3},
    {...originalReceipt,sourceItemCount:6},
    {...originalReceipt,omittedByAggregateLimit:1},
    {...originalReceipt,emittedItems:2},
    {...originalReceipt,sources:originalReceipt.sources.map((s,i)=>
      i===1?{...s,feedUrl:"https://another.example/feed.json"}:s)},
    {...originalReceipt,sources:originalReceipt.sources.map((s,i)=>
      i===2?{...s,sha256:"not-a-hash"}:s)},
    {...originalReceipt,excludedItemCounts:{"invalid-article":4}},
  ];
  for(const receipt of broken)
    assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",
      feed:originalFeed,feedReceipt:receipt}),
      /source|coverage|counts|receipt|incomplete|disagree|original/u);
  assert.throws(()=>project561GroupPage({home,estate,frontdoor,path:"/blog/",
    feed:originalFeed}),/four-company build receipt/u);
});
