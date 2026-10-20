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
  R('sql-format', 'SQL Formatter', 'Format SQL with consistent indentation and readable clauses.', 'sql', 'coral', 'formatter', 'Format SQL', 'SQL input', sqlSample),
  R('sql-minify', 'SQL Minifier', 'Collapse whitespace while leaving strings and quoted names untouched. Comments are kept unless you remove them.', 'sql', 'orange', 'minifier', 'Minify SQL', 'SQL input', sqlSample),
  R('sql-case', 'SQL Keyword Case Converter', 'Change SQL keywords to uppercase or lowercase outside strings, quoted names and comments.', 'sql', 'purple', 'case', 'Convert case', 'SQL input', sqlSample),
  R('sql-check', 'SQL Syntax Checker', 'Lightweight heuristic checks for common structural mistakes. Not a full parser.', 'sql', 'green', 'check', 'Check SQL', 'SQL input', sqlSample),
  R('sql-diff', 'SQL Query Diff', 'Line diff of two queries. Separate them with a line containing only -- QUERY B --.', 'sql', 'coral', 'sql-diff', 'Compare queries', 'Query A, separator line, then query B', 'SELECT id\nFROM users;\n-- QUERY B --\nSELECT id, name\nFROM users;'),
  R('csv-sql', 'CSV to SQL Converter', 'Convert CSV headers and rows into INSERT statements.', 'sql', 'blue', 'csv-sql', 'Convert to SQL', 'CSV input', csvSample),
  R('json-sql', 'JSON to SQL Converter', 'Convert an array of flat JSON records into INSERT statements.', 'sql', 'purple', 'json-sql', 'Convert to SQL', 'JSON input', '[{"name":"Ava","age":21,"active":true},{"name":"Noah","age":24,"active":false,"note":null}]'),
  R('create-table', 'CREATE TABLE Generator', 'Generate CREATE TABLE from a validated list of columns.', 'sql', 'green', 'create-table', 'Generate table', 'Table name, then one column per line', 'users\nid INTEGER PRIMARY KEY\nname VARCHAR(100) NOT NULL\nactive BOOLEAN DEFAULT TRUE\ncreated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
  R('sql-join', 'SQL JOIN Visualizer', 'See which rows INNER, LEFT, RIGHT and FULL joins keep, using sample tables.', 'sql', 'orange', 'sql-join'),
  R('sql-dialect', 'SQL Dialect Converter', 'Rewrite a few well-understood constructs for another database and flag the rest.', 'sql', 'purple', 'sql-dialect', 'Convert dialect', 'SQL input', "SELECT IFNULL(name, 'n/a') AS `name`, NOW()\nFROM `users`\nORDER BY id\nLIMIT 10 OFFSET 20;"),
  R('csv-view', 'CSV Viewer', 'Preview CSV rows and columns.', 'csv', 'green'),
  R('csv-json', 'CSV to JSON', 'Convert CSV rows into a JSON array of strings.', 'csv', 'blue', 'csv-json', 'Convert to JSON', 'CSV input', csvSample),
  R('json-format', 'JSON Formatter', 'Beautify and validate JSON data.', 'json', 'purple'),
  R('json-diff', 'JSON Diff', 'Compare two JSON values.', 'json', 'coral'),
  R('clean-duplicates', 'Duplicate Finder', 'Find repeated rows in a dataset.', 'clean', 'yellow'),
  R('sheet-tools', 'Spreadsheet Helpers', 'Make common row and column tasks easier.', 'sheets', 'green'),
  R('chart-csv', 'CSV to Chart', 'Turn a dataset into a quick visual summary.', 'visual', 'blue'),
  R('table-diff', 'Table Comparator', 'Compare two datasets.', 'compare', 'orange'),
  R('regex', 'Regex Tester', 'Test regular expressions against sample text.', 'dev', 'purple'),
  R('json-minify', 'JSON Minifier', 'Compact JSON payloads.', 'json', 'yellow'),
  R('data-clean', 'Text Cleaner', 'Trim and normalize pasted text.', 'clean', 'coral'),
  R('timestamp', 'Timestamp Converter', 'Convert common timestamp formats.', 'dev', 'blue')
];

export const SQL_TOOL_IDS = ['sql-format', 'sql-minify', 'sql-case', 'sql-check', 'sql-diff', 'csv-sql', 'json-sql', 'create-table', 'sql-join', 'sql-dialect'];
