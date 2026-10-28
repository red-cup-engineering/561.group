import test from "node:test";
import {runInNewContext} from "node:vm";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {bindContent} from "../scripts/bind-content.mjs";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(join(root,path),"utf8");
const publicIssue="https://github.com/561-group/561.group/issues/new?template=service-submission.yml";

test("Group-owned front-door files cannot be silently overwritten from a tracked app source",()=>{
  const scratch=mkdtempSync(join(tmpdir(),"group-source-custody-"));
  const source=join(scratch,"reviewed-group");
  const target=join(scratch,"app");
  const files=[
    "data/home.json","data/estate.json","data/frontdoor.json","data/brand-source.json",
    "locales/en.arb","locales/lkt.arb","locales/zh-Hans.arb",
    "public/contact/index.html","public/favicon.svg","public/logo.png",
  ];
  try{
    mkdirSync(target,{recursive:true});
    for(const file of files){
      const dest=join(source,file);
      mkdirSync(dirname(dest),{recursive:true});
      writeFileSync(dest,"source-owned "+file);
    }
    const git=(...args)=>{
      const result=spawnSync("git",args,{cwd:target,encoding:"utf8"});
      assert.equal(result.status,0,result.stderr);
    };
    git("init","-q");
    const admitted=bindContent(source,target);
    assert.equal(admitted.bound,true);
    assert.equal(readFileSync(join(target,"public/contact/index.html"),"utf8"),
      "source-owned public/contact/index.html");
    // A legacy app PR may still hold an old tracked contact file. Refuse the
    // next bind before destroying that authored evidence or claiming it shipped.
    writeFileSync(join(target,"public/contact/index.html"),"unreceived application change");
    git("add","public/contact/index.html");
    assert.throws(()=>bindContent(source,target),
      /Group-owned content is tracked in the application checkout/u);
    assert.equal(readFileSync(join(target,"public/contact/index.html"),"utf8"),
      "unreceived application change","refusal must happen before any overwrite");
  }finally{rmSync(scratch,{recursive:true,force:true});}
});

