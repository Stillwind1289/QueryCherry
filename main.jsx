
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { format as formatSQL } from 'sql-formatter';
import {
  ArrowRight, Braces, ChartNoAxesCombined, Check, ChevronDown,
  Code2, Copy, Database, FileJson, FileSpreadsheet,
  GitCompareArrows, Heart, Menu, Minimize2, Paintbrush, Play,
  ShieldCheck, Sparkles, Table2, WandSparkles, X, Zap
} from 'lucide-react';
import './styles.css';

const cats = [
  ['all', 'All tools'],
  ['sql', 'SQL'],
  ['csv', 'CSV & tables'],
  ['json', 'JSON & API data'],
  ['clean', 'Data cleaning'],
  ['sheets', 'Spreadsheets'],
  ['visual', 'Visualization'],
  ['compare', 'Compare & diff'],
  ['dev', 'Developer tools']
];

const tools = [
  ['sql-format', 'SQL Formatter', 'Format SQL with consistent indentation and readable clauses.', 'sql', Database, 'coral', 'Ready', 'formatter'],
  ['sql-minify', 'SQL Minifier', 'Compact SQL while preserving quoted text and comments.', 'sql', Minimize2, 'orange', 'Ready', 'minifier'],
  ['sql-case', 'SQL Keyword Case Converter', 'Change SQL keywords to uppercase or lowercase.', 'sql', Paintbrush, 'purple', 'Ready', 'case'],
  ['sql-check', 'SQL Syntax Checker', 'Check common SQL structure issues before execution (lightweight checks).', 'sql', ShieldCheck, 'green', 'Ready', 'check'],
  ['sql-diff', 'SQL Query Diff', 'Compare two SQL queries. Separate them with -- QUERY B --.', 'sql', GitCompareArrows, 'coral', 'Ready', 'sql-diff'],
  ['csv-sql', 'CSV to SQL Converter', 'Convert CSV headers and rows into INSERT statements.', 'sql', FileSpreadsheet, 'blue', 'Ready', 'csv-sql'],
  ['json-sql', 'JSON to SQL Converter', 'Convert an array of JSON records into INSERT statements.', 'sql', FileJson, 'purple', 'Ready', 'json-sql'],
  ['create-table', 'CREATE TABLE Generator', 'Generate a CREATE TABLE statement from column definitions.', 'sql', Database, 'green', 'Ready', 'create-table'],
  ['sql-join', 'SQL JOIN Visualizer', 'Explain common JOIN behavior using sample tables.', 'sql', GitCompareArrows, 'orange', 'Ready', 'sql-join'],
  ['sql-dialect', 'SQL Dialect Converter', 'Convert selected common syntax between SQL dialects.', 'sql', Code2, 'purple', 'Ready', 'sql-dialect'],
  ['csv-view', 'CSV Viewer', 'Preview CSV rows and columns.', 'csv', Table2, 'green'],
  ['csv-json', 'CSV to JSON', 'Convert CSV rows into a JSON array.', 'csv', FileSpreadsheet, 'blue', 'Ready', 'csv-json'],
  ['json-format', 'JSON Formatter', 'Beautify and validate JSON data.', 'json', FileJson, 'purple'],
  ['json-diff', 'JSON Diff', 'Compare two JSON values.', 'json', GitCompareArrows, 'coral'],
  ['clean-duplicates', 'Duplicate Finder', 'Find repeated rows in a dataset.', 'clean', Sparkles, 'yellow'],
  ['sheet-tools', 'Spreadsheet Helpers', 'Make common row and column tasks easier.', 'sheets', FileSpreadsheet, 'green'],
  ['chart-csv', 'CSV to Chart', 'Turn a dataset into a quick visual summary.', 'visual', ChartNoAxesCombined, 'blue'],
  ['table-diff', 'Table Comparator', 'Compare two datasets.', 'compare', GitCompareArrows, 'orange'],
  ['regex', 'Regex Tester', 'Test regular expressions against sample text.', 'dev', Code2, 'purple'],
  ['json-minify', 'JSON Minifier', 'Compact JSON payloads.', 'json', Minimize2, 'yellow'],
  ['data-clean', 'Text Cleaner', 'Trim and normalize pasted text.', 'clean', WandSparkles, 'coral'],
  ['timestamp', 'Timestamp Converter', 'Convert common timestamp formats.', 'dev', Zap, 'blue']
];

