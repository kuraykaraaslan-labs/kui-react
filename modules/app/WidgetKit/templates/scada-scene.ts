import { colorField, opt, since } from '../settings/packs';
import type { SettingsTemplate, Sparse } from '../settings/types';
import type { BuiltinKindSpec } from '../kind';
import { isFormKey } from '../views/control-form-logic';
import {
  DEFAULT_THINGS_SCALE, MAX_SCENE_ELEMENTS, MAX_SCENE_LINKS, MAX_SCENE_SHAPES, MAX_SCENE_THINGS, parsePort,
  type SceneElementSetting, type SceneLinkSetting, type SceneShapeSetting,
} from '../views/scada-scene-logic';
import { MAX_RULE_LABEL, MAX_SCENE_RULES, validateRules } from '../views/scene-rules-logic';
import { MAX_PATCH_COORD } from '../views/scene-patch';
import { isScadaSymbol, SCADA_SYMBOLS, SCADA_SYMBOL_DEFS, type SymbolDef } from '../views/scada-logic';
import { MEDIUM_OPTIONS, SYMBOL_OPTIONS } from './scada';
import { ruleConditionFields, stopField, YES_NO } from './rule-fields';

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]).filter((r) => r && typeof r === 'object') : []);

/**
 * `scada.scene`: a process diagram on a canvas. Symbols are placed by coordinates, joined by pipes, hoses, cables, signal
 * wires and strip lines that route themselves between the symbols' sides (`pump1.r`, `tank.b`, `pump1.t:0.26`).
 * One bound table, a row per id, feeds every symbol and link (columns value, value2, running, status, warning, critical,
 * label, capacity). A second table, `things`, places one symbol per row where the row says (phase 35: added fields
 * only, so no version step); a connection may end on a thing by its id, and a rule may target it, or `things:*`.
 */
