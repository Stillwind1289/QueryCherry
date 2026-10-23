#!/usr/bin/env node
/**
 * QueryCherry bounded capacity smoke/stress harness.
 * Runs real registry implementations in Node; this is NOT a browser benchmark.
 * Defaults are intentionally small. Never feed untrusted regex patterns here.
 */
import { writeFileSync } from 'node:fs';
import { registry } from '../src/lib/registry.js';
import { runTool } from '../src/lib/runners.js';
import { parseCSV, joinTables } from '../src/lib/sql.js';

const args = new Set(process.argv.slice(2));
const moderate = args.has('--profile=moderate');
const scale = args.has('--profile=scale');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outputPath = outArg?.slice('--out='.length) || 'stress-results.json';
const budgetMs = Number(process.env.QC_CASE_BUDGET_MS || 1500);
const rowSteps = scale ? [1000, 5000, 10000] : moderate ? [1, 10, 50, 200] : [1, 10, 50];
const MAX_ROWS = scale ? 10000 : moderate ? 200 : 50;
const MAX_TEXT_BYTES = scale ? 5 * 1024 * 1024 : moderate ? 256 * 1024 : 64 * 1024;
const SAFE_REGEX = /^\/row-[0-9]+/g; // fixed, bounded pattern; no user-provided regex