const sqlSample = `select u.name, count(o.id) as order_count
from users u
left join orders o on o.user_id = u.id
where u.created_at >= '2025-01-01'
group by u.name
order by order_count desc;`;

const csvSample = `name,age,city
Ava,21,Jaipur
Noah,24,"New York, NY"
Mia,19,Delhi`;

const keywordPattern =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|LEFT JOIN|RIGHT JOIN|FULL JOIN|INNER JOIN|OUTER JOIN|CROSS JOIN|JOIN|ON|AND|OR|NOT|IN|IS|NULL|AS|DISTINCT|UNION ALL|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|LIKE|ASC|DESC|BY|WITH|OVER|PARTITION BY|FETCH|FIRST|ROWS|ONLY|RETURNING)\b/gi;

function transformSQLKeywords(input, letter) {
  let out = '';
  let i = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (lineComment) {
      out += ch;
      if (ch === '\n') lineComment = false;
      i++;
      continue;
    }

    if (blockComment) {
      out += ch;
      if (ch === '*' && next === '/') {
        out += '/';
        i += 2;
        blockComment = false;
      } else {
        i++;
      }
      continue;
    }

    if (quote) {
      out += ch;
      if (ch === quote) {
        if (next === quote && quote !== '`') {
          out += next;
          i += 2;
          continue;
        }
        if (input[i - 1] !== '\\') quote = null;
      }
      i++;
      continue;
    }

    if (ch === '-' && next === '-') {
      out += '--';
      i += 2;
      lineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      out += '/*';
      i += 2;
      blockComment = true;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i++;
      continue;
    }

    const rest = input.slice(i);
    const match = rest.match(keywordPattern);

    if (match && match.index === 0) {
      out += letter === 'upper'
        ? match[0].toUpperCase()
        : match[0].toLowerCase();
      i += match[0].length;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

function minifySQL(input) {
  let out = '';
  let i = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  let pendingSpace = false;

  const isWord = c => Boolean(c && /[a-zA-Z0-9_$]/.test(c));

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (lineComment) {
      out += ch;
      if (ch === '\n') {
        lineComment = false;
        pendingSpace = true;
      }
      i++;
      continue;
    }

    if (blockComment) {
      out += ch;
      if (ch === '*' && next === '/') {
        out += '/';
        i += 2;
        blockComment = false;
      } else {
        i++;
      }
      continue;
    }

    if (quote) {
      out += ch;
      if (ch === quote) {
        if (next === quote && quote !== '`') {
          out += next;
          i += 2;
          continue;
        }
        if (input[i - 1] !== '\\') quote = null;
      }
      i++;
      continue;
    }

    if (ch === '-' && next === '-') {
      if (pendingSpace && out && !out.endsWith(' ')) out += ' ';
      pendingSpace = false;
      out += '--';
      i += 2;
      lineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      if (pendingSpace && out && !out.endsWith(' ')) out += ' ';
      pendingSpace = false;
      out += '/*';
      i += 2;
      blockComment = true;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      if (pendingSpace && isWord(out.at(-1))) out += ' ';
      pendingSpace = false;
      quote = ch;
      out += ch;
      i++;
      continue;
    }

    if (/\s/.test(ch)) {
      pendingSpace = true;
      i++;
      continue;
    }

    if (pendingSpace && isWord(ch) && isWord(out.at(-1))) out += ' ';
    pendingSpace = false;
    out += ch;
    i++;
  }

  if (quote) throw new Error('A quoted string or identifier was not closed.');
  if (blockComment) throw new Error('A block comment was not closed.');

  return out.trim();
}

function csvToJSON(input) {
  if (!input.trim()) throw new Error('Paste some CSV data first.');

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (quoted) throw new Error('A quoted CSV field was not closed.');

  row.push(field);
  if (row.some(value => value.trim() !== '')) rows.push(row);

  if (rows.length < 2) {
    throw new Error('Include a header row and at least one data row.');
  }

  const headers = rows[0].map((h, i) =>
    (i === 0 ? h.replace(/^\uFEFF/, '') : h).trim()
  );

  if (headers.some(h => !h)) throw new Error('Every column needs a header.');

  if (new Set(headers).size !== headers.length) {
    throw new Error('Column headers must be unique.');
  }

  const data = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `Row ${index + 2} has ${values.length} columns; expected ${headers.length}.`
      );
    }

    return Object.fromEntries(
      headers.map((header, i) => [header, values[i]])
    );
  });

  return JSON.stringify(data, null, 2);
}

