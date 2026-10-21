// Pure, dependency-free SQL helpers. Everything runs locally; nothing here touches the network.
// Tokenizer rules (standard SQL): '...' strings and "..." / `...` identifiers use doubled-quote escapes.
// Backslash escapes (MySQL) and [bracket] identifiers (SQL Server) are NOT recognised by the tokenizer.

export const DIALECTS = ['generic', 'postgresql', 'mysql', 'sqlite', 'sqlserver'];

const need = (input, msg = 'Paste some input first.') => {
  if (typeof input !== 'string' || !input.trim()) throw new Error(msg);
};

/** Split SQL into code / string / ident / comment tokens. Reports unterminated constructs. */
export function tokenize(input) {
  const tokens = [];
  const problems = [];
  let i = 0;
  let code = '';
  const flush = () => { if (code) { tokens.push({ t: 'code', v: code }); code = ''; } };
  const readQuoted = (q) => {
    let j = i + 1;
    while (j < input.length) {
      if (input[j] === q) {
        if (input[j + 1] === q) { j += 2; continue; }
        return j + 1;
      }
      j++;
    }
    return -1;
  };
  while (i < input.length) {
    const ch = input[i];
    const nx = input[i + 1];
    if (ch === '-' && nx === '-') {
      flush();
      let j = input.indexOf('\n', i);
      if (j === -1) j = input.length;
      tokens.push({ t: 'lcomment', v: input.slice(i, j).replace(/\r$/, '') });
      i = j;
    } else if (ch === '/' && nx === '*') {
      flush();
      const j = input.indexOf('*/', i + 2);
      if (j === -1) { problems.push('A block comment is not closed.'); tokens.push({ t: 'bcomment', v: input.slice(i) }); i = input.length; }
      else { tokens.push({ t: 'bcomment', v: input.slice(i, j + 2) }); i = j + 2; }
    } else if (ch === '[') {
      // SQL Server delimited identifiers: [name] with ]] representing a literal ].
      flush();
      let j = i + 1;
      let closed = false;
      while (j < input.length) {
        if (input[j] === ']' && input[j + 1] === ']') { j += 2; continue; }
        if (input[j] === ']') { closed = true; j++; break; }
        j++;
      }
      if (!closed) problems.push('A bracket-quoted identifier is not closed.');
      tokens.push({ t: 'ident', q: '[', v: input.slice(i, j) });
      i = j;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      flush();
      const j = readQuoted(ch);
      const end = j === -1 ? input.length : j;
      if (j === -1) problems.push(ch === "'" ? 'A string literal is not closed.' : 'A quoted identifier is not closed.');
      tokens.push({ t: ch === "'" ? 'string' : 'ident', q: ch, v: input.slice(i, end) });
      i = end;
    } else if (ch === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(input.slice(i, i + 80));
      if (m) {
        flush();
        const j = input.indexOf(m[0], i + m[0].length);
        if (j === -1) { problems.push('A dollar-quoted string is not closed.'); tokens.push({ t: 'string', q: '$', v: input.slice(i) }); i = input.length; }
        else { tokens.push({ t: 'string', q: '$', v: input.slice(i, j + m[0].length) }); i = j + m[0].length; }
      } else { code += ch; i++; }
    } else { code += ch; i++; }
  }
  flush();
  return { tokens, problems };
}

const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'LEFT', 'RIGHT', 'FULL',
  'INNER', 'OUTER', 'CROSS', 'NATURAL', 'JOIN', 'ON', 'USING', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS',
  'DISTINCT', 'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'TABLE', 'ALTER', 'DROP', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'BETWEEN', 'LIKE',
  'ILIKE', 'ASC', 'DESC', 'WITH', 'OVER', 'PARTITION', 'FETCH', 'FIRST', 'NEXT', 'ROWS', 'ONLY', 'RETURNING',
  'PRIMARY', 'KEY', 'UNIQUE', 'DEFAULT', 'TRUE', 'FALSE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'
];
const KEYWORD_RE = new RegExp(`(?<![\\p{L}\\p{N}_$.@:])(?:${KEYWORDS.join('|')})(?![\\p{L}\\p{N}_$])`, 'giu');

