const STYLE="\n:root{color-scheme:light;font:16px/1.5 system-ui,sans-serif;color:#171717;background:#f7f6f3}\n*{box-sizing:border-box}body{max-width:980px;margin:auto;padding:1.5rem}\nheader,section{margin-block:1.5rem}h1{font-size:clamp(1.6rem,3vw,2.5rem)}\nh2{font-size:1.3rem}h3{font-size:1.1rem}p{max-width:74ch}\n.notice{border-left:5px solid #303030;padding:.75rem 1rem;background:#ece9e3}\nlabel{display:block;margin-block:.65rem;font-weight:600}\ninput[type=checkbox]{width:1.2rem;height:1.2rem;vertical-align:middle}\ntextarea,select{display:block;font:inherit;width:100%;max-width:65ch;padding:.5rem;border:2px solid #555;border-radius:0;background:#fff}\ntextarea{min-height:5rem}button{font:inherit;border:2px solid #111;background:#111;color:white;padding:.6rem 1rem;cursor:pointer;margin:.5rem .5rem .5rem 0}\nbutton:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #174cff;outline-offset:3px}\n.case{border-top:3px solid #333;padding-top:1rem}.image-window{width:min(100%,calc(var(--vw) * 1px));aspect-ratio:var(--vw)/var(--vh);max-height:75vh;overflow:hidden;border:2px solid #111;background:white}\n.image-window img{width:100%;height:auto;display:block}fieldset{border:1px solid #555;margin:1rem 0;padding:1rem}\nlegend{font-weight:700}small,.small{font-size:.88rem}code{overflow-wrap:anywhere}\n[hidden]{display:none!important}\n@media print{button,.controls{display:none!important}.case,fieldset{break-inside:avoid}textarea{min-height:3rem}}\n";
const CLIENT="\n(()=>{\n  \"use strict\";\n  const form=document.getElementById(\"readings\");\n  const consent=document.getElementById(\"consent\");\n  const status=document.getElementById(\"status\");\n  const cases=[...document.querySelectorAll(\"[data-reader-case]\")];\n  const say=(value)=>{status.textContent=value;};\n  for(const item of cases){\n    const reveal=item.querySelector(\"[data-reveal]\");\n    const hide=item.querySelector(\"[data-hide]\");\n    const view=item.querySelector(\"[data-view]\");\n    const questions=item.querySelector(\"[data-questions]\");\n    const duration=item.querySelector(\"[data-duration]\");\n    let started=null;\n    reveal.addEventListener(\"click\",()=>{\n      if(!consent.checked){say(\"Choose whether to consent first. No response is collected without it.\");consent.focus();return;}\n      started=performance.now();\n      view.hidden=false;reveal.hidden=true;hide.hidden=false;questions.hidden=true;\n      hide.focus();say(\"Specimen visible. Choose Hide and answer when ready; viewing time is recorded, not gaze.\");\n    });\n    hide.addEventListener(\"click\",()=>{\n      view.hidden=true;hide.hidden=true;questions.hidden=false;\n      duration.value=started===null?\"\":((performance.now()-started)/1000).toFixed(1);\n      questions.querySelector(\"textarea\")?.focus();\n      say(\"Specimen hidden. Answer freely; skipping any item is permitted.\");\n    });\n  }\n  form.addEventListener(\"submit\",(event)=>{\n    event.preventDefault();\n    if(!consent.checked){say(\"No export: consent was not selected.\");return;}\n    const values=Object.fromEntries(new FormData(form).entries());\n    delete values.consent;\n    const report={\n      schema:\"561.group/reader-observation-candidate/v1\",\n      sourceCommit:form.dataset.sourceCommit,\n      sourceRole:form.dataset.sourceRole,\n      declaredConsent:true,\n      exportedAt:new Date().toISOString(),\n      recordKind:\"voluntary self-report, not physiological affect, independent receiving, or authenticated task outcome\",\n      sourceCases:cases.map(item=>({\n        path:item.dataset.route,\n        viewport:item.dataset.viewport,\n        screenshotSha256:item.dataset.sha256\n      })),\n      responses:values,\n      independentAcceptance:false\n    };\n    const blob=new Blob([JSON.stringify(report,null,2)+\"\\n\"],{type:\"application/json\"});\n    const url=URL.createObjectURL(blob);\n    const a=document.createElement(\"a\");a.href=url;a.download=\"561-reader-observation.json\";a.click();\n    setTimeout(()=>URL.revokeObjectURL(url),1000);\n    say(\"Local file offered for download. No answers have been transmitted or independently accepted.\");\n  });\n})();\n";

/** Offline, consent-first reader-study accompaniment to the existing source-owned
 *  Chromium visual witness. This is not an audience measurement service,
 *  accepted benchmark, independent review or web publisher.
 */
