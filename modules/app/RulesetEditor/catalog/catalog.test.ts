import { describe, expect, it } from 'vitest';
import {
  BUILTIN_CATALOG, catalogFromBlocks, defaultParams, isVisible, missingRequired, optionLabel, outputIds,
  paletteGroups, paramLabel, resolvePorts, validateParams, type ParamSpec, type RawBlock,
} from './index';
import { NODE_VISUALS } from '../RulesetEditor/node-meta';

/* blocks as they are written in blocks.d of roltek-automation-1 */
const SCHEDULE: RawBlock = {
  type: 'trigger.schedule', group: 'input', icon: 'calendar', title: 'Schedule',
  params: {
    mode: { type: 'enum', options: ['daily', 'cron', 'sun'], default: 'daily' },
    time: { type: 'time', default: '08:00', when: { param: 'mode', value: 'daily' } },
    cron: { type: 'cron', default: '0 8 * * 1-5', when: { param: 'mode', value: 'cron' } },
    offset_min: { type: 'number', int: true, min: -720, max: 720, default: 0, when: { param: 'mode', value: 'sun' } },
    lat: { type: 'number', min: -90, max: 90, label: 'Latitude', when: { param: 'mode', value: 'sun' } },
  },
};
const ADC_ALARM: RawBlock = {
  type: 'action.adc_alarm', group: 'output', icon: 'sliders', title: 'Analog alarm threshold', risk: 'control',
  params: {
    channel: { type: 'source', source: 'adc_channels', default: 0 },
    mode: { type: 'enum', options: ['high', 'low', 'both', 'clear'], option_labels: { high: 'Upper', low: 'Lower', both: 'Both', clear: 'Turn off' }, default: 'high' },
    high: { type: 'value', default: { kind: 'path', v: 'msg.payload' }, when: { param: 'mode', value: ['high', 'both'] } },
    hysteresis: { type: 'number', min: 0 },
  },
};
const SCRIPT: RawBlock = {
  type: 'logic.script', group: 'function', icon: 'code', title: 'Script (JavaScript)',
  outputs: { count: 'outputs', prefix: 'o', max: 4 },
  params: {
    code: { type: 'code', lang: 'js', max_len: 8192, required: true, label: 'Code', default: 'return msg;' },
    outputs: { type: 'number', int: true, min: 1, max: 4, default: 1, pins: 'labels' },
    labels: { type: 'string', max_len: 128, default: '', pattern: '^[A-Za-z0-9_ ,-]*$' },
  },
};
const RULE_ROW: Record<string, ParamSpec> = {
  op: { type: 'enum', options: ['eq', 'true', 'empty'], default: 'eq' },
  value: { type: 'value', when: { param: 'op', not: ['true', 'empty'] } },
};
const SWITCH: RawBlock = {
  type: 'logic.switch', group: 'function', title: 'Switch',
  outputs: { dynamic: 'rules', prefix: 'o', max: 16, extra: ['else'] },
  params: { rules: { type: 'rules', items: RULE_ROW } },
};
const catalog = catalogFromBlocks([[SCHEDULE, ADC_ALARM, SCRIPT, SWITCH]]);

describe('isVisible', () => {
  const spec = SCHEDULE.params!.time;
  it('shows a field without a condition', () => {
    expect(isVisible({}, {})).toBe(true);
  });
  it('compares to a single value or to a list', () => {
    expect(isVisible(spec, { mode: 'daily' })).toBe(true);
    expect(isVisible(spec, { mode: 'cron' })).toBe(false);
    expect(isVisible(ADC_ALARM.params!.high, { mode: 'both' })).toBe(true);
    expect(isVisible(ADC_ALARM.params!.high, { mode: 'low' })).toBe(false);
  });
  it('falls back to the default of the other param', () => {
    expect(isVisible(spec, {}, SCHEDULE.params)).toBe(true);
    expect(isVisible(SCHEDULE.params!.cron, {}, SCHEDULE.params)).toBe(false);
  });
  it('supports not', () => {
    expect(isVisible(RULE_ROW.value, { op: 'eq' })).toBe(true);
    expect(isVisible(RULE_ROW.value, { op: 'true' })).toBe(false);
  });
  it('compares loosely, so 1 matches the text 1', () => {
    expect(isVisible({ when: { param: 'n', value: '1' } }, { n: 1 })).toBe(true);
  });
});

