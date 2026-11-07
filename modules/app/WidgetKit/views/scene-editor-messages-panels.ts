// The English texts of the diagram editor's panels (palette, inspector, rules, problems, what-if). Pure: no React. Each
// panel takes an optional `messages` prop of the same shape (any part of it) so a host can show them in its language;
// whatever it leaves out stays English. A text that interpolates is a function of its values.

import type { ScadaFamily } from './scada-logic';
import type { SceneSector } from './scada-aliases';
import type { RuleIssueCode } from './scene-rules-logic';

export type DeepPartial<T> = T extends (...a: never[]) => unknown ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** `defaults` with every key `over` sets laid over it (objects merge, anything else replaces; `undefined` keeps the default). */
export function mergeMessages<T extends object>(defaults: T, over?: DeepPartial<T>): T {
  if (!over) return defaults;
  const out = { ...defaults } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    const d = (defaults as Record<string, unknown>)[k];
    out[k] = d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' ? mergeMessages(d as object, v as DeepPartial<object>) : v;
  }
  return out as T;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

export interface PaletteMessages {
  title: string;
  search: string;
  searchPlaceholder: string;
  clearSearch: string;
  familyGroup: string;
  sectorGroup: string;
  allFamilies: string;
  allSectors: string;
  /** Puts the family and the sector back to "All". */
  clearFilters: string;
  recent: string;
  list: string;
  /** The live count under the search ("12 symbols"). */
  count: (n: number) => string;
  none: string;
  /** What a tile does on a click or Enter ("Add Smart plug"). */
  add: (name: string) => string;
  hint: string;
  families: Record<ScadaFamily, string>;
  sectors: Record<SceneSector, string>;
}

export const DEFAULT_PALETTE_MESSAGES: PaletteMessages = {
  title: 'Symbols',
  search: 'Search symbols',
  searchPlaceholder: 'Search: tv, router, camera...',
  clearSearch: 'Clear the search',
  familyGroup: 'Family',
  sectorGroup: 'Sector',
  allFamilies: 'All families',
  allSectors: 'All sectors',
  clearFilters: 'Clear filters',
  recent: 'Recent',
  list: 'Symbols',
  count: (n) => (n === 1 ? '1 symbol' : `${n} symbols`),
  none: 'No symbol matches. Try another word, or clear the family and sector.',
  add: (name) => `Add ${name}`,
  hint: 'Click or press Enter to add at the centre of the view, or drag onto the canvas.',
  families: { home: 'Home electronics' },
  sectors: { home: 'Home', telecom: 'Telecom', energy: 'Energy', safety: 'Safety', city: 'City' },
};

// ─── Rules ───────────────────────────────────────────────────────────────────

/** The words `describeRule` writes a rule as a sentence with. `{value}`, `{to}`, `{list}`, `{state}`, `{color}`, `{label}` and `{medium}` are filled in. */
export interface RuleWords {
  when: string;
  always: string;
  and: string;
  or: string;
  off: string;
  /** "parameter {name}" */
  param: string;
  ofThis: string;
  /** "of {id}" */
  of: string;
  forEvery: string;
  /** "For {target}" */
  forTarget: string;
  /** What the condition says of the reading, by operator. */
  ops: { eq: string; ne: string; gt: string; gte: string; lt: string; lte: string; between: string; in: string; set: string; unset: string; true: string; false: string };
  states: { idle: string; running: string; warning: string; critical: string; off: string };
  state: string;
  color: string;
  fillColor: string;
  dimOn: string;
  dimOff: string;
  blinkOn: string;
  blinkOff: string;
  hide: string;
  show: string;
  label: string;
  medium: string;
  animateOff: string;
  animateOn: string;
  /** "set the mode to {mode}" */
  mode: string;
  modes: { auto: string; manual: string; local: string; maintenance: string; lockout: string; simulation: string };
  /** "mark its data {quality}" */
  quality: string;
  qualities: { good: string; stale: string; bad: string; offline: string };
  /** "run it at {speed} % of its speed" */
  speed: string;
  reverseOn: string;
  reverseOff: string;
  ackOn: string;
  ackOff: string;
  /** "show it {position} % open" */
  position: string;
  pendingOn: string;
  pendingOff: string;
  failedOn: string;
  failedOff: string;
  /** "move it by {dx}, {dy}" (optional for a host's older translation: the English stands in). */
  move?: string;
  /** "draw it {scale} times its size" */
  resize?: string;
  /** "turn it to {turn}°" */
  turn?: string;
  /** "draw it as {symbol}" */
  symbol?: string;
  /** The lead of a rule that targets `things:*`. */
  forThings?: string;
  stop: string;
  nothing: string;
  /**
   * The theme colours in words ("colour it red"), in the host's language (next-boilerplate e2e round 5, V1-B5: they were English in every language);
   * a custom colour is shown as it is. Optional for a host's older translation: the English stands in.
   */
  colours?: Record<RuleColour, string>;
}