/** Change keyword case outside strings, quoted identifiers and comments. Unquoted identifiers that look like keywords are also converted (harmless for unquoted names). */
export function caseKeywords(input, letter = 'upper') {
  need(input, 'Paste a SQL query first.');
  const { tokens, problems } = tokenize(input);
  if (problems.length) throw new Error(problems[0]);
  const fn = letter === 'lower' ? (s) => s.toLowerCase() : (s) => s.toUpperCase();
  return tokens.map((t) => (t.t === 'code' ? t.v.replace(KEYWORD_RE, fn) : t.v)).join('');
}

const isWord = (c) => !!c && /[\p{L}\p{N}_$]/u.test(c);
const isQuote = (c) => c === "'" || c === '"' || c === '`' || c === '[' || c === ']';
const needsSpace = (a, b) =>
  ((isWord(a) || isQuote(a)) && (isWord(b) || isQuote(b))) ||
  (a === '-' && b === '-') || (a === '/' && b === '*') || (a === '*' && b === '/');

/**
 * Collapse whitespace. Strings and quoted identifiers are untouched.
 * Comments are kept by default (a line comment keeps its trailing newline so it cannot swallow code);
 * pass { stripComments: true } to remove them.
 */
export function minify(input, { stripComments = false } = {}) {
  need(input, 'Paste a SQL query first.');
  const { tokens, problems } = tokenize(input);
  if (problems.length) throw new Error(problems[0]);
  let out = '';
  let pending = false;
  const emit = (piece) => {
    if (pending && out && needsSpace(out.at(-1), piece[0])) out += ' ';
    pending = false;
    out += piece;
  };
  for (const tk of tokens) {
    if (tk.t === 'code') {
      for (const ch of tk.v) { if (/\s/.test(ch)) pending = true; else emit(ch); }
    } else if (tk.t === 'string' || tk.t === 'ident') {
      emit(tk.v);
    } else if (stripComments) {
      pending = true;
    } else if (tk.t === 'bcomment') {
      if (out && !/\s$/.test(out)) out += ' ';
      out += tk.v; pending = true;
    } else {
      if (out && !/\s$/.test(out)) out += ' ';
      out += tk.v + '\n'; pending = false;
    }
  }
  return out.trim();
}

/** Lightweight heuristic checks. NOT a parser. */
export function checkSyntax(input) {
  need(input, 'Paste a SQL query first.');
  const { tokens, problems } = tokenize(input);
  const issues = [...problems];
  const code = tokens.map((t) => (t.t === 'code' ? t.v : t.t === 'string' || t.t === 'ident' ? ' _ ' : ' ')).join('');
  const stack = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '(') stack.push(i);
    else if (code[i] === ')' && !stack.pop()) issues.push(`Unexpected ")" near character ${i + 1} of the code outside strings and comments.`);
  }
  if (stack.length) issues.push(`${stack.length} "(" ${stack.length === 1 ? 'is' : 'are'} not closed.`);
  if (!code.replace(/[;\s]/g, '')) issues.push('There is no SQL code, only comments or whitespace.');
  if (/^\s*(WHERE|AND|OR|JOIN|ON|GROUP\s+BY|ORDER\s+BY|HAVING)\b/i.test(code)) issues.push('The query starts with a clause that normally follows another clause.');
  if (/\bSELECT\s*(\bFROM\b|\bWHERE\b|\bGROUP\b|\bORDER\b|;|$)/i.test(code)) issues.push('SELECT appears to have no column list.');
  if (/\bFROM\s*(\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|;|\)|$)/i.test(code)) issues.push('FROM appears to have no table name.');
  if (/,\s*(\bFROM\b|\bWHERE\b|\bGROUP\b|\bORDER\b|\)|;|$)/i.test(code)) issues.push('A trailing comma appears before a clause, a closing parenthesis, or the end.');
  if (/\bIN\s*\(\s*\)/i.test(code)) issues.push('IN () has an empty list.');
  const cases = (code.match(/\bCASE\b/gi) || []).length;
  const ends = (code.match(/\bEND\b/gi) || []).length;
  if (cases !== ends) issues.push(`CASE/END counts differ (${cases} CASE, ${ends} END).`);
  const note = 'This is a lightweight heuristic check, not a dialect-aware SQL parser. It cannot confirm that your database will accept the query.';
  return issues.length
    ? `Potential issues found:\n\n${issues.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${note}`
    : `No obvious structural problems found.\n\n${note}`;
}

