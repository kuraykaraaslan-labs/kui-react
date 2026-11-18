'use client';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCommentDots,
  faPaperPlane,
  faRotateLeft,
  faVolumeHigh,
  faVolumeXmark,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { ChatThread, type ChatThreadMessage, type ChatThreadMessages } from '@/modules/ui/ChatThread';
import { formatMessage } from '@/modules/ui/Table/types';

export type AssistantLauncherMessages = {
  /** Launcher's accessible name while the panel is closed. */
  open: string;
  /** Launcher's and the header close button's accessible name while the panel is open. */
  close: string;
  /** Header subtitle when the `subtitle` prop is not given. */
  subtitle: string;
  send: string;
  /** Consent button when `consent.acceptLabel` is not given. */
  startChat: string;
  /** Accessible name of the message box. */
  inputLabel: string;
  placeholder: string;
  /** Shown once more than 80 % of `maxLength` is used; `{count}` and `{max}` are filled in. */
  counter: string;
  /** Teaser close button. */
  dismissTeaser: string;
  /** `AssistantSources` heading inside the panel. */
  sources: string;
  /** Read after a source link that opens in a new tab. */
  opensInNewTab: string;
  /** Header button that starts the conversation over (shown with `onRestart`). */
  restart: string;
  /** Header toggle for the reply chime (shown with `onSoundChange`); `aria-pressed` says whether it is on. */
  sound: string;
};

export const DEFAULT_ASSISTANT_LAUNCHER_MESSAGES: AssistantLauncherMessages = {
  open: 'Open chat',
  close: 'Close chat',
  subtitle: 'AI assistant',
  send: 'Send',
  startChat: 'Start chat',
  inputLabel: 'Message',
  placeholder: 'Ask a question…',
  counter: '{count} / {max}',
  dismissTeaser: 'Dismiss',
  sources: 'Sources',
  opensInNewTab: '(opens in a new tab)',
  restart: 'Restart conversation',
  sound: 'Sound',
};

const AssistantMessagesContext = createContext<AssistantLauncherMessages | null>(null);

export type AssistantConsent = {
  /** The notice shown in place of the composer (privacy wording, a link to the policy …). */
  text: ReactNode;
  /** Defaults to `messages.startChat`. */
  acceptLabel?: string;
  accepted: boolean;
  onAccept: () => void;
};

export type AssistantTeaser = {
  text: string;
  onDismiss: () => void;
};

export type AssistantLauncherProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Panel heading, e.g. "Hermetry assistant"; also the assistant's name in the thread. */
  title: string;
  /** Defaults to `messages.subtitle`; `null` hides it. */
  subtitle?: ReactNode;
  /** The first assistant bubble, always shown (also before consent); not part of `items`. */
  greeting?: string;
  /** The conversation (`side: 'own'` = the visitor, `'other'` = the assistant). */
  items: ChatThreadMessage[];
  /**
   * A reply is on its way: while the newest item is the visitor's a typing row is shown;
   * once an assistant item is last it is drawn as still being written (a streamed reply).
   * Sending is blocked meanwhile.
   */
  pending?: boolean;
  onSend: (text: string) => void;
  /** Longest message (default 1000); the counter appears past 80 %. */
  maxLength?: number;
  /** Until accepted the composer is replaced by the notice and a "Start chat" button. */
  consent?: AssistantConsent;
  /** A small bubble above the closed launcher; clicking it opens the panel. */
  teaser?: AssistantTeaser;
  /** Replaces the composer (the assistant is resting: other ways to reach you). */
  offline?: ReactNode;
  /** Rendered under a message (after its own `extras`): sources, a quote form card, a forum card … */
  renderAfter?: (item: ChatThreadMessage) => ReactNode;
  /** Show each message's time (default false). */
  showTimes?: boolean;
  /** Starts the conversation over; a header button shows while there are `items`. The host clears its state. */
  onRestart?: () => void;
  /** A short two-note chime when a new assistant message arrives (default false). */
  sound?: boolean;
  /** Shows a header toggle for `sound`; keep the choice where the visitor's other preferences live. */
  onSoundChange?: (on: boolean) => void;
  /**
   * Hints for the message box while the host asks for one detail (an interview step):
   * `autoComplete="email"`, `inputMode="tel"`, a step's own `placeholder` …
   */
  inputProps?: Pick<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'autoComplete' | 'inputMode' | 'enterKeyHint' | 'spellCheck' | 'autoCapitalize' | 'placeholder'
  >;
  messages?: Partial<AssistantLauncherMessages>;
  /** Strings of the inner ChatThread (typing row, "Writing…", log name …). */
  threadMessages?: Partial<ChatThreadMessages>;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'>;

