import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderLlms } from '../src/render.mjs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));

test('original llms site guide reads as a qualified plain-language institutional description', () => {
  const output = renderLlms(read('data/home.json'), read('data/estate.json'));
  assert.match(output, /parent of four companies, and the public site represents accountable offices/u);
  assert.doesNotMatch(output, /\band The public site\b/u);
  assert.match(output, /an inquiry never grants authority/u);
  assert.match(output, /feed-input-receipt\.json/u, 'preserve source receipts');
});
