// The words of 561.group as messages. Every translatable string in
// data/home.json and data/estate.json becomes one ICU MessageFormat message
// keyed by its place, so each is translated, type-checked and kept current on
// its own: editing one doctrine line stales only that line's translations.
// home.json stays the verbatim English source; these messages are derived
// from it at build time and never edited by hand.
//
// A glossed sentence is one message whose glossed terms are rich-text tags
// <nK>…</nK>, K the note number. A translation must keep every tag (its CHL
// type) but may reorder them, as the target language's word order needs.

// ICU MessageFormat quoting: a doubled apostrophe is one apostrophe, and a quoted
// brace or angle bracket is literal text, never syntax.
const icu = (text) => String(text).replace(/'/gu, "''").replace(/[{}<]/gu, (c) => `'${c}'`);

/** A glossed sentence: text parts, and { text, note } terms as <nK> tags. */
export const sentenceMessage = (parts) => parts.map((part) => (typeof part === "string" ? icu(part) : `<n${part.note}>${icu(part.text)}</n${part.note}>`)).join("");

/** The note numbers a glossed sentence carries. */
export const notesOf = (parts) => parts.filter((part) => typeof part !== "string").map((part) => part.note);

/** Every translatable string of the home page and the estate, as `[key, { message, description }]`, in page order. */
export function contentMessages(home, estate) {
  const d = home.design;
  const out = [];
  const add = (key, message, description) => out.push([key, { message, description }]);
  add("home.name", icu(home.name), "The organization's name.");
  add("home.description", icu(home.description), "The one-sentence description every visitor reads first.");
  home.masthead.forEach((line, i) => add(`home.masthead.${i}`, icu(line), "A short masthead line beside the 561 numeral."));
  add("home.address", icu(home.address), "Who the page is written for.");
  add("home.design.caveat", icu(d.caveat), "The caveat under the design sentence.");
  add("home.design.sentence", sentenceMessage(d.sentence), "The intended design in one sentence. Each <nK>…</nK> is a glossed term with note K: keep every one, in whatever order the language needs.");
  add("home.design.loopLead", icu(d.loopLead), "Lead-in to the four phases of the loop.");
  for (const phase of [...d.loop, d.knowledge]) {
    add(`home.design.loop.${phase.letter}.phase`, icu(phase.phase), `The name of loop phase ${phase.letter}.`);
    add(`home.design.loop.${phase.letter}.line`, sentenceMessage(phase.line), `What loop phase ${phase.letter} does. Keep each <nK> tag.`);
  }
  add("home.design.whole", sentenceMessage(d.whole), "What the loop creates as a whole. Keep each <nK> tag.");
  for (const [note, text] of Object.entries(d.notes)) add(`home.design.notes.${note}`, icu(text), `The gloss of note ${note}.`);
  home.doctrine.forEach((quote, i) => {
    add(`home.doctrine.${i}.text`, icu(quote.text), "A line of doctrine.");
    add(`home.doctrine.${i}.source`, icu(quote.source), "Where that line of doctrine comes from.");
  });
  for (const told of home.told) {
    add(`home.told.${told.value}.label`, icu(told.label), `The name of the told value "${told.value}".`);
    add(`home.told.${told.value}.means`, icu(told.means), `What a node told "${told.value}" did.`);
  }
  for (const group of estate.groups) add(`estate.group.${group.id}.title`, icu(group.title), "A heading over a group of public nodes.");
  for (const node of [...estate.nodes, ...(estate.machines ?? [])]) {
    add(`estate.node.${node.host}.name`, icu(node.name), `The name of ${node.host}.`);
    add(`estate.node.${node.host}.line`, icu(node.line), `One line saying what ${node.host} offers.`);
  }
  for (const endpoint of estate.machine ?? []) add(`estate.endpoint.${endpoint.verb} ${endpoint.url}`, icu(endpoint.what), `What ${endpoint.verb} ${endpoint.url} answers.`);
  return out;
}

/** The content messages as an ARB source catalog. */
export function contentCatalog(home, estate) {
  const catalog = { "@@locale": "en" };
  for (const [key, { message, description }] of contentMessages(home, estate)) {
    catalog[key] = message;
    catalog[`@${key}`] = { description };
  }
  return catalog;
}