/* ---------- CSV ---------- */

/** RFC 4180-style parser: quotes, escaped quotes, CRLF/LF/CR, newlines in quotes, BOM. Blank lines are skipped. */
export function parseCSV(input) {
  need(input, 'Paste some CSV data first.');
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
    row = []; field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else field += ch;
  }
  if (quoted) throw new Error('A quoted CSV field is not closed.');
  if (field !== '' || row.length) endRow();
  if (rows.length < 2) throw new Error('Include a header row and at least one data row.');
  const headers = rows[0].map((h) => h.trim());
  if (headers.some((h) => !h)) throw new Error('Every CSV column needs a header.');
  const seen = new Set();
  for (const h of headers) {
    const k = h.toLowerCase();
    if (seen.has(k)) throw new Error(`Duplicate header "${h}" (headers are compared case-insensitively).`);
    seen.add(k);
  }
  const data = rows.slice(1);
  data.forEach((r, i) => {
    if (r.length !== headers.length) throw new Error(`Data row ${i + 1} has ${r.length} columns; the header has ${headers.length}.`);
  });
  return { headers, rows: data };
}

export function csvToJson(input) {
  const { headers, rows } = parseCSV(input);
  return JSON.stringify(rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))), null, 2);
}

/* ---------- Identifier / literal quoting ---------- */

