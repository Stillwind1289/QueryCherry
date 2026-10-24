import { registry } from '../../src/lib/registry.js';
import { runTool } from '../../src/lib/runners.js';
import { parseCSV, joinTables } from '../../src/lib/sql.js';
import {
makeCSV,
makeJSON,
makeSQL,
makeJSONDiff,
makeTableDiff,
makeRegexInput,
makeText,
} from '../stress-data.js';

const $ = (id) => document.getElementById(id);
let lastReport;

const bytes = (value) =>
new TextEncoder().encode(
typeof value === 'string' ? value : JSON.stringify(value)
).length;

const MB = 1024 * 1024;

function round(value, digits = 3) {
return Number(value.toFixed(digits));
}

/**

* Chromium exposes performance.memory in some browsers.
* This is JavaScript heap information, NOT total device RAM.
  */
  function readMemory() {
  const memory = performance.memory;

if (
!memory ||
!Number.isFinite(memory.usedJSHeapSize)
) {
return null;
}

return {
usedBytes: memory.usedJSHeapSize,
usedMB: round(memory.usedJSHeapSize / MB),
totalHeapBytes: memory.totalJSHeapSize,
totalHeapMB: round(memory.totalJSHeapSize / MB),
heapLimitBytes: memory.jsHeapSizeLimit,
heapLimitMB: round(memory.jsHeapSizeLimit / MB),
};
}

function memoryDifference(before, after) {
if (!before || !after) return null;

const deltaBytes = after.usedBytes - before.usedBytes;

return {
deltaBytes,
deltaMB: round(deltaBytes / MB),
// Negative values are possible when garbage collection occurs.
note: 'Change in reported heap usage; not peak memory or exact memory attributable to this tool.',
};
}

function build(tool, n) {
const sample = tool.sample || '';

switch (tool.id) {
case 'sql-join': {
const count = Math.min(n, 250);
const left = parseCSV(makeCSV(count, 2));
const right = parseCSV(makeCSV(count, 2));

  return {
    join: true,
    left: {
      name: 'left_table',
      columns: left.headers,
      rows: left.rows,
    },
    right: {
      name: 'right_table',
      columns: right.headers,
      rows: right.rows,
    },
    expected: count,
  };
}

case 'sql-diff':
  return {
    input: makeSQL(Math.min(n, 200)),
    options: {},
    expected: (o) =>
      typeof o === 'string' && /line\(s\) only in/.test(o),
  };

case 'csv-sql':
  return {
    input: makeCSV(n, 3),
    expected: (o) =>
      typeof o === 'string' &&
      (o.match(/INSERT INTO/g) || []).length === n,
  };

case 'json-sql':
  return {
    input: makeJSON(n),
    expected: (o) =>
      typeof o === 'string' &&
      (o.match(/INSERT INTO/g) || []).length === n,
  };

case 'csv-view':
  return {
    input: makeCSV(n),
    expected: (o) => o.includes(`${n} rows`),
  };

case 'csv-json':
  return {
    input: makeCSV(n),
    expected: (o) => JSON.parse(o).length === n,
  };

case 'clean-duplicates':
  return {
    input: makeCSV(n, 3, { duplicateEvery: 10 }),
    expected: (o) =>
      o.includes(`${Math.floor((n - 1) / 10)} duplicate row(s) found`) ||
      (n < 11 && o.includes('No duplicate')),
  };

case 'sheet-tools':
  return {
    input: makeCSV(n),
    expected: (o) => o.includes(`Trimmed ${n} rows`),
  };

case 'chart-csv': {
  const count = Math.min(n, 1000);

  return {
    input: `label,value\n${Array.from(
      { length: count },
      (_, i) => `r${i},${i}`
    ).join('\n')}`,
    expected: (o) => o.includes('average:'),
  };
}

case 'table-diff':
  return {
    input: makeTableDiff(n),
    expected: (o) =>
      o.includes('Only in A') && o.includes('Only in B'),
  };

case 'json-format':
  return {
    input: makeJSON(n),
    expected: (o) => JSON.parse(o).length === n,
  };

case 'json-minify':
  return {
    input: makeJSON(n),
    expected: (o) => JSON.parse(o).length === n,
  };

case 'json-diff':
  return {
    input: makeJSONDiff(Math.min(n, 1000)),
    expected: (o) => o.includes('- ') && o.includes('+ '),
  };

case 'regex':
  return {
    input: makeRegexInput(n),
    expected: (o) => o.startsWith(`${n} match(es)`),
  };

case 'data-clean':
  return {
    input: makeText(n),
    expected: (o) => o.split('\n').length === n,
  };

case 'timestamp':
  return {
    input: '1767225600',
    expected: (o) => o.includes('ISO (UTC):'),
  };

case 'create-table':
  return {
    input: `items\n${Array.from(
      { length: Math.min(n, 100) },
      (_, i) => `field_${i} VARCHAR(20)`
    ).join('\n')}`,
    expected: (o) => o.includes('CREATE TABLE'),
  };

case 'sql-format':
  return {
    input: makeSQL(Math.min(n, 200)).split('\n-- QUERY B --\n')[0],
    expected: (o) => typeof o === 'string' && o.length > 0,
  };

case 'sql-minify':
case 'sql-case':
case 'sql-check':
case 'sql-dialect':
  return {
    input: sample,
    options: {
      dialect: 'postgresql',
      letter: 'upper',
    },
    expected: (o) => typeof o === 'string' && o.length > 0,
  };

default:
  return {
    input: sample,
    expected: (o) => typeof o === 'string' && o.length > 0,
  };

}
}