const GREETING_ID = '__assistant-greeting';
const SHADOW_FLOAT = 'shadow-[0_8px_24px_rgb(0_0_0/0.18)]';

type AudioContextCtor = new () => AudioContext;

/**
 * The reply chime: two sine notes (G5, then D6 110 ms later), made with Web Audio so
 * there is no file to load. Browsers only let a page start audio after a gesture, so
 * `unlock` runs on the visitor's clicks and key presses and `play` stays silent until then.
 */
function useChime() {
  const ctx = useRef<AudioContext | null>(null);
  const unlock = () => {
    if (typeof window === 'undefined') return;
    try {
      const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (Ctor && !ctx.current) ctx.current = new Ctor();
      if (ctx.current?.state === 'suspended') void ctx.current.resume();
    } catch {
      // No audio on this browser: the chat works without it.
    }
  };
  const play = () => {
    const ac = ctx.current;
    if (!ac) return;
    try {
      const t = ac.currentTime;
      for (const [freq, delay] of [
        [784, 0],
        [1175, 0.11],
      ] as const) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.07, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.32);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.34);
      }
    } catch {
      // As above.
    }
  };
  return { unlock, play };
}

/**
 * A floating AI-assistant chat for marketing sites: a round launcher fixed
 * bottom right, an optional teaser bubble over it and a chat panel. Controlled:
 * the host owns `open`, the messages and every network call; the list is the
 * shared `ChatThread`.
 *
 * Keyboard: Enter sends, Shift+Enter breaks the line, Escape closes the panel
 * and returns focus to the launcher. Opening focuses the message box (or the
 * "Start chat" button while consent is pending). New messages are announced
 * through the thread's polite log. Under 640px the panel fills the screen and
 * the launcher hides while it is open.
 */
