// Renders the 561.group public files from data/home.json and data/estate.json, in every language the site serves.
// Pure: data and a locale's speaker (src/locales.mjs) in, file contents out.

import { locale as localeFaces, sitemapXml, trustedHtml, DEFAULT_LOCALE, LOCALES, localePath } from "./locales.mjs";
import { PUBLIC_ROUTES } from "./home-tufte.mjs";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Han runs inside text that is not itself Chinese are marked Simplified Chinese, for voice and face.
const cjk = (html, tag) => (tag.startsWith("zh") ? html : html.replace(/[㐀-鿿]+/g, (run) => `<span lang="zh-Hans">${run}</span>`));

const plain = (parts) => parts.map((p) => (typeof p === "string" ? p : p.text)).join("");

const sectionLabel = (n, titleHtml) =>
  `<p class="sec-label"><span class="sec-num">§${n}</span><span>${titleHtml}</span></p>`;

const nodeUrl = (node) => node.url ?? `https://${node.host}/`;

/** Every glossed term of the design, in sentence order, with its note: { text, note, gloss }. */
function designTerms(home) {
  const d = home.design;
  const parts = [d.sentence, ...d.loop.map((l) => l.line), d.knowledge.line, d.whole].flat();
  return parts.filter((p) => typeof p !== "string").map((p) => ({ text: p.text, note: p.note, gloss: d.notes[p.note] }));
}

// A node's name or line in the page's language when there is a message for it; an authored game record's own words otherwise.
const nodeWords = (say, node, field) => (say.has(`estate.node.${node.host}.${field}`) ? say.html(`estate.node.${node.host}.${field}`) : esc(node[field]));

function nodeTile(node, say, { door = false } = {}) {
  return `<li><a class="node${door ? " door" : ""}" href="${esc(nodeUrl(node))}" data-host="${esc(node.host)}" data-url="${esc(nodeUrl(node))}" data-told="neither">
  <span class="node-head"><span class="told" aria-hidden="true">○</span><span class="host">${esc(node.host)}</span></span>
  <span class="name">${nodeWords(say, node, "name")}</span>
  <span class="line">${nodeWords(say, node, "line")}</span>
  <span class="told-text visually-hidden">${say.html("ui.noReading")}</span>
</a></li>`;
}

// The glossed sentences of the design, in loop order, for the ticker: terms without their note marks.
function tickerHtml(home, say, bare) {
  const d = home.design;
  const keys = ["home.design.sentence", ...d.loop.map((l) => `home.design.loop.${l.letter}.line`), `home.design.loop.${d.knowledge.letter}.line`, "home.design.whole"];
  return keys.map((key) => say.html(key, {}, bare).replace(/[.。](<\/span>)?$/u, "$1")).join(" <b>✶</b> ") + " <b>✶</b> ";
}

