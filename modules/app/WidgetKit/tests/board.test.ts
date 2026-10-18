import { describe, it, expect } from 'vitest';
import { exportBoard, importBoard, nextFreeRow, type BoardDocument } from '../settings/board';
import { toCsvText, resolvePlacement } from '../settings/resolve';
import { STAT_VALUE_KIND } from '../templates/stat-value';

const kinds = [STAT_VALUE_KIND];
const doc: BoardDocument = {
  format: 'widgetkit.board', version: 1, templates: {},
  board: { title: 'Plant', settings: { rowHeight: 56, cardVariant: 'outline' } },
  placements: [
    { id: 'a', type: 'stat.value', title: 'Temp', x: 0, y: 0, w: 3, h: 2,
      settings: { label: 'Boiler', valueColor: '#ff0000', $card: { radius: 4, background: 'color', backgroundColor: 'rgba(0,0,0,0.5)' }, $format: { unit: '°C' } },
      binding: { value: { sourceKey: 'x', queryKey: 'y' } } },
  ],
};

describe('board document (D-21.4: the dashboard carries every card)', () => {
  it('exports every card with stamped settings and a templates manifest, and imports it back identically', () => {
    const out = exportBoard(doc, kinds);
    expect(out.templates).toEqual({ 'core:board': 1, 'builtin:stat.value': 1, 'core:card': 1, 'core:format': 1 });
    expect(out.placements[0].settings.$v).toEqual({ 'builtin:stat.value': 1, 'core:card': 1, 'core:format': 1 });
    expect(out.placements[0].binding).toEqual(doc.placements[0].binding);
    const back = importBoard(JSON.stringify(out), kinds);
    if ('error' in back) throw new Error(back.error);
    expect(back.doc).toEqual(out);
    expect(back.issues).toEqual([]);
  });

  it('refuses a newer format or newer templates with a clear message', () => {
    expect(importBoard(JSON.stringify({ ...doc, version: 9 }), kinds)).toEqual({
      error: 'This dashboard was exported by a newer version (format 9). Update this app to import it.', code: 'newer-format', detail: '9',
    });
    const newer = { ...doc, placements: [{ ...doc.placements[0], settings: { $v: { 'builtin:stat.value': 4 } } }] };
    expect(importBoard(JSON.stringify(newer), kinds)).toEqual({
      error: 'This dashboard uses newer widget settings (builtin:stat.value v4). Update this app to import it.',
      code: 'newer-templates', detail: 'builtin:stat.value v4',
    });
    expect(importBoard('nope', kinds)).toEqual({ error: 'This file is not valid JSON.', code: 'invalid-json' });
    expect(importBoard('{"format":"other"}', kinds)).toEqual({ error: 'This file is not a dashboard export.', code: 'not-board' });
  });

  it('names an untitled board "Dashboard", or the host\'s default title', () => {
    const untitled = JSON.stringify({ ...doc, board: { ...doc.board, title: '  ' } });
    const en = importBoard(untitled, kinds);
    const tr = importBoard(untitled, kinds, { defaultTitle: 'Pano' });
    if ('error' in en || 'error' in tr) throw new Error('refused');
    expect(en.doc.board.title).toBe('Dashboard');
    expect(tr.doc.board.title).toBe('Pano');
    const titled = importBoard(JSON.stringify(doc), kinds, { defaultTitle: 'Pano' });
    if ('error' in titled) throw new Error(titled.error);
    expect(titled.doc.board.title).toBe('Plant');
  });

  it('drops unknown types and bad values, clamps geometry', () => {
    const bad = { ...doc, placements: [
      { id: 'a', type: 'stat.value', title: 'x', x: 11, y: -3, w: 6, h: 99, settings: { valueColor: 'url(evil)' } },
      { id: 'b', type: 'warp.drive', title: 'y', x: 0, y: 0, w: 1, h: 1, settings: {} },
    ] };
    const res = importBoard(JSON.stringify(bad), kinds);
    if ('error' in res) throw new Error(res.error);
    expect(res.unknownTypes).toEqual(['warp.drive']);
    expect(res.doc.placements[0]).toMatchObject({ x: 6, y: 0, w: 6, h: 48 });
    expect(res.doc.placements[0].settings).not.toHaveProperty('valueColor');
    expect(res.issues[0].path).toBe('placements.0.valueColor');
  });

  it('places a new card under the others', () => expect(nextFreeRow(doc.placements)).toBe(2));
});

describe('resolvePlacement', () => {
  it('layers board card defaults under the widget type and the placement', () => {
    const r = resolvePlacement({ template: STAT_VALUE_KIND.template, slotCount: 2, settings: doc.placements[0].settings, board: doc.board.settings });
    expect(r.card.variant).toBe('outline');
    expect(r.card.radius).toBe(4);
    expect(r.format).toMatchObject({ unit: '°C', decimals: 0 });
    expect(r.settings.label).toBe('Boiler');
    expect(r.caps).toEqual({ hasData: true, exportable: false, formatsNumbers: true });
  });
});

describe('CSV', () => {
  it('quotes and neutralises formulas', () => {
    expect(toCsvText([['a', 'b,c'], ['=1+1', 'say "hi"']])).toBe('a,"b,c"\r\n\'=1+1,"say ""hi"""');
  });
});
