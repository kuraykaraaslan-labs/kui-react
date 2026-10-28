import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SceneSetupDrawer, type SceneSetupDrawerProps } from '../views/SceneSetupDrawer';
import { validateDraft, type BindingDraft } from '../views/scene-binding-logic';

/** The Rules step of the Scene drawer (next-boilerplate phase 42.6.1, D42-11): rules on the binding for a 3D design. */
const DOC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const D1 = '11111111-1111-4111-8111-111111111111';
const DOCS = [{ id: DOC_A, name: 'Kitchen', updatedAt: '2026-10-01T10:00:00Z', usedBy: 1 }];
const KEYS = [
  { key: 'heater', kind: 'item', label: 'Heater' },
  { key: 'pump', kind: 'item' },
  { key: 'fan', kind: 'item' },
];
const ELEMENTS = [{ element: 'heater', deviceId: D1 }, { element: 'pump', deviceId: D1 }, { element: 'fan', deviceId: D1 }];
const RULE = { enabled: true, target: 'heater', key: 'value', op: 'gt', value: '80', color: 'var(--error)', pulse: true };
const initial = (over: Partial<BindingDraft> = {}): Partial<BindingDraft> => ({ slot: 'main', kind: 'design', documentId: DOC_A, devices: { '': D1 }, ...over });

function props(over: Partial<SceneSetupDrawerProps> = {}): SceneSetupDrawerProps {
  return {
    open: true, onClose: vi.fn(), kinds: ['diagram', 'design'], documents: DOCS, devices: [{ id: D1, label: 'Oven', code: 'OVEN' }], sceneKeys: KEYS, elements: ELEMENTS,
    onSave: vi.fn(), initial: initial(), ...over,
  };
}

async function saveIt(onSave: ReturnType<typeof vi.fn>): Promise<BindingDraft> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const dialog = screen.getByRole('dialog', { name: 'Save the scene setup' });
  const box = within(dialog).queryByRole('checkbox');
  if (box) await user.click(box);
  await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
  return onSave.mock.calls[onSave.mock.calls.length - 1][0];
}
const saveButton = () => screen.getByRole('button', { name: 'Save' });
const rulesPanel = () => within(document.querySelector('[data-panel="design-rules"]') as HTMLElement);

describe('Rules step: where it shows', () => {
  it('is the fifth section of a design, with its hint, and not a tab', () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(screen.getByRole('heading', { name: '5. Rules' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(rulesPanel().getByText('No rules yet.')).toBeInTheDocument();
    expect(rulesPanel().getByRole('button', { name: 'Add rule' })).toBeEnabled();
  });
  it('is absent for a kind that has no step, and that kind\'s rules pass through untouched', async () => {
    const onSave = vi.fn();
    const rules = [{ anything: { nested: true } }];
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ kind: 'other', rules, hidden: [] }) })} />);
    expect(screen.queryByRole('heading', { name: '5. Rules' })).toBeNull();
    await userEvent.setup().click(screen.getAllByRole('button', { name: /Do not bind heater/ })[0]);
    expect((await saveIt(onSave)).rules).toEqual(rules);
  });
  it('rulesKinds can switch the step on for another kind', () => {
    render(<SceneSetupDrawer {...props({ rulesKinds: ['other'], initial: initial({ kind: 'other' }) })} />);
    expect(screen.getByRole('heading', { name: '5. Rules' })).toBeInTheDocument();
  });
  it('needs keys before a rule can be added', () => {
    render(<SceneSetupDrawer {...props({ sceneKeys: [] })} />);
    expect(rulesPanel().getByRole('button', { name: 'Add rule' })).toBeDisabled();
    expect(rulesPanel().getByText('Choose a document with scene keys to add rules.')).toBeInTheDocument();
  });
});

