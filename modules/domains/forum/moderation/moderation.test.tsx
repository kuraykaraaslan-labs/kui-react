import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { ModerationQueueSchema, ModerationReportInputSchema } from '../types';
import { demoModerationQueue, MODERATION_DEMO_NOW } from './demo';
import {
  applicableIds,
  applyModerationAction,
  itemActions,
  itemTabs,
  itemsForTab,
  moderationCounts,
  reasonSummary,
  relativeAge,
} from './queue';
import { ModerationQueueView } from './ModerationQueueView';
import { ReportPostButton, ReportPostDialog } from './ReportPostDialog';

afterEach(cleanup);

const queue = demoModerationQueue();
const byId = (id: string) => queue.items.find((i) => i.id === id)!;

describe('moderation queue logic', () => {
  it('the demo queue matches the contract', () => {
    expect(ModerationQueueSchema.parse(queue).items).toHaveLength(8);
    expect(ModerationReportInputSchema.safeParse({ reason: 'rude', note: '' }).success).toBe(false);
    expect(ModerationReportInputSchema.safeParse({ reason: 'abuse', note: 'x'.repeat(501) }).success).toBe(false);
    expect(ModerationReportInputSchema.parse({ reason: 'abuse' })).toEqual({ reason: 'abuse', note: '' });
  });

  it('tabs: reported while open reports, held while pending, spam while spam; a hidden reported post is on both', () => {
    expect(itemTabs(byId('101'))).toEqual(['reported']);
    expect(itemTabs(byId('103'))).toEqual(['reported', 'held']);
    expect(itemTabs(byId('104'))).toEqual(['held']);
    expect(itemTabs(byId('107'))).toEqual(['spam']);
    expect(moderationCounts(queue.items)).toEqual({ reported: 3, held: 4, spam: 2 });
  });

  it('working order: most reports then latest; held oldest first; spam newest first', () => {
    expect(itemsForTab(queue.items, 'reported').map((i) => i.id)).toEqual(['101', '103', '102']);
    expect(itemsForTab(queue.items, 'held').map((i) => i.id)).toEqual(['104', '103', '105', '106']);
    expect(itemsForTab(queue.items, 'spam').map((i) => i.id)).toEqual(['107', '108']);
  });

  it('actions per post and for a selection', () => {
    expect(itemActions(byId('101'))).toEqual(['dismiss', 'spam', 'trash']);
    expect(itemActions(byId('103'))).toEqual(['approve', 'dismiss', 'spam', 'trash']);
    expect(itemActions(byId('104'))).toEqual(['approve', 'spam', 'trash']);
    expect(itemActions(byId('107'))).toEqual(['approve', 'trash']);
    expect(applicableIds(queue.items, ['101', '104', '107', 'nope'], 'approve')).toEqual(['104', '107']);
  });

  it('applying actions: approve dismisses reports, spam resolves them, dismiss keeps the post, trash removes it', () => {
    const by = { id: 'u2', name: 'Jane' };
    const at = MODERATION_DEMO_NOW;
    const approved = applyModerationAction(queue.items, 'approve', ['103'], by, at).find((i) => i.id === '103')!;
    expect(approved.status).toBe('publish');
    expect(approved.holdReasons).toEqual([]);
    expect(approved.reports.every((r) => r.state === 'dismissed' && r.handledBy?.name === 'Jane')).toBe(true);
    const spammed = applyModerationAction(queue.items, 'spam', ['101'], by, at).find((i) => i.id === '101')!;
    expect(spammed.status).toBe('spam');
    expect(spammed.reports.map((r) => r.state)).toEqual(['resolved', 'resolved', 'resolved']);
    const dismissed = applyModerationAction(queue.items, 'dismiss', ['102'], by, at).find((i) => i.id === '102')!;
    expect(dismissed.status).toBe('publish');
    expect(dismissed.reports.map((r) => r.state)).toEqual(['dismissed', 'dismissed']);
    expect(applyModerationAction(queue.items, 'trash', ['108'], by, at).map((i) => i.id)).not.toContain('108');
    // approve does not touch a published post
    expect(applyModerationAction(queue.items, 'approve', ['101'], by, at)).toEqual(queue.items);
  });

  it('reason summary and relative ages', () => {
    expect(reasonSummary(byId('101').reports)).toEqual([{ reason: 'spam', count: 2 }, { reason: 'other', count: 1 }]);
    const now = new Date(MODERATION_DEMO_NOW);
    expect(relativeAge('2026-11-23T07:00:00Z', now, 'en')).toBe('3 hours ago');
    expect(relativeAge('2026-11-22T10:00:00Z', now, 'en')).toBe('yesterday');
    expect(relativeAge('2026-11-23T09:59:40Z', now, 'en')).toBe('this minute');
  });
});

