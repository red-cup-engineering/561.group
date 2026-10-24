/**
 * Browser-local 561 Group Work-continuity preview.
 *
 * The reader, not the 561.group Worker, fetches public GitHub source.
 * No credentials, cookies, hosted token usage, customer Work mutation,
 * uploaded source, extra cloud worker jobs or payment are involved.
 *
 * This produces a source-bounded preliminary diagnostic, never an
 * authenticated acceptance, deployment, certification or contract.
 */
const API = "https://api.github.com";
export const PREVIEW_LIMIT = 20;
const RUN_LIMIT = 60;
const JSON_BYTES = 1_500_000;
const TIMEOUT_MS = 10_000;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/u;
const STOP = ["", ".", ".."];
const exact = text => typeof text === "string" && text.trim() === text && text.length > 0;

export function publicRepositoryOf(value) {
  if (typeof value !== "string" || value.length > 240) throw new TypeError("Enter one public GitHub owner/repository.");
  let path = value.trim();
  if (path.startsWith("https://github.com/")) {
    const url = new URL(path);
    if (url.origin !== "https://github.com" || url.search || url.hash || url.username || url.password)
      throw new TypeError("Use one direct public GitHub repository URL without extra parameters.");
    path = url.pathname.slice(1).replace(/\/$/u, "");
  }
  const parts = path.split("/");
  if (parts.length !== 2 || parts.some(x => !ID.test(x) || STOP.includes(x)))
    throw new TypeError("Use owner/repository or https://github.com/owner/repository (not an issue or file URL).");
  return Object.freeze({
    owner: parts[0], name: parts[1],
    fullName: parts[0] + "/" + parts[1],
    url: "https://github.com/" + parts[0] + "/" + parts[1],
  });
}

function sourceInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/u.test(value))
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : null;
}
function sha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/iu.test(value) ? value.toLowerCase() : null;
}
function extractRuns(input) {
  return Array.isArray(input?.workflow_runs) ? input.workflow_runs.slice(0, RUN_LIMIT) : null;
}

/**
 * A pull request, a successful workflow, a recorded deployment and a buyer's
 * acceptance are different events. This bounded reading never infers one from
 * another or interprets a missing API row as proof of a missing event.
 */
