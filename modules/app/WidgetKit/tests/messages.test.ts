import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONTROL_MESSAGES } from '@/modules/ui/ControlTile/ControlTile';
import { DEFAULT_CONFIRM_MESSAGES } from '@/modules/ui/ControlTile/ControlConfirm';
import { CONTROL_TILE_MESSAGE_KEYS, DEFAULT_WIDGET_KIT_MESSAGES as D, mergeKitMessages } from '../messages';
import { DEFAULT_SCHEMA_FORM_MESSAGES } from '../../SchemaForm/messages';
import { THEME_COLOR_TOKENS } from '../../SchemaForm/fields/FieldControl';
import { CONTROL_REASONS, controlBlockReason, controlMessages, requestControl } from '../views/control-common';
import { forText } from '../views/StateView';
import { spanText } from '../views/StatSparklineView';
import { validateSchemaValues } from '../../SchemaForm/validate';

describe('WidgetKit messages: the defaults are the English the kit drew before', () => {
  it('controls match ControlTile, ControlConfirm and the kit reasons', () => {
    for (const [k, v] of Object.entries(DEFAULT_CONTROL_MESSAGES)) expect(D.controls[k as keyof typeof D.controls]).toBe(v);
    for (const [k, v] of Object.entries(DEFAULT_CONFIRM_MESSAGES)) expect(D.controls[k as keyof typeof D.controls]).toBe(v);
    expect(CONTROL_REASONS).toEqual({ notConnected: D.controls.notConnected, stale: D.controls.stale, unknown: D.controls.unknown });
    expect(D.controls.notConnected).toBe('Not connected: no command is set for this control.');
    expect(D.controls.reported('21 °C')).toBe('Reported: 21 °C');
    expect([D.controls.run, D.controls.apply, D.controls.outOfRange, D.controls.current]).toEqual(['Run', 'Apply', 'Enter a value between {min} and {max}.', 'Current: {value}']);
  });

  it('function texts give the same strings as before', () => {
    expect(D.card.about('Rooms')).toBe('About Rooms');
    expect(D.card.updated('5 minutes ago')).toBe('Updated 5 minutes ago');
    expect(D.board.replaceConfirm('Plant', 3)).toBe('Replace this dashboard with "Plant" (3 widgets)?');
    expect(D.board.skippedTypes('a, b')).toBe('Skipped unknown widget types: a, b');
    expect(D.editor.retiredNote(3, 'Heading')).toBe('No longer used; removed in v3. Replaced by Heading.');
    expect(D.editor.retiredNote(3)).toBe('No longer used; removed in v3.');
    expect(D.table.pageOf(2, null)).toBe('Page 2');
    expect(D.table.pageOf(2, 5)).toBe('Page 2 of 5');
    expect(D.table.range(1, 10, 42)).toBe('1–10 of 42');
    expect(D.viewer.startFailed('')).toBe('The 3D viewer could not start.');
    expect(D.viewer.loadFailed(1, 'x')).toBe('The model could not be loaded. x');
    expect(D.viewer.loadFailed(2, 'x')).toBe('The models could not be loaded. x');
    expect(D.viewer.loadingModels(1, 3)).toBe('Loading models (1 of 3)…');
    expect(D.content.embedRefused('evil.example')).toBe('Pages from evil.example may not be embedded here. An administrator can add the site to the allowed embed sites.');
    expect(D.stat.trend(null, 4, '1', '2')).toBe('Trend, 4 points, from 1 to 2');
    expect(D.stat.trend('3 h', 4, '1', '2')).toBe('Trend over 3 h, 4 points, from 1 to 2');
    expect(D.stat.progress('5', '10', '50 %')).toBe('5 of 10, 50 %');
    expect(D.stat.progress('5', null, null)).toBe('5');
    expect(forText(30_000)).toBe('just now');
    expect(forText(12 * 60_000)).toBe('for 12 min');
    expect(forText(3 * 3_600_000)).toBe('for 3 h');
    expect(forText(72 * 3_600_000)).toBe('for 3 d');
    expect(spanText(45 * 60_000)).toBe('45 min');
    expect(spanText(12 * 3_600_000)).toBe('12 h');
    expect(spanText(72 * 3_600_000)).toBe('3 d');
    expect(D.form.required('Name')).toBe('Name is required');
    expect(D.form.resetLabel('Size')).toBe('Reset Size to default');
  });

  it('every theme swatch has a message whose default is the swatch label', () => {
    expect(THEME_COLOR_TOKENS.map((t) => t.label)).toEqual([
      D.form.colorPrimary, D.form.colorSecondary, D.form.colorSuccess, D.form.colorInfo, D.form.colorWarning, D.form.colorError,
      D.form.colorText, D.form.colorMutedText, D.form.colorStrongBorder, D.form.colorRaisedSurface, D.form.colorSunkenSurface,
    ]);
    expect(D.form).toBe(DEFAULT_SCHEMA_FORM_MESSAGES);
  });
});

