import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { report } from "../src/locales.mjs";
import { renderIndex, renderLlms, renderLlmsFull, renderRobots, renderSitemap } from "../src/render.mjs";
import { LOCALES, POLICY, siteSpace, speaker } from "../src/locales.mjs";
import { contentMessages } from "../src/words.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = JSON.parse(read("data/home.json"));
const estate = { ...JSON.parse(read("data/estate.json")), revision: "fixture" };
const space = siteSpace({ interfaceSource: read("locales/en.arb"), renderings: LOCALES.slice(1).map((tag) => read(`locales/${tag}.arb`)), home, estate });
const page = (tag) => renderIndex(home, estate, speaker(space, tag, { origin: home.origin }));

test("every string the home page shows from data is a message of its own", () => {
  const keys = new Set(contentMessages(home, estate).map(([key]) => key));
  assert.ok(keys.has("home.design.sentence"));
  for (const n of Object.keys(home.design.notes)) assert.ok(keys.has(`home.design.notes.${n}`));
  home.doctrine.forEach((_, i) => assert.ok(keys.has(`home.doctrine.${i}.text`) && keys.has(`home.doctrine.${i}.source`)));
  for (const node of estate.nodes) assert.ok(keys.has(`estate.node.${node.host}.line`));
  for (const endpoint of estate.machine) assert.ok(keys.has(`estate.endpoint.${endpoint.verb} ${endpoint.url}`));
});

test("original ARB messages remain structurally typed without a false upstream witness claim", () => {
  const account = report(space);
  assert.equal(account.locales["zh-Hans"]["ill-typed"], 0);
  assert.ok(account.locales["zh-Hans"].coverage > 0.95 && account.locales["zh-Hans"].coverage < 1,
    "superseded machine rendering must be absent, not presented as current");
  assert.equal(account.locales.lkt["ill-typed"], 0);
  assert.ok(account.locales["zh-Hans"]["source-witness-unverified"] > 0);
  assert.equal(account.sourceIntegrity, "unverified");
  assert.equal(account.agree, false);
  assert.ok(account.counterexamples.length > 0);
});

test("the English page keeps its words, and announces its languages", () => {
  const html = page("en");
  assert.match(html, /^<!doctype html>\n<html lang="en" dir="ltr">/u);
  assert.match(html, /<link rel="alternate" hreflang="zh-Hans" href="https:\/\/561\.group\/zh-hans\/">/u);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/561\.group\/">/u);
  assert.match(html, /<span class="term">type-theoretic<\/span><sup class="ref"><a id="r1" href="#n1" aria-label="Note 1">1<\/a><\/sup> distributed operating system/u);
  assert.ok(html.includes(`<span class="count">${estate.nodes.length}</span> public nodes.`));
  assert.match(html, /<span lang="zh-Hans">灰度管理<\/span>/u, "Han runs in English notes are marked Simplified Chinese");
  assert.match(html, /<a href="\/zh-hans\/" hreflang="zh-Hans" lang="zh-Hans">简体中文<\/a>/u);
  assert.doesNotMatch(html, /class="mt-note"/u);
});

