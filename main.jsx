
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Braces, ChartNoAxesCombined, Check, ChevronDown,
  Code2, Copy, Database, FileJson, FileSpreadsheet,
  GitCompareArrows, Heart, Menu, Minimize2, Paintbrush, Play,
  ShieldCheck, Sparkles, Table2, WandSparkles, X, Zap
} from 'lucide-react';
import { categories as cats, registry } from './lib/registry.js';
import { runTool } from './lib/runners.js';
import { joinSample, JOIN_LEFT, JOIN_RIGHT, TARGETS } from './lib/sql.js';
import './styles.css';

const icons = {
  'sql-format': Database, 'sql-minify': Minimize2, 'sql-case': Paintbrush, 'sql-check': ShieldCheck,
  'sql-diff': GitCompareArrows, 'csv-sql': FileSpreadsheet, 'json-sql': FileJson, 'create-table': Database,
  'sql-join': GitCompareArrows, 'sql-dialect': Code2, 'csv-view': Table2, 'csv-json': FileSpreadsheet,
  'json-format': FileJson, 'json-diff': GitCompareArrows, 'clean-duplicates': Sparkles, 'sheet-tools': FileSpreadsheet,
  'chart-csv': ChartNoAxesCombined, 'table-diff': GitCompareArrows, regex: Code2, 'json-minify': Minimize2,
  'data-clean': WandSparkles, timestamp: Zap
};

// Index layout kept for the JSX below: [id, title, description, category, Icon, color, status, key]
const tools = registry.map(r => [r.id, r.title, r.desc, r.cat, icons[r.id] || Code2, r.color, r.key ? 'Ready' : undefined, r.key]);

