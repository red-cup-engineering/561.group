#!/usr/bin/env node
// Browser-level receiving candidate for the ORIGINAL 561.group LivingWebServer
// TUFTE projection. Screenshots are review evidence, NOT accepted golden masters.
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {create561GroupLivingApplication} from "../src/living-home.mjs";

const readJson=async path=>JSON.parse(await readFile(new URL("../"+path,import.meta.url),"utf8"));
const pages=Object.freeze([
  {name:"home",path:"/",width:1440,height:900},
  {name:"home-mobile",path:"/",width:390,height:844},
  {name:"work-mobile",path:"/work/",width:390,height:844},
  {name:"blog-mobile",path:"/blog/",width:390,height:844},
  {name:"about",path:"/about/",width:1440,height:900}
]);
const expectedFontNames=["Space Grotesk","Roboto Slab","JetBrains Mono"];
const FONT_ROUTE=new Map([
  ["/fonts/space-grotesk.woff2","space-grotesk.woff2"],
  ["/fonts/roboto-slab.woff2","roboto-slab.woff2"],
  ["/fonts/jetbrains-mono.woff2","jetbrains-mono.woff2"]
]);
const rgb=(r,g,b)=>"rgb("+[r,g,b].join(", ")+")";

export function qualifyRenderedBrand(value,{path="/"}={}) {
  const errors=[];
  const need=(truth,claim)=>{if(!truth)errors.push(claim)};
  need(value?.houseStyle===true,"Original Group CSS not emitted into real TUFTE head");
  need(value?.tufte===true,"Real TUFTE shell is absent");
  need(value?.bodyBackground===rgb(242,234,216),"Visible body background lost house bone");
  need(value?.mastheadTop==="8px","Institutional masthead lost eight-pixel ink rule");
  need(value?.markContent==='"561"', "Giant original typographic 561 mark is absent");
  need(value?.markColor===rgb(255,69,48),"561 mark lost reserved alarm-red role");
  need(value?.markSize>=105,"561 mark is no longer large enough to carry hierarchy");
  need(value?.markFamily?.includes("Space Grotesk"),"561 mark lost display type channel");
  need(value?.readingFamily?.includes("Roboto Slab"),"Main reading type lost slab channel");
  need(value?.metadataFamily?.includes("JetBrains Mono"),"Evidence labels lost monospaced channel");
  need(value?.fontFaces?.every(x=>x.status==="loaded") &&
       expectedFontNames.every(name=>value.fontFaces.some(x=>x.family===name)),
       "A local required font was not loaded");
  if(path==="/")need(value?.introBackground===rgb(10,10,10),"Homepage introduction lost black-ink mass");
  else need(value?.hasLead===true,"Non-home visitor page lost its own lead section");
  need(value?.tileCount>=(path==="/"?5:3),"A real public visitor route lost its content tiles");
  need(value?.hasNavigation===true,"Useful public navigation disappeared");
  need(value?.hasContact===true,"An actual contact pathway disappeared");
  need(value?.focusWidth>=3,"Keyboard focus has no sufficiently visible outline");
  need(value?.overflowX===false,"Layout overflows viewport horizontally");
  need(value?.identityAppeal===false,"Rejected Lakota-founded appeal is visible again");
  need(value?.viewportWidth>=320,"Visual assay viewport is not a supported width");
  return Object.freeze({passed:errors.length===0,errors});
}

