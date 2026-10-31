// The Group's original visual identity lives in apex-house-style.mjs.
// This is ONLY the four-journey, two-frontier and commerce component layer.
// It does not override the Group's colors, typography, giant 561 masthead,
// dark mode, print behavior, responsive base, or TUFTE renderer.
export const SITE_STYLES = String.raw`
.tufte-grid>#introduction {grid-column:span 12;min-height:0}
.tufte-grid>#frontiers {grid-column:span 12}
.tufte-grid>#paths,.tufte-grid>#explore,.tufte-grid>#trade,.tufte-grid>#companies {grid-column:span 12}
.tufte-grid>#services,.tufte-grid>#method,.tufte-grid>#agents,.tufte-grid>#support {grid-column:span 6}
.tufte-grid>#physical-world {grid-column:span 12}
.site-overline,.site-category,.site-provider,.site-step-number,.site-eyeline {
  font:650 .76rem/1.5 var(--group-mono);text-transform:uppercase;
  letter-spacing:.09em
}
#introduction .site-overline {color:var(--group-alarm)}
.site-display {
  font:700 clamp(2.65rem,6.3vw,6.4rem)/.97 var(--group-sans);
  letter-spacing:-.058em;text-wrap:balance;max-width:17ch;margin:.35rem 0 1.3rem
}
.site-intro {font:400 clamp(1.15rem,1.8vw,1.55rem)/1.5 var(--group-slab);max-width:67ch}
.site-hero-note {font:400 .92rem/1.55 var(--group-mono);max-width:70ch;opacity:.92}
.site-actions {display:flex;gap:.55rem 1rem;flex-wrap:wrap;margin:1.5rem 0}
a.site-action {
  display:inline-flex;justify-content:center;align-items:center;
  font:700 .84rem/1.2 var(--group-mono);min-height:2.9rem;
  padding:.9rem 1.1rem;text-decoration:none;letter-spacing:.01em;
  border:2px solid currentColor;background:var(--group-alarm);
  color:#0A0A0A;border-radius:0
}
a.site-action--quiet {background:transparent;color:inherit}
a.site-action:hover {outline:2px solid currentColor;outline-offset:3px}
.site-card-grid,.site-project-grid,.site-group-list,.site-service-grid {
  display:grid;list-style:none;padding:0!important;margin:0;gap:clamp(.7rem,1.8vw,1.5rem)
}
.site-card-grid {grid-template-columns:repeat(4,minmax(0,1fr))}
.site-card-grid--three,.site-project-grid {grid-template-columns:repeat(3,minmax(0,1fr))}
.site-service-grid,.site-group-list {grid-template-columns:repeat(2,minmax(0,1fr))}
.site-card,.site-project,.site-group-list li {
  display:flex;flex-direction:column;min-width:0;gap:.65rem;
  padding:1.1rem;border:1px solid var(--house-rule);
  border-top:4px solid var(--group-ink);background:transparent
}
.site-card h3,.site-project h3,.site-group-list strong {
  font:700 clamp(1.1rem,1.5vw,1.55rem)/1.2 var(--group-sans);
  letter-spacing:-.03em;margin:0
}
.site-card p,.site-project p,.site-group-list p {
  font:400 .94rem/1.55 var(--group-slab);margin:.2rem 0 .7rem
}
.site-card a,.site-project a,.site-group-list a,
.site-service a {font-weight:700;text-underline-offset:.18em}
.site-card a:last-child {margin-top:auto}
.site-card .site-category {color:var(--group-witness)}
.site-card .site-category::before {content:"■ "}
.site-section-lead {font:400 clamp(1.07rem,1.5vw,1.27rem)/1.55 var(--group-slab);margin:0 0 1.45rem}
.site-service {border-top:4px solid var(--group-ink);padding:1rem 0;min-width:0}
.site-service h3 {font:700 clamp(1.18rem,1.8vw,1.55rem)/1.15 var(--group-sans);margin:.5rem 0}
.site-service p {font-size:.96rem;line-height:1.5;margin:.5rem 0}
.site-service .site-provider {color:var(--group-witness)}
.site-service .site-example {font-size:.88rem;color:var(--group-soft)}
.site-steps {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.3rem;list-style:none;padding:0!important}
.site-step {border-top:3px solid var(--group-ink);padding-top:1rem}
.site-step h3 {font:700 1.1rem/1.2 var(--group-sans);margin:.5rem 0}
.site-step p {font:.9rem/1.5 var(--group-slab)}
.site-step-number {color:var(--group-witness)}
.site-muted {font:.86rem/1.55 var(--group-mono);color:var(--group-soft)}
.site-quote {font:500 clamp(1.25rem,2.3vw,2.15rem)/1.35 var(--group-slab);max-width:42ch}
.site-inline-list {display:flex;flex-wrap:wrap;gap:1rem;list-style:none;padding:0!important}
.site-endpoints {list-style:none;padding:0!important;margin:0}
.site-endpoints li {
  display:grid;grid-template-columns:4.7rem minmax(0,1fr);
  gap:.2rem .7rem;padding:.75rem 0;border-bottom:1px solid var(--house-rule)
}
.site-endpoints .site-method {font:700 .76rem/1.4 var(--group-mono);color:var(--group-witness)}
.site-endpoints a,.site-endpoints code {overflow-wrap:anywhere}
.site-endpoints p {grid-column:2;margin:0;font-size:.89rem;line-height:1.5}
.site-directory {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem}
.site-directory h3 {font:700 1.2rem/1.2 var(--group-sans)}
.site-directory ul {padding-left:1rem}
.site-directory li {margin:.6rem 0}
.site-directory span {display:block;font:.84rem/1.45 var(--group-mono);color:var(--group-soft)}
#frontiers {border-top:8px solid var(--group-alarm)}
#frontiers header h2 {font:700 clamp(1.75rem,3.6vw,3.7rem)/1.06 var(--group-sans);
  letter-spacing:-.047em;text-transform:none;max-width:24ch}
.site-frontier-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(1rem,2vw,2rem);margin:1.8rem 0}
.site-frontier {min-width:0;border-top:6px solid var(--group-ink);padding:1.4rem 0}
.site-frontier:nth-child(2) {border-color:var(--group-alarm)}
.site-frontier h3 {font:700 clamp(1.35rem,2.3vw,2.45rem)/1.09 var(--group-sans);
  letter-spacing:-.045em;margin:0 0 1rem;max-width:19ch}
.site-frontier .site-frontier-thesis {font:400 clamp(1.05rem,1.35vw,1.2rem)/1.5 var(--group-slab)}
.site-frontier .site-frontier-present {font-size:.94rem;line-height:1.55}
.site-frontier .site-frontier-boundary {font:.84rem/1.55 var(--group-mono);
  color:var(--group-soft);border-top:1px solid var(--house-rule);padding-top:1rem;margin-top:1rem}
.site-frontier-throughline {font:700 clamp(1.05rem,1.5vw,1.35rem)/1.4 var(--group-sans);max-width:66ch}
@media(max-width:1050px){
  .site-card-grid {grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-project-grid {grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-steps {grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:760px){
  .tufte-grid>.tufte-tile{grid-column:span 12!important}
  .site-service-grid,.site-group-list,.site-frontier-grid,.site-directory {grid-template-columns:1fr}
  .site-display {font-size:clamp(2.6rem,10vw,4.4rem)}
}
@media(max-width:430px){
  .site-card-grid,.site-card-grid--three,.site-project-grid,.site-steps{grid-template-columns:1fr}
  .site-actions{flex-direction:column}
  a.site-action{width:100%}
  .site-endpoints li{grid-template-columns:1fr}
  .site-endpoints p{grid-column:1}
}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  a.site-action{transition:none}
}
@media print{
  .site-frontier,.site-project,.site-card{break-inside:avoid}
  a.site-action{background:transparent!important;color:#000!important}
}
`;
