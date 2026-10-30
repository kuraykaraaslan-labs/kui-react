import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SceneSetupDrawer, type SceneSetupDrawerProps } from '../views/SceneSetupDrawer';
import { SceneSetupPreview2D, cssAttrValue, previewSettings } from '../views/SceneSetupPreview2D';
import { validateDraft, type BindingDraft } from '../views/scene-binding-logic';
import { DIAGRAM_RULE_EFFECTS, addDesignRule, designRuleIssues, describeDesignRule, isDesignRule, updateDesignRule } from '../views/design-rules-logic';

/** The Scene drawer for kind `diagram` (next-boilerplate phase 42.5.4): the 2D preview with pick-by-click, the Rules step of a stored diagram, the kind switch. */
const DOC_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DOC_3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const D1 = '11111111-1111-4111-8111-111111111111';

const DIAGRAM = {
  width: 400, height: 200, scale: 0.7,
  elements: [
    { id: 'tv', symbol: 'home.tv', x: 80, y: 100, label: 'Living room TV' },
    { id: 'router', symbol: 'home.router', x: 220, y: 100, mode: 'lockout' },
    { id: 'cam', symbol: 'home.camera.security', x: 320, y: 100 },
  ],
  links: [{ from: 'tv.r', to: 'router.l', kind: 'line' }],
  rules: [{ target: 'tv', key: 'value', op: 'gt', value: '1', color: 'var(--error)' }],
};
const KEYS = [
  { key: 'tv', kind: 'home.tv', label: 'Living room TV', catalogue: 'home.tv' },
  { key: 'router', kind: 'home.router', label: 'router', catalogue: 'home.router' },
  { key: 'cam', kind: 'home.camera.security', label: 'cam', catalogue: 'home.camera.security' },
];
const ELEMENTS = [{ element: 'tv', deviceId: D1 }, { element: 'wan', deviceId: D1, label: 'Uplink' }, { element: 'lens', deviceId: D1, catalogue: 'home.camera.security' }];
const DOCS = [{ id: DOC_D, name: 'Home network', updatedAt: '2026-10-01T10:00:00Z', usedBy: 1 }];

function props(over: Partial<SceneSetupDrawerProps> = {}): SceneSetupDrawerProps {
  return {
    open: true, onClose: vi.fn(), kinds: ['design', 'diagram'], documents: DOCS, devices: [{ id: D1, label: 'Gateway', code: 'GW' }], sceneKeys: KEYS, elements: ELEMENTS,
    onSave: vi.fn(), initial: { slot: 'main', kind: 'diagram', documentId: DOC_D, devices: { '': D1 } }, ...over,
  };
}