export function workContinuityPreview({repository, pulls, issues = null, actions, deployments, observedAt} = {}) {
  const repo = typeof repository === "string" ? publicRepositoryOf(repository) : publicRepositoryOf(repository?.fullName);
  if (!Array.isArray(pulls) || pulls.length > PREVIEW_LIMIT ||
      (issues !== null && (!Array.isArray(issues) || issues.length > PREVIEW_LIMIT)) ||
      !exact(observedAt))
    throw new TypeError("An attributed, bounded GitHub PR source and observation time are required.");
  const actionRows = extractRuns(actions);
  const deploymentRows = Array.isArray(deployments) ? deployments.slice(0, RUN_LIMIT) : null;
  const rows = pulls.map(raw => {
    const number = raw?.number;
    if (!Number.isSafeInteger(number) || number < 1 || !exact(raw.title) ||
        (raw.state !== "open" && raw.state !== "closed"))
      throw new TypeError("GitHub returned an unrecognized PR identity or lifecycle.");
    const headSha = sha(raw.head?.sha);
    const mergeSha = raw.merged_at ? sha(raw.merge_commit_sha) : null;
    const state = raw.merged_at ? "merged" : raw.state === "open" ?
      (raw.draft ? "draft" : "open") : "closed-without-merge";
    // GitHub's pull_request / merge_group / push commits are not interchangeable.
    // Prefer an actual observed merge-result run over one on the old PR head.
    const related = actionRows?.filter(run =>
      (mergeSha && sha(run?.head_sha) === mergeSha) ||
      (headSha && sha(run?.head_sha) === headSha)) ?? [];
    const compareRun = related.find(run => mergeSha && sha(run.head_sha) === mergeSha) ??
      related.find(run => headSha && sha(run.head_sha) === headSha) ?? null;
    const checkedSource = compareRun ?
      (mergeSha && sha(compareRun.head_sha) === mergeSha ? "merge-commit" : "pr-head") : null;
    const ci = compareRun ? {
      reading: compareRun.status === "completed" ?
        (compareRun.conclusion === "success" ? "reported-success" :
         compareRun.conclusion === "failure" || compareRun.conclusion === "timed_out" ? "reported-failure" :
         "reported-" + String(compareRun.conclusion ?? "unknown")) : "not-complete",
      source: checkedSource,
      url: "https://github.com/" + repo.fullName + "/actions/runs/" + compareRun.id,
    } : {reading: actionRows ? "unobserved-in-sample" : "source-unavailable", source:null,url:null};
    const deployment = mergeSha && deploymentRows?.find(item => sha(item.sha) === mergeSha);
    const deploymentReading = deployment ? "recorded-not-verified" :
      deploymentRows ? "unobserved-in-sample" : "source-unavailable";
    const gaps = [];
    if (ci.reading === "reported-failure") gaps.push("review reported CI failure at selected source");
    else if (ci.reading === "unobserved-in-sample" || ci.reading === "source-unavailable")
      gaps.push("retrieve a source-matched check and its executed job steps");
    if (state === "merged" && deploymentReading !== "recorded-not-verified")
      gaps.push("qualify the selected production release and running revision");
    if (state === "merged")
      gaps.push("obtain independent beneficiary acceptance; merge is not delivery");
    if (state === "closed-without-merge")
      gaps.push("retain closure reason, not a fabricated delivery");
    return Object.freeze({
      number, title: raw.title.slice(0, 240), state,
      updatedAt: sourceInstant(raw.updated_at),
      mergedAt: sourceInstant(raw.merged_at),
      headSha, mergeSha,
      sourceUrl: repo.url + "/pull/" + number,
      actions: ci,
      deployment: deploymentReading,
      recipientAcceptance: "not-observed-by-public-github-api",
      gaps: Object.freeze(gaps),
    });
  });
  // GitHub Issues are original customer/maintainer Work distinct from the
  // code proposals that may later realize them. The Issues API includes PRs;
  // discard those duplicates before forming the bounded Work union.
  const sourceIssues = issues?.filter(item => !item.pull_request) ?? [];
  const claimedBy = new Map();
  for (const pull of pulls) {
    if (typeof pull.body !== "string") continue;
    const references = pull.body.matchAll(/\b(?:closes|fixes|resolves)\s+#([1-9][0-9]*)\b/giu);
    for (const match of references) {
      const number = Number(match[1]);
      if (!Number.isSafeInteger(number)) continue;
      if (!claimedBy.has(number)) claimedBy.set(number,new Set());
      claimedBy.get(number).add(pull.number);
    }
  }
  const issueRows = sourceIssues.map(source => {
    if (!Number.isSafeInteger(source?.number) || source.number < 1 ||
        !exact(source.title) || !["open","closed"].includes(source.state))
      throw new TypeError("GitHub returned an unrecognized original Issue or lifecycle.");
    const state = source.state === "open" ? "open" :
      source.state_reason === "not_planned" ? "closed-not-planned" : "closed-reason-unverified";
    const related = [...(claimedBy.get(source.number) ?? [])].sort((a,b)=>a-b);
    const gaps = [];
    if (state === "open") gaps.push("confirm owner, actionable requirement and promised delivery");
    if (state.startsWith("closed")) gaps.push("verify closure basis and beneficiary acceptance independently");
    if (related.length) gaps.push("pull request description asserts a connection; confirm source/effect and receiving");
    else gaps.push("no linking PR in sampled source; later work may exist outside this window");
    return Object.freeze({
      workKind:"issue",number:source.number,title:source.title.slice(0,240),state,
      updatedAt:sourceInstant(source.updated_at),closedAt:sourceInstant(source.closed_at),
      stateReason:exact(source.state_reason) ? source.state_reason : null,
      sourceUrl:repo.url + "/issues/" + source.number,
      authoredFixClaims:Object.freeze(related),
      actions:Object.freeze({reading:"not-directly-measured",source:null,url:null}),
      deployment:"not-directly-measured",
      recipientAcceptance:"not-observed-by-public-github-api",
      gaps:Object.freeze(gaps)
    });
  });
  const all = [
    ...rows.map(row=>Object.freeze({workKind:"pull-request",...row})),
    ...issueRows,
  ].sort((a,b)=>
    (b.updatedAt??"").localeCompare(a.updatedAt??"") ||
    a.workKind.localeCompare(b.workKind) || a.number-b.number);
  const selected = Object.freeze(all.slice(0,PREVIEW_LIMIT));
  const unique = new Set(all.map(row => row.workKind + ":" + row.number));
  if (unique.size !== all.length) throw new TypeError("GitHub returned duplicate Work identities.");
  return Object.freeze({
    kind: "561.group.work-continuity-public-preview.v1",
    repository: repo.fullName,
    source: Object.freeze({
      pullRequests: repo.url + "/pulls?q=is%3Apr",
      issues: repo.url + "/issues",
      workflowRuns: repo.url + "/actions",
      deployments: repo.url + "/deployments",
      limits: Object.freeze({pullRequests:PREVIEW_LIMIT,issues:PREVIEW_LIMIT,
        totalWork:PREVIEW_LIMIT,workflowRuns:RUN_LIMIT,deployments:RUN_LIMIT}),
      observation: observedAt,
      actionsAvailable: actionRows !== null,
      issuesAvailable: issues !== null,
      deploymentsAvailable: deploymentRows !== null,
      scope: "newest updated public Issues and pull requests sampled; not all Projects, original Work or external receiving",
    }),
    counts: Object.freeze({
      examined: selected.length,
      issuesExamined: selected.filter(row=>row.workKind==="issue").length,
      pullRequestsExamined: selected.filter(row=>row.workKind==="pull-request").length,
      openIssues: selected.filter(row=>row.workKind==="issue" && row.state==="open").length,
      merged: selected.filter(row => row.state === "merged").length,
      openOrDraft: selected.filter(row => row.workKind==="pull-request" &&
        (row.state === "open" || row.state === "draft")).length,
      closedWithoutMerge: selected.filter(row => row.state === "closed-without-merge").length,
      actionsReportedSuccess: selected.filter(row => row.actions.reading === "reported-success").length,
      actionsUnobserved: selected.filter(row => row.workKind==="pull-request" &&
        (row.actions.reading === "unobserved-in-sample" ||
         row.actions.reading === "source-unavailable")).length,
      independentCustomerAcceptance: null,
    }),
    truncated: all.length > PREVIEW_LIMIT || pulls.length === PREVIEW_LIMIT ||
      (issues?.length ?? 0) === PREVIEW_LIMIT,
    records: selected,
    limits: Object.freeze([
      "GitHub check success is self-reported by the workflow API; executed test steps are not verified here.",
      "Issue closure and a PR author\u0027s Fixes #number claim do not establish useful delivery or beneficiary acceptance.",
      "A deployment object is not a successful live release, operating service or recipient acceptance.",
      "No private source, independent buyer testimony, resource use, monetary cost or settlement is accessed.",
      "Recent records and runs are sampled; an unobserved record is unknown, not proof of nonperformance.",
      "This free source-based preview is not the separately scoped paid Work-continuity audit, quote or contract.",
    ]),
  });
}

async function readJson(fetcher, path, {optional = false} = {}) {
  const request = API + path;
  const response = await fetcher(request, {
    method:"GET", mode:"cors", credentials:"omit", redirect:"error",
    headers:{accept:"application/vnd.github+json"},signal:AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status !== 200) {
    const message = response.status === 403 || response.status === 429 ?
      "GitHub's unauthenticated read limit or API policy denied this preview." :
      response.status === 404 ? "No public GitHub source is available at that address." :
      "GitHub returned HTTP " + response.status + ".";
    throw new Error(message + (optional ? " This evidence remains unknown." : ""));
  }
  const reported = Number(response.headers.get("content-length"));
  if (Number.isFinite(reported) && reported > JSON_BYTES)
    throw new Error("GitHub source exceeds the bounded public preview; commission a scoped audit instead.");
  // Stream and limit actual bytes, not only optional Content-Length.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("GitHub source stream unavailable.");
  let total = 0;
  const parts = [];
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > JSON_BYTES) throw new Error("GitHub returned more data than this bounded preview can inspect.");
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(total);
  let position = 0;
  for (const part of parts) { all.set(part, position); position += part.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(all)); }
  catch { throw new Error("GitHub returned invalid public source JSON."); }
}
export async function inspectPublicGitHub(value, fetcher = fetch, clock = () => new Date().toISOString()) {
  const repo = publicRepositoryOf(value);
  const root = "/repos/" + encodeURIComponent(repo.owner) + "/" + encodeURIComponent(repo.name);
  const metadata = await readJson(fetcher, root);
  if (metadata.private !== false || metadata.full_name?.toLowerCase() !== repo.fullName.toLowerCase())
    throw new Error("Only an exact, freely readable public repository is supported.");
  const pulls = await readJson(fetcher, root + "/pulls?state=all&sort=updated&direction=desc&per_page=" + PREVIEW_LIMIT);
  if (!Array.isArray(pulls)) throw new TypeError("GitHub PR evidence did not contain an array.");
  const [issueRead, runs, deployed] = await Promise.allSettled([
    readJson(fetcher, root + "/issues?state=all&sort=updated&direction=desc&per_page=" + PREVIEW_LIMIT, {optional:true}),
    readJson(fetcher, root + "/actions/runs?per_page=" + RUN_LIMIT, {optional:true}),
    readJson(fetcher, root + "/deployments?per_page=" + RUN_LIMIT, {optional:true}),
  ]);
  const report = workContinuityPreview({
    repository:repo, pulls, issues:issueRead.status === "fulfilled" ? issueRead.value : null,
    actions:runs.status === "fulfilled" ? runs.value : null,
    deployments:deployed.status === "fulfilled" ? deployed.value : null,
    observedAt:clock(),
  });
  return Object.freeze({
    ...report,
    sourceWarnings: Object.freeze([
      ...(issueRead.status === "rejected" ? ["GitHub Issues: " + String(issueRead.reason?.message ?? "source unavailable")] : []),
      ...(runs.status === "rejected" ? ["GitHub Actions: " + String(runs.reason?.message ?? "source unavailable")] : []),
      ...(deployed.status === "rejected" ? ["GitHub Deployments: " + String(deployed.reason?.message ?? "source unavailable")] : []),
    ])
  });
}

