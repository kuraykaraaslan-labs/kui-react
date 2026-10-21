import { colorField, opt, since } from '../settings/packs';
import type { SettingsTemplate, Sparse } from '../settings/types';
import type { BuiltinKindSpec } from '../kind';
import { isFormKey } from '../views/control-form-logic';
import { MAX_SCENE_ELEMENTS, MAX_SCENE_LINKS, MAX_SCENE_SHAPES, parsePort, type SceneElementSetting, type SceneLinkSetting, type SceneShapeSetting } from '../views/scada-scene-logic';
import { isScadaSymbol, SCADA_SYMBOLS, SCADA_SYMBOL_DEFS, type SymbolDef } from '../views/scada-logic';
import { MEDIUM_OPTIONS, SYMBOL_OPTIONS } from './scada';

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]).filter((r) => r && typeof r === 'object') : []);

/**
 * `scada.scene`: a process diagram on a canvas. Symbols are placed by coordinates, joined by pipes, hoses, cables, signal
 * wires and strip lines that route themselves between the symbols' sides (`pump1.r`, `tank.b`, `pump1.t:0.26`).
 * One bound table, a row per id, feeds every symbol and link (columns value, value2, running, status, warning, critical,
 * label, capacity).
 */
export const SCADA_SCENE: SettingsTemplate = {
  id: 'builtin:scada.scene',
  version: 2,
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
  ],
  fields: since(1, {
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
        symbol: { label: 'Symbol', type: 'select', value: 'tank.vertical', required: true, options: SYMBOL_OPTIONS },
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
  }),
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
      list<SceneLinkSetting>(v.links).forEach((l, i) => {
        for (const end of ['from', 'to'] as const) {
          const port = parsePort(l[end]);
          if (!port) issues.push({ path: `links.${i}.${end}`, message: 'Use a symbol id and a side: l, r, t or b (pump1.r)' });
          else if (!ids.has(port.id)) issues.push({ path: `links.${i}.${end}`, message: 'No symbol has this id' });
        }
      });
      return issues;
    },
  ],
  migrations: [{ from: 1, to: 2, note: 'Titles and zones on the canvas, single-line connections and a calm look (all new, nothing changes for a saved diagram).' }],
};

export const SCADA_SCENE_KIND: BuiltinKindSpec = {
  type: 'scada.scene',
  label: 'Process diagram',
  category: 'Process & SCADA',
  description: 'A whole process diagram on one canvas: symbols placed by coordinates and joined by pipes, hoses, cables and wires that route themselves.',
  icon: 'fas fa-diagram-project',
  defaultW: 12,
  defaultH: 8,
  slots: [{ key: 'points', label: 'Readings (a row per symbol id)', shape: 'table', required: false }],
  template: SCADA_SCENE,
};

/** Every symbol id the scene accepts (for tools that generate scenes). */
export const SCENE_SYMBOL_IDS: readonly string[] = SCADA_SYMBOLS.filter((k) => !!(SCADA_SYMBOL_DEFS[k] as SymbolDef));