function execute(tool, cfg) {
if (cfg.join) {
return joinTables(
cfg.left,
cfg.right,
'c1',
'c1',
'INNER'
);
}

return runTool(tool.key, cfg.input, cfg.options);
}

function getInputBytes(cfg) {
if (cfg.input !== undefined) return bytes(cfg.input);

return bytes({
left: cfg.left,
right: cfg.right,
});
}

function yieldToBrowser() {
return new Promise((resolve) => setTimeout(resolve, 0));
}

$('run').addEventListener('click', async () => {
const maxRows = Number($('rows').value);

$('run').disabled = true;
$('download').disabled = true;
$('output').textContent = 'Preparing benchmark…';

const results = [];
const startedAll = performance.now();
const initialMemory = readMemory();

$('status').textContent = 'Running bounded browser tests…';

try {
for (const tool of registry) {
const sizes = [
'timestamp',
'create-table',
'sql-dialect',
].includes(tool.id)
? [1]
: [Math.min(100, maxRows), maxRows].filter(
(value, index, all) => all.indexOf(value) === index
);

  for (const size of sizes) {
    let cfg;
    let inputBytes = null;
    let outputBytes = null;
    let correctness = false;
    let error = null;
    let status = 'ok';
    let value;
    let elapsedMs = 0;
    let memoryBefore = null;
    let memoryAfter = null;

    try {
      // Build the generated input before measuring the tool.
      // This prevents input-generation memory from being mistaken
      // for the tool's execution cost.
      cfg = build(tool, size);
      inputBytes = getInputBytes(cfg);

      // Allow the browser to update the page between test cases.
      await yieldToBrowser();

      memoryBefore = readMemory();
      const started = performance.now();

      value = execute(tool, cfg);

      elapsedMs = performance.now() - started;
      memoryAfter = readMemory();

      outputBytes = bytes(value);

      correctness = cfg.join
        ? value.rows.length === cfg.expected &&
          value.rows.every((row) => row.kind === 'matched')
        : cfg.expected(value);

      if (!correctness) {
        status = 'incorrect';
        error = 'Tool-specific correctness check failed';
      }
    } catch (e) {
      status = 'error';
      error = `${e?.name || 'Error'}: ${e?.message || e}`;

      // Record timing and memory where possible even if execution fails.
      memoryAfter = readMemory();
    }

    const memoryDelta = memoryDifference(
      memoryBefore,
      memoryAfter
    );

    results.push({
      toolId: tool.id,
      tool: tool.title,
      requestedRows: size,
      inputBytes,
      inputMB:
        inputBytes === null ? null : round(inputBytes / MB),
      outputBytes,
      outputMB:
        outputBytes === null ? null : round(outputBytes / MB),
      elapsedMs: round(elapsedMs),
      memory: {
        available: Boolean(memoryBefore && memoryAfter),
        before: memoryBefore,
        after: memoryAfter,
        change: memoryDelta,
        measurement: 'JavaScript heap snapshot before and after execution; not peak memory.',
      },
      correctness,
      status,
      error,
    });

    $('status').textContent =
      `Completed ${results.length} cases… current: ${tool.title}`;

    // Do not retain generated input/output references deliberately.
    cfg = null;
    value = null;

    await yieldToBrowser();
  }
}

} catch (e) {
results.push({
toolId: null,
tool: 'Benchmark runner',
status: 'error',
error: "${e?.name || 'Error'}: ${e?.message || e}",
});
}

const finalMemory = readMemory();

const memoryAvailable = results.some(
(result) => result.memory?.available
);

const validResults = results.filter((result) => result.toolId);

lastReport = {
generatedAt: new Date().toISOString(),

environment: {
  runtime: 'Browser',
  userAgent: navigator.userAgent,
  deviceMemoryGB: navigator.deviceMemory ?? null,
  hardwareConcurrency: navigator.hardwareConcurrency ?? null,
  memoryMeasurement: memoryAvailable
    ? 'Some JavaScript heap measurements available'
    : 'Browser does not expose a supported JavaScript heap metric',
},

memoryGuide: {
  units: 'Bytes and MiB; 1 MiB = 1,048,576 bytes',
  meaning:
    'Memory change is the difference between reported heap usage immediately before and after a synchronous tool call.',
  limitations: [
    'This is JavaScript heap memory, not total browser or device RAM.',
    'Before/after readings can miss temporary peak allocations.',
    'Garbage collection can make memory change negative.',
    'The measurement includes unrelated activity in the same JavaScript heap.',
    'A missing measurement means the browser did not expose the metric.',
    'A successful run does not guarantee the same input will work on every device.',
  ],
},

safeguards: {
  maxRows,
  joinMaxRows: 250,
  sqlDiffMaxLines: 200,
  chartMaxRows: 1000,
  jsonDiffMaxRows: 1000,
  createTableMaxColumns: 100,
  regex:
    'Uses the existing fixed linear test pattern; no adversarial regex.',
  timing:
    'Synchronous calls cannot be forcibly timed out from this page. Workload caps are the primary safeguard.',
},

memory: {
  beforeBenchmark: initialMemory,
  afterBenchmark: finalMemory,
  note:
    'Overall snapshots are useful context only; they are not total device RAM or the benchmark peak.',
},

totalElapsedMs: round(performance.now() - startedAll),

summary: {
  cases: validResults.length,
  ok: validResults.filter((r) => r.status === 'ok').length,
  incorrect: validResults.filter((r) => r.status === 'incorrect').length,
  errors: results.filter((r) => r.status === 'error').length,
  memoryMeasured: validResults.filter(
    (r) => r.memory?.available
  ).length,
  memoryUnavailable: validResults.filter(
    (r) => !r.memory?.available
  ).length,
},

results,

};

$('output').textContent = JSON.stringify(lastReport, null, 2);

$('download').disabled = false;
$('run').disabled = false;

$('status').textContent =
"Finished: ${lastReport.summary.ok} passed, " +
"${lastReport.summary.incorrect} incorrect, " +
"${lastReport.summary.errors} errors. " +
"${lastReport.summary.memoryMeasured} cases have memory readings. Download the report.";
});

$('download').addEventListener('click', () => {
if (!lastReport) return;

const url = URL.createObjectURL(
new Blob(
[JSON.stringify(lastReport, null, 2)],
{ type: 'application/json' }
)
);

const link = document.createElement('a');
link.href = url;
link.download = 'querycherry-browser-memory-report.json';
link.click();

setTimeout(() => URL.revokeObjectURL(url), 1000);
});
