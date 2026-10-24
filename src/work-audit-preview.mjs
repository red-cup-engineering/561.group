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
    path = url.pathname.replace(/\/$/u, "");
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some(x => !ID.test(x) || STOP.includes(x)) || path.startsWith("/"))
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
export function workContinuityPreview({repository, pulls, actions, deployments, observedAt} = {}) {
  const repo = typeof repository === "string" ? publicRepositoryOf(repository) : publicRepositoryOf(repository?.fullName);
  if (!Array.isArray(pulls) || pulls.length > PREVIEW_LIMIT || !exact(observedAt))
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
  const unique = new Set(rows.map(row => row.number));
  if (unique.size !== rows.length) throw new TypeError("GitHub returned duplicate PR identities.");
  return Object.freeze({
    kind: "561.group.work-continuity-public-preview.v1",
    repository: repo.fullName,
    source: Object.freeze({
      pullRequests: repo.url + "/pulls?q=is%3Apr",
      workflowRuns: repo.url + "/actions",
      deployments: repo.url + "/deployments",
      limits: Object.freeze({pullRequests:PREVIEW_LIMIT,workflowRuns:RUN_LIMIT,deployments:RUN_LIMIT}),
      observation: observedAt,
      actionsAvailable: actionRows !== null,
      deploymentsAvailable: deploymentRows !== null,
      scope: "newest updated public pull requests only, not all issues, Projects or external work",
    }),
    counts: Object.freeze({
      examined: rows.length,
      merged: rows.filter(row => row.state === "merged").length,
      openOrDraft: rows.filter(row => row.state === "open" || row.state === "draft").length,
      closedWithoutMerge: rows.filter(row => row.state === "closed-without-merge").length,
      actionsReportedSuccess: rows.filter(row => row.actions.reading === "reported-success").length,
      actionsUnobserved: rows.filter(row => row.actions.reading === "unobserved-in-sample" ||
        row.actions.reading === "source-unavailable").length,
      independentCustomerAcceptance: null,
    }),
    truncated: pulls.length === PREVIEW_LIMIT,
    records: Object.freeze(rows),
    limits: Object.freeze([
      "GitHub check success is self-reported by the workflow API; executed test steps are not verified here.",
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
  const [runs, deployed] = await Promise.allSettled([
    readJson(fetcher, root + "/actions/runs?per_page=" + RUN_LIMIT, {optional:true}),
    readJson(fetcher, root + "/deployments?per_page=" + RUN_LIMIT, {optional:true}),
  ]);
  const report = workContinuityPreview({
    repository:repo, pulls,
    actions:runs.status === "fulfilled" ? runs.value : null,
    deployments:deployed.status === "fulfilled" ? deployed.value : null,
    observedAt:clock(),
  });
  return Object.freeze({
    ...report,
    sourceWarnings: Object.freeze([
      ...(runs.status === "rejected" ? [String(runs.reason?.message ?? "Actions source unavailable")] : []),
      ...(deployed.status === "rejected" ? [String(deployed.reason?.message ?? "Deployment source unavailable")] : []),
    ])
  });
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
  root.append(node(doc,"p","Examined " + report.counts.examined + " newest updated pull requests. " +
    report.counts.merged + " merged, " + report.counts.openOrDraft + " open/draft, " +
    report.counts.closedWithoutMerge + " closed without merge; " +
    report.counts.actionsReportedSuccess + " have a sampled reported-success Actions run."));
  if (report.truncated) root.append(node(doc,"p","Other older Work was not inspected. This is a 20-record preview."));
  if (report.sourceWarnings.length) root.append(node(doc,"p",
    "Unavailable evidence: " + report.sourceWarnings.join(" "), "site-evidence-limit"));
  const list = node(doc,"ol");
  for (const record of report.records) {
    const item = node(doc,"li");
    const link = node(doc,"a","#" + record.number + " · " + record.title);
    link.href = record.sourceUrl; link.rel = "noopener noreferrer";link.target="_blank";
    item.append(link);
    item.append(node(doc,"p",record.state + " · Actions: " + record.actions.reading +
      (record.actions.source ? " (" + record.actions.source + ")" : "") +
      " · deployment: " + record.deployment));
    const notes = node(doc,"ul");
    for (const gap of record.gaps) notes.append(node(doc,"li",gap));
    item.append(notes);list.append(item);
  }
  if (!report.records.length) root.append(node(doc,"p","No pull requests appeared in the bounded public source."));
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
  const pending = new URLSearchParams(loc.search).get("repo");
  if (pending) field.value = pending;
  let report = null;
  const submit = async event => {
    event?.preventDefault?.();
    status.textContent = "Reading a bounded public GitHub source in this browser...";
    download.disabled = true;
    report = null;
    try {
      const selected = publicRepositoryOf(field.value);
      const result = await inspectPublicGitHub(selected.fullName, fetcher);
      report = result;
      displayWorkPreview(doc,result);
      download.disabled = false;
      status.textContent = "Read completed; source and uncertainty remain visible. No information was sent to 561.group.";
    } catch(error) {
      status.textContent = error instanceof Error ? error.message : "The public source could not be read.";
      doc.getElementById("work-audit-results").replaceChildren();
    }
  };
  form.addEventListener("submit",submit);
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
