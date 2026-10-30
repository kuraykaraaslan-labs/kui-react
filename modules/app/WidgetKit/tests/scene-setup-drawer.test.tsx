import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SceneSetupDrawer, type SceneSetupDrawerProps } from '../views/SceneSetupDrawer';

const DOC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DOC_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const D3 = '33333333-3333-4333-8333-333333333333';
const DOCS = [
  { id: DOC_A, name: 'Fryer line', updatedAt: '2026-10-01T10:00:00Z', usedBy: 3 },
  { id: DOC_B, name: 'Grill station', updatedAt: '2026-10-20T10:00:00Z', usedBy: 0 },
];
const KEYS = [
  { key: 'heater', kind: 'symbol', label: 'Heater' },
  { key: 'pump', kind: 'symbol', label: 'Circulation' },
  { key: 'fan', kind: 'symbol', catalogue: 'fan' },
  { key: 'ghost', kind: 'symbol' },
];
const ELEMENTS = [
  { element: 'heater', deviceId: D1 },
  { element: 'p_main', label: 'Circulation', deviceId: D1 },
  { element: 'blower', deviceId: D1, catalogue: 'fan' },
  { element: 'spare', deviceId: D1 },
];
const DEVICES = [{ id: D1, label: 'Fryer 1', code: 'FRY-1' }];

function props(over: Partial<SceneSetupDrawerProps> = {}): SceneSetupDrawerProps {
  return {
    open: true, onClose: vi.fn(), kinds: ['diagram', 'design'], documents: DOCS, devices: DEVICES, sceneKeys: KEYS, elements: ELEMENTS,
    onSave: vi.fn(), initial: { slot: 'main', kind: 'design', documentId: DOC_A }, ...over,
  };
}

/** The element select of a key's row. */
const elementOf = (key: string) => screen.getByLabelText(`Element for ${key}`) as HTMLSelectElement;
const statusOf = (key: string) => {
  const row = elementOf(key).closest('tr')!;
  return within(row).getByText(/Matched by|Proposed by|Set by hand|Not bound|Unmatched/).textContent;
};

