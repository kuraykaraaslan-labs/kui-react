import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationMenu, formatNotificationTime, type NotificationItem, type NotificationSource } from './NotificationMenu';

const items: NotificationItem[] = [
  { id: 'n1', title: 'Backup done', timestamp: 'now', read: false },
  { id: 'n2', title: 'Old news', timestamp: 'yesterday', read: true },
];

const NOW = new Date('2026-10-26T12:00:00Z').getTime();
const min = (n: number) => new Date(NOW - n * 60_000);

const alarms = (over: Partial<NotificationSource> = {}): NotificationSource => ({
  key: 'alarms',
  label: 'Alarms',
  unread: 3,
  items: [
    { id: 'a1', title: 'Pump hot', meta: 'Pump 4 · Plant A', at: min(2), read: false, icon: <span data-testid="sev">!</span>, href: '/alarms/a1' },
    { id: 'a2', title: 'Valve stuck', at: min(30), read: true, href: '/alarms/a2' },
  ],
  action: { label: 'Acknowledge all (3)', onClick: vi.fn() },
  viewAll: { label: 'View all alarms', href: '/alarms' },
  emptyLabel: 'No open alarms',
  ...over,
});
const notes: NotificationItem[] = [
  { id: 'n1', title: 'Backup done', at: min(1), read: false },
  { id: 'n2', title: 'Invoice ready', at: min(10), read: true },
];

const panel = () => screen.getByRole('dialog', { name: 'Notifications' });
const titles = () => within(panel()).getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent);

describe('NotificationMenu', () => {
  it('counts the sections in its one badge and shows them above the notifications', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu items={items} sections={<p>Alarm section</p>} extraCount={3} />);
    const trigger = screen.getByRole('button', { name: 'Notifications, 4 unread' });
    expect(trigger).toHaveTextContent('4');
    // mounted while closed (so a section keeps its counts live), but hidden
    expect(screen.getByText('Alarm section')).not.toBeVisible();
    await user.click(trigger);
    expect(screen.getByText('Alarm section')).toBeVisible();
    expect(screen.getByText('Backup done')).toBeVisible();
  });

  it('without sections the panel exists only while open', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu items={items} />);
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  });

  it('scrolls in one place only: the panel is a column no taller than the window, the list alone scrolls', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu items={items} />);
    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    expect(panel.className).toMatch(/\bflex-col\b/);
    expect(panel.className).toMatch(/max-h-\[calc\(100dvh-5rem\)\]/);
    expect(panel.className).toMatch(/\boverflow-hidden\b/);
    const list = within(panel).getByRole('list');
    expect(list.className).toMatch(/\boverflow-y-auto\b/);
    expect(list.className).toMatch(/\bmin-h-0\b/);
  });
});

