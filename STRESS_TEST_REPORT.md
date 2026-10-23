# QueryCherry stress-test report

Generated: 2026-10-23T02:42:53.379Z

## What was actually run

- Runtime: Node v22.16.0 on linux x64.
- Scale profile: 66 cases; 66 ok; 0 incorrect; 0 errors; 0 over budget.
- Workloads were generated from deterministic synthetic data. No real user data was used.
- This is a Node.js benchmark, not a browser or smartphone benchmark.
- Memory was not measured. Node process heap metrics would not represent total browser/device memory.
- The scale profile uses 1,000 / 5,000 / 10,000 logical rows for row-oriented tools, except SQL JOIN which is capped at 10 / 100 / 250 rows per side. SQL Query Diff is capped at 200 lines per query. CSV to Chart is capped by the generator behavior at 10,000 rows.
- Timing budget: 5,000 ms per case for this run. The harness checks after synchronous calls complete; it cannot interrupt a hung operation.

## Results by registered tool

| Tool ID | Largest logical workload tested | Largest input (bytes) | Slowest observed case (ms) | Result | Notes |
|---|---:|---:|---:|---|---|
| `sql-format` | 1,000 | 35,779 | 104.879 | PASS | Generated SQL up to 1,000 lines; largest input about 36 KB. |
| `sql-minify` | 1,000 | 35,779 | 17.984 | PASS | Generated SQL up to 1,000 lines; largest input about 36 KB. |
| `sql-case` | 1,000 | 35,779 | 1.996 | PASS | Generated SQL up to 1,000 lines; largest input about 36 KB. |
| `sql-check` | 1,000 | 35,779 | 2.659 | PASS | Generated SQL up to 1,000 lines; largest input about 36 KB. |
| `sql-diff` | 1,000 | 14,163 | 6.935 | PASS | Both queries capped at 200 lines; input does not grow to 10,000 lines. |
| `csv-sql` | 10,000 | 226,678 | 20.336 | PASS | Generated 10,000 CSV rows; full SQL output materialized in memory. |
| `json-sql` | 10,000 | 442,781 | 24.927 | PASS | Generated 10,000 flat JSON records; full SQL output materialized in memory. |
| `create-table` | 1,000 | 415 | 0.918 | PASS | Column count capped at 20; this is not a 10,000-column test. |
| `sql-join` | 250 | 9,642 | 2.533 | PASS | Only 250 rows per side; current join implementation scans the right side for each left row. |
| `sql-dialect` | 1,000 | 88 | 0.475 | PASS | Registry sample only; 1k/5k/10k labels do not mean the SQL input grew. |
| `csv-view` | 10,000 | 226,678 | 11.547 | PASS | Generated 10,000 CSV rows; rendered output previews only first 100 rows. |
| `csv-json` | 10,000 | 226,678 | 12.598 | PASS | Generated 10,000 CSV rows; full JSON output materialized. |
| `json-format` | 10,000 | 442,781 | 5.127 | PASS | Generated 10,000 JSON records. |
| `json-diff` | 10,000 | 935,584 | 27.975 | PASS | Generated two 10,000-record JSON values; line-based diff output materialized. |
| `clean-duplicates` | 10,000 | 226,692 | 4.861 | PASS | Generated 10,000 CSV rows with one repeated row appended. |
| `sheet-tools` | 10,000 | 226,678 | 8.001 | PASS | Generated 10,000 CSV rows. |
| `chart-csv` | 10,000 | 107,791 | 4.047 | PASS | Generated 10,000 numeric rows; chart output builds bars as text. |
| `table-diff` | 10,000 | 453,373 | 20.267 | PASS | Compared two generated 10,000-row CSV tables. |
| `regex` | 10,000 | 88,916 | 2.565 | PASS | Generated 10,000 matching tokens with fixed safe regex only. |
| `json-minify` | 10,000 | 442,781 | 3.703 | PASS | Generated 10,000 JSON records. |
| `data-clean` | 10,000 | 218,889 | 2.806 | PASS | Generated 10,000 lines of text. |
| `timestamp` | 1,000 | 10 | 0.558 | PASS | Single timestamp sample; row count does not apply. |

## Existing regression suite

The current full suite has 59 tests: 55 pass and 4 fail. All four failures are assertions in the SQL Dialect Converter tests that expect compatibility comments/disclaimers. `convertDialect()` currently explicitly documents that compatibility notes are intentionally not added to SQL output, while the registry description says it will flag unsupported constructs and `WARNINGS` is declared but unused. This is a genuine contract mismatch between code, description and tests. I did not change converter output or rewrite the tests without an explicit product decision about whether warnings belong in returned SQL or in separate UI metadata.

## What these results establish

- All 66 scale-profile cases completed with passing tool-specific correctness checks in this Node environment.
- The largest generated row workload exercised by the harness was 10,000 rows for row-oriented tools, with actual input sizes shown above.
- The slowest observed case in this run is available in each row above; times are environment-specific and are not phone predictions.
- These results do not establish reliable maximums, browser memory limits, or public-beta caps. Repeated browser testing is still required.

## Provisional beta policy

- Keep the existing 5 MiB per-file upload restriction until actual browser testing supports a change.
- Do not present 10,000 rows as a guaranteed capacity. It is only the largest tested workload for the applicable Node cases.
- SQL JOIN needs a small initial cap and explicit fan-out protection before increasing capacity; the current algorithm has nested scanning behavior.
- CSV to Chart needs further testing because it computes `Math.min(...values)` / `Math.max(...values)` with spread arguments, which can hit engine argument limits on large columns.
- Regex tests must use safe known patterns; JavaScript cannot safely interrupt a catastrophic regex running synchronously in the same thread.
- A browser harness is included at `tests/browser/stress-bench.html`. Run it using Vite as described in `reports/BROWSER_BENCHMARK_GUIDE.md`.

## Files added or changed

- `tests/stress-data.js` — reusable deterministic generators.
- `tests/stress-data.test.js` — generator correctness tests.
- `tests/stress-bench.js` — added bounded `scale` profile.
- `tests/browser/stress-bench.html` and `tests/browser/stress-bench.js` — browser-run benchmark page using actual project modules.
- `package.json` — `bench:scale` and browser instruction helper scripts.
- `reports/stress-baseline-node.json`, `reports/stress-moderate-node.json`, `reports/stress-scale-node.json` — generated run reports.
- `reports/STRESS_TEST_REPORT.md` — this report.
