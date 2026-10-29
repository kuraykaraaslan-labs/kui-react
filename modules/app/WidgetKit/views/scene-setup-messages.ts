// The English texts of the scene setup drawer. Pure: no React. `SceneSetupDrawer` takes an optional `messages` prop of the
// same shape (any part of it) so the host shows it in its language; whatever it leaves out stays English. A text that
// interpolates is a function of its values. Same pattern as the diagram editor's panels (`scene-editor-messages-panels`).

import type { MatchHow, BindingIssueCode } from './scene-binding-logic';
import { mergeMessages, type DeepPartial } from './scene-editor-messages-panels';
import type { ConditionMessages } from './scene-rules-form';
import { DEFAULT_DESIGN_RULE_WORDS, type DesignRuleWords } from './design-rules-logic';

export type { DeepPartial };
export { mergeMessages };

/** The texts of the Rules step (5): the condition form's own (`ConditionMessages`, the diagram editor's words) and the step's. */
export interface SceneSetupRulesMessages extends ConditionMessages {
  section: string;
  hint: string;
  add: string;
  empty: string;
  /** Shown instead of the list until a document with scene keys is chosen. */
  needKeys: string;
  /** "2 rules, 1 problem". */
  summary: (rules: number, problems: number) => string;
  /** "rule 3", in the accessible name of a card's buttons. */
  ruleN: (n: number) => string;
  enabled: string;
  moveUp: string;
  moveDown: string;
  duplicate: string;
  delete: string;
  appliesTo: string;
  allItems: string;
  /** A target or row the document has no key for, in the select. */
  missing: (key: string) => string;
  /** The badge on a rule that names a key the document does not have. */
  staleBadge: string;
  staleTarget: (key: string) => string;
  staleOf: (key: string) => string;
  when: string;
  addSecond: string;
  removeSecond: string;
  secondCondition: string;
  join: string;
  joinAll: string;
  joinAny: string;
  then: string;
  colour: string;
  hidden: string;
  pulse: string;
  highlight: string;
  label: string;
  tokens: string;
  insertToken: (token: string) => string;
  noChange: string;
  hide: string;
  show: string;
  pulseOn: string;
  pulseOff: string;
  highlightOn: string;
  highlightOff: string;
  stop: string;
  stopHelp: string;
  /** A stored row that is not a rule of the 3D card: kept as saved until removed. */
  foreignTitle: string;
  foreignBody: string;
  /** The same for a stored 2D diagram's rules (phase 42.5.4). */
  foreignTitle2d: string;
  foreignBody2d: string;
  /** The step's hint for a 2D diagram. */
  hint2d: string;
  /** The effects of a 2D diagram's rule: a state, and a blink. */
  state: string;
  /** By state word (`idle`, `running`, `warning`, `critical`, `off`). */
  states: Record<string, string>;
  blink: string;
  blinkOn: string;
  blinkOff: string;
  problems: (n: number) => string;
  /** What a card says of its rule. */
  words: DesignRuleWords;
}

export interface SceneSetupMessages {
  title: string;
  close: string;
  loading: string;

  // The `choose` mode (next-boilerplate D45-10, e2e round 2 E2E-2.1): the drawer is only "which drawing?"; everything else sits under Advanced
  /** The title in `choose` mode (the host passes the kind's word: "Choose a 3D view"). */
  chooseTitle: string;
  /** The heading over the document table in `choose` mode. */
  chooseSection: string;
  /** What choosing does, in words: the drawing is shown on this page, its symbols are connected there, every page that shows the subject's drawing follows. */
  chooseHint: string;
  /** The one line about the saved connections of another drawing kept in the setup (`choose` mode; the table itself is under Advanced). */
  staleChooseLine: (count: number) => string;
  /** The Advanced fold's summary and its hint. */
  advanced: string;
  advancedHint: string;
  /** A device the setup names that is not in the host's list (a stale entry's device, by name when known). */
  unknownDevice: string;

