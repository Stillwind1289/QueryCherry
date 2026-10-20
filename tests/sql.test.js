import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/lib/sql.js';
import { registry, SQL_TOOL_IDS } from '../src/lib/registry.js';

const throwsMsg = (fn, re) => assert.throws(fn, (e) => re.test(e.message));

describe('registry', () => {
  test('exactly the 10 SQL tools are registered in the sql category', () => {
    const ids = registry.filter((t) => t.cat === 'sql').map((t) => t.id);
    assert.deepEqual([...ids].sort(), [...SQL_TOOL_IDS].sort());
    assert.equal(ids.length, 10);
  });
  test('every ready tool key maps to an implementation (formatter is checked separately: needs sql-formatter)', () => {
    const impl = new Set([...Object.keys(S.textRunners), 'formatter', 'sql-join']);
    for (const t of registry.filter((r) => r.key)) assert.ok(impl.has(t.key), `${t.id} -> ${t.key} has no implementation`);
  });
  test('ready text tools have an action label, input label and sample that runs without error', () => {
    for (const t of registry.filter((r) => r.key && !['formatter', 'sql-join'].includes(r.key))) {
      assert.ok(t.action && t.label && t.sample, t.id);
      const opts = { dialect: t.key === 'sql-dialect' ? 'postgresql' : 'generic', letter: 'upper' };
      assert.doesNotThrow(() => S.textRunners[t.key](t.sample, opts), t.id);
    }
  });
});

describe('2 minify', () => {
  test('collapses whitespace, keeps strings and quoted identifiers', () => {
    assert.equal(S.minify("SELECT  a ,\n  'x   y'   FROM \"My  Table\""), "SELECT a,'x   y' FROM \"My  Table\"");
  });
  test('never fuses minus signs into a comment', () => assert.equal(S.minify('select 1 - -1'), 'select 1- -1'));
  test('keeps comments (line comment keeps its newline) and can strip them', () => {
    assert.equal(S.minify('select 1 -- hi\nfrom t'), 'select 1 -- hi\nfrom t');
    assert.equal(S.minify('select /* c */ 1 -- hi\nfrom t', { stripComments: true }), 'select 1 from t');
  });
  test('adjacent string literals are not merged', () => assert.equal(S.minify("select 'a'\n'b'"), "select 'a' 'b'"));
  test('empty and malformed input', () => {
    throwsMsg(() => S.minify('  '), /Paste/);
    throwsMsg(() => S.minify("select 'oops"), /not closed/);
    throwsMsg(() => S.minify('select /* oops'), /not closed/);
  });
  test('doubled quote escape inside string', () => assert.equal(S.minify("select   'it''s'  "), "select 'it''s'"));
});

describe('3 keyword case', () => {
  test('upper and lower', () => {
    assert.equal(S.caseKeywords('select a from t where x = 1', 'upper'), 'SELECT a FROM t WHERE x = 1');
    assert.equal(S.caseKeywords('SELECT A FROM T WHERE X = 1', 'lower'), 'select A from T where X = 1');
  });
  test('does not touch strings, quoted identifiers or comments', () => {
    assert.equal(S.caseKeywords(`select "from", 'where', \`order\` -- select from\nfrom t /* where */`, 'upper'),
      `SELECT "from", 'where', \`order\` -- select from\nFROM t /* where */`);
  });
  test('does not touch keyword fragments inside identifiers', () => {
    assert.equal(S.caseKeywords('select order_id, selected, t.from_date from t', 'upper'), 'SELECT order_id, selected, t.from_date FROM t');
  });
  test('empty and malformed', () => {
    throwsMsg(() => S.caseKeywords(''), /Paste/);
    throwsMsg(() => S.caseKeywords("select 'x"), /not closed/);
  });
});