describe('ModerationQueueView', () => {
  it('opens on the first tab with posts and shows counts per tab', () => {
    render(<ModerationQueueView queue={queue} locale="en" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Reported3', 'Held4', 'Spam2']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByRole('article')).toHaveLength(3);
    expect(within(panel).getAllByText('3 open reports')).toHaveLength(2);
    expect(within(panel).getByText('Spam or advertising × 2')).toBeInTheDocument();
    expect(within(panel).getByText('Same text in three topics today.').tagName).toBe('Q');
    expect(within(panel).getAllByText(/by Marco Bianchi/).length).toBeGreaterThan(0);
  });

  it('a reporter is "a member" when reporters are hidden', () => {
    render(<ModerationQueueView queue={queue} showReporters={false} />);
    expect(screen.queryByText(/Marco Bianchi/)).toBeNull();
    expect(within(screen.getByRole('tabpanel')).getAllByText(/by a member/).length).toBe(7);
  });

  it('the Held tab gives the hold reason in words', () => {
    render(<ModerationQueueView queue={queue} defaultTab="held" locale="en" />);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('A new account’s first posts: post 1 of 2')).toBeInTheDocument();
    expect(within(panel).getByText('Contains a blocked word: “casino”')).toBeInTheDocument();
    expect(within(panel).getByText('Hidden after member reports: 3 reports')).toBeInTheDocument();
    expect(within(panel).getAllByText('posted 4 hours ago').length).toBe(1);
  });

  it('Approve runs at once; Trash asks first in a ConfirmDialog', async () => {
    const onAction = vi.fn();
    render(<ModerationQueueView queue={queue} defaultTab="held" onAction={onAction} />);
    const first = within(screen.getByRole('tabpanel')).getAllByRole('article')[0];
    fireEvent.click(within(first).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('approve', ['104']));
    fireEvent.click(within(first).getByRole('button', { name: 'Trash' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Move this post to the trash')).toBeInTheDocument();
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Trash' }));
    await waitFor(() => expect(onAction).toHaveBeenLastCalledWith('trash', ['104']));
  });

  it('bulk: select all, then Dismiss reports on every selected post', async () => {
    const onAction = vi.fn();
    render(<ModerationQueueView queue={queue} onAction={onAction} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss reports \(3\)/ }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('dismiss', ['101', '103', '102']));
  });

  it('a failed action says so', async () => {
    render(<ModerationQueueView queue={queue} onAction={() => Promise.reject(new Error('x'))} />);
    const first = within(screen.getByRole('tabpanel')).getAllByRole('article')[0];
    fireEvent.click(within(first).getByRole('button', { name: 'Dismiss reports' }));
    expect(await screen.findByText('That did not work. Nothing was changed; please try again.')).toBeInTheDocument();
  });

  it('an empty queue shows an empty state per tab', () => {
    render(<ModerationQueueView queue={demoModerationQueue({ empty: true })} />);
    expect(screen.getByText('No open reports')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Reported0', 'Held0', 'Spam0']);
  });
});

describe('Report a post', () => {
  it('sends a reason and a note, then thanks the member; the button turns into "Reported"', async () => {
    const onReport = vi.fn();
    render(<ReportPostButton onReport={onReport} />);
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    const dialog = await screen.findByRole('dialog');
    const send = within(dialog).getByRole('button', { name: 'Send report' });
    expect(send).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Abuse or harassment/ }));
    fireEvent.change(within(dialog).getByLabelText('Note for the moderators (optional)'), { target: { value: '  Insults in the last line. ' } });
    expect(within(dialog).getByText('28 / 500')).toBeInTheDocument();
    fireEvent.click(send);
    await waitFor(() => expect(onReport).toHaveBeenCalledWith({ reason: 'abuse', note: 'Insults in the last line.' }));
    expect(await screen.findByText('Reported, thank you')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Report' })).toBeNull());
    expect(screen.getByText('Reported')).toBeInTheDocument();
  });

  it('already reported: no button', () => {
    render(<ReportPostButton reported onReport={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/You reported this post/)).toBeInTheDocument();
  });

  it('a failed report keeps the dialog open with an error', async () => {
    render(<ReportPostDialog open onClose={() => {}} onSubmit={() => Promise.reject(new Error('x'))} />);
    fireEvent.click(screen.getByRole('radio', { name: /Off-topic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('The report could not be sent. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeEnabled();
  });
});