describe('SceneSetupPreview2D', () => {
  it('draws the diagram read-only with every symbol a button named by its label', () => {
    render(<SceneSetupPreview2D document={DIAGRAM} onPick={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Diagram preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Living room TV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'router' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cam' })).toBeInTheDocument();
    expect(screen.getByText('Click a symbol to pick it for the key you are matching.')).toBeInTheDocument();
  });
  it('a click on a symbol picks its id, a locked-out one included (a lock stops running a symbol, not picking it)', async () => {
    const onPick = vi.fn();
    render(<SceneSetupPreview2D document={DIAGRAM} onPick={onPick} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'cam' }));
    await user.click(screen.getByRole('button', { name: 'router' }));
    expect(onPick.mock.calls).toEqual([['cam'], ['router']]);
  });
  it('Enter and Space on a focused symbol pick it too', async () => {
    const onPick = vi.fn();
    render(<SceneSetupPreview2D document={DIAGRAM} onPick={onPick} />);
    const tv = screen.getByRole('button', { name: 'Living room TV' });
    tv.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('tv');
  });
  it('a double or right click picks nothing', () => {
    const onPick = vi.fn();
    render(<SceneSetupPreview2D document={DIAGRAM} onPick={onPick} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: 'cam' }));
    fireEvent.contextMenu(screen.getByRole('button', { name: 'cam' }));
    expect(onPick).not.toHaveBeenCalled();
  });
  it('outlines the selected symbol (a rule of its own box) and says which, and ignores a name no symbol has', () => {
    const a = render(<SceneSetupPreview2D document={DIAGRAM} selected="cam" onPick={vi.fn()} />);
    expect(screen.getByText('Picked: cam')).toBeInTheDocument();
    const style = a.container.querySelector('style');
    expect(style?.textContent).toContain('rect[data-element="cam"]');
    expect(style?.textContent).toContain('var(--primary)');
    const scope = a.container.querySelector('[data-scene-preview]')?.getAttribute('data-scene-preview');
    expect(style?.textContent).toContain(`[data-scene-preview="${scope}"]`);
    a.unmount();
    const b = render(<SceneSetupPreview2D document={DIAGRAM} selected="ghost" onPick={vi.fn()} />);
    expect(b.container.querySelector('style')).toBeNull();
  });
  it('says so for a diagram with no symbols', () => {
    render(<SceneSetupPreview2D document={{ elements: [] }} onPick={vi.fn()} />);
    expect(screen.getByText('This diagram has no symbols.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('takes its texts from the messages prop', () => {
    render(<SceneSetupPreview2D document={DIAGRAM} selected="tv" onPick={vi.fn()} messages={{ label: 'Onizleme', picked: (k) => `Secilen: ${k}` }} />);
    expect(screen.getByRole('img', { name: 'Onizleme' })).toBeInTheDocument();
    expect(screen.getByText('Secilen: tv')).toBeInTheDocument();
  });
  it('previewSettings leaves out the rules and the lockouts and never writes into its input', () => {
    const frozen = Object.freeze({ ...DIAGRAM, elements: Object.freeze(DIAGRAM.elements.map((e) => Object.freeze({ ...e }))) });
    const out = previewSettings(frozen) as { rules: unknown[]; elements: Array<{ id: string; mode?: string }> };
    expect(out.rules).toEqual([]);
    expect(out.elements.map((e) => e.mode)).toEqual([undefined, undefined, undefined]);
    expect(out.elements.map((e) => e.id)).toEqual(['tv', 'router', 'cam']);
  });
  it('cssAttrValue quotes a value for an attribute selector', () => {
    expect(cssAttrValue('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe('the drawer with a 2D preview: pick by click', () => {
  function Host({ onSave = vi.fn() }: { onSave?: SceneSetupDrawerProps['onSave'] }) {
    const [picked, setPicked] = useState<string | null>(null);
    const [highlight, setHighlight] = useState<string | null>(null);
    return (
      <SceneSetupDrawer
        {...props({ onSave })}
        preview={<SceneSetupPreview2D document={DIAGRAM} selected={picked ?? highlight} onPick={(k) => { setPicked(k); setHighlight(k); }} />}
        onPick={(k) => { setHighlight(k); setPicked(null); }} pickedKey={picked}
      />
    );
  }
  it('a click on a symbol shows its key above the table with an element field, and the element chosen is a hand match', async () => {
    const onSave = vi.fn();
    render(<Host onSave={onSave} />);
    const user = userEvent.setup();
    const region = screen.getByRole('region', { name: 'Preview of the drawing' });
    await user.click(within(region).getByRole('button', { name: 'cam' }));
    const strip = screen.getByTestId('picked-strip');
    expect(within(strip).getByText(/cam/)).toBeInTheDocument();
    await user.selectOptions(within(strip).getByLabelText(/cam/), 'lens');
    const row = screen.getByLabelText('Element for cam').closest('tr')!;
    expect(within(row).getByText('Set by hand')).toBeInTheDocument();
  });
  it('"Pick" on a row outlines that symbol in the preview', async () => {
    const { baseElement } = render(<Host />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pick router in the scene' }));
    expect(baseElement.querySelector('style')?.textContent).toContain('rect[data-element="router"]');
  });
  it('the match table lists the diagram\'s symbols, matched by id first', () => {
    render(<Host />);
    const row = screen.getByLabelText('Element for tv').closest('tr')!;
    expect(within(row).getByText('Matched by key')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Element for cam').closest('tr')!).getByText(/Not bound|Unmatched|Proposed by/)).toBeInTheDocument();
  });
});

describe('the drawer: the Rules step of kind diagram', () => {
  const rulesPanel = () => within(document.querySelector('[data-panel="design-rules"]') as HTMLElement);
  it('is shown for a diagram with the 2D hint and offers a state and a blink, not a pulse or an outline', async () => {
    render(<SceneSetupDrawer {...props()} />);
    expect(screen.getByRole('heading', { name: '5. Rules' })).toBeInTheDocument();
    expect(screen.getByText(/run after the diagram's own rules/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(rulesPanel().getByRole('button', { name: 'Add rule' }));
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(screen.getByLabelText('Blink')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pulse')).toBeNull();
    expect(screen.queryByLabelText('Outline')).toBeNull();
  });
  it('a rule is saved as a row of the diagram dialect with the state it was given', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onSave })} />);
    const user = userEvent.setup();
    await user.click(rulesPanel().getByRole('button', { name: 'Add rule' }));
    await user.selectOptions(screen.getByLabelText('Applies to'), 'tv');
    await user.selectOptions(screen.getByLabelText('State'), 'warning');
    await user.selectOptions(screen.getByLabelText('Blink'), 'true');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save this view' });
    const box = within(dialog).queryByRole('checkbox');
    if (box) await user.click(box);
    await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
    expect(onSave.mock.calls[0][0].rules).toEqual([{ enabled: true, target: 'tv', state: 'warning', blink: true }]);
    expect(onSave.mock.calls[0][0].kind).toBe('diagram');
  });
  it('a saved row of the 3D dialect is listed as foreign (kept until deleted) and keeps Save off', async () => {
    render(<SceneSetupDrawer {...props({ initial: { slot: 'main', kind: 'diagram', documentId: DOC_D, devices: { '': D1 }, rules: [{ target: 'tv', pulse: true }] } })} />);
    expect(screen.getByText(/Not a rule of the 2D diagram/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('the drawer: switching the kind', () => {
  it('reports the kind and starts the form over without the other kind\'s document and matching', async () => {
    const onKindChange = vi.fn();
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({ onKindChange, onSave, initial: { slot: 'main', kind: 'design', documentId: DOC_3, devices: { '': D1 }, map: { cam: { deviceId: D1, element: 'lens' } } }, documents: [{ id: DOC_3, name: 'Kitchen 3D' }] })} />);
    const user = userEvent.setup();
    expect(screen.getByRole('radio', { name: 'Use Kitchen 3D' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: '2D diagram' }));
    expect(onKindChange).toHaveBeenCalledWith('diagram');
    expect(screen.getByRole('button', { name: '2D diagram' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'Use Kitchen 3D' })).not.toBeChecked();
    expect(screen.getAllByText('Choose a document.').length).toBeGreaterThan(0);
  });
  it('asks first when the form has edits, and keeps the kind when that is cancelled', async () => {
    const onKindChange = vi.fn();
    render(<SceneSetupDrawer {...props({ onKindChange })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Do not bind router/ }));
    await user.click(screen.getByRole('button', { name: '3D design' }));
    const dialog = screen.getByRole('dialog', { name: 'Switch the type' });
    expect(within(dialog).getByText(/starts over from the saved 3D design \(or from an empty one\)/)).toBeInTheDocument();
    expect(onKindChange).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onKindChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '2D diagram' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '3D design' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Switch the type' })).getByRole('button', { name: 'Switch' }));
    expect(onKindChange).toHaveBeenCalledWith('design');
    expect(screen.getByRole('button', { name: '3D design' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('a locked kind shows only itself with the card\'s hint and cannot be changed', () => {
    const onKindChange = vi.fn();
    render(<SceneSetupDrawer {...props({ kindLocked: true, onKindChange })} />);
    expect(screen.getByRole('button', { name: '2D diagram' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '3D design' })).toBeNull();
    expect(screen.getByText('The card you opened this from draws this type.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2D diagram' }));
    expect(onKindChange).not.toHaveBeenCalled();
  });
  it('a setup saved for one kind does not leak its view or rules into the other kind\'s draft', async () => {
    const onSave = vi.fn();
    render(<SceneSetupDrawer {...props({
      onSave, rulesKinds: [], initial: { slot: 'main', kind: 'design', documentId: DOC_3, devices: { '': D1 }, view: { level: 'l1' }, rules: [{ target: 'x', pulse: true }] },
      documents: [{ id: DOC_3, name: 'Kitchen 3D' }, ...DOCS],
    })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '2D diagram' }));
    await user.click(screen.getByRole('radio', { name: 'Use Home network' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save this view' });
    const box = within(dialog).queryByRole('checkbox');
    if (box) await user.click(box);
    await user.click(within(dialog).getByRole('button', { name: 'Save setup' }));
    const draft = onSave.mock.calls[0][0] as BindingDraft;
    expect(draft.kind).toBe('diagram');
    expect(draft.documentId).toBe(DOC_D);
    expect(draft.view).toBeUndefined();
    expect(draft.rules ?? null).toBeNull();
  });
});

describe('the diagram rule dialect (pure)', () => {
  it('has the five effects the process scene\'s own engine reads, under the names it reads them by', () => {
    expect(Object.keys(DIAGRAM_RULE_EFFECTS)).toEqual(['state', 'color', 'hidden', 'blink', 'label']);
  });
  it('judges a row: its fields, a state, a flag, a colour, a label length, the shared condition checks', () => {
    const ok = { target: 'tv', key: 'value', op: 'gt', value: '3', state: 'critical', blink: true, color: 'rgb(1,2,3)' };
    expect(designRuleIssues([ok], 'diagram')).toEqual([]);
    expect(designRuleIssues([{ ...ok, pulse: true }], 'diagram').map((i) => i.path)).toContain('rules.0.pulse');
    expect(designRuleIssues([{ ...ok, state: 'on fire' }], 'diagram').map((i) => i.path)).toContain('rules.0.state');
    expect(designRuleIssues([{ ...ok, blink: 'maybe' }], 'diagram').map((i) => i.path)).toContain('rules.0.blink');
    expect(designRuleIssues([{ ...ok, op: 'gt', value: 'x' }], 'diagram').length).toBeGreaterThan(0);
    expect(designRuleIssues([{ ...ok, label: 'x'.repeat(81) }], 'diagram').length).toBeGreaterThan(0);
    expect(designRuleIssues([{ target: '' }], 'diagram').map((i) => i.path)).toContain('rules.0.target');
    // a CSS colour the 3D view cannot take is fine on the process scene
    expect(designRuleIssues([{ target: 'tv', color: 'transparent' }], 'diagram')).toEqual([]);
    expect(designRuleIssues([{ target: 'tv', color: 'transparent' }], 'design').map((i) => i.path)).toContain('rules.0.color');
  });
  it('the 3D dialect refuses state and blink, the 2D one pulse and highlight', () => {
    expect(designRuleIssues([{ target: 'a', state: 'idle' }]).map((i) => i.path)).toContain('rules.0.state');
    expect(designRuleIssues([{ target: 'a', highlight: true }], 'diagram').map((i) => i.path)).toContain('rules.0.highlight');
    expect(isDesignRule({ target: 'a', blink: true }, 'diagram')).toBe(true);
    expect(isDesignRule({ target: 'a', blink: true })).toBe(false);
  });
  it('edits follow the dialect and a refused field changes nothing', () => {
    const added = addDesignRule([], { target: 'tv', state: 'warning' }, undefined, 'diagram');
    expect(added.rules).toEqual([{ enabled: true, target: 'tv', state: 'warning' }]);
    expect(addDesignRule([], { pulse: true }, undefined, 'diagram').refused).toMatch(/not a rule field/);
    expect(updateDesignRule(added.rules, 0, { blink: 'true' }, 'diagram').rules).toEqual([{ enabled: true, target: 'tv', state: 'warning', blink: true }]);
    expect(updateDesignRule(added.rules, 0, { state: '' }, 'diagram').rules).toEqual([{ enabled: true, target: 'tv' }]);
  });
  it('reads a rule as a sentence with its state and blink', () => {
    expect(describeDesignRule({ target: 'tv', key: 'value', op: 'gt', value: '3', state: 'warning', blink: true })).toBe('When value of this item is above 3, set it warning and blink');
  });
  it('validateDraft judges a diagram\'s rules with its own dialect', () => {
    const base: BindingDraft = { documentId: DOC_D, slot: 'main', kind: 'diagram', devices: { '': D1 }, map: {}, hidden: [] };
    expect(validateDraft({ ...base, rules: [{ target: 'tv', state: 'warning' }] })).toEqual([]);
    expect(validateDraft({ ...base, rules: [{ target: 'tv', pulse: true }] }).map((i) => i.code)).toEqual(['rule-invalid']);
  });
});
