import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { renderWidgetPreview, WIDGET_PREVIEW_IDS } from '../previews';
import { WidgetSettingsEditor } from '../WidgetSettingsEditor';
import { WidgetKitProvider } from '../WidgetKitContext';
import { BUILTIN_KINDS } from '../templates';
import { CORE_BOARD, CORE_CARD, CORE_FORMAT } from '../settings/core';
import { GAUGE } from '../templates/gauge';
import type { FieldSchema } from '../../SchemaForm/types';
import type { SettingsTemplate } from '../settings/types';

const caps = { hasData: true, exportable: false, formatsNumbers: true };

/** Every `preview` id the builtin and core templates' options carry, nested fields included. */
function previewIds(templates: SettingsTemplate[]): Set<string> {
  const out = new Set<string>();
  const walk = (fields: Record<string, FieldSchema> | undefined) => {
    for (const f of Object.values(fields ?? {})) {
      for (const o of f.options ?? []) if (typeof o !== 'string' && o.preview) out.add(o.preview);
      walk(f.fields);
    }
  };
  for (const t of templates) walk(t.fields);
  return out;
}

beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); });

describe('layout thumbnails', () => {
  it('draws every preview id a builtin or core template names', () => {
    const ids = previewIds([...BUILTIN_KINDS.map((k) => k.template), CORE_CARD, CORE_FORMAT, CORE_BOARD]);
    expect(ids.size).toBeGreaterThan(40);
    const missing = [...ids].filter((id) => !WIDGET_PREVIEW_IDS.includes(id));
    expect(missing).toEqual([]);
  });

  it('is a decorative SVG in currentColor, and null for an unknown id', () => {
    const { container } = render(<>{renderWidgetPreview('gauge-arc')}</>);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-preview-id', 'gauge-arc');
    expect(svg.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(renderWidgetPreview('nope')).toBeNull();
    expect(renderWidgetPreview('toString')).toBeNull();
  });

  it('the editor draws the layout options as a radiogroup of thumbnail cards', () => {
    const onChange = vi.fn();
    render(<WidgetSettingsEditor templates={[GAUGE, CORE_CARD, CORE_FORMAT]} settings={{}} onChange={onChange} caps={caps} />);
    const group = screen.getByRole('radiogroup', { name: 'Layout' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(3);
    for (const r of radios) expect(r.querySelector('svg[data-preview-id]')).not.toBeNull();
    const arc = within(group).getByRole('radio', { name: 'Half circle' });
    expect(arc).toHaveAttribute('aria-checked', 'true');
    expect(arc).toHaveAttribute('tabindex', '0');
    expect(within(group).getByRole('radio', { name: 'Donut' })).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(arc, { key: 'ArrowRight' });
    act(() => { vi.runAllTimers(); });
    expect(onChange).toHaveBeenLastCalledWith({ layout: 'donut' });
    expect(within(group).getByRole('radio', { name: 'Donut' })).toHaveFocus();
  });

  it("the host's renderPreview wins for the ids it draws, WidgetKit's for the rest", () => {
    const host = { renderPreview: (id: string) => (id === 'gauge-arc' ? <span data-testid="mine" /> : null) };
    render(
      <WidgetKitProvider value={host}>
        <WidgetSettingsEditor templates={[GAUGE, CORE_CARD, CORE_FORMAT]} settings={{}} onChange={() => {}} caps={caps} />
      </WidgetKitProvider>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Layout' });
    expect(within(within(group).getByRole('radio', { name: 'Half circle' })).getByTestId('mine')).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'Donut' }).querySelector('svg[data-preview-id="gauge-donut"]')).not.toBeNull();
  });
});