describe('defaults and labels', () => {
  it('copies every default, also for fields that are hidden', () => {
    const values = defaultParams(catalog.blocks['trigger.schedule']);
    expect(values).toEqual({ mode: 'daily', time: '08:00', cron: '0 8 * * 1-5', offset_min: 0 });
  });
  it('does not share default objects between nodes', () => {
    const a = defaultParams(catalog.blocks['action.adc_alarm']) as { high: { v: string } };
    a.high.v = 'changed';
    expect((defaultParams(catalog.blocks['action.adc_alarm']) as { high: { v: string } }).high.v).toBe('msg.payload');
  });
  it('leaves out params stored in the script field', () => {
    expect(defaultParams(BUILTIN_CATALOG.blocks.FILTER)).toEqual({});
  });
  it('derives a label from the key', () => {
    expect(paramLabel('offset_min', {})).toBe('Offset min');
    expect(paramLabel('timeout_ms', {})).toBe('Timeout');
    expect(paramLabel('lat', { label: 'Latitude' })).toBe('Latitude');
  });
  it('names enum options', () => {
    const mode = ADC_ALARM.params!.mode;
    expect(optionLabel(mode, 'high')).toBe('Upper');
    expect(optionLabel(mode, 'other')).toBe('other');
    expect(optionLabel({ empty_label: 'keep' }, '')).toBe('keep');
  });
});

describe('validation of params', () => {
  const decl = catalog.blocks['logic.script'];
  const codes = (values: Record<string, unknown>, block = decl) => validateParams(block, values).map((i) => i.param + ':' + i.code);
  it('reports required params that are shown and empty', () => {
    expect(missingRequired(decl, { code: '' })).toEqual(['code']);
    expect(missingRequired(decl, { code: 'return msg;' })).toEqual([]);
  });
  it('skips a required param that is hidden', () => {
    const hidden = { params: { a: { type: 'string' as const, required: true, when: { param: 'k', value: 'x' } } } };
    expect(missingRequired(hidden, { k: 'y' })).toEqual([]);
    expect(missingRequired(hidden, { k: 'x' })).toEqual(['a']);
  });
  it('checks numbers, enums, length and pattern', () => {
    expect(codes({ code: 'x', outputs: 9 })).toEqual(['outputs:max']);
    expect(codes({ code: 'x', outputs: 1.5 })).toEqual(['outputs:int']);
    expect(codes({ code: 'x', outputs: 'abc' })).toEqual(['outputs:number']);
    expect(codes({ code: 'x', labels: 'a b!' })).toEqual(['labels:pattern']);
    expect(codes({ code: 'x'.repeat(9000) })).toEqual(['code:max_len']);
    expect(codes({ mode: 'weekly' }, catalog.blocks['trigger.schedule'])).toEqual(['mode:enum']);
    expect(codes({ mode: 'sun', offset_min: -800 }, catalog.blocks['trigger.schedule'])).toEqual(['offset_min:min']);
  });
  it('ignores a pattern that is not a valid regular expression', () => {
    expect(validateParams({ params: { a: { type: 'string', pattern: '(' } } }, { a: 'x' })).toEqual([]);
  });
});