export const SCADA_SCENE: SettingsTemplate = {
  id: 'builtin:scada.scene',
  version: 5,
  namespace: '',
  label: 'Process diagram',
  format: true,
  exportable: false,
  formatDefaults: { decimals: 1 },
  cardDefaults: { padding: 8, staleDisplay: 'dim' },
  groups: [
    { id: 'canvas', label: 'Canvas', tab: 'Display', since: 1 },
    { id: 'elements', label: 'Symbols', tab: 'Display', since: 1 },
    { id: 'links', label: 'Connections', tab: 'Display', since: 1 },
    { id: 'colour', label: 'Colours', tab: 'Display', since: 1 },
    { id: 'data', label: 'Data', tab: 'Data', since: 1 },
    { id: 'motion', label: 'Animation', tab: 'Display', since: 1 },
    { id: 'shapes', label: 'Titles and zones', tab: 'Display', since: 2 },
    { id: 'rules', label: 'Rules', tab: 'Data', since: 3 },
    { id: 'things', label: 'Things', tab: 'Data', since: 5 },
  ],
  fields: {
    ...since(1, {
    width: { label: 'Canvas width', type: 'number', display: 'input', min: 200, max: 4000, value: 1200, group: 'canvas', description: 'Scene units. The diagram scales to the card and keeps its proportions.' },
    height: { label: 'Canvas height', type: 'number', display: 'input', min: 200, max: 4000, value: 700, group: 'canvas' },
    scale: { label: 'Symbol size', type: 'number', display: 'input', min: 0.2, max: 2, step: 0.05, value: 0.6, group: 'canvas', description: 'A symbol box is 100 units high at 1; connections are drawn at the same size, so a pipe matches the port it leaves.' },
    background: {
      label: 'Background', type: 'select', display: 'segmented', value: 'none', group: 'canvas', required: true,
      options: [opt('none', 'None'), opt('dots', 'Dots'), opt('panel', 'Panel')],
    },
    fit: {
      label: 'View', type: 'select', display: 'segmented', value: 'content', group: 'canvas', required: true,
      options: [opt('content', 'Fit to the diagram'), opt('canvas', 'The whole canvas')],
      description: 'Fit to the diagram zooms in on the symbols; the whole canvas keeps the empty space.',
    },
    anchor: {
      label: 'x and y are a symbol\'s', type: 'select', display: 'segmented', value: 'center', group: 'canvas', required: true,
      options: [opt('center', 'Centre'), opt('corner', 'Top-left corner')],
      description: 'Placing by centre lines symbols of different sizes up on one row.',
    },
    showLabels: { label: 'Show names and numbers around symbols', type: 'boolean', value: true, group: 'canvas' },
    elements: {
      label: 'Symbols', type: 'repeater', group: 'elements', max: MAX_SCENE_ELEMENTS,
      description: 'The id names the symbol for connections and picks its row in the bound table; x and y place it on the canvas.',
      fields: {
        id: { label: 'Id', type: 'text', maxLength: 64, required: true, placeholder: 'pump1' },
        symbol: { label: 'Symbol', type: 'select', value: 'home.router', required: true, options: SYMBOL_OPTIONS },
        x: { label: 'x', type: 'number', display: 'input', value: 0 },
        y: { label: 'y', type: 'number', display: 'input', value: 0 },
        turn: { label: 'Turn', type: 'select', value: '0', options: [opt('0', '0°'), opt('90', '90°'), opt('180', '180°'), opt('270', '270°')] },
        mirror: { label: 'Flip', type: 'boolean', value: false },
        length: { label: 'Length (cells)', type: 'select', value: '1', options: [opt('1', '1'), opt('2', '2'), opt('3', '3')] },
        scale: { label: 'Own size', type: 'number', nullable: true, display: 'input', min: 0.2, max: 4, step: 0.05, placeholder: '1' },
        label: { label: 'Name', type: 'text', maxLength: 60 },
        labelPos: { label: 'Name position', type: 'select', value: 'b', options: [opt('b', 'Below'), opt('t', 'Above'), opt('n', 'Hidden')] },
        valuePos: { label: 'Number position', type: 'select', value: 'b', options: [opt('b', 'Below'), opt('r', 'Beside')] },
        medium: { label: 'Medium', type: 'select', value: 'none', options: MEDIUM_OPTIONS, description: 'Empty (none) = the medium of a connection that touches it.' },
        mediumColor: { label: 'Medium colour', type: 'color', value: 'var(--info)', description: 'For the medium "A colour of my own".' },
        min: { label: 'Minimum', type: 'number', nullable: true, display: 'input', placeholder: '0' },
        max: { label: 'Maximum', type: 'number', nullable: true, display: 'input', placeholder: '100' },
        showValue: { label: 'Show the number', type: 'boolean', value: true },
        fillColor: { label: 'Liquid colour', type: 'color', description: 'Empty = the symbol\'s own.' },
        idleColor: { label: 'Idle colour', type: 'color', description: 'Empty = the scene\'s.' },
        runningColor: { label: 'Running colour', type: 'color', description: 'Empty = the scene\'s.' },
        warningColor: { label: 'Warning colour', type: 'color', description: 'Empty = the scene\'s.' },
        criticalColor: { label: 'Critical colour', type: 'color', description: 'Empty = the scene\'s.' },
        unit: { label: 'Unit', type: 'text', maxLength: 16, placeholder: 'The card\'s unit', description: 'Written after this symbol\'s numbers.' },
        decimals: { label: 'Decimals', type: 'number', nullable: true, display: 'input', min: 0, max: 6, placeholder: 'The card\'s', description: 'For this symbol\'s numbers.' },
      },
    },
    links: {
      label: 'Connections', type: 'repeater', group: 'links', max: MAX_SCENE_LINKS,
      description: 'From and to are a symbol id and a side: l, r, t or b, optionally with where along the edge (0 to 1): pump1.r, pump1.t:0.26. The route is horizontal and vertical legs with rounded corners.',
      fields: {
        from: { label: 'From', type: 'text', maxLength: 80, required: true, placeholder: 'pump1.r' },
        to: { label: 'To', type: 'text', maxLength: 80, required: true, placeholder: 'tank.b' },
        kind: {
          label: 'Kind', type: 'select', value: 'pipe', required: true,
          options: [opt('pipe', 'Pipe'), opt('hose', 'Hose'), opt('cable', 'Cable'), opt('wire', 'Signal wire'), opt('strip', 'Strip'), opt('line', 'Thin line with arrow'), opt('sld', 'Single-line (electrical)')],
        },
        id: { label: 'State from row', type: 'text', maxLength: 64, placeholder: 'The "from" symbol\'s row' },
        medium: { label: 'Medium', type: 'select', value: 'none', options: MEDIUM_OPTIONS },
        mediumColor: { label: 'Medium colour', type: 'color', value: 'var(--info)', description: 'For the medium "A colour of my own".' },
        mid: { label: 'Middle leg at', type: 'number', nullable: true, display: 'input', placeholder: 'automatic', description: 'The x (or y) of the middle leg of a Z route.' },
        arrows: { label: 'Flow arrow', type: 'boolean', value: false },
      },
    },
    idleColor: colorField('Idle', 'colour', 'var(--text-secondary)'),
    runningColor: colorField('Running', 'colour', 'var(--success)'),
    warningColor: colorField('Warning', 'colour', 'var(--warning)'),
    criticalColor: colorField('Critical', 'colour', 'var(--error)'),
    idColumn: { label: 'Row id column', type: 'data-key', slot: 'points', value: 'id', group: 'data', advanced: true, description: 'Which column of the table names a symbol or connection.' },
    animation: { label: 'Animate running parts', type: 'boolean', value: true, group: 'motion', advanced: true },
    // Version 2: titles, zones and dividers, and the calm look.
    ...since(2, {
    shapes: {
      label: 'Titles and zones', type: 'repeater', group: 'shapes', max: MAX_SCENE_SHAPES,
      description: 'A title, a zone outline or a divider line on the canvas. They carry no reading. x and y are the anchor of a title and the top-left corner of a zone or divider.',
      fields: {
        kind: { label: 'Kind', type: 'select', value: 'text', required: true, options: [opt('text', 'Title or note'), opt('zone', 'Zone outline'), opt('divider', 'Divider line')] },
        text: { label: 'Words', type: 'text', maxLength: 80, description: 'A title or note; a zone\'s name.' },
        x: { label: 'x', type: 'number', display: 'input', value: 0 },
        y: { label: 'y', type: 'number', display: 'input', value: 0 },
        w: { label: 'Width', type: 'number', display: 'input', min: 0, max: 4000, description: 'Zone and divider. A vertical divider has width 0.' },
        h: { label: 'Height', type: 'number', display: 'input', min: 0, max: 4000, description: 'Zone and divider. A horizontal divider has height 0.' },
        size: { label: 'Text size', type: 'select', value: 'm', options: [opt('s', 'Small'), opt('m', 'Medium'), opt('l', 'Large')] },
        align: { label: 'Align', type: 'select', value: 'middle', options: [opt('start', 'Start'), opt('middle', 'Middle'), opt('end', 'End')] },
        tone: { label: 'Tone', type: 'select', value: 'neutral', options: [opt('neutral', 'Neutral'), opt('info', 'Info'), opt('success', 'Success'), opt('warning', 'Warning'), opt('error', 'Error')] },
        dashed: { label: 'Dashed', type: 'boolean', value: true },
      },
    },
    calm: { label: 'Calm look', type: 'boolean', value: false, group: 'colour', description: 'Running parts are drawn in plain ink, not green; only a warning or an alarm shows colour (ISA-101 style).' },
    }),
    ...since(3, {
    rules: {
      label: 'Rules', type: 'repeater', group: 'rules', max: MAX_SCENE_RULES,
      description: 'Make symbols and connections follow the data. A rule names a target, up to two conditions and what to change while they hold. Rules run top to bottom; every rule that matches applies, a later rule wins for the same change, and "Stop" ends the rules for that target.',
      fields: {
        ...ruleConditionFields({
          targetPlaceholder: 'pump1, a connection id, * or things:*',
          targetDescription: 'A symbol id, a connection id (its "State from row"), a thing\'s id, * for all of them, or things:* for every thing from data.',
          ownRow: 'This symbol\'s own row',
          otherRow: 'The id of another symbol or connection whose row is read.',
        }),
        state: { label: 'Then: state', type: 'select', options: [opt('', 'No change'), opt('idle', 'Idle'), opt('running', 'Running'), opt('warning', 'Warning'), opt('critical', 'Critical'), opt('off', 'Off (passive, nothing flowing)')] },
        color: { label: 'Colour', type: 'color', description: 'Replaces the state colour.' },
        fillColor: { label: 'Liquid colour', type: 'color' },
        dim: { label: 'Passive look', type: 'select', options: YES_NO },
        blink: { label: 'Blink', type: 'select', options: YES_NO, description: 'Not when the viewer asks for reduced motion or the animation is off.' },
        hidden: { label: 'Hide', type: 'select', options: YES_NO, description: 'Connections that touch a hidden symbol still draw.' },
        label: { label: 'Name', type: 'text', maxLength: MAX_RULE_LABEL, placeholder: 'High: {value}', description: 'Tokens: {value}, {value2}, {condition} (what the condition reads), {label}, {id}, {param:name}.' },
        medium: { label: 'Medium', type: 'select', options: [opt('', 'No change'), ...MEDIUM_OPTIONS] },
        animate: { label: 'Motion', type: 'select', options: [opt('', 'No change'), opt('false', 'Stop it'), opt('true', 'Leave it on')] },
        mode: { label: 'Mode', type: 'select', options: [opt('', 'No change'), opt('auto', 'Automatic'), opt('manual', 'Manual (M badge)'), opt('local', 'Local (L badge)'), opt('maintenance', 'In maintenance (wrench)'), opt('lockout', 'Locked out (padlock)'), opt('simulation', 'Simulated (S badge)')], description: 'A badge in the top right corner. A locked-out symbol does not run its actions.' },
        quality: { label: 'Data quality', type: 'select', options: [opt('', 'No change'), opt('good', 'Good'), opt('stale', 'Stale (clock, dimmed)'), opt('bad', 'Bad or uncertain (?, dimmed)'), opt('offline', 'Lost (cross, faded)')], description: 'Shows a dashed frame and a badge in the top left corner.' },
        speed: { label: 'Speed (% of nominal)', type: 'number', nullable: true, display: 'input', min: 0, max: 400, placeholder: '100', description: 'Fans, pumps, reels and flow run at this share of their drawn pace. 0 = stalled (keeps its colour, stands still).' },
        reverse: { label: 'Direction', type: 'select', options: [opt('', 'No change'), opt('false', 'Forward'), opt('true', 'Reverse')], description: 'Rotation and flow run the other way.' },
        ack: { label: 'Alarm acknowledged', type: 'select', options: [opt('', 'No change'), opt('false', 'No (pulses until someone acknowledges)'), opt('true', 'Yes (steady)')] },
        position: { label: 'Opening (%)', type: 'number', nullable: true, display: 'input', min: 0, max: 100, placeholder: 'Not shown', description: 'A bar along the bottom of a valve, damper, door or blind.' },
        pending: { label: 'Command pending', type: 'select', options: YES_NO, description: 'A spinner in the bottom right corner.' },
        failed: { label: 'Command failed', type: 'select', options: YES_NO, description: 'A red mark in the bottom right corner.' },
        // Where and how big (phase 35): connections follow a moved symbol.
        dx: { label: 'Move right by', type: 'number', nullable: true, display: 'input', min: -4000, max: 4000, placeholder: '0', description: 'Scene units; a negative number moves it left.' },
        dy: { label: 'Move down by', type: 'number', nullable: true, display: 'input', min: -4000, max: 4000, placeholder: '0', description: 'Scene units; a negative number moves it up.' },
        scale: { label: 'Size (times its own)', type: 'number', nullable: true, display: 'input', min: 0.2, max: 4, step: 0.05, placeholder: '1' },
        turn: { label: 'Turn to', type: 'select', options: [opt('', 'No change'), opt('0', '0°'), opt('90', '90°'), opt('180', '180°'), opt('270', '270°')] },
        symbol: { label: 'Draw as', type: 'select', options: [opt('', 'No change'), ...SYMBOL_OPTIONS], description: 'Another symbol in its place, with the same row.' },
        stop: stopField(),
      },
    },
    }),
    }),
    // Things from data (phase 35): one row = one symbol placed where the row says. Added fields: no version step.
    ...since(5, {
    thingsIdColumn: {
      label: 'Thing id column', type: 'data-key', slot: 'things', value: 'id', group: 'things',
      description: `Names the thing for connections, rules and actions; an id a symbol already has is skipped. At most ${MAX_SCENE_THINGS} things are drawn.`,
    },
    thingsSymbol: {
      label: 'Every thing is drawn as', type: 'select', value: '', group: 'things', options: [opt('', 'The symbol column says'), ...SYMBOL_OPTIONS],
      description: 'One symbol for every row, or each row\'s own from the symbol column. A key the diagram cannot draw shows a placeholder.',
    },
    thingsSymbolColumn: { label: 'Symbol column', type: 'data-key', slot: 'things', value: 'symbol', group: 'things', showIf: { thingsSymbol: '' } },
    thingsXColumn: { label: 'x column', type: 'data-key', slot: 'things', value: 'x', group: 'things' },
    thingsYColumn: { label: 'y column', type: 'data-key', slot: 'things', value: 'y', group: 'things' },
    thingsTurnColumn: { label: 'Turn column', type: 'data-key', slot: 'things', value: 'turn', group: 'things', advanced: true, description: 'Degrees, snapped to the nearest quarter turn.' },
    thingsLabelColumn: { label: 'Name column', type: 'data-key', slot: 'things', value: 'label', group: 'things' },
    thingsUnits: {
      label: 'x and y are', type: 'select', display: 'segmented', value: 'scene', group: 'things', required: true,
      options: [opt('scene', 'Scene units'), opt('metres', 'Metres on the site')],
      description: 'Metres are mapped onto the canvas from the origin below at the scale below; y grows downward, as on the canvas.',
    },
    thingsScale: { label: 'Scene units per metre', type: 'number', display: 'input', min: 0.01, max: 1000, value: DEFAULT_THINGS_SCALE, group: 'things', showIf: { thingsUnits: 'metres' } },
    thingsOriginX: { label: 'Origin x', type: 'number', display: 'input', min: -MAX_PATCH_COORD, max: MAX_PATCH_COORD, value: 0, group: 'things', showIf: { thingsUnits: 'metres' }, description: 'Where the site\'s 0, 0 lies on the canvas.' },
    thingsOriginY: { label: 'Origin y', type: 'number', display: 'input', min: -MAX_PATCH_COORD, max: MAX_PATCH_COORD, value: 0, group: 'things', showIf: { thingsUnits: 'metres' } },
    }),
  },
  rules: [
    (v: Sparse) => {
      const issues: Array<{ path: string; message: string }> = [];
      const ids = new Set<string>();
      list<SceneElementSetting>(v.elements).forEach((e, i) => {
        if (!isFormKey(e.id)) issues.push({ path: `elements.${i}.id`, message: 'An id starts with a letter or _ and has only letters, digits, . _ -' });
        else if (ids.has(e.id)) issues.push({ path: `elements.${i}.id`, message: 'Ids must be different' });
        else ids.add(e.id);
        if (!isScadaSymbol(e.symbol)) issues.push({ path: `elements.${i}.symbol`, message: 'Choose a symbol' });
      });
      // An end or a rule target that names no symbol may name a thing from data (phase 35), which the settings cannot
      // know: it is accepted, and draws or applies only while a thing has that id (the editor's problems list says so).
      list<SceneLinkSetting>(v.links).forEach((l, i) => {
        for (const end of ['from', 'to'] as const) {
          if (!parsePort(l[end])) issues.push({ path: `links.${i}.${end}`, message: 'Use a symbol id and a side: l, r, t or b (pump1.r)' });
        }
      });
      const linkIds = list<SceneLinkSetting>(v.links).map((l) => (typeof l.id === 'string' ? l.id : '')).filter(Boolean);
      issues.push(...validateRules(v.rules, { elementIds: ids, linkIds, things: true }));
      return issues;
    },
  ],
  migrations: [
    { from: 1, to: 2, note: 'Titles and zones on the canvas, single-line connections and a calm look (all new, nothing changes for a saved diagram).' },
    { from: 2, to: 3, note: 'Rules and per-symbol colours, unit and decimals (all new).' },
    { from: 3, to: 4, note: 'Symbol states: mode, data quality, speed, direction, alarm acknowledgement, opening and command badges, as row columns and as rule effects (all new).' },
    { from: 4, to: 5, note: 'Symbols that duplicated another one were merged.' },
  ],
};

export const SCADA_SCENE_KIND: BuiltinKindSpec = {
  type: 'scada.scene',
  label: 'Process diagram',
  category: 'Process & SCADA',
  group: 'scada',
  description: 'A whole process diagram on one canvas: symbols placed by coordinates and joined by pipes, hoses, cables and wires that route themselves.',
  icon: 'fas fa-diagram-project',
  defaultW: 12,
  defaultH: 8,
  slots: [
    { key: 'points', label: 'Readings (a row per symbol id)', shape: 'table', required: false },
    { key: 'things', label: 'Things (a row per object: id, symbol, x, y, state)', shape: 'table', required: false },
  ],
  template: SCADA_SCENE,
};

/** Every symbol id the scene accepts (for tools that generate scenes). */
export const SCENE_SYMBOL_IDS: readonly string[] = SCADA_SYMBOLS.filter((k) => !!(SCADA_SYMBOL_DEFS[k] as SymbolDef));