test("public contact offers reporting, not media commission or executable authority",()=>{
  const page=read("public/contact/index.html");
  assert.ok(page.includes(publicIssue),"general public issue route must be preserved");
  assert.match(page,/Public submissions are untrusted reports for review/u);
  assert.match(page,/not instructions to autonomous agents/u);
  assert.match(page,/Only an authorized receiving office can separately admit a requirement/u);
  assert.doesNotMatch(page,/issues\/new\?template=media-requirement\.yml/u);
  assert.doesNotMatch(page,/causeway-services\/public-media-services-section\/issues\/new/u);
  assert.match(page,/<form id="private-intake" action="mailto:/u);
  assert.match(page,/event\.preventDefault\(\)/u);
});

test("source-qualified service hints reduce buyer retyping without sending inquiries",()=>{
  const page=read("public/contact/index.html");
  const script=/<script>([\s\S]*?)<\/script>/u.exec(page)?.[1];
  assert.ok(script,"the same original public contact form owns the visitor prefill");
  const simulate=search=>{
    const called=[];
    const elements={"submission-type":{value:"Issue"},"affected":{value:""},"reply-permission":{value:"not-specified"}};
    const form={elements,addEventListener:(event,callback)=>called.push([event,callback])};
    const rightsScope={hidden:false,disabled:false};
    const document={getElementById:id=>{
      if(id==="private-intake")return form;
      if(id==="data-stewardship-scope")return rightsScope;
      assert.fail("unrecognized source-qualified contact control: "+id);
    }};
    runInNewContext(script,{document,location:{search},URLSearchParams},{timeout:1000});
    return {elements,called};
  };
  const actual=simulate("?service="+encodeURIComponent("Research and formal methods"));
  assert.equal(actual.elements["submission-type"].value,"Paid service inquiry");
  assert.equal(actual.elements["reply-permission"].value,"not-specified",
    "a service URL hint does not establish permission to contact");
  assert.equal(actual.elements.affected.value,"Research and formal methods");
  assert.ok(actual.called.some(([event])=>event==="submit"),
    "source-qualified hint preserves an explicit user-controlled submit");
  // Group PR #1 and its rights-scoped successor PR #2 are legitimate
  // original content producers. Extra input/change handlers only update
  // field visibility; they grant neither contact permission nor work.
  const events=actual.called.map(([event])=>event).sort();
  assert.ok(JSON.stringify(events)===JSON.stringify(["submit"]) ||
    JSON.stringify(events)===JSON.stringify(["change","input","submit"]),
    "the public URL hint cannot add unsolicited actions");
  assert.equal(actual.called.filter(([name])=>name==="submit").length,1,
    "one original user-activated submit handler even with scoped visibility listeners");
  // No input in the URL becomes a sent message or asserted legitimate order.
  for(const bad of ["", "?service=%3Cscript%3E", "?service="+encodeURIComponent("x".repeat(150))]){
    const item=simulate(bad);
    assert.equal(item.elements.affected.value,"");
    assert.equal(item.elements["submission-type"].value,"Issue");
    assert.equal(item.elements["reply-permission"].value,"not-specified");
    assert.deepEqual(item.called.map(([event])=>event).sort(),events);
  }
  assert.match(page,/Preparing the draft does not send it/u);
  assert.match(page,/we will not treat an inquiry as an order/u);
});

test("sales contact consent is an explicit buyer-owned field, not inferred from a reply address",()=>{
  const page=read("public/contact/index.html");
  const start=page.indexOf('<label for="reply-permission">');
  const end=page.indexOf('<label for="conditions">',start);
  assert.ok(start>0&&end>start,"the existing original form carries explicit reply scope");
  const segment=page.slice(start,end);
  assert.match(segment,/<select id="reply-permission" name="reply-permission">/u);
  const choices=[...segment.matchAll(/<option value="([^"]+)">/gu)].map(match=>match[1]);
  assert.deepEqual(choices,["not-specified","inquiry-only","no-contact"],
    "unknown is the default; no marketing or contact grant is inferred");
  assert.match(segment,/reply about this inquiry only, not marketing/u);
  assert.match(segment,/A reply address alone does not authorize outreach/u);
  assert.match(page,/const body = fields\.map/u,
    "the visitor-reviewed existing private email retains the selected contact scope");
  assert.match(page,/Preparing the draft does not send it/u);
});

test("long private buyer inquiries have a user-activated clipboard fallback without sending",async()=>{
  const page=read("public/contact/index.html");
  const script=/<script>([\s\S]*?)<\/script>/u.exec(page)?.[1];
  assert.ok(script);
  assert.match(page,/<button id="copy-email-body" class="action" type="button">Copy message<\/button>/u);
  assert.match(page,/id="copy-email-status" role="status" aria-live="polite"/u);
  assert.match(page,/button:focus-visible/u);
  const fields=[
    ["submission-type","Paid service inquiry"],
    ["affected","Research and formal methods"],
    ["need","A bounded demonstration. ".repeat(150)],
    ["reply-channel","buyer@example.test"],
    ["reply-permission","inquiry-only"],
  ];
  const nodes={
    "email-subject":{value:""},
    "email-text":{value:"",focus(){this.focused=true;},select(){this.selected=true;}},
    "open-email":{href:""},
    "copy-email":{hidden:true},
    "email-draft":{hidden:true},
    "copy-email-body":{onclick:null},
    "copy-email-status":{textContent:""},
  };
  const handlers={};
  const form={
    elements:{"submission-type":{value:"Paid service inquiry"},"affected":{value:"Research and formal methods"}},
    addEventListener:(name,fn)=>{handlers[name]=fn;},
    querySelector:selector=>({textContent:selector.match(/label\[for="([^"]+)"\]/u)?.[1]??""}),
  };
  const rightsScope={hidden:false,disabled:false};
  const doc={getElementById:id=>id==="private-intake"?form:
    id==="data-stewardship-scope"?rightsScope:nodes[id]};
  const copied=[];
  const navigator={clipboard:{writeText:async value=>{copied.push(value);}}};
  class FakeFormData {constructor(received){assert.equal(received,form);return fields;}}
  runInNewContext(script,{document:doc,location:{search:""},URLSearchParams,FormData:FakeFormData,navigator},{timeout:1000});
  let prevented=0;
  handlers.submit({preventDefault:()=>{prevented++;}});
  assert.equal(prevented,1);
  assert.equal(nodes["copy-email"].hidden,false,"long mailto body is correctly omitted");
  assert.equal(nodes["email-draft"].hidden,false);
  assert.ok(nodes["open-email"].href.startsWith("mailto:emsenn@561.group?subject="));
  assert.equal(nodes["open-email"].href.includes("&body="),false,
    "no silent truncation or automatic external submission");
  assert.equal(nodes["email-text"].value.includes("reply-permission\ninquiry-only"),true);
  await nodes["copy-email-body"].onclick();
  assert.deepEqual(copied,[nodes["email-text"].value]);
  assert.match(nodes["copy-email-status"].textContent,/send it yourself/u);
  // Re-preparing a visitor draft must invalidate a successful *previous* copy.
  fields[2][1] = "Updated paid inquiry. ".repeat(170);
  handlers.submit({preventDefault() {}});
  assert.equal(nodes["copy-email-status"].textContent, "",
    "newly prepared buyer copy must not inherit an old clipboard success");
  let resolveClipboard;
  navigator.clipboard = {writeText: value => {
    copied.push(value);
    return new Promise(resolve => { resolveClipboard = resolve; });
  }};
  const staleText = nodes["email-text"].value;
  const pendingCopy = nodes["copy-email-body"].onclick();
  fields[2][1] = "Later revised paid inquiry. ".repeat(170);
  handlers.submit({preventDefault() {}});
  assert.notEqual(nodes["email-text"].value, staleText);
  resolveClipboard();
  await pendingCopy;
  assert.equal(nodes["copy-email-status"].textContent, "",
    "a late clipboard completion must not falsely confirm the newer draft");
  navigator.clipboard = {writeText: async value => { copied.push(value); }};
  await nodes["copy-email-body"].onclick();
  assert.equal(copied.at(-1), nodes["email-text"].value,
    "the latest visitor-approved message remains copyable");
  assert.match(nodes["copy-email-status"].textContent, /send it yourself/u);
  // The same guard must refuse a delayed clipboard *error* on an obsolete draft.
  let rejectClipboard;
  navigator.clipboard = {writeText: () => new Promise((_, reject) => { rejectClipboard = reject; })};
  const staleError = nodes["copy-email-body"].onclick();
  fields[2][1] = "Final revised supplier inquiry. ".repeat(170);
  handlers.submit({preventDefault() {}});
  rejectClipboard(new Error("Browser rejected an obsolete clipboard attempt"));
  await staleError;
  assert.equal(nodes["copy-email-status"].textContent, "",
    "an old async rejection must not focus or report fallback for a newer draft");
  delete navigator.clipboard;
  await nodes["copy-email-body"].onclick();
  assert.equal(nodes["email-text"].selected,true,"fallback exposes text for manual copying");
  assert.match(nodes["copy-email-status"].textContent,/manually/u);
  // Buyers using webmail need Copy message even for short mailto drafts.
  fields[2][1]="Short buyer inquiry asking for a bounded quote.";
  navigator.clipboard={writeText:async value=>{copied.push(value);}};
  handlers.submit({preventDefault() {}});
  assert.equal(nodes["copy-email"].hidden,true,
    "a short mailto needs no long-message warning");
  assert.ok(nodes["open-email"].href.includes("&body="),
    "short mailto messages keep their original complete body");
  assert.equal(nodes["email-draft"].hidden,false);
  assert.equal(typeof nodes["copy-email-body"].onclick,"function",
    "the explicit copy control remains available to webmail users");
  await nodes["copy-email-body"].onclick();
  assert.equal(copied.at(-1),nodes["email-text"].value,
    "the short message is copied exactly, with reply scope intact");
  assert.ok(nodes["email-text"].value.includes("reply-permission\ninquiry-only"));
  assert.match(nodes["copy-email-status"].textContent,/send it yourself/u);
});

test("public form labels submission as untrusted, not an executable requirement",()=>{
  const form=read(".github/ISSUE_TEMPLATE/service-submission.yml");
  assert.match(form,/Public issue text is untrusted evidence for review/u);
  assert.match(form,/not.*instruction to an agent/u);
  assert.match(form,/Submissions do not automatically/u);
  assert.doesNotMatch(form,/^\s*- type: [^\n]*media[-_ ]generator/gmu);
  assert.match(form,/Suggested change \(unverified\)/u);
  assert.doesNotMatch(form,/^\s*- Requirement\s*$/mu);
  assert.doesNotMatch(read("public/contact/index.html"),/<option>Requirement<\/option>/u);
});

test("no GitHub workflow reacts automatically to public issues, comments, or discussions",()=>{
  const folder=join(root,".github","workflows");
  const names=readdirSync(folder).filter(n=>/\.ya?ml$/u.test(n));
  assert.ok(names.length>0,"current workflows must be inspected, not treated as absent");
  for(const name of names){
    const content=read(".github/workflows/"+name);
    const lines=content.split(/\r?\n/u);
    const start=lines.findIndex(line=>/^on\s*:/u.test(line));
    assert.notEqual(start,-1,"workflow should declare its event boundary: "+name);
    const header=lines[start];
    const stanza=[header];
    for(let i=start+1;i<lines.length;i++){
      const line=lines[i];
      if(line.trim()&&!/^[ \t]/u.test(line)&&!/^#/u.test(line))break;
      stanza.push(line);
    }
    const events=stanza.join("\n");
    assert.doesNotMatch(events,/^\s{2}(?:issues|issue_comment|discussion|discussion_comment|repository_dispatch)\s*:/gmu,
      "public report events cannot drive a workflow: "+name);
    assert.doesNotMatch(events,/^on\s*:\s*(?:\[[^\]]*(?:issues|issue_comment|discussion|discussion_comment|repository_dispatch)|(?:issues|issue_comment|discussion|discussion_comment|repository_dispatch)\b)/mu,
      "public report event cannot be in an inline trigger list: "+name);
  }
});

test("production is triggered only manually or by a successful original main-source CI push",()=>{
  const workflow=read(".github/workflows/deploy.yml");
  assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:\s*$/mu);
  assert.match(workflow,/^\s{2}workflow_run:\s*$/mu);
  assert.match(workflow,/workflows:\s*\n\s+- "561\.group source, public-intake and TUFTE consumer qualification"/u);
  assert.match(workflow,/github\.event\.workflow_run\.event == 'push'/u);
  assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/u);
  assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/u);
  assert.match(workflow,/git ls-remote origin refs\/heads\/main/u);
  assert.match(workflow,/test "\$GITHUB_SHA" = "\$ADMITTED_SOURCE_SHA"/u);
  assert.doesNotMatch(workflow,/^\s{2}(?:issues|issue_comment|push|pull_request)\s*:/gmu);
});

test("a production deploy has a main-ref and predeploy safety boundary",()=>{
  const workflow=read(".github/workflows/deploy.yml");
  assert.match(workflow,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/u,
    "manual dispatches on an unreviewed ref must never deploy");
  assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/u,
    "an automatic release must follow a successful source CI run");
  const publish=workflow.indexOf("cloudflare/wrangler-action");
  assert.ok(publish>0,"the existing provider deployment must remain explicit");
  const before=workflow.slice(0,publish);
  const legacyInterlock=/Refuse unqualified standalone deployment/u.test(before) &&
    /exit 1/u.test(before);
  const qualifiedRelease=/test -s package-lock\.json/u.test(before) &&
    /npm ci --ignore-scripts/u.test(before) &&
    /npm run check/u.test(before) && /npm test/u.test(before) &&
    /npm run build/u.test(before) && /source-revision\.json/u.test(before);
  assert.ok(legacyInterlock||qualifiedRelease,
    "production needs a fail-closed legacy interlock or an exact-source build, test and receipt before Wrangler");
});

