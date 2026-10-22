// Search words and sector tags of the process symbols, for the diagram editor's palette (pure, no React). Every symbol
// of the registry is findable by the word people use ("tv", "wifi", "cctv", "outlet"), not by its key. English only:
// the Turkish names are a later native pass; `locale` is already a parameter so the callers do not change then.
//
// Three layers of words feed one symbol: its own table row (`SYMBOL_ROWS`), the words of its group (`CONCEPTS`: every
// symbol that has the token `camera` in its key or name gets "vision" and "video") and its family. Sector tags come
// from the family, the group and the row; a symbol serves several sectors (a security camera is home, city and safety).

import { SCADA_SYMBOLS, SCADA_SYMBOL_DEFS, type ScadaFamily, type SymbolDef } from './scada-logic';

export const SECTORS = ['home', 'telecom', 'energy', 'safety', 'city'] as const;
export type SceneSector = (typeof SECTORS)[number];

/** The families in the order the palette lists them (the symbol picker's order). */
export const FAMILY_ORDER: readonly ScadaFamily[] = ['home'];

/** What a family or a sector is called when someone types it ("home electronics", "telecom"). */
const FAMILY_WORDS: Record<ScadaFamily, string> = {
  home: 'home consumer electronics',
};
const SECTOR_WORDS: Record<SceneSector, string> = {
  home: 'home household consumer electronics appliances', telecom: 'telecom data centre', energy: 'energy renewable', safety: 'safety fire gas detection',
  city: 'city urban',
};
/** The sectors a family serves by itself. */
const FAMILY_SECTORS: Record<ScadaFamily, SceneSector[]> = {
  home: ['home'],
};

// ─── The words ───────────────────────────────────────────────────────────────

interface Row { words: string[]; sectors: SceneSector[] }

/** `'a, b, c | s1 s2'`: search words, then (after the bar) sectors this symbol serves besides its family's. */
function parse(spec: string): Row {
  const [w, s = ''] = spec.split('|');
  return {
    words: w.split(',').map((x) => x.trim()).filter(Boolean),
    sectors: s.split(/\s+/).filter((x): x is SceneSector => (SECTORS as readonly string[]).includes(x)),
  };
}

/**
 * The first word of a row is the symbol's plain name: typed alone it is an exact match ("tv" finds the television
 * first). The others are other names for it. Spelling follows the registry's English; American spellings are folded in
 * `words`.
 */
const SYMBOL_ROWS: Record<string, string> = {
  'home.tv': 'television, tv, smart tv, screen, display | home',
  'home.router': 'wi-fi router, wifi, home gateway, access point | home telecom',
  'home.camera.security': 'security camera, cctv, ip camera, surveillance camera, cam | home city safety',
  'home.plug.smart': 'smart plug, smart socket, wifi plug, outlet, power monitor | home energy',
};

/**
 * Words of a group: they go to every symbol that has the token in its key or its name (unless it also has a token of
 * `unless`). A group may add sectors too.
 */
interface Concept { when: string[]; unless?: string[]; words: string[]; sectors?: SceneSector[] }
const CONCEPTS: Concept[] = [
  { when: ['camera'], words: ['vision', 'video'] },
];

/** American spellings folded into the registry's British ones, on both sides of a search. */
const SPELLING: Record<string, string> = {
  center: 'centre', color: 'colour', fiber: 'fibre', gray: 'grey',
};

// ─── Words and matching ──────────────────────────────────────────────────────

/** Lower case words: letters and digits (`p&id` keeps its mark), a plural dropped, American spelling folded. */
export function words(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9&]+/)) {
    let w = raw.replace(/^&+|&+$/g, '');
    if (!w) continue;
    if (w.length > 4 && /(ch|sh|x|ss)es$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
    out.push(SPELLING[w] ?? w);
  }
  return out;
}

const phrase = (text: string): string => words(text).join(' ');

