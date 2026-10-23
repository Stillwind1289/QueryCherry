import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCSV, makeJSON, makeSQL, makeJSONDiff, makeTableDiff, makeRegexInput, makeText } from './stress-data.js';
import { parseCSV } from '../src/lib/sql.js';

test('synthetic generators are deterministic and generate expected logical sizes', () => {
  assert.equal(makeCSV(5), makeCSV(5));
  assert.equal(parseCSV(makeCSV(5, 3)).rows.length, 5);
  assert.equal(JSON.parse(makeJSON(5)).length, 5);
  assert.equal((makeSQL(5).split('\n-- QUERY B --\n')[0].match(/SELECT/g) || []).length, 5);
  assert.ok(makeJSONDiff(5).includes('-- JSON B --'));
  assert.ok(makeTableDiff(5).includes('-- TABLE B --'));
  assert.ok(makeRegexInput(5).startsWith('/row-[0-9]+/g'));
  assert.equal(makeText(5).split('\n').length, 5);
});

test('synthetic CSV can include known duplicates, empty cells and wide fields', () => {
  const parsed = parseCSV(makeCSV(20, 3, { duplicateEvery: 5, emptyEvery: 7, wide: true }));
  assert.equal(parsed.rows.length, 20);
  assert.ok(parsed.rows.some((r) => r.some((v) => v === '')));
  assert.ok(parsed.rows.some((r) => r.some((v) => v.length > 20)));
});