describe('ports', () => {
  it('lists fixed outputs and adds the error port when the catalog has one', () => {
    const ports = resolvePorts(catalog, 'trigger.schedule');
    expect(ports.inputs).toEqual([]);
    expect(ports.outputs.map((p) => p.id)).toEqual(['out']);
    expect(resolvePorts(catalog, 'action.adc_alarm').inputs.map((p) => p.id)).toEqual(['in']);
    expect(resolvePorts(catalog, 'action.adc_alarm').outputs.map((p) => p.id)).toEqual(['out', 'error']);
  });
  it('makes one port per rule, plus the extra ports', () => {
    const rules = [{ op: 'eq', label: 'cold' }, { op: 'true' }];
    const outs = resolvePorts(catalog, 'logic.switch', { rules }).outputs;
    expect(outs.map((p) => p.id)).toEqual(['o0', 'o1', 'else', 'error']);
    expect(outs[0].label).toBe('cold');
    expect(outs[1].label).toBe('o1');
  });
  it('makes a fixed number of ports from a number param, named by a pins list', () => {
    const outs = resolvePorts(catalog, 'logic.script', { outputs: 3, labels: 'alarm, normal' }).outputs;
    expect(outs.map((p) => p.id + '=' + p.label)).toEqual(['o0=alarm', 'o1=normal', 'o2=o2', 'error=error']);
  });
  it('reads the pins list by position: an empty name leaves its port unnamed and the names after it in place', () => {
    const outs = resolvePorts(catalog, 'logic.script', { outputs: 3, labels: 'alarm, , normal' }).outputs;
    expect(outs.map((p) => p.id + '=' + p.label)).toEqual(['o0=alarm', 'o1=o1', 'o2=normal', 'error=error']);
  });
  it('caps generated ports at max and counts at least one', () => {
    expect(outputIds({ count: 'n', max: 4 }, { n: 99 })).toHaveLength(4);
    expect(outputIds({ count: 'n' }, {})).toEqual(['o0']);
    expect(outputIds({ dynamic: 'rules', max: 2 }, { rules: [1, 2, 3] })).toEqual(['o0', 'o1']);
    expect(outputIds({ dynamic: 'rules' }, {})).toEqual([]);
  });
  it('gives an unknown type one input and one out port', () => {
    const ports = resolvePorts(catalog, 'nope.nothing');
    expect(ports.inputs).toHaveLength(1);
    expect(ports.outputs.map((p) => p.id)).toEqual(['out']);
  });
  it('has no error port in the built-in catalog', () => {
    expect(resolvePorts(BUILTIN_CATALOG, 'FILTER').outputs.map((p) => p.label)).toEqual(['True', 'False']);
  });
});

describe('built-in catalog', () => {
  it('has the ten node types and the placeholder', () => {
    expect(Object.keys(BUILTIN_CATALOG.blocks).sort()).toEqual(Object.keys(NODE_VISUALS).sort());
    expect(Object.values(BUILTIN_CATALOG.blocks).filter((b) => !b.internal)).toHaveLength(10);
  });
  it('gives every type the ports it had in NODE_VISUALS', () => {
    for (const visual of Object.values(NODE_VISUALS)) {
      const ports = resolvePorts(BUILTIN_CATALOG, visual.type);
      expect(ports.inputs).toEqual(visual.inputs);
      expect(ports.outputs).toEqual(visual.outputs);
    }
  });
  it('shows the script as a code field stored in node.script', () => {
    const script = BUILTIN_CATALOG.blocks.TRANSFORM.params!.script;
    expect(script).toMatchObject({ type: 'code', lang: 'js', store: 'script' });
    expect(String(script.default)).toContain('return');
  });
  it('keeps visuals', () => {
    expect(BUILTIN_CATALOG.blocks.ALARM.visual?.icon).toBe(NODE_VISUALS.ALARM.icon);
  });
});

describe('palette', () => {
  it('groups addable blocks in catalog order and hides internal ones', () => {
    const groups = paletteGroups(BUILTIN_CATALOG);
    expect(groups.map((g) => g.id)).toEqual(['input', 'routing', 'processing', 'output']);
    expect(groups.flatMap((g) => g.blocks).some((b) => b.type === 'PLACEHOLDER')).toBe(false);
  });
  it('filters by title, description and type', () => {
    expect(paletteGroups(BUILTIN_CATALOG, 'rest').flatMap((g) => g.blocks.map((b) => b.type))).toEqual(['REST_API']);
    expect(paletteGroups(BUILTIN_CATALOG, 'zzz')).toEqual([]);
  });
  it('puts blocks of an unlisted group at the end', () => {
    const odd = catalogFromBlocks([[{ type: 'action.x', group: 'weird' }, { type: 'trigger.y' }]]);
    expect(paletteGroups(odd).map((g) => g.id)).toEqual(['input', 'weird']);
  });
});