describe('4 syntax checker (heuristic)', () => {
  test('clean query', () => assert.match(S.checkSyntax('SELECT a FROM t;'), /No obvious structural problems/));
  test('always states it is heuristic', () => assert.match(S.checkSyntax('SELECT a FROM t;'), /not a dialect-aware SQL parser/));
  test('unbalanced parens, trailing comma, missing columns/table', () => {
    assert.match(S.checkSyntax('SELECT (a FROM t'), /not closed/);
    assert.match(S.checkSyntax('SELECT a, FROM t'), /trailing comma/);
    assert.match(S.checkSyntax('SELECT FROM t'), /no column list/);
    assert.match(S.checkSyntax('SELECT a FROM WHERE x=1'), /no table name/);
    assert.match(S.checkSyntax('SELECT a) FROM t'), /Unexpected "\)"/);
  });
  test('brackets and keywords inside strings/comments are ignored', () => {
    assert.match(S.checkSyntax("SELECT '(' FROM t -- )"), /No obvious/);
    assert.match(S.checkSyntax("SELECT 'FROM' AS x FROM t"), /No obvious/);
  });
  test('identifiers starting with keywords are not false positives', () => {
    assert.match(S.checkSyntax('SELECT fromage FROM wherever'), /No obvious/);
  });
  test('empty, comment-only, unterminated', () => {
    throwsMsg(() => S.checkSyntax(''), /Paste/);
    assert.match(S.checkSyntax('-- nothing'), /no SQL code/);
    assert.match(S.checkSyntax("SELECT 'x"), /string literal is not closed/);
  });
  test('CASE/END mismatch', () => assert.match(S.checkSyntax('SELECT CASE WHEN a THEN 1 FROM t'), /CASE\/END/));
});

describe('5 query diff', () => {
  test('marks added, removed, unchanged', () => {
    const out = S.diffQueries('SELECT id\nFROM users;\n-- QUERY B --\nSELECT id, name\nFROM users;');
    assert.match(out, /^1 line\(s\) only in A \("-"\), 1 line\(s\) only in B \("\+"\)/);
    assert.match(out, /- SELECT id\n\+ SELECT id, name\n {2}FROM users;/);
  });
  test('an inserted line does not mark everything after it as changed', () => {
    const out = S.diffQueries('a\nb\nc\n-- QUERY B --\na\nX\nb\nc');
    assert.match(out, /1 line\(s\) only in B/);
    assert.match(out, /0 line\(s\) only in A/);
  });
  test('identical, CRLF, trailing whitespace', () => {
    assert.match(S.diffQueries('a  \r\n-- QUERY B --\r\na\r\n'), /identical/);
  });
  test('one side empty is handled', () => assert.match(S.diffQueries('-- QUERY B --\nSELECT 1'), /0 line\(s\) only in A.*1 line\(s\) only in B/));
  test('missing or duplicate separator, empty input', () => {
    throwsMsg(() => S.diffQueries('SELECT 1'), /exactly one/);
    throwsMsg(() => S.diffQueries('a\n-- QUERY B --\nb\n-- QUERY B --\nc'), /exactly one/);
    throwsMsg(() => S.diffQueries(''), /Paste/);
    throwsMsg(() => S.diffQueries('-- QUERY B --'), /empty/);
  });
});

