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
let lastReport = null;

const MB = 1024 * 1024;

const bytes = (value) =>
new TextEncoder().encode(
typeof value === 'string' ? value : JSON.stringify(value)
).length;

function round(value, digits = 3) {
return Number(value.toFixed(digits));
}

/**

* Read the raw JavaScript heap metrics exposed by Chromium.

* 

* These metrics are optional, browser-specific, and do not represent

* total browser or device RAM.
  */
  function readMemory() {
  try {
  const memory = performance.memory;
  
  if (
  !memory ||
  !Number.isFinite(memory.usedJSHeapSize) ||
  !Number.isFinite(memory.totalJSHeapSize) ||
  !Number.isFinite(memory.jsHeapSizeLimit)
  ) {
  return null;
  }
  
  const usedBytes = memory.usedJSHeapSize;
  const totalHeapBytes = memory.totalJSHeapSize;
  const heapLimitBytes = memory.jsHeapSizeLimit;
  
  return {
  usedBytes,
  usedMiB: round(usedBytes / MB),
  totalHeapBytes,
  totalHeapMiB: round(totalHeapBytes / MB),
  heapLimitBytes,
  heapLimitMiB: round(heapLimitBytes / MB),
  // Preserve the raw numbers above so repeated values can be checked.
  source: 'performance.memory',
  };
  } catch (error) {
  return null;
  }
  }

function memoryDifference(before, after) {
if (!before || !after) {
return null;
}

const deltaBytes = after.usedBytes - before.usedBytes;

return {
deltaBytes,
deltaMiB: round(deltaBytes / MB),
note:
'Difference between two heap snapshots. This is not peak memory or exact memory attributable to the tool.',
};
}

function getMemoryDiagnostics(readings) {
const available = readings.filter(Boolean);

if (available.length === 0) {
return {
available: false,
readings: 0,
identicalUsedHeapReadings: false,
distinctUsedHeapValues: 0,
warning:
'No supported JavaScript heap readings were available. Memory usage cannot be evaluated from this report.',
};
}

const distinctValues = new Set(
available.map((reading) => reading.usedBytes)
);

const identical = distinctValues.size === 1 && available.length > 1;

return {
available: true,
readings: available.length,
identicalUsedHeapReadings: identical,
distinctUsedHeapValues: distinctValues.size,
warning: identical
? 'Every available used-heap reading has the same value. Verify that the browser exposes changing raw metrics before relying on memory deltas.'
: null,
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
    expected: (output) =>
      typeof output === 'string' &&
      /line\(s\) only in/.test(output),
  };

case 'csv-sql':
  return {
    input: makeCSV(n, 3),
    expected: (output) =>
      typeof output === 'string' &&
      (output.match(/INSERT INTO/g) || []).length === n,
  };

case 'json-sql':
  return {
    input: makeJSON(n),
    expected: (output) =>
      typeof output === 'string' &&
      (output.match(/INSERT INTO/g) || []).length === n,
  };

case 'csv-view':
  return {
    input: makeCSV(n),
    expected: (output) =>
      typeof output === 'string' &&
      output.includes(`${n} rows`),
  };

case 'csv-json':
  return {
    input: makeCSV(n),
    expected: (output) => JSON.parse(output).length === n,
  };

case 'clean-duplicates':
  return {
    input: makeCSV(n, 3, { duplicateEvery: 10 }),
    expected: (output) =>
      output.includes(
        `${Math.floor((n - 1) / 10)} duplicate row(s) found`
      ) ||
      (n < 11 && output.includes('No duplicate')),
  };

case 'sheet-tools':
  return {
    input: makeCSV(n),
    expected: (output) =>
      typeof output === 'string' &&
      output.includes(`Trimmed ${n} rows`),
  };

case 'chart-csv': {
  const count = Math.min(n, 1000);

  return {
    input: `label,value\n${Array.from(
      { length: count },
      (_, i) => `r${i},${i}`
    ).join('\n')}`,
    expected: (output) =>
      typeof output === 'string' && output.includes('average:'),
  };
}

case 'table-diff':
  return {
    input: makeTableDiff(n),
    expected: (output) =>
      typeof output === 'string' &&
      output.includes('Only in A') &&
      output.includes('Only in B'),
  };

case 'json-format':
case 'json-minify':
  return {
    input: makeJSON(n),
    expected: (output) => JSON.parse(output).length === n,
  };

case 'json-diff':
  return {
    input: makeJSONDiff(Math.min(n, 1000)),
    expected: (output) =>
      typeof output === 'string' &&
      output.includes('- ') &&
      output.includes('+ '),
  };

case 'regex':
  return {
    input: makeRegexInput(n),
    expected: (output) =>
      typeof output === 'string' &&
      output.startsWith(`${n} match(es)`),
  };

case 'data-clean':
  return {
    input: makeText(n),
    expected: (output) =>
      typeof output === 'string' &&
      output.split('\n').length === n,
  };

case 'timestamp':
  return {
    input: '1767225600',
    expected: (output) =>
      typeof output === 'string' && output.includes('ISO (UTC):'),
  };

case 'create-table':
  return {
    input: `items\n${Array.from(
      { length: Math.min(n, 100) },
      (_, i) => `field_${i} VARCHAR(20)`
    ).join('\n')}`,
    expected: (output) =>
      typeof output === 'string' &&
      output.includes('CREATE TABLE'),
  };

case 'sql-format':
  return {
    input: makeSQL(Math.min(n, 200)).split('\n-- QUERY B --\n')[0],
    expected: (output) =>
      typeof output === 'string' && output.length > 0,
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
    expected: (output) =>
      typeof output === 'string' && output.length > 0,
  };

default:
  return {
    input: sample,
    expected: (output) =>
      typeof output === 'string' && output.length > 0,
  };

}
}

