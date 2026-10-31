import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HOUSE_STYLES} from "../src/apex-group-style.mjs";
import {SITE_STYLES} from "../src/public-home-style.mjs";
import {project561GroupHead,project561GroupHome} from "../src/home-tufte.mjs";
import {brandSource,verifyApexBrand,readPinnedBrandProfile} from "../scripts/verify-brand-source.mjs";

const read=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const source=read("data/home.json"),estate=read("data/estate.json"),frontdoor=read("data/frontdoor.json");
const fixture=()=>({
  edition:"v0.3",source:"data/records/design-tokens/561-group.tokens.json",
  colors:{ink:"#0A0A0A",bone:"#F2EAD8",witness:"#3D5588",alarm:"#FF4530"},
  fonts:{display:["Space Grotesk","Helvetica Neue","Arial","sans-serif"],
    reading:["Roboto Slab","Rockwell","Georgia","serif"],
    evidence:["JetBrains Mono","ui-monospace","Courier New","monospace"]}
});
const candidate=()=>({
  profile:fixture(),groupStyles:HOUSE_STYLES,siteStyles:SITE_STYLES,
  head:project561GroupHead(source),
  home:project561GroupHome({home:source,estate,frontdoor})
});
test("the website declares one pinned original content-design source, not a new theme identity",()=>{
  assert.equal(brandSource.owner,"561-group/561-group-content-design-services-section");
  assert.match(brandSource.commit,/^[0-9a-f]{40}$/u);
  assert.equal(brandSource.edition,"v0.3");
  assert.equal(brandSource.adapter,"src/brand-profile.mjs");
  assert.equal(brandSource.tokens,"data/records/design-tokens/561-group.tokens.json");
  assert.ok(brandSource.note.includes("human visual receiving"));
});
test("current actual authored head consumes common brand roles and both source-qualified styles",()=>{
  const result=verifyApexBrand(candidate());
  assert.equal(result.checkedRoleCount,7);
  assert.equal(result.actualHead,true);
  assert.equal(result.pixelAssayed,false);
  assert.equal(result.independentlyAccepted,false);
});
test("wrong colors and website-owned substitutions fail before publishing",()=>{
  const c=candidate();
  assert.throws(()=>verifyApexBrand({...c,groupStyles:HOUSE_STYLES.replace(
    "--group-bone:#F2EAD8","--group-bone:#EEF3E5")}),/differs from source-owned DTCG color.bone/u);
  assert.throws(()=>verifyApexBrand({...c,groupStyles:HOUSE_STYLES.replace(
    "--group-ink:#0A0A0A","--group-ink:#154342")}),/differs from source-owned DTCG color.ink/u);
  assert.throws(()=>verifyApexBrand({...c,siteStyles:SITE_STYLES+
    "\n:root{--group-ink:#ff00ff}"}),/shadows the source-owned house/u);
  assert.throws(()=>verifyApexBrand({...c,siteStyles:SITE_STYLES+
    "\n.panel{background:linear-gradient(90deg,#aaccee,#fff)}"}),/decorative brand palette/u);
});
test("wrong font, removed giant mark or folio and deleted focus behavior fail",()=>{
  const c=candidate();
  assert.throws(()=>verifyApexBrand({...c,groupStyles:HOUSE_STYLES.replace(
    '--group-sans:"Space Grotesk"','--group-sans:"Generic Startup"')}),/display type channel/u);
  assert.throws(()=>verifyApexBrand({...c,groupStyles:HOUSE_STYLES.replace(
    'font-family:"Space Grotesk"','font-family:"Generic Startup"')}),/missing self-hosted/u);
  assert.throws(()=>verifyApexBrand({...c,groupStyles:HOUSE_STYLES.replace(
    ".tufte-masthead::before{",".lost-visual-group-mark{")}),/giant 561 folio mark/u);
  assert.throws(()=>verifyApexBrand({...c,groupStyles:HOUSE_STYLES.replace(
    "border-top:8px solid var(--group-ink)","border-top:1px solid var(--group-ink)")}),
    /institutional folio bar/u);
  assert.throws(()=>verifyApexBrand({...c,groupStyles:HOUSE_STYLES.replaceAll(
    "focus-visible","focus-lost")}),/keyboard focus/u);
});
test("a style string merely declared in a file cannot pass unless TUFTE actually emits it",()=>{
  const c=candidate();
  assert.throws(()=>verifyApexBrand({...c,head:"<style></style>"}),
    /actual HTML head does not consume BOTH/u);
  assert.throws(()=>verifyApexBrand({...c,head:c.head.replace(
    "data-561-group=","data-anonymous-group=")}),/actual HTML head/u);
  const missing=structuredClone(c.home);
  missing.tiles=missing.tiles.filter(tile=>tile.id!=="physical-world");
  assert.throws(()=>verifyApexBrand({...c,home:missing}),/lost its material-world position/u);
  missing.tiles.push({id:"physical-world",html:"Lakota-founded: adopt our identity"});
  assert.throws(()=>verifyApexBrand({...c,home:missing}),/identity-first copy/u);
});
test("a different edition or an unauthenticated source checkout never certifies the Group",async()=>{
  const c=candidate();
  assert.throws(()=>verifyApexBrand({...c,profile:{...c.profile,edition:"v0.4"}}),
    /exact source-owned brand edition/u);
  await assert.rejects(()=>readPinnedBrandProfile(".",{
    ...brandSource,owner:"imaginary/brand-authority"
  }),/Unqualified original Group brand source lock/u);
});