const CSS = `
@font-face{font-family:"Space Grotesk";src:url(/fonts/space-grotesk.woff2) format("woff2");font-weight:300 700;font-display:swap}
@font-face{font-family:"Roboto Slab";src:url(/fonts/roboto-slab.woff2) format("woff2");font-weight:300 800;font-display:swap}
@font-face{font-family:"JetBrains Mono";src:url(/fonts/jetbrains-mono.woff2) format("woff2");font-weight:400 700;font-display:swap}
:root{
  --ink:#0a0a0a;--ink-soft:#494742;--surface:#f2ead8;--surface-deep:#e2daca;--rule:#cdc6b7;
  --alarm:#ff4530;--alarm-ink:#c52a17;--accent:#3d5588;
  --band:#0a0a0a;--band-ink:#f2ead8;--band-soft:#999791;--band-rule:#2e281d;
  --sans:"Space Grotesk","Helvetica Neue",Arial,sans-serif;
  --serif:"Roboto Slab",Rockwell,Georgia,serif;
  --mono:"JetBrains Mono",ui-monospace,"Courier New",monospace;
  --gutter:56px;--max:1320px;--measure:44rem;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ink:#e4e4e4;--ink-soft:#999791;--surface:#120c02;--surface-deep:#1c160a;--rule:#2a2519;
  --alarm-ink:#ff6a55;--accent:#88a4dd;
  --band:#f2ead8;--band-ink:#0a0a0a;--band-soft:#494742;--band-rule:#cdc6b7;
}}
:root[data-theme="dark"]{
  --ink:#e4e4e4;--ink-soft:#999791;--surface:#120c02;--surface-deep:#1c160a;--rule:#2a2519;
  --alarm-ink:#ff6a55;--accent:#88a4dd;
  --band:#f2ead8;--band-ink:#0a0a0a;--band-soft:#494742;--band-rule:#cdc6b7;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{color-scheme:light dark;-webkit-text-size-adjust:100%;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{min-height:100dvh;background:var(--surface);background-image:radial-gradient(color-mix(in srgb,var(--ink) 4%,transparent) 1px,transparent 1px);background-size:4px 4px;color:var(--ink);font-family:var(--serif);font-size:17px;line-height:1.6;overflow-x:hidden;overflow-wrap:break-word}
::selection{background:var(--alarm);color:#0a0a0a}
a{color:inherit;text-underline-offset:.2em;text-decoration-thickness:1px}
a:focus-visible{outline:3px solid var(--alarm);outline-offset:3px}
.visually-hidden{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter)}
.mono{font-family:var(--mono)}

/* the group: companies and follow */
.group-lead{max-width:var(--measure);margin-bottom:1.5rem}
.companies{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);margin-bottom:2rem}
.companies li{background:var(--surface);padding:1.1rem 1.2rem}
.companies h3{font-family:var(--sans);font-size:1.15rem;letter-spacing:-.01em}
.companies .kind{font-family:var(--mono);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--alarm-ink)}
.companies p{font-size:.9rem;color:var(--ink-soft);margin:.4rem 0 .6rem}
.companies .links{font-family:var(--mono);font-size:.75rem;display:flex;flex-wrap:wrap;gap:.4rem 1rem}
.latest{max-width:var(--measure);margin-bottom:2rem}
.latest h3{font-family:var(--sans);font-size:1.15rem}
.latest ul{list-style:none;margin:.6rem 0}
.latest li{padding:.25rem 0;border-bottom:1px solid var(--rule)}
.latest li span,.latest p{font-family:var(--mono);font-size:.75rem;color:var(--ink-soft)}
.follow{border-top:3px solid var(--ink);padding-top:1rem;max-width:var(--measure)}
.follow h3{font-family:var(--sans);font-size:1.15rem}
.follow ul{list-style:none;font-family:var(--mono);font-size:.85rem;margin:.6rem 0}
.follow li{padding:.15rem 0}

/* ticker */
.ticker{background:var(--ink);color:var(--surface);font-family:var(--mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;overflow:hidden;padding:.55rem 0}
.ticker-track{display:inline-flex;animation:tick 140s linear infinite}
.ticker-track span{padding-right:0}
.ticker b{color:var(--alarm);font-weight:400;padding:0 .9em}
@keyframes tick{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.ticker-track{animation:none}}

/* top bar */
.bar{display:flex;gap:1.5rem;justify-content:space-between;align-items:baseline;flex-wrap:wrap;font-family:var(--mono);font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;padding-top:1rem;padding-bottom:1rem;border-bottom:1px solid var(--rule)}
.bar strong{font-weight:700}
.bar .phase{color:var(--alarm-ink)}
.bar nav{display:flex;gap:1.1rem;flex-wrap:wrap}
.bar nav a{text-decoration:none}
.bar nav a:hover{text-decoration:underline}

/* hero */
.hero{padding-top:clamp(1.5rem,4vw,3rem);padding-bottom:clamp(2.5rem,6vw,5rem)}
.hero-top{display:grid;grid-template-columns:1fr auto;align-items:start;gap:1.5rem}
.numeral{font-family:var(--sans);font-weight:700;font-size:clamp(8.5rem,37vw,33rem);line-height:.74;letter-spacing:-.075em;color:var(--alarm);margin-left:-.06em;user-select:none}
.masthead{list-style:none;font-family:var(--mono);font-size:.76rem;letter-spacing:.07em;text-transform:uppercase;border-left:3px solid var(--ink);padding:.2rem 0 .2rem .9rem;line-height:2;margin-top:1rem}
.lede{font-family:var(--serif);font-weight:300;font-size:clamp(1.5rem,3.3vw,2.95rem);line-height:1.16;letter-spacing:-.012em;max-width:24em;margin-top:clamp(1.5rem,4vw,3rem);text-wrap:pretty}
.address{font-family:var(--mono);font-size:.8rem;letter-spacing:.03em;color:var(--ink-soft);margin-top:1.6rem;max-width:var(--measure)}
.address::before{content:"→ ";color:var(--alarm-ink)}

/* section labels */
.sec{padding-top:clamp(3rem,7vw,6rem);padding-bottom:clamp(3rem,7vw,6rem)}
.sec-label{display:flex;gap:.9rem;align-items:baseline;font-family:var(--mono);font-size:.78rem;letter-spacing:.09em;text-transform:uppercase;border-top:3px solid currentColor;padding-top:.7rem;margin-bottom:clamp(1.6rem,4vw,3rem)}
.sec-num{color:var(--alarm-ink);font-weight:700}

/* intended design */
.design-sentence{font-family:var(--serif);font-weight:400;font-size:clamp(1.4rem,2.9vw,2.55rem);line-height:1.26;letter-spacing:-.01em;max-width:30em;text-wrap:pretty}
.term{background-image:linear-gradient(var(--alarm),var(--alarm));background-size:100% .12em;background-position:0 92%;background-repeat:no-repeat}
.ref{font-family:var(--mono);font-size:.42em;font-weight:700;vertical-align:super;line-height:0;margin-left:.08em}
.ref a{color:var(--alarm-ink);text-decoration:none;padding:0 .1em}
.ref a:hover{text-decoration:underline}
.caveat{font-family:var(--mono);font-size:.76rem;color:var(--ink-soft);max-width:var(--measure);margin-top:1.4rem}
.caveat::before{content:"‡ ";color:var(--alarm-ink)}
.loop-lead{font-family:var(--mono);font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;margin:clamp(2.5rem,5vw,4rem) 0 1rem}
.loop{position:relative;display:grid;grid-template-columns:1fr 1fr;border:3px solid var(--ink);max-width:62rem}
.cell{padding:clamp(1rem,2.4vw,1.8rem);min-height:clamp(9rem,17vw,13rem);display:flex;flex-direction:column;gap:.4rem;transition:background-color .5s,color .5s}
.cell:nth-child(1){border-right:1px solid var(--ink);border-bottom:1px solid var(--ink)}
.cell:nth-child(2){border-bottom:1px solid var(--ink)}
.cell:nth-child(3){border-right:1px solid var(--ink)}
.cell:nth-child(2),.cell:nth-child(4){text-align:right;align-items:flex-end}
.letter{font-family:var(--sans);font-weight:700;font-size:clamp(3rem,7vw,5.4rem);line-height:.85;color:transparent;-webkit-text-stroke:2px var(--ink)}
.phase-name{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
.cell p{font-family:var(--serif);font-size:clamp(1rem,1.6vw,1.22rem);line-height:1.3;max-width:17em}
.cell .ref{font-size:.6em}
html[data-phase="M"] .cell[data-letter="M"],html[data-phase="A"] .cell[data-letter="A"],html[data-phase="P"] .cell[data-letter="P"],html[data-phase="E"] .cell[data-letter="E"]{background:var(--alarm);color:#0a0a0a}
html[data-phase="M"] .cell[data-letter="M"] .letter,html[data-phase="A"] .cell[data-letter="A"] .letter,html[data-phase="P"] .cell[data-letter="P"] .letter,html[data-phase="E"] .cell[data-letter="E"] .letter{color:#0a0a0a;-webkit-text-stroke:0}
html[data-phase] .cell[data-letter] .ref a{color:inherit}
.knowledge{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:clamp(8.5rem,17vw,12.5rem);aspect-ratio:1;border-radius:50%;background:var(--ink);color:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem;border:6px solid var(--surface);box-shadow:0 0 0 3px var(--ink)}
.knowledge .letter{color:var(--alarm);-webkit-text-stroke:0;font-size:clamp(2.4rem,5vw,3.8rem)}
.knowledge p{font-family:var(--mono);font-size:clamp(.58rem,.9vw,.7rem);letter-spacing:.04em;line-height:1.35;text-transform:uppercase;margin-top:.3rem}
.knowledge .ref a{color:var(--alarm)}
.whole{font-family:var(--serif);font-size:clamp(1.3rem,2.6vw,2.2rem);line-height:1.25;margin-top:clamp(2rem,4vw,3rem);max-width:28em}
.notes{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(19rem,1fr));gap:1.1rem 2.2rem;margin-top:clamp(2.5rem,5vw,4rem);padding-top:1.4rem;border-top:1px solid var(--rule);font-size:.86rem;line-height:1.5;color:var(--ink-soft)}
.notes li{display:grid;grid-template-columns:2.1rem 1fr;scroll-margin-top:2rem}
.notes li:target{color:var(--ink)}
.notes li:target .back{background:var(--alarm);color:#0a0a0a}
.back{font-family:var(--mono);font-weight:700;font-size:.78rem;color:var(--alarm-ink);text-decoration:none;align-self:start;padding:0 .2rem;justify-self:start}

/* conurbation band */
.band{background:var(--band);color:var(--band-ink)}
.band .sec-label{border-top-color:var(--band-ink)}
.band .sec-num,.band .ref a{color:var(--alarm)}
.band-title{font-family:var(--sans);font-weight:700;font-size:clamp(2.6rem,8vw,7rem);line-height:.9;letter-spacing:-.045em}
.band-title .count{color:var(--alarm)}
.band-sub{font-family:var(--serif);font-size:clamp(1.05rem,1.8vw,1.4rem);max-width:34em;margin-top:1.2rem;line-height:1.4}
.legend{list-style:none;display:flex;flex-wrap:wrap;gap:.6rem 1.6rem;font-family:var(--mono);font-size:.74rem;letter-spacing:.04em;margin-top:1.6rem;color:var(--band-soft)}
.legend b{font-weight:700;color:var(--band-ink)}
.legend .g{display:inline-block;width:1.2em;text-align:center}
.reading{font-family:var(--mono);font-size:.72rem;letter-spacing:.05em;color:var(--band-soft);margin-top:.9rem}
.doors,.grid{list-style:none;display:grid;border-top:1px solid var(--band-rule);border-left:1px solid var(--band-rule)}
.doors>li,.grid>li{border-right:1px solid var(--band-rule);border-bottom:1px solid var(--band-rule)}
.doors{grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));margin-top:clamp(2rem,4vw,3rem)}
.grid{grid-template-columns:repeat(auto-fill,minmax(16.5rem,1fr))}
.group-title{font-family:var(--mono);font-size:.74rem;letter-spacing:.09em;text-transform:uppercase;margin:2.6rem 0 .8rem;display:flex;justify-content:space-between;gap:1rem}
.group-title span:last-child{color:var(--band-soft)}
.node{display:flex;flex-direction:column;gap:.35rem;height:100%;padding:1rem 1.1rem 1.15rem;background:var(--band);text-decoration:none;transition:background-color .2s}
.node:hover{background:color-mix(in srgb,var(--band) 86%,var(--alarm))}
.node-head{display:flex;gap:.55rem;align-items:baseline;font-family:var(--mono);font-size:.7rem;letter-spacing:.02em;color:var(--band-soft);min-width:0}
.host{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.told{font-size:.95rem;line-height:1;width:1rem;flex:none;text-align:center;color:var(--band-soft)}
.node[data-told="true"] .told{color:var(--band-ink)}
.node[data-told="both"] .told,.node[data-told="false"] .told{color:var(--alarm)}
.node[data-told="false"] .name{text-decoration:line-through;text-decoration-color:var(--alarm)}
.name{font-family:var(--sans);font-weight:600;font-size:1.18rem;line-height:1.15;letter-spacing:-.01em}
.line{font-family:var(--serif);font-size:.86rem;line-height:1.4;color:var(--band-soft)}
.door{padding:1.4rem 1.3rem 1.6rem;min-height:12rem}
.door .name{font-size:clamp(1.7rem,3vw,2.4rem);letter-spacing:-.03em;margin-top:auto}
.door .line{font-size:.95rem;color:var(--band-ink);opacity:.82}

/* doctrine */
.doctrine{list-style:none;display:flex;flex-direction:column;gap:clamp(2.2rem,5vw,4rem)}
.doctrine li{max-width:19em;font-size:clamp(1.75rem,4.6vw,4rem)}
.doctrine li:nth-child(4n+2){margin-left:clamp(0rem,14vw,16rem)}
.doctrine li:nth-child(4n+3){margin-left:clamp(0rem,5vw,6rem)}
.doctrine li:nth-child(4n+4){margin-left:clamp(0rem,22vw,26rem)}
.doctrine li.long{font-size:clamp(1.35rem,2.8vw,2.4rem);max-width:26em}
.doctrine blockquote{font-family:var(--sans);font-weight:600;line-height:1.02;letter-spacing:-.03em;text-wrap:balance}
.doctrine .nw{white-space:nowrap}
.doctrine blockquote::before{content:"“";color:var(--alarm)}
.doctrine blockquote::after{content:"”";color:var(--alarm)}
.doctrine .src{display:block;font-family:var(--mono);font-size:.74rem;font-weight:400;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-soft);margin-top:.9rem}
.doctrine .src b{color:var(--alarm-ink)}

/* agents */
.agents{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:clamp(1.5rem,4vw,4rem);align-items:start}
.agents h2{font-family:var(--sans);font-weight:700;font-size:clamp(2rem,4.6vw,3.8rem);line-height:.95;letter-spacing:-.04em}
.agents h2 em{font-style:normal;color:var(--alarm)}
.agents .say{font-size:1.05rem;margin-top:1.2rem;max-width:26em}
.endpoints{list-style:none;border:3px solid var(--ink);font-family:var(--mono);font-size:.8rem;line-height:1.45}
.endpoints li{display:grid;grid-template-columns:3.2rem 1fr;gap:.2rem .9rem;padding:.9rem 1rem;border-bottom:1px solid var(--rule)}
.endpoints li:last-child{border-bottom:0}
.endpoints .verb{color:var(--alarm-ink);font-weight:700}
.endpoints a{word-break:break-all}
.endpoints .what{grid-column:2;color:var(--ink-soft);font-family:var(--serif);font-size:.86rem}

/* footer */
.foot{border-top:3px solid var(--ink);padding-top:1.4rem;padding-bottom:3rem;display:flex;flex-wrap:wrap;justify-content:space-between;gap:1.2rem 2rem;font-family:var(--mono);font-size:.74rem;letter-spacing:.05em;text-transform:uppercase}
.foot nav{display:flex;gap:1.2rem;flex-wrap:wrap}
.foot-big{font-family:var(--sans);font-weight:700;font-size:clamp(4rem,17vw,15rem);line-height:.8;letter-spacing:-.07em;color:transparent;-webkit-text-stroke:2px var(--ink);margin-top:clamp(2rem,5vw,4rem);user-select:none;white-space:nowrap;overflow:hidden}
.foot-note{flex-basis:100%;text-transform:none;letter-spacing:.02em;color:var(--ink-soft);font-size:.78rem}

@media (max-width:880px){
  :root{--gutter:20px}
  .hero-top{grid-template-columns:1fr}
  .numeral{font-size:62vw}
  .masthead{margin-top:0}
  .agents{grid-template-columns:1fr}
}
@media (max-width:640px){
  :root{--gutter:16px}
  .loop{grid-template-columns:1fr}
  .cell{border-right:0!important;border-bottom:1px solid var(--ink);text-align:left!important;align-items:flex-start!important;min-height:0}
  .knowledge{position:static;transform:none;width:auto;aspect-ratio:auto;border-radius:0;border:0;box-shadow:none;align-items:flex-start;text-align:left;padding:clamp(1rem,2.4vw,1.8rem)}
  .doctrine li{margin-left:0!important}
  .door{min-height:0}
  .door .name{margin-top:.4rem}
  .bar .phase-wrap{display:none}
}
@media print{.ticker,.bar nav{display:none}body{background:none}.band{background:none;color:inherit}}
/* Languages: CJK faces after the Latin subsets, Lakota in faces that carry its orthography whole, the switcher, the machine-translation note. */
:lang(zh){--sans:"Space Grotesk","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",sans-serif;--serif:"Roboto Slab","Songti SC","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif}
:lang(zh) em{font-style:normal;text-emphasis:filled dot;text-emphasis-position:under right}
:lang(lkt){--serif:"Charis SIL","Gentium Plus",Gentium,"Noto Serif","DejaVu Serif",serif;--sans:"Noto Sans","DejaVu Sans","Space Grotesk",sans-serif}
.langs{display:flex;gap:.75rem;flex-wrap:wrap}
.langs a[aria-current]{font-weight:700;text-decoration:none}
.mt-note{font-family:var(--mono);font-size:.75rem;color:var(--ink-soft);border-left:3px solid var(--alarm);padding:.25rem .75rem;margin:1rem 0 0}
`;

