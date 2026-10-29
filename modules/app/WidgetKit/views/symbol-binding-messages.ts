// The English texts of the symbol binding panel. Pure: no React. `SymbolBindingPanel` takes an optional `messages` prop of the
// same shape (any part of it) so the host shows it in its language; whatever it leaves out stays English. A text that
// interpolates is a function of its values. Same pattern as `scene-setup-messages.ts`. Nothing here names a scene key, a slot,
// a role or a match: the panel speaks of the symbol, the device and its values.

import { mergeMessages, type DeepPartial } from './scene-editor-messages-panels';
import { DEFAULT_AGE_WORDS, type AgeWords, type Mismatch, type ScriptErrorKind, type ScriptTemplateId } from './symbol-binding-logic';

export type { DeepPartial };
export { mergeMessages };

export interface SymbolBindingMessages {
  /** The accessible name of the whole panel. */
  panel: string;
  close: string;
  cancel: string;
  /** "12 of 31 symbols connected" in the header. */
  progress: (connected: number, total: number) => string;

  // 1. Device
  deviceSection: string;
  deviceLabel: string;
  /** The empty state of the device search. */
  devicePlaceholder: string;
  deviceNoResults: string;

  // 2. What the symbol shows: one row per thing the symbol draws
  rowsSection: string;
  /** Under the parameter's name: what the symbol shows now. */
  showsNow: (value: string) => string;
  showsNothing: string;
  /** The accessible name of a row (a parameter of the drawing). */
  rowLabel: (field: string) => string;
  /** The choice of what a row reads. */
  sourceLabel: (field: string) => string;
  sourceValue: string;
  sourceExpression: string;
  /** The accessible name of a field's picker. */
  fieldPicker: (field: string) => string;
  pickerPlaceholder: string;
  pickerNoResults: string;
  /** The description of a picker option: the live value and its age; the suggested one says so first. */
  optionLine: (value: string, age: string) => string;
  suggestedOption: (line: string) => string;
  /** The picker's first choice: the field reads nothing. */
  notUsed: string;
  suggested: string;
  /** "Suggested: Supply temperature" with a one-tap accept, on an empty row whose best candidate is not certain. */
  suggestedCandidate: (name: string) => string;
  useSuggestion: string;
  /** Beside a field whose value is found by the drawing's own naming, with no setting of its own. */
  automatic: string;
  /** The read-only line of an automatic row, and the link that opens it. */
  automaticLine: (name: string, value: string) => string;
  change: string;
  /** An empty row says what to do. */
  unsetHint: string;
  /** A field that reads another device than the one picked. */
  fromOtherDevice: (device: string) => string;
  /** A picked key the device has not sent a value for. */
  noValueYet: string;
  /** "21.5 °C · 4 s ago". */
  valueAndAge: (value: string, age: string) => string;
  /** The kind problem of a picked value, in words, and the way out. */
  mismatch: Record<Mismatch, string>;
  convertInstead: string;
  age: AgeWords;

  // 3. The expression of a row (source = An expression)
  expressionLabel: (field: string) => string;
  expressionPlaceholder: string;
  expressionHint: string;
  /** The chips of the values an expression can use. */
  namesTitle: string;
  nameChip: (name: string, value: string) => string;
  insertName: (name: string) => string;
  removeInput: (name: string) => string;
  addInput: string;
  addInputPlaceholder: string;
  inputsFull: (max: number) => string;
  expressionNeedsSomething: string;
  templates: Record<ScriptTemplateId, string>;
  /** The live preview. */
  previewWait: string;
  previewResult: (from: string, to: string) => string;
  resultNow: (to: string) => string;
  previewErrors: Record<ScriptErrorKind, (detail: string) => string>;

  // 4. All values of the device (collapsed)
  valuesSection: string;
  valuesToggle: (n: number) => string;
  /** Shown in place of the values until a device is picked. */
  valuesNeedDevice: string;
  valuesLoading: string;
  valuesEmpty: string;
  valuesError: string;
  valuesRetry: string;
  /** "and 12 more", under a long list of keys. */
  valuesMore: (n: number) => string;
  /** The values table's column headings, and its search box (a long list only). */
  valuesName: string;
  valuesValue: string;
  valuesUpdated: string;
  valuesSearch: string;
  /** Under a key in the list: the symbol field it feeds. */
  feeds: (field: string) => string;

  // Footer
  save: string;
  next: string;
  /** "Next symbol" when it will write first (something is filled in that is not saved yet): the person is told that a press saves. */
  saveAndNext: string;
  more: string;
  clear: string;
  clearTitle: string;
  clearBody: string;
  clearConfirm: string;
  discardTitle: string;
  discardBody: string;
  discardConfirm: string;
  keepEditing: string;
  readOnlyNote: string;
  /** The keyboard, said once under the rows. */
  keysHint: string;

  // Match everything (U3): the preview of every proposal of the drawing
  matchAll: {
    title: string;
    intro: (proposed: number, confident: number) => string;
    empty: string;
    /** While the host reads the devices' values: nothing is proposed yet, and Cancel still works. */
    loading: string;
    symbol: string;
    parameter: string;
    proposed: string;
    confidence: string;
    sure: string;
    maybe: string;
    mismatch: string;
    selectAll: string;
    selectRow: string;
    apply: (n: number) => string;
    cancel: string;
    tableLabel: string;
  };
}

