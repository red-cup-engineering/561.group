import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {qualifySuppliers} from "../scripts/release-preflight.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("standalone 561.group imports only the real upstream TUFTE/LivingWebServer Fetch API",()=>{
  const pkg=JSON.parse(read("package.json"));
  const lock=JSON.parse(read("package-lock.json"));
  const received=qualifySuppliers({manifest:pkg,lock,registry:"https://registry.561.group/"});
  assert.equal(received.living,pkg.dependencies["@red-cup-engineering/living-web-server"]);
  assert.equal(received.markdown,pkg.dependencies["@red-cup-engineering/markdown-engineering-services-section"]);
  assert.equal(pkg.dependencies["@red-cup-engineering/l-space"],undefined);
  assert.equal(pkg.dependencies["@red-cup-engineering/computer-web-server"],undefined);
  assert.ok(read("src/living-home.mjs").includes('from "@red-cup-engineering/living-web-server/fetch"'));
  assert.ok(read("src/living-home.mjs").includes("createLivingWebServer({"));
  assert.ok(!read("src/living-home.mjs").includes("createTufteApplication"));
  assert.ok(pkg.scripts.test.includes("node --test test/native-home.test.mjs"));
  // Public CI receives the original immutable registry archives and their
  // integrity. It does not clone private TUFTE source across organizations.
  const workflow=read(".github/workflows/public-intake-safety.yml");
  assert.ok(!workflow.includes("repository: red-cup-engineering/web-page-tiling-engine"));
  assert.ok(workflow.includes("Probe actual TUFTE supplier"));
  const npm=read(".npmrc");
  assert.ok(npm.includes("registry=https://registry.npmjs.org/"));
  for(const scope of ["@561-group","@emsweb","@harmonious-union","@koios-news","@lenticule-science","@red-cup-engineering","@rsc-quiescent","@union-officer-academy","@coesite-operations","@causeway-services","@emsenn"]) {
    assert.ok(npm.includes(scope+":registry=https://registry.561.group/"),
      "no internal house package should incorrectly escape to public npm: "+scope);
  }
});


test("supplier selection refuses floating versions, changed archives and incoherent peers",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  const name="@red-cup-engineering/living-web-server";
  const check=(manifest,source)=>qualifySuppliers({manifest,lock:source,registry:"https://registry.561.group/"});
  for(const value of ["latest","^0.1.1","git+https://github.com/red-cup-engineering/living-web-server.git#"+"a".repeat(40)]){
    const changed=structuredClone(pkg);changed.dependencies[name]=value;
    assert.throws(()=>check(changed,lock),/immutable published supplier/u);
  }
  for(const patch of [{integrity:null},{version:"99.0.0"},{resolved:"https://other.example/archive.tgz"}]){
    const changed=structuredClone(lock);Object.assign(changed.packages["node_modules/"+name],patch);
    assert.throws(()=>check(pkg,changed),/supplier|archive/iu);
  }
  const peers=structuredClone(lock);
  peers.packages["node_modules/"+name].peerDependencies["@red-cup-engineering/markdown-engineering-services-section"]="0.5.6";
  assert.throws(()=>check(pkg,peers),/share the selected Markdown/u);
});