describe('SceneSetupDrawer: layout', () => {
  it('is a drawer with the sections of D42-10 as one form, no tabs', () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(screen.getByRole('dialog', { name: 'Scene' })).toBeInTheDocument();
    for (const h of ['1. Type', '2. Document', '3. Devices and roles', '4. Match']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getAllByRole('region').length).toBeGreaterThan(0);
  });
  it('renders nothing while closed', () => {
    render(<SceneSetupDrawer {...props({ open: false })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('goes full width on a phone and wide from sm', () => {
    render(<SceneSetupDrawer {...props()} />);
    const panel = screen.getByRole('dialog').querySelector('[tabindex="-1"]') as HTMLElement;
    expect(panel.className).toContain('w-full');
    expect(panel.className).toContain('sm:w-[min(100vw,60rem)]');
  });
  it('takes the texts from the messages prop', () => {
    render(<SceneSetupDrawer {...props({ messages: { title: 'Sahne', kindSection: '1. Tür' } })} />);
    expect(screen.getByRole('dialog', { name: 'Sahne' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Tür' })).toBeInTheDocument();
  });
});

describe('SceneSetupDrawer: the type', () => {
  it('shows the kinds the host passes, the initial one pressed, and no slot field', () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(screen.queryByLabelText('Slot')).toBeNull();
    expect(screen.getByRole('button', { name: '3D design' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2D diagram' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('offers only the kinds passed, and reports a change', async () => {
    const onKindChange = vi.fn();
    render(<SceneSetupDrawer {...props({ kinds: ['design'], onKindChange })} />);
    expect(screen.queryByRole('button', { name: '2D diagram' })).toBeNull();
    expect(screen.getByRole('button', { name: '3D design' })).toBeInTheDocument();
    const user = userEvent.setup();
    const r2 = render(<SceneSetupDrawer {...props({ kinds: ['diagram', 'design'], onKindChange })} />);
    await user.click(within(r2.baseElement).getAllByRole('button', { name: '2D diagram' })[0]);
    expect(onKindChange).toHaveBeenCalledWith('diagram');
  });
});

describe('SceneSetupDrawer: document', () => {
  it('lists the documents in a DataTable with name, updated and used by, searchable and sortable', async () => {
    render(<SceneSetupDrawer {...props()} />);
    const table = screen.getByRole('table', { name: '2. Document' });
    expect(within(table).getByText('Fryer line')).toBeInTheDocument();
    expect(within(table).getByText('Used by 3')).toBeInTheDocument();
    expect(within(table).getByText('Used by 0')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search documents' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Updated/ })).toBeInTheDocument();
    // Sorted by update, newest first; a click on Name sorts by name.
    const names = () => within(table).getAllByRole('row').slice(1).map((r) => within(r).queryByText(/Fryer line|Grill station/)?.textContent);
    expect(names()).toEqual(['Grill station', 'Fryer line']);
    await userEvent.setup().click(within(table).getByRole('columnheader', { name: /Name/ }).querySelector('button')!);
    expect(names()).toEqual(['Fryer line', 'Grill station']);
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Search documents' }), 'grill');
    expect(names()).toEqual(['Grill station']);
  });
  it('marks the initial document and chooses another by its radio, reporting it', async () => {
    const onDocumentChange = vi.fn();
    render(<SceneSetupDrawer {...props({ onDocumentChange })} />);
    expect(screen.getByRole('radio', { name: 'Use Fryer line' })).toBeChecked();
    expect(screen.getByText('Document: Fryer line')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Use Grill station' }));
    expect(onDocumentChange).toHaveBeenCalledWith(DOC_B);
    expect(screen.getByRole('radio', { name: 'Use Grill station' })).toBeChecked();
  });
  it('a click on the row chooses it too', async () => {
    const onDocumentChange = vi.fn();
    render(<SceneSetupDrawer {...props({ onDocumentChange })} />);
    await userEvent.setup().click(screen.getByText('Grill station'));
    expect(onDocumentChange).toHaveBeenCalledWith(DOC_B);
  });
  it('has the "New from this device" button only when the host gives the callback', async () => {
    const onNewFromDevice = vi.fn();
    const a = render(<SceneSetupDrawer {...props()} />);
    expect(screen.queryByRole('button', { name: 'New from this device' })).toBeNull();
    a.unmount();
    render(<SceneSetupDrawer {...props({ onNewFromDevice })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'New from this device' }));
    expect(onNewFromDevice).toHaveBeenCalled();
  });
  it('chooses the document the host answers with, and nothing when it answers none or fails', async () => {
    const onDocumentChange = vi.fn();
    const user = userEvent.setup();
    const ok = render(<SceneSetupDrawer {...props({ onDocumentChange, onNewFromDevice: async () => DOC_B })} />);
    await user.click(screen.getByRole('button', { name: 'New from this device' }));
    expect(onDocumentChange).toHaveBeenCalledExactlyOnceWith(DOC_B);
    expect(screen.getByRole('radio', { name: 'Use Grill station' })).toBeChecked();
    ok.unmount();
    onDocumentChange.mockClear();
    const none = render(<SceneSetupDrawer {...props({ onDocumentChange, onNewFromDevice: async () => undefined })} />);
    await user.click(screen.getByRole('button', { name: 'New from this device' }));
    none.unmount();
    render(<SceneSetupDrawer {...props({ onDocumentChange, onNewFromDevice: async () => { throw new Error('refused'); } })} />);
    await user.click(screen.getByRole('button', { name: 'New from this device' }));
    expect(onDocumentChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Use Fryer line' })).toBeChecked();
  });
  it('empty and loading states', () => {
    const a = render(<SceneSetupDrawer {...props({ documents: [], initial: {} })} />);
    expect(screen.getByText('No document of this kind yet.')).toBeInTheDocument();
    expect(screen.getAllByText('Choose a document.').length).toBeGreaterThan(0);
    a.unmount();
    render(<SceneSetupDrawer {...props({ documentsLoading: true })} />);
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
  });
});

describe('SceneSetupDrawer: devices and roles', () => {
  const two = [{ id: D1, label: 'Fryer 1', code: 'KITCHEN-FRYER' }, { id: D2, label: 'Grill 1', code: 'grill-1' }];
  it('lists the devices with an editable role, empty (main) for a single device', () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(screen.getByLabelText('Role of Fryer 1')).toHaveValue('');
  });
  it('proposes roles from the codes for several devices, with the scene roles first, and lets the user change one', async () => {
    render(<SceneSetupDrawer {...props({ devices: two, roles: ['fryer'], elements: [], sceneKeys: [] })} />);
    expect(screen.getByLabelText('Role of Fryer 1')).toHaveValue('fryer');
    expect(screen.getByLabelText('Role of Grill 1')).toHaveValue('grill-1');
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Role of Grill 1'));
    await user.type(screen.getByLabelText('Role of Grill 1'), 'grill');
    expect(screen.getByLabelText('Role of Grill 1')).toHaveValue('grill');
  });
  it('uses the role of the saved binding and the one the host proposes', () => {
    render(<SceneSetupDrawer {...props({
      devices: [{ id: D1, label: 'Fryer 1' }, { id: D2, label: 'Grill 1', role: 'bbq' }], initial: { devices: { fryer: D1 } },
    })} />);
    expect(screen.getByLabelText('Role of Fryer 1')).toHaveValue('fryer');
    expect(screen.getByLabelText('Role of Grill 1')).toHaveValue('bbq');
  });
  it('flags a duplicate role and keeps Save off', async () => {
    render(<SceneSetupDrawer {...props({ devices: two })} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Role of Grill 1'));
    await user.type(screen.getByLabelText('Role of Grill 1'), 'fryer');
    await user.clear(screen.getByLabelText('Role of Fryer 1'));
    await user.type(screen.getByLabelText('Role of Fryer 1'), 'fryer');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getAllByText('Two devices have the role fryer.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Role of Fryer 1')).toHaveAttribute('aria-invalid', 'true');
  });
  it('empty state', () => {
    render(<SceneSetupDrawer {...props({ devices: [] })} />);
    expect(screen.getByText('No device to bind.')).toBeInTheDocument();
  });
});

describe('SceneSetupDrawer: matching', () => {
  it('shows a row per scene key, matched by key at once and the rest unmatched until Match automatically', () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(elementOf('heater')).toHaveValue(String(0));
    expect(statusOf('heater')).toBe('Matched by key');
    expect(statusOf('pump')).toBe('Unmatched');
    expect(elementOf('pump')).toHaveValue('');
    expect(screen.getByText('3 scene keys without an element')).toBeInTheDocument();
  });
  it('Match automatically fills the rows by label and flags the type proposals', async () => {
    render(<SceneSetupDrawer {...props()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Match automatically' }));
    expect(statusOf('pump')).toBe('Matched by label');
    expect(elementOf('pump').selectedOptions[0].textContent).toBe('Circulation (p_main)');
    expect(statusOf('fan')).toBe('Proposed by type');
    expect(elementOf('fan').selectedOptions[0].textContent).toBe('blower');
    expect(statusOf('ghost')).toBe('Unmatched');
    expect(screen.getByText('2 keys matched, 1 to confirm.')).toBeInTheDocument();
    expect(screen.getByText('1 proposal is not stored until accepted')).toBeInTheDocument();
    expect(screen.getByText('2 scene keys without an element')).toBeInTheDocument();
  });
  it('a manual pick sets the row, can be changed, and picking the identity element drops the exception', async () => {
    render(<SceneSetupDrawer {...props()} />);
    const user = userEvent.setup();
    await user.selectOptions(elementOf('ghost'), 'spare');
    expect(statusOf('ghost')).toBe('Set by hand');
    expect(elementOf('ghost').selectedOptions[0].textContent).toBe('spare');
    await user.selectOptions(elementOf('ghost'), '');
    expect(statusOf('ghost')).toBe('Unmatched');
    await user.selectOptions(elementOf('heater'), 'spare');
    expect(statusOf('heater')).toBe('Set by hand');
    await user.selectOptions(elementOf('heater'), 'heater');
    expect(statusOf('heater')).toBe('Matched by key');
  });
  it('an element that matched by key cannot be left empty (nothing could store it)', () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(within(elementOf('heater')).queryByRole('option', { name: 'Not matched' })).toBeNull();
    expect(within(elementOf('ghost')).getByRole('option', { name: 'Not matched' })).toBeInTheDocument();
  });
  it('Accept turns a proposal into a hand pick, and Accept all does so for every proposal', async () => {
    render(<SceneSetupDrawer {...props()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Match automatically' }));
    await user.click(screen.getByRole('button', { name: 'Accept the proposal for fan' }));
    expect(statusOf('fan')).toBe('Set by hand');
    expect(screen.queryByRole('button', { name: 'Accept the proposal for fan' })).toBeNull();
  });
  it('Accept all proposals', async () => {
    render(<SceneSetupDrawer {...props({ sceneKeys: [{ key: 'f1', kind: 'symbol', catalogue: 'fan' }], elements: [{ element: 'blower', deviceId: D1, catalogue: 'fan' }] })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Match automatically' }));
    await user.click(screen.getByRole('button', { name: 'Accept all proposals (1)' }));
    expect(statusOf('f1')).toBe('Set by hand');
    expect(screen.getByText('Every scene key has an element.')).toBeInTheDocument();
  });
  it('Match automatically does not overwrite a hand pick and does not hand its element out again', async () => {
    render(<SceneSetupDrawer {...props()} />);
    const user = userEvent.setup();
    await user.selectOptions(elementOf('fan'), 'Circulation (p_main)');
    await user.click(screen.getByRole('button', { name: 'Match automatically' }));
    expect(elementOf('fan').selectedOptions[0].textContent).toBe('Circulation (p_main)');
    expect(statusOf('fan')).toBe('Set by hand');
    expect(statusOf('pump')).toBe('Unmatched');
  });
  it('is disabled with nothing to match', () => {
    render(<SceneSetupDrawer {...props({ elements: [] })} />);
    expect(screen.getByRole('button', { name: 'Match automatically' })).toBeDisabled();
  });
  it('the role prefix of a key selects the device whose elements it offers', async () => {
    render(<SceneSetupDrawer {...props({
      devices: [{ id: D1, label: 'Fryer', role: 'fryer' }, { id: D2, label: 'Grill', role: 'grill' }],
      sceneKeys: [{ key: 'fryer.heater', kind: 'symbol' }, { key: 'grill.heater', kind: 'symbol' }],
      elements: [{ element: 'heater', deviceId: D1 }, { element: 'heater', deviceId: D2 }, { element: 'only_grill', deviceId: D2 }],
      initial: {},
    })} />);
    expect(statusOf('fryer.heater')).toBe('Matched by key');
    expect(statusOf('grill.heater')).toBe('Matched by key');
    expect(within(elementOf('fryer.heater')).queryByRole('option', { name: 'only_grill' })).toBeNull();
    expect(within(elementOf('grill.heater')).getByRole('option', { name: 'only_grill' })).toBeInTheDocument();
  });
  it('a key whose role has no device says so and cannot be picked', () => {
    render(<SceneSetupDrawer {...props({ roles: ['oven'], sceneKeys: [{ key: 'oven.heater', kind: 'symbol' }] })} />);
    expect(elementOf('oven.heater')).toBeDisabled();
    expect(screen.getByText('No device has the role oven.')).toBeInTheDocument();
    expect(screen.getByText('No device for the role oven')).toBeInTheDocument();
  });
  it('lists what no key reads', () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(screen.getByText('3 elements no key reads')).toBeInTheDocument();
  });
  it('empty and loading states', () => {
    const a = render(<SceneSetupDrawer {...props({ sceneKeys: [] })} />);
    expect(screen.getByText('The scene has no keys.')).toBeInTheDocument();
    a.unmount();
    render(<SceneSetupDrawer {...props({ sceneKeysLoading: true })} />);
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
  });
  it('searches the keys and filters by status', async () => {
    render(<SceneSetupDrawer {...props()} />);
    const user = userEvent.setup();
    const table = screen.getByRole('table', { name: '4. Match' });
    await user.type(screen.getByRole('searchbox', { name: 'Search scene keys' }), 'circ');
    expect(within(table).queryByText('ghost')).toBeNull();
    expect(within(table).getByText('pump')).toBeInTheDocument();
    // The search reads the element a row has, too.
    await user.clear(screen.getByRole('searchbox', { name: 'Search scene keys' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search scene keys' }), 'heater');
    expect(within(table).getByText('heater', { selector: 'span' })).toBeInTheDocument();
    expect(within(table).queryByText('pump')).toBeNull();
  });
});

describe('SceneSetupDrawer: pick in the scene', () => {
  it('has a Pick button per row only when the host can pick, calling onPick with the key and toggling it off', async () => {
    const onPick = vi.fn();
    const a = render(<SceneSetupDrawer {...props()} />);
    expect(screen.queryByRole('button', { name: /in the scene$/ })).toBeNull();
    a.unmount();
    render(<SceneSetupDrawer {...props({ onPick })} />);
    const user = userEvent.setup();
    const btn = screen.getByRole('button', { name: 'Pick pump in the scene' });
    await user.click(btn);
    expect(onPick).toHaveBeenLastCalledWith('pump');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await user.click(btn);
    expect(onPick).toHaveBeenLastCalledWith(null);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
  it('shows the key the host reports picked above the table, with its own element select', async () => {
    const { rerender } = render(<SceneSetupDrawer {...props({ onPick: vi.fn() })} />);
    expect(screen.queryByTestId('picked-strip')).toBeNull();
    rerender(<SceneSetupDrawer {...props({ onPick: vi.fn(), pickedKey: 'ghost' })} />);
    const strip = screen.getByTestId('picked-strip');
    expect(within(strip).getByText('Choose the element this key reads.')).toBeInTheDocument();
    const select = within(strip).getByLabelText('Picked in the scene: ghost');
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(select).toHaveFocus();
    await userEvent.setup().selectOptions(select, 'spare');
    expect(statusOf('ghost')).toBe('Set by hand');
  });
  it('draws the preview slot beside the table', () => {
    render(<SceneSetupDrawer {...props({ preview: <canvas data-testid="canvas" /> })} />);
    expect(within(screen.getByRole('region', { name: 'Scene preview' })).getByTestId('canvas')).toBeInTheDocument();
  });
});

describe('SceneSetupDrawer: save', () => {
  it('is disabled while nothing changed, and says so', () => {
    const initial = { slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 } };
    render(<SceneSetupDrawer {...props({ initial })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Nothing has changed.')).toBeInTheDocument();
  });
  it('is disabled while data loads, and without a document', () => {
    const a = render(<SceneSetupDrawer {...props({ devicesLoading: true })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Waiting for the data to load.')).toBeInTheDocument();
    a.unmount();
    render(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'design' } })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getAllByText('Choose a document.').length).toBeGreaterThan(0);
  });
  it('opens the ConfirmDialog (never window.confirm) and calls onSave with the draft, exceptions only', async () => {
    const onSave = vi.fn();
    const confirm = vi.spyOn(window, 'confirm');
    render(<SceneSetupDrawer {...props({ onSave })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Match automatically' }));
    await user.selectOptions(elementOf('ghost'), 'spare');
    await user.click(screen.getByRole('button', { name: 'Accept the proposal for fan' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save the scene setup' });
    expect(onSave).not.toHaveBeenCalled();
    // in words, never "exceptions" or "keys" (next-boilerplate E2E-1.13): what is connected by hand, and that nothing reads nothing
    expect(within(dialog).getByText(/Saves this design setup, with 3 symbols connected by hand\. Every symbol has a value\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      documentId: DOC_A, slot: 'main', kind: 'design', devices: { '': D1 }, hidden: [],
      map: {
        pump: { deviceId: D1, element: 'p_main' },
        fan: { deviceId: D1, element: 'blower' },
        ghost: { deviceId: D1, element: 'spare' },
      },
    });
    expect(onSave.mock.calls[0][1]).toEqual({ reason: '' });
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it('carries a saved field map (phase 45, D45-3) through untouched: on its key\'s element pick, alone for an identity, and the auto match leaves it alone', async () => {
    const onSave = vi.fn();
    const fields = { value: { key: 'temperature', label: 'Water' }, running: { key: 'pump_on', deviceId: D2 } };
    const map = {
      heater: { fields },                                              // identity match + fields: stays a fields-only entry
      pump: { deviceId: D1, element: 'p_main', fields: { value: { key: 'flow' } } },  // a pick + fields
      ghost: { deviceId: D1, element: 'spare' },                       // a plain pick, as before
    };
    render(<SceneSetupDrawer {...props({ onSave, initial: { slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 }, map, hidden: [] } })} />);
    const user = userEvent.setup();
    // the saved picks show as picks; a fields-only key keeps its identity match and is not open
    expect(statusOf('heater')).toMatch(/Matched by/);
    expect(statusOf('pump')).toMatch(/Set by hand/);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); // nothing changed yet: the round trip is the saved binding
    await user.click(screen.getByRole('button', { name: 'Match automatically' }));
    await user.click(screen.getByRole('button', { name: 'Accept the proposal for fan' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Save the scene setup' })).getByRole('button', { name: 'Save setup' }));
    expect(onSave.mock.calls[0][0].map).toEqual({ ...map, fan: { deviceId: D1, element: 'blower' } });
  });
  it('does not store a proposal that was not accepted, and asks to acknowledge what stays open', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Match automatically' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save the scene setup' });
    const confirmBtn = within(dialog).getByRole('button', { name: 'Save setup' });
    expect(confirmBtn).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    expect(within(dialog).getByText('I know that 1 scene key stays unmatched and 1 proposal is not accepted and not saved.')).toBeInTheDocument();
    await user.click(confirmBtn);
    expect(onSave.mock.calls[0][0].map).toEqual({ pump: { deviceId: D1, element: 'p_main' } });
  });
  it('Cancel in the dialog saves nothing', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Save the scene setup' })).getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Save the scene setup' })).toBeNull();
  });
  it('asks for a reason when the host wants one, and passes it', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave, askReason: true })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save the scene setup' });
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'new fryer');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
    expect(onSave.mock.calls[0][1]).toEqual({ reason: 'new fryer' });
  });
  it('shows the saving state and a save error from the host', () => {
    const a = render(<SceneSetupDrawer {...props({ saving: true })} />);
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
    a.unmount();
    render(<SceneSetupDrawer {...props({ saveError: 'Server said no' })} />);
    expect(screen.getByText('Server said no')).toBeInTheDocument();
    expect(screen.getByText('The setup could not be saved.')).toBeInTheDocument();
  });
  it('surfaces a 409 conflict with Reload, and the confirmation says the saved setup is newer', async () => {
    const onReload = vi.fn();
    render(<SceneSetupDrawer {...props({ conflict: true, onReload })} />);
    expect(screen.getByText('Someone else changed this setup')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(within(screen.getByRole('dialog', { name: 'Save the scene setup' })).getByText(/saved setup is newer/)).toBeInTheDocument();
  });
  it('a saved binding is read back: its exceptions show as hand picks, a vanished element is called out', () => {
    render(<SceneSetupDrawer {...props({
      initial: {
        slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 },
        map: { pump: { deviceId: D1, element: 'p_main' }, ghost: { deviceId: D1, element: 'gone' } },
      },
    })} />);
    expect(statusOf('pump')).toBe('Set by hand');
    expect(statusOf('ghost')).toBe('Set by hand');
    expect(elementOf('ghost').selectedOptions[0].textContent).toBe('gone (not on the device)');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

/** Presses Save, ticks the acknowledgement when there is one, confirms, and returns what onSave got. */
async function saveIt(onSave: ReturnType<typeof vi.fn>) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const dialog = screen.getByRole('dialog', { name: 'Save the scene setup' });
  const box = within(dialog).queryByRole('checkbox');
  if (box) await user.click(box);
  await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
  return onSave.mock.calls[onSave.mock.calls.length - 1][0];
}

describe('SceneSetupDrawer: saved entries the scene no longer has (stale)', () => {
  const KEYS2 = [{ key: 'heater', kind: 'symbol' }, { key: 'ghost', kind: 'symbol' }];
  const initial = {
    slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1, oven: D3 },
    map: { oldkey: { deviceId: D1, element: 'gone' } }, hidden: ['oldhidden'],
  };
  const staleTable = () => screen.getByRole('table', { name: 'Saved entries the scene no longer has' });

  it('lists a saved exception, a saved role and a saved hidden key the scene has nothing for, never dropping them silently', () => {
    render(<SceneSetupDrawer {...props({ initial, sceneKeys: KEYS2 })} />);
    const t = within(staleTable());
    expect(t.getByText('oldkey')).toBeInTheDocument();
    expect(t.getByText('oven')).toBeInTheDocument();
    expect(t.getByText('oldhidden')).toBeInTheDocument();
    expect(t.getByText('Stale exception')).toBeInTheDocument();
    expect(t.getByText('Stale role')).toBeInTheDocument();
    expect(t.getByText('Stale hidden key')).toBeInTheDocument();
    expect(t.getAllByText('Kept')).toHaveLength(3);
    expect(screen.getByText('3 saved entries the scene no longer has, kept until removed')).toBeInTheDocument();
  });
  it('carries them into the payload and asks for the acknowledgement in the save confirmation', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ initial, sceneKeys: KEYS2, onSave })} />);
    const user = userEvent.setup();
    await user.selectOptions(elementOf('ghost'), 'spare');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save the scene setup' });
    expect(within(dialog).getByRole('button', { name: 'Save setup' })).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    expect(within(dialog).getByText('I know that 3 saved entries the scene no longer has are kept.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
    expect(onSave.mock.calls[0][0]).toEqual({
      documentId: DOC_A, slot: 'main', kind: 'design', devices: { oven: D3, '': D1 }, hidden: ['oldhidden'],
      map: { ghost: { deviceId: D1, element: 'spare' }, oldkey: { deviceId: D1, element: 'gone' } },
    });
  });
  it('a saved binding with stale entries and no edit is unchanged: Save stays off', () => {
    render(<SceneSetupDrawer {...props({ initial, sceneKeys: KEYS2 })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Nothing has changed.')).toBeInTheDocument();
  });
  it('each row can be removed explicitly (and kept again): a removed one leaves the payload and needs no acknowledgement', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ initial, sceneKeys: KEYS2, onSave })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove the stale exception oldkey' }));
    expect(within(staleTable()).getAllByText('Kept')).toHaveLength(2);
    expect(within(staleTable()).getByText('Removed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Keep the stale exception oldkey' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove the stale exception oldkey' }));
    await user.click(screen.getByRole('button', { name: 'Remove the stale role oven' }));
    await user.click(screen.getByRole('button', { name: 'Remove the stale hidden key oldhidden' }));
    await user.selectOptions(elementOf('ghost'), 'spare');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save the scene setup' });
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
    expect(onSave.mock.calls[0][0]).toEqual({
      documentId: DOC_A, slot: 'main', kind: 'design', devices: { '': D1 }, hidden: [], map: { ghost: { deviceId: D1, element: 'spare' } },
    });
  });
  it('a kept stale role that a listed device now takes the name of is refused', async () => {
    render(<SceneSetupDrawer {...props({ initial, sceneKeys: KEYS2 })} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Role of Fryer 1'));
    await user.type(screen.getByLabelText('Role of Fryer 1'), 'oven');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getAllByText('Two devices have the role oven.').length).toBeGreaterThan(0);
  });
  it('shows nothing stale while the keys load (they are not in yet) and no section when nothing is stale', () => {
    const a = render(<SceneSetupDrawer {...props({ initial, sceneKeys: [], sceneKeysLoading: true })} />);
    expect(screen.queryByTestId('stale-entries')).toBeNull();
    a.unmount();
    render(<SceneSetupDrawer {...props()} />);
    expect(screen.queryByTestId('stale-entries')).toBeNull();
  });
  it('Save stays off while the keys of the chosen document have not loaded, however the host flags it', async () => {
    const view = render(<SceneSetupDrawer {...props({ sceneKeysDocumentId: DOC_A })} />);
    const user = userEvent.setup();
    await user.selectOptions(elementOf('ghost'), 'spare');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('radio', { name: 'Use Grill station' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Waiting for the data to load.')).toBeInTheDocument();
    view.rerender(<SceneSetupDrawer {...props({ sceneKeysDocumentId: DOC_B })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

describe('SceneSetupDrawer: view and rules travel through', () => {
  it('come back in the payload unchanged, and are not a change of their own', async () => {
    const onSave = vi.fn();
    const view = { level: 'floor1', focus: 'pump' };
    const rules = [{ target: 'heater', enabled: true, key: 'value', op: 'gt', value: '80', color: 'var(--error)', pulse: true }];
    const initial = { slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 }, view, rules };
    render(<SceneSetupDrawer {...props({ initial, onSave })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.setup().selectOptions(elementOf('ghost'), 'spare');
    const draft = await saveIt(onSave);
    expect(draft.view).toEqual(view);
    expect(draft.rules).toEqual(rules);
  });
  it('are left out of the payload when the saved binding had none', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave })} />);
    await userEvent.setup().selectOptions(elementOf('ghost'), 'spare');
    const draft = await saveIt(onSave);
    expect('view' in draft).toBe(false);
    expect('rules' in draft).toBe(false);
  });
});

describe('SceneSetupDrawer: the server grammars', () => {
  it('a slot the host passed that the server would refuse keeps Save off and says so without naming it', () => {
    render(<SceneSetupDrawer {...props({ initial: { slot: 'Bad Slot', kind: 'design', documentId: DOC_A, devices: { '': D1 }, hidden: ['heater'] } })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getAllByText(/the name it is stored under is not valid/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Bad Slot/)).toBeNull();
  });
  it('refuses a device or a document that is not an id', () => {
    render(<SceneSetupDrawer {...props({ devices: [{ id: 'dev-1', label: 'Fryer 1' }], initial: { slot: 'main', kind: 'design', documentId: 'doc-1' } })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getAllByText('The document id is not a valid id.').length).toBeGreaterThan(0);
  });
});

describe('SceneSetupDrawer: a device and no device', () => {
  it('an element with no deviceId is not offered to a role that has no device, and stores no empty device id', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({
      devices: [{ id: D1, label: 'Fryer', role: 'fryer' }], sceneKeys: [{ key: 'a', kind: 'symbol' }, { key: 'fryer.b', kind: 'symbol' }],
      elements: [{ element: 'a' }, { element: 'b', deviceId: D1 }], initial: {}, onSave,
    })} />);
    expect(statusOf('a')).toBe('Unmatched');
    expect(elementOf('a')).toBeDisabled();
    expect(screen.getByText('No device is the main device.')).toBeInTheDocument();
    expect(statusOf('fryer.b')).toBe('Matched by key');
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Use Fryer line' }));
    const draft = await saveIt(onSave);
    expect(draft.map).toEqual({});
    expect(JSON.stringify(draft)).not.toContain('"deviceId":""');
  });
});

describe('SceneSetupDrawer: which devices are in the scene', () => {
  const two = [{ id: D1, label: 'Fryer 1', code: 'fryer' }, { id: D2, label: 'Grill 1', code: 'grill' }];
  it('has an include toggle per device, all on to start with, and shows the count against the cap', () => {
    render(<SceneSetupDrawer {...props({ devices: two, sceneKeys: [], elements: [], initial: {} })} />);
    expect(screen.getByRole('checkbox', { name: 'Include Fryer 1 in the scene' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include Grill 1 in the scene' })).toBeChecked();
    expect(screen.getByText('2 of 100 devices in the scene.')).toBeInTheDocument();
  });
  it('only included devices get roles and enter the payload; the proposals follow the included ones', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ devices: two, sceneKeys: [], elements: [], initial: { slot: 'main', kind: 'design' }, onSave })} />);
    const user = userEvent.setup();
    expect(screen.getByLabelText('Role of Fryer 1')).toHaveValue('fryer');
    await user.click(screen.getByRole('checkbox', { name: 'Include Grill 1 in the scene' }));
    expect(screen.getByText('1 of 100 devices in the scene.')).toBeInTheDocument();
    expect(screen.getByLabelText('Role of Grill 1')).toBeDisabled();
    // One device left: it is the main one.
    expect(screen.getByLabelText('Role of Fryer 1')).toHaveValue('');
    await user.click(screen.getByRole('radio', { name: 'Use Fryer line' }));
    const draft = await saveIt(onSave);
    expect(draft.devices).toEqual({ '': D1 });
  });
  it('with no device included there is nothing to save', async () => {
    render(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'design' } })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Use Fryer line' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include Fryer 1 in the scene' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getAllByText('Bind at least one device.').length).toBeGreaterThan(0);
  });
  it('a saved binding starts with the devices it binds included and the others off', () => {
    render(<SceneSetupDrawer {...props({ devices: two, initial: { slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 } } })} />);
    expect(screen.getByRole('checkbox', { name: 'Include Fryer 1 in the scene' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include Grill 1 in the scene' })).not.toBeChecked();
  });
  it('more than 100 included devices cannot be saved', async () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, label: `Dev ${i}`, code: `dev-${i}` }));
    render(<SceneSetupDrawer {...props({ devices: many, sceneKeys: [], elements: [] })} />);
    expect(screen.getByText('101 of 100 devices in the scene.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getAllByText('A scene binds at most 100 devices.').length).toBeGreaterThan(0);
  });
});

describe('SceneSetupDrawer: leaving a key out of the scene', () => {
  it('an identity-matched key can be left out: it shows as not bound, goes into hidden and can be bound again', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave })} />);
    const user = userEvent.setup();
    expect(statusOf('heater')).toBe('Matched by key');
    await user.click(screen.getByRole('button', { name: 'Do not bind heater' }));
    expect(statusOf('heater')).toBe('Not bound');
    expect(elementOf('heater')).toBeDisabled();
    // A key left out is not an unmatched key.
    expect(screen.getByText('3 scene keys without an element')).toBeInTheDocument();
    const draft = await saveIt(onSave);
    expect(draft.hidden).toEqual(['heater']);
    expect(draft.map).toEqual({});
  });
  it('can be undone with Bind again', async () => {
    render(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 } } })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Do not bind heater' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Bind heater again' }));
    expect(statusOf('heater')).toBe('Matched by key');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
  it('round-trips the saved hidden keys: they come back as not bound and in the payload', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave, initial: { slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 }, hidden: ['pump'] } })} />);
    expect(statusOf('pump')).toBe('Not bound');
    expect(screen.getByText('2 scene keys without an element')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Do not bind fan' }));
    const draft = await saveIt(onSave);
    expect(draft.hidden).toEqual(['pump', 'fan']);
  });
  it('a key left out is not handed an element by Match automatically, and frees its own', async () => {
    render(<SceneSetupDrawer {...props()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Do not bind pump' }));
    await user.click(screen.getByRole('button', { name: 'Match automatically' }));
    expect(statusOf('pump')).toBe('Not bound');
    expect(statusOf('fan')).toBe('Proposed by type');
  });
  it('the status filter offers Not bound', async () => {
    render(<SceneSetupDrawer {...props()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Do not bind pump' }));
    expect(within(screen.getByRole('table', { name: '4. Match' })).getByText('Not bound')).toBeInTheDocument();
  });
});

/** The role field of the one device: an edit of the person's that the snapshot tests use (the slot is no field any more, phase 47). */
const roleField = () => screen.getByLabelText('Role of Fryer 1') as HTMLInputElement;

describe('SceneSetupDrawer: the slot, the document column and the form snapshot', () => {
  it('the slot is the host\'s, carried into the draft unchanged; without one the draft is a new view (an empty slot)', async () => {
    const save = async (initial: SceneSetupDrawerProps['initial']) => {
      const onSave = vi.fn();
      const r = render(<SceneSetupDrawer {...props({ mode: 'choose', onSave, initial })} />);
      await userEvent.setup().click(screen.getByRole('radio', { name: 'Use Grill station' }));
      await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
      r.unmount();
      return onSave.mock.calls[0][0].slot;
    };
    expect(await save({ kind: 'design', documentId: DOC_A })).toBe('');
    expect(await save({ slot: 'view_2', kind: 'design', documentId: DOC_A })).toBe('view_2');
    expect(await save({ slot: 'main', kind: 'design' })).toBe('main');
  });
  it('the radio column has its own header, not the "Document: " text', () => {
    render(<SceneSetupDrawer {...props()} />);
    const table = screen.getByRole('table', { name: '2. Document' });
    expect(within(table).getByRole('columnheader', { name: 'Choose' })).toBeInTheDocument();
    expect(within(table).queryByText(/^Document:/)).toBeNull();
  });
  it('a new initial restarts an untouched form from it, baseline and form from the same snapshot', () => {
    const { rerender } = render(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'design', documentId: DOC_A } })} />);
    rerender(<SceneSetupDrawer {...props({ initial: { slot: 'side', kind: 'diagram', documentId: DOC_B, devices: { '': D1 } } })} />);
    expect(screen.getByRole('button', { name: '2D diagram' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'Use Grill station' })).toBeChecked();
    expect(screen.queryByText('The saved version changed')).toBeNull();
    // The new initial is the baseline too: nothing has changed against it.
    expect(screen.getByText('Nothing has changed.')).toBeInTheDocument();
  });
  it('an inline initial object that says the same thing does not restart or warn', async () => {
    const mk = () => props({ initial: { slot: 'main', kind: 'design', documentId: DOC_A } });
    const { rerender } = render(<SceneSetupDrawer {...mk()} />);
    fireEvent.change(roleField(), { target: { value: 'edited' } });
    rerender(<SceneSetupDrawer {...mk()} />);
    expect(roleField()).toHaveValue('edited');
    expect(screen.queryByText('The saved version changed')).toBeNull();
  });
  it('with edits in the form a new initial shows a notice with Reload instead of taking over; Reload takes it', async () => {
    const { rerender } = render(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'design', documentId: DOC_A } })} />);
    fireEvent.change(roleField(), { target: { value: 'edited' } });
    rerender(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'design', documentId: DOC_B } })} />);
    expect(roleField()).toHaveValue('edited');
    expect(screen.getByRole('radio', { name: 'Use Fryer line' })).toBeChecked();
    expect(screen.getByText('The saved version changed')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }));
    expect(roleField()).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Use Grill station' })).toBeChecked();
    expect(screen.queryByText('The saved version changed')).toBeNull();
  });
});