  // 1. Slot and kind
  slotSection: string;
  slotLabel: string;
  slotHint: string;
  /** The hint when the slot cannot be changed (the card's own). */
  slotLockedHint: string;
  /** The last choice of the slot select. */
  slotNew: string;
  slotNewLabel: string;
  slotNewHint: string;
  /** The confirmation before a slot is switched while the form has edits. */
  slotSwitchTitle: string;
  slotSwitchBody: (slot: string) => string;
  slotSwitchConfirm: string;
  kindLabel: string;
  /** The hint when the kind cannot be changed (the card's own). */
  kindLockedHint: string;
  /** Switching the kind with edits in the form (it starts over from the saved setup of that kind, or an empty one). */
  kindSwitchTitle: string;
  kindSwitchBody: (kind: string) => string;
  kindSwitchConfirm: string;
  /** "Remove this setup": the footer button and its confirmation, which names the kind (as `kinds` has it) and the slot. */
  removeButton: string;
  removeTitle: string;
  removeBody: (kind: string, slot: string) => string;
  removeConfirm: string;
  /** The segmented choice's label by kind value; a kind with no entry shows its value. */
  kinds: Record<string, string>;

  // 2. Document
  documentSection: string;
  documentHint: string;
  documentName: string;
  documentUpdated: string;
  documentUsedBy: string;
  documentUse: (name: string) => string;
  /** The (screen reader only) header of the radio column. */
  documentPick: string;
  documentSearch: string;
  documentsEmpty: string;
  documentFilterUse: string;
  documentFilterAny: string;
  documentFilterUsed: string;
  documentFilterUnused: string;
  /** "Used by 3". */
  usedBy: (n: number) => string;
  newFromDevice: string;
  /** The chosen document under the table. */
  documentChosen: (name: string) => string;
  noDocumentChosen: string;

  // 3. Devices and roles
  devicesSection: string;
  devicesHint: string;
  deviceName: string;
  deviceCode: string;
  deviceRole: string;
  /** The role field's accessible name for one device. */
  roleOf: (device: string) => string;
  mainRole: string;
  roleHint: string;
  devicesEmpty: string;
  deviceSearch: string;
  roleFilter: string;
  roleFilterAny: string;
  roleFilterMain: string;
  roleFilterNamed: string;
  deviceInclude: string;
  /** The include checkbox's accessible name for one device. */
  includeOf: (device: string) => string;
  /** "3 of 100 devices in the scene". */
  devicesIncluded: (included: number, max: number) => string;

  // 4. Matching
  matchSection: string;
  matchHint: string;
  /**
   * Shown instead of a table nobody can fill: the chosen devices offer no grouped elements (a device that sends flat keys, or nothing yet), so
   * the symbols are connected to values on the drawing itself (next-boilerplate E2E-1.4).
   */
  matchNoElements: string;
  keyColumn: string;
  kindColumn: string;
  statusColumn: string;
  elementColumn: string;
  actionsColumn: string;
  matchAuto: string;
  /** Said after "Match automatically" ran. */
  matchedAuto: (matched: number, proposed: number) => string;
  keySearch: string;
  keysEmpty: string;
  statusFilter: string;
  statusAny: string;
  status: Record<MatchHow, string>;
  elementOf: (key: string) => string;
  elementNone: string;
  /** An element a hand pick or the saved binding names that the device no longer offers. */
  elementMissing: (element: string) => string;
  noDeviceForRole: (role: string) => string;
  pick: string;
  pickOf: (key: string) => string;
  picked: (key: string) => string;
  pickedHint: string;
  accept: string;
  acceptOf: (key: string) => string;
  acceptAll: (n: number) => string;
  previewLabel: string;
  /** Leaves a key out of the scene (it goes into the binding's `hidden`). */
  dontBind: string;
  dontBindOf: (key: string) => string;
  bindAgain: string;
  bindAgainOf: (key: string) => string;

  // Saved entries the scene no longer has
  staleSection: string;
  staleHint: string;
  staleKind: { exception: string; role: string; hidden: string };
  staleTypeColumn: string;
  staleNameColumn: string;
  staleDetailColumn: string;
  staleStateColumn: string;
  staleKept: string;
  staleRemoved: string;
  staleRemove: string;
  staleRemoveOf: (kind: string, name: string) => string;
  staleKeep: string;
  staleKeepOf: (kind: string, name: string) => string;
  /** "Reads hatch of Fryer 1": the device by NAME when the host lists it (e2e round 2, E2E-2.18), else `unknownDevice`; never a bare id. */
  staleExceptionDetail: (device: string, element: string) => string;
  staleRoleDetail: (device: string) => string;
  staleHiddenDetail: string;
  staleSearch: string;
  staleEmpty: string;

