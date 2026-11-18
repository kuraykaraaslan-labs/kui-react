'use client';
import { Fragment, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { formatMessage } from '@/modules/ui/Table/types';
import {
  ChatBubble,
  type ChatAttachment,
  type ChatDeliveryStatus,
  type ChatMessageAction,
  type ChatSide,
} from './ChatBubble';
import { ChatTypingIndicator } from './ChatTypingIndicator';

export { ChatBubble, TypingDots, formatAttachmentSize } from './ChatBubble';
export type { ChatBubbleProps, ChatAttachment, ChatDeliveryStatus, ChatMessageAction, ChatSide } from './ChatBubble';
export { ChatTypingIndicator } from './ChatTypingIndicator';
export type { ChatTypingIndicatorProps } from './ChatTypingIndicator';

export type ChatThreadAuthor = {
  name: string;
  avatarUrl?: string | null;
  /** Replaces the initials avatar (a bot icon, a brand mark …). */
  avatar?: ReactNode;
};

export type ChatThreadMessage = {
  id: string;
  author: ChatThreadAuthor;
  side: ChatSide;
  body: ReactNode;
  at: Date | string | number;
  /** The time exactly as shown; overrides `formatTime` for this message. */
  time?: string;
  /** A badge (or any node) after the time: moderation state, "edited" … */
  status?: ReactNode;
  /** Own messages only: sent / delivered / read ticks. */
  delivery?: ChatDeliveryStatus;
  attachments?: ChatAttachment[];
  actions?: ChatMessageAction[];
  /** Rendered under the bubble: source links, a form card, a suggestion … */
  extras?: ReactNode;
};

export type ChatThreadTyper = ChatThreadAuthor;

export type ChatThreadMessages = {
  /** Accessible name of the message log. */
  label: string;
  empty: string;
  loading: string;
  loadOlder: string;
  loadingOlder: string;
  /** Jump button while scrolled up; `{count}` is filled in. */
  newMessages: string;
  /** `{name}` is filled in. */
  typingOne: string;
  /** `{names}` (comma separated) is filled in. */
  typingMany: string;
  /** Accessible name of one message; `{author}` and `{time}` are filled in. */
  messageLabel: string;
  /** Spoken while the last message is still being written. */
  writing: string;
  attachments: string;
  actions: string;
  sent: string;
  delivered: string;
  read: string;
};

export const DEFAULT_CHAT_THREAD_MESSAGES: ChatThreadMessages = {
  label: 'Conversation',
  empty: 'No messages yet.',
  loading: 'Loading…',
  loadOlder: 'Load older messages',
  loadingOlder: 'Loading older messages…',
  newMessages: 'New messages ({count})',
  typingOne: '{name} is typing…',
  typingMany: '{names} are typing…',
  messageLabel: '{author}, {time}',
  writing: 'Writing…',
  attachments: 'Attachments',
  actions: 'Message actions',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

export type ChatThreadProps = {
  /** The conversation, in any order: it is shown oldest first (ties keep the given order). */
  items: ChatThreadMessage[];
  /** First load with nothing to show yet: a spinner instead of the empty message. */
  loading?: boolean;
  /** There are older messages: a "Load older" button at the top. */
  hasOlder?: boolean;
  loadingOlder?: boolean;
  /** Called by the "Load older" button; the reader's place is kept when the older page lands on top. */
  onLoadOlder?: () => void;
  /** The newest message is still being written (a streamed reply). */
  pending?: boolean;
  /** Who is typing right now. */
  typing?: ChatThreadTyper[];
  /** A dated line where the day changes. */
  daySeparators?: boolean;
  locale?: string;
  timeZone?: string;
  formatTime?: (at: Date) => string;
  formatDay?: (at: Date) => string;
  /** Replaces the default empty line (pass an EmptyState for a richer one). */
  emptyMessage?: ReactNode;
  /** Show the author's name over the viewer's own messages too. */
  showOwnAuthor?: boolean;
  /** Show the author's name over other people's messages (default true; an assistant panel names its one author in its header). */
  showOtherAuthor?: boolean;
  /** Fold consecutive messages from the same author (within five minutes) under one avatar and name. */
  groupConsecutive?: boolean;
  showAvatars?: boolean;
  /** Distance from the bottom (px) that still counts as "at the bottom". */
  stickThreshold?: number;
  /** Rendered under the list: the page keeps its own composer. */
  composer?: ReactNode;
  messages?: Partial<ChatThreadMessages>;
  listClassName?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function toTime(at: Date | string | number): number {
  const time = (at instanceof Date ? at : new Date(at)).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function scrollToEnd(el: HTMLElement, smooth = false) {
  if (smooth && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  else el.scrollTop = el.scrollHeight;
}

/**
 * A controlled chat thread: the host owns the messages, the composer and every
 * call; the thread draws them oldest first and handles the reading position.
 *
 * ## Reading position
 *
 * While the reader is at the bottom the thread sticks there: new messages, a
 * streamed reply growing and the typing row all keep the newest line in view.
 * Once they scroll up it stays put, and a "New messages" button counts what
 * arrived below. The viewer's own new message always scrolls down. "Load older"
 * notes the distance from the bottom before asking for the page and restores it
 * after the page lands, so the line they were reading does not jump.
 */
export function ChatThread({
  items,
  loading = false,
  hasOlder = false,
  loadingOlder = false,
  onLoadOlder,
  pending = false,
  typing,
  daySeparators = false,
  locale,
  timeZone,
  formatTime,
  formatDay,
  emptyMessage,
  showOwnAuthor = false,
  showOtherAuthor = true,
  groupConsecutive = true,
  showAvatars = true,
  stickThreshold = 48,
  composer,
  messages,
  className,
  listClassName,
  ...rest
}: ChatThreadProps) {
  const msgs = { ...DEFAULT_CHAT_THREAD_MESSAGES, ...messages };
  const listRef = useRef<HTMLDivElement>(null);
  const olderAnchorRef = useRef<number | null>(null);
  const firstIdRef = useRef<string | undefined>(undefined);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);

  const sorted = items
    .map((item, index) => ({ item, index, time: toTime(item.at) }))
    .sort((a, b) => (a.time === b.time ? a.index - b.index : a.time - b.time))
    .map(({ item }) => item);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // A new newest message: count it while the reader is scrolled up (their own
  // message instead takes them down). When the old newest message is gone the
  // whole list was swapped (another conversation): start again at the bottom.
  // Derived during render, not in an effect.
  const [lastId, setLastId] = useState(last?.id);
  if (last?.id !== lastId) {
    setLastId(last?.id);
    const appended = lastId !== undefined && sorted.some((m) => m.id === lastId);
    if (!appended || last?.side === 'own') {
      if (!atBottom) setAtBottom(true);
      if (unseen) setUnseen(0);
    } else if (!atBottom) {
      setUnseen((n) => n + 1);
    }
  }

  // After every render: restore the place after an older page, else follow the bottom.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const previousFirst = firstIdRef.current;
    firstIdRef.current = first?.id;
    if (olderAnchorRef.current !== null && first?.id !== previousFirst) {
      el.scrollTop = el.scrollHeight - olderAnchorRef.current;
      olderAnchorRef.current = null;
      return;
    }
    if (atBottom) scrollToEnd(el);
  });

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= stickThreshold;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (bottom && unseen) setUnseen(0);
  }

  function handleLoadOlder() {
    const el = listRef.current;
    if (el) olderAnchorRef.current = el.scrollHeight - el.scrollTop;
    onLoadOlder?.();
  }

  function jumpToLatest() {
    const el = listRef.current;
    setUnseen(0);
    setAtBottom(true);
    if (el) scrollToEnd(el, true);
  }

  const timeFormat = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' });
  const dayFormat = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

  const rows = sorted.map((item, index) => {
    const at = item.at instanceof Date ? item.at : new Date(item.at);
    const valid = !Number.isNaN(at.getTime());
    const time = item.time ?? (valid ? (formatTime ? formatTime(at) : timeFormat.format(at)) : '');
    const dayKey = valid ? dayKeyFormat.format(at) : '';
    const previous = index > 0 ? sorted[index - 1] : undefined;
    const previousAt = previous ? toTime(previous.at) : Number.NaN;
    const previousDayKey =
      previous && Number.isFinite(previousAt) ? dayKeyFormat.format(new Date(previousAt)) : '';
    const showDay = daySeparators && valid && dayKey !== previousDayKey;
    const grouped =
      groupConsecutive &&
      !!previous &&
      !showDay &&
      item.side !== 'system' &&
      previous.side === item.side &&
      previous.author.name === item.author.name &&
      valid &&
      Number.isFinite(previousAt) &&
      at.getTime() - previousAt <= GROUP_WINDOW_MS;
    return {
      item,
      time,
      dateTime: valid ? at.toISOString() : undefined,
      dayLabel: showDay ? (formatDay ? formatDay(at) : dayFormat.format(at)) : null,
      grouped,
    };
  });

  const typers = typing ?? [];
  const typingLabel =
    typers.length === 0
      ? ''
      : typers.length === 1
        ? formatMessage(msgs.typingOne, { name: typers[0].name })
        : formatMessage(msgs.typingMany, { names: typers.map((p) => p.name).join(', ') });

  const showSpinner = loading && sorted.length === 0;
  const showEmpty = !loading && sorted.length === 0;
  const showJump = unseen > 0 && !atBottom;

  return (
    <div {...rest} className={cn('flex min-h-0 flex-col', className)} data-part="chat-thread">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={msgs.label}
          aria-busy={loading || loadingOlder || undefined}
          onScroll={handleScroll}
          className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3', listClassName)}
        >
          {hasOlder && onLoadOlder && (
            <div className="flex justify-center pb-1" data-part="load-older">
              <Button size="sm" variant="ghost" loading={loadingOlder} disabled={loadingOlder} onClick={handleLoadOlder}>
                {loadingOlder ? msgs.loadingOlder : msgs.loadOlder}
              </Button>
            </div>
          )}

          {showSpinner && (
            <div role="status" className="flex justify-center py-10">
              <span
                aria-hidden="true"
                className="inline-block h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin"
              />
              <span className="sr-only">{msgs.loading}</span>
            </div>
          )}

          {showEmpty &&
            (emptyMessage ?? (
              <p className="py-8 text-center text-sm text-text-secondary">{msgs.empty}</p>
            ))}

          {rows.map(({ item, time, dateTime, dayLabel, grouped }, index) => {
            const isLast = index === rows.length - 1;
            return (
              <Fragment key={item.id}>
                {dayLabel && (
                  <div
                    role="separator"
                    aria-label={dayLabel}
                    className="my-4 flex items-center gap-3 text-[11px] font-medium text-text-secondary"
                  >
                    <span aria-hidden="true" className="h-px flex-1 bg-border" />
                    <span aria-hidden="true">{dayLabel}</span>
                    <span aria-hidden="true" className="h-px flex-1 bg-border" />
                  </div>
                )}
                <ChatBubble
                  side={item.side}
                  authorName={item.author.name}
                  avatarUrl={item.author.avatarUrl}
                  avatar={item.author.avatar}
                  body={item.body}
                  time={time}
                  dateTime={dateTime}
                  status={item.status}
                  delivery={item.delivery}
                  deliveryLabels={{ sent: msgs.sent, delivered: msgs.delivered, read: msgs.read }}
                  attachments={item.attachments}
                  attachmentsLabel={msgs.attachments}
                  actions={item.actions}
                  actionsLabel={msgs.actions}
                  grouped={grouped}
                  showAuthor={item.side === 'own' ? showOwnAuthor : showOtherAuthor}
                  showAvatar={showAvatars}
                  pending={pending && isLast}
                  pendingLabel={msgs.writing}
                  extras={item.extras}
                  aria-label={formatMessage(msgs.messageLabel, { author: item.author.name, time })}
                  data-message-id={item.id}
                />
              </Fragment>
            );
          })}

          {typers.length > 0 && (
            <ChatTypingIndicator
              label={typingLabel}
              name={typers[0].name}
              avatarUrl={typers[0].avatarUrl}
              avatar={typers[0].avatar}
              showAvatar={showAvatars}
            />
          )}
        </div>

        {showJump && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <button
              type="button"
              onClick={jumpToLatest}
              className={cn(
                'pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-base px-3 py-1.5',
                'text-xs font-medium text-text-primary shadow-md hover:bg-surface-overlay',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            >
              <FontAwesomeIcon icon={faArrowDown} className="h-3 w-3" aria-hidden="true" />
              {formatMessage(msgs.newMessages, { count: unseen })}
            </button>
          </div>
        )}
      </div>

      {composer && <div className="shrink-0">{composer}</div>}
    </div>
  );
}
