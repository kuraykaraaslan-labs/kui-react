import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONTROL_MESSAGES } from '@/modules/ui/ControlTile/ControlTile';
import { DEFAULT_CONFIRM_MESSAGES } from '@/modules/ui/ControlTile/ControlConfirm';
import { CONTROL_TILE_MESSAGE_KEYS, DEFAULT_WIDGET_KIT_MESSAGES as D, issueText, mergeKitMessages } from '../messages';
import { missingRequired, validate } from '../settings/engine';
import { minBelowMax } from '../settings/packs';
import type { Issue, SettingsTemplate } from '../settings/types';
import { positiveStep, safeEmbedRule, safeImageRule, safeLinkRule, safeModelUrlsRule, safeRowLinksRule } from '../views/content-logic';
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

describe('settings issues: a code, and the English message as the issues group words it', () => {
  const T: SettingsTemplate = {
    id: 'tenant:issues', version: 1, namespace: '', label: 'Issues', groups: [], migrations: [],
    fields: {
      on: { label: 'On', type: 'boolean', since: 1 },
      n: { label: 'N', type: 'number', since: 1 },
      lo: { label: 'Lo', type: 'number', min: 2, since: 1 },
      hi: { label: 'Hi', type: 'number', max: 5, since: 1 },
      sel: { label: 'Sel', type: 'select', options: ['a'], since: 1 },
      sel2: { label: 'Sel2', type: 'select', options: ['a'], since: 1 },
      multi: { label: 'Multi', type: 'multi-select', options: ['a'], since: 1 },
      multi2: { label: 'Multi2', type: 'multi-select', options: ['a'], since: 1 },
      color: { label: 'Colour', type: 'color', since: 1 },
      icon: { label: 'Icon', type: 'icon', since: 1 },
      keys: { label: 'Keys', type: 'data-key', multiple: true, since: 1 },
      keys2: { label: 'Keys2', type: 'data-key', multiple: true, max: 1, since: 1 },
      key: { label: 'Key', type: 'data-key', since: 1 },
      font: { label: 'Font', type: 'font', since: 1 },
      rows: { label: 'Rows', type: 'repeater', since: 1, fields: { name: { label: 'Name', type: 'text', required: true } } },
      rows2: { label: 'Rows2', type: 'repeater', max: 1, since: 1, fields: {} },
      text: { label: 'Text', type: 'text', since: 1 },
      short: { label: 'Short', type: 'text', maxLength: 2, since: 1 },
      url: { label: 'Address', type: 'url', since: 1 },
      need: { label: 'Needed', type: 'text', required: true, since: 1 },
    },
  };
  const bad = {
    on: 'x', n: 'x', lo: 1, hi: 9, sel: 1, sel2: 'z', multi: 'x', multi2: ['z'], color: 'nope', icon: 'NOT AN ICON', keys: 'x',
    keys2: ['a', 'b'], key: '\u0001', font: 3, rows: [{}], rows2: [{}, {}], text: 3, short: 'abc', url: 'ftp://x',
  };
  const engineIssues = (): Issue[] => [...validate(T, bad).issues, ...missingRequired(T, {})];

  it('every engine check sets a code, and the default text is its message', () => {
    const issues = engineIssues();
    expect(new Set(issues.map((i) => i.code))).toEqual(new Set([
      'boolean', 'number', 'min', 'max', 'option', 'notOption', 'optionList', 'unknownOption', 'color', 'icon', 'dataKeys',
      'maxKeys', 'dataKey', 'font', 'list', 'maxItems', 'required', 'text', 'maxLength', 'url',
    ].filter((c) => c !== 'list')));
    for (const i of issues) expect(issueText(i, D.issues)).toBe(i.message);
    expect(validate(T, { rows: 'x' }).issues[0]).toMatchObject({ code: 'list', params: { label: 'Rows' } });
    expect(issueText(validate(T, { rows: 'x' }).issues[0], D.issues)).toBe('Rows: must be a list');
  });

  it('the kit rules set a code, and the default text is their message', () => {
    const rules = [
      minBelowMax('min', 'max')({ min: 5, max: 1 }),
      safeLinkRule('href', 'Link')({ href: 'javascript:alert(1)' }),
      safeImageRule('src')({ src: 'data:x' }),
      safeEmbedRule('url')({ url: 'http://10.0.0.1/' }),
      safeRowLinksRule('links', 'href')({ links: [{ href: 'javascript:x' }] }),
      safeModelUrlsRule('models')({ models: [{ url: 'http://x/m.glb' }] }),
      positiveStep('step')({ step: 0 }),
    ].flat();
    expect(rules.map((i) => i.code)).toEqual(['minBelowMax', 'linkTarget', 'imageSrc', 'embedUrl', 'rowLinkTarget', 'modelUrl', 'positiveStep']);
    for (const i of rules) expect(issueText(i, D.issues)).toBe(i.message);
    const withRule = validate({ ...T, fields: { min: { label: 'Min', type: 'number', since: 1 }, max: { label: 'Max', type: 'number', since: 1 } }, rules: [minBelowMax('min', 'max')] }, { min: 3, max: 1 });
    expect(withRule.issues).toEqual([{ path: 'max', message: 'Maximum must be greater than minimum', code: 'minBelowMax' }]);
  });

  it('a host text gets the label (the shown one first) and the params', () => {
    const issues = engineIssues();
    const min = issues.find((i) => i.code === 'min')!;
    expect(min.params).toEqual({ label: 'Lo', min: 2 });
    const m = { ...D.issues, min: (l: string, p: { min?: number }) => `${l} en az ${p.min} olmalı` };
    expect(issueText(min, m)).toBe('Lo en az 2 olmalı');
    expect(issueText(min, m, 'Alt')).toBe('Alt en az 2 olmalı');
    const opt = issues.find((i) => i.code === 'unknownOption')!;
    expect(opt.params).toEqual({ label: 'Multi2', option: 'z' });
  });

  it('an issue without a known code keeps its message', () => {
    expect(issueText({ path: 'x', message: 'Host rule' }, D.issues)).toBe('Host rule');
    expect(issueText({ path: 'x', message: 'Older', code: 'nope' as never }, D.issues)).toBe('Older');
    expect(issueText({ path: 'x', message: 'Proto', code: 'toString' as never }, D.issues)).toBe('Proto');
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

  it.each([['../messages.ts'], ['../../SchemaForm/messages.ts'], ['../views/control-common.ts'], ['../localize.ts'], ['../views/content-logic.ts']])('%s imports no React and no component', (file) => {
    const src = read(file);
    for (const spec of imports(src)) {
      expect(spec).not.toMatch(/^react(-dom)?$/);
      expect(spec).not.toMatch(/\.tsx$/);
      expect(spec).not.toMatch(/(Context|View|Card|Board|Editor|Tile|Canvas|FieldControl|SchemaForm)$/);
    }
    expect(src).not.toMatch(/['"]use client['"]/);
  });
});