describe('Rules step: authoring', () => {
  it('adds a rule on a scene key of the document with a condition and effects, and the payload carries it', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave })} />);
    const user = userEvent.setup();
    await user.click(rulesPanel().getByRole('button', { name: 'Add rule' }));
    const panel = rulesPanel();
    // the target select lists the keys of the document and "every item"
    const target = panel.getByLabelText('Applies to') as HTMLSelectElement;
    expect([...target.options].map((o) => o.value)).toEqual(['', '*', 'heater', 'pump', 'fan']);
    await user.selectOptions(target, 'pump');
    await user.selectOptions(panel.getByLabelText('Operator'), 'gt');
    await user.type(panel.getByLabelText('Column'), 'value');
    await user.type(panel.getByLabelText('Value'), '80');
    await user.selectOptions(panel.getByLabelText('Pulse'), 'true');
    await user.selectOptions(panel.getByLabelText('Hide'), 'false');
    await user.type(panel.getByLabelText('Label'), 'Hot {{value}');
    const draft = await saveIt(onSave);
    expect(draft.rules).toEqual([{ enabled: true, target: 'pump', op: 'gt', key: 'value', value: '80', pulse: true, hidden: false, label: 'Hot {value}' }]);
  });
  it('shows a saved rule as a sentence and saves it back unchanged when nothing else changed (round trip)', async () => {
    const onSave = vi.fn();
    const rules = [RULE, { enabled: false, target: '*', source: 'param', key: 'mode', op: 'eq', value: 'night', hidden: true }];
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ rules }) })} />);
    expect(screen.getByText("For heater: When value of this item is above 80, colour it red and pulse")).toBeInTheDocument();
    expect(screen.getByText('For every item: When parameter mode is night, hide it (off)')).toBeInTheDocument();
    expect(rulesPanel().getByText('2 rules')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    // another part of the setup changes: the rules come back byte for byte
    await userEvent.setup().click(screen.getAllByRole('button', { name: /Do not bind fan/ })[0]);
    const draft = await saveIt(onSave);
    expect(draft.rules).toEqual(rules);
  });
  it('editing a saved rule changes only that rule, and turning it off is a change', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ rules: [RULE, { target: 'pump', pulse: true }] }) })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'On: rule 2' }));
    expect(saveButton()).toBeEnabled();
    const draft = await saveIt(onSave);
    expect(draft.rules).toEqual([RULE, { target: 'pump', pulse: true, enabled: false }]);
  });
  it('undoing an edit makes the form equal to the saved one again', async () => {
    render(<SceneSetupDrawer {...props({ initial: initial({ rules: [RULE] }) })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'On: rule 1' }));
    expect(saveButton()).toBeEnabled();
    await user.click(screen.getByRole('checkbox', { name: 'On: rule 1' }));
    expect(saveButton()).toBeDisabled();
  });
  it('moves, duplicates and deletes; deleting the last rule sends null', async () => {
    const onSave = vi.fn();
    const a = { enabled: true, target: 'heater', pulse: true };
    const b = { enabled: true, target: 'pump', highlight: true };
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ rules: [a, b] }) })} />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Move up: rule 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move down: rule 2' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move up: rule 2' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate: rule 1' }));
    expect(rulesPanel().getByText('3 rules')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete: rule 3' }));
    expect((await saveIt(onSave)).rules).toEqual([b, { ...b }]);
  });
  it('removing every rule of a saved binding sends null (the server stores none)', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ rules: [RULE] }) })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete: rule 1' }));
    expect(rulesPanel().getByText('No rules yet.')).toBeInTheDocument();
    expect((await saveIt(onSave)).rules).toBeNull();
  });
  it('a condition reads a column or a board parameter, of this item or of another key', async () => {
    render(<SceneSetupDrawer {...props({ initial: initial({ rules: [{ enabled: true, target: 'heater', pulse: true }] }), ruleParams: [{ key: 'mode', label: 'Mode' }] })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /For heater/ }));
    const panel = rulesPanel();
    await user.selectOptions(panel.getByLabelText('Operator'), 'eq');
    const of = panel.getByLabelText('Of row') as HTMLSelectElement;
    expect([...of.options].map((o) => o.value)).toEqual(['', 'heater', 'pump', 'fan']);
    await user.selectOptions(of, 'pump');
    await user.selectOptions(panel.getByLabelText('Read'), 'param');
    expect(panel.queryByLabelText('Of row')).toBeNull();
    expect(panel.getByLabelText('Parameter')).toBeInTheDocument();
  });
});

