// Shared by the control views: why a control is disabled, and how it asks its host to act.
// Controls never decide what is written: they hand `{ kind, value }` to `onControl` and the host's
// command (checked on the server) does the rest.

import type { ControlConfirm, ControlRequest, WidgetViewProps } from '../kind';
import { CONTROL_TILE_MESSAGE_KEYS, DEFAULT_WIDGET_KIT_MESSAGES, type WidgetControlMessages } from '../messages';

/** Why a control is disabled; a host words them through `messages.controls` (same keys). */
export type ControlReasons = Pick<WidgetControlMessages, 'notConnected' | 'stale' | 'unknown'>;

const KIT_CONTROLS = DEFAULT_WIDGET_KIT_MESSAGES.controls;

export const CONTROL_REASONS: ControlReasons = {
  notConnected: KIT_CONTROLS.notConnected,
  stale: KIT_CONTROLS.stale,
  unknown: KIT_CONTROLS.unknown,
};

/**
 * The reason a control is disabled, or `undefined` when it may be used. The host's reason wins;
 * then a missing `onControl`; then the `disableWhen` setting (`stale`, `unknown`). `reasons` words them.
 */
export function controlBlockReason(
  props: Pick<WidgetViewProps, 'controlDisabledReason' | 'onControl' | 'stale'>,
  disableWhen: unknown,
  unknown: boolean,
  reasons: ControlReasons = CONTROL_REASONS,
): string | undefined {
  if (props.controlDisabledReason) return props.controlDisabledReason;
  if (!props.onControl) return reasons.notConnected;
  const when = Array.isArray(disableWhen) ? disableWhen : [];
  if (when.includes('stale') && props.stale) return reasons.stale;
  if (when.includes('unknown') && unknown) return reasons.unknown;
  return undefined;
}

/** What the user confirmed, as the kui controls hand it over. */
export type Confirmation = { confirmed: true; typed?: string };

/**
 * A commit function for the kui controls: resolves when the host is done, rejects on failure.
 * A confirmed write also carries `confirmation` on the request (the host passes it to the server,
 * which checks the policy again). Without `onControl` it rejects with `reasons.notConnected`.
 */
export function requestControl(
  onControl: WidgetViewProps['onControl'],
  kind: ControlRequest['kind'],
  reasons: Pick<ControlReasons, 'notConnected'> = CONTROL_REASONS,
) {
  return async (value?: unknown, confirmation?: Confirmation): Promise<void> => {
    if (!onControl) throw new Error(reasons.notConnected);
    const request: ControlRequest & { confirmation?: Confirmation } = kind === 'run' ? { kind } : { kind, value };
    if (confirmation) request.confirmation = confirmation;
    await onControl(request);
  };
}

/**
 * The command's confirmation policy as kui control props: `confirm` asks (its `text`, when given,
 * is the question); `typed` requires its `text` to be typed exactly.
 */
export function confirmProps(confirm: ControlConfirm | undefined): {
  confirm: 'none' | 'confirm' | 'typed';
  confirmText?: string;
  messages?: { confirmPrompt: string };
} {
  if (!confirm || confirm.mode === 'none') return { confirm: 'none' };
  if (confirm.mode === 'typed') return { confirm: 'typed', confirmText: confirm.text ?? '' };
  return { confirm: 'confirm', ...(confirm.text ? { messages: { confirmPrompt: confirm.text } } : {}) };
}

/** A text setting, or `undefined` when it is empty (so the control's own default applies). */
export const textOr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/** The feedback and confirmation texts every control template offers (`feedbackFields`). */
export type FeedbackSettings = {
  pendingText?: string;
  successText?: string;
  failureText?: string;
  confirmQuestion?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

/**
 * Control messages: the host's texts (`messages.controls`), then the policy's own question, then the
 * feedback settings. The question override changes only what is SHOWN: the policy (none / confirm /
 * typed) and the text to type stay the command's, and the server checks them again.
 *
 * A host text equal to the English default is left out, so the control keeps its own default; that
 * matters for `failed`: a host-set failure text leads and the reason follows it in brackets.
 */
export function controlMessages(
  s: FeedbackSettings,
  policyMessages?: { confirmPrompt: string },
  host?: Partial<WidgetControlMessages>,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  if (host) {
    for (const key of CONTROL_TILE_MESSAGE_KEYS) {
      const v = host[key];
      if (typeof v === 'string' && v && v !== KIT_CONTROLS[key]) out[key] = v;
    }
  }
  Object.assign(out, policyMessages);
  const put = (key: string, v: unknown) => { const t = textOr(v); if (t) out[key] = t; };
  put('pending', s.pendingText);
  put('confirmed', s.successText);
  put('failed', s.failureText);
  put('confirmPrompt', s.confirmQuestion);
  put('confirm', s.confirmLabel);
  put('cancel', s.cancelLabel);
  return Object.keys(out).length ? out : undefined;
}

/** Template fields for `FeedbackSettings` (one group; all advanced, empty = the control's own text). */
export function feedbackFields(group = 'feedback') {
  const text = (label: string, placeholder: string, description?: string) => ({
    label, type: 'text' as const, maxLength: 80, placeholder, group, advanced: true, ...(description ? { description } : {}),
  });
  return {
    pendingText: text('While sending', 'Sending…'),
    successText: text('After success', 'Done'),
    failureText: text('After a failure', 'The change failed.', 'The reason the write failed is added after it.'),
    confirmQuestion: text('Confirmation question', 'Are you sure?',
      'Shown when the command asks for confirmation. Only the wording changes: whether to ask, and the text to type, stay the command’s.'),
    confirmLabel: text('Confirm button', 'Confirm'),
    cancelLabel: text('Cancel button', 'Cancel'),
  };
}
