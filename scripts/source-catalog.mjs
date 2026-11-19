#!/usr/bin/env node
// Write the site's whole source catalog as one ARB file: the interface strings (locales/en.arb) and the
// words derived from data/home.json and data/estate.json. This is what translators and the l-space CLI
// work against:  node scripts/source-catalog.mjs > /tmp/en.arb && l-space xliff --source /tmp/en.arb --target locales/zh-Hans.arb
import { readFile } from "node:fs/promises";
import { contentCatalog } from "../src/words.mjs";

const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const [ui, home, estate] = await Promise.all([read("locales/en.arb"), read("data/home.json"), read("data/estate.json")]);
const { "@@locale": locale, ...content } = contentCatalog(home, estate);
process.stdout.write(`${JSON.stringify({ ...ui, ...content }, null, 2)}\n`);