export const DEFAULT_SYMBOL_BINDING_MESSAGES: SymbolBindingMessages = {
  panel: 'Symbol data',
  close: 'Close',
  cancel: 'Cancel',
  progress: (connected, total) => `${connected} of ${total} symbols connected`,

  deviceSection: 'Device',
  deviceLabel: 'Device',
  devicePlaceholder: 'Pick the device that measures this',
  deviceNoResults: 'No device found.',

  rowsSection: 'What this symbol shows',
  showsNow: (value) => `Shows ${value} now`,
  showsNothing: 'Shows nothing yet',
  rowLabel: (field) => field,
  sourceLabel: (field) => `Source of ${field}`,
  sourceValue: 'A device value',
  sourceExpression: 'An expression',
  fieldPicker: (field) => field,
  pickerPlaceholder: 'Pick a value…',
  pickerNoResults: 'No value matches.',
  optionLine: (value, age) => (age ? `${value} · ${age}` : value),
  suggestedOption: (line) => `Suggested · ${line}`,
  notUsed: 'Not used',
  suggested: 'Suggested',
  suggestedCandidate: (name) => `Suggested: ${name}`,
  useSuggestion: 'Use',
  automatic: 'automatic',
  automaticLine: (name, value) => (value ? `${name} · ${value}` : name),
  change: 'Change',
  unsetHint: 'Pick the value this reads, or choose An expression.',
  fromOtherDevice: (device) => `from ${device}`,
  noValueYet: 'No value yet',
  valueAndAge: (value, age) => (age ? `${value} · ${age}` : value),
  mismatch: {
    'text-for-number': 'This value is text; the drawing expects a number.',
    'state-for-number': 'This value is on/off; the drawing expects a number.',
    'number-for-state': 'This value is a number; the drawing expects on/off.',
    'text-for-state': 'This value is text; the drawing expects on/off.',
    'number-for-text': 'This value is a number; the drawing shows a status here.',
    quantity: 'This value measures something else than the drawing shows here.',
  },
  convertInstead: 'Convert it with an expression',
  age: DEFAULT_AGE_WORDS,

  expressionLabel: (field) => `Expression for ${field}`,
  expressionPlaceholder: 'value / 10',
  expressionHint: 'One line. Use the names below; tap one to insert it.',
  namesTitle: 'Values it can use',
  nameChip: (name, value) => (value ? `${name} · ${value}` : name),
  insertName: (name) => `Insert ${name}`,
  removeInput: (name) => `Remove ${name}`,
  addInput: 'Add a value',
  addInputPlaceholder: 'Pick another value to use…',
  inputsFull: (max) => `An expression uses at most ${max} other values.`,
  expressionNeedsSomething: 'Write the expression, or add a value it can use.',
  templates: {
    invert: 'Invert',
    scale: 'Scale 0–100',
    round: 'Round',
    threshold: 'Threshold',
    words: 'Words',
  },
  previewWait: 'Waiting for a value to try it on.',
  previewResult: (from, to) => `${from} → ${to}`,
  resultNow: (to) => `Result now: ${to}`,
  previewErrors: {
    syntax: (detail) => (detail ? `This is not a complete expression: ${detail}` : 'This is not a complete expression. Check the brackets and signs.'),
    name: (detail) => (detail ? `A name here is not known: ${detail}` : 'Only the names below can be used here.'),
    timeout: () => 'This took too long to work out.',
    other: (detail) => (detail ? `This does not work: ${detail}` : 'This does not work.'),
  },

  valuesSection: 'Values',
  valuesToggle: (n) => `All values of this device (${n})`,
  valuesNeedDevice: 'Pick a device to see the values it sends.',
  valuesLoading: 'Loading the values…',
  valuesEmpty: 'This device has not sent any values yet.',
  valuesError: 'The values could not be loaded.',
  valuesRetry: 'Try again',
  valuesMore: (n) => `and ${n} more`,
  valuesName: 'Name',
  valuesValue: 'Value',
  valuesUpdated: 'Updated',
  valuesSearch: 'Search the values',
  feeds: (field) => `feeds ${field}`,

  save: 'Save',
  next: 'Next symbol',
  saveAndNext: 'Save and next',
  more: 'More',
  clear: 'Clear what this symbol reads',
  clearTitle: 'Clear this symbol',
  clearBody: 'This symbol will stop reading from any device. The symbol stays on the drawing.',
  clearConfirm: 'Clear',
  discardTitle: 'Discard your changes?',
  discardBody: 'What you changed on this symbol is not saved.',
  discardConfirm: 'Discard',
  keepEditing: 'Keep editing',
  readOnlyNote: 'You can look at this symbol but not change it.',
  keysHint: 'Arrow keys move between rows, Enter takes the suggestion, Esc closes.',

  matchAll: {
    title: 'Match everything',
    intro: (proposed, confident) => `${proposed} values proposed for this drawing; ${confident} are certain and ticked. Untick what is wrong, then apply.`,
    empty: 'Nothing to propose: every symbol is connected, or the devices have not sent values yet.',
    loading: 'Reading the values of the devices…',
    symbol: 'Symbol',
    parameter: 'Shows',
    proposed: 'Reads',
    confidence: 'Certain',
    sure: 'Yes',
    maybe: 'Possible',
    mismatch: 'Check the kind',
    selectAll: 'Apply all proposals',
    selectRow: 'Apply this proposal',
    apply: (n) => (n === 1 ? 'Apply 1 proposal' : `Apply ${n} proposals`),
    cancel: 'Cancel',
    tableLabel: 'Proposals',
  },
};