function checkSQL(input) {
  if (!input.trim()) throw new Error('Paste a SQL query first.');

  const issues = [];
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  const stack = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (ch === quote) {
        if (next === quote && quote !== '`') {
          i++;
          continue;
        }
        quote = null;
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      lineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '(' || ch === '[') stack.push({ ch, index: i });

    if (ch === ')' || ch === ']') {
      const last = stack.pop();

      if (
        !last ||
        (ch === ')' && last.ch !== '(') ||
        (ch === ']' && last.ch !== '[')
      ) {
        issues.push(`Unexpected closing "${ch}" near character ${i + 1}.`);
      }
    }
  }

  if (quote) issues.push('A quoted string or identifier appears unclosed.');
  if (blockComment) issues.push('A block comment appears unclosed.');

  if (stack.length) {
    issues.push(`A "${stack[stack.length - 1].ch}" bracket is not closed.`);
  }

  const clean = input
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  if (/^\s*(WHERE|AND|OR|JOIN|ON|GROUP BY|ORDER BY)\b/i.test(clean)) {
    issues.push('The query begins with a clause that normally needs a preceding statement.');
  }

  if (/\bSELECT\s*(FROM|WHERE|GROUP BY|ORDER BY|;|$)/i.test(clean)) {
    issues.push('SELECT appears to be missing its column list.');
  }

  if (/\bFROM\s*(WHERE|GROUP BY|ORDER BY|;|$)/i.test(clean)) {
    issues.push('FROM appears to be missing a table name.');
  }

  if (issues.length) {
    return 'Potential issues found:\n\n' +
      issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n');
  }

  return 'No obvious structural issues found.\n\nThis is a lightweight check, not a full SQL parser. It cannot guarantee that the query is valid for your database.';
}

function quoteSQL(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function parseCSVRows(input) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row);
      row = []; field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('A quoted CSV field was not closed.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function csvToSQL(input) {
  const rows = parseCSVRows(input);
  if (rows.length < 2) throw new Error('Include a header row and at least one data row.');
  const headers = rows[0].map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, '') : h).trim());
  if (headers.some(h => !h)) throw new Error('Every CSV column needs a header.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.');
  const table = 'your_table';
  return rows.slice(1).map((r, i) => {
    if (r.length !== headers.length) throw new Error(`Row ${i + 2} has ${r.length} columns; expected ${headers.length}.`);
    return `INSERT INTO ${table} (${headers.map(h => `"${h.replace(/"/g, '""')}"`).join(', ')}) VALUES (${r.map(quoteSQL).join(', ')});`;
  }).join('\n');
}