export function quoteIdent(name, dialect = 'generic') {
  const s = String(name);
  if (!s || s.includes('\u0000')) throw new Error('Identifiers cannot be empty or contain NUL characters.');
  if (dialect === 'mysql') return '`' + s.replace(/`/g, '``') + '`';
  if (dialect === 'sqlserver') return '[' + s.replace(/\]/g, ']]') + ']';
  return '"' + s.replace(/"/g, '""') + '"';
}

export function quoteValue(v, dialect = 'generic') {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('NaN and Infinity cannot be written as SQL numbers.'); return String(v); }
  if (typeof v === 'boolean') return dialect === 'sqlserver' || dialect === 'sqlite' ? (v ? '1' : '0') : (v ? 'TRUE' : 'FALSE');
  const s = String(v);
  if (s.includes('\u0000')) throw new Error('Values cannot contain NUL characters.');
  const body = (dialect === 'mysql' ? s.replace(/\\/g, '\\\\') : s).replace(/'/g, "''");
  return `'${body}'`;
}

const SIMPLE_IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;
export function checkTableName(name) {
  const t = String(name ?? '').trim();
  if (!SIMPLE_IDENT.test(t) || t.length > 63) throw new Error('Table name must start with a letter or underscore and use only letters, digits, _ or $ (max 63 characters).');
  return t;
}

const PLACEHOLDER = 'your_table';
const placeholderNote = (t) => (t === PLACEHOLDER ? `-- NOTE: "${PLACEHOLDER}" is a placeholder. Replace it with your real table name before running.\n` : '');

function inserts(table, cols, rows, dialect) {
  const head = `INSERT INTO ${quoteIdent(table, dialect)} (${cols.map((c) => quoteIdent(c, dialect)).join(', ')}) VALUES `;
  return rows.map((r) => `${head}(${r.join(', ')});`).join('\n');
}

/** CSV -> INSERTs. Every non-empty cell becomes a quoted string literal; empty cells become NULL. */
export function csvToSql(input, { table = PLACEHOLDER, dialect = 'generic' } = {}) {
  const t = checkTableName(table);
  const { headers, rows } = parseCSV(input);
  const body = inserts(t, headers, rows.map((r) => r.map((c) => (c === '' ? 'NULL' : quoteValue(c, dialect)))), dialect);
  return `${placeholderNote(t)}-- Empty CSV cells are written as NULL; all other values are quoted strings (your database converts them to the column type).\n${body}`;
}

/** JSON array of flat objects -> INSERTs. Nested objects/arrays are rejected. */
export function jsonToSql(input, { table = PLACEHOLDER, dialect = 'generic' } = {}) {
  need(input, 'Paste a JSON array first.');
  const t = checkTableName(table);
  let data;
  try { data = JSON.parse(input); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
  if (!Array.isArray(data) || !data.length || data.some((v) => !v || Array.isArray(v) || typeof v !== 'object')) throw new Error('Provide a non-empty JSON array of objects.');
  const keys = [...new Set(data.flatMap(Object.keys))];
  if (!keys.length) throw new Error('Records need at least one field.');
  const rows = data.map((o, i) => keys.map((k) => {
    const v = o[k];
    if (v !== null && typeof v === 'object') throw new Error(`Record ${i + 1}, field "${k}" is nested (object or array). Flatten it first.`);
    return quoteValue(v, dialect);
  }));
  return `${placeholderNote(t)}-- Fields missing from a record are written as NULL. Integers beyond 2^53 may lose precision in JSON parsing.\n${inserts(t, keys, rows, dialect)}`;
}

/* ---------- CREATE TABLE ---------- */

const TYPES = ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'SERIAL', 'BIGSERIAL', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'DOUBLE', 'BOOLEAN', 'BOOL', 'BIT', 'CHAR', 'VARCHAR', 'NCHAR', 'NVARCHAR', 'TEXT', 'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'DATETIME', 'UUID', 'JSON', 'JSONB', 'BLOB', 'BYTEA', 'VARBINARY'];
const TYPE_RE = new RegExp(`^(${TYPES.join('|')})(?:\\s+PRECISION)?(\\s*\\(\\s*\\d{1,5}(?:\\s*,\\s*\\d{1,3})?\\s*\\))?(?![\\w$])`, 'i');
const CONSTRAINTS = [
  [/^NOT\s+NULL(?![\w$])/i, 'NOT NULL'], [/^NULL(?![\w$])/i, 'NULL'], [/^PRIMARY\s+KEY(?![\w$])/i, 'PRIMARY KEY'],
  [/^UNIQUE(?![\w$])/i, 'UNIQUE'], [/^AUTO_INCREMENT(?![\w$])/i, 'AUTO_INCREMENT'], [/^AUTOINCREMENT(?![\w$])/i, 'AUTOINCREMENT']
];
const DEFAULT_RE = /^DEFAULT\s+(-?\d+(?:\.\d+)?|'(?:[^']|'')*'|NULL|TRUE|FALSE|CURRENT_TIMESTAMP|CURRENT_DATE)(?![\w$])/i;

/** First line: table name. Then one column per line: `name TYPE [NOT NULL] [NULL] [PRIMARY KEY] [UNIQUE] [DEFAULT literal]`. Anything else is rejected. */
export function createTable(input, { dialect = 'generic' } = {}) {
  need(input, 'Enter a table name, then one column per line.');
  const lines = input.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const table = checkTableName(lines.shift().replace(/^table\s*:\s*/i, ''));
  if (!lines.length) throw new Error('Add at least one column definition.');
  const names = new Set();
  let pk = 0;
  const cols = lines.map((line) => {
    const m = /^([A-Za-z_][A-Za-z0-9_$]*)\s+(.+)$/.exec(line);
    if (!m) throw new Error(`Invalid column line: "${line}". Use: name TYPE [constraints].`);
    const [, name, rest] = m;
    if (names.has(name.toLowerCase())) throw new Error(`Duplicate column name "${name}".`);
    names.add(name.toLowerCase());
    const tm = TYPE_RE.exec(rest);
    if (!tm) throw new Error(`Unsupported or unsafe type for "${name}": "${rest}". Allowed types: ${TYPES.join(', ')}.`);
    const parts = [tm[0].replace(/\s+/g, ' ').toUpperCase()];
    let tail = rest.slice(tm[0].length).trim();
    while (tail) {
      const d = DEFAULT_RE.exec(tail);
      const c = d ? null : CONSTRAINTS.find(([re]) => re.test(tail));
      if (!d && !c) throw new Error(`Unsupported constraint text for "${name}": "${tail}". Allowed: NOT NULL, NULL, PRIMARY KEY, UNIQUE, AUTO_INCREMENT (MySQL), AUTOINCREMENT (SQLite), DEFAULT <number|'text'|NULL|TRUE|FALSE|CURRENT_TIMESTAMP|CURRENT_DATE>.`);
      const hit = d ? d[0] : tail.match(c[0])[0];
      const label = d ? 'DEFAULT ' + d[1] : c[1];
      if (label === 'PRIMARY KEY') pk++;
      if (label === 'AUTO_INCREMENT' && dialect !== 'mysql') throw new Error(`AUTO_INCREMENT is MySQL-only (selected dialect: ${dialect}).`);
      if (label === 'AUTOINCREMENT' && dialect !== 'sqlite') throw new Error(`AUTOINCREMENT is SQLite-only (selected dialect: ${dialect}).`);
      parts.push(label.startsWith('DEFAULT') ? label.replace(/^DEFAULT\s+(NULL|TRUE|FALSE|CURRENT_\w+)$/i, (_, v) => 'DEFAULT ' + v.toUpperCase()) : label);
      tail = tail.slice(hit.length).trim();
    }
    return `  ${quoteIdent(name, dialect)} ${parts.join(' ')}`;
  });
  if (pk > 1) throw new Error('Only one inline PRIMARY KEY is supported (composite keys are not supported).');
  return `CREATE TABLE ${quoteIdent(table, dialect)} (\n${cols.join(',\n')}\n);\n-- Types are validated against a fixed list but are not translated between dialects; confirm them for your database.`;
}

/* ---------- Query diff ---------- */

/** Line diff (longest-common-subsequence). A changed line appears as a "-" line followed by a "+" line. */
export function diffQueries(input) {
  need(input, 'Paste query A, a line containing only -- QUERY B --, then query B.');
  const parts = input.split(/^[ \t]*--[ \t]*QUERY B[ \t]*--[ \t]*\r?$/im);
  if (parts.length !== 2) throw new Error('Put exactly one line containing only "-- QUERY B --" between the two queries.');
  const split = (s) => (s.trim() === '' ? [] : s.replace(/^\s*\n|\s+$/g, '').split(/\r?\n/).map((l) => l.replace(/\s+$/, '')));
  const a = split(parts[0]);
  const b = split(parts[1]);
  if (!a.length && !b.length) throw new Error('Both queries are empty.');
  if (a.length * b.length > 4_000_000) throw new Error('Inputs are too large to compare (limit about 2000 lines each).');
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0, del = 0, add = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push(`  ${a[i]}`); i++; j++; }
    else if (j >= b.length || (i < a.length && L[i + 1][j] >= L[i][j + 1])) { out.push(`- ${a[i]}`); i++; del++; }
    else { out.push(`+ ${b[j]}`); j++; add++; }
  }
  const head = del || add ? `${del} line(s) only in A ("-"), ${add} line(s) only in B ("+"). A changed line shows as "-" then "+".` : 'The two queries are identical (ignoring trailing whitespace).';
  return `${head}\n\n${out.join('\n')}`;
}

