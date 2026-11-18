import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WidgetSettingsEditor } from '../WidgetSettingsEditor';
import { CORE_CARD, CORE_FORMAT, CORE_BOARD } from '../settings/core';
import { STAT_VALUE } from '../templates/stat-value';
import { GAUGE } from '../templates/gauge';
import type { SettingsTemplate } from '../settings/types';

const caps = { hasData: true, exportable: false, formatsNumbers: true };

beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); });

describe('WidgetSettingsEditor', () => {
  it('shows the title and the tabs of the templates and the host', () => {
    render(<WidgetSettingsEditor templates={[STAT_VALUE, CORE_CARD, CORE_FORMAT]} settings={{}} onChange={() => {}} caps={caps}
      title="Rooms" onTitleChange={() => {}} extraTabs={{ Actions: <p>actions here</p> }} />);
    expect(screen.getByLabelText('Title')).toHaveValue('Rooms');
    for (const t of ['Display', 'Data', 'Card', 'Actions']) expect(screen.getByRole('tab', { name: t })).toBeInTheDocument();
  });

  it('Basic mode hides advanced fields; Advanced shows them', () => {
    render(<WidgetSettingsEditor templates={[STAT_VALUE, CORE_CARD, CORE_FORMAT]} settings={{}} onChange={() => {}} caps={caps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Card' }));
    expect(screen.queryByText('Corner radius (px)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Advanced settings/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Card' }));
    expect(screen.getByText('Corner radius (px)')).toBeInTheDocument();
  });

  it('writes a sparse value into the right namespace', () => {
    const onChange = vi.fn();
    render(<WidgetSettingsEditor templates={[STAT_VALUE, CORE_CARD, CORE_FORMAT]} settings={{}} onChange={onChange} caps={caps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Card' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Inner spacing (px)' }), { target: { value: '4' } });
    act(() => { vi.runAllTimers(); });
    expect(onChange).toHaveBeenLastCalledWith({ $card: { padding: 4 } });
  });

  it('opens a part written by a newer version read-only', () => {
    render(<WidgetSettingsEditor templates={[STAT_VALUE, CORE_CARD, CORE_FORMAT]} settings={{ $v: { 'core:card': 5 } }} onChange={() => {}} caps={caps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Card' }));
    expect(screen.getByRole('status')).toHaveTextContent('newer version');
  });

  it('shows a deprecated field that holds a value read-only, with its removal notice', () => {
    const tpl: SettingsTemplate = {
      id: 'tenant:demo', version: 2, namespace: '', label: 'Demo', groups: [], migrations: [{ from: 1, to: 2, note: 'x' }],
      fields: {
        heading: { label: 'Heading', type: 'text', since: 1 },
        caption: { label: 'Caption', type: 'text', since: 1, deprecated: { since: 2, removeIn: 3, replacedBy: 'heading' } },
        footer: { label: 'Footer', type: 'text', since: 1, deprecated: { since: 2, removeIn: 3 } },
      },
    };
    const onChange = vi.fn();
    render(<WidgetSettingsEditor templates={[tpl]} settings={{ caption: 'Old', $v: { 'tenant:demo': 2 } }} onChange={onChange} caps={caps} />);
    const old = screen.getByRole('region', { name: 'No longer used' });
    const caption = screen.getByRole('textbox', { name: 'Caption' });
    expect(old).toContainElement(caption);
    expect(caption).toHaveValue('Old');
    expect(caption).toBeDisabled();
    expect(old).toHaveTextContent('No longer used; removed in v3. Replaced by Heading.');
    // A deprecated field without a stored value stays hidden; the active field is editable.
    expect(screen.queryByRole('textbox', { name: 'Footer' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Heading' })).not.toBeDisabled();
    fireEvent.change(caption, { target: { value: 'New' } });
    act(() => { vi.runAllTimers(); });
    expect(onChange).not.toHaveBeenCalled();
  });

  // next-boilerplate UI test 3 #66: a gauge's Scale kept 0 / 100 when the bound value's range (0–1100) arrived after the form opened
  it('shows the host\'s defaults that arrive after the form opened; the person\'s own value stays theirs', () => {
    const scale = (max: number) => ({ [GAUGE.id]: { min: 0, max } });
    const { rerender } = render(<WidgetSettingsEditor templates={[GAUGE, CORE_CARD, CORE_FORMAT]} settings={{}} onChange={() => {}} caps={caps} layers={scale(100)} />);
    expect(screen.getByRole('spinbutton', { name: /^Maximum/ })).toHaveValue(100);
    rerender(<WidgetSettingsEditor templates={[GAUGE, CORE_CARD, CORE_FORMAT]} settings={{}} onChange={() => {}} caps={caps} layers={scale(1100)} />);
    expect(screen.getByRole('spinbutton', { name: /^Maximum/ })).toHaveValue(1100);
    const own = { max: 250 };
    rerender(<WidgetSettingsEditor templates={[GAUGE, CORE_CARD, CORE_FORMAT]} settings={own} onChange={() => {}} caps={caps} layers={scale(900)} />);
    expect(screen.getByRole('spinbutton', { name: /^Maximum/ })).toHaveValue(250);
  });

  it('edits board settings with the board template alone', () => {
    const onChange = vi.fn();
    render(<WidgetSettingsEditor templates={[CORE_BOARD]} settings={{}} onChange={onChange} caps={caps} />);
    expect(screen.getByRole('tab', { name: 'Look' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Row height (px)' }), { target: { value: '56' } });
    act(() => { vi.runAllTimers(); });
    expect(onChange).toHaveBeenLastCalledWith({ rowHeight: 56 });
  });
});