const DIALECT_LABELS = { generic: 'Generic / ANSI', postgresql: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite', sqlserver: 'SQL Server' };

function JoinVisualizer() {
  const [kind, setKind] = useState('LEFT');
  const res = useMemo(() => joinSample(kind), [kind]);
  const Table = ({ t }) => (
    <div className="jv-table">
      <strong>{t.name}</strong>
      <table><thead><tr>{t.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody></table>
    </div>
  );
  return (
    <div className="jv">
      <div className="jv-tabs" role="group" aria-label="Join type">
        {['INNER', 'LEFT', 'RIGHT', 'FULL'].map(k => (
          <button key={k} className={kind === k ? 'selected' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === 'FULL' ? 'FULL OUTER' : k}
          </button>
        ))}
      </div>
      <div className="jv-sources"><Table t={JOIN_LEFT} /><Table t={JOIN_RIGHT} /></div>
      <pre className="filled" aria-label="Join SQL">{res.sql}</pre>
      <div className="jv-table jv-result">
        <strong>Result ({res.rows.length} rows)</strong>
        <div className="jv-scroll">
          <table>
            <thead><tr>{res.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {res.rows.map((r, i) => (
                <tr key={i} className={'jv-' + r.kind}>
                  {r.cells.map((v, j) => <td key={j}>{v === null ? <em>NULL</em> : String(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="jv-legend">
        Rows with <em>NULL</em> have no match on the other side: Mia has no orders, and order 103 points to user 4, who does not exist.
        This is a fixed demonstration on sample tables (joined on users.id = orders.user_id); it does not run your SQL.
      </p>
    </div>
  );
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
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [letter, setLetter] = useState('upper');
  const [copied, setCopied] = useState(false);
  const [dialect, setDialect] = useState('generic');
  const [tableName, setTableName] = useState('');
  const [stripComments, setStripComments] = useState(false);

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
    setQuery(registry.find(r => r.id === id).sample);
    setDialect(next[7] === 'sql-dialect' ? 'postgresql' : 'generic');
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
      const output = runTool(selected[7], query, {
        letter,
        dialect,
        stripComments,
        table: tableName.trim() || undefined
      });

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
                  aria-pressed={cat === c[0]}
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
                    className={'tool-card' + (t[7] ? '' : ' planned')}
                    key={t[0]}
                    onClick={() => openTool(t[0])}
                    disabled={!t[7]}
                    aria-disabled={!t[7]}
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

          {selected[7] === 'sql-join' ? <JoinVisualizer /> : (
          <div className="editors">
            <section className="editor">
              <div className="panel-head">
                <b>Input</b>
                <button
                  onClick={() => {
                    setQuery(registry.find(r => r.id === tool).sample);
                    setResult('');
                    setError('');
                    setCopied(false);
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
                aria-label={registry.find(r => r.id === tool).label}
              />

              <div className="editor-actions">
                {['formatter', 'csv-sql', 'json-sql', 'create-table', 'sql-dialect'].includes(selected[7]) && (
                  <label className="opt">
                    {selected[7] === 'sql-dialect' ? 'Target' : 'Dialect'}
                    <select value={dialect} onChange={e => setDialect(e.target.value)}>
                      {(selected[7] === 'sql-dialect' ? TARGETS : Object.keys(DIALECT_LABELS)).map(d => (
                        <option key={d} value={d}>{DIALECT_LABELS[d]}</option>
                      ))}
                    </select>
                  </label>
                )}
                {['csv-sql', 'json-sql'].includes(selected[7]) && (
                  <label className="opt">
                    Table name
                    <input value={tableName} onChange={e => setTableName(e.target.value)} placeholder="your_table" spellCheck="false" />
                  </label>
                )}
                {selected[7] === 'minifier' && (
                  <label className="opt">
                    <input type="checkbox" checked={stripComments} onChange={e => setStripComments(e.target.checked)} /> Remove comments
                  </label>
                )}
                {selected[7] === 'case' && (
                  <select value={letter} onChange={e => setLetter(e.target.value)} aria-label="Keyword case">
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
                  {registry.find(r => r.id === tool).action}
                </button>
              </div>
            </section>

            <section className="editor">
              <div className="panel-head">
                <b>Output</b>
                <button onClick={copy} disabled={!result}>
                  {copied ? '✓ Copied' : <><Copy size={13} /> Copy result</>}
                </button>
              </div>

              {error && (
                <p role="alert" style={{ color: '#c0392b', padding: '12px' }}>
                  {error}
                </p>
              )}

              <pre className={result ? 'filled' : ''} aria-live="polite" aria-label="Result">
                {result || (error ? 'Fix the input and try again.' : 'Your result will appear here…')}
              </pre>

              <div className="output-foot">
                {result ? `${result.length} characters` : 'Run the tool to see your output'}
              </div>
            </section>
          </div>
          )}

          <div className="note">
            <ShieldCheck />
            <div>
              <strong>Keep your data yours.</strong>
              <p>
                {{
                  'csv-json': 'CSV conversion happens locally in your browser. All values are returned as strings.',
                  'csv-sql': 'Runs locally in your browser. Empty cells become NULL; other values are quoted strings. Replace the placeholder table name before running anything.',
                  'json-sql': 'Runs locally in your browser. Nested objects are rejected. Replace the placeholder table name before running anything.',
                  check: 'This is a lightweight heuristic check, not a SQL parser. A clean result does not guarantee that your database will accept the query.',
                  'sql-dialect': 'Only a few constructs are rewritten (identifier quotes, IFNULL, NOW, LIMIT/FETCH). Everything else is flagged or left as is. Review the result; it is not guaranteed to behave identically.',
                  'create-table': 'Types and constraints are checked against a fixed allow-list. Types are not translated between databases; confirm them for yours.',
                  minifier: 'Comments are kept unless you tick Remove comments. Strings and quoted names are never changed.',
                  'sql-join': 'A fixed demonstration on sample tables; it does not run your SQL.'
                }[selected[7]] || 'Runs locally in your browser. Test important queries against your own database and dialect before production use.'}
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