/** The theme colours a rule's sentence names in words. */
export type RuleColour = 'blue' | 'purple' | 'green' | 'cyan' | 'amber' | 'red' | 'dark' | 'grey' | 'lightGrey';

export const DEFAULT_RULE_WORDS: RuleWords = {
  when: 'When', always: 'Always', and: 'and', or: 'or', off: '(off)', param: 'parameter {name}', ofThis: 'of this symbol', of: 'of {id}',
  forEvery: 'For every symbol and connection', forTarget: 'For {target}',
  ops: {
    eq: 'is {value}', ne: 'is not {value}', gt: 'is above {value}', gte: 'is at least {value}', lt: 'is below {value}', lte: 'is at most {value}',
    between: 'is between {value} and {to}', in: 'is one of {list}', set: 'is set', unset: 'is not set', true: 'is on', false: 'is off',
  },
  states: { idle: 'idle', running: 'running', warning: 'warning', critical: 'critical', off: 'off' },
  state: 'set the state to {state}', color: 'colour it {color}', fillColor: 'fill it {color}', dimOn: 'dim it', dimOff: 'show it at full strength',
  blinkOn: 'blink', blinkOff: 'not blink', hide: 'hide it', show: 'show it', label: "show '{label}'", medium: 'set the medium to {medium}',
  animateOff: 'stop its motion', animateOn: 'keep its motion on',
  mode: 'set the mode to {mode}', modes: { auto: 'automatic', manual: 'manual', local: 'local', maintenance: 'maintenance', lockout: 'locked out', simulation: 'simulated' },
  quality: 'mark its data {quality}', qualities: { good: 'good', stale: 'stale', bad: 'bad', offline: 'lost' },
  speed: 'run it at {speed} % of its speed', reverseOn: 'run it in reverse', reverseOff: 'run it forward',
  ackOn: 'mark its alarm acknowledged', ackOff: 'mark its alarm unacknowledged', position: 'show it {position} % open',
  pendingOn: 'show a command pending', pendingOff: 'clear the pending command', failedOn: 'show a failed command', failedOff: 'clear the failed command',
  move: 'move it by {dx}, {dy}', resize: 'draw it {scale} times its size', turn: 'turn it to {turn}°', symbol: 'draw it as {symbol}',
  forThings: 'For every thing from data',
  stop: 'then stop', nothing: 'change nothing',
  colours: { blue: 'blue', purple: 'purple', green: 'green', cyan: 'cyan', amber: 'amber', red: 'red', dark: 'dark', grey: 'grey', lightGrey: 'light grey' },
};