describe('SceneSetupDrawer: keyboard and session', () => {
  it('Escape closes an untouched drawer at once', async () => {
    const onClose = vi.fn();
    render(<SceneSetupDrawer {...props({ onClose })} />);
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
  // next-boilerplate E2E-1.10: a rule typed into step 5 was thrown away by Escape without a word
  it('with edits of the person, Escape and Cancel ask first: Keep editing keeps the form, Discard changes closes', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SceneSetupDrawer {...props({ onClose })} />);
    await user.selectOptions(elementOf('fan'), ['0']);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    const ask = screen.getByRole('dialog', { name: 'Discard your changes?' });
    await user.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(elementOf('fan').value).toBe('0');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  // next-boilerplate E2E-1.4: a device that sends flat keys (or nothing yet) has no element to match here; the table was a wall of greyed "Not matched"
  it('with no element to match, says where the symbols are connected instead, and offers no Pick in the scene', () => {
    render(<SceneSetupDrawer {...props({ elements: [], onPick: vi.fn() })} />);
    expect(screen.getByTestId('match-no-elements').textContent).toMatch(/connect each symbol where the drawing is shown/);
    expect(screen.queryByRole('button', { name: /^Pick .* in the scene$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Match automatically' })).toBeDisabled();
  });
  it('the notice is not shown while something loads, with elements, or without a document', () => {
    const { rerender } = render(<SceneSetupDrawer {...props({ elements: [], elementsLoading: true })} />);
    expect(screen.queryByTestId('match-no-elements')).toBeNull();
    rerender(<SceneSetupDrawer {...props()} />);
    expect(screen.queryByTestId('match-no-elements')).toBeNull();
    rerender(<SceneSetupDrawer {...props({ elements: [], initial: { slot: 'main', kind: 'design' }, sceneKeys: [] })} />);
    expect(screen.queryByTestId('match-no-elements')).toBeNull();
  });
  it('every control is reachable by Tab and has an accessible name', async () => {
    render(<SceneSetupDrawer {...props({ onPick: vi.fn() })} />);
    const dialog = screen.getByRole('dialog');
    for (const el of dialog.querySelectorAll<HTMLElement>('button, input, select')) {
      const name = el.getAttribute('aria-label') ?? el.textContent ?? '';
      const labelled = el.id && dialog.querySelector(`label[for="${el.id}"]`);
      expect(name.trim() !== '' || !!labelled || el.getAttribute('aria-labelledby'), el.outerHTML.slice(0, 120)).toBeTruthy();
    }
  });
  it('a changed resetKey starts the form over from the new initial binding', () => {
    const { rerender } = render(<SceneSetupDrawer {...props({ resetKey: 1 })} />);
    fireEvent.change(roleField(), { target: { value: 'edited' } });
    rerender(<SceneSetupDrawer {...props({ resetKey: 1, initial: { slot: 'main', kind: 'design', documentId: DOC_B } })} />);
    expect(roleField()).toHaveValue('edited');
    rerender(<SceneSetupDrawer {...props({ resetKey: 2, initial: { slot: 'main', kind: 'design', documentId: DOC_B } })} />);
    expect(roleField()).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Use Grill station' })).toBeChecked();
  });
  it('a reopened drawer starts from the host data again', () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen((o) => !o)}>toggle</button>
          <SceneSetupDrawer {...props({ open })} />
        </>
      );
    }
    render(<Host />);
    fireEvent.change(roleField(), { target: { value: 'changed' } });
    expect(roleField()).toHaveValue('changed');
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByText('toggle'));
    return screen.findByLabelText('Role of Fryer 1').then((e) => expect(e).toHaveValue(''));
  });
});

