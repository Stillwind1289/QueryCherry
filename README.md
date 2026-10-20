# QueryCherry

Responsive React + Vite prototype for a browser-first SQL and data toolkit with a cherry-inspired visual identity.

## Run locally
Requires Node.js 18+.

```bash
npm install
npm run dev
npm run build
npm run preview
```

## SQL tool collection
The SQL category is intended to contain SQL Formatter, SQL Minifier, SQL Keyword Case Converter, SQL Syntax Checker, SQL Query Diff, CSV to SQL Converter, JSON to SQL Converter, CREATE TABLE Generator, SQL JOIN Visualizer, and SQL Dialect Converter.

## Important limitations
This is a client-side prototype. The SQL syntax checker uses structural heuristics and is not a full dialect-aware parser. Dialect conversion is best-effort and must be reviewed manually. CSV/JSON-generated SQL uses a placeholder table name that must be changed before execution. Do not run generated SQL against production data without review.

All pasted data should remain in the browser. No database connection is configured.

## Audit handoff
See `CLAUDE_AUDIT_PROMPT.md` for the detailed requirements and validation checklist for a production-readiness pass.
