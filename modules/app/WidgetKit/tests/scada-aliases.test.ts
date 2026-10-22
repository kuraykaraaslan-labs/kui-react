import { describe, it, expect } from 'vitest';
import { SCADA_SYMBOLS, SCADA_SYMBOL_DEFS, type SymbolDef } from '../views/scada-logic';
import {
  FAMILY_ORDER, SECTORS, searchSymbols, symbolAliases, symbolFamilies, symbolFamily, symbolSectors, withinOne, words,
} from '../views/scada-aliases';

const label = (k: string) => (SCADA_SYMBOL_DEFS[k as keyof typeof SCADA_SYMBOL_DEFS] as SymbolDef).label;

describe('the words of the library', () => {
  it('gives every symbol its name, the words of its name and one sector at least', () => {
    expect(SCADA_SYMBOLS).toHaveLength(4);
    for (const k of SCADA_SYMBOLS) {
      const aliases = symbolAliases(k);
      expect(aliases, k).toContain(words(label(k)).join(' '));
      for (const w of words(label(k))) expect(aliases, `${k}: ${w}`).toContain(w);
      expect(symbolSectors(k).length, k).toBeGreaterThan(0);
      for (const s of symbolSectors(k)) expect(SECTORS as readonly string[], `${k}: ${s}`).toContain(s);
    }
  });
  it('gives every symbol a word of its own beyond its name, so a search by another name works', () => {
    for (const k of SCADA_SYMBOLS) {
      const own = new Set(words(label(k)));
      expect(symbolAliases(k).filter((a) => !own.has(a) && a !== words(label(k)).join(' ')).length, k).toBeGreaterThan(0);
    }
  });
  it('knows every family of the registry and no other', () => {
    expect(new Set(symbolFamilies())).toEqual(new Set(SCADA_SYMBOLS.map((k) => (SCADA_SYMBOL_DEFS[k] as SymbolDef).family)));
    expect([...symbolFamilies()].sort()).toEqual([...FAMILY_ORDER].sort());
    expect(symbolFamily('home.router')).toBe('home');
  });
  it('answers an empty list for a key the registry does not have', () => {
    expect(symbolAliases('nope.nothing')).toEqual([]);
    expect(symbolSectors('nope.nothing')).toEqual([]);
    expect(symbolFamily('nope.nothing')).toBeUndefined();
  });
  it('lets a symbol serve several sectors', () => {
    expect(symbolSectors('home.camera.security')).toEqual(['home', 'safety', 'city']);
    expect(symbolSectors('home.router')).toEqual(['home', 'telecom']);
    expect(symbolSectors('home.plug.smart')).toEqual(['home', 'energy']);
    expect(symbolSectors('home.tv')).toEqual(['home']);
  });
});

describe('word handling', () => {
  it('lowers case, drops plurals and folds American spellings', () => {
    expect(words('Color Cameras, Switches & Boxes')).toEqual(['colour', 'camera', 'switch', 'box']);
    expect(words('Wi-Fi P&ID  (x)')).toEqual(['wi', 'fi', 'p&id', 'x']);
    expect(words('pass glass bus gas')).toEqual(['pass', 'glass', 'bus', 'gas']);
  });
  it('knows one edit', () => {
    expect(withinOne('camera', 'camrea')).toBe(true);
    expect(withinOne('router', 'ruoter')).toBe(true);
    expect(withinOne('television', 'televison')).toBe(true);
    expect(withinOne('plug', 'plugs')).toBe(true);
    expect(withinOne('plug', 'router')).toBe(false);
    expect(withinOne('abc', 'abcde')).toBe(false);
  });
});

describe('searching', () => {
  const first: Array<[string, string]> = [
    ['tv', 'home.tv'], ['television', 'home.tv'], ['router', 'home.router'], ['wifi', 'home.router'], ['access point', 'home.router'],
    ['camera', 'home.camera.security'], ['cctv', 'home.camera.security'], ['smart plug', 'home.plug.smart'], ['outlet', 'home.plug.smart'],
    ['socket', 'home.plug.smart'], ['video', 'home.camera.security'],
  ];
  it.each(first)('finds %s first: %s', (query, expected) => {
    expect(searchSymbols(query)[0]).toBe(expected);
  });

  it('puts the right symbols of a shared word on top', () => {
    expect(searchSymbols('smart').slice(0, 2)).toEqual(expect.arrayContaining(['home.plug.smart', 'home.tv']));
    expect(searchSymbols('wifi').slice(0, 2)).toEqual(expect.arrayContaining(['home.router', 'home.plug.smart']));
  });

  it('forgives a misspelling of five letters or more', () => {
    expect(searchSymbols('ruoter')[0]).toBe('home.router');
    expect(searchSymbols('televison')[0]).toBe('home.tv');
    expect(searchSymbols('surveilance')[0]).toBe('home.camera.security');
  });
  it('does not forgive a short word', () => {
    expect(searchSymbols('plgu')).toEqual([]);
    expect(searchSymbols('vt')).toEqual([]);
  });
  it('matches a name that starts with the query while typing', () => {
    expect(searchSymbols('tele')[0]).toBe('home.tv');
    expect(searchSymbols('rou')[0]).toBe('home.router');
    expect(searchSymbols('secu')[0]).toBe('home.camera.security');
  });
  it('finds a symbol by its family or sector words', () => {
    expect(searchSymbols('telecom')).toEqual(['home.router']);
    expect(searchSymbols('urban')).toEqual(['home.camera.security']);
    expect(searchSymbols('electronics')).toHaveLength(4);
  });
  it('lists everything in palette order for an empty query, once each', () => {
    const all = searchSymbols('');
    expect(all).toHaveLength(SCADA_SYMBOLS.length);
    expect(new Set(all).size).toBe(all.length);
    expect(searchSymbols('   ')).toEqual(all);
    expect(searchSymbols('?!')).toEqual(all);
    expect(all).toEqual(SCADA_SYMBOLS);
  });
  it('narrows by family and by sector, with and without a query', () => {
    expect(searchSymbols('', { family: 'home' })).toHaveLength(4);
    expect(searchSymbols('', { sector: 'energy' })).toEqual(['home.plug.smart']);
    expect(searchSymbols('', { sector: 'safety' })).toEqual(['home.camera.security']);
    expect(searchSymbols('camera', { sector: 'home' })[0]).toBe('home.camera.security');
    expect(searchSymbols('camera', { sector: 'telecom' })).toEqual([]);
    expect(searchSymbols('', { family: 'nope' })).toEqual([]);
    expect(searchSymbols('', { sector: 'nope' })).toEqual([]);
  });
  it('has symbols in every sector', () => {
    for (const s of SECTORS) expect(searchSymbols('', { sector: s }).length, s).toBeGreaterThan(0);
  });
  it('finds nothing for a word nothing has', () => {
    expect(searchSymbols('zzzzqq')).toEqual([]);
    expect(searchSymbols('router zzzzqq')).toEqual([]);
  });
  it('takes a locale without changing the English result', () => {
    expect(searchSymbols('router', { locale: 'tr' })).toEqual(searchSymbols('router'));
  });
  it('answers a hundred queries quickly', () => {
    const t = performance.now();
    for (let i = 0; i < 100; i += 1) searchSymbols(['router', 'smart pl', 'camera', 'televi'][i % 4]);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
