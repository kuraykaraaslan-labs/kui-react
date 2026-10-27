import { describe, it, expect } from 'vitest';
import { enLocale } from './en';
import { trLocale } from './tr';

/**
 * The Turkish locale is complete: every text of the English locale has a Turkish one, and none is left as the English. A text that is
 * the same in both languages on purpose (a code, a name, a unit) goes in ALLOWED_SAME with the reason.
 */
const ALLOWED_SAME: Record<string, string> = {
  'monthsShort[2]': 'Mar is the Turkish short name of Mart as well as of March.',
  'monthsShort[4]': 'May is the Turkish short name of Mayıs as well as of May.',
};

type Leaf = [path: string, value: unknown];

function leaves(value: unknown, path = ''): Leaf[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, value]];
}

describe('DatePicker Turkish locale', () => {
  const en = new Map(leaves(enLocale));
  const tr = new Map(leaves(trLocale));

  it('has every text of the English locale', () => {
    expect([...en.keys()].filter((k) => !tr.has(k))).toEqual([]);
  });

  it('leaves no text in English', () => {
    const same = [...en].filter(([k, v]) => typeof v === 'string' && tr.get(k) === v && !(k in ALLOWED_SAME)).map(([k]) => k);
    expect(same).toEqual([]);
  });

  it('allows only texts that are still the same', () => {
    expect(Object.keys(ALLOWED_SAME).filter((k) => !en.has(k) || tr.get(k) !== en.get(k))).toEqual([]);
  });
});