/** Whether two words differ by one edit (a letter changed, added, dropped, or two neighbours swapped). */
export function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  const d = a.length - b.length;
  if (d > 1 || d < -1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (d === 0) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return d === 1 ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

interface Entry {
  key: string;
  family: ScadaFamily;
  /** The name, normalised. */
  label: string;
  labelWords: string[];
  keyWords: string[];
  /** The row's own phrases, normalised; the first is the plain name. */
  rowPhrases: string[];
  /** The row's and the group's phrases together. */
  phrases: string[];
  phraseWords: Set<string>;
  familyWords: Set<string>;
  sectorWords: Set<string>;
  sectors: SceneSector[];
  order: number;
}

let CACHE: Map<string, Entry> | null = null;

function build(): Map<string, Entry> {
  const map = new Map<string, Entry>();
  SCADA_SYMBOLS.forEach((key, order) => {
    const def = SCADA_SYMBOL_DEFS[key] as SymbolDef;
    const labelWords = words(def.label);
    const keyWords = words(key.replace(/\./g, ' '));
    const row = parse(SYMBOL_ROWS[key] ?? '');
    const tokens = new Set([...keyWords, ...labelWords]);
    const has = (list: string[]) => list.some((t) => tokens.has(words(t)[0]));
    const sectors = new Set<SceneSector>([...FAMILY_SECTORS[def.family], ...row.sectors]);
    const groupWords: string[] = [];
    for (const c of CONCEPTS) {
      if (!has(c.when) || (c.unless && has(c.unless))) continue;
      groupWords.push(...c.words);
      for (const s of c.sectors ?? []) sectors.add(s);
    }
    const rowPhrases = row.words.map(phrase).filter(Boolean);
    const phrases = [...new Set([...rowPhrases, ...groupWords.map(phrase).filter(Boolean)])];
    // A symbol always serves at least one sector: the one of its family, else home.
    const list = SECTORS.filter((s) => sectors.has(s));
    const own = list.length ? list : (['home'] as SceneSector[]);
    map.set(key, {
      key, family: def.family, label: phrase(def.label), labelWords, keyWords, rowPhrases, phrases,
      phraseWords: new Set(phrases.flatMap((p) => p.split(' '))),
      familyWords: new Set(words(FAMILY_WORDS[def.family])),
      sectorWords: new Set(own.flatMap((s) => words(SECTOR_WORDS[s]))),
      sectors: own,
      order,
    });
  });
  return map;
}

const entries = (): Map<string, Entry> => (CACHE ??= build());

/** Every search word of a symbol: its name, the words of its name, then the words of its row and its group. Lower case. */
export function symbolAliases(key: string): string[] {
  const e = entries().get(key);
  if (!e) return [];
  return [...new Set([e.label, ...e.labelWords, ...e.phrases])];
}

/** The sectors a symbol serves (always at least one), in the order of `SECTORS`. Empty for a key the registry lacks. */
export function symbolSectors(key: string): SceneSector[] {
  return entries().get(key)?.sectors.slice() ?? [];
}

/** The words people type for a sector (`telecom` = "telecom data centre"). */
export const sectorWords = (s: SceneSector): string => SECTOR_WORDS[s];

/** The families of the registry that have symbols, in palette order. */
export function symbolFamilies(): ScadaFamily[] {
  const have = new Set([...entries().values()].map((e) => e.family));
  return FAMILY_ORDER.filter((f) => have.has(f));
}

/** The family of a symbol key, or undefined for a key the registry does not have. */
export const symbolFamily = (key: string): ScadaFamily | undefined => entries().get(key)?.family;

export interface SearchOptions {
  /** Reserved for the native-language pass; only English words exist today. */
  locale?: string;
  family?: string;
  sector?: string;
}

const best = (word: string, pool: Iterable<string>, exact: number, prefix: number): number => {
  let score = 0;
  for (const p of pool) {
    if (p === word) return exact;
    if (p.startsWith(word)) score = Math.max(score, prefix);
  }
  return score;
};

/** How one entry matches the query; 0 = it does not. */
function score(e: Entry, q: string, tokens: string[]): number {
  let tier = 0;
  if (e.label === q) tier = 1000;
  else if (e.rowPhrases[0] === q) tier = 900;
  else if (e.label.startsWith(q)) tier = 800;
  else if (e.rowPhrases.includes(q)) tier = 700;
  else if (e.rowPhrases.some((p) => p.startsWith(q))) tier = 600;
  else if (e.label.includes(q)) tier = 120;
  else if (e.phrases.some((p) => p.includes(q))) tier = 80;
  let sum = 0;
  for (const t of tokens) {
    let s = Math.max(
      best(t, e.labelWords, 40, 30), best(t, e.phraseWords, 30, 22), best(t, e.keyWords, 20, 15), best(t, e.familyWords, 10, 6), best(t, e.sectorWords, 8, 5),
    );
    if (!s && t.length >= 5) {
      const near = [...e.labelWords, ...e.phraseWords, ...e.keyWords].some((w) => w.length >= 5 && withinOne(t, w));
      if (near) s = 5;
    }
    if (!s) return 0;
    sum += s;
  }
  return tier + sum;
}

/**
 * The symbol keys that match `query`, best first: the exact name, then the plain-name word, a name that starts with the
 * query, another name of it, then every query word found in the names, words, family and sector (a word of five letters
 * or more is forgiven one edit). Equal scores keep the shorter name first, then the registry's order. An empty query
 * lists everything in palette order. `family` and `sector` narrow the result.
 */
export function searchSymbols(query: string, opts: SearchOptions = {}): string[] {
  const q = phrase(query);
  const tokens = q ? q.split(' ') : [];
  const all = [...entries().values()].filter((e) => (!opts.family || e.family === opts.family) && (!opts.sector || (e.sectors as string[]).includes(opts.sector)));
  if (!tokens.length) {
    const rank = (e: Entry) => FAMILY_ORDER.indexOf(e.family);
    return all.sort((a, b) => rank(a) - rank(b) || a.order - b.order).map((e) => e.key);
  }
  return all
    .map((e) => ({ e, s: score(e, q, tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.e.label.length - b.e.label.length || a.e.order - b.e.order)
    .map((r) => r.e.key);
}