test("the Mandarin page speaks Mandarin, keeps every gloss, and discloses machine translation", () => {
  const html = page("zh-Hans");
  assert.match(html, /<html lang="zh-Hans" dir="ltr">/u);
  assert.match(html, /<title>561 集团<\/title>/u);
  assert.ok(html.includes('<p class="lede"><span lang="en">'+home.description+'</span>'), "the English fallback retains the current source-owned corporate description");
  assert.doesNotMatch(html, /政治、金融和经济的动荡中/u, "superseded finance-first translation is not published");
  assert.match(html, /<meta property="og:locale" content="zh_CN">/u);
  assert.match(html, /一个<span class="term">类型论<\/span><sup class="ref"><a id="r1" href="#n1" aria-label="注释 1">1<\/a><\/sup>的分布式操作系统/u);
  for (const n of Object.keys(home.design.notes)) assert.match(html, new RegExp(`id="r${n}" href="#n${n}"`, "u"), `gloss ${n} kept`);
  assert.match(html, /<p class="mt-note" role="note">本页部分内容由机器翻译，尚未经过人工审校。/u);
  assert.ok(html.includes(`<span class="count">${estate.nodes.length}</span> 个公开节点。`));
  assert.match(html, /<b>告知为真<\/b>：已应答/u);
  assert.match(html, /"phases":\[\["M","监控"\]/u);
  assert.doesNotMatch(html, /<span lang="zh-Hans">/u, "Chinese inside a Chinese page needs no marking");
});

test("the Lakota page serves its Lakota and marks every English fallback", () => {
  const html = page("lkt");
  assert.match(html, /<html lang="lkt" dir="ltr">/u);
  assert.match(html, /<nav class="langs" aria-label="Iyápi">/u);
  assert.ok(html.includes('<p class="lede"><span lang="en">'+home.description+'</span>'), "the English fallback retains the current source-owned corporate description");
  assert.match(html, /:lang\(lkt\)\{--serif:"Charis SIL"/u);
});

test("the sitemap lists every language with its alternates; llms.txt names them", () => {
  const sitemap = renderSitemap(home, "2026-10-19", speaker(space, "en", { origin: home.origin }).alternates());
  assert.match(sitemap, /<url><loc>https:\/\/561\.group\/zh-hans\/<\/loc><lastmod>2026-10-19<\/lastmod><xhtml:link rel="alternate" hreflang="en" href="https:\/\/561\.group\/"\/>/u);
  assert.match(sitemap, /<url><loc>https:\/\/561\.group\/contact\/<\/loc>/u);
  assert.match(renderLlms(home, estate), /## Languages\n\n- \[English\]\(https:\/\/561\.group\/\)\n- \[简体中文\]\(https:\/\/561\.group\/zh-hans\/\)/u);
});

test("the apex is a hub for search and answer engines: graph, head, follow block, llms files, robots, sitemap", () => {
  const html = page("en");
  const graph = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/su.exec(html)[1])["@graph"];
  const org = graph.find((n) => n["@type"] === "Organization");
  assert.equal(org["@id"], "https://561.group/#organization");
  assert.equal(org.description, home.description, "R1: the description is verbatim");
  assert.equal(org.foundingDate, "2018");
  assert.equal(org.logo.url, "https://561.group/logo.png");
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/u);
  assert.deepEqual(org.sameAs, ["https://github.com/561-group", "https://561.group/actors/group"]);
  assert.equal(org.subOrganization.length, 4);
  for (const sub of org.subOrganization) assert.ok(sub.name && sub.url && sub.sameAs.length === 2);
  for (const topic of ["x402", "MAPE-K", "Rendanheyi", "Huidu Guanli", "Belnap four-valued logic", "ActivityPub"]) assert.ok(org.knowsAbout.includes(topic));
  assert.equal(graph.find((n) => n["@type"] === "WebSite")["@id"], "https://561.group/#website");
  assert.equal(graph.find((n) => n["@type"] === "DefinedTermSet").hasDefinedTerm.length, 13);
  assert.match(html, /<meta name="fediverse:creator" content="@group@561\.group">/u);
  assert.match(html, /<link rel="me" href="https:\/\/561\.group\/actors\/group">/u);
  assert.match(html, /<link rel="alternate" type="text\/plain" title="For language models" href="\/llms\.txt">/u);
  for (const handle of ["@group@561.group", "@science@science.561.group", "@engineering@engineering.561.group", "@operations@operations.561.group", "@services@services.561.group"]) assert.ok(html.includes(`>${handle}</a>`), handle);
  for (const url of ["https://science.561.group/", "https://engineering.561.group/", "https://operations.561.group/", "https://services.561.group/", "https://market.561.group/x402/"]) assert.ok(html.includes(`href="${url}"`), url);
  assert.ok(html.includes(home.description));
});

test("llms.txt maps the whole Group and takes the market's offer count from the caller, never from the source", () => {
  const llms = renderLlms(home, estate, { marketOffers: 130 });
  assert.ok(llms.includes(home.description));
  for (const url of ["https://science.561.group/", "https://engineering.561.group/", "https://operations.561.group/", "https://services.561.group/", "https://market.561.group/x402/"]) assert.ok(llms.includes(url), url);
  assert.match(llms, /It lists 130 machine-payable offers/u);
  assert.match(llms, /@science@science\.561\.group/u);
  assert.doesNotMatch(llms, /Sixty-one|sixty-one/u);
  assert.doesNotMatch(renderLlms(home, estate), /\d+ machine-payable offers/u, "an unreadable count is omitted, not guessed");
  const full = renderLlmsFull(home, estate, { marketOffers: 130 });
  for (const quote of home.doctrine) assert.ok(full.includes(quote.text));
  for (const note of Object.values(home.design.notes)) assert.ok(full.includes(note));
  for (const told of home.told) assert.ok(full.includes(told.label));
});

test("robots names every AI crawler and keeps the sitemap; the sitemap lists the llms files", () => {
  const robots = renderRobots(home);
  for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"]) assert.match(robots, new RegExp(`User-agent: ${bot}\\nAllow: /\\n`, "u"));
  assert.match(robots, /Sitemap: https:\/\/561\.group\/sitemap\.xml\n$/u);
  const sitemap = renderSitemap(home, "2026-10-21");
  assert.match(sitemap, /<loc>https:\/\/561\.group\/llms\.txt<\/loc><lastmod>2026-10-21<\/lastmod>/u);
  assert.match(sitemap, /<loc>https:\/\/561\.group\/llms-full\.txt<\/loc>/u);
});

test("the active Group support checkout is discoverable without mistaking it for paid service revenue", () => {
  const support = home.group.sustainingSupport;
  assert.equal(support.monthlyUsd, 10);
  assert.equal(support.verifiedAt, "2026-10-22");
  assert.match(support.url, /^https:\/\/buy\.stripe\.com\//u);
  assert.equal(support.billingHelp, "https://561.group/contact/");
  for (const locale of LOCALES) {
    const html = page(locale);
    assert.match(html, /id="sustain"/u);
    assert.ok(html.includes(`href="${support.url}"`), `checkout link for ${locale}`);
    assert.ok(html.includes(`$${support.monthlyUsd}\/month`), `price for ${locale}`);
    assert.ok(html.includes("monthly subscription until canceled"), `recurrence for ${locale}`);
    assert.ok(html.includes(`href="${support.billingHelp}"`), `cancel help for ${locale}`);
    assert.ok(html.includes("grants no special access"), `no influence claims for ${locale}`);
  }
  for (const prose of [renderLlms(home, estate), renderLlmsFull(home, estate)]) {
    assert.ok(prose.includes(`[${support.name}](${support.url})`));
    assert.ok(prose.includes(`$${support.monthlyUsd}\/month recurring subscription`));
    assert.ok(prose.includes(`[Billing and cancellation help](${support.billingHelp})`));
    assert.ok(prose.includes("no special access"));
  }
});