export interface RulesMessages {
  title: string;
  /** "Add rule" */
  add: string;
  empty: string;
  /** "Rules for {name}" */
  forSelection: (name: string) => string;
  everything: string;
  others: string;
  /** The rule count line ("3 rules, 1 problem"). */
  summary: (rules: number, problems: number) => string;
  /** Where the values the rules read come from (the device is attached on its own page, not here). */
  deviceHint: string;
  /** The live mark on a card. */
  matching: string;
  notMatching: string;
  matchingSome: (matching: number, total: number) => string;
  disabled: string;
  noTarget: string;
  matchingTitle: string;
  edit: string;
  close: string;
  moveUp: string;
  moveDown: string;
  duplicate: string;
  delete: string;
  enabled: string;
  /** Names the buttons of one card for a screen reader ("Delete rule 3"). */
  ruleN: (n: number) => string;
  appliesTo: string;
  anySymbol: string;
  missing: (id: string) => string;
  when: string;
  read: string;
  column: string;
  parameter: string;
  columnLabel: string;
  /**
   * "Which value" is a choice of the symbol's own values (next-boilerplate e2e round 5, E14: a free text box the person had to fill from memory); the
   * last choice opens a box for any other name (a column of a data row), `otherValue` and its label `otherValueLabel`.
   */
  otherValue?: string;
  otherValueLabel?: string;
  /** The readable names of the values a symbol draws, by their name in the data (`value` is "Reading"); a host's own labels win. */
  valueNames?: Readonly<Record<string, string>>;
  parameterLabel: string;
  ofRow: string;
  ownRow: string;
  operator: string;
  value: string;
  upTo: string;
  list: string;
  alwaysOption: string;
  opLabels: Record<'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'set' | 'unset' | 'true' | 'false', string>;
  secondCondition: string;
  addSecond: string;
  removeSecond: string;
  join: string;
  joinAll: string;
  joinAny: string;
  then: string;
  state: string;
  noChange: string;
  states: Record<'idle' | 'running' | 'warning' | 'critical' | 'off', string>;
  color: string;
  fillColor: string;
  passive: string;
  blink: string;
  hidden: string;
  yes: string;
  no: string;
  label: string;
  tokens: string;
  insertToken: (token: string) => string;
  /** The token for the value the rule's condition reads, as the host's language writes it (`{condition}`; `{koşul}` in Turkish). */
  conditionToken: string;
  medium: string;
  motion: string;
  motionStop: string;
  motionOn: string;
  statesLegend: string;
  mode: string;
  modes: Record<'auto' | 'manual' | 'local' | 'maintenance' | 'lockout' | 'simulation', string>;
  quality: string;
  qualities: Record<'good' | 'stale' | 'bad' | 'offline', string>;
  speed: string;
  speedHelp: string;
  direction: string;
  forward: string;
  reverse: string;
  ack: string;
  ackNo: string;
  ackYes: string;
  position: string;
  pending: string;
  failedCommand: string;
  stop: string;
  stopHelp: string;
  problems: string;
  /** The badge of a rule with problems ("1 problem", "3 problems"). */
  problemCount: (n: number) => string;
  /** What the Name box shows while it is empty. */
  labelPlaceholder: string;
  /** Each problem of a rule, by its code (`validateRules`; e2e round 5, V1-B4), in the host's language; `n` is the number it names. */
  issues: Record<RuleIssueCode, (n?: number) => string>;
  refused: (why: string) => string;
  words: RuleWords;
}