describe('CSV parser', () => {
  test('quotes, escaped quotes, commas and newlines inside quotes, CRLF', () => {
    const { headers, rows } = S.parseCSV('a,b\r\n"x, y","he said ""hi"""\r\n"line1\nline2",z\r\n');
    assert.deepEqual(headers, ['a', 'b']);
    assert.deepEqual(rows, [['x, y', 'he said "hi"'], ['line1\nline2', 'z']]);
  });
  test('BOM before a quoted header, empty cells, no trailing newline', () => {
    const { headers, rows } = S.parseCSV('\uFEFF"a",b\n,2');
    assert.deepEqual(headers, ['a', 'b']);
    assert.deepEqual(rows, [['', '2']]);
  });
  test('a row of only empty cells is kept; blank lines are skipped', () => {
    assert.deepEqual(S.parseCSV('a,b\n\n,\n').rows, [['', '']]);
  });
  test('uneven rows, duplicate/empty headers, unclosed quote, header only, empty', () => {
    throwsMsg(() => S.parseCSV('a,b\n1'), /Data row 1 has 1 columns/);
    throwsMsg(() => S.parseCSV('a,A\n1,2'), /Duplicate header/);
    throwsMsg(() => S.parseCSV('a,\n1,2'), /needs a header/);
    throwsMsg(() => S.parseCSV('a\n"x'), /not closed/);
    throwsMsg(() => S.parseCSV('a,b'), /at least one data row/);
    throwsMsg(() => S.parseCSV(''), /Paste/);
  });
  test('csvToJson returns strings', () => assert.deepEqual(JSON.parse(S.csvToJson('a,b\n1,x')), [{ a: '1', b: 'x' }]));
});

describe('6 CSV to SQL', () => {
  test('escapes quotes, NULL for empty, placeholder note', () => {
    const out = S.csvToSql('name,note\nO\'Brien,\nAva,"a,b"');
    assert.match(out, /placeholder/);
    assert.match(out, /INSERT INTO "your_table" \("name", "note"\) VALUES \('O''Brien', NULL\);/);
    assert.match(out, /VALUES \('Ava', 'a,b'\);/);
  });
  test('identifier with a quote is escaped; dialect quoting', () => {
    assert.match(S.csvToSql('a"b,c\n1,2'), /\("a""b", "c"\)/);
    assert.match(S.csvToSql('a,c\n1,2', { dialect: 'mysql', table: 'users' }), /INSERT INTO `users` \(`a`, `c`\)/);
    assert.match(S.csvToSql('a,c\n1,2', { dialect: 'sqlserver', table: 'users' }), /\[users\] \(\[a\], \[c\]\)/);
  });
  test('mysql doubles backslashes in values', () => assert.match(S.csvToSql('a\nC:\\x', { dialect: 'mysql' }), /'C:\\\\x'/));
  test('no placeholder note when a table name is given; bad table names rejected', () => {
    assert.doesNotMatch(S.csvToSql('a\n1', { table: 'users' }), /placeholder/);
    throwsMsg(() => S.csvToSql('a\n1', { table: 'x; DROP TABLE y' }), /Table name/);
    throwsMsg(() => S.csvToSql('a\n1', { table: '' }), /Table name/);
  });
  test('malformed and empty', () => {
    throwsMsg(() => S.csvToSql('a,b\n1'), /columns/);
    throwsMsg(() => S.csvToSql(''), /Paste/);
  });
});

describe('7 JSON to SQL', () => {
  test('types: null, booleans, numbers, strings with quotes; missing keys become NULL', () => {
    const out = S.jsonToSql('[{"a":1,"b":true,"c":null,"d":"it\'s"},{"a":2.5,"e":"x"}]');
    assert.match(out, /\("a", "b", "c", "d", "e"\) VALUES \(1, TRUE, NULL, 'it''s', NULL\);/);
    assert.match(out, /VALUES \(2\.5, NULL, NULL, NULL, 'x'\);/);
  });
  test('booleans as 1/0 for sqlserver and sqlite', () => {
    assert.match(S.jsonToSql('[{"a":true,"b":false}]', { dialect: 'sqlserver' }), /VALUES \(1, 0\)/);
    assert.match(S.jsonToSql('[{"a":true}]', { dialect: 'sqlite' }), /VALUES \(1\)/);
  });
  test('nested JSON is rejected explicitly', () => {
    throwsMsg(() => S.jsonToSql('[{"a":{"b":1}}]'), /Record 1, field "a" is nested/);
    throwsMsg(() => S.jsonToSql('[{"a":[1]}]'), /nested/);
  });
  test('invalid JSON, non-array, empty array, array of non-objects, empty objects, empty input', () => {
    throwsMsg(() => S.jsonToSql('{'), /Invalid JSON/);
    throwsMsg(() => S.jsonToSql('{"a":1}'), /non-empty JSON array/);
    throwsMsg(() => S.jsonToSql('[]'), /non-empty JSON array/);
    throwsMsg(() => S.jsonToSql('[1,2]'), /non-empty JSON array/);
    throwsMsg(() => S.jsonToSql('[{}]'), /at least one field/);
    throwsMsg(() => S.jsonToSql(''), /Paste/);
  });
  test('NUL characters rejected', () => throwsMsg(() => S.jsonToSql('[{"a":"x\\u0000y"}]'), /NUL/));
});

