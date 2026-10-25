'use client';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * ConfirmDialog — the one confirmation of the design system. Every "are you sure?" goes through it (never the browser's
 * `window.confirm` / `window.prompt`). The base is a question, its consequence and two buttons; three optional gates are
 * added on top, in any combination:
 *
 * - `input`: a value the user gives with the answer (a reason, a name, a date). Returned in the result.
 * - `acknowledgement`: a responsibility text the user must tick before the confirm button unlocks.
 * - `phrase`: an exact phrase the user must type (a serial, a command word) for actions that cannot be undone.
 *
 * Two ways to use it: controlled (`<ConfirmDialog open … />`), or imperative through `confirmDialog(options)` with one
 * `<ConfirmHost />` mounted at the app root — it resolves `{ value, choice }` on confirm and `null` on cancel.
 */
export type ConfirmTone = 'default' | 'warning' | 'danger';

export type ConfirmInput = {
  kind: 'text' | 'textarea' | 'date';
  label: string;
  placeholder?: string;
  defaultValue?: string;
  /** An empty (trimmed) value keeps the confirm button locked. */
  required?: boolean;
  /** Minimum trimmed length; implies `required`. */
  minLength?: number;
  maxLength?: number;
  /** `date` only: ISO `YYYY-MM-DD` bounds. */
  min?: string;
  max?: string;
  hint?: string;
};

export type ConfirmChoice = 'confirm' | 'secondary';

export type ConfirmResult = {
  /** The `input` value (trimmed), or '' when the dialog has none. */
  value: string;
  /** `secondary` when the user picked the optional second action. */
  choice: ConfirmChoice;
};

export type ConfirmDialogProps = {
  open: boolean;
  /** Verb + object: "Delete user", not "Are you sure?". */
  title: string;
  /** Names the subject and states the consequence. */
  message?: React.ReactNode;
  tone?: ConfirmTone;
  /** Echoes the action ("Delete", "Revoke"), never "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  /** A second, different way forward ("Load theirs" beside "Keep mine"); resolves with `choice: 'secondary'`. */
  secondaryLabel?: string;
  /** Free content under the message: the affected items, a value to copy. */
  details?: React.ReactNode;
  input?: ConfirmInput;
  acknowledgement?: React.ReactNode;
  phrase?: string;
  /** The phrase field's label. Default = `Type "<phrase>" to confirm`. */
  phraseLabel?: string;
  busy?: boolean;
  /** An error from the action, shown in the footer while the dialog stays open. */
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Where the dialog mounts. Default = the element in fullscreen when there is one (a body portal is invisible then), else `document.body`. */
  portalTarget?: Element | string | null;
  onConfirm: (result: ConfirmResult) => void;
  onCancel: () => void;
  className?: string;
};

