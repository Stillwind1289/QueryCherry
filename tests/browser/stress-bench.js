import { registry } from '../../src/lib/registry.js';
import { runTool } from '../../src/lib/runners.js';
import { parseCSV, joinTables } from '../../src/lib/sql.js';
import { makeCSV, makeJSON, makeSQL, makeJSONDiff, makeTableDiff, makeRegexInput, makeText } from '../stress-data.js';
const $ = (id) => document.getElementById(id);
let lastReport;
const bytes = (v) => new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v)).length;
function build(tool, n) {
  const sample = tool.sample || '';
  switch (tool.id) {
    case 'sql-join': { const left = parseCSV(makeCSV(Math.min(n, 250), 2)); const right = parseCSV(makeCSV(Math.min(n, 250), 2)); return { join: true, left: { name:'left_table', columns:left.headers, rows:left.rows }, right:{name:'right_table',columns:right.headers,rows:right.rows}, expected: Math.min(n,250) }; }
    case 'sql-diff': return { input: makeSQL(Math.min(n, 200)), options: {}, expected: (o) => typeof o === 'string' && /line\(s\) only in/.test(o) };
    case 'csv-sql': return { input: makeCSV(n, 3), expected: (o) => typeof o === 'string' && (o.match(/INSERT INTO/g)||[]).length === n };
    case 'json-sql': return { input: makeJSON(n), expected: (o) => typeof o === 'string' && (o.match(/INSERT INTO/g)||[]).length === n };
    case 'csv-view': return { input: makeCSV(n), expected: (o) => o.includes(`${n} rows`) };
    case 'csv-json': return { input: makeCSV(n), expected: (o) => JSON.parse(o).length === n };
    case 'clean-duplicates': return { input: makeCSV(n, 3, {duplicateEvery:10}), expected: (o) => o.includes(`${Math.floor((n-1)/10)} duplicate row(s) found`) || (n < 11 && o.includes('No duplicate')) };
    case 'sheet-tools': return { input: makeCSV(n), expected: (o) => o.includes(`Trimmed ${n} rows`) };
    case 'chart-csv': { const size = Math.min(n, 1000); return { input: `label,value\n${Array.from({length:size},(_,i)=>`r${i},${i}`).join('\n')}`, expected: (o) => o.includes('average:') }; }
    case 'table-diff': return { input: makeTableDiff(n), expected: (o) => o.includes('Only in A') && o.includes('Only in B') };
    case 'json-format': return { input: makeJSON(n), expected: (o) => JSON.parse(o).length === n };
    case 'json-minify': return { input: makeJSON(n), expected: (o) => JSON.parse(o).length === n };
    case 'json-diff': return { input: makeJSONDiff(Math.min(n,1000)), expected: (o) => o.includes('- ') && o.includes('+ ') };
    case 'regex': return { input: makeRegexInput(n), expected: (o) => o.startsWith(`${n} match(es)`) };
    case 'data-clean': return { input: makeText(n), expected: (o) => o.split('\n').length === n };
    case 'timestamp': return { input: '1767225600', expected: (o) => o.includes('ISO (UTC):') };
    case 'create-table': return { input: `items\n${Array.from({length:Math.min(n,100)},(_,i)=>`field_${i} VARCHAR(20)`).join('\n')}`, expected: (o) => o.includes('CREATE TABLE') };
    case 'sql-format': return { input: makeSQL(Math.min(n,200)).split('\n-- QUERY B --\n')[0], expected: (o) => typeof o === 'string' && o.length > 0 };
    case 'sql-minify': case 'sql-case': case 'sql-check': case 'sql-dialect': return { input: sample, options:{dialect:'postgresql',letter:'upper'}, expected:(o)=>typeof o==='string'&&o.length>0 };
    default: return { input: sample, expected:(o)=>typeof o==='string'&&o.length>0 };
  }
}
function execute(tool, cfg) {
  if (cfg.join) return joinTables(cfg.left,cfg.right,'c1','c1','INNER');
  return runTool(tool.key,cfg.input,cfg.options);
}
$('run').addEventListener('click', async () => {
  const maxRows = Number($('rows').value);
  $('run').disabled = true; $('download').disabled = true;
  const results=[]; const startedAll=performance.now();
  $('status').textContent='Running bounded browser tests…';
  // Yield between cases so the page can update and the user can stop using the tab if needed.
  for (const tool of registry) {
    const sizes = ['timestamp','create-table','sql-dialect'].includes(tool.id) ? [1] : [Math.min(100,maxRows),maxRows].filter((v,i,a)=>a.indexOf(v)===i);
    for (const size of sizes) {
      const cfg=build(tool,size); const inputBytes=cfg.input===undefined?bytes({left:cfg.left,right:cfg.right}):bytes(cfg.input);
      const t0=performance.now(); let outputBytes=null, correctness=false, error=null, status='ok';
      try {
        const value=execute(tool,cfg); const elapsedMs=performance.now()-t0;
        outputBytes=bytes(value); correctness=cfg.join ? value.rows.length===cfg.expected && value.rows.every(r=>r.kind==='matched') : cfg.expected(value);
        if(!correctness){status='incorrect';error='Tool-specific correctness check failed';}
        results.push({toolId:tool.id,tool:tool.title,size,inputBytes,outputBytes,elapsedMs:Number(elapsedMs.toFixed(3)),correctness,status,error});
      } catch(e) { results.push({toolId:tool.id,tool:tool.title,size,inputBytes,outputBytes,elapsedMs:Number((performance.now()-t0).toFixed(3)),correctness:false,status:'error',error:`${e?.name||'Error'}: ${e?.message||e}`}); }
      $('status').textContent=`Completed ${results.length} cases… current: ${tool.title}`;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  const mem = performance.memory && Number.isFinite(performance.memory.usedJSHeapSize) ? {usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit,note:'Chromium-specific JS heap only; not total browser or device memory.'} : null;
  lastReport={generatedAt:new Date().toISOString(),environment:{runtime:'Browser',userAgent:navigator.userAgent,deviceMemoryGB:navigator.deviceMemory??null,hardwareConcurrency:navigator.hardwareConcurrency??null,memoryMeasurement:mem?'Chromium JS heap proxy available':'No supported browser heap metric exposed'},safeguards:{maxRows,joinMaxRows:250,sqlDiffMaxLines:200,chartMaxRows:1000,regex:'fixed linear pattern /row-[0-9]+/g only; no adversarial regex',timing:'Synchronous calls cannot be forcibly timed out from this page; workload caps are the primary safeguard.'},memory:mem,totalElapsedMs:Number((performance.now()-startedAll).toFixed(3)),summary:{cases:results.length,ok:results.filter(r=>r.status==='ok').length,incorrect:results.filter(r=>r.status==='incorrect').length,errors:results.filter(r=>r.status==='error').length},results};
  $('output').textContent=JSON.stringify(lastReport,null,2); $('download').disabled=false; $('run').disabled=false; $('status').textContent=`Finished: ${lastReport.summary.ok} ok, ${lastReport.summary.incorrect} incorrect, ${lastReport.summary.errors} errors. Download the report.`;
});
$('download').addEventListener('click',()=>{if(!lastReport)return;const url=URL.createObjectURL(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='querycherry-browser-stress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
