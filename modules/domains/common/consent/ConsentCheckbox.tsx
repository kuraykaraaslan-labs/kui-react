'use client';
import { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';

export type ConsentCheckboxMessages = {
  readText: string;
  /** The drawer's title when `textTitle` is not given. */
  textTitle: string;
  /** `{version}`: the text's version. */
  version: string;
  close: string;
  /** Shown while `invalid` and no `error` is given. */
  requiredError: string;
  /** Screen-reader word after the label of a required box. */
  required: string;
  textLoading: string;
};

export const CONSENT_CHECKBOX_MESSAGES: ConsentCheckboxMessages = {
  readText: 'Read the text',
  textTitle: 'Terms',
  version: 'Version {version}',
  close: 'Close',
  requiredError: 'Tick this box to continue.',
  required: '(required)',
  textLoading: 'Loading the text…',
};

export type ConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The consent statement beside the box ("I agree that my subscription renews automatically …"). */
  label: React.ReactNode;
  /** The full, versioned text, shown in a drawer from the "Read the text" link. Without it there is no link. */
  text?: React.ReactNode;
  /** The drawer's title (the agreement's name). */
  textTitle?: string;
  /** The text's version (and date), shown at the top of the drawer, so the reader knows which text they agree to. */
  version?: string;
  /** The text is still loading (the drawer shows a line in its place). */
  textLoading?: boolean;
  /** Called when the drawer opens: a host may load the text only then. */
  onOpenText?: () => void;
  required?: boolean;
  /** The box is required and not ticked (after a submit): red border, `aria-invalid`, and the error under it. */
  invalid?: boolean;
  /** The message under an invalid box; default `messages.requiredError`. */
  error?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  messages?: Partial<ConsentCheckboxMessages>;
  className?: string;
};

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

/**
 * ConsentCheckbox — an explicit, unticked-by-default consent (automatic renewal, terms, distance-selling information):
 * the box, the statement as its label, and a "Read the text" link that opens the full versioned text in a drawer
 * without ticking the box. Required and invalid states with `aria-required`, `aria-invalid` and the error tied by
 * `aria-describedby`. Controlled: the host owns `checked` and records the version the subscriber agreed to.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  label,
  text,
  textTitle,
  version,
  textLoading = false,
  onOpenText,
  required = false,
  invalid = false,
  error,
  disabled = false,
  id,
  name,
  messages,
  className,
}: ConsentCheckboxProps) {
  const m = { ...CONSENT_CHECKBOX_MESSAGES, ...messages };
  const auto = useId();
  const boxId = id ?? `consent-${auto}`;
  const errorId = `${boxId}-error`;
  const [open, setOpen] = useState(false);
  const showError = invalid && !checked;
  const hasText = text !== undefined || textLoading || !!onOpenText;

  return (
    <div className={cn('space-y-1', className)} data-invalid={showError || undefined}>
      <div className="flex items-start gap-3">
        <input
          id={boxId}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary',
            'focus-visible:ring-2 focus-visible:ring-border-focus',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            showError && 'border-error outline outline-1 outline-error',
          )}
        />
        <div className="min-w-0 text-sm">
          <label htmlFor={boxId} className={cn('cursor-pointer', disabled ? 'text-text-disabled' : 'text-text-primary')}>
            {label}
            {required && (
              <>
                <span aria-hidden="true" className="ml-0.5 text-error">*</span>
                <span className="sr-only"> {m.required}</span>
              </>
            )}
          </label>
          {hasText && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => { setOpen(true); onOpenText?.(); }}
                aria-haspopup="dialog"
                className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <FontAwesomeIcon icon={faFileLines} className="h-3 w-3" aria-hidden="true" />
                {m.readText}
              </button>
            </>
          )}
        </div>
      </div>
      {showError && (
        <p id={errorId} role="alert" className="pl-7 text-xs text-error">
          {error ?? m.requiredError}
        </p>
      )}

      {hasText && (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          title={textTitle ?? m.textTitle}
          footer={
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>{m.close}</Button>
            </div>
          }
        >
          <div className="space-y-3">
            {version && <p className="text-xs font-medium text-text-secondary">{fill(m.version, { version })}</p>}
            {textLoading || text === undefined ? (
              <p className="text-sm text-text-secondary" aria-busy="true">{m.textLoading}</p>
            ) : (
              <div className="whitespace-pre-line text-sm leading-relaxed text-text-primary" data-part="consent-text">
                {text}
              </div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