const toneIcon = { default: faCircleQuestion, warning: faTriangleExclamation, danger: faTriangleExclamation } as const;
const toneIconClass = { default: 'text-primary', warning: 'text-warning', danger: 'text-error' } as const;
const fieldClass = cn(
  'block w-full rounded-md border bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

/** True when the gates of `props` are all met by what the user entered. */
export function confirmReady(
  props: Pick<ConfirmDialogProps, 'input' | 'acknowledgement' | 'phrase'>,
  state: { value: string; acknowledged: boolean; typed: string },
): boolean {
  const { input, acknowledgement, phrase } = props;
  if (input) {
    const v = state.value.trim();
    const min = input.minLength ?? (input.required ? 1 : 0);
    if (v.length < min) return false;
    if (input.kind === 'date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  }
  if (acknowledgement && !state.acknowledged) return false;
  if (phrase !== undefined && state.typed.trim() !== phrase) return false;
  return true;
}

export function ConfirmDialog({
  open, title, message, tone = 'default', confirmLabel = 'Confirm', cancelLabel = 'Cancel', closeLabel, secondaryLabel,
  details, input, acknowledgement, phrase, phraseLabel, busy = false, error, size = 'md', portalTarget, onConfirm, onCancel, className,
}: ConfirmDialogProps) {
  const id = useId();
  const [value, setValue] = useState(input?.defaultValue ?? '');
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setValue(input?.defaultValue ?? ''); setAcknowledged(false); setTyped(''); }
  }
  const ready = confirmReady({ input, acknowledgement, phrase }, { value, acknowledged, typed });
  const phraseWrong = phrase !== undefined && typed !== '' && typed.trim() !== phrase;
  const submit = (choice: ConfirmChoice) => { if (ready && !busy) onConfirm({ value: value.trim(), choice }); };
  const cancel = () => { if (!busy) onCancel(); };
  // Enter in a single-line field confirms (a form with two fields has no implicit submission without a submit button).
  const enterSubmits = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit('confirm'); }
  };

  return (
    <Modal
      open={open}
      onClose={cancel}
      title={title}
      size={size}
      closeLabel={closeLabel}
      closeOnBackdropClick={!busy}
      portalTarget={portalTarget ?? (typeof document !== 'undefined' ? document.fullscreenElement : null)}
      className={className}
      footer={(
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {error && <p role="alert" className="mr-auto min-w-0 text-sm text-error">{error}</p>}
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>{cancelLabel}</Button>
          {secondaryLabel && (
            <Button variant="outline" size="sm" disabled={!ready || busy} onClick={() => submit('secondary')}>{secondaryLabel}</Button>
          )}
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            disabled={!ready || busy}
            loading={busy}
            onClick={() => submit('confirm')}
            data-confirm-action=""
          >
            {confirmLabel}
          </Button>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit('confirm'); }}>
        {message && (
          <div className="flex gap-3">
            <FontAwesomeIcon icon={toneIcon[tone]} aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0', toneIconClass[tone])} />
            <div className="min-w-0 flex-1 text-sm text-text-secondary whitespace-pre-line">{message}</div>
          </div>
        )}
        {details && <div className="text-sm text-text-primary">{details}</div>}
        {input && (
          <div className="space-y-1.5">
            <label htmlFor={`${id}-input`} className="block text-sm font-medium text-text-primary">
              {input.label}
              {(input.required || (input.minLength ?? 0) > 0) && <span aria-hidden="true" className="ml-0.5 text-error">*</span>}
            </label>
            {input.kind === 'textarea' ? (
              <textarea
                id={`${id}-input`}
                rows={3}
                value={value}
                placeholder={input.placeholder}
                maxLength={input.maxLength}
                disabled={busy}
                aria-required={input.required || undefined}
                aria-describedby={input.hint ? `${id}-hint` : undefined}
                onChange={(e) => setValue(e.target.value)}
                className={cn(fieldClass, 'border-border resize-y')}
              />
            ) : (
              <input
                id={`${id}-input`}
                type={input.kind === 'date' ? 'date' : 'text'}
                value={value}
                placeholder={input.placeholder}
                maxLength={input.maxLength}
                min={input.min}
                max={input.max}
                disabled={busy}
                autoComplete="off"
                onKeyDown={enterSubmits}
                aria-required={input.required || undefined}
                aria-describedby={input.hint ? `${id}-hint` : undefined}
                onChange={(e) => setValue(e.target.value)}
                className={cn(fieldClass, 'border-border')}
              />
            )}
            {input.hint && <p id={`${id}-hint`} className="text-xs text-text-secondary">{input.hint}</p>}
          </div>
        )}
        {acknowledgement && (
          <label
            htmlFor={`${id}-ack`}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-warning bg-warning-subtle px-3 py-2.5"
          >
            <input
              id={`${id}-ack`}
              type="checkbox"
              checked={acknowledged}
              disabled={busy}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
            <span className="text-sm text-text-primary">{acknowledgement}</span>
          </label>
        )}
        {phrase !== undefined && (
          <div className="space-y-1.5">
            <label htmlFor={`${id}-phrase`} className="block text-sm font-medium text-text-primary">
              {phraseLabel ?? `Type "${phrase}" to confirm`}
            </label>
            <input
              id={`${id}-phrase`}
              autoComplete="off"
              spellCheck={false}
              value={typed}
              disabled={busy}
              aria-invalid={phraseWrong}
              onKeyDown={enterSubmits}
              onChange={(e) => setTyped(e.target.value)}
              className={cn(fieldClass, 'font-mono', phraseWrong ? 'border-error' : 'border-border')}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

// ── Imperative API ──────────────────────────────────────────────────────────────────────────────────────────────────

export type ConfirmOptions = Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel' | 'busy' | 'error'> & {
  /**
   * Run the action inside the dialog: the confirm button spins while it runs, a throw keeps the dialog open with the
   * error in its footer, and the promise resolves only after it succeeded.
   */
  action?: (result: ConfirmResult) => unknown | Promise<unknown>;
  /** Turns a thrown error into the footer text. Default = the error's `message`. */
  errorMessage?: (error: unknown) => string;
};

type Pending = { key: number; options: ConfirmOptions; resolve: (r: ConfirmResult | null) => void };

let queue: Pending[] = [];
let nextKey = 1;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => queue;
const serverSnapshot = (): Pending[] => [];
let hosts = 0;

/**
 * Ask for a confirmation from anywhere on the client (a component, a hook, a store action). Needs one `<ConfirmHost />`
 * mounted; resolves `{ value, choice }` on confirm and `null` on cancel. Requests made while one is open wait their turn.
 */
export function confirmDialog(options: ConfirmOptions): Promise<ConfirmResult | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (hosts === 0 && process.env.NODE_ENV !== 'production') {
    console.error('confirmDialog: no <ConfirmHost /> is mounted, so the question can never be answered.');
  }
  return new Promise((resolve) => {
    queue = [...queue, { key: nextKey++, options, resolve }];
    emit();
  });
}

/** Answers every open and waiting request with `null` (cancel): on sign-out, a route change, or between tests. */
export function cancelAllConfirms() {
  const all = queue;
  queue = [];
  emit();
  for (const p of all) p.resolve(null);
}

/** The hook form of `confirmDialog`, for components that prefer hooks. */
export function useConfirm(): typeof confirmDialog {
  return confirmDialog;
}

function settle(key: number, result: ConfirmResult | null) {
  const item = queue.find((p) => p.key === key);
  if (!item) return;
  queue = queue.filter((p) => p.key !== key);
  emit();
  item.resolve(result);
}

const defaultErrorMessage = (e: unknown) => (e instanceof Error && e.message) || String(e);

/** Renders the request at the head of the `confirmDialog` queue. Mount exactly one, at the app root. */
export function ConfirmHost() {
  const pending = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const head = pending[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [shownKey, setShownKey] = useState<number | undefined>();
  if (head?.key !== shownKey) { setShownKey(head?.key); setBusy(false); setError(undefined); }
  // The last request stays rendered (closed) so its text does not vanish while the dialog fades out.
  const last = useRef<Pending | undefined>(undefined);
  if (head) last.current = head;
  useEffect(() => { hosts += 1; return () => { hosts -= 1; }; }, []);
  if (!head) {
    if (!last.current) return null;
    const { action: _a, errorMessage: _e, ...closed } = last.current.options;
    return <ConfirmDialog key={last.current.key} {...closed} open={false} onConfirm={() => {}} onCancel={() => {}} />;
  }
  const { action, errorMessage = defaultErrorMessage, ...props } = head.options;
  const onConfirm = async (result: ConfirmResult) => {
    if (!action) { settle(head.key, result); return; }
    setBusy(true); setError(undefined);
    try {
      await action(result);
      settle(head.key, result);
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e));
    }
  };
  return (
    <ConfirmDialog
      key={head.key}
      {...props}
      open
      busy={busy}
      error={error}
      onConfirm={(r) => { void onConfirm(r); }}
      onCancel={() => settle(head.key, null)}
    />
  );
}