export const DEFAULT_RULES_MESSAGES: RulesMessages = {
  title: 'Rules',
  add: 'Add rule',
  empty: 'No rules yet. A rule makes a symbol follow the data: when a reading is above a limit, turn it amber and show a note.',
  forSelection: (name) => `Rules for ${name}`,
  everything: 'Every symbol and connection (*)',
  others: 'Other rules',
  summary: (r, p) => `${r === 1 ? '1 rule' : `${r} rules`}${p ? `, ${p === 1 ? '1 problem' : `${p} problems`}` : ''}`,
  deviceHint: 'A rule reads a value of a symbol. Which device sends that value is chosen on the device\'s or the site\'s Views once the drawing is saved, not here.',
  matching: 'Matching now',
  notMatching: 'Not matching',
  matchingSome: (n, t) => `Matching ${n} of ${t}`,
  disabled: 'Off',
  noTarget: 'No target',
  matchingTitle: 'Whether the rule holds for the live data right now',
  edit: 'Edit',
  close: 'Close',
  moveUp: 'Move up',
  moveDown: 'Move down',
  duplicate: 'Duplicate',
  delete: 'Delete',
  enabled: 'On',
  ruleN: (n) => `rule ${n}`,
  appliesTo: 'Applies to',
  anySymbol: 'Every symbol and connection (*)',
  missing: (id) => `${id} (not in the diagram)`,
  when: 'When',
  read: 'Read',
  column: 'A value of a symbol',
  parameter: 'A board parameter',
  columnLabel: 'Which value',
  otherValue: 'Another value (advanced)…',
  otherValueLabel: 'Name of the value in the data',
  valueNames: {
    value: 'Reading', value2: 'Second reading', running: 'Running', status: 'Status', position: 'Opening', speed: 'Speed', direction: 'Direction',
    warning: 'Warning', critical: 'Critical', label: 'Name', capacity: 'Capacity', mode: 'Mode', quality: 'Data quality',
    // the states layer's other columns (`STATE_COLUMNS`) by name too, never raw (next-boilerplate phase 52.6.1, UI test 3 #219)
    ack: 'Alarm acknowledged', pending: 'Command pending', failed: 'Command failed',
  },
  parameterLabel: 'Parameter',
  ofRow: 'Of symbol',
  ownRow: 'This symbol',
  operator: 'Is',
  value: 'Value',
  upTo: 'Up to',
  list: 'Values, separated by commas',
  alwaysOption: 'Always (no condition)',
  opLabels: {
    eq: 'equal to', ne: 'not equal to', gt: 'greater than', gte: 'greater than or equal to', lt: 'less than', lte: 'less than or equal to',
    between: 'between (inclusive)', in: 'one of (a list)', set: 'set', unset: 'not set', true: 'true / on', false: 'false / off',
  },
  secondCondition: 'And a second condition',
  addSecond: 'Add a second condition',
  removeSecond: 'Remove the second condition',
  join: 'Join with',
  joinAll: 'And (all hold)',
  joinAny: 'Or (one holds)',
  then: 'Then',
  state: 'State',
  noChange: 'No change',
  states: { idle: 'Idle', running: 'Running', warning: 'Warning', critical: 'Critical', off: 'Off (passive, nothing flowing)' },
  color: 'Colour',
  fillColor: 'Liquid colour',
  passive: 'Passive look',
  blink: 'Blink',
  hidden: 'Hide',
  yes: 'Yes',
  no: 'No',
  label: 'Name',
  tokens: 'Insert a reading into the name',
  insertToken: (t) => `Insert ${t}`,
  conditionToken: '{condition}',
  medium: 'Medium',
  motion: 'Motion',
  motionStop: 'Stop it',
  motionOn: 'Leave it on',
  statesLegend: 'Mode, data and motion',
  mode: 'Mode',
  modes: { auto: 'Automatic', manual: 'Manual (M badge)', local: 'Local (L badge)', maintenance: 'In maintenance (wrench)', lockout: 'Locked out (padlock)', simulation: 'Simulated (S badge)' },
  quality: 'Data quality',
  qualities: { good: 'Good', stale: 'Stale (clock, dimmed)', bad: 'Bad or uncertain (?, dimmed)', offline: 'Lost (cross, faded)' },
  speed: 'Speed (% of nominal)',
  speedHelp: '0 stands still and keeps its colour; a negative number runs in reverse.',
  direction: 'Direction',
  forward: 'Forward',
  reverse: 'Reverse',
  ack: 'Alarm acknowledged',
  ackNo: 'No (pulses until someone acknowledges)',
  ackYes: 'Yes (steady)',
  position: 'Opening (%)',
  pending: 'Command pending',
  failedCommand: 'Command failed',
  stop: 'Stop here',
  stopHelp: 'No later rule applies to this target once this one matched.',
  problems: 'Problems with this rule',
  problemCount: (n) => (n === 1 ? '1 problem' : `${n} problems`),
  labelPlaceholder: 'High: {value}',
  issues: {
    'too-many': (n) => `A drawing holds at most ${n} rules.`,
    'target-row': () => 'Name a row or choose *.',
    'target-missing': () => 'Choose the symbol this rule changes.',
    'target-unknown': () => 'This symbol is not in the drawing any more.',
    'source-invalid': () => 'Choose what the rule reads.',
    'of-unknown': () => 'This symbol is not in the drawing any more.',
    'op-invalid': () => 'Choose a comparison from the list.',
    'param-missing': () => 'Choose the board parameter.',
    'column-missing': () => 'Choose which value the rule reads.',
    'value-missing': () => 'This comparison needs a value.',
    'value-number': () => 'This comparison needs a number.',
    'low-number': () => 'The lower end must be a number.',
    'high-number': () => 'The upper end must be a number.',
    'list-empty': () => 'List at least one value, separated by commas.',
    'first-missing': () => 'Set the first condition before the second.',
    'join-invalid': () => 'Choose how the two conditions join.',
    choice: () => 'Choose one of the options.',
    number: () => 'Use a number.',
    'label-long': (n) => `At most ${n} characters.`,
  },
  refused: (why) => why,
  words: DEFAULT_RULE_WORDS,
};

// ─── Inspector ───────────────────────────────────────────────────────────────