const SCRIPT = (revision, words) => `
(function(){
  var root=document.documentElement;
  var still=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  var words=${JSON.stringify(words).replace(/</g, "\\u003c")};
  var phases=words.phases,i=0;
  var phaseEl=document.getElementById("phase"),clock=document.getElementById("clock");
  function step(){root.setAttribute("data-phase",phases[i][0]);if(phaseEl)phaseEl.textContent=phases[i][1];i=(i+1)%4;}
  function tick(){if(clock)clock.textContent=new Date().toISOString().slice(11,19);}
  step();tick();
  if(!still)setInterval(step,2600);
  setInterval(tick,1000);
  var glyph={"true":"●","both":"◐","false":"✕","neither":"○"};
  function fill(template,values){return template.replace(/\\u0001(\\w+)\\u0001/g,function(_,k){return values[k]})}
  fetch("/estate.json?revision="+encodeURIComponent(${JSON.stringify(revision ?? "")}),{headers:{accept:"application/json"}}).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d)return;
    var by={};d.nodes.forEach(function(n){by[n.url]=n});
    document.querySelectorAll("[data-host]").forEach(function(a){
      var n=by[a.getAttribute("data-url")];if(!n)return;
      a.setAttribute("data-told",n.told);
      a.querySelector(".told").textContent=glyph[n.told];
      a.querySelector(".told-text").textContent=words.said[n.told]+(n.status?" ("+n.status+")":"");
      a.title=fill(n.status?words.titleStatus:words.title,{label:words.labels[n.told],status:n.status,ms:n.ms});
    });
    var t=document.getElementById("derived");if(t){t.textContent=fill(words.derived,{time:d.derivedAt.replace("T"," ").slice(0,19)});t.setAttribute("datetime",d.derivedAt);}
    var c={"true":0,"both":0,"false":0};d.nodes.forEach(function(n){if(n.told in c)c[n.told]++});
    var s=document.getElementById("tally");if(s)s.textContent=fill(words.tally,{answered:c["true"],both:c.both,failed:c["false"]});
  }).catch(function(){});
})();
`;

