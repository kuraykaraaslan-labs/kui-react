import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu, arrangeMenuItems, mergeMenuItems, type DropdownItem } from './DropdownMenu';

const ITEMS: DropdownItem[] = [
  { label: 'Edit', onClick: vi.fn() },
  { type: 'separator' },
  { label: 'Delete', danger: true, onClick: vi.fn() },
  { label: 'Archive', disabled: true, onClick: vi.fn() },
];

describe('DropdownMenu', () => {
  it('is closed by default (menu not in the document)', () => {
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByText('Options').closest('[aria-haspopup]')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the menu on trigger click, with every item and the separator', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} />);
    await user.click(screen.getByText('Options'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('clicking an item calls its onClick and closes the menu', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={[{ label: 'Edit', onClick }]} />);
    await user.click(screen.getByText('Options'));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a disabled item is not clickable and does not fire onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={[{ label: 'Archive', disabled: true, onClick }]} />);
    await user.click(screen.getByText('Options'));
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeDisabled();
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Escape closes the open menu', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} />);
    await user.click(screen.getByText('Options'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking outside the menu closes it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DropdownMenu trigger={<button>Options</button>} items={ITEMS} />
        <button>Outside</button>
      </div>,
    );
    await user.click(screen.getByText('Options'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders an optional header above the items', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} header={<span>Signed in as jane@acme.com</span>} />);
    await user.click(screen.getByText('Options'));
    expect(screen.getByText('Signed in as jane@acme.com')).toBeInTheDocument();
  });

  it('align="right" applies the right-aligned class', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} align="right" />);
    await user.click(screen.getByText('Options'));
    expect(screen.getByRole('menu').className).toContain('right-0');
  });

  it('moves focus into the menu (first item) on open', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} />);
    await user.click(screen.getByText('Options'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus());
  });

  it('returns focus to the trigger when closed via Escape', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} />);
    const trigger = screen.getByText('Options');
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('Tab from the last focusable item (disabled items are skipped) wraps to the first', async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} />);
    await user.click(screen.getByText('Options'));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus());
    // Archive is disabled, so Delete is the last *focusable* item.
    screen.getByRole('menuitem', { name: 'Delete' }).focus();
    await user.tab();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  describe('contributed items', () => {
    async function open(items: DropdownItem[], extra: Partial<React.ComponentProps<typeof DropdownMenu>> = {}) {
      const user = userEvent.setup();
      render(<DropdownMenu trigger={<button>Options</button>} items={items} {...extra} />);
      await user.click(screen.getByText('Options'));
      return user;
    }

    it('hidden items are left out, with no stray separators', async () => {
      await open([
        { label: 'Edit' },
        { type: 'separator' },
        { label: 'Call', hidden: true },
        { type: 'separator' },
        { label: 'Delete', danger: true },
      ]);
      expect(screen.queryByRole('menuitem', { name: 'Call' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('separator')).toHaveLength(1);
    });

    it('orders items by group and order, with a separator between groups', async () => {
      await open([
        { id: 'sign-out', label: 'Sign out', group: 'session', order: 1000 },
        { id: 'profile', label: 'Profile', group: 'account', order: 100 },
        { type: 'separator' },
        { id: 'dnd', label: 'Do not disturb', group: 'status', order: 50 },
        { id: 'settings', label: 'Settings', group: 'account', order: 200 },
      ]);
      expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Do not disturb', 'Profile', 'Settings', 'Sign out']);
      expect(screen.getAllByRole('separator')).toHaveLength(2);
    });

    it('an item with href renders as a link and still closes the menu', async () => {
      const onClick = vi.fn();
      const user = await open([{ id: 'docs', label: 'Docs', href: '#docs', onClick }]);
      const link = screen.getByRole('menuitem', { name: 'Docs' });
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '#docs');
      expect(link).toHaveAttribute('data-item-id', 'docs');
      await user.click(link);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('a disabled item with href is a disabled button, never a link', async () => {
      await open([{ label: 'Docs', href: '/docs', disabled: true }]);
      const item = screen.getByRole('menuitem', { name: 'Docs' });
      expect(item.tagName).toBe('BUTTON');
      expect(item).toBeDisabled();
    });

    it('disabledReason shows under a disabled item and describes it', async () => {
      await open([{ label: 'Archive', disabled: true, disabledReason: 'Only owners can archive' }]);
      const item = screen.getByRole('menuitem', { name: 'Archive' });
      expect(item).toHaveAccessibleDescription('Only owners can archive');
      expect(item).toHaveAttribute('title', 'Only owners can archive');
      expect(screen.getByText('Only owners can archive')).toBeInTheDocument();
    });

    it('disabledReason is ignored while the item is enabled', async () => {
      await open([{ label: 'Archive', disabledReason: 'Only owners can archive' }]);
      expect(screen.queryByText('Only owners can archive')).not.toBeInTheDocument();
    });

    it('portal renders the open menu in document.body, outside the trigger container', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const { container } = render(
        <DropdownMenu portal align="right" trigger={<button>Options</button>} items={[{ label: 'Edit', onClick }]} />,
      );
      await user.click(screen.getByText('Options'));
      const menu = screen.getByRole('menu');
      expect(container.contains(menu)).toBe(false);
      expect(menu.className).toContain('fixed');
      // above every overlay (a Drawer or a Modal is z-[100]): its trigger may sit in one (next-boilerplate e2e round 5, V1-B14)
      expect(menu.className).toContain('z-[110]');
      // A click inside the portalled menu is not an outside click.
      await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('placement', () => {
    const rect = (r: Partial<DOMRect>) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {}, ...r } as DOMRect);

    it('opens below its trigger by default', async () => {
      const user = userEvent.setup();
      render(<DropdownMenu trigger={<button>Options</button>} items={ITEMS} />);
      await user.click(screen.getByText('Options'));
      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('data-placement', 'bottom');
      expect(menu.className).toContain('mt-1');
      expect(menu.className).not.toContain('bottom-full');
    });

    it('top places an in-place menu above the trigger', async () => {
      const user = userEvent.setup();
      render(<DropdownMenu placement="top" trigger={<button>Options</button>} items={ITEMS} />);
      await user.click(screen.getByText('Options'));
      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('data-placement', 'top');
      expect(menu.className).toContain('bottom-full');
      expect(menu.className).not.toContain('mt-1');
    });

    it('top with portal anchors the menu\'s bottom edge above the trigger and caps its height to the space above', async () => {
      const spy = rect({ top: 600, bottom: 632, left: 300, right: 332 });
      const user = userEvent.setup();
      render(<DropdownMenu placement="top" portal align="right" trigger={<button>Options</button>} items={ITEMS} />);
      await user.click(screen.getByText('Options'));
      const menu = screen.getByRole('menu');
      const vh = document.documentElement.clientHeight;
      expect(menu.className).toContain('fixed');
      expect(menu.style.top).toBe('');
      expect(menu.style.bottom).toBe(`${vh - 600 + 4}px`);
      expect(menu.style.maxHeight).toBe('588px');
      expect(menu.className).toContain('overflow-y-auto');
      spy.mockRestore();
    });

    it('top with portal never gets a negative cap when the trigger is at the very top', async () => {
      const spy = rect({ top: 2, bottom: 20, left: 10, right: 30 });
      const user = userEvent.setup();
      render(<DropdownMenu placement="top" portal trigger={<button>Options</button>} items={ITEMS} />);
      await user.click(screen.getByText('Options'));
      expect(screen.getByRole('menu').style.maxHeight).toBe('0px');
      spy.mockRestore();
    });

    it('portal with the default placement still hangs below the trigger', async () => {
      const spy = rect({ top: 10, bottom: 40, left: 10, right: 50 });
      const user = userEvent.setup();
      render(<DropdownMenu portal trigger={<button>Options</button>} items={ITEMS} />);
      await user.click(screen.getByText('Options'));
      const menu = screen.getByRole('menu');
      expect(menu.style.top).toBe('44px');
      expect(menu.style.bottom).toBe('');
      spy.mockRestore();
    });

    it('keyboard: Enter opens an upward menu, arrows wrap, Escape closes and returns focus to the trigger', async () => {
      const user = userEvent.setup();
      render(<DropdownMenu placement="top" portal trigger={<button>Options</button>} items={[{ label: 'One' }, { label: 'Two' }]} />);
      const trigger = screen.getByRole('button', { name: 'Options' });
      trigger.focus();
      await user.keyboard('{Enter}');
      const one = await screen.findByRole('menuitem', { name: 'One' });
      await waitFor(() => expect(one).toHaveFocus());
      await user.keyboard('{ArrowUp}');
      expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  });

  describe('page menu extensions', () => {
    function pages(onWater = vi.fn()): DropdownItem[] {
      return [
        { id: 'overview', label: 'Overview', group: 'pages', selected: true, trailing: <span>Home</span> },
        { id: 'alarms', label: 'Alarms', group: 'pages', disabled: true },
        { id: 'water', label: 'Water', group: 'pages', onClick: onWater },
        { id: 'energy', label: 'Energy', group: 'pages' },
        { id: 'line-1', label: 'Line 1', group: 'drill' },
        { id: 'line-2', label: 'Line 2', group: 'drill' },
        { id: 'pump', label: 'Pump room', group: 'drill' },
        { id: 'boiler', label: 'Boiler', group: 'drill' },
      ];
    }
    const SEARCH = { placeholder: 'Find a page', emptyText: 'No page matches' };
    const GROUP_LABELS = { pages: 'Pages', drill: 'Drill-downs' };

    async function open(props: Partial<React.ComponentProps<typeof DropdownMenu>> = {}) {
      const user = userEvent.setup();
      render(<DropdownMenu trigger={<button>Pages</button>} items={pages()} {...props} />);
      await user.click(screen.getByRole('button', { name: 'Pages' }));
      return user;
    }

    it('renders headings as muted, non-focusable presentation labels', async () => {
      await open({
        items: [{ type: 'heading', id: 'h', label: 'Pages' }, { label: 'Overview' }, { label: 'Energy' }],
      });
      const heading = screen.getByText('Pages', { selector: '[role="presentation"]' });
      expect(heading).toHaveClass('text-xs', 'uppercase', 'text-text-secondary');
      expect(heading).not.toHaveAttribute('tabindex');
      expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Overview', 'Energy']);
    });

    it('groupLabels draws a heading for each labelled group instead of a separator', async () => {
      await open({ groupLabels: GROUP_LABELS });
      expect(screen.getByText('Pages', { selector: '[role="presentation"]' })).toBeInTheDocument();
      expect(screen.getByText('Drill-downs', { selector: '[role="presentation"]' })).toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('marks the selected item as current, tints it and focuses it on open', async () => {
      await open({ items: [{ label: 'Overview' }, { label: 'Energy', selected: true }, { label: 'Water' }] });
      const selected = screen.getByRole('menuitem', { name: 'Energy' });
      expect(selected).toHaveAttribute('aria-current', 'true');
      expect(selected).toHaveClass('bg-primary-subtle', 'text-primary', 'font-semibold');
      expect(screen.getByRole('menuitem', { name: 'Overview' })).not.toHaveAttribute('aria-current');
      await waitFor(() => expect(selected).toHaveFocus());
    });

    it('a selected link carries aria-current too', async () => {
      await open({ items: [{ label: 'Overview', href: '#overview', selected: true }] });
      expect(screen.getByRole('menuitem', { name: 'Overview' })).toHaveAttribute('aria-current', 'true');
    });

    it('draws trailing content at the far end of the row', async () => {
      await open({ items: [{ label: 'Overview', trailing: <span data-testid="badge">Home</span> }] });
      const badge = screen.getByTestId('badge');
      expect(screen.getByRole('menuitem', { name: /^Overview/ })).toContainElement(badge);
      expect(badge.parentElement).toHaveClass('ml-auto');
    });

    it('renders a footer under the entries, outside the menu list, and applies menuClassName to the panel', async () => {
      await open({ items: [{ label: 'Overview' }], footer: <a href="#manage">Manage pages</a>, menuClassName: 'w-72' });
      const menu = screen.getByRole('menu');
      const footer = screen.getByText('Manage pages');
      expect(menu).not.toContainElement(footer);
      expect(footer.parentElement).toHaveClass('border-t', 'border-border');
      expect(menu.parentElement).toHaveClass('w-72');
      expect(menu.parentElement).toContainElement(footer);
    });

    it('menuClassName lands on the menu itself when there is no search box or footer', async () => {
      await open({ items: [{ label: 'Overview' }], menuClassName: 'w-72' });
      expect(screen.getByRole('menu')).toHaveClass('w-72');
    });

    it('shows no search box below minItems', async () => {
      await open({ items: pages().slice(0, 7), search: SEARCH });
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('shows the search box from 8 entries (or minItems), focused on open', async () => {
      await open({ search: SEARCH, groupLabels: GROUP_LABELS });
      const box = screen.getByRole('searchbox', { name: 'Find a page' });
      expect(box).toHaveAttribute('placeholder', 'Find a page');
      // The search box stays put while a long list scrolls.
      expect(screen.getByRole('menu')).toHaveClass('max-h-96', 'overflow-y-auto');
      expect(screen.getByRole('menu')).not.toContainElement(box);
      await waitFor(() => expect(box).toHaveFocus());
    });

    it('minItems lowers the threshold and ariaLabel names the box', async () => {
      await open({ items: pages().slice(0, 3), search: { ...SEARCH, minItems: 3, ariaLabel: 'Search pages' } });
      expect(screen.getByRole('searchbox', { name: 'Search pages' })).toBeInTheDocument();
    });

    it('filters entries by label in any case, keeping only headings with a match', async () => {
      const user = await open({ search: SEARCH, groupLabels: GROUP_LABELS });
      await user.type(screen.getByRole('searchbox'), 'LINE');
      expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Line 1', 'Line 2']);
      expect(screen.getByText('Drill-downs')).toBeInTheDocument();
      expect(screen.queryByText('Pages', { selector: '[role="presentation"]' })).not.toBeInTheDocument();
    });

    it('shows emptyText when nothing matches', async () => {
      const user = await open({ search: SEARCH });
      await user.type(screen.getByRole('searchbox'), 'zzz');
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('No page matches');
    });

    it('Enter in the search box activates the first enabled match', async () => {
      const onWater = vi.fn();
      const user = userEvent.setup();
      render(<DropdownMenu trigger={<button>Pages</button>} items={pages(onWater)} search={SEARCH} />);
      await user.click(screen.getByRole('button', { name: 'Pages' }));
      await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
      // "a" matches Alarms (disabled) before Water.
      await user.keyboard('a{Enter}');
      expect(onWater).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('forgets the query when the menu closes', async () => {
      const user = await open({ search: SEARCH });
      await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
      await user.keyboard('line');
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: 'Pages' }));
      expect(screen.getByRole('searchbox')).toHaveValue('');
      expect(screen.getAllByRole('menuitem')).toHaveLength(8);
    });

    it('ArrowDown from the search box goes to the first item', async () => {
      const user = await open({ search: SEARCH });
      await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: /^Overview/ })).toHaveFocus();
    });

    it('arrow keys move between enabled items and wrap; Home and End jump to the ends', async () => {
      const user = await open({
        items: [{ label: 'Edit' }, { label: 'Delete' }, { label: 'Archive', disabled: true }, { label: 'Share' }],
      });
      const item = (name: string) => screen.getByRole('menuitem', { name });
      await waitFor(() => expect(item('Edit')).toHaveFocus());
      await user.keyboard('{ArrowDown}');
      expect(item('Delete')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('Share')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(item('Edit')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(item('Share')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(item('Edit')).toHaveFocus();
      await user.keyboard('{End}');
      expect(item('Share')).toHaveFocus();
    });

    it('arrow keys skip headings', async () => {
      const user = await open({ items: pages(), groupLabels: GROUP_LABELS });
      await waitFor(() => expect(screen.getByRole('menuitem', { name: /^Overview/ })).toHaveFocus());
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: 'Line 1' })).toHaveFocus();
    });

    describe('controlled open', () => {
      it('shows the menu while open is true and reports requests through onOpenChange', async () => {
        const onOpenChange = vi.fn();
        const user = userEvent.setup();
        const { rerender } = render(
          <DropdownMenu open trigger={<button>Pages</button>} items={[{ label: 'Overview' }]} onOpenChange={onOpenChange} />,
        );
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pages' })).toHaveAttribute('aria-expanded', 'true');
        await user.click(screen.getByRole('menuitem', { name: 'Overview' }));
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        // The host owns the state: the menu stays until it passes open={false}.
        expect(screen.getByRole('menu')).toBeInTheDocument();
        rerender(<DropdownMenu open={false} trigger={<button>Pages</button>} items={[{ label: 'Overview' }]} onOpenChange={onOpenChange} />);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });

      it('a trigger click while closed asks to open without opening by itself', async () => {
        const onOpenChange = vi.fn();
        const user = userEvent.setup();
        render(<DropdownMenu open={false} trigger={<button>Pages</button>} items={[{ label: 'Overview' }]} onOpenChange={onOpenChange} />);
        await user.click(screen.getByRole('button', { name: 'Pages' }));
        expect(onOpenChange).toHaveBeenCalledWith(true);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });

      it('Escape asks to close', async () => {
        const onOpenChange = vi.fn();
        const user = userEvent.setup();
        render(<DropdownMenu open trigger={<button>Pages</button>} items={[{ label: 'Overview' }]} onOpenChange={onOpenChange} />);
        await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Overview' })).toHaveFocus());
        await user.keyboard('{Escape}');
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });

      it('a host shortcut opens the menu and focus lands on the selected item', async () => {
        function Host() {
          const [open, setOpen] = useState(false);
          return (
            <div onKeyDown={(e) => { if (e.key === 'g') setOpen(true); }}>
              <input aria-label="Board" />
              <DropdownMenu
                open={open}
                onOpenChange={setOpen}
                trigger={<button>Pages</button>}
                items={[{ label: 'Overview' }, { label: 'Energy', selected: true }]}
              />
            </div>
          );
        }
        render(<Host />);
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Board' }), { key: 'g' });
        expect(screen.getByRole('menu')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Energy' })).toHaveFocus());
        await userEvent.setup().keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });

      it('uncontrolled menus report open and close through onOpenChange too', async () => {
        const onOpenChange = vi.fn();
        const user = userEvent.setup();
        render(<DropdownMenu trigger={<button>Pages</button>} items={[{ label: 'Overview' }]} onOpenChange={onOpenChange} />);
        await user.click(screen.getByRole('button', { name: 'Pages' }));
        expect(onOpenChange).toHaveBeenLastCalledWith(true);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        await user.click(screen.getByRole('menuitem', { name: 'Overview' }));
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('arrangeMenuItems / mergeMenuItems', () => {
    it('leaves a list without group or order exactly as it is', () => {
      const items: DropdownItem[] = [{ label: 'A' }, { type: 'separator' }, { label: 'B' }];
      expect(arrangeMenuItems(items)).toEqual(items);
    });

    const labels = (list: DropdownItem[]) =>
      list.map((i) => (i.type === 'separator' ? '-' : i.type === 'heading' ? `#${i.label}` : i.label));

    it('keeps headings in a plain list and drops one with no visible entry under it', () => {
      expect(
        labels(
          arrangeMenuItems([
            { type: 'heading', label: 'Pages' },
            { label: 'Overview' },
            { type: 'heading', label: 'Empty' },
            { type: 'separator' },
            { type: 'heading', label: 'Hidden only' },
            { label: 'Secret', hidden: true },
            { type: 'heading', label: 'Drill-downs' },
            { label: 'Line 1' },
            { type: 'heading', label: 'Trailing' },
          ]),
        ),
      ).toEqual(['#Pages', 'Overview', '-', '#Drill-downs', 'Line 1']);
    });

    it('a hidden heading is left out like any hidden entry', () => {
      expect(labels(arrangeMenuItems([{ type: 'heading', label: 'Pages', hidden: true }, { label: 'Overview' }]))).toEqual(['Overview']);
    });

    it('groupLabels puts a heading in place of the separator before a labelled group (the first one too)', () => {
      const items: DropdownItem[] = [
        { label: 'Line 1', group: 'drill', order: 10 },
        { label: 'Overview', group: 'pages', order: 1 },
        { type: 'heading', label: 'Ignored in grouped mode' },
        { label: 'Help', group: 'misc', order: 20 },
        { label: 'Energy', group: 'pages', order: 2 },
      ];
      const arranged = arrangeMenuItems(items, { groupLabels: { pages: 'Pages', drill: 'Drill-downs' } });
      expect(labels(arranged)).toEqual(['#Pages', 'Overview', 'Energy', '#Drill-downs', 'Line 1', '-', 'Help']);
      expect(arranged[0]).toEqual({ type: 'heading', id: 'group:pages', label: 'Pages' });
      // Without labels the grouped layout is unchanged.
      expect(labels(arrangeMenuItems(items))).toEqual(['Overview', 'Energy', '-', 'Line 1', '-', 'Help']);
    });

    it('groupLabels ignores inherited keys and empty labels', () => {
      const arranged = arrangeMenuItems(
        [{ label: 'A', group: 'constructor' }, { label: 'B', group: 'b' }],
        { groupLabels: { b: '' } },
      );
      expect(labels(arranged)).toEqual(['A', '-', 'B']);
    });

    it('mergeMenuItems carries headings like any other entry', () => {
      const merged = mergeMenuItems([{ type: 'heading', id: 'h', label: 'Old' }, { id: 'a', label: 'A' }], [{ type: 'heading', id: 'h', label: 'New' }]);
      expect(labels(merged)).toEqual(['#New', 'A']);
    });

    it('mergeMenuItems replaces by id in place and appends the rest', () => {
      const merged = mergeMenuItems(
        [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        [{ id: 'b', label: 'B2' }, { id: 'c', label: 'C' }, { label: 'No id' }],
      );
      expect(merged.map((i) => (i.type === 'separator' ? '-' : i.label))).toEqual(['A', 'B2', 'C', 'No id']);
    });
  });
});