export interface InspectorMessages {
  title: string;
  tabs: { properties: string; rules: string; actions: string };
  tabsLabel: string;
  scene: string;
  sceneHint: string;
  symbol: (name: string, id: string) => string;
  severalSymbols: (n: number) => string;
  severalConnections: (n: number) => string;
  severalShapes: (n: number) => string;
  connection: (n: number) => string;
  shapes: { text: string; zone: string; divider: string };
  mixed: (symbols: number, connections: number, shapes: number) => string;
  shared: string;
  differs: string;
  id: string;
  idHelp: string;
  idRenamed: (id: string) => string;
  notAColour: string;
  groups: {
    symbol: string; placement: string; label: string; data: string; medium: string; colours: string; connection: string; route: string;
    words: string; look: string; canvas: string; source: string; more: string;
    /** The things table's settings (phase 35). */
    things?: string;
  };
  /** The fold that holds the diagram's canvas, data and things settings when nothing is selected (next-boilerplate e2e round 3, M-R3-09). */
  advanced: string;
  advancedHint: string;
  /** Under a selected symbol: where the device value it shows is connected (not here; next-boilerplate e2e round 4, M-R4-05). */
  deviceHint: string;
  /** A thing from data, read-only: its heading, the "placed by data" line, a sample row's note and its fields' names. */
  thing: (name: string, id: string) => string;
  placedByData: string;
  thingSample: string;
  thingFields: { symbol: string; place: string; row: string };
  actionsNone: string;
  actionsMissing: string;
  /** The text of a refused edit; the edit model's own English reason by default. */
  refused: (why: string) => string;
}

export const DEFAULT_INSPECTOR_MESSAGES: InspectorMessages = {
  title: 'Inspector',
  tabs: { properties: 'Properties', rules: 'Rules', actions: 'Actions' },
  tabsLabel: 'Inspector sections',
  scene: 'Diagram',
  sceneHint: 'Nothing is selected: these settings apply to the whole diagram.',
  advanced: 'Advanced',
  advancedHint: 'The canvas size, which table columns name the symbols, and things placed from data. Nothing here is needed to draw or connect a diagram.',
  deviceHint: 'Which device value this symbol shows is connected on the device\'s or the site\'s Views once the drawing is saved, not here.',
  symbol: (name, id) => `${name} (${id})`,
  severalSymbols: (n) => `${n} symbols`,
  severalConnections: (n) => `${n} connections`,
  severalShapes: (n) => `${n} titles, zones and dividers`,
  connection: (n) => `Connection ${n}`,
  shapes: { text: 'Title', zone: 'Zone', divider: 'Divider' },
  mixed: (a, b, c) => `You selected ${a} symbols, ${b} connections and ${c} shapes. Select one kind to edit its fields.`,
  shared: 'Showing the fields they share. A change is written to every one of them.',
  differs: 'differs',
  id: 'Id',
  idHelp: 'The symbol\'s short name inside the drawing: connections and rules refer to it. Press Enter or leave the field to rename.',
  idRenamed: (id) => `Renamed to ${id}`,
  notAColour: 'This is not a colour.',
  groups: {
    symbol: 'Symbol', placement: 'Position and size', label: 'Name and number', data: 'Scale and units', medium: 'Medium', colours: 'Colours',
    connection: 'Connection', route: 'Route and look', words: 'Words', look: 'Look', canvas: 'Canvas', source: 'Data', more: 'More',
    things: 'Things from data',
  },
  thing: (name, id) => (name && name !== id ? `${name} (${id})` : id),
  placedByData: 'Placed by data: it moves, appears and disappears with its row, so it cannot be moved or edited here. Rules and actions reach it by its id.',
  thingSample: 'A what-if sample row: it is never stored.',
  thingFields: { symbol: 'Drawn as', place: 'At', row: 'Its row' },
  actionsNone: 'Select a symbol to see its actions.',
  actionsMissing: 'The host has not connected an actions editor.',
  refused: (why) => why,
};

// ─── Problems ────────────────────────────────────────────────────────────────

export interface ProblemsMessages {
  title: string;
  empty: string;
  groups: { error: string; warning: string; info: string };
  /** The summary line ("2 errors, 1 warning"). */
  summary: (errors: number, warnings: number, notes: number) => string;
  /** Names a clickable item for a screen reader ("Select pump1: ..."). */
  select: (id: string, message: string) => string;
  /** A host's own text for a problem (by its code and id), or undefined for the English one. */
  text?: (problem: { severity: string; code: string; id: string; message: string }) => string | undefined;
}

