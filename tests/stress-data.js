/** Deterministic synthetic inputs for QueryCherry stress tests. No network or real user data. */
export function makeCSV(rows, columns = 3, { duplicateEvery = 0, emptyEvery = 0, wide = false } = {}) {
  const headers = Array.from({ length: columns }, (_, i) => `c${i + 1}`);
  const body = Array.from({ length: rows }, (_, i) => {
    const source = duplicateEvery > 0 && i > 0 && i % duplicateEvery === 0 ? i - 1 : i;
    return headers.map((_, j) => {
      if (emptyEvery > 0 && (i + j) % emptyEvery === 0) return '';
      const value = j === 0 ? `row-${source}` : wide ? `value-${source}-${j}-${'x'.repeat(24)}` : `${source}-${j}`;
      return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    }).join(',');
  });
  return [headers.join(','), ...body].join('\n');
}
export function makeJSON(rows, { nested = false } = {}) {
  return JSON.stringify(Array.from({ length: rows }, (_, i) => nested
    ? ({ id: i, payload: { active: i % 2 === 0, values: [i, i + 1, i + 2] } })
    : ({ id: i, name: `row-${i}`, active: i % 2 === 0 })));
}
export function makeSQL(lines) {
  const a = Array.from({ length: lines }, (_, i) => `SELECT id, name FROM table_${i} WHERE id = ${i};`);
  const b = [...a];
  for (let i = 0; i < Math.min(5, b.length); i++) b[b.length - 1 - i] = `SELECT id, label FROM changed_${i} WHERE id = ${i};`;
  return `${a.join('\n')}\n-- QUERY B --\n${b.join('\n')}`;
}
export function makeJSONDiff(rows) {
  const a = makeJSON(rows);
  const records = Array.from({ length: rows }, (_, i) => ({ id: i, name: i === rows - 1 ? 'changed-last' : `row-${i}`, active: i % 2 === 0 }));
  return `${a}\n-- JSON B --\n${JSON.stringify(records)}`;
}
export function makeTableDiff(rows) {
  return `${makeCSV(rows)}\n-- TABLE B --\n${makeCSV(rows).replace('row-0', 'other-0')}`;
}
export function makeRegexInput(rows) {
  return `/row-[0-9]+/g\n--- TEXT ---\n${Array.from({ length: rows }, (_, i) => `row-${i}`).join(' ')}`;
}
export function makeText(rows) {
  return Array.from({ length: rows }, (_, i) => `  row-${i}    value  `).join('\n');
}
