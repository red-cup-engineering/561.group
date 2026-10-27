import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  LOCALES,locale,localePath,parseArb,siteSpace,speaker,report,trustedHtml,
  sitemapXml,localeOfPath,localeRedirect
} from "../src/locales.mjs";

const from=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const home=JSON.parse(from("data/home.json"));
const estate=JSON.parse(from("data/estate.json"));
const space=siteSpace({
  interfaceSource:from("locales/en.arb"),
  renderings:[from("locales/zh-Hans.arb"),from("locales/lkt.arb")],
  home,estate
});
const say=tag=>speaker(space,tag,{origin:"https://561.group"});

test("site-owned ARB source has exact public locale identity, no invented fourth language",()=>{
  assert.deepEqual(LOCALES,["en","zh-Hans","lkt"]);
  assert.equal(locale("zh-Hans").ogLocale,"zh_CN");
  assert.equal(localePath("lkt"),"/lkt/");
  assert.throws(()=>locale("other"),/Unsupported/);
  assert.throws(()=>parseArb('{"ui.ok":"Yes"}'),/ARB locale/);
});

test("real locale catalog has original provenance with no counterfeit current witness",()=>{
  const statement=report(space);
  assert.equal(statement.sourceIntegrity,"unverified");
  assert.equal(statement.locales["zh-Hans"]["ill-typed"],0);
  assert.ok(statement.locales["zh-Hans"].coverage>0.95 && statement.locales["zh-Hans"].coverage<1);
  assert.ok(statement.locales["zh-Hans"]["source-witness-unverified"]>0);
  assert.equal(statement.agree,false);
  assert.equal(say("en").machine(),false);
  assert.equal(say("zh-Hans").machine(),true);
  assert.equal(say("zh-Hans").text("home.description"),home.description);
  assert.doesNotMatch(say("zh-Hans").html("home.description"),/政治、金融和经济的动荡中/u);
  assert.equal(say("lkt").machine(),true);
});

test("ICU plural selections and rich tags retain source-authored words",()=>{
  assert.equal(say("en").html("ui.nodes",{count:1},{num:inner=>"<b>"+inner+"</b>"}),
    "<b>1</b> public node.");
  assert.equal(say("en").html("ui.nodes",{count:12},{num:inner=>"<b>"+inner+"</b>"}),
    "<b>12</b> public nodes.");
  assert.equal(say("zh-Hans").html("ui.nodes",{count:12},{num:inner=>"<b>"+inner+"</b>"}),
    "<b>12</b> 个公开节点。");
  assert.equal(say("en").text("ui.note",{n:3}),"Note 3");
});

test("untrusted interpolation is escaped, explicit trusted HTML is bounded to its designated argument",()=>{
  const attack='<img src=x onerror=alert(1)>';
  assert.equal(say("en").html("ui.note",{n:attack}),
    "Note &lt;img src=x onerror=alert(1)&gt;");
  assert.equal(say("en").html("ui.legend",{label:trustedHtml("<b>True</b>"),means:"<script>"}),
    "<b>True</b>: &lt;script&gt;");
  assert.match(say("en").html("ui.agents.heading",{},{
    em:inner=>"<em>"+inner+"</em>"
  }),/<em>agent<\/em>/u);
});

test("English fallback is marked in Lakota HTML but not in text-only values",()=>{
  const original=parseArb({"@@locale":"en","home.description":home.description});
  const explicitSpace={source:original,targets:[]};
  const explicitSay=tag=>speaker(explicitSpace,tag,{origin:"https://561.group"});
  const html=explicitSay("lkt").html("home.description");
  assert.equal(html,'<span lang="en">'+home.description+'</span>');
  assert.equal(explicitSay("lkt").text("home.description"),home.description);
  assert.equal(say("lkt").text("home.description").length > 0, true);
  assert.notEqual(say("lkt").text("home.description"), home.description);
  assert.equal(say("lkt").text("ui.languages"),"Iyápi");
});

test("incorrectly typed translated rich tags cannot become authoritative source text",()=>{
  const original=parseArb({"@@locale":"en","message":"<n1>{name}</n1>"});
  const target=parseArb({"@@locale":"zh-Hans","message":"<n2>{name}</n2>"});
  const local={source:original,targets:[target]};
  assert.equal(speaker(local,"zh-Hans",{origin:"https://561.group"})
    .html("message",{name:"Jane"},{n1:inner=>"<b>"+inner+"</b>"}),
    '<span lang="en"><b>Jane</b></span>');
});

test("malformed message syntax refuses instead of silently publishing broken HTML",()=>{
  for(const value of ["{number, plural, other {ok}","{missing}"]){
    const s={source:parseArb({"@@locale":"en",message:value}),targets:[]};
    assert.throws(()=>speaker(s,"en",{origin:"https://561.group"}).html("message"));
  }
});

test("explicit reader locale wins, Accept-Language q-values are honored, unsafe methods do not redirect",()=>{
  const go=options=>localeRedirect(new Request("https://561.group/?query=1",options));
  assert.equal(go({headers:{"accept-language":"zh-CN, en;q=0.2"}}).headers.get("location"),
    "https://561.group/zh-hans/?query=1");
  assert.equal(go({headers:{"accept-language":"zh-CN",cookie:"lang=en"}}),null);
  assert.equal(go({headers:{"accept-language":"en;q=0.8,zh-CN;q=0.3"}}),null);
  assert.equal(go({headers:{"accept-language":"lkt"}}).headers.get("location"),
    "https://561.group/lkt/?query=1");
  assert.equal(go({method:"POST",headers:{"accept-language":"zh-CN"}}),null);
  assert.equal(localeOfPath("/lkt/feed.json"),"lkt");
  assert.equal(localeOfPath("/contact/"),null);
});

test("sitemap uses exact authored paths and escapes XML-bound data",()=>{
  const xml=sitemapXml([{loc:"https://561.group/?x=1&y=2",lastmod:"2026-10-22",
    alternates:[{hreflang:"en",href:"https://561.group/"}]}]);
  assert.match(xml,/x=1&amp;y=2/u);
  assert.match(xml,/<xhtml:link rel="alternate" hreflang="en"/u);
  assert.match(xml,/<url><loc>https:\/\/561.group\/\?x=1&amp;y=2<\/loc><lastmod>2026-10-22<\/lastmod>/u);
});
