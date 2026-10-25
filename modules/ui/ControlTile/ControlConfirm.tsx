'use client';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';

/** What a confirmed write carries to `onCommit`, so the other side can check it again. */
export type ControlConfirmation = { confirmed: true; typed?: string };

/** `confirm` asks "Are you sure?"; `typed` also requires `confirmText` to be typed exactly. */
export type ControlConfirmMode = 'none' | 'confirm' | 'typed';

export type ControlConfirmMessages = {
  confirmPrompt: string;
  confirm: string;
  cancel: string;
  /** `{text}` is replaced. */
  typeToConfirm: string;
};

export const DEFAULT_CONFIRM_MESSAGES: ControlConfirmMessages = {
  confirmPrompt: 'Are you sure?',
  confirm: 'Confirm',
  cancel: 'Cancel',
  typeToConfirm: 'Type "{text}" to confirm',
};

/**
 * Park a requested value behind a confirmation step. `request(value)` returns the value to write
 * now (mode `none`) or parks it and returns `undefined`; `accept(typed)` returns the parked value
 * (to write) and records its confirmation in `confirmation`; `cancel` drops it.
 */
export function useControlConfirm<T>(mode: ControlConfirmMode) {
  const [asking, setAsking] = useState<{ value: T } | null>(null);
  const confirmation = useRef<ControlConfirmation | undefined>(undefined);
  const request = (value: T): { value: T } | undefined => {
    if (mode === 'none') { confirmation.current = undefined; return { value }; }
    setAsking({ value });
    return undefined;
  };
  const accept = (typed?: string): { value: T } | undefined => {
    if (!asking) return undefined;
    confirmation.current = { confirmed: true, ...(mode === 'typed' ? { typed } : {}) };
    setAsking(null);
    return asking;
  };
  const cancel = () => setAsking(null);
  return { asking, request, accept, cancel, confirmation };
}

export type ControlConfirmPromptProps = {
  mode: Exclude<ControlConfirmMode, 'none'>;
  /** The text to type when `mode="typed"`. */
  confirmText?: string;
  onConfirm: (typed?: string) => void;
  onCancel: () => void;
  messages?: Partial<ControlConfirmMessages>;
};

/** The "Are you sure?" step every control shares: the kit's ConfirmDialog; `typed` unlocks Confirm only on the exact text. */
export function ControlConfirmPrompt({ mode, confirmText = '', onConfirm, onCancel, messages }: ControlConfirmPromptProps) {
  const m = { ...DEFAULT_CONFIRM_MESSAGES, ...messages };
  const typed = mode === 'typed';
  return (
    <ConfirmDialog
      open
      title={m.confirmPrompt}
      tone="warning"
      confirmLabel={m.confirm}
      cancelLabel={m.cancel}
      phrase={typed ? confirmText : undefined}
      phraseLabel={typed ? m.typeToConfirm.replace('{text}', confirmText) : undefined}
      // The phrase gate passed only on the exact (trimmed) text, so that is what was typed.
      onConfirm={() => onConfirm(typed ? confirmText : undefined)}
      onCancel={onCancel}
    />
  );
}
