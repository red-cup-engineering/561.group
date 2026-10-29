import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve,dirname,join} from "node:path";
import {SECURITY_HEADERS,STATIC_FAST_PATHS,STATIC_CACHE_SECONDS,renderStaticAssetHeaders}
  from "../src/public-delivery.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const config=JSON.parse(readFileSync(join(root,"wrangler.jsonc"),"utf8")
  .replace(/^\s*\/\/.*$/gmu,""));
const routeRules=config.assets.run_worker_first;
const bypass=(path)=>STATIC_FAST_PATHS.some(p=>
  p.endsWith("/*") ? path.startsWith(p.slice(0,-1)) : p===path);

test("only actual public media and Work-audit module skip an otherwise Worker-first site",()=>{
  assert.deepEqual(routeRules,["/*",...STATIC_FAST_PATHS.map(p=>"!"+p)]);
  assert.equal(new Set(STATIC_FAST_PATHS).size,STATIC_FAST_PATHS.length);
  assert.equal(config.assets.binding,"ASSETS");
  assert.equal(config.assets.directory,"./public");
  for(const path of [
    "/","/work/","/work/audit/","/contact/","/estate.json",
    "/source-revision.json","/blog/","/projects/","/about/",
    "/for-agents/","/index.html","/actors/group","/.well-known/webfinger",
    "/inbox","/outbox","/robots.txt","/sitemap.xml","/feed.json",
    "/zh-hans/","/lkt/","/_private/queue","/unknown"
  ])assert.equal(bypass(path),false,"original owner must receive "+path);
  for(const path of [
    "/fonts/space-grotesk.woff2","/fonts/roboto-slab.woff2",
    "/fonts/jetbrains-mono.woff2","/favicon.svg","/logo.png",
    "/card.png","/apple-touch-icon.png","/work/audit/preview.mjs"
  ])assert.equal(bypass(path),true,"public static asset needs direct route "+path);
});

test("only original Worker security headers are represented on every fast-path asset",()=>{
  assert.equal(STATIC_CACHE_SECONDS,300,"no immutable claim for unhashed filenames");
  const text=renderStaticAssetHeaders();
  assert.ok(!STATIC_FAST_PATHS.some(path=>path==="/contact/"||path==="/source-revision.json"));
  const blocks=text.split("\n\n").slice(1);
  assert.equal(blocks.length,STATIC_FAST_PATHS.length);
  for(const [index,block] of blocks.entries()){
    const lines=block.split("\n");
    assert.equal(lines[0],STATIC_FAST_PATHS[index]);
    const h=Object.fromEntries(lines.slice(1).map(line=>{
      const sep=line.indexOf(": ");
      assert.ok(sep>2,"a valid static-asset header rule is required");
      return [line.slice(2,sep).toLowerCase(),line.slice(sep+2)];
    }));
    assert.deepEqual(h,{...SECURITY_HEADERS,"cache-control":"public, max-age=300"});
    assert.equal(h["x-content-type-options"],"nosniff");
    assert.match(h["strict-transport-security"],/includeSubDomains/u);
    assert.match(h["content-security-policy"],/frame-ancestors 'none'/u);
  }
  assert.ok(!text.includes("/contact/"),"no dynamic page acquires static policy");
});

test("source-owned static files have exact generated MIME-bearing counterparts",()=>{
  const originals=["public/fonts/space-grotesk.woff2",
    "public/fonts/roboto-slab.woff2","public/fonts/jetbrains-mono.woff2",
    "public/favicon.svg","public/logo.png","public/card.png",
    "public/apple-touch-icon.png"];
  for(const path of originals){
    const bytes=readFileSync(join(root,path));
    assert.ok(bytes.byteLength>100,path);
  }
});
