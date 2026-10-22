import { describe, it, expect } from 'vitest';
import { validate } from '../settings/engine';
import { CORE_FORMAT } from '../settings/core';
import { builtinKind } from '../templates';
import { sampleSources, SAMPLE_GALLERY_BOARD } from '../sample/sample-data';
import { SAMPLE_BOARDS } from '../sample/sample-boards';

const sources = new Map(sampleSources(Date.UTC(2026, 9, 15, 12)).map((s) => [s.key, s.data]));

describe.each([SAMPLE_GALLERY_BOARD, ...SAMPLE_BOARDS].map((b) => [b.board.title, b] as const))('sample board "%s"', (_title, doc) => {
  it.each(doc.placements.map((p) => [p.id, p] as const))('%s: a known type, settings its template keeps unchanged', (_id, p) => {
    const kind = builtinKind(p.type);
    expect(kind, p.type).toBeDefined();
    const { $format, ...own } = (p.settings ?? {}) as Record<string, unknown>;
    const r = validate(kind!.template, own);
    expect(r.issues).toEqual([]);
    expect(r.values).toEqual(own);
    if ($format) {
      const f = validate(CORE_FORMAT, $format as Record<string, unknown>);
      expect(f.issues).toEqual([]);
      expect(f.values).toEqual($format);
    }
  });

  it.each(doc.placements.map((p) => [p.id, p] as const))('%s: bound to existing sample sources of the slot\'s shape', (_id, p) => {
    const slots = builtinKind(p.type)!.slots;
    for (const [slot, key] of Object.entries(p.binding ?? {})) {
      const spec = slots.find((s) => s.key === slot);
      expect(spec, `${p.type} has no slot ${slot}`).toBeDefined();
      const data = sources.get(key as string);
      expect(data, `no sample source ${key}`).toBeDefined();
      expect(data!.shape).toBe(spec!.shape);
    }
    for (const s of slots.filter((x) => x.required)) expect(p.binding, `${p.id} misses ${s.key}`).toHaveProperty(s.key);
  });

  it('fits a 12-column grid without overlaps, with unique ids', () => {
    const cells = new Set<string>();
    expect(new Set(doc.placements.map((p) => p.id)).size).toBe(doc.placements.length);
    for (const p of doc.placements) {
      expect(p.x + p.w, p.id).toBeLessThanOrEqual(12);
      for (let x = p.x; x < p.x + p.w; x++) for (let y = p.y; y < p.y + p.h; y++) {
        expect(cells.has(`${x}:${y}`), `${p.id} overlaps at ${x}:${y}`).toBe(false);
        cells.add(`${x}:${y}`);
      }
    }
  });
});

it('offers the five themed boards with distinct titles', () => {
  expect(SAMPLE_BOARDS).toHaveLength(5);
  expect(new Set(SAMPLE_BOARDS.map((b) => b.board.title)).size).toBe(SAMPLE_BOARDS.length);
});