describe('SceneSetupDrawer: exports', () => {
  it('the kit index carries the drawer, the pure logic and the default texts', async () => {
    const kit = await import('../index');
    expect(kit.SceneSetupDrawer).toBe(SceneSetupDrawer);
    expect(typeof kit.autoMatch).toBe('function');
    expect(typeof kit.bindingDraft).toBe('function');
    expect(typeof kit.sceneUnresolved).toBe('function');
    expect(kit.DEFAULT_SCENE_SETUP_MESSAGES.title).toBe('Scene');
    const app = await import('../../index');
    expect(app.SceneSetupDrawer).toBe(SceneSetupDrawer);
  });
});

describe('SceneSetupDrawer: no slot anywhere a person reaches (next-boilerplate phase 47)', () => {
  /** Every text and control of the open drawer (and its dialogs): no slot field, choice or word, and never the stored code. */
  const expectNoSlot = (code?: string) => {
    expect(screen.queryByLabelText('Slot')).toBeNull();
    expect(screen.queryByLabelText('New slot name')).toBeNull();
    expect(screen.queryByRole('option', { name: /New slot/ })).toBeNull();
    expect(screen.queryByText(/\bslots?\b/i)).toBeNull();
    if (code) expect(screen.queryByText(new RegExp(`\\b${code}\\b`))).toBeNull();
  };

  it('the full form shows the type, the document, the devices and the match: no slot to type, pick or switch', () => {
    render(<SceneSetupDrawer {...props({ initial: { slot: 'view_2', kind: 'design', documentId: DOC_A, devices: { '': D1 } } })} />);
    expectNoSlot('view_2');
  });

  it('nor in the choose mode, Advanced open, a locked type not even named', async () => {
    render(<SceneSetupDrawer {...props({ mode: 'choose', kindLocked: true, initial: { slot: 'view_3', kind: 'design', documentId: DOC_A } })} />);
    await userEvent.setup().click(within(screen.getByTestId('scene-advanced')).getByText('Advanced'));
    expectNoSlot('view_3');
    expect(screen.queryByRole('heading', { name: 'Type' })).toBeNull();
    for (const h of ['Devices and roles', 'Match']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
  });

  it('a new view (no slot from the host) is saved with the empty slot, which the host creates', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave, initial: { kind: 'design' } })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Use Grill station' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByLabelText(/I know that/));
    await user.click(screen.getByRole('button', { name: 'Save setup' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ slot: '', kind: 'design', documentId: DOC_B });
  });

  it('a type switch keeps the host\'s slot: the host answers with that kind\'s view', async () => {
    const onKindChange = vi.fn();
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onKindChange, onSave, initial: { slot: 'view_2', kind: 'design', documentId: DOC_A } })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '2D diagram' }));
    expect(onKindChange).toHaveBeenCalledWith('diagram');
    expectNoSlot('view_2');
  });
});