const escapeHtml=value=>String(value??"").replace(/[&<>"']/gu,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

export function readerStudyPacket(witness){
  if(!witness||!Array.isArray(witness.cases)||witness.cases.length===0)
    throw new TypeError("An observed Chromium screenshot set is required");
  const cards=witness.cases.map((entry,index)=>{
    if(!/^[a-z0-9][a-z0-9.-]*\.png$/iu.test(entry.screenshot??"")||
       entry.screenshot.includes(".."))
      throw new TypeError("Specimen must refer to a local PNG basename");
    const width=entry.viewport?.width,height=entry.viewport?.height;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)
      throw new TypeError("Specimen needs an actual positive viewport");
    const id="case-"+index;
    const field=(name)=>id+"."+name;
    const label=escapeHtml(entry.path);
    const img=escapeHtml(entry.screenshot);
    const sha=escapeHtml(entry.sha256);
    const vp=width+"×"+height;
    const select=(name,options)=>
      "<label>"+escapeHtml(name)+"<select name=\""+field(name)+"\">"+
      "<option value=\"\">Prefer not to answer / not observed</option>"+
      options.map(item=>"<option value=\""+escapeHtml(item)+"\">"+escapeHtml(item)+"</option>").join("")+
      "</select></label>";
    const ask=(name,question)=>
      "<label>"+escapeHtml(question)+"<textarea name=\""+field(name)+"\" aria-label=\""+
      escapeHtml(question)+"\"></textarea></label>";
    return [
      "<section class=\"case\" data-reader-case data-route=\""+label+"\" data-viewport=\""+
        vp+"\" data-sha256=\""+sha+"\">",
      "<h2>Specimen "+(index+1)+" — "+label+" ("+vp+")</h2>",
      "<p class=\"small\">Source-pinned screenshot digest: <code>"+sha+
        "</code>. The first-viewport mask is an approximation on smaller screens; note device differences before comparing people or peers.</p>",
      "<div class=\"controls\"><button type=\"button\" data-reveal>Reveal source screenshot</button></div>",
      "<div data-view hidden>",
      "<div class=\"image-window\" style=\"--vw:"+width+";--vh:"+height+"\" role=\"img\" aria-label=\"Visual specimen from route "+
        label+"; the equivalent content should also be reviewed through an accessible site\"><img src=\"./"+
        img+"\" alt=\"Source screenshot for "+label+"\" loading=\"lazy\"></div>",
      "<button type=\"button\" data-hide>Hide and answer</button>",
      "</div>",
      "<fieldset data-questions hidden><legend>Your own first reading, after exposure</legend>",
      "<input type=\"hidden\" data-duration name=\""+field("visibleSeconds")+"\" value=\"\">",
      ask("firstImpression","Without looking again, what did you think this was about?"),
      ask("unpromptedRecall","What symbol, composition, phrase or event do you remember?"),
      ask("feltWords","What, if anything, did the experience feel like to you? Mixed or negative is welcome."),
      select("reportedValence",["1 — very unpleasant","2 — somewhat unpleasant","3 — neither / mixed","4 — somewhat pleasant","5 — very pleasant"]),
      select("reportedArousal",["1 — very calm","2 — calm","3 — neither / mixed","4 — energized","5 — strongly activated"]),
      ask("curiosityAndAgency","What would you choose to explore or do next, if anything? Why?"),
      ask("trustAndClarity","What seemed credible, misleading, unclear or inaccessible?"),
      ask("other","What would you change? Any other observation or refusal?"),
      "</fieldset></section>"
    ].join("\n");
  }).join("\n");
  return [
    "<!doctype html>",
    "<html lang=\"en\"><head><meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src 'self' file: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'\">",
    "<title>561 Group — independent reader study candidate (offline)</title>",
    "<style>"+STYLE+"</style></head><body>",
    "<header><h1>Independent reader study — candidate</h1>",
    "<p class=\"notice\"><strong>Not independently received.</strong> This offline study sheet accompanies the exact Chromium visual-review artifacts. It is not a published customer site, clinical measure, approved brand specimen, competitive win or automated acceptance.</p>",
    "<p>Use with a voluntary participant and an independent facilitator. A first-view impression differs from a later navigational task. No answers are sent to 561 Group or anywhere else; an export is a local file, and a competent receiving office must decide its lawful retention and significance. Do not type names or private information.</p>",
    "<p>Before comparative use: register the same reader job, eligible peer specimens and rights, language, viewport, exposure ordering, accessibility choices, recruitment and sample denominators. Keep dissent and nonresponse; do not infer bodily states from reported feelings. Do not use marketing awards as participant outcomes.</p>",
    "</header>",
    "<form id=\"readings\" data-source-commit=\""+escapeHtml(witness.sourceCommit??"unknown")+
      "\" data-source-role=\""+escapeHtml(witness.sourceRole??"unknown")+"\">",
    "<label><input id=\"consent\" name=\"consent\" type=\"checkbox\" value=\"yes\" required> I freely choose to give observations for review; I may decline or stop.</label>",
    "<p>For each specimen, reveal the first-screen approximation, then hide it before giving an unprompted account. The worksheet records visible seconds, not attention or eye-tracking. Longer exposures or bypass for access needs are permitted but must be disclosed in comparison.</p>",
    cards,
    "<section><h2>After the specimens</h2>",
    "<label>Unaided delayed recall: what, if anything, stayed with you?<textarea name=\"delayedRecall\"></textarea></label>",
    "<label>General criticism, accessibility accommodation or reason for stopping<textarea name=\"sessionNotes\"></textarea></label>",
    "<button type=\"submit\">Export your answers locally (JSON)</button>",
    "<p id=\"status\" role=\"status\" aria-live=\"polite\"></p></section></form>",
    "<footer><p class=\"small\">The exported data is voluntary self-report. An independent receiver must separately test live navigation, factual recall against a source, accessibility, rights, art quality and any matched peer. No favorability score automatically closes Group Work.</p>",
    "<p class=\"small\">Source revision: <code>"+escapeHtml(witness.sourceCommit??"unknown")+"</code></p></footer>",
    "<script>"+CLIENT+"</script></body></html>"
  ].join("\n");
}