// Words the live-status script needs, in the page's language; \u0001name\u0001 marks a value the script fills in.
function scriptWords(home, say) {
  const slot = (name) => `\u0001${name}\u0001`;
  return {
    phases: home.design.loop.map((l) => [l.letter, say.text(`home.design.loop.${l.letter}.phase`)]),
    said: Object.fromEntries(["true", "both", "false", "neither"].map((value) => [value, say.text(`ui.said.${value}`)])),
    labels: Object.fromEntries(home.told.map((t) => [t.value, say.text(`home.told.${t.value}.label`)])),
    title: say.text("ui.toldTitle", { label: slot("label"), ms: slot("ms") }),
    titleStatus: say.text("ui.toldTitleStatus", { label: slot("label"), status: slot("status"), ms: slot("ms") }),
    tally: say.text("ui.tally", { answered: slot("answered"), both: slot("both"), failed: slot("failed") }),
    derived: say.text("ui.derived", { time: slot("time") }),
  };
}

/** The home page in one locale. `say` is that locale's speaker (src/locales.mjs). */
export function renderIndex(home, estate, say, items = []) {
  const d = home.design;
  const tag = say.tag;
  const t = (key, values) => say.text(key, values);
  const h = (key, values, tags) => say.html(key, values, tags);
  const doorHosts = new Set(estate.doors);
  const doors = estate.doors.map((host) => estate.nodes.find((n) => n.host === host)).filter(Boolean);
  const groups = estate.groups
    .map((g) => ({ ...g, nodes: estate.nodes.filter((n) => n.group === g.id && !doorHosts.has(n.host)) }))
    .filter((g) => g.nodes.length);
  const notes = Object.keys(d.notes).sort((a, b) => Number(a) - Number(b));
  const loopCells = ["M", "A", "E", "P"].map((letter) => d.loop.find((l) => l.letter === letter));
  // A glossed term keeps its note mark wherever the language puts it.
  const glossTags = Object.fromEntries(notes.map((n) => [`n${n}`, (inner) => `<span class="term">${inner}</span><sup class="ref"><a id="r${n}" href="#n${n}" aria-label="${esc(t("ui.note", { n: Number(n) }))}">${n}</a></sup>`]));
  const bare = Object.fromEntries(notes.map((n) => [`n${n}`, (inner) => inner]));
  const glossed = (key) => h(key, {}, glossTags);
  const name = t("home.name");
  const description = t("home.description");
  const canonical = `${home.origin}${localePath(tag)}`;
  const alternates = say.alternates();
  const faces = localeFaces(tag);
  const g = home.group;
  const termSet = {
    "@type": "DefinedTermSet",
    "@id": `${home.origin}/#design-terms`,
    name: "The 561 Group's design terms",
    inLanguage: "en",
    hasDefinedTerm: designTerms(home).map(({ text, note, gloss }) => ({
      "@type": "DefinedTerm", name: text, description: gloss, inDefinedTermSet: `${home.origin}/#design-terms`, url: `${home.origin}/#n${note}`,
    })),
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${home.origin}/#organization`,
        name,
        url: `${home.origin}/`,
        description,
        foundingDate: home.established,
        logo: { "@type": "ImageObject", url: `${home.origin}/logo.png`, width: 512, height: 512 },
        sameAs: [g.githubOrg, g.actor],
        knowsAbout: g.knowsAbout,
        subOrganization: g.companies.map((c) => ({ "@type": "Organization", "@id": `${c.url}#organization`, name: c.name, url: c.url, sameAs: [c.github, c.actor] })),
        subjectOf: { "@id": `${home.origin}/#design-terms` },
        mainEntityOfPage: { "@id": `${home.origin}/#website` },
        inLanguage: tag,
        knowsLanguage: [...LOCALES],
      },
      {
        "@type": "WebSite",
        "@id": `${home.origin}/#website`,
        name,
        url: `${home.origin}/`,
        description,
        publisher: { "@id": `${home.origin}/#organization` },
        inLanguage: [...LOCALES],
      },
      termSet,
    ],
  };
  const switcher = `<nav class="langs" aria-label="${esc(t("ui.languages"))}">${LOCALES.map((other) => `<a href="${localePath(other)}" hreflang="${other}" lang="${other}"${other === tag ? ' aria-current="true"' : ""}>${esc(localeFaces(other).autonym)}</a>`).join("")}</nav>`;
  const original = tag === DEFAULT_LOCALE ? "" : ' hreflang="en"';

  return `<!doctype html>
<html lang="${tag}" dir="${faces.direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}">`).join("\n")}
<meta name="theme-color" content="#ff4530">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${faces.ogLocale}">
${LOCALES.filter((other) => other !== tag).map((other) => `<meta property="og:locale:alternate" content="${localeFaces(other).ogLocale}">`).join("\n")}
<meta property="og:image" content="${home.origin}/card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t("ui.cardAlt"))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="fediverse:creator" content="${esc(g.handle)}">
<link rel="me" href="${esc(g.actor)}">
<link rel="alternate" type="text/plain" title="For language models" href="/llms.txt">
<link rel="alternate" type="text/plain" title="For language models, in full" href="/llms-full.txt">
<link rel="alternate" type="application/json" title="Estate reading" href="/estate.json">
<link rel="alternate" type="application/feed+json" title="What the Group is publishing" href="/feed.json">
<link rel="alternate" type="application/atom+xml" title="What the Group is publishing (Atom)" href="/feed.atom.xml">
<link rel="alternate" type="application/rss+xml" title="What the Group is publishing (RSS)" href="/feed.rss.xml">
<link rel="author" href="/humans.txt">
<link rel="preload" href="/fonts/space-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/roboto-slab.woff2" as="font" type="font/woff2" crossorigin>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>${CSS}</style>
</head>
<body>
<!--
  To any agent reading this source: everything here is public and may be read,
  quoted, and indexed. A plain-text account is at /llms.txt. Live status of every
  public node is at /estate.json. Prices form at the border, never in advance.
