# Claude handoff: QueryCherry production-readiness audit

You are auditing the attached QueryCherry React/Vite project. Preserve the existing cherry-inspired branding and responsive UI where practical. Do not merely describe issues: inspect the whole repository, fix issues, and return a complete corrected project/archive when possible.

## Product scope: SQL category must contain these 10 tools
1. SQL Formatter
2. SQL Minifier
3. SQL Keyword Case Converter
4. SQL Syntax Checker
5. SQL Query Diff
6. CSV to SQL Converter
7. JSON to SQL Converter
8. CREATE TABLE Generator
9. SQL JOIN Visualizer
10. SQL Dialect Converter

## Mandatory workflow
- First inspect every source file, package.json, Vite config, and workflow.
- Run `npm install` and `npm run build`; fix all syntax, lint/build, and runtime issues you can reproduce.
- Add automated tests (prefer Vitest or another lightweight compatible test runner) for each of the ten tools, including valid inputs, empty input, malformed input, and edge cases.
- Verify tool registry IDs map to real implementations; no SQL tool may silently fall through to an unrelated default action.
- Test keyboard navigation, mobile widths, copy functionality, clear/reset/sample behavior, and accessible labels.
- Ensure user data is processed locally unless the code explicitly documents otherwise. Never add analytics, secrets, API keys, or network upload of pasted SQL/data.

## Correctness/security requirements
- SQL minification/case conversion must not alter quoted strings, quoted identifiers, or comments unexpectedly. Document comment-removal behavior.
- CSV parser must support escaped quotes, CRLF, commas and newlines inside quoted fields, BOM, uneven row lengths, duplicate headers, and empty cells.
- CSV/JSON SQL output must correctly escape strings and identifiers, handle null/booleans/numbers, reject or explicitly handle nested JSON, and clearly identify the generated table-name placeholder.
- CREATE TABLE generation must validate identifiers and avoid unsafe arbitrary SQL injection through user-entered types/constraints; support the chosen dialect clearly.
- Syntax checker must distinguish lightweight heuristics from a real dialect-aware parser. Do not claim complete validation if it is heuristic.
- Query diff should compare two inputs robustly and clearly mark added/removed/changed lines.
- JOIN visualizer should provide an accurate, understandable interactive explanation of INNER, LEFT, RIGHT, and FULL OUTER joins, including unmatched rows and NULLs; don't claim it executes arbitrary SQL unless it really does.
- Dialect converter must only perform transformations it can justify, identify unsupported/ambiguous constructs, and never imply semantic equivalence where it cannot guarantee it.
- Fix React warnings, error states, unsafe rendering, duplicate declarations, and all broken imports.

## Deliverables
1. Corrected full project source.
2. Passing production build.
3. Automated test suite and exact test commands/results.
4. Updated README with setup, tool limitations, supported dialects, and deployment notes.
5. Short audit report listing fixed issues and known limitations.
6. A ZIP of the corrected project, excluding node_modules and secrets.

Do not claim tests passed unless you actually ran them. If a tool cannot be made reliable within the available dependencies, make that limitation explicit and leave a safe, honest implementation rather than faking success.
