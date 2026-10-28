import test from "node:test";
import assert from "node:assert/strict";
import {qualifyRenderedBrand,visualReviewPacket} from "../scripts/assay-rendered-brand.mjs";

const good=()=>({
  viewportWidth:1440,houseStyle:true,tufte:true,
  bodyBackground:"rgb(242, 234, 216)",
  mastheadTop:"8px",markContent:'"561"',
  markColor:"rgb(255, 69, 48)",markSize:416,
  markFamily:'"Space Grotesk", "Helvetica Neue", Arial, sans-serif',
  readingFamily:'"Roboto Slab", Rockwell, Georgia, serif',
  metadataFamily:'"JetBrains Mono", ui-monospace, "Courier New", monospace',
  introBackground:"rgb(10, 10, 10)",
  fontFaces:[
    {family:"Space Grotesk",status:"loaded"},
    {family:"Roboto Slab",status:"loaded"},
    {family:"JetBrains Mono",status:"loaded"}
  ],
  tileCount:11,hasLead:false,hasNavigation:true,hasContact:true,focusWidth:3,
  overflowX:false,identityAppeal:false
});
test("rendered Chromium observation has a passable explicit conformance shape",()=>{
  assert.deepEqual(qualifyRenderedBrand(good()),{passed:true,errors:[]});
});
test("a teal startup stylesheet or lost original 561 numeral fails in the browser",()=>{
  const bad={...good(),bodyBackground:"rgb(244, 244, 238)",
    markContent:"none",markColor:"rgb(0, 107, 100)"};
  const result=qualifyRenderedBrand(bad);
  assert.equal(result.passed,false);
  assert.ok(result.errors.some(x=>x.includes("house bone")));
  assert.ok(result.errors.some(x=>x.includes("mark is absent")));
});
test("a CSS string in HTML is not enough: computed type, local fonts and reading matter",()=>{
  const bad={...good(),markFamily:"Georgia",
    readingFamily:"system-ui",metadataFamily:"Arial",
    fontFaces:[{family:"Space Grotesk",status:"unloaded"}]};
  const result=qualifyRenderedBrand(bad);
  assert.equal(result.passed,false);
  for(const claim of ["display type channel","slab channel","monospaced channel","local required font"])
    assert.ok(result.errors.some(x=>x.includes(claim)),claim);
});
test("the original user-visible regression is independently rejected",()=>{
  const bad={...good(),identityAppeal:true,overflowX:true,focusWidth:0,
    hasNavigation:false,tileCount:0};
  const result=qualifyRenderedBrand(bad);
  assert.equal(result.passed,false);
  for(const fragment of ["Lakota-founded","horizontally","Keyboard focus","navigation","content tiles"])
    assert.ok(result.errors.some(x=>x.includes(fragment)),fragment);
});
test("a narrow supported viewport with unchanged visual hierarchy is admissible",()=>{
  const mobile={...good(),viewportWidth:390,markSize:136.5};
  assert.equal(qualifyRenderedBrand(mobile).passed,true);
});

test("a real secondary visitor page uses its own lead and independent tile count",()=>{
  const work={...good(),tileCount:4,hasLead:true,introBackground:""};
  assert.equal(qualifyRenderedBrand(work,{path:"/work/"}).passed,true);
  const noLead={...work,hasLead:false};
  assert.ok(qualifyRenderedBrand(noLead,{path:"/work/"}).errors.some(x=>
    x.includes("own lead section")));
  const about={...work,tileCount:6,identityAppeal:true};
  assert.ok(qualifyRenderedBrand(about,{path:"/about/"}).errors.some(x=>
    x.includes("Rejected Lakota-founded")));
});

test("an automated visual witness prepares a review packet but cannot approve itself",()=>{
  const report=visualReviewPacket({
    sourceCommit:"a".repeat(40),
    sourceRole:"pull-request-merge-evaluation",
    originalPrHead:"b".repeat(40),
    cases:[{path:"/",viewport:{width:390,height:844},passed:true,
      errors:[],screenshot:"home-mobile.png",sha256:"c".repeat(64)}]
  });
  assert.match(report,/NOT INDEPENDENTLY RECEIVED/u);
  assert.match(report,/pull-request-merge-evaluation/u);
  assert.ok(report.includes("b".repeat(40)));
  assert.match(report,/home-mobile\.png/u);
  assert.throws(()=>visualReviewPacket({cases:[]}),/multi-viewport visual witness/u);
});

test("the visual receipt exposes measured window differences without inventing brand approval",()=>{
  const report=visualReviewPacket({
    sourceCommit:"a".repeat(40),
    cases:[{
      path:"/",viewport:{width:4,height:1},passed:true,
      errors:[],screenshot:"home.png",sha256:"b".repeat(64),
      colorObservation:{
        policyEvaluated:false,independentlyAccepted:false,
        reports:[
          {region:{id:"full-raster"},areaPixels:8,
            colors:[{id:"alarm",matchedPixels:2,fraction:.25},
                    {id:"witness",matchedPixels:2,fraction:.25}]},
          {region:{id:"first-viewport"},areaPixels:4,
            colors:[{id:"alarm",matchedPixels:2,fraction:.5},
                    {id:"witness",matchedPixels:0,fraction:0}]}
        ]
      }
    }]
  });
  assert.match(report,/full-raster.*25\.000%/u);
  assert.match(report,/first-viewport.*50\.000%/u);
  assert.match(report,/NOT a normative design/u);
  assert.match(report,/NOT INDEPENDENTLY RECEIVED/u);
});