  // Unresolved
  unresolvedKeys: (n: number) => string;
  allResolved: string;
  unresolvedElements: (n: number) => string;
  unresolvedDevices: (n: number) => string;
  unresolvedRoles: (roles: string[]) => string;
  pendingProposals: (n: number) => string;
  unresolvedStale: (n: number) => string;

  // Save
  save: string;
  saving: string;
  cancel: string;
  nothingChanged: string;
  waitForData: string;
  issue: Record<BindingIssueCode, (subject?: string) => string>;
  confirmTitle: string;
  confirmMessage: (kind: string, mapped: number, unmatched: number) => string;
  confirmButton: string;
  acknowledge: (unmatched: number, proposals: number, stale: number) => string;
  reasonLabel: string;
  reasonPlaceholder: string;
  /** Closing (Escape, the backdrop, Cancel) with edits the person made asks first (next-boilerplate E2E-1.10). */
  discardTitle: string;
  discardBody: string;
  discardConfirm: string;
  discardKeep: string;

  // 5. Rules
  rules: SceneSetupRulesMessages;

  // Conflict and errors
  conflictTitle: string;
  conflictBody: string;
  reload: string;
  /** The saved binding the form started from changed (the host passed a new `initial`) while the form has edits. */
  savedChangedTitle: string;
  savedChangedBody: string;
  /** The drawing changed since the setup was saved (`documentChanged`); `stale` = saved entries the drawing no longer has. */
  documentChangedTitle: string;
  documentChangedBody: (stale: number) => string;
  saveFailed: string;
}

const n = (count: number, one: string, many: string): string => (count === 1 ? `1 ${one}` : `${count} ${many}`);

