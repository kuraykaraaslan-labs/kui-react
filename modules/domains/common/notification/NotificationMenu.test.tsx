import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NotificationMenu, type NotificationItem } from './NotificationMenu';

const items: NotificationItem[] = [
  { id: 'n1', title: 'Backup done', timestamp: 'now', read: false },
  { id: 'n2', title: 'Old news', timestamp: 'yesterday', read: true },
];

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
});