describe('SceneSetupDrawer: the drawing changed since the setup (TK-6)', () => {
  const initial = { slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 }, map: { gone: { deviceId: D1, element: 'spare' } } };

  it('says so at the top with the number of saved entries the drawing no longer has, and lets the setup be saved as it is', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ initial, documentChanged: true, onSave })} />);
    const note = screen.getByTestId('drawing-changed');
    expect(within(note).getByText('The drawing changed since this was set up')).toBeInTheDocument();
    expect(within(note).getByText(/1 saved entry no longer match the drawing/)).toBeInTheDocument();
    // unchanged, yet Save is on: it renews the setup against the drawing
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    const user = userEvent.setup();
    await user.click(save);
    await user.click(screen.getByLabelText(/I know that/));
    await user.click(screen.getByRole('button', { name: 'Save setup' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when the drawing is the one the setup was made on', () => {
    render(<SceneSetupDrawer {...props({ initial, documentChanged: false })} />);
    expect(screen.queryByTestId('drawing-changed')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('is no concern of another document: once one is chosen the note goes and Save waits for a change', async () => {
    render(<SceneSetupDrawer {...props({ initial, documentChanged: true, devices: DEVICES })} />);
    expect(screen.getByTestId('drawing-changed')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Use Grill station' }));
    expect(screen.queryByTestId('drawing-changed')).toBeNull();
  });
});

describe('SceneSetupDrawer: remove this setup (SP-10)', () => {
  const initial = { slot: 'main', kind: 'design', documentId: DOC_A };
  const user = () => userEvent.setup();

  it('offers nothing without a host callback, or while the form is on no saved setup', () => {
    const { rerender } = render(<SceneSetupDrawer {...props({ initial })} />);
    expect(screen.queryByRole('button', { name: 'Remove this setup' })).toBeNull();
    rerender(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'design' }, onRemove: vi.fn() })} />);
    expect(screen.queryByRole('button', { name: 'Remove this setup' })).toBeNull();
  });

  it('asks first, naming the kind and the view by its drawing (never the slot), and removes exactly that binding on confirm', async () => {
    const onRemove = vi.fn();
    render(<SceneSetupDrawer {...props({ initial: { slot: 'view_2', kind: 'design', documentId: DOC_A }, onRemove })} />);
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Remove this setup' }));
    expect(onRemove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Remove the scene setup' });
    expect(within(dialog).getByText('Removes the 3D design "Fryer line". The dashboards that showed it go back to what they would show without it. The other views are not touched.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/view_2/)).toBeNull();
    await u.click(within(dialog).getByRole('button', { name: 'Remove setup' }));
    expect(onRemove).toHaveBeenCalledWith({ slot: 'view_2', kind: 'design' });
  });

  it('names the view as the host lists it when the host says (two views of one drawing: "(2)")', async () => {
    render(<SceneSetupDrawer {...props({ initial: { slot: 'view_2', kind: 'design', documentId: DOC_A }, onRemove: vi.fn(), viewName: 'Fryer line (2)' })} />);
    await user().click(screen.getByRole('button', { name: 'Remove this setup' }));
    expect(within(screen.getByRole('dialog', { name: 'Remove the scene setup' })).getByText(/Removes the 3D design "Fryer line \(2\)"/)).toBeInTheDocument();
  });

  it('Cancel removes nothing', async () => {
    const onRemove = vi.fn();
    render(<SceneSetupDrawer {...props({ initial, onRemove })} />);
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Remove this setup' }));
    await u.click(within(screen.getByRole('dialog', { name: 'Remove the scene setup' })).getByRole('button', { name: 'Cancel' }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('goes away when the form is on another kind than the saved one (the host has not answered the switch yet)', async () => {
    render(<SceneSetupDrawer {...props({ initial, onRemove: vi.fn(), onKindChange: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Remove this setup' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: '2D diagram' }));
    expect(screen.queryByRole('button', { name: 'Remove this setup' })).toBeNull();
  });

  it('waits while a removal runs', () => {
    render(<SceneSetupDrawer {...props({ initial, onRemove: vi.fn(), removing: true })} />);
    expect(screen.getByRole('button', { name: /Remove this setup/ })).toBeDisabled();
  });
});

describe('SceneSetupDrawer: the choose mode (next-boilerplate D45-10, e2e round 2 E2E-2.1)', () => {
  const user = () => userEvent.setup();
  const KEYS2 = [{ key: 'heater', kind: 'symbol' }, { key: 'ghost', kind: 'symbol' }];
  const stale = {
    slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1, oven: D3 },
    map: { oldkey: { deviceId: D1, element: 'gone' }, other: { deviceId: D3, fields: { value: { key: 'x' } } } }, hidden: [],
  };

  it('shows only "which drawing?" with its hint, no numbered sections, no slot, no kind, no match table and no rules; the Advanced fold holds them', async () => {
    render(<SceneSetupDrawer {...props({ mode: 'choose', kindLocked: true })} />);
    expect(screen.getByRole('dialog', { name: 'Choose a drawing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Which drawing?' })).toBeInTheDocument();
    expect(screen.getByText(/After saving it is on this page/)).toBeInTheDocument();
    for (const h of ['1. Type', '2. Document', '3. Devices and roles', '4. Match', '5. Rules']) expect(screen.queryByRole('heading', { name: h })).toBeNull();
    expect(screen.queryByLabelText('Slot')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Match automatically' })).toBeNull();
    expect(screen.queryByText(/scene key|Unmatched|Set by hand/)).toBeNull();
    const fold = screen.getByTestId('scene-advanced');
    expect(within(fold).getByText('Advanced')).toBeInTheDocument();
    await user().click(within(fold).getByText('Advanced'));
    // under Advanced the sections are not numbered: without the document's they would read 1, 3, 4 (m-R3-08)
    for (const h of ['Devices and roles', 'Match']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    for (const h of ['3. Devices and roles', '4. Match']) expect(screen.queryByRole('heading', { name: h })).toBeNull();
    // the kind the host locked is the host's choice: not even named, and its section is not drawn
    expect(screen.queryByRole('heading', { name: 'Type' })).toBeNull();
    expect(screen.queryByRole('button', { name: '3D design' })).toBeNull();
  });

  it('a locked kind is named only when the host does not lock it', async () => {
    render(<SceneSetupDrawer {...props({ mode: 'choose' })} />);
    await user().click(within(screen.getByTestId('scene-advanced')).getByText('Advanced'));
    expect(screen.getByRole('heading', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3D design' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Save writes at once, with no confirmation and no acknowledgement, even while symbols read nothing yet', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ mode: 'choose', onSave, initial: { slot: 'main', kind: 'design' } })} />);
    const u = user();
    await u.click(screen.getByRole('radio', { name: 'Use Grill station' }));
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog', { name: 'Save the scene setup' })).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ documentId: DOC_B, slot: 'main', kind: 'design' });
    expect(onSave.mock.calls[0][1]).toEqual({ reason: '' });
  });

  it('still asks when the saved setup is newer than the one the form started from (a conflict)', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ mode: 'choose', onSave, conflict: true, initial: { slot: 'main', kind: 'design' } })} />);
    const u = user();
    await u.click(screen.getByRole('radio', { name: 'Use Grill station' }));
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('dialog', { name: 'Save the scene setup' })).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('says in one line that connections made for another drawing are kept, and names their devices by NAME under Advanced, never by id (E2E-2.18)', async () => {
    render(<SceneSetupDrawer {...props({ mode: 'choose', initial: stale, sceneKeys: KEYS2, devices: [{ id: D1, label: 'Fryer 1', code: 'FRY-1' }] })} />);
    expect(screen.getByTestId('stale-choose-line').textContent).toBe('3 connections made for another drawing are not carried over: connect this drawing\'s symbols on the page after saving.');
    expect(screen.queryByRole('table', { name: 'Saved entries the scene no longer has' })).toBeNull();
    await user().click(within(screen.getByTestId('scene-advanced')).getByText('Advanced'));
    const t = within(screen.getByRole('table', { name: 'Saved entries the scene no longer has' }));
    expect(t.getByText('Reads gone of Fryer 1')).toBeInTheDocument();
    expect(t.getByText('Reads value of another device')).toBeInTheDocument();
    expect(t.getByText('another device is not in the list')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(D1))).toBeNull();
    expect(screen.queryByText(new RegExp(D3))).toBeNull();
  });

  it('the host\'s preview is drawn under the document table in choose mode', () => {
    render(<SceneSetupDrawer {...props({ mode: 'choose', preview: <div data-testid="pv" /> })} />);
    expect(screen.getByRole('region', { name: 'Scene preview' })).toContainElement(screen.getByTestId('pv'));
  });

  it('the full mode is the default: numbered sections, the type and the confirmation', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave, initial: { slot: 'main', kind: 'design' } })} />);
    for (const h of ['1. Type', '2. Document', '3. Devices and roles', '4. Match']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    const u = user();
    await u.click(screen.getByRole('radio', { name: 'Use Grill station' }));
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('dialog', { name: 'Save the scene setup' })).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