test("ordinary buyer and supplier opportunities use the same private intake without becoming orders",()=>{
  const page=read("public/contact/index.html");
  assert.match(page, /<h2 id="work">Request paid work or offer to supply it<\/h2>/u);
  assert.match(page, /<option>Paid service inquiry<\/option>/u);
  assert.match(page, /<option>Supplier or subcontractor offer<\/option>/u);
  assert.match(page, /name="budget"/u);
  assert.match(page, /name="timing"/u);
  assert.match(page, /name="reply-channel"/u);
  assert.match(page, /\[561 Group sales inquiry\] Request a scope and quote/u);
  assert.match(page, /\[561 Group procurement\] Supplier capacity proposal/u);
  assert.match(page, /const body = fields\.map/u);
  assert.match(page, /const base = `mailto:emsenn@561\.group\?subject=/u);
  assert.match(page, /does not create a purchase, authorize outside contact, assign a job, or record revenue/u);
  assert.match(page, /No GitHub account is needed/u);
});

test("production deployment consumes the exact dependency lock before provider writes",()=>{
  const workflow=read(".github/workflows/deploy.yml");
  const provider=workflow.indexOf("cloudflare/wrangler-action");
  assert.ok(provider>0,"the existing provider must be identifiable");
  const before=workflow.slice(0,provider);
  assert.match(before,/test -s package-lock\.json/u,"absence of the native lock must refuse publication");
  assert.match(before,/npm ci --ignore-scripts/u,"production must use a frozen npm install with required native platform binaries");
  assert.doesNotMatch(before,/npm install --ignore-scripts/u,"unlocked npm install is not a release");
  for(const command of ["npm run check","npm test","npm run build","public/source-revision.json"]){
    assert.ok(before.includes(command),"native build/receipt is required before Wrangler: "+command);
  }
});

test("the production receiver verifies source-owned editorial copy without freezing an obsolete slogan",()=>{
  const workflow=read(".github/workflows/deploy.yml");
  const editorial=JSON.parse(read("data/frontdoor.json"));
  assert.equal(typeof editorial.proposition,"string");
  assert.ok(editorial.proposition.trim().length>0,"the Group publisher owns meaningful editorial copy");
  assert.deepEqual(editorial.vision.frontiers.map(f=>f.id),["union-of-harmonious-colonies","bicameral-biology"]);
  assert.ok(workflow.includes("html.includes(frontdoor.proposition)"));
  assert.ok(workflow.includes("frontdoor.vision.frontiers.map"));
  assert.ok(!workflow.includes("!html.includes('Research you can use.')"),
    "a retired promotional line may not veto an accepted present-purpose homepage");
  assert.ok(workflow.includes("html.includes('buy.stripe.com')"),
    "original genuine support receipt and visitor access must survive the copy correction");
  assert.ok(workflow.includes("receipt.artifactDigests"),
    "editorial relevance must not weaken original release byte verification");
});

test("production independently reads human HTML using browser content negotiation, not an ambiguous default",()=>{
  const workflow=readFileSync(fileURLToPath(new URL("../.github/workflows/deploy.yml",import.meta.url)),"utf8");
  assert.match(workflow,/const home=await read\('\/','text\/html'\)/u);
  assert.match(workflow,/const htmlResponse=await read\(page\.path,'text\/html'\)/u);
  assert.match(workflow,/Independent public home browser-mode receipt/u);
  assert.match(workflow,/accept:'application\/json'/u);
});

test("manual source release independently binds generated artifacts, not source SHA alone",()=>{
  const workflow=read(".github/workflows/deploy.yml");
  assert.ok(workflow.includes("receipt.artifactDigests"));
  assert.ok(workflow.includes("digest('hex')"),"original predeploy source digest required");
  assert.ok(workflow.includes("crypto.subtle.digest('SHA-256',raw)"),"independent public bytes digest required");
  assert.match(workflow,/sourceCommit!==process\.env\.GITHUB_SHA/u);
  assert.match(workflow,/SITE_PUBLICATION_DATE/u);
  assert.match(workflow,/cloudflare\/wrangler-action/u);
});
