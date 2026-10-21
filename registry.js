// Tool registry (no UI imports so it can be tested in Node). `key` is null for planned tools.
export const categories = [
  ['all', 'All tools'], ['sql', 'SQL'], ['csv', 'CSV & tables'], ['json', 'JSON & API data'], ['clean', 'Data cleaning'],
  ['sheets', 'Spreadsheets'], ['visual', 'Visualization'], ['compare', 'Compare & diff'], ['dev', 'Developer tools']
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
Mia,19,`;

// [id, title, description, category, color, key, action label, input label, sample]
const R = (id, title, desc, cat, color, key = null, action = '', label = '', sample = '') => ({ id, title, desc, cat, color, key, action, label, sample });

export const registry = [
  R('sql-format', 'SQL Formatter', 'Format common SQL clauses with compact, consistent indentation.', 'sql', 'coral', 'formatter', 'Format SQL', 'SQL input', sqlSample),
  R('sql-minify', 'SQL Minifier', 'Collapse whitespace while leaving strings and quoted names untouched. Comments are kept unless you remove them.', 'sql', 'orange', 'minifier', 'Minify SQL', 'SQL input', sqlSample),
  R('sql-case', 'SQL Keyword Case Converter', 'Change SQL keywords to uppercase or lowercase outside strings, quoted names and comments.', 'sql', 'purple', 'case', 'Convert case', 'SQL input', sqlSample),
  R('sql-check', 'SQL Syntax Checker', 'Lightweight heuristic checks for common structural mistakes. Not a full parser.', 'sql', 'green', 'check', 'Check SQL', 'SQL input', sqlSample),
  R('sql-diff', 'SQL Query Diff', 'Line diff of two queries. Separate them with a line containing only -- QUERY B --.', 'sql', 'coral', 'sql-diff', 'Compare queries', 'Query A, separator line, then query B', 'SELECT id\nFROM users;\n-- QUERY B --\nSELECT id, name\nFROM users;'),
  R('csv-sql', 'CSV to SQL Converter', 'Convert CSV headers and rows into INSERT statements.', 'sql', 'blue', 'csv-sql', 'Convert to SQL', 'CSV input', csvSample),
  R('json-sql', 'JSON to SQL Converter', 'Convert an array of flat JSON records into INSERT statements.', 'sql', 'purple', 'json-sql', 'Convert to SQL', 'JSON input', '[{"name":"Ava","age":21,"active":true},{"name":"Noah","age":24,"active":false,"note":null}]'),
  R('create-table', 'CREATE TABLE Generator', 'Generate CREATE TABLE from a validated list of columns.', 'sql', 'green', 'create-table', 'Generate table', 'Table name, then one column per line', 'users\nid INTEGER PRIMARY KEY\nname VARCHAR(100) NOT NULL\nactive BOOLEAN DEFAULT TRUE\ncreated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
  R('sql-join', 'SQL JOIN Visualizer', 'Edit two CSV tables, choose matching columns, and compare INNER, LEFT, RIGHT and FULL joins.', 'sql', 'orange', 'sql-join'),
  R('sql-dialect', 'SQL Dialect Converter', 'Rewrite a few well-understood constructs for another database and flag the rest.', 'sql', 'purple', 'sql-dialect', 'Convert dialect', 'SQL input', "SELECT IFNULL(name, 'n/a') AS `name`, NOW()\nFROM `users`\nORDER BY id\nLIMIT 10 OFFSET 20;"),
  R('csv-view', 'CSV Viewer', 'Preview CSV rows and columns.', 'csv', 'green', 'csv-view', 'Preview CSV', 'CSV input', csvSample),
  R('csv-json', 'CSV to JSON', 'Convert CSV rows into a JSON array of strings.', 'csv', 'blue', 'csv-json', 'Convert to JSON', 'CSV input', csvSample),
  R('json-format', 'JSON Formatter', 'Beautify and validate JSON data.', 'json', 'purple', 'json-format', 'Format JSON', 'JSON input', '{"name":"Ava","items":[1,2,3]}'),
  R('json-diff', 'JSON Diff', 'Compare two JSON values.', 'json', 'coral', 'json-diff', 'Compare JSON', 'JSON A, separator, then JSON B', '{\n  "name": "Ava"\n}\n-- JSON B --\n{\n  "name": "Ava",\n  "active": true\n}'),
  R('clean-duplicates', 'Duplicate Finder', 'Find repeated rows in a dataset.', 'clean', 'yellow', 'clean-duplicates', 'Find duplicates', 'CSV input', 'id,name\n1,Ava\n2,Noah\n1,Ava'),
  R('sheet-tools', 'Spreadsheet Helpers', 'Trim whitespace in spreadsheet CSV data.', 'sheets', 'green', 'sheet-tools', 'Clean CSV', 'CSV input', 'name,city\n Ava , Jaipur \n Noah , New York '),
  R('chart-csv', 'CSV to Chart', 'Create a text-based numeric summary and bar preview from CSV.', 'visual', 'blue', 'chart-csv', 'Summarize data', 'CSV input', 'month,revenue\nJan,12\nFeb,18\nMar,15'),
  R('table-diff', 'Table Comparator', 'Compare CSV rows in two datasets.', 'compare', 'orange', 'table-diff', 'Compare tables', 'CSV A, separator, then CSV B', 'id,name\n1,Ava\n2,Noah\n-- TABLE B --\nid,name\n1,Ava\n3,Mia'),
  R('regex', 'Regex Tester', 'Test a JavaScript regular expression against text.', 'dev', 'purple', 'regex', 'Test regex', 'Regex, separator, then text', '/\\bcat\\b/gi\n--- TEXT ---\nA cat and a caterpillar.'),
  R('json-minify', 'JSON Minifier', 'Compact valid JSON payloads.', 'json', 'yellow', 'json-minify', 'Minify JSON', 'JSON input', '{\n  "name": "Ava",\n  "active": true\n}'),
  R('data-clean', 'Text Cleaner', 'Trim lines, collapse repeated spaces, and remove blank lines.', 'clean', 'coral', 'data-clean', 'Clean text', 'Text input', '  hello    world  \n\n   clean   data  '),
  R('timestamp', 'Timestamp Converter', 'Convert ISO dates and Unix timestamps.', 'dev', 'blue', 'timestamp', 'Convert timestamp', 'Date/time or Unix timestamp', '1767225600')
];

export const SQL_TOOL_IDS = ['sql-format', 'sql-minify', 'sql-case', 'sql-check', 'sql-diff', 'csv-sql', 'json-sql', 'create-table', 'sql-join', 'sql-dialect'];
