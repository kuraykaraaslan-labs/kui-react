import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ChatThread, formatAttachmentSize, type ChatThreadMessage } from './index';

// jsdom has no layout: the log's scroll geometry is driven from here.
const geometry = { scrollHeight: 1000, clientHeight: 400 };
const scrollTops = new WeakMap<Element, number>();
const saved: Record<string, PropertyDescriptor | undefined> = {};
beforeAll(() => {
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'] as const) {
    saved[key] = Object.getOwnPropertyDescriptor(Element.prototype, key);
  }
  Object.defineProperty(Element.prototype, 'scrollHeight', {
    configurable: true,
    get() { return this.getAttribute('role') === 'log' ? geometry.scrollHeight : 0; },
  });
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get() { return this.getAttribute('role') === 'log' ? geometry.clientHeight : 0; },
  });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get() { return scrollTops.get(this) ?? 0; },
    set(value: number) { scrollTops.set(this, value); },
  });
});
afterAll(() => {
  for (const [key, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(Element.prototype, key, descriptor);
  }
});

const msg = (id: string, over: Partial<ChatThreadMessage> = {}): ChatThreadMessage => ({
  id,
  author: { name: 'Ada' },
  side: 'other',
  body: `body ${id}`,
  at: '2026-10-25T10:00:00Z',
  ...over,
});

function scrollLog(top: number) {
  const log = screen.getByRole('log');
  log.scrollTop = top;
  fireEvent.scroll(log);
}

describe('ChatThread: order and labels', () => {
  it('shows messages oldest first whatever order they come in, ties keep the given order', () => {
    render(
      <ChatThread
        items={[
          msg('c', { at: '2026-10-25T10:02:00Z' }),
          msg('a', { at: '2026-10-25T10:00:00Z' }),
          msg('b1', { at: '2026-10-25T10:01:00Z' }),
          msg('b2', { at: '2026-10-25T10:01:00Z' }),
        ]}
      />,
    );
    const ids = screen.getAllByRole('article').map((el) => el.getAttribute('data-message-id'));
    expect(ids).toEqual(['a', 'b1', 'b2', 'c']);
  });

  it('is a polite log; each message is an article named by author and time', () => {
    render(
      <ChatThread
        items={[msg('1', { author: { name: 'Grace' }, time: '10:00' })]}
        messages={{ label: 'Support chat' }}
      />,
    );
    const log = screen.getByRole('log', { name: 'Support chat' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(within(log).getByRole('article', { name: 'Grace, 10:00' })).toBeInTheDocument();
  });

  it('own messages sit on the right without a name unless showOwnAuthor; system messages are centred', () => {
    const { rerender } = render(
      <ChatThread
        items={[
          msg('1', { side: 'own', author: { name: 'You' }, body: 'mine' }),
          msg('2', { side: 'system', author: { name: 'System' }, body: 'Ada joined', at: '2026-10-25T10:10:00Z' }),
        ]}
      />,
    );
    expect(screen.getByText('mine').className).toContain('bg-primary');
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.getByText('Ada joined').className).toContain('rounded-full');
    rerender(<ChatThread showOwnAuthor items={[msg('1', { side: 'own', author: { name: 'You' }, body: 'mine' })]} />);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('groups consecutive messages of one author under one name', () => {
    render(
      <ChatThread
        items={[
          msg('1', { at: '2026-10-25T10:00:00Z' }),
          msg('2', { at: '2026-10-25T10:01:00Z' }),
          msg('3', { at: '2026-10-25T10:30:00Z' }),
        ]}
      />,
    );
    expect(screen.getAllByText('Ada')).toHaveLength(2);
  });

  it('adds day separators when asked, and an empty message or spinner when there is nothing', () => {
    const { rerender } = render(
      <ChatThread
        daySeparators
        formatDay={(d) => `day ${d.toISOString().slice(0, 10)}`}
        timeZone="UTC"
        items={[msg('1', { at: '2026-10-24T10:00:00Z' }), msg('2', { at: '2026-10-25T09:00:00Z' })]}
      />,
    );
    expect(screen.getAllByRole('separator').map((el) => el.getAttribute('aria-label'))).toEqual([
      'day 2026-10-24',
      'day 2026-10-25',
    ]);
    rerender(<ChatThread items={[]} messages={{ empty: 'Say hi' }} />);
    expect(screen.getByText('Say hi')).toBeInTheDocument();
    rerender(<ChatThread items={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('No messages yet.')).toBeNull();
  });

  it('renders status, attachments and the composer slot', () => {
    render(
      <ChatThread
        items={[
          msg('1', {
            status: <span>Held for review</span>,
            attachments: [{ name: 'invoice.pdf', href: '/f/1', size: 2048 }, { name: 'notes.txt' }],
          }),
        ]}
        composer={<textarea aria-label="Reply" />}
      />,
    );
    expect(screen.getByText('Held for review')).toBeInTheDocument();
    const files = screen.getByRole('list', { name: 'Attachments' });
    expect(within(files).getByRole('link', { name: /invoice\.pdf/ })).toHaveAttribute('href', '/f/1');
    expect(within(files).getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reply' })).toBeInTheDocument();
    expect(formatAttachmentSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('ChatThread: actions', () => {
  it('runs an action from a keyboard-reachable button and keeps icon actions named', () => {
    const report = vi.fn();
    const remove = vi.fn();
    render(
      <ChatThread
        items={[
          msg('1', {
            actions: [
              { id: 'report', label: 'Report', onClick: report, icon: <i>!</i> },
              { id: 'delete', label: 'Delete', onClick: remove, destructive: true },
            ],
          }),
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Message actions' });
    const reportButton = within(group).getByRole('button', { name: 'Report' });
    expect(reportButton).toHaveAttribute('title', 'Report');
    reportButton.focus();
    expect(document.activeElement).toBe(reportButton);
    fireEvent.click(reportButton);
    fireEvent.click(within(group).getByRole('button', { name: 'Delete' }));
    expect(report).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('ChatThread: streaming and typing', () => {
  it('marks the last message busy while pending: dots when empty, then text with a caret', () => {
    const { rerender } = render(<ChatThread pending items={[msg('1'), msg('2', { body: '' })]} />);
    const last = screen.getAllByRole('article')[1];
    expect(last).toHaveAttribute('aria-busy', 'true');
    expect(within(last).getByText('Writing…')).toBeInTheDocument();
    expect(screen.getAllByRole('article')[0]).not.toHaveAttribute('aria-busy');
    rerender(<ChatThread pending items={[msg('1'), msg('2', { body: 'Hel' })]} />);
    expect(screen.getByText(/Hel/)).toBeInTheDocument();
    rerender(<ChatThread items={[msg('1'), msg('2', { body: 'Hello' })]} />);
    expect(screen.getAllByRole('article')[1]).not.toHaveAttribute('aria-busy');
    expect(screen.queryByText('Writing…')).toBeNull();
  });

  it('says who is typing', () => {
    const { rerender } = render(<ChatThread items={[]} typing={[{ name: 'Ada' }]} />);
    expect(screen.getByText('Ada is typing…')).toBeInTheDocument();
    rerender(<ChatThread items={[]} typing={[{ name: 'Ada' }, { name: 'Grace' }]} />);
    expect(screen.getByText('Ada, Grace are typing…')).toBeInTheDocument();
  });
});

describe('ChatThread: reading position', () => {
  it('starts at the bottom and follows new messages and a growing reply while there', () => {
    geometry.scrollHeight = 1000;
    const { rerender } = render(<ChatThread items={[msg('1')]} />);
    const log = screen.getByRole('log');
    expect(log.scrollTop).toBe(1000);
    geometry.scrollHeight = 1200;
    rerender(<ChatThread items={[msg('1'), msg('2', { at: '2026-10-25T10:05:00Z' })]} />);
    expect(log.scrollTop).toBe(1200);
    geometry.scrollHeight = 1300;
    rerender(<ChatThread pending items={[msg('1'), msg('2', { at: '2026-10-25T10:05:00Z', body: 'longer' })]} />);
    expect(log.scrollTop).toBe(1300);
  });

  it('stays put while scrolled up, offers "New messages" and jumps back on click', () => {
    geometry.scrollHeight = 1000;
    const { rerender } = render(<ChatThread items={[msg('1')]} />);
    const log = screen.getByRole('log');
    scrollLog(100); // 1000 - 100 - 400 = 500 px from the bottom
    geometry.scrollHeight = 1200;
    rerender(<ChatThread items={[msg('1'), msg('2', { at: '2026-10-25T10:05:00Z' })]} />);
    expect(log.scrollTop).toBe(100);
    const jump = screen.getByRole('button', { name: /New messages \(1\)/ });
    fireEvent.click(jump);
    expect(log.scrollTop).toBe(1200);
    expect(screen.queryByRole('button', { name: /New messages/ })).toBeNull();
  });

  it('my own new message takes me to the bottom even when scrolled up', () => {
    geometry.scrollHeight = 1000;
    const { rerender } = render(<ChatThread items={[msg('1')]} />);
    const log = screen.getByRole('log');
    scrollLog(0);
    geometry.scrollHeight = 1100;
    rerender(<ChatThread items={[msg('1'), msg('2', { side: 'own', at: '2026-10-25T10:05:00Z' })]} />);
    expect(log.scrollTop).toBe(1100);
    expect(screen.queryByRole('button', { name: /New messages/ })).toBeNull();
  });

  it('scrolling back to the bottom clears the counter', () => {
    geometry.scrollHeight = 1000;
    const { rerender } = render(<ChatThread items={[msg('1')]} />);
    scrollLog(0);
    rerender(<ChatThread items={[msg('1'), msg('2', { at: '2026-10-25T10:05:00Z' })]} />);
    expect(screen.getByRole('button', { name: /New messages/ })).toBeInTheDocument();
    scrollLog(600);
    expect(screen.queryByRole('button', { name: /New messages/ })).toBeNull();
  });

  it('"Load older" calls the host and keeps the reader on the same line when the page lands', () => {
    geometry.scrollHeight = 1000;
    const onLoadOlder = vi.fn();
    const items = [msg('5', { at: '2026-10-25T10:05:00Z' }), msg('6', { at: '2026-10-25T10:06:00Z' })];
    const { rerender } = render(<ChatThread items={items} hasOlder onLoadOlder={onLoadOlder} />);
    const log = screen.getByRole('log');
    scrollLog(0); // reading the top: 1000 px from the bottom
    fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
    rerender(<ChatThread items={items} hasOlder loadingOlder onLoadOlder={onLoadOlder} />);
    expect(screen.getByRole('button', { name: 'Loading older messages…' })).toBeDisabled();
    expect(log).toHaveAttribute('aria-busy', 'true');
    geometry.scrollHeight = 1600; // the older page adds 600 px on top
    act(() => {
      rerender(
        <ChatThread
          items={[msg('3', { at: '2026-10-25T10:03:00Z' }), msg('4', { at: '2026-10-25T10:04:00Z' }), ...items]}
          hasOlder={false}
          onLoadOlder={onLoadOlder}
        />,
      );
    });
    expect(log.scrollTop).toBe(600);
    expect(screen.queryByRole('button', { name: /Load older/ })).toBeNull();
  });

  it('a swapped list (another conversation) starts at the bottom again', () => {
    geometry.scrollHeight = 1000;
    const { rerender } = render(<ChatThread items={[msg('1')]} />);
    const log = screen.getByRole('log');
    scrollLog(0);
    geometry.scrollHeight = 900;
    rerender(<ChatThread items={[msg('x1'), msg('x2', { at: '2026-10-25T10:01:00Z' })]} />);
    expect(log.scrollTop).toBe(900);
    expect(screen.queryByRole('button', { name: /New messages/ })).toBeNull();
  });
});