describe('NotificationMenu: one list from every source (D40-16)', () => {
  it('merges the sources newest first; the badge is the unread notifications plus what each source reports', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu items={notes} sources={[alarms()]} now={NOW} locale="en" />);
    // 1 unread notification + 3 open alarms (more than the two listed)
    await user.click(screen.getByRole('button', { name: 'Notifications, 4 unread' }));
    expect(titles()).toEqual(['Backup done', 'Pump hot', 'Invoice ready', 'Valve stuck']);
    expect(within(panel()).getAllByText('4').length).toBeGreaterThan(0);
    // the alarm's own look, its device and site, a relative time in the viewer's language
    const pump = within(panel()).getByText('Pump hot').closest('li')!;
    expect(within(pump).getByTestId('sev')).toBeInTheDocument();
    expect(within(pump).getByText('Pump 4 · Plant A')).toBeInTheDocument();
    expect(within(pump).getByText('2 min. ago')).toBeInTheDocument();
    expect(pump.className).toContain('bg-primary-subtle/40'); // an open alarm is unread
  });

  it('writes relative times in the given locale', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu items={notes} now={NOW} locale="tr" />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(within(panel()).getByText(formatNotificationTime(min(1), { locale: 'tr', now: NOW }))).toBeInTheDocument();
    expect(formatNotificationTime(min(1), { locale: 'tr', now: NOW })).not.toBe(formatNotificationTime(min(1), { locale: 'en', now: NOW }));
    expect(formatNotificationTime(min(60 * 26), { locale: 'en', now: NOW })).toBe('yesterday');
    expect(formatNotificationTime('not a date', { now: NOW })).toBe('');
  });

  it('filters All / Alarms / Notifications; each header action and empty text where it applies', async () => {
    const user = userEvent.setup();
    const markAll = vi.fn();
    const source = alarms({ items: [] });
    render(<NotificationMenu items={notes} sources={[source]} onMarkAllRead={markAll} now={NOW} />);
    await user.click(screen.getByRole('button', { name: /Notifications, 4 unread/ }));
    const filter = within(panel()).getByRole('group', { name: 'Show' });
    expect(within(filter).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Alarms3', 'Notifications1']);
    expect(within(filter).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    // under All both actions apply
    expect(within(panel()).getByRole('button', { name: 'Mark all read' })).toBeInTheDocument();
    // a source's action closes the menu first (what it opens is not left under the panel), focus back on the bell
    await user.click(within(panel()).getByRole('button', { name: 'Acknowledge all (3)' }));
    expect(source.action!.onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /Notifications, 4 unread/ })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: /Notifications, 4 unread/ }));
    await user.click(within(panel()).getByRole('button', { name: /Alarms/ }));
    expect(within(panel()).queryByRole('button', { name: 'Mark all read' })).toBeNull();
    expect(within(panel()).getByText('No open alarms')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: /^Notifications/ }));
    expect(within(panel()).queryByRole('button', { name: /Acknowledge all/ })).toBeNull();
    expect(titles()).toEqual(['Backup done', 'Invoice ready']);
    await user.click(within(panel()).getByRole('button', { name: 'Mark all read' }));
    expect(markAll).toHaveBeenCalledTimes(1);
  });

  it('a source\'s summary shows under its own filter only', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu items={notes} sources={[alarms({ summary: '3 open · 2 acknowledged' })]} now={NOW} />);
    await user.click(screen.getByRole('button', { name: /Notifications, 4 unread/ }));
    expect(within(panel()).queryByText('3 open · 2 acknowledged')).toBeNull();
    await user.click(within(panel()).getByRole('button', { name: /Alarms/ }));
    expect(within(panel()).getByText('3 open · 2 acknowledged')).toBeInTheDocument();
  });

  it('a header action that goes away does not hand its focus to the next one', async () => {
    function Host() {
      const [own, setOwn] = useState(notes);
      return <NotificationMenu items={own} sources={[alarms()]} onMarkAllRead={() => setOwn(own.map((n) => ({ ...n, read: true })))} now={NOW} />;
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: /Notifications, 4 unread/ }));
    const markAll = within(panel()).getByRole('button', { name: 'Mark all read' });
    markAll.focus();
    await user.keyboard('{Enter}');
    expect(within(panel()).queryByRole('button', { name: 'Mark all read' })).toBeNull();
    expect(within(panel()).getByRole('button', { name: 'Acknowledge all (3)' })).not.toHaveFocus();
  });

  it('without sources there is no filter, and an item without a time keeps its place', async () => {
    const user = userEvent.setup();
    render(<NotificationMenu items={[...items, { id: 'n3', title: 'Dated', at: min(1), read: false }]} now={NOW} />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(within(panel()).queryByRole('group')).toBeNull();
    expect(titles()).toEqual(['Dated', 'Backup done', 'Old news']);
  });

  it('the footer links to every source page there is', async () => {
    const user = userEvent.setup();
    const onViewAll = vi.fn();
    const go = vi.fn();
    render(<NotificationMenu items={notes} sources={[alarms({ viewAll: { label: 'View all alarms', href: '/alarms', onClick: go } })]} onViewAll={onViewAll} now={NOW} />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    const link = within(panel()).getByRole('link', { name: 'View all alarms' });
    expect(link).toHaveAttribute('href', '/alarms');
    await user.click(link);
    expect(go).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    await user.click(within(panel()).getByRole('button', { name: 'View all notifications' }));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationMenu: a click opens the item (D40-15)', () => {
  it('a link with onClick: the host opens it in the app (no browser navigation) and the menu closes', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NotificationMenu items={[{ id: 'n', title: 'Open me', read: false, href: '/x/1', onClick }]} />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    const link = within(panel()).getByRole('link', { name: /Open me/ });
    expect(link).toHaveAttribute('href', '/x/1');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    fireEvent(link, click);
    expect(click.defaultPrevented).toBe(true);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("a modified click (a new tab) stays the browser's", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NotificationMenu items={[{ id: 'n', title: 'Open me', read: false, href: '/x/1', onClick }]} />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    fireEvent(within(panel()).getByRole('link', { name: /Open me/ }), click);
    expect(click.defaultPrevented).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
    expect(panel()).toBeVisible();
  });

  it('an item without a target runs its onClick (mark read) and closes', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NotificationMenu items={[{ id: 'n', title: 'Just read me', read: false, onClick }]} />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(within(panel()).queryByRole('link')).toBeNull();
    await user.click(within(panel()).getByRole('button', { name: /Just read me/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an inline action runs without opening the item, and the menu stays open', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ack = vi.fn();
    render(<NotificationMenu items={[]} sources={[alarms({ items: [{ id: 'a1', title: 'Pump hot', read: false, href: '/alarms/a1', onClick, action: { label: 'Acknowledge', onClick: ack } }] })]} />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    await user.click(within(panel()).getByRole('button', { name: 'Acknowledge' }));
    expect(ack).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    expect(panel()).toBeVisible();
  });
});