describe('mergeKitMessages', () => {
  it('returns the defaults without input', () => {
    expect(mergeKitMessages()).toBe(D);
    expect(mergeKitMessages({})).toEqual(D);
  });

  it('merges per group; undefined keeps the default; other groups stay', () => {
    const m = mergeKitMessages({ card: { refresh: 'Yenile', retry: undefined }, form: { reset: 'Sıfırla' } });
    expect(m.card.refresh).toBe('Yenile');
    expect(m.card.retry).toBe('Retry');
    expect(m.card.noData).toBe('No data');
    expect(m.form.reset).toBe('Sıfırla');
    expect(m.form.clear).toBe('Clear');
    expect(m.table).toBe(D.table);
    expect(D.card.refresh).toBe('Refresh');
  });
});

describe('control texts from the host', () => {
  const host = mergeKitMessages({ controls: { notConnected: 'Bağlı değil', stale: 'Eski', unknown: 'Bilinmiyor', pending: 'Gönderiliyor…', failed: 'Olmadı', confirmPrompt: 'Emin misiniz?' } }).controls;

  it('words the reasons', async () => {
    expect(controlBlockReason({ onControl: undefined }, [], false, host)).toBe('Bağlı değil');
    const onControl = async () => {};
    expect(controlBlockReason({ onControl, stale: true }, ['stale'], false, host)).toBe('Eski');
    expect(controlBlockReason({ onControl }, ['unknown'], true, host)).toBe('Bilinmiyor');
    expect(controlBlockReason({ onControl, controlDisabledReason: 'Host says no' }, [], false, host)).toBe('Host says no');
    await expect(requestControl(undefined, 'run', host)()).rejects.toThrow('Bağlı değil');
    await expect(requestControl(undefined, 'run')()).rejects.toThrow(CONTROL_REASONS.notConnected);
  });

  it('layers host < policy < feedback, and leaves out host texts equal to the defaults', () => {
    expect(controlMessages({}, undefined, D.controls)).toBeUndefined();
    expect(controlMessages({}, undefined, host)).toEqual({ pending: 'Gönderiliyor…', failed: 'Olmadı', confirmPrompt: 'Emin misiniz?' });
    expect(controlMessages({}, { confirmPrompt: 'Restart the pump?' }, host)?.confirmPrompt).toBe('Restart the pump?');
    expect(controlMessages({ confirmQuestion: 'Really?', pendingText: 'Wait' }, { confirmPrompt: 'Restart the pump?' }, host))
      .toMatchObject({ confirmPrompt: 'Really?', pending: 'Wait', failed: 'Olmadı' });
    // The kit's own labels and reasons never reach ControlTile's messages.
    expect(Object.keys(controlMessages({}, undefined, { ...host, on: 'Açık', reported: () => 'x' } as typeof host) ?? {}))
      .toEqual(expect.not.arrayContaining(['on', 'reported', 'notConnected']));
    expect(CONTROL_TILE_MESSAGE_KEYS).not.toContain('notConnected');
  });
});

describe('validateSchemaValues', () => {
  it('words the required message', () => {
    const schema = { name: { label: 'Ad', type: 'text' as const, required: true } };
    expect(validateSchemaValues(schema, {})).toEqual({ name: 'Ad is required' });
    expect(validateSchemaValues(schema, {}, { required: (l) => `${l} gerekli` })).toEqual({ name: 'Ad gerekli' });
  });
});

describe('messages.ts stays pure (next-boilerplate copies it into a server tree)', () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, rel), 'utf8');
  const imports = (src: string) => [...src.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);

  it.each([['../messages.ts'], ['../../SchemaForm/messages.ts'], ['../views/control-common.ts'], ['../localize.ts']])('%s imports no React and no component', (file) => {
    const src = read(file);
    for (const spec of imports(src)) {
      expect(spec).not.toMatch(/^react(-dom)?$/);
      expect(spec).not.toMatch(/\.tsx$/);
      expect(spec).not.toMatch(/(Context|View|Card|Board|Editor|Tile|Canvas|FieldControl|SchemaForm)$/);
    }
    expect(src).not.toMatch(/['"]use client['"]/);
  });
});