/**
 * A visitor-authored lead handoff, not an automated quote or contact event.
 * The sender chooses what to copy and whether to send it to the original
 * Causeway seller through the existing 561 Group contact channel.
 */
export function buyerScopeSummary(report) {
  if(report?.kind!=="561.group.work-continuity-public-preview.v1" ||
     !Array.isArray(report.records) || !exact(report.repository))
    throw new TypeError("A real source-attributed Work reading is required for an inquiry");
  const selected=report.records.slice(0,6);
  return [
    "Request for a scoped Work-continuity audit (not an accepted order)",
    "Public source: https://github.com/" + report.repository,
    "Observed: " + report.source.observation,
    "Recent bounded Work: " + report.counts.examined + " records, including " +
      report.counts.issuesExamined + " Issues and " +
      report.counts.pullRequestsExamined + " pull requests.",
    "Observed in the public source:",
    ...selected.map(item=>"- " + item.workKind + " #" + item.number + ": " +
      item.title + " [" + item.state + "]" +
      (item.gaps.length ? "; examine " + item.gaps[0] : "")),
    ...(report.truncated?["The sample is truncated; earlier work may remain uninspected."]:[]),
    "Please scope an independently reviewable result, access/rights, acceptance conditions,",
    "resource costs, price/terms and a separate buyer receipt before any customer-system change.",
    "This browser snapshot does not prove deployment, independent acceptance or payment."
  ].join("\n");
}

