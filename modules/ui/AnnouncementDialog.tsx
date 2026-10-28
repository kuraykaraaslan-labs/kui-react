'use client';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faCircleInfo, faTriangleExclamation, faXmark, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from './Button';
import { useFocusTrap } from './Overlays/shared/useFocusTrap';
import { useScrollLock } from './Overlays/shared/useScrollLock';
import { usePresence } from './Overlays/shared/usePresence';
import { usePortal } from './Overlays/shared/usePortal';

/**
 * AnnouncementDialog — a message from the people who run the product to the person using it (a platform notice, planned
 * maintenance, a change of terms), shown over the page until it is acknowledged. Not a confirmation: there is no
 * question and one answer, "OK" (`acknowledgeLabel`), which the host stores so the same person is not asked again.
 *
 * - `severity` colours the top edge and the icon: `info`, `warning`, `critical`.
 * - `required` (the default for `critical`): no close button, and Escape and a click on the backdrop do nothing, so the
 *   only way out is the acknowledgement. Otherwise closing calls `onDismiss` (the host shows it again later) and falls
 *   back to `onAcknowledge` when there is no `onDismiss`.
 * - `body` is plain text (line breaks kept) or rendered content the host has already made safe (sanitised Markdown).
 * - `meta` names who sent it and when; `position` ("1 of 3") tells that more are waiting behind it.
 */
export type AnnouncementSeverity = 'info' | 'warning' | 'critical';

export type AnnouncementDialogProps = {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  severity?: AnnouncementSeverity;
  /** The severity in words, read before the title ("Critical"). Default = none. */
  severityLabel?: string;
  /** Who sent it and when: "Platform team · 28 Oct 2026, 14:00". */
  meta?: React.ReactNode;
  /** Where to read more (the status page). Opens in a new tab when `external`. */
  link?: { href: string; label: string; external?: boolean };
  /** "2 of 3" when more announcements wait behind this one. */
  position?: React.ReactNode;
  /** Default = "OK". */
  acknowledgeLabel?: string;
  /** Default = true for `critical`, false otherwise. */
  required?: boolean;
  /** Accessible name of the close button. Default = "Close". */
  closeLabel?: string;
  /** The acknowledgement is being stored: the button shows a spinner and nothing closes the dialog. */
  busy?: boolean;
  onAcknowledge: () => void;
  /** Closed without acknowledging (the close button, Escape, the backdrop). Never called while `required`. */
  onDismiss?: () => void;
  /** Portal mount target — defaults to document.body. */
  portalTarget?: Element | string | null;
  className?: string;
};

const severityIcon = { info: faCircleInfo, warning: faTriangleExclamation, critical: faCircleExclamation } as const;
const severityIconClass = { info: 'text-info', warning: 'text-warning', critical: 'text-error' } as const;
const severityEdgeClass = { info: 'border-t-info', warning: 'border-t-warning', critical: 'border-t-error' } as const;

export function AnnouncementDialog({
  open, title, body, severity = 'info', severityLabel, meta, link, position, acknowledgeLabel = 'OK', required,
  closeLabel = 'Close', busy = false, onAcknowledge, onDismiss, portalTarget, className,
}: AnnouncementDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = body ? `${uid}-body` : undefined;
  const mustAcknowledge = required ?? severity === 'critical';
  const { mounted, state } = usePresence(open);
  const dismiss = () => {
    if (mustAcknowledge || busy) return;
    (onDismiss ?? onAcknowledge)();
  };

  useFocusTrap(panelRef, { active: open, onEscape: dismiss });
  useScrollLock(open);
  const portalNode = usePortal(portalTarget);

  if (!mounted || !portalNode) return null;

  const node = (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200',
        state === 'open' ? 'opacity-100' : 'opacity-0',
        state === 'closing' && 'pointer-events-none',
      )}
      aria-hidden={state === 'closing' || undefined}
      aria-modal="true"
      // An acknowledgement the person cannot skip is an alert dialog: assistive technology reads it at once.
      role={mustAcknowledge ? 'alertdialog' : 'dialog'}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-state={state}
      data-severity={severity}
    >
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        data-state={state}
        className={cn(
          'relative z-[101] flex w-full max-w-lg flex-col rounded-xl border border-border border-t-4 bg-surface-raised shadow-xl',
          'transition-all duration-200 focus-visible:outline-none',
          state === 'open' ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          severityEdgeClass[severity],
          className,
        )}
      >
        <div className="flex items-start gap-3 px-6 pt-5 pb-3">
          <FontAwesomeIcon icon={severityIcon[severity]} aria-hidden="true" className={cn('mt-0.5 h-5 w-5 shrink-0', severityIconClass[severity])} />
          <div className="min-w-0 flex-1">
            {severityLabel && (
              <p className={cn('text-xs font-semibold uppercase tracking-wide', severityIconClass[severity])}>{severityLabel}</p>
            )}
            <h2 id={titleId} className="text-base font-semibold text-text-primary">{title}</h2>
            {meta && <p className="mt-0.5 text-xs text-text-secondary">{meta}</p>}
          </div>
          {!mustAcknowledge && (
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              aria-label={closeLabel}
              className="shrink-0 rounded text-text-disabled transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {body && (
          <div id={bodyId} className="max-h-[60vh] min-h-0 overflow-y-auto px-6 pb-4 text-sm text-text-secondary" data-announcement-body="">
            {typeof body === 'string' ? <p className="whitespace-pre-line">{body}</p> : body}
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          {position && <span className="mr-auto text-xs text-text-secondary">{position}</span>}
          {link && (
            <a
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {link.label}
              {link.external && <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" aria-hidden="true" />}
            </a>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={onAcknowledge}
            data-announcement-acknowledge=""
          >
            {acknowledgeLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, portalNode);
}