export const DEFAULT_SCENE_SETUP_MESSAGES: SceneSetupMessages = {
  title: 'Scene',
  close: 'Close',
  loading: 'Loading',

  chooseTitle: 'Choose a drawing',
  chooseSection: 'Which drawing?',
  chooseHint: 'The drawing this device is shown as. After saving it is on this page: connect each symbol there by clicking it. Every page that shows this device\'s drawing shows the one you choose. The same drawing can serve several devices; each device connects its own values.',
  staleChooseLine: (count) => `${n(count, 'connection', 'connections')} made for another drawing ${count === 1 ? 'is' : 'are'} kept in case you switch back.`,
  advanced: 'Advanced',
  advancedHint: 'Slots, roles, the matching table and rules. Nothing here is needed to show a drawing or to connect its symbols.',
  unknownDevice: 'another device',

  slotSection: '1. Slot and kind',
  slotLabel: 'Slot',
  slotHint: 'The place on the page this scene is shown. A page that draws several scenes of one subject gives each its own slot.',
  slotLockedHint: 'The card you opened this from draws this slot.',
  slotNew: 'New slot…',
  slotNewLabel: 'New slot name',
  slotNewHint: 'Lower-case letters, digits, _ and -, at most 32, starting with a letter. A card draws it by this name in its settings.',
  slotSwitchTitle: 'Switch slot',
  slotSwitchBody: (slot) => `Your edits in this form are lost: it starts over from the saved setup of the slot ${slot} (or from an empty one).`,
  slotSwitchConfirm: 'Switch slot',
  kindLabel: 'Kind',
  kindLockedHint: 'The card you opened this from draws this kind.',
  kindSwitchTitle: 'Switch kind',
  kindSwitchBody: (kind) => `Your edits in this form are lost: it starts over from the saved setup of the ${kind} kind (or from an empty one).`,
  kindSwitchConfirm: 'Switch kind',
  removeButton: 'Remove this setup',
  removeTitle: 'Remove the scene setup',
  removeBody: (kind, slot) => `Removes the saved ${kind} setup of the slot ${slot} of this subject. Its boards go back to the scene they would show without it. Other slots and the other kind are not touched.`,
  removeConfirm: 'Remove setup',
  kinds: { diagram: '2D diagram', scene: '2D diagram', design: '3D design' },

  documentSection: '2. Document',
  documentHint: 'The drawing the scene shows. A document can serve several devices.',
  documentName: 'Name',
  documentUpdated: 'Updated',
  documentUsedBy: 'Used by',
  documentUse: (name) => `Use ${name}`,
  documentPick: 'Choose',
  documentSearch: 'Search documents',
  documentsEmpty: 'No document of this kind yet.',
  documentFilterUse: 'Use',
  documentFilterAny: 'Any',
  documentFilterUsed: 'In use',
  documentFilterUnused: 'Not in use',
  usedBy: (count) => `Used by ${count}`,
  newFromDevice: 'New from this device',
  documentChosen: (name) => `Document: ${name}`,
  noDocumentChosen: 'Choose a document.',

  devicesSection: '3. Devices and roles',
  devicesHint: 'A scene with one device reads it as is. With several, each device gets a role: a key like fryer.heater reads the element heater of the device whose role is fryer. Leave one role empty for the main device.',
  deviceName: 'Device',
  deviceCode: 'Code',
  deviceRole: 'Role',
  roleOf: (device) => `Role of ${device}`,
  mainRole: 'Main device',
  roleHint: 'Letters, digits, _ and -; empty = main device.',
  devicesEmpty: 'No device to bind.',
  deviceSearch: 'Search devices',
  roleFilter: 'Role',
  roleFilterAny: 'Any',
  roleFilterMain: 'Main device',
  roleFilterNamed: 'Named role',
  deviceInclude: 'In the scene',
  includeOf: (device) => `Include ${device} in the scene`,
  devicesIncluded: (included, max) => `${included} of ${max} devices in the scene.`,

  matchSection: '4. Match',
  matchHint: 'Each key of the scene reads one element of a device. A key that is the element id needs nothing stored; the rest are saved as exceptions.',
  matchNoElements: 'These devices send no grouped values this table could match, so there is nothing to do here. Save the setup, then connect each symbol where the drawing is shown: click the symbol and pick the value it shows.',
  keyColumn: 'Scene key',
  kindColumn: 'Kind',
  statusColumn: 'Status',
  elementColumn: 'Element',
  actionsColumn: 'Actions',
  matchAuto: 'Match automatically',
  matchedAuto: (matched, proposed) => `${n(matched, 'key matched', 'keys matched')}${proposed ? `, ${proposed} to confirm` : ''}.`,
  keySearch: 'Search scene keys',
  keysEmpty: 'The scene has no keys.',
  statusFilter: 'Status',
  statusAny: 'Any',
  status: {
    key: 'Matched by key',
    label: 'Matched by label',
    type: 'Proposed by type',
    manual: 'Set by hand',
    hidden: 'Not bound',
    none: 'Unmatched',
  },
  elementOf: (key) => `Element for ${key}`,
  elementNone: 'Not matched',
  elementMissing: (element) => `${element} (not on the device)`,
  noDeviceForRole: (role) => (role ? `No device has the role ${role}.` : 'No device is the main device.'),
  pick: 'Pick in the scene',
  pickOf: (key) => `Pick ${key} in the scene`,
  picked: (key) => `Picked in the scene: ${key}`,
  pickedHint: 'Choose the element this key reads.',
  accept: 'Accept',
  acceptOf: (key) => `Accept the proposal for ${key}`,
  acceptAll: (count) => `Accept all proposals (${count})`,
  previewLabel: 'Scene preview',
  dontBind: "Don't bind",
  dontBindOf: (key) => `Do not bind ${key}`,
  bindAgain: 'Bind again',
  bindAgainOf: (key) => `Bind ${key} again`,

  staleSection: 'Saved entries the scene no longer has',
  staleHint: 'The saved setup holds these, but this document or device list has nothing for them. They are kept when you save unless you remove them here.',
  staleKind: { exception: 'Stale exception', role: 'Stale role', hidden: 'Stale hidden key' },
  staleTypeColumn: 'Type',
  staleNameColumn: 'Name',
  staleDetailColumn: 'Detail',
  staleStateColumn: 'State',
  staleKept: 'Kept',
  staleRemoved: 'Removed',
  staleRemove: 'Remove',
  staleRemoveOf: (kind, name) => `Remove the ${kind.toLowerCase()} ${name}`,
  staleKeep: 'Keep',
  staleKeepOf: (kind, name) => `Keep the ${kind.toLowerCase()} ${name}`,
  staleExceptionDetail: (device, element) => `Reads ${element} of ${device}`,
  staleRoleDetail: (device) => `${device} is not in the list`,
  staleHiddenDetail: 'Left out of the scene',
  staleSearch: 'Search saved entries',
  staleEmpty: 'Nothing stale.',

  unresolvedKeys: (count) => `${n(count, 'scene key', 'scene keys')} without an element`,
  allResolved: 'Every scene key has an element.',
  unresolvedElements: (count) => `${n(count, 'element', 'elements')} no key reads`,
  unresolvedDevices: (count) => `${n(count, 'device', 'devices')} no key reads`,
  unresolvedRoles: (roles) => `No device for the role ${roles.join(', ')}`,
  pendingProposals: (count) => `${n(count, 'proposal is', 'proposals are')} not stored until accepted`,
  unresolvedStale: (count) => `${n(count, 'saved entry', 'saved entries')} the scene no longer has, kept until removed`,

  save: 'Save',
  saving: 'Saving',
  cancel: 'Cancel',
  nothingChanged: 'Nothing has changed.',
  waitForData: 'Waiting for the data to load.',
  issue: {
    'document-missing': () => 'Choose a document.',
    'document-invalid': () => 'The document id is not a valid id.',
    'slot-missing': () => 'Give the slot.',
    'slot-invalid': (s) => `The slot ${s ?? ''} is not valid: lower-case letters, digits, _ and -, at most 32, starting with a letter.`,
    'kind-missing': () => 'Choose a kind.',
    'kind-invalid': (s) => `The kind ${s ?? ''} is not valid: lower-case letters, digits and _, at most 32, starting with a letter.`,
    'no-devices': () => 'Bind at least one device.',
    'too-many-devices': () => 'A scene binds at most 100 devices.',
    'too-many-map': () => 'A scene stores at most 500 exceptions.',
    'role-invalid': (s) => `The role ${s ?? ''} is not valid: letters, digits, _ and -, starting with a letter or _.`,
    'role-duplicate': (s) => (s ? `Two devices have the role ${s}.` : 'Two devices are the main device.'),
    'device-missing': (s) => `No device for ${s || 'the main role'}.`,
    'device-invalid': (s) => `The device of ${s || 'the main role'} is not a valid id.`,
    'key-invalid': (s) => `${s ?? ''} is not a valid key: letters, digits, _ . and -, at most 48, starting with a letter or _.`,
    'element-invalid': (s) => `The element of ${s ?? ''} is not a valid element id.`,
    'hidden-invalid': (s) => `${s ?? ''} is not a valid key.`,
    'rule-invalid': (s) => `A rule needs attention: ${s ?? ''}`,
    'entry-empty': (s) => `${s ?? ''} reads neither an element nor a field.`,
    'too-many-fields': (s) => `${s ?? ''} reads more than 16 fields.`,
    'field-invalid': (s) => `${s ?? ''} is not a valid field name: a lower-case letter, then letters, digits and _, at most 32; not a row column.`,
    'field-key-invalid': (s) => `The telemetry key of ${s ?? ''} is not valid: letters, digits, _ . and -, at most 64.`,
    'field-label-invalid': (s) => `The label of ${s ?? ''} is too long (at most 60).`,
    'field-input-invalid': (s) => `An input of ${s ?? ''} is not valid: at most 4, each a lower-case word of at most 16 characters that is not a word of the formula language, with a telemetry key.`,
  },
  rules: {
    section: '5. Rules',
    hint: 'A rule makes an item of the scene follow the data: when a reading is above a limit, colour it, make it pulse or show a note. Rules are kept with this setup and run in the live view.',
    add: 'Add rule',
    empty: 'No rules yet.',
    needKeys: 'Choose a document with scene keys to add rules.',
    summary: (rules, problems) => `${rules === 1 ? '1 rule' : `${rules} rules`}${problems ? `, ${problems === 1 ? '1 problem' : `${problems} problems`}` : ''}`,
    ruleN: (num) => `rule ${num}`,
    enabled: 'On',
    moveUp: 'Move up',
    moveDown: 'Move down',
    duplicate: 'Duplicate',
    delete: 'Delete',
    appliesTo: 'Applies to',
    allItems: 'Every item (*)',
    missing: (key) => `${key} (not in the document)`,
    staleBadge: 'Key not in the document',
    staleTarget: (key) => `The document has no item with the key ${key}: the rule does nothing until it has one.`,
    staleOf: (key) => `The document has no item with the key ${key}: the condition reads nothing.`,
    when: 'When',
    addSecond: 'Add a second condition',
    removeSecond: 'Remove the second condition',
    secondCondition: 'And / or when',
    join: 'Both or either',
    joinAll: 'Both hold (and)',
    joinAny: 'Either holds (or)',
    then: 'Then',
    colour: 'Colour',
    hidden: 'Hide',
    pulse: 'Pulse',
    highlight: 'Outline',
    label: 'Label',
    tokens: 'Insert a value into the label',
    insertToken: (token) => `Insert ${token}`,
    noChange: 'No change',
    hide: 'Hide the item',
    show: 'Show the item',
    pulseOn: 'Pulse',
    pulseOff: 'Do not pulse',
    highlightOn: 'Outline it',
    highlightOff: 'Do not outline',
    stop: 'Stop here',
    stopHelp: 'Later rules do not apply to the same item.',
    foreignTitle: 'Not a rule of the 3D card',
    foreignBody: 'This saved row has fields the 3D card does not read, so it is not shown as a rule. It is kept until you delete it; the save waits for that.',
    foreignTitle2d: 'Not a rule of the 2D diagram',
    foreignBody2d: 'This saved row has fields the 2D diagram does not read, so it is not shown as a rule. It is kept until you delete it; the save waits for that.',
    hint2d: 'A rule makes a symbol of the diagram follow the data: when a reading is above a limit, set its state, colour it, make it blink or show a note. These rules are kept with this setup and run after the diagram\'s own rules, only for this subject.',
    state: 'State',
    states: { idle: 'Idle', running: 'Running', warning: 'Warning', critical: 'Critical', off: 'Off' },
    blink: 'Blink',
    blinkOn: 'Blink',
    blinkOff: 'Do not blink',
    problems: (num) => (num === 1 ? '1 problem' : `${num} problems`),
    read: 'Read',
    column: 'A value of a symbol',
    parameter: 'A board parameter',
    columnLabel: 'Which value',
    parameterLabel: 'Parameter',
    ofRow: 'Of symbol',
    ownRow: 'This symbol',
    operator: 'Operator',
    alwaysOption: 'Always (no condition)',
    opLabels: {
      eq: 'is', ne: 'is not', gt: 'is above', gte: 'is at least', lt: 'is below', lte: 'is at most', between: 'is between', in: 'is one of', set: 'is set', unset: 'is not set', true: 'is on', false: 'is off',
    },
    list: 'Values, separated by commas',
    value: 'Value',
    upTo: 'Up to',
    words: DEFAULT_DESIGN_RULE_WORDS,
  },
  confirmTitle: 'Save the scene setup',
  // in words a person who knows no key or slot can read (next-boilerplate E2E-1.13): what is saved, and what still reads nothing
  confirmMessage: (kind, mapped, unmatched) =>
    `Saves this ${kind} setup${mapped ? `, with ${n(mapped, 'symbol connected', 'symbols connected')} by hand` : ''}. ${unmatched ? `${n(unmatched, 'symbol reads', 'symbols read')} nothing yet; connect them on the drawing afterwards.` : 'Every symbol has a value.'}`,
  confirmButton: 'Save setup',
  discardTitle: 'Discard your changes?',
  discardBody: 'This setup has changes that were not saved.',
  discardConfirm: 'Discard changes',
  discardKeep: 'Keep editing',
  acknowledge: (unmatched, proposals, stale) => {
    const parts = [
      unmatched ? n(unmatched, 'scene key stays', 'scene keys stay') + ' unmatched' : '',
      proposals ? n(proposals, 'proposal is', 'proposals are') + ' not accepted and not saved' : '',
      stale ? n(stale, 'saved entry the scene no longer has is', 'saved entries the scene no longer has are') + ' kept' : '',
    ].filter(Boolean);
    return `I know that ${parts.join(' and ')}.`;
  },
  reasonLabel: 'Reason (optional)',
  reasonPlaceholder: 'Why the setup changes',

  conflictTitle: 'Someone else changed this setup',
  conflictBody: 'The saved setup is newer than the one you started from. Reload to see it, or save again to replace it with yours.',
  reload: 'Reload',
  savedChangedTitle: 'The saved version changed',
  savedChangedBody: 'A newer saved setup arrived while you were editing. Reload to start over from it and lose your edits, or keep editing.',
  documentChangedTitle: 'The drawing changed since this was set up',
  documentChangedBody: (stale) =>
    `Review the matching below.${stale ? ` ${n(stale, 'saved entry', 'saved entries')} no longer match the drawing and ${stale === 1 ? 'is' : 'are'} listed under the table.` : ''} If it is still right, Save renews the setup against the drawing as it is now.`,
  saveFailed: 'The setup could not be saved.',
};