// The following is the actual free customer interface, not a stub form.
function node(doc, tag, text, className) {
  const result = doc.createElement(tag);
  if (text !== undefined) result.textContent = String(text);
  if (className) result.className = className;
  return result;
}
export function displayWorkPreview(doc, report) {
  const root = doc.getElementById("work-audit-results");
  if (!root) throw new TypeError("Original Work preview result container is missing.");
  root.replaceChildren();
  root.append(node(doc,"h3","Source-limited Work continuity for " + report.repository));
  root.append(node(doc,"p","Examined " + report.counts.examined + " recent GitHub Work records: " +
    report.counts.issuesExamined + " issues (" + report.counts.openIssues + " open), " +
    report.counts.pullRequestsExamined + " pull requests (" + report.counts.merged + " merged). " +
    report.counts.actionsReportedSuccess + " sampled PRs have reported-success Actions runs."));
  if (report.truncated) root.append(node(doc,"p","Other Work was not inspected. This is a 20-record source sample."));
  if (report.sourceWarnings.length) root.append(node(doc,"p",
    "Unavailable evidence: " + report.sourceWarnings.join(" "), "site-evidence-limit"));
  const list = node(doc,"ol");
  for (const record of report.records) {
    const item = node(doc,"li");
    const link = node(doc,"a",record.workKind + " #" + record.number + " · " + record.title);
    link.href = record.sourceUrl; link.rel = "noopener noreferrer";link.target="_blank";
    item.append(link);
    item.append(node(doc,"p",record.state + " · Actions: " + record.actions.reading +
      (record.actions.source ? " (" + record.actions.source + ")" : "") +
      " · deployment: " + record.deployment));
    if(record.workKind==="issue" && record.authoredFixClaims.length)
      item.append(node(doc,"p","PR description(s) claim to fix this issue: #" +
        record.authoredFixClaims.join(", #") + ". Confirmation outstanding."));
    const notes = node(doc,"ul");
    for (const gap of record.gaps) notes.append(node(doc,"li",gap));
    item.append(notes);list.append(item);
  }
  if (!report.records.length) root.append(node(doc,"p","No issues or pull requests appeared in the bounded public source."));
  else root.append(list);
  root.append(node(doc,"p",
    "Merge ≠ verified deployment ≠ accepted customer Work. No credential, private Work or payment was requested.",
    "site-evidence-limit"));
  return root;
}
export function installWorkPreview(doc = globalThis.document, loc = globalThis.location,
  fetcher = globalThis.fetch) {
  const form = doc?.getElementById("work-audit-form");
  if (!form) return false;
  const field = doc.getElementById("work-audit-repository");
  const status = doc.getElementById("work-audit-status");
  const download = doc.getElementById("work-audit-download");
  const copy = doc.getElementById("work-audit-copy");
  const summary = doc.getElementById("work-audit-summary");
  const pending = new URLSearchParams(loc.search).get("repo");
  if (pending) field.value = pending;
  let report = null;
  const submit = async event => {
    event?.preventDefault?.();
    status.textContent = "Reading a bounded public GitHub source in this browser...";
    download.disabled = true;
    copy.disabled = true;
    summary.hidden = true;
    summary.value = "";
    report = null;
    try {
      const selected = publicRepositoryOf(field.value);
      const result = await inspectPublicGitHub(selected.fullName, fetcher);
      report = result;
      displayWorkPreview(doc,result);
      download.disabled = false;
      copy.disabled = false;
      status.textContent = "Read completed; source and uncertainty remain visible. No report or credentials were uploaded to 561.group.";
    } catch(error) {
      status.textContent = error instanceof Error ? error.message : "The public source could not be read.";
      doc.getElementById("work-audit-results").replaceChildren();
    }
  };
  form.addEventListener("submit",submit);
  copy.addEventListener("click",async()=>{
    if(!report)return;
    const text=buyerScopeSummary(report);
    try{
      if(typeof globalThis.navigator?.clipboard?.writeText!=="function")
        throw new Error("Browser clipboard unavailable");
      await globalThis.navigator.clipboard.writeText(text);
      status.textContent="Inquiry scope copied. Choose whether to paste it into the existing Group contact inquiry.";
    }catch{
      // Permission denied is not a falsely reported successful copy.
      summary.hidden=false;
      summary.value=text;
      summary.focus();
      summary.select();
      status.textContent="Browser clipboard permission unavailable. Select/copy the shown scope and send it only if you choose.";
    }
  });
  download.addEventListener("click",() => {
    if (!report) return;
    const file = new Blob([JSON.stringify(report,null,2)+"\n"],{type:"application/json"});
    const href=URL.createObjectURL(file);
    const a=doc.createElement("a");
    a.href=href;a.download="work-continuity-"+report.repository.replace("/","-")+".json";
    doc.body.append(a);a.click();a.remove();URL.revokeObjectURL(href);
  });
  // A shared preview link starts a real source read, not an untrusted command.
  if (pending) void submit();
  return true;
}
if (typeof document !== "undefined") installWorkPreview();
