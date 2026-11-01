import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { IconPicker, iconNameOf, clearRecentIcons } from './index';
import { loadedSolidIcons, readRecentIcons, searchIcons, type SolidIcon } from './icons';

function Harness(props: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(props.initial);
  return (
    <IconPicker
      id="ws-icon"
      label="Workspace icon"
      value={value}
      onChange={(v) => {
        props.onChange?.(v);
        setValue(v);
      }}
    />
  );
}

const search = () => screen.getByRole('combobox', { name: 'Search icons' });
const optionNames = () => screen.getAllByRole('option').map((o) => o.getAttribute('data-icon-name'));
const activeName = () => document.getElementById(search().getAttribute('aria-activedescendant')!)?.getAttribute('data-icon-name');

describe('IconPicker', () => {
  beforeEach(() => clearRecentIcons());

  it('loads the icon set only when opened, then lists the whole solid set', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(loadedSolidIcons()).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Workspace icon Choose an icon' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Choose an icon' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(50));
    expect(loadedSolidIcons()!.length).toBeGreaterThan(1000);
    expect(search()).toHaveFocus();
    // The first page only; the rest behind "Show more".
    expect(screen.getAllByRole('option')).toHaveLength(96);
    await user.click(screen.getByRole('button', { name: /Show more/ }));
    expect(screen.getAllByRole('option')).toHaveLength(192);
  });

  it('searches by name, picks with Enter and hands back "fas fa-<name>"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Workspace icon/ }));
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.type(search(), 'industr');
    expect(optionNames()[0]).toBe('industry');
    expect(activeName()).toBe('industry');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('fas fa-industry');
    expect(screen.queryByRole('dialog')).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Workspace icon industry' });
    expect(trigger).toHaveFocus();
    expect(trigger.querySelector('svg')).not.toBeNull();
  });

  it('finds an icon by an older name the pack lists (home → house)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Workspace icon/ }));
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.type(search(), 'home');
    expect(optionNames()).toContain('house');
    await user.clear(search());
    await user.type(search(), 'zzzz-nothing');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No icon matches “zzzz-nothing”')).toBeInTheDocument();
  });

  it('moves through the grid with the arrow keys (8 columns) while the focus stays in the search box', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Workspace icon/ }));
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    const names = optionNames();
    expect(activeName()).toBe(names[0]);
    await user.keyboard('{ArrowRight}');
    expect(activeName()).toBe(names[1]);
    await user.keyboard('{ArrowDown}');
    expect(activeName()).toBe(names[9]);
    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(activeName()).toBe(names[0]);
    expect(search()).toHaveFocus();
    await user.click(screen.getAllByRole('option')[2]);
    expect(screen.getByRole('button', { name: `Workspace icon ${names[2]}` })).toBeInTheDocument();
  });

  it('shows recent choices first, in their own group', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const open = () => user.click(screen.getByRole('button', { name: /Workspace icon/ }));
    await open();
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.type(search(), 'rocket');
    await user.keyboard('{Enter}');
    await open();
    await user.type(search(), 'leaf');
    await user.keyboard('{Enter}');
    await open();
    expect(screen.getByRole('group', { name: 'Recent' })).toBeInTheDocument();
    expect(optionNames().slice(0, 2)).toEqual(['leaf', 'rocket']);
    expect(screen.getByRole('option', { name: 'leaf' })).toHaveAttribute('aria-selected', 'true');
    expect(readRecentIcons().slice(0, 2)).toEqual(['leaf', 'rocket']);
  });

  it('draws the chosen icon before the set loads through resolveIcon; Escape and an outside click close', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">outside</button>
        <IconPicker id="i" label="Icon" value="fas fa-gear" resolveIcon={(n) => (n === 'gear' ? faGear : undefined)} onChange={() => {}} />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Icon gear' });
    expect(trigger.querySelector('svg')).not.toBeNull();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a disabled picker does not open; placeholder and messages are the caller’s', async () => {
    const user = userEvent.setup();
    render(<IconPicker id="d" value="" onChange={() => {}} disabled placeholder="No icon" messages={{ dialog: 'Simge seç' }} />);
    const trigger = screen.getByRole('button', { name: 'No icon' });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('survives storage that throws', () => {
    clearRecentIcons();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readRecentIcons()).toEqual([]);
    spy.mockRestore();
  });
});

describe('icon helpers', () => {
  it('reads every spelling of a value', () => {
    expect(iconNameOf('fas fa-industry')).toBe('industry');
    expect(iconNameOf('fa-solid fa-industry')).toBe('industry');
    expect(iconNameOf('fa-industry')).toBe('industry');
    expect(iconNameOf(' industry ')).toBe('industry');
    expect(iconNameOf(undefined)).toBe('');
  });

  it('ranks exact, start, inside, then older names; recent breaks ties', () => {
    const icon = (name: string, terms: string[] = []) => ({ name, terms, icon: faGear }) as SolidIcon;
    const list = [icon('arrow-up'), icon('cart-arrow-down'), icon('arrow'), icon('house', ['home']), icon('arrows-up-down')];
    expect(searchIcons(list, 'arrow').map((i) => i.name)).toEqual(['arrow', 'arrow-up', 'arrows-up-down', 'cart-arrow-down']);
    expect(searchIcons(list, 'arrow up').map((i) => i.name)).toEqual(['arrow-up', 'arrows-up-down']);
    expect(searchIcons(list, 'home').map((i) => i.name)).toEqual(['house']);
    expect(searchIcons(list, 'arrow', ['arrows-up-down']).map((i) => i.name).slice(1, 3)).toEqual(['arrows-up-down', 'arrow-up']);
    expect(searchIcons(list, '', ['house']).map((i) => i.name)[0]).toBe('house');
  });
});
