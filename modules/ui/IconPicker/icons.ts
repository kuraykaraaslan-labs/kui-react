// modules/ui/IconPicker/icons.ts
//
// The icon set behind IconPicker: the whole Font Awesome solid pack, imported
// lazily the first time a picker opens (one shared promise for every picker on
// the page), plus name parsing, search and the recent choices. No React.

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type SolidIcon = {
  /** Canonical Font Awesome name: `industry`, `house`. */
  name: string;
  /** Older and alternative names the pack lists for the glyph (`home` for `house`); searched too. */
  terms: string[];
  icon: IconDefinition;
};

let cache: SolidIcon[] | null = null;
let byName: Map<string, SolidIcon> | null = null;
let pending: Promise<SolidIcon[]> | null = null;

/** The whole solid set, sorted by name. The first call starts the import; later calls share it. */
export function loadSolidIcons(): Promise<SolidIcon[]> {
  if (cache) return Promise.resolve(cache);
  // `/index`, not the bare name: an app whose bundler rewrites the bare specifier to one file per icon
  // (modularizeImports) has no file for a namespace import. The package exports `./index` as the same entry.
  pending ??= import('@fortawesome/free-solid-svg-icons/index')
    .then((mod) => {
      const map = new Map<string, SolidIcon>();
      // The pack exports legacy aliases beside the canonical names; both carry the same `iconName`.
      for (const def of Object.values(mod.fas) as IconDefinition[]) {
        if (map.has(def.iconName)) continue;
        const terms = (def.icon[2] ?? []).filter((t): t is string => typeof t === 'string' && t !== def.iconName);
        map.set(def.iconName, { name: def.iconName, terms, icon: def });
      }
      byName = new Map(map);
      for (const entry of map.values()) for (const t of entry.terms) if (!byName.has(t)) byName.set(t, entry);
      cache = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      return cache;
    })
    .catch((err: unknown) => {
      pending = null;
      throw err;
    });
  return pending;
}

/** The set when it is already loaded, else null. */
export function loadedSolidIcons(): SolidIcon[] | null {
  return cache;
}

/** `fas fa-industry`, `fa-solid fa-industry`, `fa-industry` and `industry` all give `industry`. */
export function iconNameOf(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/^fa[a-z-]*\s+/, '').replace(/^fa-/, '');
}

/** The value IconPicker hands back: `fas fa-<name>`. */
export function iconValueOf(name: string): string {
  return `fas fa-${name}`;
}

/** A loaded icon by its canonical or older name (`home` finds `house`), or undefined. */
export function findSolidIcon(name: string): SolidIcon | undefined {
  return byName?.get(name);
}

/**
 * Matches every word of the query against the name and the alternative names; the best matches come first
 * (exact name, name start, inside the name, alternative name), then recent choices, then by name.
 */
export function searchIcons(icons: SolidIcon[], query: string, recent: string[] = []): SolidIcon[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/^fa-/, ''));
  const recentRank = new Map(recent.map((n, i) => [n, i]));
  if (!words.length) {
    const first = recent.map((n) => icons.find((i) => i.name === n)).filter((i): i is SolidIcon => !!i);
    const seen = new Set(first.map((i) => i.name));
    return [...first, ...icons.filter((i) => !seen.has(i.name))];
  }
  const scored: Array<{ icon: SolidIcon; score: number }> = [];
  for (const icon of icons) {
    let score = 0;
    let ok = true;
    for (const w of words) {
      let s: number;
      if (icon.name === w) s = 0;
      else if (icon.name.startsWith(w)) s = 1;
      else if (icon.name.includes(w)) s = 2;
      else if (icon.terms.some((t) => t === w)) s = 3;
      else if (icon.terms.some((t) => t.includes(w))) s = 4;
      else { ok = false; break; }
      score += s;
    }
    if (ok) scored.push({ icon, score });
  }
  return scored
    .sort((a, b) =>
      a.score - b.score
      || (recentRank.get(a.icon.name) ?? Infinity) - (recentRank.get(b.icon.name) ?? Infinity)
      || a.icon.name.localeCompare(b.icon.name))
    .map((s) => s.icon);
}

const RECENT_KEY = 'kui:icon-picker:recent';
const RECENT_MAX = 16;
let recentMemory: string[] | null = null;

/** Recent choices, newest first: kept in memory and, where storage works, in localStorage. */
export function readRecentIcons(): string[] {
  if (recentMemory) return recentMemory;
  let list: string[] = [];
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX);
  } catch {
    // Private mode, blocked storage or a broken entry: start empty.
  }
  recentMemory = list;
  return list;
}

export function rememberIcon(name: string): string[] {
  const next = [name, ...readRecentIcons().filter((n) => n !== name)].slice(0, RECENT_MAX);
  recentMemory = next;
  try {
    globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the memory copy still serves this page.
  }
  return next;
}

/** Forget the recent choices (tests, sign-out). */
export function clearRecentIcons(): void {
  recentMemory = null;
  try {
    globalThis.localStorage?.removeItem(RECENT_KEY);
  } catch {
    // Nothing to clear.
  }
}
