import { describe, it, expect } from 'vitest';
import { resolveLocale } from './index';

/**
 * The Turkish calendar locale is complete: every text of the English bundle has a Turkish one, and none is left as the English (the
 * message functions are compared on sample arguments). A text that is the same in both languages on purpose (a code, a name, a unit)
 * goes in ALLOWED_SAME with the reason; nothing needs it today.
 */
const ALLOWED_SAME: Record<string, string> = {};

const SAMPLE_ARGS: unknown[][] = [[0], [1], [3], ['5 Mar', 0], ['5 Mar', 1], ['5 Mar', 3], ['Mart 2026']];

function texts(bundle: object): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') out.set(path, value);
    else if (typeof value === 'function') {
      for (const args of SAMPLE_ARGS.filter((a) => a.length === value.length)) out.set(`${path}(${args.join(', ')})`, String(value(...args)));
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(bundle, '');
  return out;
}

describe('Calendar Turkish locale', () => {
  const en = texts(resolveLocale('en'));
  const tr = texts(resolveLocale('tr'));

  it('has every text of the English bundle', () => {
    expect(en.size).toBeGreaterThan(40);
    expect([...en.keys()].filter((k) => !tr.has(k))).toEqual([]);
  });

  it('leaves no text in English', () => {
    expect([...en].filter(([k, v]) => tr.get(k) === v && !(k in ALLOWED_SAME)).map(([k]) => k)).toEqual([]);
  });
});
