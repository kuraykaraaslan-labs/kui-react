'use client';
import { useId } from 'react';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { PROFILE_AUTH_MODES, type ProfileAuthMode } from '../types/profile';

/**
 * AuthModeSelector — the authentication modes a profile allows (protocol 01 §4): access token, MQTT basic and X.509 certificate, at
 * least one. MQTT basic is ALWAYS a username and a password (OD-163): there is no client-ID-only mode and no toggle for one. `locked`
 * pins the selection (a Roltek template is X.509 only) and says why. Unchecking the last mode is impossible.
 */
export type AuthModeSelectorProps = {
  value: ProfileAuthMode[];
  onChange?: (next: ProfileAuthMode[]) => void;
  /** The modes are fixed (e.g. `['X509_CERTIFICATE']` for a Roltek template); the reason is shown. */
  locked?: boolean;
  disabled?: boolean;
  error?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function AuthModeSelector({ value, onChange, locked, disabled, error, messages, className }: AuthModeSelectorProps) {
  const { m } = useIotText(messages);
  const id = useId();
  const off = disabled || locked;
  function toggle(mode: ProfileAuthMode, on: boolean) {
    const next = on ? PROFILE_AUTH_MODES.filter((x) => x === mode || value.includes(x)) : value.filter((x) => x !== mode);
    if (next.length) onChange?.(next);
  }
  return (
    <fieldset className={cn('space-y-2', className)} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-1 text-sm font-medium text-text-primary">{m.transport.authModes}</legend>
      {locked && <p className="text-xs text-text-secondary">{m.transport.lockedHint}</p>}
      <div className="grid gap-2 md:grid-cols-3">
        {PROFILE_AUTH_MODES.map((mode) => {
          const checked = value.includes(mode);
          const last = checked && value.length === 1;
          return (
            <label
              key={mode}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-border-focus',
                checked ? 'border-primary bg-primary-subtle' : 'border-border bg-surface-base',
                off || last ? 'cursor-not-allowed' : 'cursor-pointer hover:border-border-strong',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={off || last}
                onChange={(e) => toggle(mode, e.target.checked)}
                aria-describedby={`${id}-${mode}`}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="min-w-0">
                <span className="block font-medium text-text-primary">{m.transport[mode]}</span>
                <span id={`${id}-${mode}`} className="mt-0.5 block text-xs text-text-secondary">{m.transport[`hint_${mode}`]}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-error">{error}</p>}
    </fieldset>
  );
}
