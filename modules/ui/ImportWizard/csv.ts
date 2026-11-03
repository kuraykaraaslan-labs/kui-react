/**
 * The browser's look at a CSV before it is sent (the server parses it again, RFC 4180): the delimiter (comma, semicolon or tab, counted
 * outside quotes on the first line), the header and the first rows for the mapping step. No type coercion: the target judges values.
 */

export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  const count: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of first) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in count) count[ch] += 1;
  }
  const [best, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0]!;
  return (n > 0 ? best : ',') as ',' | ';' | '\t';
}

/** The first `limit` records (a quoted field may hold the delimiter, quotes and line breaks). */
export function parseCsvPreview(text: string, delimiter: string, limit = 6): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length && rows.length < limit; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (rows.length < limit && (cell !== '' || row.length)) { row.push(cell); if (row.some((c) => c !== '')) rows.push(row); }
  return rows;
}

/** Lower case, letters and digits only: "Device name" and "device_name" match the field `deviceName`. */
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/**
 * The first guess of the mapping: a column whose name matches a field's name or label is mapped to it, a column that starts with one
 * of the target's prefixes is mapped onto itself. Source column → field.
 */
export function guessMapping(columns: readonly string[], fields: ReadonlyArray<{ name: string; label: string }>, prefixes: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const col of columns) {
    if (prefixes.some((p) => col.startsWith(p))) { out[col] = col; continue; }
    const n = norm(col);
    const f = fields.find((x) => !used.has(x.name) && (norm(x.name) === n || norm(x.label) === n));
    if (f) { out[col] = f.name; used.add(f.name); }
  }
  return out;
}

/** A cell as a spreadsheet will not run it as a formula, quoted when needed. */
export function csvCell(value: string): string {
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The template a person fills in: the field names as the header and the example row. */
export function templateCsv(fields: ReadonlyArray<{ name: string; example?: string }>): string {
  return `${fields.map((f) => csvCell(f.name)).join(',')}\r\n${fields.map((f) => csvCell(f.example ?? '')).join(',')}\r\n`;
}
