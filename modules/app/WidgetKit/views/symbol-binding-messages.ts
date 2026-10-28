// The English texts of the symbol binding panel. Pure: no React. `SymbolBindingPanel` takes an optional `messages` prop of the
// same shape (any part of it) so the host shows it in its language; whatever it leaves out stays English. A text that
// interpolates is a function of its values. Same pattern as `scene-setup-messages.ts`. Nothing here names a scene key, a slot,
// a role or a match: the panel speaks of the symbol, the device and its values.

import { mergeMessages, type DeepPartial } from './scene-editor-messages-panels';
import { DEFAULT_AGE_WORDS, type AgeWords, type ScriptErrorKind, type ScriptTemplateId } from './symbol-binding-logic';

export type { DeepPartial };
export { mergeMessages };

export interface SymbolBindingMessages {
  /** The accessible name of the whole panel. */
  panel: string;
  close: string;
  cancel: string;

  // 1. Device
  deviceSection: string;
  deviceLabel: string;
  /** The empty state of the device search. */
  devicePlaceholder: string;
  deviceNoResults: string;

  // 2. Values
  valuesSection: string;
  /** Shown in place of the values until a device is picked. */
  valuesNeedDevice: string;
  valuesLoading: string;
  valuesEmpty: string;
  valuesError: string;
  valuesRetry: string;
  /** "and 12 more", under a long list of keys. */
  valuesMore: (n: number) => string;
  /** Under a key in the list: the symbol field it feeds. */
  feeds: (field: string) => string;
  /** The picker's first choice: the field reads nothing. */
  notUsed: string;
  /** The accessible name of a field's picker. */
  fieldPicker: (field: string) => string;
  suggested: string;
  /** A field that reads another device than the one picked. */
  fromOtherDevice: (device: string) => string;
  /** A picked key the device has not sent a value for. */
  noValueYet: string;
  /** "21.5 °C · 4 s ago". */
  valueAndAge: (value: string, age: string) => string;
  age: AgeWords;

  // 3. Convert
  convertSection: string;
  convertHint: string;
  convertNeedsValue: string;
  convertInput: (field: string) => string;
  convertPlaceholder: string;
  templates: Record<ScriptTemplateId, string>;
  /** The live preview. */
  previewWait: string;
  previewResult: (from: string, to: string) => string;
  previewErrors: Record<ScriptErrorKind, (detail: string) => string>;

  // Footer
  save: string;
  next: string;
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
}

export const DEFAULT_SYMBOL_BINDING_MESSAGES: SymbolBindingMessages = {
  panel: 'Symbol data',
  close: 'Close',
  cancel: 'Cancel',

  deviceSection: 'Device',
  deviceLabel: 'Device',
  devicePlaceholder: 'Pick the device that measures this',
  deviceNoResults: 'No device found.',

  valuesSection: 'Values',
  valuesNeedDevice: 'Pick a device to see the values it sends.',
  valuesLoading: 'Loading the values…',
  valuesEmpty: 'This device has not sent any values yet.',
  valuesError: 'The values could not be loaded.',
  valuesRetry: 'Try again',
  valuesMore: (n) => `and ${n} more`,
  feeds: (field) => `feeds ${field}`,
  notUsed: 'Not used',
  fieldPicker: (field) => field,
  suggested: 'Suggested',
  fromOtherDevice: (device) => `from ${device}`,
  noValueYet: 'No value yet',
  valueAndAge: (value, age) => (age ? `${value} · ${age}` : value),
  age: DEFAULT_AGE_WORDS,

  convertSection: 'Convert',
  convertHint: 'Only if the value needs flipping or scaling. Write it with value, for example value / 10.',
  convertNeedsValue: 'Pick a value above first.',
  convertInput: (field) => `Convert ${field}`,
  convertPlaceholder: 'value',
  templates: {
    invert: 'Invert',
    scale: 'Scale 0–100',
    round: 'Round',
    threshold: 'Threshold',
    words: 'Words',
  },
  previewWait: 'Waiting for a value to try it on.',
  previewResult: (from, to) => `${from} → ${to}`,
  previewErrors: {
    syntax: () => 'This is not a complete expression. Check the brackets and signs.',
    name: () => 'Only value can be used here.',
    timeout: () => 'This took too long to work out.',
    other: (detail) => (detail ? `This does not work: ${detail}` : 'This does not work.'),
  },

  save: 'Save',
  next: 'Next symbol',
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
};
