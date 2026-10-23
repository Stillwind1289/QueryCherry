# Browser benchmark guide

This page measures the actual QueryCherry JavaScript functions in a browser. It is separate from Node.js benchmarks.

## Run it

1. Open the project in GitHub Codespaces or on a laptop with Node.js 20.19+.
2. In the project terminal run `npm install` once, then `npm run dev -- --host 0.0.0.0`.
3. Open the Vite URL shown in the terminal and append `/tests/browser/stress-bench.html` (for example, `http://localhost:5173/tests/browser/stress-bench.html`).
4. Start with **100 rows** on a phone. Use **1,000 rows** after the small run behaves normally. Use **5,000 rows** preferably on a laptop.
5. Wait for the report, then select **Download JSON report** and save it to `reports/` in the repository if desired.
6. Repeat only if the browser remained responsive. Record device model, OS, browser/version, other apps open, and whether the tab reloaded.

## Safety

- The browser page uses generated fake inputs only.
- Regex input is a fixed, simple linear pattern. Do not paste arbitrary patterns into automated stress tests.
- SQL diff is capped at 200 lines per query.
- JOIN is capped at 250 rows per side because the current implementation repeatedly scans the right-side rows for each left-side row.
- CSV-to-Chart is capped at 1,000 rows in this browser page because its implementation spreads a numeric array into `Math.min` and `Math.max` calls.
- JavaScript calls run synchronously. A page cannot reliably interrupt a synchronous function that is already stuck. These workload caps are therefore the main safety mechanism.
- `performance.now()` measures elapsed time. `performance.memory` is used only if the browser exposes it (typically Chromium); it measures JavaScript heap, not total browser or device memory. Other browsers will report that memory is unavailable.

## Browser limits

The browser page's maximum is a test workload, not a recommended product limit. A successful test in one phone/browser does not prove the same limit works on other devices. Repeat workloads and check second-operation recovery before setting production caps.