/* ---------- JOIN visualizer data ---------- */

export const JOIN_LEFT = { name: 'users', columns: ['id', 'name'], rows: [[1, 'Ava'], [2, 'Noah'], [3, 'Mia']] };
export const JOIN_RIGHT = { name: 'orders', columns: ['id', 'user_id', 'item'], rows: [[101, 1, 'Laptop'], [102, 1, 'Mouse'], [103, 4, 'Phone']] };

/** Join the sample tables on users.id = orders.user_id. kind: INNER | LEFT | RIGHT | FULL. */
export function joinSample(kind) {
  if (!['INNER', 'LEFT', 'RIGHT', 'FULL'].includes(kind)) throw new Error(`Unknown join type: ${kind}`);
  const L = JOIN_LEFT.rows, R = JOIN_RIGHT.rows;
  const nullsL = new Array(JOIN_LEFT.columns.length).fill(null);
  const nullsR = new Array(JOIN_RIGHT.columns.length).fill(null);
  const rows = [];
  const usedR = new Set();
  for (const l of L) {
    const ms = R.filter((r) => r[1] === l[0]);
    if (ms.length) ms.forEach((r) => { usedR.add(r); rows.push({ cells: [...l, ...r], kind: 'matched' }); });
    else if (kind === 'LEFT' || kind === 'FULL') rows.push({ cells: [...l, ...nullsR], kind: 'left-only' });
  }
  if (kind === 'RIGHT' || kind === 'FULL') for (const r of R) if (!usedR.has(r)) rows.push({ cells: [...nullsL, ...r], kind: 'right-only' });
  const sqlKind = { INNER: 'INNER JOIN', LEFT: 'LEFT JOIN', RIGHT: 'RIGHT JOIN', FULL: 'FULL OUTER JOIN' }[kind];
  return {
    columns: [...JOIN_LEFT.columns.map((c) => `users.${c}`), ...JOIN_RIGHT.columns.map((c) => `orders.${c}`)],
    rows,
    sql: `SELECT *\nFROM users\n${sqlKind} orders\n  ON users.id = orders.user_id;`
  };
}

