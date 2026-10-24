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

function bytes(value) {
const text =
typeof value === 'string' ? value : JSON.stringify(value);

return new TextEncoder().encode(text ?? '').length;
}

function round(value, digits = 3) {
return Number(value.toFixed(digits));
}

/**

* Read optional Chromium JavaScript heap metrics.

* 

* IMPORTANT:

* Availability does not guarantee that the metrics are changing,

* accurate, or useful for comparing individual tool executions.
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
  source: 'performance.memory',
  };
  } catch {
  return null;
  }
  }

function memoryDifference(before, after, diagnostics) {
if (!before || !after) {
return {
available: false,
deltaBytes: null,
deltaMiB: null,
trustworthy: false,
note: 'One or both heap snapshots were unavailable.',
};
}

const deltaBytes = after.usedBytes - before.usedBytes;

const trustworthy = diagnostics?.usableForDeltas === true;

return {
available: true,
deltaBytes,
deltaMiB: round(deltaBytes / MB),
trustworthy,
note: trustworthy
? 'Difference between two heap snapshots only. This is not peak memory or exact memory attributable to the tool.'
: 'UNVERIFIED: browser heap readings failed the reliability check or have not been verified. This delta must not be treated as a reliable measure of memory usage.',
};
}

function getMemoryDiagnostics(readings) {
const available = readings.filter(Boolean);

if (available.length === 0) {
return {
available: false,
readings: 0,
distinctUsedHeapValues: 0,
identicalUsedHeapReadings: false,
usableForDeltas: false,
status: 'unavailable',
warning:
'No usable JavaScript heap readings were exposed by this browser.',
};
}

const distinctValues = new Set(
available.map((reading) => reading.usedBytes)
);

const identical = distinctValues.size === 1;

return {
available: true,
readings: available.length,
distinctUsedHeapValues: distinctValues.size,
identicalUsedHeapReadings: identical,
usableForDeltas: false,
status: identical
? 'unverified-identical-readings'
: 'unverified-changing-readings',
warning: identical
? 'All available used-heap readings are identical. The browser metric may be fixed, rounded, cached, or otherwise unsuitable for measuring changes. The cause cannot be determined from this report.'
: 'Heap readings changed, but changing values alone do not establish that the metric accurately measures per-tool memory usage.',
note:
'This benchmark never treats performance.memory deltas as verified memory measurements. A separate validation against a trustworthy browser profiling method is required.',
};
}

/**

* Sample memory five times while the page is idle.
* 
* This is a diagnostic only. It does not measure peak memory and
* cannot prove the reported values are accurate.
  */
  async function testMemoryReadings() {
  const readings = [];

for (let i = 0; i < 5; i++) {
readings.push({
timeMs: round(performance.now()),
memory: readMemory(),
});

if (i < 4) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

}

const available = readings
.map((item) => item.memory)
.filter(Boolean);

const distinctUsedHeapValues = new Set(
available.map((item) => item.usedBytes)
).size;

return {
readings,
availableReadings: available.length,
distinctUsedHeapValues,
changesObserved: distinctUsedHeapValues > 1,
status:
available.length === 0
? 'unavailable'
: distinctUsedHeapValues === 1
? 'identical-readings'
: 'changing-readings',
message:
available.length === 0
? 'The browser does not expose usable JavaScript heap metrics.'
: distinctUsedHeapValues === 1
? 'Heap readings stayed identical while idle. Treat the memory metric as unverified.'
: 'Heap readings changed while idle, but accuracy is still unverified.',
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
      typeof output === 'string' &&
      output.includes('ISO (UTC):'),
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
setStatus('Checking browser memory readings…');

const results = [];
const memoryReadings = [];
const startedAll = performance.now();
const initialMemory = readMemory();

if (initialMemory) {
memoryReadings.push(initialMemory);
}

let memorySelfTest = null;
let runnerError = null;

try {
memorySelfTest = await testMemoryReadings();

setStatus(
  'Memory diagnostic complete. Running bounded browser tests…'
);

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
    let value = null;
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

      // Synchronous calls cannot reliably sample peak heap usage.
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

      if (!memoryAfter) {
        memoryAfter = readMemory();

        if (memoryAfter) {
          memoryReadings.push(memoryAfter);
        }
      }
    }

    // Do not assess whether deltas are trustworthy until all
    // readings have been collected. All deltas are therefore
    // explicitly unverified in this report.
    const memoryChange = memoryDifference(
      memoryBefore,
      memoryAfter,
      null
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
      elapsedMs:
        elapsedMs === null ? null : round(elapsedMs),
      memory: {
        available: Boolean(memoryBefore && memoryAfter),
        before: memoryBefore,
        after: memoryAfter,
        change: memoryChange,
        measurement:
          'Unverified before/after JavaScript heap snapshots. Not peak memory and not a reliable measure of memory attributable to this tool.',
      },
      correctness,
      status,
      error,
    });

    setStatus(
      `Completed ${results.length} cases… current: ${tool.title}`
    );

    // Release references between cases. This does not guarantee
    // immediate garbage collection.
    config = null;
    value = null;

    await yieldToBrowser();
  }
}

} catch (caught) {
runnerError = {
toolId: null,
tool: 'Benchmark runner',
status: 'error',
error: "${caught?.name || 'Error'}: ${ caught?.message || String(caught) }",
};

results.push(runnerError);

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
    ? 'Heap snapshots exposed, but memory accuracy is unverified; do not use deltas to estimate tool memory consumption.'
    : 'Browser did not expose the required JavaScript heap metrics.',
},

