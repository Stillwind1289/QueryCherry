import { format as formatSQL } from 'sql-formatter';
import { textRunners } from './sql.js';

const LANG = { generic: 'sql', postgresql: 'postgresql', mysql: 'mysql', sqlite: 'sqlite', sqlserver: 'transactsql' };

function formatter(input, { dialect = 'generic' } = {}) {
  if (!input.trim()) throw new Error('Paste a SQL query first.');
  const out = formatSQL(input, { language: LANG[dialect] ?? 'sql', tabWidth: 2, keywordCase: 'upper', linesBetweenQueries: 1 });
  return out.replace(/\b(LEFT|RIGHT|FULL|INNER|OUTER|CROSS|NATURAL)\s*\n\s*JOIN\b/gi, (_, j) => `${j.toUpperCase()} JOIN`);
}

/** key -> (input, options) => string. Unknown keys are an error, never a silent default. */
export const runners = { ...textRunners, formatter };
export function runTool(key, input, options) {
  const fn = runners[key];
  if (!fn) throw new Error(`No implementation is registered for "${key}".`);
  return fn(input, options);
}
