import { formatSql, textRunners, parseCSV, csvToJson } from './sql.js';

function formatter(input, { dialect = 'generic' } = {}) {
  return formatSql(input, { indent: '  ', keywordCase: 'upper' });
}
function need(input) { if (typeof input !== 'string' || !input.trim()) throw new Error('Paste some input first.'); }
function jsonFormat(input) { need(input); let value; try { value = JSON.parse(input); } catch (e) { throw new Error(`Invalid JSON: ${e.message}`); } return JSON.stringify(value, null, 2); }
function jsonMinify(input) { need(input); let value; try { value = JSON.parse(input); } catch (e) { throw new Error(`Invalid JSON: ${e.message}`); } return JSON.stringify(value); }
function jsonDiff(input) {
  need(input); const parts = input.split(/^-- JSON B --\s*$/m);
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new Error('Provide two JSON values separated by a line containing only -- JSON B --.');
  let a,b; try { a=JSON.parse(parts[0]); } catch(e) { throw new Error(`JSON A is invalid: ${e.message}`); } try { b=JSON.parse(parts[1]); } catch(e) { throw new Error(`JSON B is invalid: ${e.message}`); }
  const aa=JSON.stringify(a,null,2).split('\n'), bb=JSON.stringify(b,null,2).split('\n');
  const out=[]; const n=Math.max(aa.length,bb.length);
  for(let i=0;i<n;i++){ if(aa[i]===bb[i]) out.push('  '+aa[i]); else { if(aa[i]!==undefined) out.push('- '+aa[i]); if(bb[i]!==undefined) out.push('+ '+bb[i]); } }
  return out.join('\n');
}
function csvView(input) { const {headers,rows}=parseCSV(input); return `${rows.length} rows × ${headers.length} columns\n\nColumns: ${headers.join(', ')}\n\n${[headers,...rows.slice(0,100)].map(r=>r.join(' | ')).join('\n')}${rows.length>100?'\n… preview limited to 100 rows':''}`; }
function duplicateFinder(input) { const {headers,rows}=parseCSV(input); const seen=new Map(), dup=[]; rows.forEach((r,i)=>{const k=JSON.stringify(r); if(seen.has(k)) dup.push({row:i+2, first:seen.get(k), values:r}); else seen.set(k,i+2);}); return dup.length ? `${dup.length} duplicate row(s) found:\n`+dup.map(d=>`Row ${d.row} duplicates row ${d.first}: ${JSON.stringify(Object.fromEntries(headers.map((h,i)=>[h,d.values[i]])))}`).join('\n') : `No duplicate rows found across ${rows.length} data rows.`; }
function tableDiff(input) { need(input); const parts=input.split(/^-- TABLE B --\s*$/m); if(parts.length!==2) throw new Error('Provide two CSV tables separated by a line containing only -- TABLE B --.'); const a=parseCSV(parts[0]),b=parseCSV(parts[1]); const ka=new Set(a.rows.map(r=>JSON.stringify(r))), kb=new Set(b.rows.map(r=>JSON.stringify(r))); return `Only in A (${a.rows.filter(r=>!kb.has(JSON.stringify(r))).length} rows):\n${a.rows.filter(r=>!kb.has(JSON.stringify(r))).map(r=>'- '+JSON.stringify(r)).join('\n')||'(none)'}\n\nOnly in B (${b.rows.filter(r=>!ka.has(JSON.stringify(r))).length} rows):\n${b.rows.filter(r=>!ka.has(JSON.stringify(r))).map(r=>'+ '+JSON.stringify(r)).join('\n')||'(none)'}`; }
function regexTester(input) { need(input); const i=input.indexOf('\n--- TEXT ---\n'); if(i<0) throw new Error('Use the first line for a JavaScript regex (e.g. /cat/gi), then a line containing --- TEXT ---, then the text to test.'); const spec=input.slice(0,i).trim(); const m=/^\/(.*)\/([dgimsuvy]*)$/.exec(spec); if(!m) throw new Error('Regex must use /pattern/flags syntax.'); let re; try{re=new RegExp(m[1],m[2]);}catch(e){throw new Error(`Invalid regex: ${e.message}`);} const text=input.slice(i+'\n--- TEXT ---\n'.length); const matches=[...text.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))]; return `${matches.length} match(es)\n${matches.length?matches.map(x=>`index ${x.index}: ${JSON.stringify(x[0])}`).join('\n'):'No matches.'}`; }
function cleanText(input) { need(input); return input.split(/\r?\n/).map(line=>line.trim().replace(/[\t ]+/g,' ')).filter(Boolean).join('\n'); }
function timestamp(input) { need(input); const s=input.trim(); const n=Number(s); let d; if(/^[-+]?\d+(\.\d+)?$/.test(s)) d=new Date(Math.abs(n)<1e12?n*1000:n); else d=new Date(s); if(Number.isNaN(d.getTime())) throw new Error('Enter a valid ISO date/time or Unix timestamp in seconds or milliseconds.'); return `ISO (UTC): ${d.toISOString()}\nUnix seconds: ${Math.floor(d.getTime()/1000)}\nUnix milliseconds: ${d.getTime()}\nLocale display: ${d.toString()}`; }
function sheetTools(input) { const {headers,rows}=parseCSV(input); const clean=rows.map(r=>r.map(v=>v.trim())); return `Trimmed ${rows.length} rows and ${headers.length} columns.\n\n${[headers,...clean].map(r=>r.join(',')).join('\n')}`; }
function chartCsv(input) { const {headers,rows}=parseCSV(input); const numeric=headers.map((h,i)=>({h,i,values:rows.map(r=>Number(r[i])).filter(Number.isFinite)})).filter(c=>c.values.length===rows.length&&rows.length); if(!numeric.length) throw new Error('Chart summary needs at least one column with numeric values in every row.'); return numeric.map(c=>{const min=Math.min(...c.values),max=Math.max(...c.values),avg=c.values.reduce((a,b)=>a+b,0)/c.values.length;return `${c.h}\n  min: ${min}\n  max: ${max}\n  average: ${avg.toFixed(2)}\n  values: ${c.values.map(v=>{const scale=max===min?10:Math.round((v-min)/(max-min)*10);return '█'.repeat(scale||1)}).join(' ')}`}).join('\n\n'); }

export const runners = { ...textRunners, formatter, 'csv-json': csvToJson, 'csv-view': csvView, 'json-format': jsonFormat, 'json-minify': jsonMinify, 'json-diff': jsonDiff, 'clean-duplicates': duplicateFinder, 'sheet-tools': sheetTools, 'chart-csv': chartCsv, 'table-diff': tableDiff, regex: regexTester, 'data-clean': cleanText, timestamp };
export function runTool(key, input, options) {
  const fn = runners[key];
  if (!fn) throw new Error(`No implementation is registered for "${key}".`);
  return fn(input, options);
}
