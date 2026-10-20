# QueryCherry audit report

## How this was verified (and what was not)
- **Run:** 57 unit tests via `npm test` (Node 22 built-in runner), all passing. A deliberate bug injected into the tokenizer made 4 of them fail, so they do detect regressions.
- **Run:** the app's JSX was syntax-checked and bundled with esbuild, then driven in headless Chromium at 1280px and 375px: all 10 SQL tools opened, ran their sample, rejected empty input with an error, restored via "Load sample"; JOIN tabs gave 2/4/3/5 rows (INNER/LEFT/RIGHT/FULL); planned cards are disabled; no horizontal overflow; no React warnings or runtime errors.
- **NOT run:** `npm install`, `npm run build` (Vite) and the real `sql-formatter` and `lucide-react` packages. The audit sandbox had no network. The browser run used stubs for those two packages, so **SQL Formatter's real output is untested here**. Run `npm install && npm test && npm run build` once yourself and commit the lockfile.
- **NOT done:** screen-reader testing, real-device testing, clipboard test (the clipboard API is not available in the sandbox; the failure path shows an error message).

## Bugs fixed (reproduced before fixing where noted)
1. **Keyword Case Converter did nothing.** (reproduced) `String.match` with a global regex has no `.index`, so no keyword ever matched. Rewritten on a tokenizer.
2. **Minifier could create a comment.** (reproduced) `1 - -1` became `1--1`. Spacing rules now keep `- -`, `/ *`, `* /` and adjacent string literals apart.
3. **Dialect converter corrupted strings and deleted code.** (reproduced) It rewrote quotes inside string literals and replaced everything after `RETURNING`, including later code and comments, with a comment. Now only code outside strings/comments is touched; unsupported constructs are flagged, not removed.
4. **CREATE TABLE injection.** Only `;`, `--`, `/*` were blocked, so `INT, evil TEXT` or a subquery default passed. Now type and constraints are matched against an allow-list; anything else is rejected.
5. **Samples/default input wrong for 4 tools.** Opening CSV→SQL, JSON→SQL, CREATE TABLE or Query Diff loaded a SELECT sample and errored immediately. Each tool now has its own sample.
6. **JOIN Visualizer was static text.** Now an interactive demo with NULLs and unmatched rows highlighted.
7. **Query Diff was positional.** One inserted line marked every later line as changed. Now an LCS diff.
8. **CSV:** BOM before a quoted header broke quoting; rows of only empty cells were silently dropped; the parser was duplicated in two functions; duplicate-header check was case-sensitive only.
9. **Syntax checker false positives** (`SELECT fromage`), checks run on text inside strings/comments, `[ ]` treated as brackets; added trailing-comma, empty `IN ()`, CASE/END checks.
10. **Quoting:** values/identifiers were always ANSI-quoted. Added MySQL/SQL Server identifier quoting, MySQL backslash doubling, 1/0 booleans for SQL Server/SQLite, NUL rejection, validated table-name input.
11. **UI/a11y:** planned tools looked clickable but did nothing (now disabled); wrong `aria-label` on non-SQL inputs; category buttons lacked `aria-pressed`; result region not announced; emoji removed from panel headings; unused/incorrect button-label chain replaced by registry data; unknown tool keys now throw instead of silently doing something else.
12. **Build config:** `latest` for every dependency (non-reproducible), build tools in `dependencies`, no Vite config, no tests, `favicon.png` was 1.1 MB (now 21 KB, resized to 256px wide).

## Known limitations / follow-ups
- No lockfile yet; dependency ranges are my best choice and untested against the registry. Generate and commit `package-lock.json`, then use `npm ci` in CI.
- Syntax Checker and Dialect Converter are heuristic by design (documented in the UI and README).
- Google Fonts is loaded from Google's servers (see README, Privacy).
- Nav items "Pricing"/"QueryCherry Pro" and the footer "Roadmap"/"Contact" point to a placeholder section or a `hello@querycherry.com` address; confirm these before launch.
- Non-SQL tools (CSV Viewer, JSON Formatter, etc.) are still placeholders.
- No browser-level tests are committed (the browser check above was a one-off harness). Adding Playwright/Vitest + Testing Library to the repo is a good next step.