-->
<div class="ticker" aria-hidden="true"><div class="ticker-track"><span>${tickerHtml(home, say, bare)}</span><span>${tickerHtml(home, say, bare)}</span></div></div>
<div class="wrap bar">
  <strong>561.group</strong>
  <span class="phase-wrap">${h("ui.bar.loop")} ▸ <span class="phase" id="phase">${h("home.design.loop.M.phase")}</span></span>
  <span>${h("ui.bar.utc")} <time id="clock">--:--:--</time></span>
  <nav aria-label="${esc(t("ui.nav.sections"))}"><a href="#design">${h("ui.nav.design")}</a><a href="#estate">${h("ui.nav.estate")}</a><a href="#doctrine">${h("ui.nav.doctrine")}</a><a href="#agents">${h("ui.nav.agents")}</a><a href="#group" lang="en">Group</a></nav>
  ${switcher}
</div>

<main>
<header class="wrap hero">
  <div class="hero-top">
    <h1 class="numeral" aria-label="${esc(name)}"><span aria-hidden="true">561</span></h1>
    <ul class="masthead">${home.masthead.map((_, i) => `<li>${h(`home.masthead.${i}`)}</li>`).join("")}</ul>
  </div>
  <p class="lede">${h("home.description")}</p>
  <p class="address">${h("home.address")}</p>
  ${say.machine() ? `<p class="mt-note" role="note">${h("ui.machine")} <a href="/" hreflang="en">English</a></p>` : ""}