describe('Rules step: what is wrong', () => {
  it('a rule that names a key the document does not have is flagged, kept in the payload and does not block the save', async () => {
    const onSave = vi.fn();
    const gone = { enabled: true, target: 'gone', pulse: true };
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ rules: [gone, RULE] }) })} />);
    expect(rulesPanel().getByText('Key not in the document')).toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole('button', { name: /Do not bind fan/ })[0]);
    expect((await saveIt(onSave)).rules).toEqual([gone, RULE]);
  });
  it('the target select keeps a missing key as an option, so opening the rule does not change it', async () => {
    render(<SceneSetupDrawer {...props({ initial: initial({ rules: [{ enabled: true, target: 'gone', pulse: true }] }) })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /For gone/ }));
    const target = rulesPanel().getByLabelText('Applies to') as HTMLSelectElement;
    expect(target.value).toBe('gone');
    expect(target.selectedOptions[0].textContent).toBe('gone (not in the document)');
    expect(rulesPanel().getByText(/has no item with the key gone/)).toBeInTheDocument();
  });
  it('a problem with a rule says so on the card and in the footer, and holds the save until it is fixed', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ rules: [RULE] }) })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /For heater/ }));
    await user.clear(rulesPanel().getByLabelText('Value'));
    await user.type(rulesPanel().getByLabelText('Value'), 'abc');
    expect(rulesPanel().getByText('1 problem')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/A rule needs attention: 1: This operator compares numbers/)).toBeInTheDocument();
    await user.clear(rulesPanel().getByLabelText('Value'));
    await user.type(rulesPanel().getByLabelText('Value'), '90');
    expect(saveButton()).toBeEnabled();
    expect((await saveIt(onSave)).rules).toEqual([{ ...RULE, value: '90' }]);
  });
  it('a saved row the 3D card does not read is listed as it is, kept, and holds the save until it is deleted', async () => {
    const onSave = vi.fn();
    const foreign = { id: 'r1', when: { a: 1 }, then: { b: 2 } };
    render(<SceneSetupDrawer {...props({ onSave, initial: initial({ rules: [foreign, RULE] }) })} />);
    const user = userEvent.setup();
    const row = document.querySelector('[data-foreign="true"]') as HTMLElement;
    expect(within(row).getByText(/Not a rule of the 3D card/)).toBeInTheDocument();
    expect(row.textContent).toContain('"when"');
    await user.click(screen.getAllByRole('button', { name: /Do not bind fan/ })[0]);
    expect(saveButton()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete: rule 1' }));
    expect((await saveIt(onSave)).rules).toEqual([RULE]);
  });
  it('validateDraft judges the rules of a design only (the host\'s server does the same)', () => {
    const base: BindingDraft = { documentId: DOC_A, slot: 'main', kind: 'design', devices: { '': D1 }, map: {}, hidden: [] };
    expect(validateDraft({ ...base, rules: [RULE] })).toEqual([]);
    expect(validateDraft({ ...base, rules: [{ target: 'a', op: 'gt', key: 'v', value: 'x' }] }).map((i) => i.code)).toEqual(['rule-invalid']);
    expect(validateDraft({ ...base, kind: 'other', rules: [{ anything: { nested: 1 } }] })).toEqual([]);
    expect(validateDraft({ ...base, rules: null })).toEqual([]);
  });
  it('takes its texts from the messages prop', () => {
    render(<SceneSetupDrawer {...props({ messages: { rules: { section: '5. Kurallar', add: 'Kural ekle', empty: 'Kural yok.' } } })} />);
    expect(screen.getByRole('heading', { name: '5. Kurallar' })).toBeInTheDocument();
    expect(rulesPanel().getByRole('button', { name: 'Kural ekle' })).toBeInTheDocument();
    expect(rulesPanel().getByText('Kural yok.')).toBeInTheDocument();
  });
});

describe('Rules step: accessibility', () => {
  it('every control of an open rule with two conditions has an accessible name, and the cards are a list', async () => {
    const rule = { enabled: true, target: 'heater', key: 'value', op: 'gt', value: '80', op2: 'eq', key2: 'status', value2: 'alarm', join: 'any', color: 'var(--error)', pulse: true, label: 'Hot' };
    render(<SceneSetupDrawer {...props({ initial: initial({ rules: [rule] }), ruleParams: [{ key: 'mode' }] })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /For heater/ }));
    const panel = document.querySelector('[data-panel="design-rules"]') as HTMLElement;
    expect(within(panel).getByRole('list')).toBeInTheDocument();
    const nameOf = (el: HTMLElement): string => {
      const own = el.getAttribute('aria-label');
      if (own) return own.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      const labels = (el as HTMLInputElement).labels;
      if (labels && labels.length) return [...labels].map((l) => l.textContent ?? '').join(' ').trim();
      return (el.textContent ?? '').trim();
    };
    const controls = [...panel.querySelectorAll<HTMLElement>('button, input, select, textarea')].filter((el) => el.getAttribute('type') !== 'hidden');
    expect(controls.length).toBeGreaterThan(15);
    for (const el of controls) expect(nameOf(el), el.outerHTML.slice(0, 120)).not.toBe('');
    // the open card is tied to its button
    const toggle = screen.getByRole('button', { name: /For heater/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull();
  });
});