describe('8 CREATE TABLE', () => {
  const ok = 'users\nid INTEGER PRIMARY KEY\nname VARCHAR(100) NOT NULL\nbalance numeric(10,2) DEFAULT 0\nnote TEXT DEFAULT \'it\'\'s\'\nactive BOOLEAN DEFAULT true';
  test('valid input, ANSI quoting', () => {
    const out = S.createTable(ok);
    assert.match(out, /CREATE TABLE "users" \(/);
    assert.match(out, /"id" INTEGER PRIMARY KEY,/);
    assert.match(out, /"name" VARCHAR\(100\) NOT NULL,/);
    assert.match(out, /"balance" NUMERIC\(10,2\) DEFAULT 0,/);
    assert.match(out, /DEFAULT 'it''s'/);
    assert.match(out, /DEFAULT TRUE\n\);/);
  });
  test('dialect quoting and dialect-specific keywords', () => {
    assert.match(S.createTable('t\nid INT PRIMARY KEY AUTO_INCREMENT', { dialect: 'mysql' }), /`id` INT PRIMARY KEY AUTO_INCREMENT/);
    throwsMsg(() => S.createTable('t\nid INT AUTO_INCREMENT'), /MySQL-only/);
    throwsMsg(() => S.createTable('t\nid INT AUTOINCREMENT', { dialect: 'mysql' }), /SQLite-only/);
    assert.match(S.createTable('t\nid INT', { dialect: 'sqlserver' }), /\[t\] \(\n {2}\[id\] INT/);
  });
  test('SQL injection attempts in type/constraint are rejected', () => {
    for (const bad of ['INT); DROP TABLE x; --', 'INT, evil TEXT', "TEXT DEFAULT 'a'); DROP TABLE x;--", 'INT /* x */', 'INT REFERENCES other(id)', 'INT CHECK (1=1)', 'TEXT DEFAULT (select 1)', 'MONEY']) {
      assert.throws(() => S.createTable(`t\nc ${bad}`), /Unsupported/, bad);
    }
  });
  test('table and column identifiers are validated', () => {
    throwsMsg(() => S.createTable('bad name\nid INT'), /Table name/);
    throwsMsg(() => S.createTable('t\n1id INT'), /Invalid column/);
    throwsMsg(() => S.createTable('t\nid'), /Invalid column/);
    throwsMsg(() => S.createTable('t\nid INT\nID TEXT'), /Duplicate column/);
  });
  test('no columns, two primary keys, empty input, "table:" prefix', () => {
    throwsMsg(() => S.createTable('t'), /at least one column/);
    throwsMsg(() => S.createTable('t\na INT PRIMARY KEY\nb INT PRIMARY KEY'), /Only one inline PRIMARY KEY/);
    throwsMsg(() => S.createTable(''), /Enter a table name/);
    assert.match(S.createTable('table: users\nid INT'), /CREATE TABLE "users"/);
  });
});

describe('9 JOIN visualizer data', () => {
  const count = (k) => S.joinSample(k).rows;
  test('INNER keeps only matches', () => { const r = count('INNER'); assert.equal(r.length, 2); assert.ok(r.every((x) => x.kind === 'matched')); });
  test('LEFT keeps every user; Mia has NULL order columns', () => {
    const r = count('LEFT'); assert.equal(r.length, 4);
    const mia = r.find((x) => x.cells[1] === 'Mia'); assert.deepEqual(mia.cells.slice(2), [null, null, null]); assert.equal(mia.kind, 'left-only');
  });
  test('RIGHT keeps every order; order 103 has NULL user columns', () => {
    const r = count('RIGHT'); assert.equal(r.length, 3);
    const o = r.find((x) => x.cells[2] === 103); assert.deepEqual(o.cells.slice(0, 2), [null, null]); assert.equal(o.kind, 'right-only');
  });
  test('FULL keeps both kinds of unmatched rows', () => {
    const r = count('FULL'); assert.equal(r.length, 5);
    assert.deepEqual(r.map((x) => x.kind).sort(), ['left-only', 'left-only', 'matched', 'matched', 'right-only'].sort());
  });
  test('unknown join type throws; SQL text matches the type', () => {
    throwsMsg(() => S.joinSample('CROSS'), /Unknown join/);
    assert.match(S.joinSample('FULL').sql, /FULL OUTER JOIN/);
  });
});

describe('10 dialect converter', () => {
  test('strings and comments are never rewritten', () => {
    const out = S.convertDialect("select 'say \"hi\" `x` IFNULL(' as \"x\" -- IFNULL( here\nfrom t", 'mysql');
    assert.match(out, /'say "hi" `x` IFNULL\('/);
    assert.match(out, /-- IFNULL\( here/);
    assert.match(out, /as `x`/);
  });
  test('quote styles per target', () => {
    assert.match(S.convertDialect('select `a` from `t`', 'postgresql'), /select "a" from "t"/);
    assert.match(S.convertDialect('select "a" from "t"', 'sqlserver'), /select \[a\] from \[t\]/);
  });
  test('IFNULL/NOW conversions are reported', () => {
    const out = S.convertDialect('select IFNULL(a, 0), NOW()', 'sqlserver');
    assert.match(out, /COALESCE\(a, 0\), CURRENT_TIMESTAMP/);
    assert.match(out, /-- NOTE: IFNULL\( became COALESCE\(/);
  });
  test('LIMIT/OFFSET <-> FETCH', () => {
    assert.match(S.convertDialect('select a from t order by a limit 10 offset 20', 'sqlserver'), /OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY/);
    assert.match(S.convertDialect('select a from t limit 5', 'sqlserver'), /limit 5/);
    assert.match(S.convertDialect('select a from t limit 5', 'sqlserver'), /NOTE: LIMIT left unchanged/);
    assert.match(S.convertDialect('select a from t order by a offset 20 rows fetch next 10 rows only', 'mysql'), /LIMIT 10 OFFSET 20/);
  });
  test('unsupported constructs are flagged and left intact, trailing code is preserved', () => {
    const out = S.convertDialect('insert into t(a) values (1) returning id; -- keep', 'mysql');
    assert.match(out, /returning id; -- keep/);
    assert.match(out, /NOTE: RETURNING is not supported/);
    assert.match(S.convertDialect("select a ilike 'x'", 'sqlite'), /ILIKE is PostgreSQL-specific/);
    assert.match(S.convertDialect('select a::int', 'mysql'), /"::" casts/);
  });
  test('always disclaims semantic equivalence', () => assert.match(S.convertDialect('select 1', 'sqlite'), /Not guaranteed semantically equivalent/));
  test('bad target, empty and malformed input', () => {
    throwsMsg(() => S.convertDialect('select 1', 'oracle'), /Supported targets/);
    throwsMsg(() => S.convertDialect('', 'mysql'), /Paste/);
    throwsMsg(() => S.convertDialect("select 'x", 'mysql'), /not closed/);
  });
});