</header>

<section class="wrap sec" id="design" aria-labelledby="design-h">
  ${sectionLabel(1, h("ui.section.design"))}
  <h2 class="visually-hidden" id="design-h">${h("ui.section.design")}</h2>
  <p class="design-sentence">${glossed("home.design.sentence")}</p>
  <p class="caveat">${h("home.design.caveat")}</p>
  <p class="loop-lead">${h("home.design.loopLead")}</p>
  <div class="loop">
    ${loopCells
      .map(
        (l) => `<div class="cell" data-letter="${l.letter}"><span class="letter" aria-hidden="true">${l.letter}</span><span class="phase-name">0${
          d.loop.indexOf(l) + 1
        } · ${h(`home.design.loop.${l.letter}.phase`)}</span><p>${glossed(`home.design.loop.${l.letter}.line`)}</p></div>`,
      )
      .join("\n    ")}
    <div class="knowledge"><span class="letter" aria-hidden="true">K</span><p><span class="visually-hidden">${h("ui.knowledge")} </span>${glossed(`home.design.loop.${d.knowledge.letter}.line`)}</p></div>
  </div>
  <p class="whole">${glossed("home.design.whole")}</p>
  <ol class="notes" aria-label="${esc(t("ui.notes"))}">
    ${notes.map((n) => `<li id="n${n}"><a class="back" href="#r${n}" aria-label="${esc(t("ui.noteBack", { n: Number(n) }))}">${n}</a><span>${cjk(h(`home.design.notes.${n}`), tag)}</span></li>`).join("\n    ")}
  </ol>
</section>

<section class="band sec" id="estate" aria-labelledby="estate-h">
  <div class="wrap">
    ${sectionLabel(2, h("ui.section.estate"))}
    <h2 class="band-title" id="estate-h">${h("ui.nodes", { count: estate.nodes.length }, { num: (inner) => `<span class="count">${inner}</span>` })}</h2>
    <p class="band-sub">${h("ui.readingNote")}</p>
    <ul class="legend">${home.told.map((tv) => `<li><span class="g">${tv.glyph}</span> ${h("ui.legend", { label: trustedHtml(`<b>${h(`home.told.${tv.value}.label`)}</b>`), means: trustedHtml(h(`home.told.${tv.value}.means`)) })}</li>`).join("")}</ul>
    <p class="reading">${h("ui.reading")} <time id="derived">${h("ui.pending")}</time> · <span id="tally">${h("ui.noReading")}</span></p>
    <ul class="doors">
      ${doors.map((n) => nodeTile(n, say, { door: true })).join("\n      ")}
    </ul>
    ${groups
      .map(
        (g) => `<h3 class="group-title"><span>${h(`estate.group.${g.id}.title`)}</span><span>${g.nodes.length}</span></h3>
    <ul class="grid">
      ${g.nodes.map((n) => nodeTile(n, say)).join("\n      ")}
    </ul>`,
      )
      .join("\n    ")}
  </div>
</section>

<section class="wrap sec" id="doctrine" aria-labelledby="doctrine-h">
  ${sectionLabel(3, h("ui.section.doctrine"))}
  <h2 class="visually-hidden" id="doctrine-h">${h("ui.section.doctrine")}</h2>
  <ol class="doctrine">
    ${home.doctrine
      .map((q, i) => {
        const text = t(`home.doctrine.${i}.text`);
        const html = h(`home.doctrine.${i}.text`);
        // Keep hyphenated Latin words whole; never inside markup.
        const kept = /[<>]/u.test(html) ? html : html.replace(/\S+-\S+/g, (w) => `<span class="nw">${w}</span>`);
        return `<li${text.length > (tag.startsWith("zh") ? 45 : 90) ? ' class="long"' : ""}><blockquote>${kept}</blockquote><span class="src"><b>§3.${i + 1}</b> · ${h(`home.doctrine.${i}.source`)}</span></li>`;
      })
      .join("\n    ")}
  </ol>
</section>

<section class="wrap sec" id="agents" aria-labelledby="agents-h">
  ${sectionLabel(4, h("ui.section.agents"))}
  <div class="agents">
    <div>
      <h2 id="agents-h">${h("ui.agents.heading", {}, { em: (inner) => `<em>${inner}</em>` })}</h2>
      <p class="say">${h("ui.agents.say")}</p>
    </div>
    <ul class="endpoints">
      ${estate.machine
        .map(
          (m) =>
            `<li><span class="verb">${esc(m.verb)}</span><a href="${esc(m.url)}">${esc(m.url.replace(/^https:\/\//, ""))}</a><span class="what">${h(`estate.endpoint.${m.verb} ${m.url}`)}</span></li>`,
        )
        .join("\n      ")}
    </ul>
  </div>
</section>
<section class="wrap sec" id="group" aria-labelledby="group-h" lang="en">
  ${sectionLabel(5, "The Group")}
  <h2 class="visually-hidden" id="group-h">The Group</h2>
  <p class="group-lead">The 561 Group is the parent of four companies, one for each stage from knowledge to public service, and its public services include an x402 market that agents can pay in USDC on Base.</p>
  <ul class="companies">
    ${g.companies.map((c) => `<li><span class="kind">${esc(c.kind)}</span><h3><a href="${esc(c.url)}">${esc(c.name)}</a></h3><p>${esc(c.role)}</p><span class="links"><a href="${esc(c.url)}">${esc(c.url.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a><a href="${esc(c.github)}">GitHub</a><a href="${esc(c.feeds.json)}">feed</a></span></li>`).join("\n    ")}
  </ul>
  <p class="group-lead">Causeway Services also runs ${g.storefronts.map((x) => `<a href="${esc(x.url)}">${esc(x.name)}</a>`).join(", ")}. New to paying by protocol? <a href="${esc(g.marketGuide)}">Read the x402 guide</a>.</p>
  <p class="group-lead" id="sustain"><strong>Support public work.</strong> ${esc(g.sustainingSupport.summary)} <a href="${esc(g.sustainingSupport.url)}">${esc(g.sustainingSupport.name)} — $${esc(g.sustainingSupport.monthlyUsd)}/month</a>. This is a monthly subscription until canceled; it grants no special access, influence over findings, or claim on customer settlements. <a href="${esc(g.sustainingSupport.billingHelp)}">Billing and cancellation help</a>.</p>
  ${items.length ? `<div class="latest">
    <h3>Latest from the Group</h3>
    <ul>
      ${items.slice(0, 12).map((i) => `<li><a href="${esc(i.url)}">${esc(i.title)}</a> <span>${esc(i.authors[0].name)}${i.date_published ? ` · <time datetime="${esc(i.date_published)}">${esc(i.date_published.slice(0, 10))}</time>` : ""}</span></li>`).join("\n      ")}
    </ul>
    <p><a href="/feed.json">JSON Feed</a> · <a href="/feed.atom.xml">Atom</a> · <a href="/feed.rss.xml">RSS</a></p>
  </div>` : ""}
  <div class="follow">
    <h3>Follow</h3>
    <p>The Group and its companies speak ActivityPub. Search for any handle from a fediverse account.</p>
    <ul>
      <li><a rel="me" href="${esc(g.actor)}">${esc(g.handle)}</a></li>
      ${g.companies.map((c) => `<li><a href="${esc(c.actor)}">${esc(c.handle)}</a></li>`).join("\n      ")}
    </ul>
  </div>