function jsonToSQL(input) {
  let data;
  try { data = JSON.parse(input); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
  if (!Array.isArray(data) || !data.length || data.some(v => !v || Array.isArray(v) || typeof v !== 'object'))
    throw new Error('Provide a non-empty JSON array of objects with matching fields.');
  const keys = [...new Set(data.flatMap(Object.keys))];
  if (!keys.length) throw new Error('Records need at least one field.');
  const table = 'your_table';
  return data.map((obj, i) => {
    const cols = keys.map(k => `"${k.replace(/"/g, '""')}"`);
    const vals = keys.map(k => {
      const v = obj[k];
      if (v && typeof v === 'object') throw new Error(`Record ${i + 1}, field "${k}" is nested. Flatten it before converting.`);
      return quoteSQL(v);
    });
    return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
  }).join('\n');
}

function createTableSQL(input) {
  const lines = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Enter a table name, then one column per line as: column_name DATA_TYPE.');
  const table = lines.shift().replace(/^table\s*:\s*/i, '').trim();
  if (!/^[A-Za-z_][\w$]*$/.test(table)) throw new Error('Use a simple table name such as users.');
  const columns = lines.map(line => {
    const m = line.match(/^([A-Za-z_][\w$]*)\s+(.+)$/);
    if (!m) throw new Error(`Invalid column definition: ${line}`);
    if (/[;]|--|\/\*/.test(m[2])) throw new Error(`Unsafe or unsupported type/constraint text: ${m[2]}`);
    return `  "${m[1]}" ${m[2]}`;
  });
  if (!columns.length) throw new Error('Add at least one column definition.');
  return `CREATE TABLE "${table}" (\n${columns.join(',\n')}\n);`;
}

function queryDiff(input) {
  const parts = input.split(/--\s*QUERY B\s*--/i);
  if (parts.length !== 2) throw new Error('Paste query A, then a line containing -- QUERY B --, then query B.');
  const a = parts[0].trim().split(/\r?\n/), b = parts[1].trim().split(/\r?\n/);
  const out = ['QUERY A / QUERY B LINE COMPARISON', ''];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) out.push(`  ${String(i + 1).padStart(3)}  ${a[i] ?? ''}`);
    else { if (a[i] !== undefined) out.push(`- ${String(i + 1).padStart(3)}  ${a[i]}`); if (b[i] !== undefined) out.push(`+ ${String(i + 1).padStart(3)}  ${b[i]}`); }
  }
  return out.join('\n');
}

