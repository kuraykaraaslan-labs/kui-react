// The English texts of the scene setup drawer. Pure: no React. `SceneSetupDrawer` takes an optional `messages` prop of the
// same shape (any part of it) so the host shows it in its language; whatever it leaves out stays English. A text that
// interpolates is a function of its values. Same pattern as the diagram editor's panels (`scene-editor-messages-panels`).

import type { MatchHow, BindingIssueCode } from './scene-binding-logic';
import { mergeMessages, type DeepPartial } from './scene-editor-messages-panels';

export type { DeepPartial };
export { mergeMessages };

export interface SceneSetupMessages {
  title: string;
  close: string;
  loading: string;

  // 1. Slot and kind
  slotSection: string;
  slotLabel: string;
  slotHint: string;
  kindLabel: string;
  /** The segmented choice's label by kind value; a kind with no entry shows its value. */
  kinds: Record<string, string>;

  // 2. Document
  documentSection: string;
  documentHint: string;
  documentName: string;
  documentUpdated: string;
  documentUsedBy: string;
  documentUse: (name: string) => string;
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

  // 4. Matching
  matchSection: string;
  matchHint: string;
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

  // Unresolved
  unresolvedKeys: (n: number) => string;
  allResolved: string;
  unresolvedElements: (n: number) => string;
  unresolvedDevices: (n: number) => string;
  unresolvedRoles: (roles: string[]) => string;
  pendingProposals: (n: number) => string;

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
  acknowledge: (unmatched: number, proposals: number) => string;
  reasonLabel: string;
  reasonPlaceholder: string;

  // Conflict and errors
  conflictTitle: string;
  conflictBody: string;
  reload: string;
  saveFailed: string;
}

const n = (count: number, one: string, many: string): string => (count === 1 ? `1 ${one}` : `${count} ${many}`);

export const DEFAULT_SCENE_SETUP_MESSAGES: SceneSetupMessages = {
  title: 'Scene',
  close: 'Close',
  loading: 'Loading',

  slotSection: '1. Slot and kind',
  slotLabel: 'Slot',
  slotHint: 'The place on the page this scene is shown.',
  kindLabel: 'Kind',
  kinds: { diagram: '2D diagram', scene: '2D diagram', design: '3D design' },

  documentSection: '2. Document',
  documentHint: 'The drawing the scene shows. A document can serve several devices.',
  documentName: 'Name',
  documentUpdated: 'Updated',
  documentUsedBy: 'Used by',
  documentUse: (name) => `Use ${name}`,
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

  matchSection: '4. Match',
  matchHint: 'Each key of the scene reads one element of a device. A key that is the element id needs nothing stored; the rest are saved as exceptions.',
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

  unresolvedKeys: (count) => `${n(count, 'scene key', 'scene keys')} without an element`,
  allResolved: 'Every scene key has an element.',
  unresolvedElements: (count) => `${n(count, 'element', 'elements')} no key reads`,
  unresolvedDevices: (count) => `${n(count, 'device', 'devices')} no key reads`,
  unresolvedRoles: (roles) => `No device for the role ${roles.join(', ')}`,
  pendingProposals: (count) => `${n(count, 'proposal is', 'proposals are')} not stored until accepted`,

  save: 'Save',
  saving: 'Saving',
  cancel: 'Cancel',
  nothingChanged: 'Nothing has changed.',
  waitForData: 'Waiting for the data to load.',
  issue: {
    'document-missing': () => 'Choose a document.',
    'slot-missing': () => 'Give the slot.',
    'kind-missing': () => 'Choose a kind.',
    'no-devices': () => 'Bind at least one device.',
    'too-many-devices': () => 'A scene binds at most 100 devices.',
    'too-many-map': () => 'A scene stores at most 500 exceptions.',
    'role-invalid': (s) => `The role ${s ?? ''} is not valid: letters, digits, _ and -, starting with a letter or _.`,
    'role-duplicate': (s) => (s ? `Two devices have the role ${s}.` : 'Two devices are the main device.'),
    'device-missing': (s) => `No device for ${s || 'the main role'}.`,
    'key-invalid': (s) => `${s ?? ''} is not a valid key: letters, digits, _ . and -, at most 48, starting with a letter or _.`,
    'element-invalid': (s) => `The element of ${s ?? ''} is not a valid element id.`,
    'hidden-invalid': (s) => `${s ?? ''} is not a valid key.`,
  },
  confirmTitle: 'Save the scene setup',
  confirmMessage: (kind, mapped, unmatched) =>
    `Saves the ${kind} setup for this slot, with ${n(mapped, 'exception', 'exceptions')}. ${unmatched ? `${n(unmatched, 'key stays', 'keys stay')} unmatched.` : 'Every key is matched.'}`,
  confirmButton: 'Save setup',
  acknowledge: (unmatched, proposals) => {
    const parts = [unmatched ? n(unmatched, 'scene key stays', 'scene keys stay') + ' unmatched' : '', proposals ? n(proposals, 'proposal is', 'proposals are') + ' not accepted and not saved' : ''].filter(Boolean);
    return `I know that ${parts.join(' and ')}.`;
  },
  reasonLabel: 'Reason (optional)',
  reasonPlaceholder: 'Why the setup changes',

  conflictTitle: 'Someone else changed this setup',
  conflictBody: 'The saved setup is newer than the one you started from. Reload to see it, or save again to replace it with yours.',
  reload: 'Reload',
  saveFailed: 'The setup could not be saved.',
};
