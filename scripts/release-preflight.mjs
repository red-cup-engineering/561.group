#!/usr/bin/env node
// This is a local/manual release guard for the ONE original 561.group Worker.
// It never deploys or invents a provider receipt. A successful local CLI exit
// is not production acceptance; the separate Cloudflare/public readback remains.
import {readFile,stat} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";

const SHA=/^[a-f0-9]{40}$/iu;
const required=[
  "public/estate-records.json",
  "public/contact/index.html",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/sitemap.xml",
  "public/robots.txt",
  "public/zh-hans/index.html",
  "public/lkt/index.html"
];

/** Receive one immutable published supplier selection from the original npm lock.
 * Native npm ci still fetches and verifies these archives; this pure check
 * does not claim installation or substitute a Git source for a publication.
 */
export function qualifySuppliers({manifest,lock,registry}) {
  if(registry!=="https://registry.561.group/") throw new Error("Original house registry is required");
  const version=/^\d+\.\d+\.\d+(?:-[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)?$/u;
  const integrity=/^sha512-[A-Za-z0-9+/]+={0,2}$/u;
  const name=leaf=>"@red-cup-engineering/"+leaf;
  const selected=leaf=>manifest.dependencies?.[name(leaf)];
  const locked=leaf=>lock.packages?.["node_modules/"+name(leaf)];
  const living=locked("living-web-server"),tufte=locked("web-page-tiling-engine"),markdown=locked("markdown-engineering-services-section");
  const choices=[
    ["living-web-server",selected("living-web-server"),living],
    ["web-page-tiling-engine",living?.dependencies?.[name("web-page-tiling-engine")],tufte],
    ["markdown-engineering-services-section",selected("markdown-engineering-services-section"),markdown],
  ];
  if(manifest.dependencies?.[name("l-space")] || manifest.dependencies?.[name("computer-web-server")])
    throw new Error("The original Worker must select its shared Fetch application");
  for(const [leaf,choice,entry] of choices) {
    if(!version.test(choice??"") || entry?.version!==choice || !integrity.test(entry?.integrity??""))
      throw new Error("Missing immutable published supplier: "+leaf);
    const url=new URL(entry.resolved);
    if(url.origin!==new URL(registry).origin || url.username || url.password || url.search || url.hash)
      throw new Error("Supplier archive is outside the original registry: "+leaf);
  }
  for(const leaf of ["living-web-server","markdown-engineering-services-section"])
    if(lock.packages?.[""]?.dependencies?.[name(leaf)]!==selected(leaf))
      throw new Error("Manifest and lock choose different suppliers: "+leaf);
  if(living.peerDependencies?.[name("markdown-engineering-services-section")]!==markdown.version ||
     tufte.peerDependencies?.[name("markdown-engineering-services-section")]!==markdown.version)
    throw new Error("The original application and renderer must share the selected Markdown supplier");
  return Object.freeze({living:living.version,tufte:tufte.version,markdown:markdown.version});
}

export function qualifyRelease({mainBranch,sourceSha,checkoutSha,receipt,
  lockPresent,dependenciesInstalled,requiredAssets,duplicateIndex}){
  if(mainBranch!=="main")throw new Error("Only the original main branch may be released");
  if(!SHA.test(sourceSha??"")||!SHA.test(checkoutSha??"")||
     sourceSha.toLowerCase()!==checkoutSha.toLowerCase())
    throw new Error("Release must name the exact checked-out source commit");
  if(receipt?.repository!=="561-group/561.group"||
     receipt?.origin!=="https://561.group"||
     receipt?.renderer!=="TUFTE"||
     receipt?.application!=="LivingWebServer"||
     receipt?.sourceCommit?.toLowerCase()!==sourceSha.toLowerCase())
    throw new Error("Generated site does not belong to this original source commit");
  if(!lockPresent)throw new Error("No committed immutable dependency lock is available");
  if(!dependenciesInstalled)throw new Error("Actual LivingWebServer Fetch package is not installed");
  if(duplicateIndex)throw new Error("An obsolete static English root conflicts with TUFTE");
  if(!Array.isArray(requiredAssets)||requiredAssets.length!==required.length||
     requiredAssets.some(p=>!required.includes(p)))
    throw new Error("Not all original publication assets have been qualified");
  return Object.freeze({schema:"561.group.preflight/v1",sourceCommit:sourceSha,
    application:"LivingWebServer",renderer:"TUFTE",providerDeployed:false,
    independentlyAccepted:false});
}
// A successful Wrangler deploy may precede Cloudflare's public edge receiving.
// This is bounded observation, not an alternate release, bypass or optimistic
// assertion. The deployment workflow still compares exact public asset digests
// and the independently observed provider-native active Worker version.
export async function awaitPublishedRevision({
  sourceSha,origin="https://561.group",fetchImpl=fetch,
  wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  attempts=8,intervalMs=3000
}={}){
  if(!SHA.test(sourceSha??"")||origin!=="https://561.group"||
     !Number.isInteger(attempts)||attempts<1||attempts>8||
     !Number.isInteger(intervalMs)||intervalMs<0||intervalMs>3000)
    throw new TypeError("Only a bounded, exact-source original release can be observed");
  let last="not-observed";
  for(let step=1;step<=attempts;step++){
    try{
      const response=await fetchImpl(origin+"/source-revision.json",{
        method:"GET",redirect:"manual",cache:"no-store",
        headers:{"cache-control":"no-cache",accept:"application/json"},
        signal:AbortSignal.timeout(12000)
      });
      if(response.status!==200)last="http-"+response.status;
      else {
        const receipt=await response.json();
        if(receipt?.repository==="561-group/561.group"&&
           receipt?.origin===origin&&receipt?.renderer==="TUFTE"&&
           receipt?.application==="LivingWebServer"&&
           receipt?.sourceCommit===sourceSha) {
          return receipt;
        }
        last=receipt?.sourceCommit?"source-mismatch":"invalid-receipt";
      }
    }catch { last="unreadable-public-receipt"; }
    if(step<attempts)await wait(intervalMs);
  }
  throw new Error("Public origin failed exact "+sourceSha+
    " release readback after "+attempts+" bounded attempts ("+last+")");
}

const missing=async path=>{try{await stat(path);return false;}catch(error){
  if(error.code==="ENOENT")return true;throw error;
}};
async function main(){
  const run=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
  const mainBranch=run("branch","--show-current");
  const checkoutSha=run("rev-parse","HEAD");
  const sourceSha=process.env.GITHUB_SHA;
  const receipt=JSON.parse(await readFile("public/source-revision.json","utf8"));
  const lockPresent=!(await missing("package-lock.json"));
  qualifySuppliers({manifest:JSON.parse(await readFile("package.json","utf8")),
    lock:JSON.parse(await readFile("package-lock.json","utf8")),registry:"https://registry.561.group/"});
  let dependenciesInstalled=false;
  try{
    const installed=JSON.parse(await readFile("node_modules/@red-cup-engineering/living-web-server/package.json","utf8"));
    dependenciesInstalled=Boolean(installed.exports?.["./fetch"]);
  }catch(error){if(error.code!=="ENOENT")throw error;}
  const requiredAssets=[];
  for(const path of required)if(!(await missing(path))&&(await stat(path)).size>50)requiredAssets.push(path);
  const receiptOf=qualifyRelease({mainBranch,sourceSha,checkoutSha,receipt,
    lockPresent,dependenciesInstalled,requiredAssets,
    duplicateIndex:!(await missing("public/index.html"))});
  console.log("Original public source preflight "+receiptOf.sourceCommit+
    "; provider deployment and independent reader acceptance NOT claimed");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
