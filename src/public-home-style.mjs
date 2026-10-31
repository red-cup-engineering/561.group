// The Group's original visual identity lives in apex-house-style.mjs.
// This is ONLY the four-journey, two-frontier and commerce component layer.
// It does not override the house's colors, typography, giant 561 masthead,
// dark mode, print behavior, responsive base, or TUFTE renderer.
export const SITE_STYLES = String.raw`
.tufte-grid>#introduction {grid-column:span 12;min-height:0}
.tufte-grid>#frontiers {grid-column:span 12}
.tufte-grid>#paths,.tufte-grid>#explore,.tufte-grid>#trade,.tufte-grid>#companies {grid-column:span 12}
.tufte-grid>#services,.tufte-grid>#method,.tufte-grid>#agents,.tufte-grid>#support {grid-column:span 6}
.tufte-grid>#physical-world {grid-column:span 12}
.site-overline,.site-category,.site-provider,.site-step-number,.site-eyeline {
  font:650 .76rem/1.5 var(--house-mono);text-transform:uppercase;
  letter-spacing:.09em
}
#introduction .site-overline {color:var(--house-alarm)}
.site-display {
  font:700 clamp(2.65rem,6.3vw,6.4rem)/.97 var(--house-sans);
  letter-spacing:-.058em;text-wrap:balance;max-width:17ch;margin:.35rem 0 1.3rem
}
.site-intro {font:400 clamp(1.15rem,1.8vw,1.55rem)/1.5 var(--house-slab);max-width:67ch}
.site-hero-note {font:400 .92rem/1.55 var(--house-mono);max-width:70ch;opacity:.92}
.site-actions {display:flex;gap:.55rem 1rem;flex-wrap:wrap;margin:1.5rem 0}
a.site-action {
  display:inline-flex;justify-content:center;align-items:center;
  font:700 .84rem/1.2 var(--house-mono);min-height:2.9rem;
  padding:.9rem 1.1rem;text-decoration:none;letter-spacing:.01em;
  border:2px solid currentColor;background:var(--house-alarm);
  color:#0A0A0A;border-radius:0
}
a.site-action--quiet {background:transparent;color:inherit}
a.site-action:hover {outline:2px solid currentColor;outline-offset:3px}
.site-card-grid,.site-project-grid,.site-house-list,.site-service-grid {
  display:grid;list-style:none;padding:0!important;margin:0;gap:clamp(.7rem,1.8vw,1.5rem)
}
.site-card-grid {grid-template-columns:repeat(4,minmax(0,1fr))}
.site-card-grid--three,.site-project-grid {grid-template-columns:repeat(3,minmax(0,1fr))}
.site-service-grid,.site-house-list {grid-template-columns:repeat(2,minmax(0,1fr))}
.site-card,.site-project,.site-house-list li {
  display:flex;flex-direction:column;min-width:0;gap:.65rem;
  padding:1.1rem;border:1px solid var(--house-rule);
  border-top:4px solid var(--house-ink);background:transparent
}
.site-card h3,.site-project h3,.site-house-list strong {
  font:700 clamp(1.1rem,1.5vw,1.55rem)/1.2 var(--house-sans);
  letter-spacing:-.03em;margin:0
}
.site-card p,.site-project p,.site-house-list p {
  font:400 .94rem/1.55 var(--house-slab);margin:.2rem 0 .7rem
}
.site-card a,.site-project a,.site-house-list a,
.site-service a {font-weight:700;text-underline-offset:.18em}
.site-card a:last-child {margin-top:auto}
.site-card .site-category {color:var(--house-witness)}
.site-card .site-category::before {content:"■ "}
.site-section-lead {font:400 clamp(1.07rem,1.5vw,1.27rem)/1.55 var(--house-slab);margin:0 0 1.45rem}
.site-service {border-top:4px solid var(--house-ink);padding:1rem 0;min-width:0}
.site-service h3 {font:700 clamp(1.18rem,1.8vw,1.55rem)/1.15 var(--house-sans);margin:.5rem 0}
.site-service p {font-size:.96rem;line-height:1.5;margin:.5rem 0}
.site-service .site-provider {color:var(--house-witness)}
.site-service .site-example {font-size:.88rem;color:var(--house-soft)}
.site-steps {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.3rem;list-style:none;padding:0!important}
.site-step {border-top:3px solid var(--house-ink);padding-top:1rem}
.site-step h3 {font:700 1.1rem/1.2 var(--house-sans);margin:.5rem 0}
.site-step p {font:.9rem/1.5 var(--house-slab)}
.site-step-number {color:var(--house-witness)}
.site-muted {font:.86rem/1.55 var(--house-mono);color:var(--house-soft)}
.site-quote {font:500 clamp(1.25rem,2.3vw,2.15rem)/1.35 var(--house-slab);max-width:42ch}
.site-inline-list {display:flex;flex-wrap:wrap;gap:1rem;list-style:none;padding:0!important}
.site-endpoints {list-style:none;padding:0!important;margin:0}
.site-endpoints li {
  display:grid;grid-template-columns:4.7rem minmax(0,1fr);
  gap:.2rem .7rem;padding:.75rem 0;border-bottom:1px solid var(--house-rule)
}
.site-endpoints .site-method {font:700 .76rem/1.4 var(--house-mono);color:var(--house-witness)}
.site-endpoints a,.site-endpoints code {overflow-wrap:anywhere}
.site-endpoints p {grid-column:2;margin:0;font-size:.89rem;line-height:1.5}
.site-directory {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem}
.site-directory h3 {font:700 1.2rem/1.2 var(--house-sans)}
.site-directory ul {padding-left:1rem}
.site-directory li {margin:.6rem 0}
.site-directory span {display:block;font:.84rem/1.45 var(--house-mono);color:var(--house-soft)}
#frontiers {border-top:8px solid var(--house-alarm)}
#frontiers header h2 {font:700 clamp(1.75rem,3.6vw,3.7rem)/1.06 var(--house-sans);
  letter-spacing:-.047em;text-transform:none;max-width:24ch}
.site-frontier-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(1rem,2vw,2rem);margin:1.8rem 0}
.site-frontier {min-width:0;border-top:6px solid var(--house-ink);padding:1.4rem 0}
.site-frontier:nth-child(2) {border-color:var(--house-alarm)}
.site-frontier h3 {font:700 clamp(1.35rem,2.3vw,2.45rem)/1.09 var(--house-sans);
  letter-spacing:-.045em;margin:0 0 1rem;max-width:19ch}
.site-frontier .site-frontier-thesis {font:400 clamp(1.05rem,1.35vw,1.2rem)/1.5 var(--house-slab)}
.site-frontier .site-frontier-present {font-size:.94rem;line-height:1.55}
.site-frontier .site-frontier-boundary {font:.84rem/1.55 var(--house-mono);
  color:var(--house-soft);border-top:1px solid var(--house-rule);padding-top:1rem;margin-top:1rem}
.site-frontier-throughline {font:700 clamp(1.05rem,1.5vw,1.35rem)/1.4 var(--house-sans);max-width:66ch}
/* The original public feed receipt becomes an accessible editorial figure.
 * All values are provided by the source-admitted projection, not by CSS or JS
 * guesses. House typography, dark palette and renderer remain authoritative. */
.tufte-grid>#coverage {grid-column:span 12;border-top:8px solid var(--house-witness)}
.site-edition-kicker {
  font:700 .78rem/1.5 var(--house-mono);letter-spacing:.11em;
  color:var(--house-witness);margin:0 0 1.3rem
}
.site-edition-metrics {
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  gap:clamp(.6rem,1.8vw,1.5rem);margin:0 0 1.7rem;padding:0
}
.site-edition-metric {
  border-top:3px solid var(--house-ink);
  padding:1rem 0;min-width:0
}
.site-edition-metric dt {
  font:650 .79rem/1.45 var(--house-mono);letter-spacing:.015em;
  max-width:17ch;color:var(--house-soft)
}
.site-edition-metric dd {
  margin:.45rem 0 0;font:700 clamp(2rem,3.9vw,4.2rem)/1 var(--house-sans);
  letter-spacing:-.055em;overflow-wrap:anywhere;font-variant-numeric:tabular-nums
}
.site-edition-figure {margin:2rem 0 1.45rem;max-width:65rem}
.site-edition-figure figcaption {
  font:600 clamp(.93rem,1.2vw,1.09rem)/1.5 var(--house-slab);
  max-width:72ch;padding:0 0 1rem;border-bottom:1px solid var(--house-rule)
}
.site-edition-sources {list-style:none;padding:0!important;margin:0}
.site-edition-source {
  padding:1.05rem 0 .85rem;border-bottom:1px solid var(--house-rule);
  break-inside:avoid
}
.site-edition-source-heading {
  display:flex;flex-wrap:wrap;align-items:baseline;
  justify-content:space-between;gap:.25rem 1rem;margin:0 0 .65rem
}
.site-edition-source-heading strong {
  font:700 clamp(.98rem,1.45vw,1.22rem)/1.25 var(--house-sans)
}
.site-edition-source-heading span {
  font:600 .8rem/1.5 var(--house-mono);color:var(--house-soft)
}
.site-edition-meter {
  height:.7rem;background:var(--house-rule);overflow:hidden;
  border:1px solid var(--house-rule)
}
.site-edition-meter>span {display:block;height:100%;background:var(--house-witness)}
.site-edition-meter--unknown {
  background:repeating-linear-gradient(135deg,transparent 0,transparent 7px,
    var(--house-rule) 7px,var(--house-rule) 9px)
}
.site-edition-source p {margin:.5rem 0 0}
.site-edition-links {
  margin:1.35rem 0 0;padding-top:.9rem;border-top:1px solid var(--house-rule);
  font:600 .85rem/1.8 var(--house-mono)
}
#posts .site-card-grid {grid-template-columns:repeat(3,minmax(0,1fr))}
#posts .site-card {padding:clamp(1.15rem,1.8vw,1.8rem);gap:.8rem}
#posts .site-card h3 {
  font:700 clamp(1.23rem,1.8vw,1.85rem)/1.15 var(--house-sans);
  letter-spacing:-.045em;text-wrap:balance
}
#posts .site-card p {max-width:44ch}
@media(max-width:1050px){
  #posts .site-card-grid {grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-card-grid {grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-project-grid {grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-steps {grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:760px){
  .site-edition-metrics {grid-template-columns:repeat(2,minmax(0,1fr))}
  .tufte-grid>.tufte-tile{grid-column:span 12!important}
  .site-service-grid,.site-house-list,.site-frontier-grid,.site-directory {grid-template-columns:1fr}
  .site-display {font-size:clamp(2.6rem,10vw,4.4rem)}
}
@media(max-width:430px){
  #posts .site-card-grid {grid-template-columns:1fr}
  .site-edition-metric dd {font-size:clamp(2rem,9.5vw,3.5rem)}
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
  .site-edition-metric,.site-edition-source,#posts .site-card {break-inside:avoid}
  .site-frontier,.site-project,.site-card{break-inside:avoid}
  a.site-action{background:transparent!important;color:#000!important}
}
`;
