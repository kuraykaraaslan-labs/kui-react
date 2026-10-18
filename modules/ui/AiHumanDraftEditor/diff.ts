// modules/ui/AiHumanDraftEditor/diff.ts
//
// Word-level diff between the human's text and an AI draft, grouped into hunks the reviewer can accept or reject.
// Pure and dependency-free. Words and whitespace runs are separate tokens, so applying a hunk never glues words
// together or loses spacing. Prefix and suffix are trimmed before the LCS table; a middle too large for a table
// (over `MAX_CELLS`) becomes a single replace hunk instead of freezing the page.

export type Hunk = {
  /** Stable across re-diffs of the same change: the content plus its occurrence number. */
  key: string;
  /** The human's text for this stretch (may be empty: the AI inserts). */
  human: string;
  /** The AI's text for this stretch (may be empty: the AI removes). */
  ai: string;
};

export type Segment = { type: 'equal'; text: string } | { type: 'hunk'; hunk: Hunk };

export const MAX_CELLS = 4_000_000;

/** Split into words and whitespace runs: `"a  b"` -> `["a", "  ", "b"]`. */
export function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

type Op = { type: 'equal' | 'delete' | 'insert'; text: string };

function diffTokens(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const ops: Op[] = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'equal', text: a[i] });

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  if (n === 0) for (const t of midB) ops.push({ type: 'insert', text: t });
  else if (m === 0) for (const t of midA) ops.push({ type: 'delete', text: t });
  else if (n * m > MAX_CELLS) {
    for (const t of midA) ops.push({ type: 'delete', text: t });
    for (const t of midB) ops.push({ type: 'insert', text: t });
  } else {
    // LCS lengths from the end, so the walk below runs forward and prefers deletions before insertions.
    const w = m + 1;
    const table = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * w + j] = midA[i] === midB[j] ? table[(i + 1) * w + j + 1] + 1 : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { ops.push({ type: 'equal', text: midA[i] }); i++; j++; }
      else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) { ops.push({ type: 'delete', text: midA[i] }); i++; }
      else { ops.push({ type: 'insert', text: midB[j] }); j++; }
    }
    while (i < n) { ops.push({ type: 'delete', text: midA[i++] }); }
    while (j < m) { ops.push({ type: 'insert', text: midB[j++] }); }
  }
  for (let i = endA; i < a.length; i++) ops.push({ type: 'equal', text: a[i] });
  return ops;
}

/** Segments of the diff: unchanged text, and hunks (a run of deletions and insertions, glued across whitespace-only gaps). */
export function buildSegments(human: string, ai: string): Segment[] {
  if (human === ai) return human ? [{ type: 'equal', text: human }] : [];
  const ops = diffTokens(tokenize(human), tokenize(ai));

  // Group into raw segments.
  type Raw = { type: 'equal'; text: string } | { type: 'change'; human: string; ai: string };
  const raw: Raw[] = [];
  for (const op of ops) {
    const last = raw[raw.length - 1];
    if (op.type === 'equal') {
      if (last?.type === 'equal') last.text += op.text; else raw.push({ type: 'equal', text: op.text });
    } else {
      const target = last?.type === 'change' ? last : (raw.push({ type: 'change', human: '', ai: '' }), raw[raw.length - 1] as Extract<Raw, { type: 'change' }>);
      if (op.type === 'delete') target.human += op.text; else target.ai += op.text;
    }
  }
  // Glue change - whitespace - change into one change, so a rewritten phrase is one hunk.
  const glued: Raw[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const prev = glued[glued.length - 1];
    if (cur.type === 'equal' && /^\s+$/.test(cur.text) && prev?.type === 'change' && raw[i + 1]?.type === 'change') {
      const next = raw[i + 1] as Extract<Raw, { type: 'change' }>;
      prev.human += cur.text + next.human;
      prev.ai += cur.text + next.ai;
      i++;
    } else if (cur.type === 'change' && prev?.type === 'change') {
      prev.human += cur.human;
      prev.ai += cur.ai;
    } else {
      glued.push(cur.type === 'change' ? { ...cur } : cur);
    }
  }

  const seen = new Map<string, number>();
  return glued.map((s) => {
    if (s.type === 'equal') return s;
    const base = `${s.human}\u0000${s.ai}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    return { type: 'hunk', hunk: { key: `${base}#${nth}`, human: s.human, ai: s.ai } } as Segment;
  });
}

/** The text with every hunk resolved by `choose`: 'ai' takes the draft's side, 'human' keeps the person's. */
export function applySegments(segments: readonly Segment[], choose: (hunk: Hunk) => 'ai' | 'human'): string {
  return segments.map((s) => (s.type === 'equal' ? s.text : choose(s.hunk) === 'ai' ? s.hunk.ai : s.hunk.human)).join('');
}

/** The hunks only, in order. */
export function hunksOf(segments: readonly Segment[]): Hunk[] {
  const out: Hunk[] = [];
  for (const s of segments) if (s.type === 'hunk') out.push(s.hunk);
  return out;
}