export function AssistantLauncher({
  open,
  onOpenChange,
  title,
  subtitle,
  greeting,
  items,
  pending = false,
  onSend,
  maxLength = 1000,
  consent,
  teaser,
  offline,
  renderAfter,
  showTimes = false,
  onRestart,
  sound = false,
  onSoundChange,
  inputProps,
  messages,
  threadMessages,
  className,
  onKeyDown,
  onPointerDown,
  ...rest
}: AssistantLauncherProps) {
  const msgs = { ...DEFAULT_ASSISTANT_LAUNCHER_MESSAGES, ...messages };
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const titleId = `${baseId}-title`;
  const subtitleId = `${baseId}-subtitle`;
  const inputId = `${baseId}-input`;
  const counterId = `${baseId}-counter`;

  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState('');

  const chime = useChime();

  // A new assistant message chimes; the ones already there on the first render do not.
  const otherCount = items.filter((item) => item.side === 'other').length;
  const seenOther = useRef(otherCount);
  useEffect(() => {
    if (otherCount > seenOther.current && sound) chime.play();
    seenOther.current = otherCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `play` reads the latest context; only the count matters
  }, [otherCount]);

  const consentPending = !!consent && !consent.accepted;
  const mode: 'offline' | 'consent' | 'composer' = offline ? 'offline' : consentPending ? 'consent' : 'composer';

  // Focus on the way in, back to the launcher on the way out. Only on a change,
  // so a panel that is open from the first render never steals the page's focus.
  const wasOpen = useRef(open);
  const closingFromInside = useRef(false);
  useEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (open) {
      const target = mode === 'composer' ? textareaRef.current : mode === 'consent' ? startRef.current : closeRef.current;
      target?.focus();
      return;
    }
    const active = typeof document === 'undefined' ? null : document.activeElement;
    if (closingFromInside.current || !active || active === document.body) launcherRef.current?.focus();
    closingFromInside.current = false;
  }, [open, mode]);

  // Consent accepted while open: the button that had focus is gone, the message box takes it.
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === 'consent' && mode === 'composer' && open) textareaRef.current?.focus();
    previousMode.current = mode;
  }, [mode, open]);

  // The message box grows with its text from one to four lines.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight + 2}px`;
  }, [draft, open, mode]);

  function close() {
    closingFromInside.current = true;
    onOpenChange(false);
  }

  function restart() {
    onRestart?.();
    setDraft('');
    (textareaRef.current ?? startRef.current ?? closeRef.current)?.focus();
  }

  function toggleSound() {
    const next = !sound;
    onSoundChange?.(next);
    // Turning it on plays the chime once, so the visitor hears what they chose.
    if (next) {
      chime.unlock();
      chime.play();
    }
  }

  function handleRootKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (sound) chime.unlock();
    if (e.key === 'Escape' && open && !e.defaultPrevented) {
      e.preventDefault();
      close();
    }
  }

  function send() {
    const text = draft.trim();
    if (!text || pending) return;
    onSend(text.slice(0, maxLength));
    setDraft('');
  }

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    send();
  }

  const decorate = (item: ChatThreadMessage): ChatThreadMessage => {
    const after = renderAfter?.(item);
    const extras =
      item.extras && after ? (
        <>
          {item.extras}
          {after}
        </>
      ) : (
        item.extras ?? after ?? undefined
      );
    return { ...item, extras, time: showTimes ? item.time : '' };
  };

  const threadItems: ChatThreadMessage[] = [
    ...(greeting
      ? [{ id: GREETING_ID, side: 'other' as const, author: { name: title }, body: greeting, at: 0, time: '' }]
      : []),
    ...items.map(decorate),
  ];

  const last = items.length > 0 ? items[items.length - 1] : undefined;
  const streaming = pending && last?.side === 'other';
  const waiting = pending && !streaming;
  const count = draft.length;
  const showCounter = count > maxLength * 0.8;

  return (
    <AssistantMessagesContext.Provider value={msgs}>
      <div
        {...rest}
        data-part="assistant-launcher"
        className={cn(className)}
        onKeyDown={handleRootKeyDown}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          if (sound) chime.unlock();
        }}
      >
        {teaser && !open && (
          <div
            data-part="assistant-teaser"
            className={cn(
              'fixed right-5 bottom-22 z-60 max-w-[260px] max-sm:right-4 max-sm:bottom-21',
              'rounded-[16px_16px_4px_16px] border border-border bg-surface-base',
              SHADOW_FLOAT,
              'transition duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none',
            )}
          >
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className={cn(
                'block w-full rounded-[inherit] py-3 pr-8 pl-3.5 text-left text-sm leading-normal text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            >
              {teaser.text}
            </button>
            <Button
              variant="ghost"
              iconOnly
              aria-label={msgs.dismissTeaser}
              onClick={teaser.onDismiss}
              className="absolute top-1 right-1 h-6 w-6 rounded-full p-0 text-text-secondary"
            >
              <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        )}

        {open && (
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={subtitle === null ? undefined : subtitleId}
            data-part="assistant-panel"
            className={cn(
              'fixed right-5 bottom-22 z-60 flex h-[min(600px,100dvh_-_120px)] w-[380px] flex-col overflow-hidden',
              'rounded-2xl border border-border bg-surface-base shadow-[0_16px_48px_rgb(0_0_0/0.2)]',
              'max-sm:inset-0 max-sm:h-full max-sm:w-full max-sm:rounded-none max-sm:border-0',
              'transition duration-200 ease-out starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none',
            )}
          >
            <div data-part="assistant-header" className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary"
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-[15px] leading-tight font-semibold text-text-primary">
                  {title}
                </h2>
                {subtitle !== null && (
                  <p id={subtitleId} className="truncate text-xs text-text-secondary">
                    {subtitle ?? msgs.subtitle}
                  </p>
                )}
              </div>
              {onRestart && items.length > 0 && (
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={msgs.restart}
                  title={msgs.restart}
                  onClick={restart}
                  data-part="assistant-restart"
                  className="h-8 w-8 shrink-0 rounded-full p-0 text-text-secondary"
                >
                  <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
              {onSoundChange && (
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={msgs.sound}
                  title={msgs.sound}
                  aria-pressed={sound}
                  onClick={toggleSound}
                  data-part="assistant-sound"
                  className="h-8 w-8 shrink-0 rounded-full p-0 text-text-secondary"
                >
                  <FontAwesomeIcon icon={sound ? faVolumeHigh : faVolumeXmark} className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
              <Button
                ref={closeRef}
                variant="ghost"
                iconOnly
                aria-label={msgs.close}
                onClick={close}
                className="h-8 w-8 shrink-0 rounded-full p-0 text-text-secondary"
              >
                <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>

            <ChatThread
              className="min-h-0 flex-1"
              listClassName={cn(
                'p-4',
                // Assistant bubbles: raised surface + border; both sides 14px / 1.5, at most 85 % wide.
                '[&_[data-part=bubble]]:leading-normal [&_[data-part=content]]:max-w-[85%]',
                '[&_[data-side=other]_[data-part=bubble]]:border [&_[data-side=other]_[data-part=bubble]]:border-border',
                '[&_[data-side=other]_[data-part=bubble]]:bg-surface-raised',
                '[&_[data-part=typing-bubble]]:border [&_[data-part=typing-bubble]]:border-border',
                '[&_[data-part=typing-bubble]]:bg-surface-raised',
              )}
              items={threadItems}
              pending={streaming}
              typing={waiting ? [{ name: title }] : undefined}
              showAvatars={false}
              showOtherAuthor={false}
              messages={{ ...(showTimes ? {} : { messageLabel: '{author}' }), ...threadMessages }}
            />

            <div data-part="assistant-composer" className="shrink-0 border-t border-border p-3">
              {mode === 'offline' && <div className="text-sm text-text-secondary">{offline}</div>}

              {mode === 'consent' && consent && (
                <div className="flex flex-col gap-3">
                  <div className="text-xs leading-normal text-text-secondary">{consent.text}</div>
                  <Button ref={startRef} variant="primary" fullWidth onClick={consent.onAccept}>
                    {consent.acceptLabel ?? msgs.startChat}
                  </Button>
                </div>
              )}

              {mode === 'composer' && (
                <form
                  className="flex flex-col gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  <div className="flex items-end gap-2">
                    <label htmlFor={inputId} className="sr-only">
                      {msgs.inputLabel}
                    </label>
                    <textarea
                      ref={textareaRef}
                      id={inputId}
                      rows={1}
                      value={draft}
                      maxLength={maxLength}
                      {...inputProps}
                      placeholder={inputProps?.placeholder ?? msgs.placeholder}
                      aria-describedby={showCounter ? counterId : undefined}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      className={cn(
                        'max-h-26 min-h-10 flex-1 resize-none overflow-y-auto rounded-xl border border-border-strong bg-surface-base',
                        'px-3 py-2 text-sm leading-normal text-text-primary placeholder:text-text-disabled',
                        'focus:border-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus',
                      )}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      iconOnly
                      aria-label={msgs.send}
                      disabled={pending || !draft.trim()}
                      className="h-9 w-9 shrink-0 rounded-full p-0"
                    >
                      <FontAwesomeIcon icon={faPaperPlane} className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                  {showCounter && (
                    <p id={counterId} data-part="assistant-counter" className="text-right text-xs text-text-secondary tabular-nums">
                      {formatMessage(msgs.counter, { count, max: maxLength })}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        )}

        <button
          ref={launcherRef}
          type="button"
          aria-label={open ? msgs.close : msgs.open}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => (open ? close() : onOpenChange(true))}
          data-part="assistant-launcher-button"
          className={cn(
            'fixed right-5 bottom-5 z-60 flex h-14 w-14 items-center justify-center rounded-full max-sm:right-4 max-sm:bottom-4',
            'bg-primary text-primary-fg hover:bg-primary-hover',
            SHADOW_FLOAT,
            'transition-colors motion-reduce:transition-none',
            'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
            open && 'max-sm:hidden',
          )}
        >
          <FontAwesomeIcon icon={open ? faXmark : faCommentDots} className="h-5.5 w-5.5" aria-hidden="true" />
        </button>
      </div>
    </AssistantMessagesContext.Provider>
  );
}

export type AssistantSource = { title: string; url: string };

export type AssistantSourcesProps = {
  sources: AssistantSource[];
  /** Defaults to the launcher's `messages.sources` ("Sources"). */
  heading?: string;
  /** Open the links in a new tab (default true). */
  newTab?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

/** "Sources" and a list of links, for under an assistant answer. */
export function AssistantSources({ sources, heading, newTab = true, className, ...rest }: AssistantSourcesProps) {
  const msgs = useContext(AssistantMessagesContext) ?? DEFAULT_ASSISTANT_LAUNCHER_MESSAGES;
  const headingId = useId();
  if (sources.length === 0) return null;
  return (
    <div {...rest} data-part="assistant-sources" className={cn('flex flex-col gap-1 text-xs', className)}>
      <p id={headingId} className="font-semibold text-text-secondary">
        {heading ?? msgs.sources}
      </p>
      <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
        {sources.map((source) => (
          <li key={source.url} className="min-w-0">
            <a
              href={source.url}
              {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={cn(
                'break-words text-primary hover:underline',
                'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            >
              {source.title}
              {newTab && <span className="sr-only"> {msgs.opensInNewTab}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type AssistantCardProps = {
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons along the bottom. */
  actions?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>;

/** A bordered card under an assistant answer (a quote form, a forum link …). */
export function AssistantCard({ title, children, actions, className, ...rest }: AssistantCardProps) {
  return (
    <div
      {...rest}
      data-part="assistant-card"
      className={cn('flex flex-col gap-2 rounded-xl border border-border bg-surface-base p-3 text-sm text-text-primary', className)}
    >
      {title && <p className="text-sm font-semibold text-text-primary">{title}</p>}
      {children}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export type AssistantQuickReply = {
  /** Handed back to `onSelect`. */
  value: string;
  label: ReactNode;
  /** The step's main answer (Send, Confirm): drawn filled. */
  primary?: boolean;
};

export type AssistantQuickRepliesProps = {
  replies: AssistantQuickReply[];
  onSelect: (value: string) => void;
  /** While a step is being sent, or once it is answered. */
  disabled?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'>;

/**
 * Answer chips under the assistant's question (Skip, Confirm, Send, Cancel …), for a
 * host that asks for details as chat messages instead of a form. Typed answers still
 * go through `onSend`; render this through `renderAfter` on the newest question only.
 */
export function AssistantQuickReplies({ replies, onSelect, disabled = false, className, ...rest }: AssistantQuickRepliesProps) {
  if (replies.length === 0) return null;
  return (
    <div {...rest} role="group" data-part="assistant-quick-replies" className={cn('flex flex-wrap gap-1.5', className)}>
      {replies.map((reply) => (
        <button
          key={reply.value}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(reply.value)}
          data-primary={reply.primary ? '' : undefined}
          className={cn(
            'min-h-8 rounded-full border px-3 text-[13px] font-medium',
            reply.primary
              ? 'border-primary bg-primary text-primary-fg hover:border-primary-hover hover:bg-primary-hover'
              : 'border-border-strong bg-surface-base text-text-primary hover:bg-surface-raised',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
          )}
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}

export type AssistantQuoteProps = HTMLAttributes<HTMLQuoteElement>;

/** Text read back to the visitor inside a message (the summary they are asked to confirm). */
export function AssistantQuote({ className, ...rest }: AssistantQuoteProps) {
  return (
    <blockquote
      {...rest}
      data-part="assistant-quote"
      className={cn(
        'my-2 whitespace-pre-wrap rounded border-s-3 border-primary bg-surface-overlay px-2.5 py-1.5 text-text-primary',
        className,
      )}
    />
  );
}
