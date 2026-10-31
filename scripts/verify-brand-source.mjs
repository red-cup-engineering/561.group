#!/usr/bin/env node
/**
 * One 561 Group TUFTE consumer contract against the *original source-owning*
 * Content Design package, not a second design canon, token store, or renderer.
 * Source edition and exact Git revision are read from data/brand-source.json.
 *
 * Source/DOM test is one gate. Browser layout, color coverage, accessibility,
 * published source revision, and an actual reader's visual acceptance remain
 * separate qualified receivers.
 */
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {fileURLToPath} from "node:url";
import {HOUSE_STYLES} from "../src/apex-house-style.mjs";
import {SITE_STYLES} from "../src/public-home-style.mjs";
import {project561GroupHead,project561GroupHome} from "../src/home-tufte.mjs";

export const brandSource=Object.freeze(JSON.parse(
  readFileSync(new URL("../data/brand-source.json",import.meta.url),"utf8")
));
const hex=/^#[0-9A-F]{6}$/u;
const sha=/^[a-f0-9]{40}$/u;

function rootRoles(css){
  const open=css.indexOf(":root{");
  if(open<0)throw new Error("Apex house CSS omits the authored root design tokens");
  const close=css.indexOf("}",open);
  if(close<0)throw new Error("Apex house CSS root is unterminated");
  const block=css.slice(open+6,close);
  const vars=new Map();
  const re=/(--[a-z][a-z0-9-]*)\s*:\s*([^;]+)\s*;/gu;
  for(const found of block.matchAll(re)){
    if(vars.has(found[1]))throw new Error("Duplicate source-critical CSS root role "+found[1]);
    vars.set(found[1],found[2].trim());
  }
  return vars;
}
function normalizeFamily(value){
  return value.split(",").map(part=>part.trim().replace(/^["']|["']$/gu,""));
}
function requireStyle(css,pattern,label){
  if(!pattern.test(css))throw new Error("Missing visual identity invariant: "+label);
}
/**
 * Pure consumer predicate: use a real upstream compiled brand profile, and
 * retain only explicitly authorized v0.4 candidate deviations from its v0.3
 * common core. This routine does NOT certify screenshot-pixel equivalence.
 */
export function verifyApexBrand({
  profile,groupStyles=HOUSE_STYLES,siteStyles=SITE_STYLES,
  head,home,edition=brandSource.edition
}={}){
  if(!profile || profile.edition!==edition)
    throw new Error("Apex did not consume the exact source-owned brand edition");
  const values=rootRoles(groupStyles);
  const colorRoles={ink:"--group-ink",bone:"--group-bone",
    witness:"--group-witness",alarm:"--group-alarm"};
  for(const [key,variable] of Object.entries(colorRoles)){
    const actual=values.get(variable),expected=profile.colors?.[key];
    if(!hex.test(expected??"") || actual!==expected)
      throw new Error("Apex "+variable+" differs from source-owned DTCG color."+key);
  }
  const fontRoles={display:"--group-sans",reading:"--group-slab",
    evidence:"--group-mono"};
  for(const [key,variable] of Object.entries(fontRoles)){
    const actual=values.get(variable),expected=profile.fonts?.[key];
    if(!Array.isArray(expected) ||
        JSON.stringify(normalizeFamily(actual??""))!==JSON.stringify(expected))
      throw new Error("Apex "+variable+" breaks the source-owned "+key+" type channel");
    if(!groupStyles.includes('font-family:"'+expected[0]+'";src:url("/fonts/'))
      throw new Error("Apex missing self-hosted display/reading/evidence font "+expected[0]);
  }
  if(values.get("--tufte-radius")!=="0")
    throw new Error("Apex replaced square-corner institutional geometry");
  requireStyle(groupStyles,/\.tufte-masthead::before\s*\{\s*content:"561";/u,"giant 561 folio mark");
  requireStyle(groupStyles,/content:"561";/u,"unaltered 561 mark");
  requireStyle(groupStyles,/\.tufte-masthead\s*\{[^}]*border-top:8px solid var\(--group-ink\)/su,
    "institutional folio bar");
  requireStyle(groupStyles,/\.tufte-footer\s*\{/u,"inked source-owned colophon");
  requireStyle(groupStyles,/focus-visible/u,"keyboard focus");
  requireStyle(groupStyles,/@media\s*\(prefers-reduced-motion:reduce\)/u,
    "honest reduced-motion behavior");
  requireStyle(groupStyles,/@media\s*print/u,"print-compatible house");
  requireStyle(groupStyles,/@media\s*\(max-width:780px\)/u,"responsive house");
  requireStyle(groupStyles,/#physical-world\s*\{/u,
    "real material-world message retained in the visual grammar");

  // A downstream service-page CSS file may add layout, but may not mint a
  // second global identity, gradients or duplicate the source-owned theme.
  if(/--(?:house-(?:ink|bone|witness|alarm|sans|slab|mono)|tufte-(?:bg|ink|surface|accent))\s*:/u.test(siteStyles))
    throw new Error("Site component CSS shadows the source-owned house brand");
  if(/linear-gradient\s*\(|radial-gradient\s*\(\s*(?:#|rgb|hsl)/iu.test(siteStyles))
    throw new Error("Site components introduced a new decorative brand palette");
  for(const role of ["--group-sans","--group-slab","--group-mono"]){
    if(!groupStyles.includes("var("+role+")") && !siteStyles.includes("var("+role+")"))
      throw new Error("Brand font role is declared but never consumed: "+role);
  }
  if(typeof head!=="string" ||
      !head.includes('data-561-group="visual-design-bible-v0.4-candidate"') ||
      !head.includes(groupStyles) || !head.includes(siteStyles))
    throw new Error("TUFTE's actual HTML head does not consume BOTH validated house and page CSS");
  if(!home || home.tiles?.length<5 ||
      home.tiles.some(tile=>typeof tile.html==="string"&&
        /Lakota-founded/i.test(tile.html)) ||
      !home.tiles.some(tile=>tile.id==="physical-world"))
    throw new Error("Homepage regressed to identity-first copy or lost its material-world position");
  return Object.freeze({
    source:profile.source,
    sourceEdition:profile.edition,
    checkedRoleCount:4+3,
    actualHead:true,
    publisherQualified:false,
    pixelAssayed:false,
    independentlyAccepted:false
  });
}

export async function readPinnedBrandProfile(sourceRoot,lock=brandSource){
  if(lock.schema!=="561.group/brand-source/v1"||
      lock.owner!=="561-group/561-group-content-design-services-section"||
      !sha.test(lock.commit) || lock.adapter!=="src/brand-profile.mjs"||
      lock.tokens!=="data/records/design-tokens/561-group.tokens.json")
    throw new Error("Unqualified original Group brand source lock");
  const root=resolve(sourceRoot);
  const actual=execFileSync("git",["-C",root,"rev-parse","HEAD"],{
    encoding:"utf8",timeout:10000
  }).trim();
  if(actual!==lock.commit)throw new Error("Checkout is not the pinned original brand source commit");
  const source=await import(pathToFileURL(join(root,lock.adapter)).href);
  if(typeof source.derive561BrandProfile!=="function")
    throw new Error("Installed original brand source lacks a profile compiler");
  const profile=source.derive561BrandProfile();
  if(profile.edition!==lock.edition||profile.source!==lock.tokens)
    throw new Error("Brand token source edition/path disagrees with apex lock");
  return profile;
}

async function main(){
  const root=process.argv[2];
  if(!root)throw new Error("Usage: node scripts/verify-brand-source.mjs <pinned-source-checkout>");
  const profile=await readPinnedBrandProfile(root);
  const homeData=JSON.parse(readFileSync(new URL("../data/home.json",import.meta.url),"utf8"));
  const estate=JSON.parse(readFileSync(new URL("../data/estate.json",import.meta.url),"utf8"));
  const frontdoor=JSON.parse(readFileSync(new URL("../data/frontdoor.json",import.meta.url),"utf8"));
  const head=project561GroupHead(homeData);
  const homepage=project561GroupHome({home:homeData,estate,frontdoor});
  const result=verifyApexBrand({profile,head,home:homepage});
  console.log(JSON.stringify({
    result:"source-consumer-qualified",
    owner:brandSource.owner,
    sourceCommit:brandSource.commit,
    tokens:brandSource.tokens,
    homeStyle:"original-TUFTE-head",
    sourceRoles:result.checkedRoleCount,
    pixelAssayed:false,
    independentlyAccepted:false
  }));
}
if(process.argv[1]&&
  import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