/* ---------- Dialect conversion ---------- */

export const TARGETS = ['postgresql', 'mysql', 'sqlite', 'sqlserver'];

const unquote = (v) => v.slice(1, v.endsWith(v[0]) && v.length > 1 ? -1 : undefined).split(v[0] + v[0]).join(v[0]);

const WARNINGS = [
  [/\bILIKE\b/i, ['mysql', 'sqlite', 'sqlserver'], 'ILIKE is PostgreSQL-specific and was left unchanged. LIKE has different case-sensitivity rules per database; rewrite it, e.g. LOWER(a) LIKE LOWER(b).'],
  [/::/, ['mysql', 'sqlite', 'sqlserver'], 'PostgreSQL "::" casts were left unchanged; use CAST(x AS type).'],
  [/\|\|/, ['mysql', 'sqlserver'], '"||" is string concatenation only in some databases (MySQL default: OR; SQL Server: use + or CONCAT). Left unchanged.'],
  [/\bRETURNING\b/i, ['mysql', 'sqlserver'], 'RETURNING is not supported here (SQL Server uses OUTPUT; MySQL has no equivalent). Left unchanged.'],
  [/\b(SERIAL|BIGSERIAL|AUTO_INCREMENT|AUTOINCREMENT|IDENTITY)\b/i, TARGETS, 'Auto-increment syntax differs per database and was not converted.'],
  [/\bON\s+CONFLICT\b|\bON\s+DUPLICATE\s+KEY\b/i, TARGETS, 'Upsert syntax differs per database and was not converted.'],
  [/\bTOP\s+\d+/i, ['postgresql', 'mysql', 'sqlite'], 'SQL Server TOP n was left unchanged; use LIMIT n.'],
  [/\b(DATE_TRUNC|GETDATE|DATEADD|DATEDIFF|STRFTIME|DATE_FORMAT|CONCAT_WS|STRING_AGG|GROUP_CONCAT)\s*\(/i, TARGETS, 'Date/aggregate function names differ per database and were not converted.']
];

/** Convert a small, well-understood set of constructs outside strings and comments. Returns converted SQL preceded by notes. */
export function convertDialect(input, target) {
  need(input, 'Paste a SQL query first.');
  if (!TARGETS.includes(target)) throw new Error(`Supported targets: ${TARGETS.join(', ')}.`);
  const { tokens, problems } = tokenize(input);
  if (problems.length) throw new Error(problems[0]);
  const notes = [];
  const codeAll = tokens.filter((t) => t.t === 'code').map((t) => t.v).join(' ');
  const hasOrderBy = /\bORDER\s+BY\b/i.test(codeAll);
  const out = tokens.map((tk) => {
    if (tk.t === 'ident' && tk.q !== '$') {
      const name = unquote(tk.v);
      const q = { postgresql: ['"', '"'], sqlite: ['"', '"'], mysql: ['`', '`'], sqlserver: ['[', ']'] }[target];
      const esc = q[0] === '"' ? name.replace(/"/g, '""') : q[0] === '`' ? name.replace(/`/g, '``') : name.replace(/\]/g, ']]');
      const next = q[0] + esc + q[1];
      if (next !== tk.v) notes.push(`Identifier quoting changed to ${target} style. In MySQL's default mode, "double quotes" mean strings, so verify.`);
      return next;
    }
    if (tk.t !== 'code') return tk.v;
    let c = tk.v;
    if (target === 'postgresql' || target === 'sqlserver') c = c.replace(/\bIFNULL\s*\(/gi, () => { notes.push('IFNULL( became COALESCE( (same for two arguments; result type rules can differ).'); return 'COALESCE('; });
    if (target === 'sqlite' || target === 'sqlserver') c = c.replace(/\bNOW\s*\(\s*\)/gi, () => { notes.push('NOW() became CURRENT_TIMESTAMP (time zone and type may differ).'); return 'CURRENT_TIMESTAMP'; });
    if (target === 'sqlserver') {
      c = c.replace(/\bLIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/gi, (m, n, o) => {
        if (!hasOrderBy) { notes.push('LIMIT left unchanged: SQL Server OFFSET/FETCH needs an ORDER BY (or use SELECT TOP n).'); return m; }
        notes.push('LIMIT became OFFSET ... FETCH (SQL Server 2012+).');
        return `OFFSET ${o ?? 0} ROWS FETCH NEXT ${n} ROWS ONLY`;
      });
    } else {
      c = c.replace(/(?:\bOFFSET\s+(\d+)\s+ROWS?\s+)?\bFETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY\b/gi, (m, o, n) => {
        notes.push('OFFSET ... FETCH became LIMIT.');
        return `LIMIT ${n}${o && o !== '0' ? ` OFFSET ${o}` : ''}`;
      });
    }
    return c;
  }).join('');
  for (const [re, appliesTo, msg] of WARNINGS) if (appliesTo.includes(target) && re.test(codeAll)) notes.push(msg);
  const uniq = [...new Set(notes)];
  const head = [`-- Converted toward ${target} with a small set of rules. Not guaranteed semantically equivalent; test before use.`, ...(uniq.length ? uniq.map((n) => `-- NOTE: ${n}`) : ['-- No known differences were found by the rules, which does not prove compatibility.'])];
  return `${head.join('\n')}\n${out}`;
}


/** Format SQL with a small original tokenizer-driven formatter. It is intentionally conservative: strings, quoted identifiers and comments are preserved verbatim. */
export function formatSql(input, { indent = '  ', keywordCase = 'upper' } = {}) {
  need(input, 'Paste a SQL query first.');
  const { tokens, problems } = tokenize(input);
  if (problems.length) throw new Error(problems[0]);
  const kw = (s) => keywordCase === 'lower' ? s.toLowerCase() : s.toUpperCase();
  const major = new Set(['SELECT','FROM','WHERE','GROUP BY','HAVING','ORDER BY','LIMIT','OFFSET','FETCH','UNION','UNION ALL','INTERSECT','EXCEPT','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','RETURNING']);
  const joins = new Set(['JOIN','INNER JOIN','LEFT JOIN','LEFT OUTER JOIN','RIGHT JOIN','RIGHT OUTER JOIN','FULL JOIN','FULL OUTER JOIN','CROSS JOIN']);
  const all = tokens.map(t => ({...t, v: t.t === 'code' ? t.v : t.v}));
  let source = all.map(t => t.v).join('');
  // Insert layout markers only into code tokens, never into strings, identifiers, or comments.
  const parts = [];
  for (const t of all) {
    if (t.t !== 'code') { parts.push(t); continue; }
    const re = /\s+|,|;|\(|\)|\b(?:SELECT|FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|FETCH|UNION(?:\s+ALL)?|INTERSECT|EXCEPT|INSERT\s+INTO|VALUES|UPDATE|SET|DELETE\s+FROM|RETURNING|AS|ASC|DESC|DISTINCT|CASE|WHEN|THEN|ELSE|END|IS|NULL|INNER\s+JOIN|LEFT(?:\s+OUTER)?\s+JOIN|RIGHT(?:\s+OUTER)?\s+JOIN|FULL(?:\s+OUTER)?\s+JOIN|CROSS\s+JOIN|JOIN|ON|AND|OR|WHEN|ELSE|END)\b/gi;
    let last = 0, m;
    while ((m = re.exec(t.v))) {
      if (m.index > last) parts.push({t:'code',v:t.v.slice(last,m.index)});
      const v = m[0];
      if (/^\s+$/.test(v)) parts.push({t:'ws',v});
      else if (v === ',' || v === ';' || v === '(' || v === ')') parts.push({t:'punct',v});
      else parts.push({t:'kw',v});
      last = re.lastIndex;
    }
    if (last < t.v.length) parts.push({t:'code',v:t.v.slice(last)});
  }
  let out = '', depth = 0, lineStart = true, pendingSpace = false, previous = '', clauseIndent = 0;
  const trimEnd = () => { out = out.replace(/[ \t]+$/g, ''); };
  const newline = () => { trimEnd(); if (out && !out.endsWith('\n')) out += '\n'; lineStart = true; pendingSpace = false; };
  const write = (v) => { if (lineStart) { out += indent.repeat(Math.max(0, depth + clauseIndent)); lineStart = false; } if (pendingSpace && out && !/[\s(]$/.test(out)) out += ' '; pendingSpace = false; out += v; previous = v; };
  for (const t of parts) {
    if (t.t === 'ws') { pendingSpace = true; continue; }
    if (t.t === 'kw') {
      const word = t.v.replace(/\s+/g, ' ').toUpperCase();
      if (major.has(word) || joins.has(word)) {
        clauseIndent = 0;
        newline();
        write(kw(word));
        if (word === 'SELECT' || word === 'SET' || word === 'VALUES') pendingSpace = true;
      } else if (word === 'ON' || word === 'AND' || word === 'OR') {
        newline(); clauseIndent = 1; write(kw(word)); pendingSpace = true;
      } else { write(kw(word)); pendingSpace = true; }
      continue;
    }
    if (t.t === 'punct') {
      if (t.v === ',') { trimEnd(); out += ','; pendingSpace = true; }
      else if (t.v === ';') { trimEnd(); out += ';'; newline(); }
      else if (t.v === '(') { write('('); depth++; }
      else if (t.v === ')') { depth = Math.max(0, depth - 1); trimEnd(); if (!lineStart) out += ')'; else write(')'); pendingSpace = true; }
      continue;
    }
    if (t.t === 'lcomment') { newline(); write(t.v); newline(); continue; }
    if (t.t === 'bcomment') { write(t.v); pendingSpace = true; continue; }
    write(t.v);
  }
  return out.trim().replace(/\n{3,}/g, '\n\n');
}

/** Execute a two-table equijoin over user-provided in-memory data. */
export function joinTables(left, right, leftKey, rightKey, kind = 'LEFT') {
  if (!['INNER','LEFT','RIGHT','FULL'].includes(kind)) throw new Error('Choose a supported join type.');
  if (!left?.columns?.length || !right?.columns?.length) throw new Error('Both tables need column headers.');
  const li = left.columns.indexOf(leftKey), ri = right.columns.indexOf(rightKey);
  if (li < 0 || ri < 0) throw new Error('Choose a valid join column from each table.');
  const L = left.rows, R = right.rows, used = new Set(), rows = [];
  const nullL = Array(left.columns.length).fill(null), nullR = Array(right.columns.length).fill(null);
  for (const l of L) {
    const matches = R.map((r,i)=>({r,i})).filter(x => l[li] !== '' && x.r[ri] !== '' && l[li] != null && x.r[ri] != null && String(l[li]) === String(x.r[ri]));
    if (matches.length) for (const m of matches) { used.add(m.i); rows.push({cells:[...l,...m.r],kind:'matched'}); }
    else if (kind === 'LEFT' || kind === 'FULL') rows.push({cells:[...l,...nullR],kind:'left-only'});
  }
  if (kind === 'RIGHT' || kind === 'FULL') R.forEach((r,i)=>{ if (!used.has(i)) rows.push({cells:[...nullL,...r],kind:'right-only'}); });
  const q = x => `"${String(x).replace(/"/g,'""')}"`;
  const join = {'INNER':'INNER JOIN','LEFT':'LEFT JOIN','RIGHT':'RIGHT JOIN','FULL':'FULL OUTER JOIN'}[kind];
  return { columns:[...left.columns.map(c=>`${left.name}.${c}`),...right.columns.map(c=>`${right.name}.${c}`)], rows,
    sql:`SELECT *\nFROM ${q(left.name)}\n${join} ${q(right.name)}\n  ON ${q(left.name)}.${q(leftKey)} = ${q(right.name)}.${q(rightKey)};` };
}

/** Text-output tools, keyed by registry `key`. */
export const textRunners = {
  minifier: (i, o) => minify(i, o),
  case: (i, o) => caseKeywords(i, o?.letter),
  check: (i) => checkSyntax(i),
  'sql-diff': (i) => diffQueries(i),
  'csv-sql': (i, o) => csvToSql(i, o),
  'json-sql': (i, o) => jsonToSql(i, o),
  'create-table': (i, o) => createTable(i, o),
  'sql-dialect': (i, o) => convertDialect(i, o?.dialect),
  'csv-json': (i) => csvToJson(i)
};