function csv(rows, cols = 3) {
  const headers = Array.from({ length: cols }, (_, i) => `c${i + 1}`);
  return [headers.join(','), ...Array.from({ length: rows }, (_, i) =>
    headers.map((_, j) => j === 0 ? `row-${i}` : `${i}-${j}`).join(','))].join('\n');
}
function sqlLines(n) {
  const lines = Array.from({ length: n }, (_, i) => `SELECT ${i} AS value FROM table_${i};`);
  const half = Math.max(1, Math.floor(n / 2));
  const b = [...lines.slice(0, half), ...Array.from({ length: n - half }, (_, i) => `SELECT ${i + 1000} AS value FROM changed_${i};`)];
  return `${lines.join('\n')}\n-- QUERY B --\n${b.join('\n')}`;
}
function jsonRecords(n) { return JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: i, name: `row-${i}`, active: i % 2 === 0 }))); }
function jsonDiff(n) { return `${JSON.stringify(Array.from({length:n},(_,i)=>({id:i,value:`a-${i}`})),null,2)}\n-- JSON B --\n${JSON.stringify(Array.from({length:n},(_,i)=>({id:i,value:`${i===n-1?'changed':'a'}-${i}`})),null,2)}`; }
function tableDiff(n) { return `${csv(n)}\n-- TABLE B --\n${csv(n).replace('row-0', 'other-0')}`; }
function configFor(tool, n) {
  const sample = tool.sample || '';
  switch (tool.id) {
    case 'sql-join': return { kind: 'join', left: parseCSV(csv(n, 2)), right: parseCSV(csv(n, 2)), n };
    case 'sql-diff': return { input: sqlLines(Math.min((moderate || scale) ? 200 : 20, Math.max(2, n))), options: {}, expected: (o) => typeof o === 'string' && /line\(s\) only in/.test(o) };
    case 'csv-sql': return { input: csv(n), expected: (o) => typeof o === 'string' && o.includes('INSERT INTO') && (o.match(/INSERT INTO/g)||[]).length === n };
    case 'json-sql': return { input: jsonRecords(n), expected: (o) => typeof o === 'string' && (o.match(/INSERT INTO/g)||[]).length === n };
    case 'csv-view': return { input: csv(n), expected: (o) => typeof o === 'string' && o.includes(`${n} rows`) };
    case 'csv-json': return { input: csv(n), expected: (o) => Array.isArray(JSON.parse(o)) && JSON.parse(o).length === n };
    case 'clean-duplicates': return { input: `${csv(n)}\n${n ? 'row-0,0-1,0-2' : ''}`, expected: (o) => typeof o === 'string' && o.includes('duplicate') };
    case 'sheet-tools': return { input: csv(n), expected: (o) => typeof o === 'string' && o.includes(`Trimmed ${n} rows`) };
    case 'chart-csv': return { input: `label,value\n${Array.from({length:n},(_,i)=>`r${i},${i}`).join('\n')}`, expected: (o) => typeof o === 'string' && o.includes('average:') };
    case 'table-diff': return { input: tableDiff(n), expected: (o) => typeof o === 'string' && o.includes('Only in A') && o.includes('Only in B') };
    case 'json-format': return { input: jsonRecords(n), expected: (o) => JSON.parse(o).length === n };
    case 'json-minify': return { input: jsonRecords(n), expected: (o) => JSON.parse(o).length === n };
    case 'json-diff': return { input: jsonDiff(n), expected: (o) => typeof o === 'string' && (o.includes('- ') || o.includes('+ ')) };
    case 'regex': return { input: `/row-[0-9]+/g\n--- TEXT ---\n${Array.from({length:n},(_,i)=>`row-${i}`).join(' ')}`, expected: (o) => typeof o === 'string' && o.startsWith(`${n} match(es)`) };
    case 'data-clean': return { input: Array.from({length:n},(_,i)=>`  row-${i}    value  `).join('\n'), expected: (o) => typeof o === 'string' && o.split('\n').length === n };
    case 'timestamp': return { input: '1767225600', expected: (o) => typeof o === 'string' && o.includes('ISO (UTC):') };
    case 'create-table': return { input: `items\n${Array.from({length:Math.min(n,20)},(_,i)=>`field_${i} VARCHAR(20)`).join('\n')}`, expected: (o) => typeof o === 'string' && o.includes('CREATE TABLE') };
    case 'sql-format': return { input: scale ? sqlLines(Math.min(n, 1000)).split('\n-- QUERY B --\n')[0] : sample, expected: (o) => typeof o === 'string' && o.length > 0 };
    case 'sql-minify': case 'sql-case': case 'sql-check': case 'sql-dialect':
      return { input: scale && tool.id !== 'sql-dialect' ? sqlLines(Math.min(n, 1000)).split('\n-- QUERY B --\n')[0] : sample, options: { dialect: 'postgresql', letter: 'upper' }, expected: (o) => typeof o === 'string' && o.length > 0 };
    default: return { input: sample, expected: (o) => typeof o === 'string' && o.length > 0 };
  }
}
function execute(tool, cfg) {
  if (cfg.kind === 'join') {
    // Actual UI path uses parseCSV + joinTables, not runTool('sql-join').
    const left = { name: 'left_table', columns: cfg.left.headers, rows: cfg.left.rows };
    const right = { name: 'right_table', columns: cfg.right.headers, rows: cfg.right.rows };
    return joinTables(left, right, 'c1', 'c1', 'INNER');
  }
  return runTool(tool.key, cfg.input, cfg.options);
}
const results = [];
for (const tool of registry) {
  const steps = tool.id === 'sql-join' ? (scale ? [10, 100, 250] : moderate ? [1, 10, 50, 200] : [1, 10, 50]) : rowSteps;
  for (const size of steps) {
    if (size > MAX_ROWS) continue;
    const cfg = configFor(tool, size);
    const inputBytes = cfg.input === undefined ? Buffer.byteLength(JSON.stringify({left:cfg.left,right:cfg.right})) : Buffer.byteLength(cfg.input, 'utf8');
    if (inputBytes > MAX_TEXT_BYTES) {
      results.push({toolId:tool.id, tool:tool.title, size, status:'skipped', reason:`input ${inputBytes} bytes exceeds profile cap ${MAX_TEXT_BYTES}`, inputBytes, outputBytes:null, elapsedMs:null, error:null});
      continue;
    }
    const started = performance.now();
    let status = 'ok', outputBytes = null, error = null, correctness = false;
    try {
      const value = execute(tool, cfg);
      const elapsedMs = performance.now() - started;
      outputBytes = Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
      correctness = cfg.kind === 'join'
        ? value.rows.length === size && value.rows.every((r) => r.kind === 'matched')
        : cfg.expected(value);
      if (!correctness) { status = 'incorrect'; error = 'Output failed tool-specific correctness check'; }
      results.push({toolId:tool.id, tool:tool.title, size, status, correctness, inputBytes, outputBytes, elapsedMs:Number(elapsedMs.toFixed(3)), budgetMs, error});
      if (elapsedMs > budgetMs) {
        results[results.length - 1].status = 'over-budget';
        results[results.length - 1].error = `Completed but exceeded ${budgetMs}ms case budget`;
      }
    } catch (e) {
      status = 'error'; error = `${e?.name || 'Error'}: ${e?.message || String(e)}`;
      results.push({toolId:tool.id, tool:tool.title, size, status, correctness:false, inputBytes, outputBytes, elapsedMs:Number((performance.now()-started).toFixed(3)), budgetMs, error});
    }
  }
}
const report = { generatedAt: new Date().toISOString(), environment: { runtime: `Node ${process.version}`, platform: process.platform, arch: process.arch, profile: scale ? 'scale-bounded' : moderate ? 'moderate-bounded' : 'baseline-bounded', memoryMeasurement: 'Not measured; no peak browser memory measurement is available in this Node harness.' }, safeguards: { budgetMs, maxRows:MAX_ROWS, maxInputBytes:MAX_TEXT_BYTES, regexPolicy:'fixed safe pattern only; no arbitrary regex inputs', joinPolicy:'unique keys; no multiplicative duplicate-key join explosion', sqlDiffPolicy:'at most 20 lines per query in baseline and 200 in moderate/scale; implementation also caps DP cells at 4,000,000', scaleProfile:'row-based tools: 1k/5k/10k; JOIN limited to 250 rows per side because implementation scans the right table for each left row; no adversarial regex inputs' }, summary: { cases:results.length, ok:results.filter(r=>r.status==='ok').length, incorrect:results.filter(r=>r.status==='incorrect').length, errors:results.filter(r=>r.status==='error').length, overBudget:results.filter(r=>r.status==='over-budget').length, skipped:results.filter(r=>r.status==='skipped').length }, results };
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, outputPath, profile: report.environment.profile, environment: report.environment, safeguards: report.safeguards }, null, 2));
if (report.summary.incorrect || report.summary.errors) process.exitCode = 1;