export const DEFAULT_PROBLEMS_MESSAGES: ProblemsMessages = {
  title: 'Problems',
  empty: 'No problems found. Every symbol is placed, every connection ends on a symbol and every rule names something that exists.',
  groups: { error: 'Errors', warning: 'Warnings', info: 'Notes' },
  summary: (e, w, n) => [e && (e === 1 ? '1 error' : `${e} errors`), w && (w === 1 ? '1 warning' : `${w} warnings`), n && (n === 1 ? '1 note' : `${n} notes`)].filter(Boolean).join(', '),
  select: (id, message) => `Select ${id}: ${message}`,
};

// ─── What-if ─────────────────────────────────────────────────────────────────

export interface WhatIfMessages {
  title: string;
  note: string;
  scope: string;
  all: string;
  selected: (id: string) => string;
  value: string;
  value2: string;
  capacity: string;
  running: string;
  status: string;
  real: string;
  statuses: { none: string; warning: string; critical: string };
  params: string;
  noParams: string;
  /** "real value: 12" under an overridden control. */
  realValue: (v: string) => string;
  noData: string;
  useReal: (label: string) => string;
  mixed: string;
  reset: string;
  resetHelp: string;
  matching: string;
  noneMatching: string;
  /** "pump1, pump2 and 3 more" */
  targets: (ids: string[], more: number) => string;
  overridden: (n: number) => string;
  /** The things from data (phase 35): the ids the things table brings, and sample rows to preview them. */
  things: string;
  thingsNote: string;
  noThings: string;
  /** "12 things: cow1, cow2 … and 4 more" */
  thingIds: (ids: string[], more: number, total: number) => string;
  addSample: string;
  sampleFull: string;
  removeSample: (id: string) => string;
  sampleX: string;
  sampleY: string;
}

export const DEFAULT_WHATIF_MESSAGES: WhatIfMessages = {
  title: 'What if',
  note: 'Nothing here is stored. These values only change the preview while the editor is open; the data and the saved diagram stay as they are.',
  scope: 'Change',
  all: 'All symbols',
  selected: (id) => `Selected symbol (${id})`,
  value: 'Value',
  value2: 'Second value',
  capacity: 'Capacity',
  running: 'Running',
  status: 'Status',
  real: 'As in the data',
  statuses: { none: 'Normal', warning: 'Warning', critical: 'Critical' },
  params: 'Board parameters',
  noParams: 'The board has no parameters rules can read.',
  realValue: (v) => `Data: ${v}`,
  noData: 'no data',
  useReal: (label) => `Use the real ${label}`,
  mixed: 'varies',
  reset: 'Reset all',
  resetHelp: 'Put every value back to what the data says',
  matching: 'Rules that match with these values',
  noneMatching: 'No rule matches.',
  targets: (ids, more) => (more > 0 ? `${ids.join(', ')} and ${more} more` : ids.length > 1 ? `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}` : ids[0] ?? ''),
  overridden: (n) => (n === 1 ? '1 value changed' : `${n} values changed`),
  things: 'Things from data',
  thingsNote: 'Placed by the things table, one per row. A sample row shows how a thing and its rules look; it is never stored.',
  noThings: 'The things table brings no rows.',
  thingIds: (ids, more, total) => `${total === 1 ? '1 thing' : `${total} things`}: ${ids.join(', ')}${more > 0 ? ` and ${more} more` : ''}`,
  addSample: 'Add a sample thing',
  sampleFull: 'That is as many sample things as the preview takes.',
  removeSample: (id) => `Remove ${id}`,
  sampleX: 'x',
  sampleY: 'y',
};

/** Every panel's texts together (for a host that keeps one object). */
export interface PanelMessages {
  palette: PaletteMessages;
  inspector: InspectorMessages;
  rules: RulesMessages;
  problems: ProblemsMessages;
  whatIf: WhatIfMessages;
}

export const DEFAULT_PANEL_MESSAGES: PanelMessages = {
  palette: DEFAULT_PALETTE_MESSAGES,
  inspector: DEFAULT_INSPECTOR_MESSAGES,
  rules: DEFAULT_RULES_MESSAGES,
  problems: DEFAULT_PROBLEMS_MESSAGES,
  whatIf: DEFAULT_WHATIF_MESSAGES,
};
