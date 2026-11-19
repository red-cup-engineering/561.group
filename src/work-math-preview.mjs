/**
 * Customer-side mathematical Work analysis in the EXISTING Group Work-audit
 * page. The optimizer and distinct buyer verifier are byte-identical copies
 * of one pinned Red Cup Mathematical Readout Exchange source revision. The
 * site build checks the original git commit before emitting public assets.
 *
 * No GitHub task title generates a duration or price; a buyer explicitly
 * supplies the original model. Everything is computed in the user's browser,
 * with no upload, account, inferred contract, real acceleration or payment.
 */
const MESSAGE="Conditional precedence-only model. Supplier durations, prices, "+
  "staff calendars, source rights, any real purchase and customer acceptance "+
  "remain independently unverified.";

export const SAMPLE_WORK_MODEL=Object.freeze({
  sourceRef:"https://github.com/red-cup-engineering/engineering-services-section/issues/137",
  durationUnit:"hypothetical-working-days",
  costUnit:"hypothetical-budget-points",
  budget:2,
  tasks:[
    {id:"requirements",duration:3,accelerateCost:4,dependencies:[]},
    {id:"specification",duration:2,accelerateCost:1,dependencies:["requirements"]},
    {id:"architecture",duration:2,accelerateCost:1,dependencies:["requirements"]},
    {id:"fabrication",duration:3,accelerateCost:4,dependencies:["specification","architecture"]},
  ],
});

/** Native-solver consumer function, not another optimization implementation. */
export async function analyzeLocalWorkModel(request,{optimize,verify}={}){
  const solver=optimize??(await import("./critical-intervention.mjs")).optimizeWorkCriticalIntervention;
  const verifier=verify??(await import("./critical-certificate.mjs")).verifyOptimalWorkIntervention;
  const output=solver(request);
  if(output.status!=="OPTIMAL_ONE_UNIT_CRITICAL_PATH_INTERVENTION"){
    return Object.freeze({
      request, result:output, independentVerification:null,
      limitation:MESSAGE,
    });
  }
  const checked=verifier(request,output);
  if(!checked?.valid||checked.minimumSpend!==output.minimumSpend)
    throw new Error("Original mathematical source and independent proof checker disagree.");
  return Object.freeze({
    request,result:output,independentVerification:checked,
    limitation:MESSAGE,
  });
}

const add=(doc,tag,value,klass)=>{
  const n=doc.createElement(tag);
  if(value!==undefined)n.textContent=String(value);
  if(klass)n.className=klass;
  return n;
};
export function displayLocalWorkMath(doc,packet){
  const host=doc.getElementById("work-math-results");
  if(!host)throw new TypeError("The original Work-mathematics results view is unavailable.");
  host.replaceChildren();
  const {result:out,independentVerification:proof}=packet;
  host.append(add(doc,"h3","Mathematical source reading"));
  host.append(add(doc,"p","Dependency network: "+out.taskCount+" tasks, "+
    out.dependencyCount+" prerequisites, "+out.criticalPathCount+" critical paths."));
  host.append(add(doc,"p","Precedence-only makespan: "+out.makespan+" "+
    out.durationUnit+". Status: "+out.status+"."));
  if(proof){
    host.append(add(doc,"p","Cheapest jointly effective acceleration: "+
      out.minimumSpend+" "+out.costUnit+"; conditional completion "+
      out.forecastMakespan+" "+out.durationUnit+"."));
    const list=add(doc,"ul");
    for(const action of out.accelerate)
      list.append(add(doc,"li",action.id+": shorten by "+action.unitReduction+
        " "+out.durationUnit+"; price "+action.cost+" "+out.costUnit));
    host.append(list);
    host.append(add(doc,"p","Independently checked: "+proof.checked+
      ". "+proof.criticalPathWitnesses+" original critical-path witnesses."));
  }else{
    host.append(add(doc,"p","This model has no admissible one-unit shortening under "+
      "its declared input. Do not invent a price or a supplier."));
  }
  host.append(add(doc,"p",packet.limitation,"site-evidence-limit"));
  return host;
}

export function installLocalWorkMath(doc=globalThis.document){
  const form=doc?.getElementById("work-math-form");
  if(!form)return false;
  const input=doc.getElementById("work-math-source");
  const status=doc.getElementById("work-math-status");
  const example=doc.getElementById("work-math-example");
  const download=doc.getElementById("work-math-download");
  if(!input||!status||!example||!download)
    throw new TypeError("Original Work mathematics form is incomplete");
  input.value=JSON.stringify(SAMPLE_WORK_MODEL,null,2);
  let packet=null;
  example.addEventListener("click",()=>{
    input.value=JSON.stringify(SAMPLE_WORK_MODEL,null,2);
    status.textContent="Hypothetical example restored. Change every unobserved "+
      "duration/cost to qualified original Work evidence before purchase.";
  });
  form.addEventListener("submit",async event=>{
    event?.preventDefault?.();
    download.disabled=true;
    packet=null;
    status.textContent="Calculating all critical paths and the least-cost "+
      "source intervention locally in this browser...";
    try{
      if(input.value.length>3*1024*1024)throw new RangeError("Work model exceeds the 3 MiB browser input profile.");
      const request=JSON.parse(input.value);
      packet=await analyzeLocalWorkModel(request);
      displayLocalWorkMath(doc,packet);
      download.disabled=false;
      status.textContent=packet.independentVerification?
        "Calculation and independent mathematical certificate completed in this browser. No data was uploaded.":
        "Finite model read completed; no permissible shortening identified. No data was uploaded.";
    }catch(error){
      status.textContent="Mathematical Work read refused: "+
        (error instanceof Error?error.message:"invalid input");
      doc.getElementById("work-math-results")?.replaceChildren();
    }
  });
  download.addEventListener("click",()=>{
    if(!packet)return;
    const file=new Blob([JSON.stringify(packet,null,2)+"\n"],
      {type:"application/json"});
    const href=URL.createObjectURL(file);
    const link=add(doc,"a");link.href=href;
    link.download="work-intervention-certificate.json";
    doc.body.append(link);link.click();link.remove();URL.revokeObjectURL(href);
  });
  return true;
}
if(typeof document!=="undefined")installLocalWorkMath();