function convertDialect(input, dialect) {
  let out = input;
  if (dialect === 'postgresql') {
    out = out.replace(/\bIFNULL\s*\(/gi, 'COALESCE(').replace(/`([^`]+)`/g, '"$1"');
  } else if (dialect === 'mysql') {
    out = out.replace(/\bILIKE\b/gi, 'LIKE').replace(/"([A-Za-z_][\w$]*)"/g, '`$1`').replace(/\bRETURNING\b[\s\S]*$/i, '/* REVIEW: RETURNING may not be supported in your MySQL version */');
  } else if (dialect === 'sqlite') {
    out = out.replace(/\bILIKE\b/gi, 'LIKE').replace(/\bNOW\s*\(\s*\)/gi, "CURRENT_TIMESTAMP").replace(/`([^`]+)`/g, '"$1"');
  } else if (dialect === 'sqlserver') {
    out = out.replace(/\bLIMIT\s+(\d+)\s*;?$/i, 'OFFSET 0 ROWS FETCH NEXT $1 ROWS ONLY').replace(/`([^`]+)`/g, '[$1]').replace(/"([A-Za-z_][\w$]*)"/g, '[$1]');
  }
  return `-- Target dialect: ${dialect}\n-- Best-effort conversion only; review functions, quoting, pagination, and data types.\n${out}`;
}

function Cherry({ small = false }) {
  return (
    <span className={'cherry-mark ' + (small ? 'small' : '')}>
      <i className="leaf" />
      <i className="cherry cherry-left" />
      <i className="cherry cherry-right" />
    </span>
  );
}

function App() {
  const [cat, setCat] = useState('all');
  const [menu, setMenu] = useState(false);
  const [tool, setTool] = useState(null);
  const [query, setQuery] = useState(sqlSample);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [letter, setLetter] = useState('upper');
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(
    () => cat === 'all' ? tools : tools.filter(t => t[3] === cat),
    [cat]
  );

  const selected = tools.find(t => t[0] === tool);

  function openCategory(category) {
    setCat(category);
    setTool(null);
    setMenu(false);

    requestAnimationFrame(() => {
      document.getElementById('tools')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }

  function openTool(id) {
    const next = tools.find(t => t[0] === id);
    if (!next?.[7]) return;

    setTool(id);
    setQuery(id === 'csv-json' ? csvSample : sqlSample);
    setResult('');
    setError('');
    setCopied(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function run() {
    if (!selected) return;

    setError('');
    setResult('');
    setCopied(false);

    try {
      let output = query;

      switch (selected[7]) {
        case 'formatter': {
          output = formatSQL(query, {
            language: 'sql',
            tabWidth: 2,
            keywordCase: 'upper',
            linesBetweenQueries: 1
          });

          output = output.replace(
            /\b(LEFT|RIGHT|FULL|INNER|OUTER|CROSS|NATURAL)\s*\n\s*JOIN\b/gi,
            (_, joinType) => `${joinType.toUpperCase()} JOIN`
          );

          break;
        }

        case 'minifier':
          output = minifySQL(query);
          break;

        case 'case':
          output = transformSQLKeywords(query, letter);
          break;

        case 'csv-json':
          output = csvToJSON(query);
          break;

        case 'check':
          output = checkSQL(query);
          break;

        case 'sql-diff':
          output = queryDiff(query);
          break;
        case 'csv-sql':
          output = csvToSQL(query);
          break;
        case 'json-sql':
          output = jsonToSQL(query);
          break;
        case 'create-table':
          output = createTableSQL(query);
          break;
        case 'sql-join':
          output = 'JOIN visualizer guide\n\nINNER JOIN: only matching rows.\nLEFT JOIN: every left row, with NULLs for unmatched right rows.\nRIGHT JOIN: every right row, with NULLs for unmatched left rows.\nFULL OUTER JOIN: all rows from both sides; unmatched columns are NULL.\n\nThis tool explains JOIN semantics; it does not execute SQL or connect to a database.';
          break;
        case 'sql-dialect': {
          const parts = query.split(/--\s*TARGET\s*:/i);
          if (parts.length < 2) throw new Error('Add a line like -- TARGET: postgresql, mysql, sqlite, or sqlserver at the end of the query.');
          const target = parts.pop().trim().toLowerCase();
          if (!['postgresql', 'mysql', 'sqlite', 'sqlserver'].includes(target)) throw new Error('Supported targets: postgresql, mysql, sqlite, sqlserver.');
          output = convertDialect(parts.join('-- TARGET:').trim(), target);
          break;
        }
        default:
          throw new Error('This tool is not available yet.');
      }

      setResult(output);
    } catch (e) {
      setError(e.message || 'Could not process this input.');
    }
  }

  async function copy() {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError('Copy failed. Please select and copy the output manually.');
    }
  }

  const workflowLinkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: 0,
    border: 0,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer'
  };

  return (
    <div className="shell">
      <header className="topbar">
        <a
          className="brand"
          href="#top"
          onClick={() => {
            setTool(null);
            setCat('all');
          }}
        >
          <Cherry />
          <span>Query<span className="red">Cherry</span></span>
        </a>

        <nav>
          <a href="#tools">Tools</a>
          <a href="#workflow">Workflows</a>
          <a href="#pro">Pricing</a>
          <a href="#tools" className="explore">
            Explore tools <ChevronDown size={14} />
          </a>
        </nav>

        <div className="head-right">
          <a className="red" href="#pro">QueryCherry Pro</a>
          <a className="btn dark" href="#tools">
            Explore tools <ArrowRight size={15} />
          </a>
        </div>

        <button
          className="menu-btn"
          onClick={() => setMenu(!menu)}
          aria-label="Toggle menu"
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>

      {menu && (
        <div className="mobile-menu">
          <a href="#tools" onClick={() => setMenu(false)}>Tools</a>
          <a href="#workflow" onClick={() => setMenu(false)}>Workflows</a>
          <a href="#pro" onClick={() => setMenu(false)}>Pricing</a>
        </div>
      )}

      {!tool ? (
        <>
          <section className="hero" id="top">
            <span className="spark s1">✳</span>
            <span className="spark s2">✦</span>

            <div className="eyebrow">
              <i /> A LITTLE MORE DELIGHTFUL. A LOT MORE USEFUL.
            </div>

            <h1>Your data tools,<br /><span>all in one place.</span></h1>

            <p>
              SQL, structured data, and developer utilities that make
              everyday work feel easier.
            </p>

            <div className="hero-actions">
              <a className="btn primary" href="#tools">
                Explore the tools <ArrowRight size={17} />
              </a>
              <a className="text-link" href="#workflow">
                See how it fits together <ArrowRight size={15} />
              </a>
            </div>

            <div className="hero-note">
              <ShieldCheck size={16} /> Browser-first by design <b>·</b>
              No account needed for basic tools
            </div>

            <div className="floating f1">
              <Database size={20} /> SELECT * FROM ideas
            </div>
            <div className="floating f2">
              <Braces size={20} /> {'{'} clean data {'}'}
            </div>
            <div className="hero-cherry"><Cherry /></div>
          </section>

          <section className="section tools" id="tools">
            <div className="section-heading">
              <div>
                <div className="eyebrow mini">THE TOOLBOX</div>
                <h2>Find your next <span className="red">shortcut.</span></h2>
                <p>Small, focused tools for the work you do every day.</p>
              </div>
              <small>{filtered.length} tools <b>·</b> growing thoughtfully</small>
            </div>

            <div className="categories">
              {cats.map(c => (
                <button
                  key={c[0]}
                  className={cat === c[0] ? 'selected' : ''}
                  onClick={() => setCat(c[0])}
                >
                  {c[1]}
                </button>
              ))}
            </div>

            <div className="tool-grid">
              {filtered.map(t => {
                const Icon = t[4];

                return (
                  <button
                    className="tool-card"
                    key={t[0]}
                    onClick={() => openTool(t[0])}
                  >
                    <span className={'tool-icon ' + t[5]}>
                      <Icon size={22} />
                    </span>
                    <strong>
                      {t[1]}{!t[7] && <i className="soon" />}
                    </strong>
                    <p>{t[2]}</p>
                    <span className={'card-bottom ' + (t[7] ? 'ready' : '')}>
                      {t[7] ? 'Open tool' : 'Planned'} <ArrowRight size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="workflow" id="workflow">
            <div className="section">
              <div className="center">
                <div className="eyebrow mini">LESS TOOL-HOPPING</div>
                <h2>Make your workflow <span className="red">flow.</span></h2>
                <p>
                  Good tools are great. Tools that work well together are even better.
                </p>
              </div>

              <div className="workflow-grid">
                <article>
                  <div className="art peach">
                    <div className="window">
                      <b /><b /><b />
                      <div className="lines"><i /><i /><i /><i /></div>
                    </div>
                    <span className="art-icon"><Database /></span>
                  </div>
                  <div className="workflow-body">
                    <h3>Write cleaner SQL</h3>
                    <p>Turn hard-to-scan queries into something you can actually read.</p>
                    <button
                      type="button"
                      style={workflowLinkStyle}
                      onClick={() => openCategory('sql')}
                    >
                      SQL utilities <ArrowRight size={14} />
                    </button>
                  </div>
                </article>

                <article>
                  <div className="art lilac">
                    <div className="table-art">
                      {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
                    </div>
                    <span className="art-icon"><Table2 /></span>
                  </div>
                  <div className="workflow-body">
                    <h3>Get data into shape</h3>
                    <p>Clean, convert, and compare data without a complicated setup.</p>
                    <button
                      type="button"
                      style={workflowLinkStyle}
                      onClick={() => openCategory('clean')}
                    >
                      Data utilities <ArrowRight size={14} />
                    </button>
                  </div>
                </article>

                <article>
                  <div className="art mint">
                    <div className="chart-art">
                      {[35, 65, 48, 90, 72].map((n, i) => (
                        <i key={i} style={{ height: n + '%' }} />
                      ))}
                    </div>
                    <span className="art-icon"><ChartNoAxesCombined /></span>
                  </div>
                  <div className="workflow-body">
                    <h3>See the bigger picture</h3>
                    <p>Move from raw values toward useful summaries and visuals.</p>
                    <button
                      type="button"
                      style={workflowLinkStyle}
                      onClick={() => openCategory('visual')}
                    >
                      Analysis tools <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section className="section pro" id="pro">
            <div className="pro-panel">
              <div>
                <div className="eyebrow mini">WHEN YOU'RE READY FOR MORE</div>
                <h2>More momentum.<br /><span className="red">Less busywork.</span></h2>
                <p>
                  QueryCherry Pro is planned for people who want to do more
                  with batch tools, repeatable workflows, and advanced data operations.
                </p>
                <ul>
                  <li><Check /> Batch and bulk operations</li>
                  <li><Check /> Reusable presets and workflows</li>
                  <li><Check /> Advanced transformations as they launch</li>
                </ul>
                <span className="coming">
                  <Sparkles size={15} /> Pro is on the roadmap — free tools first.
                </span>
              </div>

              <div className="pro-art">
                <div className="orbit o1" />
                <div className="orbit o2" />
                <div className="big-cherry"><Cherry /></div>
                <span className="sticker st1"><Zap /> Less busywork</span>
                <span className="sticker st2"><Heart /> Made for data people</span>
              </div>
            </div>
          </section>

          <section className="section trust" id="privacy">
            <span className="trust-icon"><ShieldCheck /></span>
            <div>
              <h3>Your data deserves a little privacy.</h3>
              <p>
                QueryCherry processes these tool inputs in your browser.
                Each tool should clearly explain its limits and how it handles your data.
              </p>
            </div>
            <span className="trust-tag">Privacy-minded by design</span>
          </section>

          <footer>
            <div className="footer-grid">
              <div className="footer-brand">
                <a className="brand" href="#top">
                  <Cherry />
                  <span>Query<span className="red">Cherry</span></span>
                </a>
                <p>Useful data tools, with a little more personality.</p>
                <small>Built thoughtfully, one tool at a time. 🍒</small>
              </div>

              <div>
                <h4>TOOLS</h4>
                <a href="#tools" onClick={() => setCat('sql')}>SQL tools</a>
                <a href="#tools" onClick={() => setCat('csv')}>CSV &amp; tables</a>
                <a href="#tools" onClick={() => setCat('json')}>JSON tools</a>
                <a href="#tools" onClick={() => setCat('dev')}>Developer utilities</a>
              </div>

              <div>
                <h4>QUERYCHERRY</h4>
                <a href="#workflow">How it works</a>
                <a href="#pro">Pricing</a>
                <a href="#tools">Roadmap</a>
              </div>

              <div>
                <h4>GOOD TO KNOW</h4>
                <a href="#privacy">Privacy approach</a>
                <a href="mailto:hello@querycherry.com">Contact</a>
                <small>More pages coming as we grow.</small>
              </div>
            </div>

            <div className="footer-bottom">
              <span>© 2026 QueryCherry</span>
              <span>Made with a little extra 🍒</span>
            </div>
          </footer>
        </>
      ) : (
        <main className="section workspace">
          <button className="back" onClick={() => setTool(null)}>
            ← Back to all tools
          </button>

          <div className="workspace-title">
            <span className={'tool-icon large ' + selected[5]}>
              {React.createElement(selected[4], { size: 28 })}
            </span>
            <div>
              <div className="eyebrow mini">
                QUERYCHERRY · {selected[3].toUpperCase()} TOOLS
              </div>
              <h1>{selected[1]}</h1>
              <p>{selected[2]}</p>
            </div>
          </div>

          <div className="editors">
            <section className="editor">
              <div className="panel-head">
                <b>🟠 Input</b>
                <button
                  onClick={() => {
                    setQuery(selected[7] === 'csv-json' ? csvSample : selected[7] === 'csv-sql' ? 'name,age,city\nAva,21,Jaipur\nNoah,24,Delhi' : selected[7] === 'json-sql' ? '[{\"name\":\"Ava\",\"age\":21},{\"name\":\"Noah\",\"age\":24}]' : selected[7] === 'create-table' ? 'users\nid INTEGER PRIMARY KEY\nname VARCHAR(100) NOT NULL\ncreated_at TIMESTAMP' : selected[7] === 'sql-diff' ? 'SELECT id FROM users;\n-- QUERY B --\nSELECT id, name FROM users;' : sqlSample);
                    setResult('');
                    setError('');
                  }}
                >
                  Load sample
                </button>
              </div>

              <textarea
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setError('');
                }}
                spellCheck="false"
                aria-label={selected[7] === 'csv-json' ? 'CSV input' : 'SQL input'}
              />

              <div className="editor-actions">
                {selected[7] === 'sql-dialect' && (
                  <small>Append -- TARGET: postgresql, mysql, sqlite, or sqlserver on a new line.</small>
                )}
                {selected[7] === 'case' && (
                  <select value={letter} onChange={e => setLetter(e.target.value)}>
                    <option value="upper">UPPERCASE keywords</option>
                    <option value="lower">lowercase keywords</option>
                  </select>
                )}

                <small>
                  {selected[7] === 'csv-json'
                    ? 'CSV is processed locally in your browser'
                    : 'Runs locally in your browser'}
                </small>

                <button className="btn primary" onClick={run}>
                  <Play size={14} />
                  {selected[7] === 'formatter'
                    ? 'Format SQL'
                    : selected[7] === 'minifier'
                      ? 'Minify SQL'
                      : selected[7] === 'case'
                        ? 'Convert case'
                        : selected[7] === 'sql-diff'
                          ? 'Compare queries'
                          : selected[7] === 'csv-sql'
                            ? 'Convert to SQL'
                            : selected[7] === 'json-sql'
                              ? 'Convert to SQL'
                              : selected[7] === 'create-table'
                                ? 'Generate table'
                                : selected[7] === 'sql-join'
                                  ? 'Show JOIN guide'
                                  : selected[7] === 'sql-dialect'
                                    ? 'Convert dialect'
                        : selected[7] === 'check'
                          ? 'Check SQL'
                          : 'Convert to JSON'}
                </button>
              </div>
            </section>

            <section className="editor">
              <div className="panel-head">
                <b>🟢 Output</b>
                <button onClick={copy} disabled={!result}>
                  {copied ? '✓ Copied' : <><Copy size={13} /> Copy result</>}
                </button>
              </div>

              {error && (
                <p role="alert" style={{ color: '#c0392b', padding: '12px' }}>
                  {error}
                </p>
              )}

              <pre className={result ? 'filled' : ''}>
                {result || (error ? 'Fix the input and try again.' : 'Your result will appear here…')}
              </pre>

              <div className="output-foot">
                {result ? `${result.length} characters` : 'Run the tool to see your output'}
              </div>
            </section>
          </div>

          <div className="note">
            <ShieldCheck />
            <div>
              <strong>Keep your data yours.</strong>
              <p>
                {selected[7] === 'csv-json'
                  ? 'CSV conversion happens locally in your browser. Values are returned as strings. Check the output before using it in production.'
                  : selected[7] === 'check'
                    ? 'This is a lightweight structural check, not a complete SQL parser. A clean result does not guarantee that your database will accept the query.'
                    : 'SQL processing happens locally in your browser. Test important queries against your own database and dialect before production use.'}
              </p>
            </div>
          </div>
        </main>
      )}

      <div className="mobile-bottom">
        <Cherry small />
        <span>Tools for data people</span>
        <a href="#tools">Explore <ArrowRight size={14} /></a>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