</section>
</main>

<footer class="wrap">
  <p class="foot-big" aria-hidden="true">561 GROUP</p>
  <div class="foot">
    <span>${h("ui.footer.line", { name, established: home.established })}</span>
    <nav aria-label="${esc(t("ui.footer.links"))}"><a href="/contact/"${original}>${h("ui.footer.contact")}</a><a href="/llms.txt">llms.txt</a><a href="/estate.json">estate.json</a><a href="/humans.txt">humans.txt</a></nav>
    <p class="foot-note">${h("ui.footer.note")}</p>
  </div>
</footer>
<script>${SCRIPT(estate.revision, scriptWords(home, say))}</script>
</body>
</html>
`;
}

const designSentence = (d) => `${plain(d.sentence)} ${d.loopLead} ${d.loop
    .map((l) => `${l.phase.toLowerCase()}: ${plain(l.line)}`)
    .join("; ")}; through ${plain(d.knowledge.line)}. ${plain(d.whole)}`;

const offersPhrase = (count) => (Number.isInteger(count) ? `${count} machine-payable offers` : "machine-payable offers");

function supportSection(g) {
  const s = g.sustainingSupport;
  return `## Sustaining public work

[${s.name}](${s.url}) is a $${s.monthlyUsd}/month recurring subscription supporting 561 Group research and technical infrastructure. It continues until canceled. Support confers no special access, influence over findings, or claim on customer settlements. [Billing and cancellation help](${s.billingHelp}).`;
}

function companyLines(g) {
  return g.companies.map((c) => `- [${c.name}](${c.url}): ${c.role} Fediverse: ${c.handle}. Source: ${c.github}. Feeds: [JSON](${c.feeds.json}), [RSS](${c.feeds.rss}), [Atom](${c.feeds.atom}).`).join("\n");
}

function fediverseLines(g) {
  return [`- ${g.handle} (${g.actor}): the 561 Group`, ...g.companies.map((c) => `- ${c.handle} (${c.actor}): ${c.name}`)].join("\n");
}

function marketSection(g, offers) {
  return `## The x402 market

[market.561.group](${g.marketUrl}) is run by Causeway Services. It lists ${offersPhrase(offers)}, each paid per call in USDC on Base over x402 (HTTP 402): request an offer's route without payment to receive its payment challenge. Confirm exact current terms before paying. Agents are welcome.

