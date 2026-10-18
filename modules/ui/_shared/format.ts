// modules/ui/_shared/format.ts
//
// Small pure helpers shared by the observability components (TraceWaterfall, LogViewer, ServiceMap,
// ConversationTimeline, BurnChart, ...). No React, no DOM, no dependencies.

/** A duration given in milliseconds, as short text: `820 µs`, `12.4 ms`, `1.25 s`, `2 m 5 s`. */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms)) return '–';
  const abs = Math.abs(ms);
  if (abs === 0) return '0 ms';
  if (abs < 1) return `${Math.round(ms * 1000)} µs`;
  if (abs < 10) return `${trim(ms, 2)} ms`;
  if (abs < 1000) return `${trim(ms, 1)} ms`;
  if (abs < 60_000) return `${trim(ms / 1000, 2)} s`;
  if (abs < 3_600_000) {
    const m = Math.floor(abs / 60_000);
    const s = Math.round((abs % 60_000) / 1000);
    return s === 60 ? `${m + 1} m` : s === 0 ? `${m} m` : `${m} m ${s} s`;
  }
  const h = Math.floor(abs / 3_600_000);
  const m = Math.round((abs % 3_600_000) / 60_000);
  return m === 60 ? `${h + 1} h` : m === 0 ? `${h} h` : `${h} h ${m} m`;
}

function trim(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)));
}

/** `1234` -> `1.2k`, `2_500_000` -> `2.5M`. Under 1000 the number is returned as is. */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '–';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Number(n.toFixed(abs < 10 ? 1 : 0)));
  if (abs < 1_000_000) return `${trim(n / 1000, abs < 10_000 ? 1 : 0)}k`;
  if (abs < 1_000_000_000) return `${trim(n / 1_000_000, abs < 10_000_000 ? 1 : 0)}M`;
  return `${trim(n / 1_000_000_000, 1)}B`;
}

/** A fraction or percent with a sensible number of digits: `99.9 %`, `0.05 %`, `100 %`. */
export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '–';
  return `${trim(value, digits)}%`;
}

/** `HH:mm:ss.SSS` for an epoch-ms timestamp (24 h; in `timeZone` when given, else the runtime's). */
export function formatClock(ms: number, timeZone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', ...(timeZone ? { timeZone } : {}),
    }).formatToParts(new Date(ms));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    const frac = String(Math.floor(((ms % 1000) + 1000) % 1000)).padStart(3, '0');
    return `${get('hour')}:${get('minute')}:${get('second')}.${frac}`;
  } catch {
    return new Date(ms).toISOString().slice(11, 23);
  }
}

/** An epoch-ms number, or an ISO string, as epoch ms (`NaN` when unparsable). */
export function toEpochMs(value: number | string): number {
  return typeof value === 'number' ? value : Date.parse(value);
}

/** Escape a string for use inside a RegExp. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split `text` around case-insensitive literal matches of `query`: `[{ text, match }]`. Empty query: one plain part. */
export function splitMatches(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const out: { text: string; match: boolean }[] = [];
  const re = new RegExp(escapeRegExp(q), 'gi');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    if (m.index > last) out.push({ text: text.slice(last, m.index), match: false });
    out.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out.length ? out : [{ text, match: false }];
}

/** Replace `{name}` placeholders in a message template. Unknown placeholders are left in place. */
export function fillMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}