describe('catalogFromBlocks', () => {
  it('fills what the router fills: category, inputs, outputs, group', () => {
    const c = catalogFromBlocks([[{ type: 'trigger.boot' }, { type: 'cond.compare' }, { type: 'action.log' }]]);
    expect(c.blocks['trigger.boot']).toMatchObject({ category: 'trigger', inputs: 0, outputs: ['out'], group: 'input' });
    expect(c.blocks['cond.compare']).toMatchObject({ inputs: 1, outputs: ['yes', 'no'], group: 'function' });
    expect(c.blocks['action.log']).toMatchObject({ group: 'output' });
    expect(c.errorPort).toBe(true);
  });
  it('accepts a whole blocks.d file or a plain list, and later files win', () => {
    const c = catalogFromBlocks([{ blocks: [{ type: 'logic.a', title: 'First' }] }, [{ type: 'logic.a', title: 'Second' }]]);
    expect(c.blocks['logic.a'].title).toBe('Second');
  });
  it('tints by category and paints risky blocks red', () => {
    expect(catalog.blocks['trigger.schedule'].visual).toMatchObject({ headerBg: 'bg-primary-subtle', iconName: 'calendar' });
    expect(catalog.blocks['action.adc_alarm'].visual?.headerBg).toBe('bg-error-subtle');
  });
  it('keeps the param schema as written', () => {
    expect(catalog.blocks['logic.switch'].outputs).toEqual({ dynamic: 'rules', prefix: 'o', max: 16, extra: ['else'] });
    expect(catalog.blocks['action.adc_alarm'].params!.channel.source).toBe('adc_channels');
  });
});

describe('param issue words', () => {
  it('a host can give its own words, with the label and the limit', () => {
    const decl = { params: { n: { type: 'number' as const, min: 3, max: 9, label: 'Count' }, s: { type: 'string' as const, max_len: 2, label: 'Name' } } };
    const seen: string[] = [];
    const issues = validateParams(decl, { n: 1, s: 'abc' }, (code, label, limit) => { seen.push(`${code}|${label}|${limit}`); return `${label}/${code}`; });
    expect(issues.map((i) => i.message)).toEqual(['Count/min', 'Name/max_len']);
    expect(seen).toEqual(['min|Count|3', 'max_len|Name|2']);
    expect(validateParams(decl, { n: 1 })[0].message).toBe('Count must be at least 3.');
  });
});

describe('the script API of a code field', () => {
  const script: RawBlock = { type: 'logic.script', params: { code: { type: 'code', lang: 'js' }, outputs: { type: 'number' } } };
  it('is set on the code of logic.script, and only there', () => {
    const cat = catalogFromBlocks([[script, { type: 'logic.other', params: { code: { type: 'code', lang: 'js' } } }, { type: 'logic.json', params: { code: { type: 'code', lang: 'json' } } }]]);
    expect(cat.blocks['logic.script'].params?.code.api).toBe('automation-script');
    expect(cat.blocks['logic.script'].params?.outputs.api).toBeUndefined();
    expect(cat.blocks['logic.other'].params?.code.api).toBeUndefined();
    const json = catalogFromBlocks([[{ type: 'logic.script', params: { code: { type: 'code', lang: 'json' } } }]]);
    expect(json.blocks['logic.script'].params?.code.api).toBeUndefined();
  });
  it('keeps what a host declared', () => {
    const own = catalogFromBlocks([[{ type: 'logic.script', params: { code: { type: 'code', lang: 'js', api: 'automation-script', label: 'Mine' } } }]]);
    expect(own.blocks['logic.script'].params?.code).toMatchObject({ api: 'automation-script', label: 'Mine' });
  });
});
