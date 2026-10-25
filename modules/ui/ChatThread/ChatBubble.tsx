'use client';
import type { HTMLAttributes, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCheckDouble, faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Avatar } from '@/modules/ui/Avatar';

export type ChatSide = 'own' | 'other' | 'system';
export type ChatDeliveryStatus = 'sent' | 'delivered' | 'read';

export type ChatAttachment = {
  name: string;
  href?: string;
  /** Bytes (formatted as B / KB / MB) or a ready label such as "2 pages". */
  size?: number | string;
};

export type ChatMessageAction = {
  id: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Shown instead of the label; the label stays the accessible name and the tooltip. */
  icon?: ReactNode;
};

export type ChatBubbleProps = {
  side: ChatSide;
  authorName: string;
  avatarUrl?: string | null;
  /** Replaces the initials avatar (an icon for a bot, a brand mark …). */
  avatar?: ReactNode;
  body: ReactNode;
  /** The time as shown; empty hides it. */
  time?: string;
  /** ISO value for the `<time>` element. */
  dateTime?: string;
  /** A badge or any node shown after the time (moderation state, "edited" …). */
  status?: ReactNode;
  delivery?: ChatDeliveryStatus;
  deliveryLabels?: Record<ChatDeliveryStatus, string>;
  attachments?: ChatAttachment[];
  attachmentsLabel?: string;
  actions?: ChatMessageAction[];
  actionsLabel?: string;
  /** Same author as the message above: no avatar, no name, tighter gap. */
  grouped?: boolean;
  /** Shows the author name over the bubble (default: only for other people's messages). */
  showAuthor?: boolean;
  showAvatar?: boolean;
  /** Still being written (a streamed reply): typing dots while empty, a caret after the text. */
  pending?: boolean;
  /** Spoken while pending (the caret and dots are decorative). */
  pendingLabel?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'children'>;

const DEFAULT_DELIVERY_LABELS: Record<ChatDeliveryStatus, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

export function formatAttachmentSize(size: number | string): string {
  if (typeof size === 'string') return size;
  if (!Number.isFinite(size) || size < 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isEmptyBody(body: ReactNode): boolean {
  return body === null || body === undefined || body === false || body === '';
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex items-center gap-1', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
    </span>
  );
}

/**
 * One chat message: avatar, author, bubble, attachments and a meta row (time,
 * status, delivery ticks, actions). `ChatThread` lays these out; the social
 * vertical's `MessageBubble` is a thin adapter over it.
 *
 * Actions stay in the tab order even while they are faded out: hovering the
 * message or focusing into it shows them, and on a touch screen (no hover)
 * they are always shown.
 */
export function ChatBubble({
  side,
  authorName,
  avatarUrl,
  avatar,
  body,
  time,
  dateTime,
  status,
  delivery,
  deliveryLabels = DEFAULT_DELIVERY_LABELS,
  attachments,
  attachmentsLabel = 'Attachments',
  actions,
  actionsLabel = 'Message actions',
  grouped = false,
  showAuthor,
  showAvatar = true,
  pending = false,
  pendingLabel = 'Writing…',
  className,
  ...rest
}: ChatBubbleProps) {
  if (side === 'system') {
    return (
      <article
        {...rest}
        aria-busy={pending || undefined}
        className={cn('my-3 flex flex-col items-center gap-0.5 text-center', className)}
      >
        <div className="max-w-[85%] rounded-full bg-surface-sunken px-3 py-1 text-xs text-text-secondary whitespace-pre-wrap break-words">
          {body}
        </div>
        {(time || status) && (
          <p className="inline-flex items-center gap-1.5 text-[10px] text-text-secondary tabular-nums">
            {time && <time dateTime={dateTime}>{time}</time>}
            {status}
          </p>
        )}
      </article>
    );
  }

  const own = side === 'own';
  const nameShown = !grouped && (showAuthor ?? !own);
  const avatarShown = showAvatar && !own;
  const visibleActions = actions?.filter(Boolean) ?? [];
  const empty = isEmptyBody(body);

  return (
    <article
      {...rest}
      aria-busy={pending || undefined}
      className={cn(
        'group flex items-end gap-2',
        own ? 'flex-row-reverse' : 'flex-row',
        grouped ? 'mt-0.5' : 'mt-3',
        className,
      )}
    >
      {avatarShown && (
        <div className={cn('w-8 shrink-0', grouped && 'invisible')} aria-hidden={grouped || undefined}>
          {!grouped && (avatar ?? <Avatar src={avatarUrl} name={authorName || '?'} size="sm" />)}
        </div>
      )}

      <div className={cn('flex min-w-0 max-w-[75%] flex-col', own ? 'items-end' : 'items-start')}>
        {nameShown && (
          <p className="mb-0.5 px-1 text-[11px] font-medium text-text-secondary">{authorName}</p>
        )}
        <div
          data-part="bubble"
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm leading-snug whitespace-pre-wrap break-words',
            own
              ? 'bg-primary text-primary-fg rounded-br-sm'
              : 'bg-surface-overlay text-text-primary rounded-bl-sm',
          )}
        >
          {pending && empty ? (
            <TypingDots className="py-1.5 opacity-70" />
          ) : (
            <>
              {body}
              {pending && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-current opacity-60"
                />
              )}
            </>
          )}
          {pending && <span className="sr-only">{pendingLabel}</span>}
        </div>

        {attachments && attachments.length > 0 && (
          <ul aria-label={attachmentsLabel} className={cn('mt-1 flex flex-wrap gap-1.5', own && 'justify-end')}>
            {attachments.map((file, index) => {
              const size = file.size === undefined ? '' : formatAttachmentSize(file.size);
              const content = (
                <>
                  <FontAwesomeIcon icon={faPaperclip} className="h-3 w-3 shrink-0 text-text-secondary" aria-hidden="true" />
                  <span className="truncate">{file.name}</span>
                  {size && <span className="shrink-0 text-text-secondary tabular-nums">{size}</span>}
                </>
              );
              const chip =
                'inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface-base px-2 py-1 text-xs text-text-primary';
              return (
                <li key={`${file.name}-${index}`} className="max-w-full">
                  {file.href ? (
                    <a
                      href={file.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        chip,
                        'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      )}
                    >
                      {content}
                    </a>
                  ) : (
                    <span className={chip}>{content}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {(time || status || (own && delivery) || visibleActions.length > 0) && (
          <div
            className={cn(
              'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[10px] text-text-secondary tabular-nums',
              own && 'flex-row-reverse',
            )}
          >
            {time && <time dateTime={dateTime}>{time}</time>}
            {status}
            {own && delivery && (
              <span className="inline-flex items-center">
                <FontAwesomeIcon
                  icon={delivery === 'sent' ? faCheck : faCheckDouble}
                  className={cn('h-2.5 w-2.5', delivery === 'read' ? 'text-info' : 'text-text-disabled')}
                  aria-hidden="true"
                />
                <span className="sr-only">{deliveryLabels[delivery]}</span>
              </span>
            )}
            {visibleActions.length > 0 && (
              <span
                role="group"
                aria-label={actionsLabel}
                className={cn(
                  'inline-flex items-center gap-1 transition-opacity',
                  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
                )}
              >
                {visibleActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    title={action.label}
                    aria-label={action.icon ? action.label : undefined}
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-text-secondary',
                      'hover:bg-surface-overlay hover:text-text-primary',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      action.destructive && 'hover:text-error',
                    )}
                  >
                    {action.icon ? <span aria-hidden="true">{action.icon}</span> : action.label}
                  </button>
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