memoryGuide: {
  units: 'Bytes and MiB; 1 MiB = 1,048,576 bytes',
  metric: 'performance.memory, when exposed by the browser',
  meaning:
    'Optional heap snapshots before and after synchronous execution. They do not measure peak memory or total device RAM.',
  diagnostics: memoryDiagnostics,
  selfTest: memorySelfTest,
  limitations: [
    'JavaScript heap is not total browser memory or total device RAM.',
    'Before/after readings can miss temporary peak allocations.',
    'Synchronous work blocks same-thread timers, so this benchmark does not sample peak memory during a tool call.',
    'Garbage collection can make a before/after difference negative.',
    'The reported heap can include allocations unrelated to the current tool.',
    'Identical readings do not prove that a tool used no additional memory.',
    'Changing readings alone do not prove that the metric is accurate.',
    'Input and output byte sizes are not measurements of actual memory consumption.',
    'A successful run does not guarantee the same input will work on every device.',
    'The idle self-test checks whether readings change, not whether their values are accurate.',
    'All memory deltas are marked unverified until the metric is independently validated.',
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
    'These are unverified heap snapshots, not total device RAM or benchmark peak memory.',
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
  identicalMemoryReadings:
    memoryDiagnostics.identicalUsedHeapReadings,
  memoryDeltasTrustworthy: false,
  runnerFailed: Boolean(runnerError),
},

results,

};

setOutput(JSON.stringify(lastReport, null, 2));
setDownloadEnabled(true);
setRunEnabled(true);

const summary = lastReport.summary;

setStatus(
"Finished: ${summary.ok} passed, " +
"${summary.incorrect} incorrect, " +
"${summary.errors} errors. " +
"${summary.memoryMeasured} cases have heap snapshots. " +
'Memory deltas are unverified and should not be used to estimate memory consumption.' +
(memoryDiagnostics.identicalUsedHeapReadings
? ' All available heap readings were identical.'
: '') +
' Download the report.'
);
}

$('run')?.addEventListener('click', () => {
runBenchmark().catch((caught) => {
setRunEnabled(true);
setDownloadEnabled(Boolean(lastReport));

setStatus(
  `Benchmark failed: ${caught?.name || 'Error'}: ${
    caught?.message || String(caught)
  }`
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