- [How x402 works, and how to buy here](${g.marketGuide})
- [Discovery (x402 v2)](${g.marketDiscovery}) and [catalog](https://market.561.group/v1/catalog)
- [The market's own llms.txt](https://market.561.group/llms.txt), [agent card](https://market.561.group/.well-known/agent-card.json), MCP at https://market.561.group/mcp
- Also: ${g.storefronts.filter((x) => x.name !== "Market").map((x) => `[${x.name}](${x.url})`).join(", ")}`;
}

// A source-owned visitor/agent guide, not a second page renderer.
function publicGuide(home, editorial) {
  if (!editorial) return "";
  const providers = Object.fromEntries(home.group.companies.map(c => [c.id,c]));
  return [
    "## Start with the real service and project entry points", "",
    "- [Work with us](" + home.origin + "/work/): accountable providers, scoping and terms.",
    "- [Projects](" + home.origin + "/projects/): tools, books, games, worlds, news and commerce.",
    "- [Blog](" + home.origin + "/blog/): source-authored writing from the four companies; original articles remain canonical.",
    "- [About](" + home.origin + "/about/): four companies and work method.",
    "- [For agents](" + home.origin + "/for-agents/): public machine interfaces and permissions.",
    "- [Contact](" + home.origin + "/contact/): human inquiries and public reports.", "",
    "The public pages " + PUBLIC_ROUTES.map(path => home.origin + path).join(", ") +
      " accept text/markdown, application/json and text/html through the same authorized Living Web Server. Use the Accept header to select a representation; it grants no additional source access or AI training rights.", "",
    "## " + editorial.selfService.title, "",
    editorial.selfService.summary, "",
    ...editorial.selfService.examples.map(example =>
      "- [" + example.title + "](" + example.href + "): " + example.summary +
      " Source offer " + example.sku + "; claim cell " + example.cell + "; operation law " + example.law + "."),
    "", editorial.selfService.terms, "",
    "## Areas the companies can scope", "",
    ...editorial.offers.map(x =>
      "- " + x.title + " (" + providers[x.provider].name + "): " + x.scope),
    "", "An advertised capability is not an accepted contract, verified quote or customer outcome.", ""
  ].join("\n");
}

/** llms.txt: the map of the Group for a language model. `facts.marketOffers` is the live count, or absent when it could not be read. */
export function renderLlms(home, estate, facts = {}) {
  const d = home.design;
  const g = home.group;
  const byGroup = estate.groups
    .map((grp) => ({ grp, nodes: estate.nodes.filter((n) => n.group === grp.id) }))
    .filter((x) => x.nodes.length);
  return `# ${home.name}

> ${home.description}

${home.name} (${home.origin}/) is a ${home.masthead[0].toLowerCase()}, established ${home.established}. It is a parent of four companies, and The public site represents accountable offices and companies; an inquiry never grants authority.

Intended design: ${designSentence(d)}

${d.caveat}

${publicGuide(home, facts.frontdoor)}

## Terms of the design

${designTerms(home).map(({ text, gloss }) => `- ${text}: ${gloss}`).join("\n")}

## The companies

${companyLines(g)}

What the Group is publishing, merged from the four companies: [Read the blog](${home.origin}/blog/), [JSON Feed](${home.origin}/feed.json), [Atom](${home.origin}/feed.atom.xml), [RSS](${home.origin}/feed.rss.xml). [Build source-admission receipt](${home.origin}/feed-input-receipt.json) reports the four original company feed reads, SHA-256 of received source response bytes, and withheld-record counts. [PROV-O item provenance](${home.origin}/feed-provenance.jsonld) links each aggregated item to its observed source feed snapshot and asserted company author. These artifacts do not attest article fact-checking, indexing, federation delivery, correction histories or full archive coverage.

GitHub organization of the parent: ${g.githubOrg}. Full prose, doctrine and told values: [llms-full.txt](${home.origin}/llms-full.txt).

${marketSection(g, facts.marketOffers)}

${supportSection(g)}

## Fediverse

${fediverseLines(g)}

## Public nodes

${byGroup.map(({ grp, nodes }) => `### ${grp.title}\n\n${nodes.map((n) => `- [${n.name}](${nodeUrl(n)}): ${n.line}`).join("\n")}`).join("\n\n")}

## Machine-readable

${estate.machine.map((m) => `- [${m.url.replace(/^https:\/\//, "")}](${m.url}): ${m.what}`).join("\n")}
- [${home.origin.replace(/^https:\/\//, "")}/llms-full.txt](${home.origin}/llms-full.txt): This account in full.
- [${home.origin.replace(/^https:\/\//, "")}/sitemap.xml](${home.origin}/sitemap.xml): Every page, with its languages.

## Doctrine

${home.doctrine.map((q) => `- ${q.text}`).join("\n")}

## Languages

${LOCALES.map((tag) => `- [${localeFaces(tag).autonym}](${home.origin}${localePath(tag)})`).join("\n")}
`;
}

/** llms-full.txt: the whole of the home page's prose for a language model. */
export function renderLlmsFull(home, estate, facts = {}) {
  const d = home.design;
  const g = home.group;
  return `# ${home.name}: in full

> ${home.description}

This is the long form of [llms.txt](${home.origin}/llms.txt). Everything here is public.

${publicGuide(home, facts.frontdoor)}

## What the Group is

${home.masthead.join(". ")}. ${home.address}

## The intended design

${designSentence(d)}

${d.caveat}

### The loop

${d.loop.map((l) => `- ${l.letter}, ${l.phase}: ${plain(l.line)}`).join("\n")}
- ${d.knowledge.letter}, ${d.knowledge.phase}: ${plain(d.knowledge.line)}

### Each term, explained

${designTerms(home).map(({ text, note, gloss }) => `${note}. ${text}: ${gloss}`).join("\n\n")}

## Doctrine

${home.doctrine.map((q) => `- "${q.text}" (${q.source})`).join("\n")}

## What "told" means

Each public node's status is derived by the Worker at ${home.origin}/estate.json, which asks the node and tells the answer in Belnap's four values. It is a reading, not a delivery or a promise.

${home.told.map((t) => `- ${t.glyph} ${t.label}: ${t.means}`).join("\n")}

## The companies

${companyLines(g)}

${marketSection(g, facts.marketOffers)}

${supportSection(g)}

## Fediverse

${fediverseLines(g)}

## Every public node

${estate.groups
    .map((grp) => ({ grp, nodes: estate.nodes.filter((n) => n.group === grp.id) }))
    .filter((x) => x.nodes.length)
    .map(({ grp, nodes }) => `### ${grp.title}\n\n${nodes.map((n) => `- [${n.name}](${nodeUrl(n)}): ${n.line}`).join("\n")}`)
    .join("\n\n")}

## Machine endpoints

${estate.machine.map((m) => `- ${m.verb} ${m.url}: ${m.what}`).join("\n")}

## Contact

Public reports and private intake: ${home.origin}/contact/. A submission is not an accepted work order.
`;
}

/** RFC 9116 security.txt; it expires a year after the build and is regenerated by every build. */
export function renderSecurity(home, built) {
  const expires = new Date(built);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return `Contact: ${home.group.securityContact}
Expires: ${expires.toISOString().replace(/\.\d+Z$/, "Z")}
Preferred-Languages: en, zh-Hans
Canonical: ${home.origin}/.well-known/security.txt
`;
}

export function renderHumans(home, updated) {
  return `/* OFFICES */
Authority is held by offices, not persons.
No persons are listed.

/* SITE */
Last update: ${updated}
Standards: HTML, CSS, a little JavaScript
Fonts: Space Grotesk, Roboto Slab, JetBrains Mono (SIL Open Font License 1.1)
`;
}

const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];

export const renderRobots = (home) =>
  `${AI_CRAWLERS.map((agent) => `User-agent: ${agent}\nAllow: /\n`).join("\n")}\nUser-agent: *\nAllow: /\n\nSitemap: ${home.origin}/sitemap.xml\n`;

/** The sitemap: each language's home page with its alternates, and the contact page. */
export const renderSitemap = (home, updated, alternates = []) =>
  sitemapXml([
    ...LOCALES.map((tag) => ({ loc: `${home.origin}${localePath(tag)}`, lastmod: updated, alternates })),
    ...PUBLIC_ROUTES.filter(path => path !== "/").map(path =>
      ({ loc: home.origin + path, lastmod: updated })),
    { loc: `${home.origin}/contact/`, lastmod: updated },
    { loc: `${home.origin}/llms.txt`, lastmod: updated },
    { loc: `${home.origin}/llms-full.txt`, lastmod: updated },
    { loc: `${home.origin}/feed.json`, lastmod: updated },
  ]);
