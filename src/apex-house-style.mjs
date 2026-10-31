// Projection-only adapter for the 561 Group visual identity in the original
// TUFTE/LivingWebServer homepage. Visual source: 561 Group Visual Design
// Bible v0.4 candidate (especially the apex habitat), existing
// 561-group-website-theme src/index.mts, and the earlier apex src/render.mjs.
// These are recovered design precedents, not newly-adopted institutional law.
// No new renderer, external fonts, CDNs, decorative stock imagery or site router.
export const HOUSE_STYLES = String.raw`
@font-face{font-family:"Space Grotesk";src:url("/fonts/space-grotesk.woff2") format("woff2");font-weight:300 700;font-display:swap}
@font-face{font-family:"Roboto Slab";src:url("/fonts/roboto-slab.woff2") format("woff2");font-weight:300 800;font-display:swap}
@font-face{font-family:"JetBrains Mono";src:url("/fonts/jetbrains-mono.woff2") format("woff2");font-weight:400 700;font-display:swap}
:root{
  color-scheme:light;
  --group-bone:#F2EAD8;--group-ink:#0A0A0A;
  --group-witness:#3D5588;--group-alarm:#FF4530;
  --group-soft:#494742;--house-rule:#CDC6B7;
  --group-dark:#120C02;
  --group-sans:"Space Grotesk","Helvetica Neue",Arial,sans-serif;
  --group-slab:"Roboto Slab",Rockwell,Georgia,serif;
  --group-mono:"JetBrains Mono",ui-monospace,"Courier New",monospace;
  --tufte-bg:var(--group-bone);--tufte-surface:var(--group-bone);
  --tufte-ink:var(--group-ink);--tufte-muted:var(--group-soft);
  --tufte-line:var(--house-rule);--tufte-accent:var(--group-witness);
  --tufte-radius:0;--tufte-gap:clamp(1rem,2.4vw,2rem);
}
html{scroll-behavior:smooth;scroll-padding-top:1.2rem}
body{
  background-color:var(--group-bone);
  background-image:radial-gradient(color-mix(in srgb,var(--group-ink) 4%,transparent) 1px,transparent 1px);
  background-size:4px 4px;
  color:var(--group-ink);font-family:var(--group-slab);
  line-height:1.6;overflow-wrap:break-word;
}
::selection{background:var(--group-alarm);color:#0A0A0A}
.tufte-shell{width:min(1320px,100%);max-width:1320px;padding:clamp(1rem,3.6vw,3.5rem);margin-inline:auto}
.tufte-masthead{
  display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;
  gap:.8rem 2rem;border-top:8px solid var(--group-ink);
  border-bottom:2px solid var(--group-ink);padding:clamp(1.2rem,3vw,2.5rem) 0 1.2rem;
  margin-bottom:clamp(2rem,4vw,3.5rem);background:transparent;
}
.tufte-masthead::before{
  content:"561";display:block;flex-basis:100%;width:100%;order:-1;
  font:700 clamp(8rem,29vw,26rem)/.72 var(--group-sans);
  letter-spacing:-.09em;margin:0 0 clamp(.7rem,2vw,1.7rem) -.035em;
  color:var(--group-alarm);user-select:none;pointer-events:none;
}
.tufte-masthead h1{
  font:700 clamp(1.5rem,3.8vw,3.3rem)/.98 var(--group-sans);
  letter-spacing:-.06em;text-transform:uppercase;color:var(--group-ink);
}
.tufte-eyebrow,.tufte-subtitle{
  font-family:var(--group-mono);font-size:clamp(.66rem,.83vw,.8rem);
  letter-spacing:.1em;text-transform:uppercase;color:var(--group-soft);
  max-width:42rem;line-height:1.55;
}
[data-tufte-navigation]{
  display:flex;flex-wrap:wrap;gap:.3rem 1.1rem;
  justify-content:flex-end;align-items:center;
  font:600 clamp(.72rem,.9vw,.88rem)/1.5 var(--group-mono);
  text-transform:uppercase;letter-spacing:.025em;
}
[data-tufte-navigation] a{
  display:inline-block;padding:.25rem 0;color:var(--group-ink);
  border-bottom:2px solid transparent;text-decoration:none;
}
[data-tufte-navigation] a:hover,[data-tufte-navigation] a[aria-current=page]{
  border-color:var(--group-ink);
}
.tufte-grid{gap:clamp(1rem,2.4vw,2rem);align-items:start}
.tufte-grid>.tufte-tile{
  min-width:0;background:transparent;color:var(--group-ink);
  border:0;border-top:2px solid var(--group-ink);border-radius:0;box-shadow:none;
  padding:clamp(.8rem,1.6vw,1.4rem) 0 clamp(1.6rem,2.4vw,2.5rem);
}
.tufte-tile header{
  border:0;border-bottom:1px solid var(--house-rule);
  padding:0 0 .8rem;margin:0 0 1rem;
}
.tufte-tile h2{
  font:700 .79rem/1.5 var(--group-mono);letter-spacing:.105em;
  text-transform:uppercase;color:inherit;
}
.tufte-tile-body{
  font:400 clamp(1rem,1.16vw,1.17rem)/1.6 var(--group-slab);
  overflow-wrap:anywhere;
}
.tufte-tile-body p{max-width:45rem;margin:0 0 1rem}
.tufte-tile-body ul{padding-left:1.25rem}
.tufte-tile-body li{padding:.15rem 0}
.tufte-tile-body a{color:var(--group-witness);text-decoration:underline;text-underline-offset:.18em;text-decoration-thickness:1px}
.tufte-grid>#introduction{
  grid-column:span 8;min-height:21rem;background:var(--group-ink);color:var(--group-bone);
  border-top:8px solid var(--group-alarm);
  padding:clamp(1.3rem,2.8vw,3rem);
}
#introduction h2{font:700 clamp(1.7rem,4.2vw,4rem)/1 var(--group-sans);letter-spacing:-.052em}
#introduction header{border-bottom-color:#494742}
#introduction .tufte-tile-body p:first-child{
  font:400 clamp(1.24rem,2vw,1.8rem)/1.35 var(--group-slab);max-width:38rem;
}
#introduction a{color:var(--group-bone)}
.tufte-grid>#contact{grid-column:span 4;border-top:8px solid var(--group-witness)}
.tufte-grid>#explore,.tufte-grid>#physical-world{grid-column:span 12}
#explore .tufte-tile-body ul{
  list-style:none;padding:0;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));
  gap:0;border-top:1px solid var(--house-rule);
}
#explore .tufte-tile-body li{
  border-bottom:1px solid var(--house-rule);padding:clamp(.8rem,2vw,1.5rem) 1rem;
}
#explore .tufte-tile-body li a{
  display:block;font:700 clamp(1.2rem,2.1vw,2rem)/1.18 var(--group-sans);
  color:var(--group-ink);text-decoration:none;letter-spacing:-.03em;
}
#explore .tufte-tile-body li a:hover{text-decoration:underline;text-decoration-thickness:2px}
#explore .tufte-tile-body li p{font:400 .95rem/1.5 var(--group-slab);color:var(--group-soft);margin:.65rem 0 0}
#physical-world{
  border-top:8px solid var(--group-ink);
  border-bottom:2px solid var(--group-ink);padding:clamp(1.5rem,3vw,3rem) 0;
}
#physical-world h2{
  max-width:21ch;font:700 clamp(2.1rem,5.1vw,5.1rem)/.99 var(--group-sans);
  letter-spacing:-.055em;text-transform:none;
}
#physical-world .tufte-tile-body p:first-child{
  font:400 clamp(1.2rem,2.2vw,2rem)/1.3 var(--group-slab);max-width:46rem;
}
#physical-world .tufte-tile-body p:last-child{
  font:400 .82rem/1.65 var(--group-mono);max-width:62rem;color:var(--group-soft);
}
.tufte-grid>#support,.tufte-grid>#companies{grid-column:span 6}
.tufte-footer{
  margin-top:clamp(2rem,4vw,4rem);padding:clamp(1rem,2vw,2rem);
  border-top:8px solid var(--group-alarm);background:var(--group-ink);
  color:var(--group-bone);border-radius:0;
  font:400 .75rem/1.7 var(--group-mono);
}
.tufte-footer a{color:var(--group-bone)}
:where(a,button,input,select,textarea):focus-visible{
  outline:3px solid var(--group-witness)!important;outline-offset:4px!important;
}
@media(max-width:780px){
  .tufte-masthead{align-items:flex-start}
  .tufte-masthead::before{font-size:clamp(6rem,35vw,17rem)}
  [data-tufte-navigation]{justify-content:flex-start}
  .tufte-grid>.tufte-tile{grid-column:span 12!important}
  #introduction{min-height:unset!important}
  .tufte-shell{padding:1rem}
  #explore .tufte-tile-body ul{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:.001ms!important;transition-duration:.001ms!important}
}
@media(prefers-color-scheme:dark){
  :root{color-scheme:dark;--group-ink:#F2EAD8;--group-bone:#120C02;
    --group-soft:#C3BCAA;--house-rule:#494035;--group-witness:#A4B8EF;
    --tufte-bg:var(--group-bone);--tufte-surface:var(--group-bone);
    --tufte-ink:var(--group-ink);--tufte-muted:var(--group-soft);
    --tufte-line:var(--house-rule);--tufte-accent:var(--group-witness)}
  #introduction{background:#F2EAD8;color:#120C02}
  #introduction header{border-bottom-color:#999}
  #introduction a{color:#120C02}
  .tufte-footer{background:#F2EAD8;color:#120C02}
  .tufte-footer a{color:#120C02}
}
@media print{
  html{color-scheme:light}
  body{background:#fff!important;color:#000!important}
  .tufte-masthead::before{color:#000}
  .tufte-tile,.tufte-footer,#introduction{background:#fff!important;color:#000!important}
  .tufte-grid>.tufte-tile{break-inside:avoid}
}
`;
