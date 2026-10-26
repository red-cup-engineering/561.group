#!/usr/bin/env node
// Binds the Group front door's Public content into this application's tree.
//
// The content (data/, locales/, authored static assets under public/) is Group data held in
// 561-group/561-group-frontdoor-services-section; this repository holds only the application.
// The data repository mirrors this tree, so binding is a copy of its data/, locales/ and public/
// onto the application root. The source is SITE_CONTENT_ROOT, or ./content (where CI checks the
// data repository out at a pinned commit). Bound files are git-ignored and idempotently rewritten.

import { cpSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const application = dirname(dirname(fileURLToPath(import.meta.url)));
const REQUIRED = [
  "data/home.json",
  "data/estate.json",
  "data/frontdoor.json",
  "data/brand-source.json",
  "locales/en.arb",
  "locales/lkt.arb",
  "locales/zh-Hans.arb",
  "public/contact/index.html",
  "public/favicon.svg",
  "public/logo.png",
];

export function bindContent(source = process.env.SITE_CONTENT_ROOT ?? join(application, "content"), target = application) {
  const root = resolve(source);
  if (root === resolve(target)) return { root, bound: false };
  const missing = REQUIRED.filter((path) => !existsSync(join(root, path)) || !statSync(join(root, path)).isFile());
  if (missing.length > 0) {
    throw new Error(
      `Front-door content is not bound: ${missing.join(", ")} missing under ${root}. ` +
        "Check out 561-group/561-group-frontdoor-services-section at ./content or set SITE_CONTENT_ROOT.",
    );
  }
  // Fail before copying when an application checkout still authors Group-owned
  // content. Otherwise the bind would silently replace a PR's tracked files:
  // tests could pass on Group bytes while the authored application changes
  // never reach a public visitor. Generated/untracked build outputs remain okay.
  if (existsSync(join(target, ".git"))) {
    let tracked;
    try {
      tracked = execFileSync("git",
        ["ls-files", "-z", "--", "data/", "locales/", "public/"],
        { cwd: target, encoding: "utf8" })
        .split("\0").filter(Boolean);
    } catch (error) {
      throw new Error("Cannot independently verify the application Git content boundary", { cause: error });
    }
    if (tracked.length) {
      throw new Error(
        "Group-owned content is tracked in the application checkout: " +
        tracked.slice(0, 5).join(", ") +
        ". Move the authored changes to 561-group/561-group-frontdoor-services-section before binding."
      );
    }
  }
  for (const directory of ["data", "locales", "public"]) {
    cpSync(join(root, directory), join(target, directory), { recursive: true, force: true });
  }
  return { root, bound: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { root, bound } = bindContent();
  console.log(bound ? `bound front-door content from ${root}` : "content root is the application root; nothing to bind");
}