async function servedOriginalApplication() {
  const [home,estate,frontdoor,feed,feedReceipt]=await Promise.all([
    readJson("data/home.json"),readJson("data/estate.json"),readJson("data/frontdoor.json"),
    readJson("public/feed.json"),readJson("public/feed-input-receipt.json")
  ]);
  const application=create561GroupLivingApplication({
    readHome:async()=>home,readEstate:async()=>estate,readFrontdoor:async()=>frontdoor,
    readFeed:async()=>feed,readFeedReceipt:async()=>feedReceipt,releaseHome:home
  });
  const server=createServer(async(req,res)=>{
    try{
      const pathname=new URL(req.url??"/","http://127.0.0.1").pathname;
      if(FONT_ROUTE.has(pathname)){
        const bytes=await readFile(new URL("../public/fonts/"+FONT_ROUTE.get(pathname),import.meta.url));
        res.writeHead(200,{"content-type":"font/woff2","cache-control":"no-store"});
        res.end(bytes);return;
      }
      if(!["/","/work/","/blog/","/about/"].includes(pathname)||req.method!=="GET"){
        res.writeHead(404);res.end();return;
      }
      // Same original application as src/worker.mjs, with canonical Request
      // identity. This browser host is only a test adapter, not a new publisher.
      const original=new Request("https://561.group"+pathname,{
        headers:{accept:"text/html"}
      });
      const received=await application.fetch(original);
      const bytes=Buffer.from(await received.arrayBuffer());
      res.writeHead(received.status,{"content-type":received.headers.get("content-type")??"text/plain",
        "cache-control":"no-store"});
      res.end(bytes);
    }catch(error){
      res.writeHead(500,{"content-type":"text/plain"});
      res.end("Original TUFTE projection refused in browser assay");
      console.error("assay host:",error?.message??String(error));
    }
  });
  await new Promise((resolve,reject)=>{
    server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
  });
  return{origin:"http://127.0.0.1:"+server.address().port,
    close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}

/**
 * A candidate reviewer packet; never an automatically accepted golden master.
 */
export function visualReviewPacket(witness){
  if(!witness||!Array.isArray(witness.cases)||!witness.cases.length)
    throw new TypeError("A real multi-viewport visual witness is required");
  return [
    "# 561 Group visual receiving — REVIEW CANDIDATE",
    "",
    "**Status: NOT INDEPENDENTLY RECEIVED.** Screenshots and computed-style tests",
    "do not appoint the builder as a human visual assayer.",
    "",
    "Tested revision: "+(witness.sourceCommit??"unknown")+" ("+
      (witness.sourceRole??"unknown role")+").",
    "Original PR head: "+(witness.originalPrHead??"not applicable")+".",
    "Brand source: data/brand-source.json (v0.3 DTCG).",
    "The illustrated v0.4 Bible remains candidate evidence, not an adopted edition.",
    "",
    "| Route | Viewport | Computed result | Image | SHA-256 |",
    "| --- | --- | --- | --- | --- |",
    ...witness.cases.map(c=>"| "+c.path+" | "+c.viewport.width+"x"+
      c.viewport.height+" | "+(c.passed?"pass":"REFUSED: "+c.errors.join("; "))+ 
      " | ["+c.screenshot+"]("+c.screenshot+") | "+c.sha256+" |"),
    "",
    "## Independent reader/visual-review task",
    "",
    "Inspect each image without treating implementation tickets as evidence",
    "of aesthetic fit. Compare to the approved original Group works and the",
    "source-owned Design Bible:",
    "https://github.com/561-group/561-group-content-design-services-section",
    "Review hierarchy, typography, giant numeral, bone/ink, the semantically",
    "restrained witness/alarm accents, hard grid/rules, useful navigation,",
    "mobile readability and any rejected identity-led persuasion.",
    "The historical v0.3 6% alarm and 3% witness bounding-box color budgets",
    "require a separate measured image proof; CSS declaration is insufficient.",
    "Keyboard focus and reduced-motion settings were checked, but full WCAG",
    "or screen-reader accessibility audits were not performed by this job.",
    "",
    "Record accept/reject/contested/not-observed for the EXACT SOURCE and",
    "screen specimen with reviewer authority, reasons and original Work",
    "through existing independent receiving. Do not treat this document",
    "or a passing CI as its own independent customer-acceptance record.",
    ""
  ].join("\n");
}

export async function receiveBrowserVisuals({output="artifacts/brand-visual",sourceCommit=process.env.GITHUB_SHA??null}={}) {
  const {chromium}=await import("playwright");
  const host=await servedOriginalApplication();
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?
      {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
    await mkdir(output,{recursive:true});
    const cases=[];
    for(const item of pages){
      const context=await browser.newContext({
        viewport:{width:item.width,height:item.height},deviceScaleFactor:1,
        colorScheme:"light",reducedMotion:"reduce",javaScriptEnabled:false
      });
      try{
        // Avoid third-party network dependencies. Local fonts are from this exact source.
        await context.route("**/*",async route=>{
          const target=new URL(route.request().url());
          if(target.origin===host.origin)await route.continue();
          else await route.abort("blockedbyclient");
        });
        const page=await context.newPage();
        const response=await page.goto(host.origin+item.path,{waitUntil:"networkidle"});
        if(!response || response.status()!==200 ||
          !(response.headers()["content-type"]??"").includes("text/html"))
          throw Error(item.name+" did not render authentic original TUFTE HTML");
        await page.evaluate(()=>document.fonts.ready);
        await page.keyboard.press("Tab");
        const reading=await page.evaluate(()=>{
          const el=(sel)=>document.querySelector(sel);
          const style=(sel,pseudo)=>getComputedStyle(el(sel),pseudo);
          const pseudo=style(".tufte-masthead","::before");
          const root=el("html"),active=document.activeElement;
          const intro=el("#introduction");
          const meta=el(".tufte-eyebrow");
          const tileElements=[...document.querySelectorAll(".tufte-grid>.tufte-tile")];
          const focusWidth=active?parseFloat(getComputedStyle(active).outlineWidth):0;
          return{
            viewportWidth:innerWidth,bodyBackground:style("body").backgroundColor,
            mastheadTop:style(".tufte-masthead").borderTopWidth,
            markContent:pseudo.content,markColor:pseudo.color,markSize:parseFloat(pseudo.fontSize),
            markFamily:pseudo.fontFamily,
            readingFamily:style(".tufte-tile-body").fontFamily,
            metadataFamily:meta?getComputedStyle(meta).fontFamily:style(".tufte-eyebrow").fontFamily,
            introBackground:intro?getComputedStyle(intro).backgroundColor:"",
            houseStyle:!!el('style[data-561-house="visual-design-bible-v0.4-candidate"]'),
            tufte:!!el(".tufte-shell[data-tufte]"),
            tileCount:tileElements.length,hasLead:!!el("#lead"),
            hasNavigation:!!el("[data-tufte-navigation] a"),
            hasContact:!![...document.querySelectorAll("a")].find(a=>a.getAttribute("href")==="/contact/"),
            focusWidth:Number.isFinite(focusWidth)?focusWidth:0,
            overflowX:root.scrollWidth>innerWidth+1,
            identityAppeal:/Lakota-founded/i.test(document.body.innerText),
            fontFaces:[...document.fonts].map(f=>({family:f.family,status:f.status})),
            title:document.title
          };
        });
        const result=qualifyRenderedBrand(reading,{path:item.path});
        const screenshot=join(output,item.name+".png");
        // Keep keyboard-focus evidence in the JSON, but collect the visual
        // specimen without the test harness leaving a skip-link focus box.
        await page.evaluate(()=>document.activeElement?.blur());
        await page.screenshot({path:screenshot,fullPage:true,animations:"disabled"});
        const hash=createHash("sha256").update(await readFile(screenshot)).digest("hex");
        cases.push({name:item.name,path:item.path,viewport:{width:item.width,height:item.height},
          ...result,reading,screenshot:item.name+".png",sha256:hash});
      }finally{await context.close()}
    }
    const sourceRole=process.env.GITHUB_EVENT_NAME==="pull_request"?
      "pull-request-merge-evaluation":"source-commit";
    const originalPrHead=process.env.ORIGINAL_PR_HEAD_SHA??null;
    if(sourceRole==="pull-request-merge-evaluation" &&
      !/^[a-f0-9]{40}$/u.test(originalPrHead??""))
      throw Error("A PR visual witness must distinguish its real head from the evaluated merge ref");
    const witness={
      schema:"561.group/rendered-visual-witness/v1",
      sourceCommit,sourceRole,originalPrHead,
      kind:"actual-original-LivingWebServer-TUFTE-in-headless-Chromium",
      houseSource:"data/brand-source.json",
      acceptance:"CANDIDATE: machine browser conformance; golden-baseline and independent human approval NOT established",
      playwrightVersion:"1.62.1",recordedAt:new Date().toISOString(),cases
    };
    await writeFile(join(output,"witness.json"),JSON.stringify(witness,null,2)+"\n");
    await writeFile(join(output,"REVIEW.md"),visualReviewPacket(witness));
    const failing=cases.filter(x=>!x.passed);
    if(failing.length)throw Error("Rendered brand did not conform: "+
      failing.map(x=>x.name+": "+x.errors.join("; ")).join(" | "));
    console.log(JSON.stringify({result:"browser-style-conformant",cases:cases.length,
      screenshots:cases.map(x=>x.screenshot),independentHumanAccepted:false}));
    return witness;
  }finally{await browser?.close();await host.close()}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  await receiveBrowserVisuals();
}