function execute(tool, config) {
if (config.join) {
return joinTables(
config.left,
config.right,
'c1',
'c1',
'INNER'
);
}

return runTool(tool.key, config.input, config.options);
}

function getInputBytes(config) {
if (config.input !== undefined) {
return bytes(config.input);
}

return bytes({
left: config.left,
right: config.right,
});
}

function yieldToBrowser() {
return new Promise((resolve) => setTimeout(resolve, 0));
}

function setStatus(message) {
const element = $('status');

if (element) {
element.textContent = message;
}
}

function setOutput(message) {
const element = $('output');

if (element) {
element.textContent = message;
}
}

function setRunEnabled(enabled) {
const button = $('run');

if (button) {
button.disabled = !enabled;
}
}

function setDownloadEnabled(enabled) {
const button = $('download');

if (button) {
button.disabled = !enabled;
}
}

async function runBenchmark() {
if ($('run')?.disabled) {
return;
}

const maxRows = Number($('rows')?.value);

if (!Number.isFinite(maxRows) || maxRows < 1) {
setStatus('Please select a valid benchmark size.');
return;
}

setRunEnabled(false);
setDownloadEnabled(false);
setOutput('Preparing benchmark…');
setStatus('Running bounded browser tests…');

const results = [];
const memoryReadings = [];
const startedAll = performance.now();
const initialMemory = readMemory();

if (initialMemory) {
memoryReadings.push(initialMemory);
}

try {
for (const tool of registry) {
const sizes = [
'timestamp',
'create-table',
'sql-dialect',
].includes(tool.id)
? [1]
: [
Math.min(100, maxRows),
maxRows,
].filter(
(value, index, all) => all.indexOf(value) === index
);

  for (const size of sizes) {
    let config = null;
    let value;
    let inputBytes = null;
    let outputBytes = null;
    let correctness = false;
    let error = null;
    let status = 'ok';
    let elapsedMs = null;
    let memoryBefore = null;
    let memoryAfter = null;

    try {
      // Generate test data outside the tool execution timing.
      config = build(tool, size);
      inputBytes = getInputBytes(config);

      // Let the browser update the page before this test.
      await yieldToBrowser();

      memoryBefore = readMemory();

      if (memoryBefore) {
        memoryReadings.push(memoryBefore);
      }

      const started = performance.now();

      // This is synchronous for the existing tool runner.
      // A same-thread timer cannot reliably observe peak heap usage here.
      value = execute(tool, config);

      elapsedMs = performance.now() - started;

      memoryAfter = readMemory();

      if (memoryAfter) {
        memoryReadings.push(memoryAfter);
      }

      outputBytes = bytes(value);

      correctness = config.join
        ? Boolean(
            value &&
            Array.isArray(value.rows) &&
            value.rows.length === config.expected &&
            value.rows.every((row) => row.kind === 'matched')
          )
        : Boolean(config.expected(value));

      if (!correctness) {
        status = 'incorrect';
        error = 'Tool-specific correctness check failed';
      }
    } catch (caught) {
      status = 'error';
      error = `${caught?.name || 'Error'}: ${
        caught?.message || String(caught)
      }`;

      if (elapsedMs === null) {
        elapsedMs = null;
      }

      // Record an after-snapshot if execution failed.
      if (!memoryAfter) {
        memoryAfter = readMemory();

        if (memoryAfter) {
          memoryReadings.push(memoryAfter);
        }
      }
    }

    const memoryChange = memoryDifference(
      memoryBefore,
      memoryAfter
    );

    results.push({
      toolId: tool.id,
      tool: tool.title,
      requestedRows: size,
      inputBytes,
      inputMiB:
        inputBytes === null ? null : round(inputBytes / MB),
      outputBytes,
      outputMiB:
        outputBytes === null ? null : round(outputBytes / MB),
      elapsedMs: elapsedMs === null ? null : round(elapsedMs),
      memory: {
        available: Boolean(memoryBefore && memoryAfter),
        before: memoryBefore,
        after: memoryAfter,
        change: memoryChange,
        measurement:
          'JavaScript heap snapshots immediately before and after synchronous execution; not peak memory.',
      },
      correctness,
      status,
      error,
    });

    setStatus(
      `Completed ${results.length} cases… current: ${tool.title}`
    );

    // Release our references between cases. This does not guarantee
    // that the browser immediately performs garbage collection.
    config = null;
    value = null;

    await yieldToBrowser();
  }
}

} catch (caught) {
results.push({
toolId: null,
tool: 'Benchmark runner',
status: 'error',
error: "${caught?.name || 'Error'}: ${ caught?.message || String(caught) }",
});
}

const finalMemory = readMemory();

if (finalMemory) {
memoryReadings.push(finalMemory);
}

const validResults = results.filter((result) => result.toolId);
const memoryDiagnostics = getMemoryDiagnostics(memoryReadings);

const memoryAvailable = validResults.some(
(result) => result.memory?.available
);

lastReport = {
generatedAt: new Date().toISOString(),

environment: {
  runtime: 'Browser',
  userAgent: navigator.userAgent,
  deviceMemoryGB: navigator.deviceMemory ?? null,
  hardwareConcurrency: navigator.hardwareConcurrency ?? null,
  memoryMeasurement: memoryAvailable
    ? 'JavaScript heap snapshots available; peak usage is not measured'
    : 'Browser did not expose the required JavaScript heap metrics',
},

memoryGuide: {
  units: 'Bytes and MiB; 1 MiB = 1,048,576 bytes',
  metric: 'performance.memory, when exposed by the browser',
  meaning:
    'Memory change is the difference between reported heap usage immediately before and after synchronous tool execution.',
  diagnostics: memoryDiagnostics,
  limitations: [
    'JavaScript heap is not total browser memory or total device RAM.',
    'Before/after readings can miss temporary peak allocations.',
    'Synchronous work blocks same-thread timers, so this benchmark does not sample peak memory during a tool call.',
    'Garbage collection can make memory change negative.',
    'The reported heap can include allocations unrelated to the current tool.',
    'Identical readings do not prove that a tool used no additional memory.',
    'Input and output byte sizes are not measurements of actual memory consumption.',
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
    'These are heap snapshots, not total device RAM or benchmark peak memory.',
},

totalElapsedMs: round(performance.now() - startedAll),

summary: {
  cases: validResults.length,
  ok: validResults.filter((result) => result.status === 'ok').length,
  incorrect: validResults.filter(
    (result) => result.status === 'incorrect'
  ).length,
  errors: results.filter((result) => result.status === 'error').length,
  memoryMeasured: validResults.filter(
    (result) => result.memory?.available
  ).length,
  memoryUnavailable: validResults.filter(
    (result) => !result.memory?.available
  ).length,
  identicalMemoryReadings: memoryDiagnostics.identicalUsedHeapReadings,
},

results,

};

setOutput(JSON.stringify(lastReport, null, 2));

setDownloadEnabled(true);
setRunEnabled(true);

setStatus(
"Finished: ${lastReport.summary.ok} passed, " +
"${lastReport.summary.incorrect} incorrect, " +
"${lastReport.summary.errors} errors. " +
"${lastReport.summary.memoryMeasured} cases have memory readings." +
(memoryDiagnostics.identicalUsedHeapReadings
? ' Warning: all available heap readings were identical; treat memory deltas as uninformative.'
: '') +
' Download the report.'
);
}

$('run')?.addEventListener('click', () => {
runBenchmark().catch((caught) => {
setRunEnabled(true);
setDownloadEnabled(Boolean(lastReport));
setStatus(
"Benchmark failed: ${caught?.name || 'Error'}: ${ caught?.message || String(caught) }"
);
});
});

$('download')?.addEventListener('click', () => {
if (!lastReport) {
return;
}

const blob = new Blob(
[JSON.stringify(lastReport, null, 2)],
{ type: 'application/json' }
);

const url = URL.createObjectURL(blob);
const link = document.createElement('a');

link.href = url;
link.download = 'querycherry-browser-memory-report.json';
link.click();

setTimeout(() => URL.revokeObjectURL(url), 1000);
});
