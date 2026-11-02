'use client';
import { useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { fill } from '../format';
import type { SettingsMessagesInput } from './messages';
import { isKeptSecret } from './settings-schema';
import { useSettingsText } from './SettingsText';

export interface SecretFieldProps {
  id: string;
  label: string;
  /** A kept secret (`{ $keep: true, … }`), a new value being typed, or absent (not set). */
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  error?: string;
  description?: string;
  messages?: SettingsMessagesInput;
}

/**
 * SecretField — a write-only setting (a Wi-Fi password, an APN password): its value is never shown or read back. It says whether one is
 * set, and offers "Change" (or "Set") to type a new one, with Show / Hide while typing and "Keep the current one" to go back.
 */
export function SecretField({ id, label, value, onChange, disabled = false, required = false, minLength, maxLength, error, description, messages }: SecretFieldProps) {
  const { m } = useSettingsText(messages);
  const [original] = useState(value);
  const [shown, setShown] = useState(false);
  const typing = typeof value === 'string';
  const isSet = isKeptSecret(value);
  const hadOne = isKeptSecret(original);
  const describedBy = [error ? `${id}-error` : '', `${id}-desc`].filter(Boolean).join(' ');
  return (
    <div data-field={id} data-secret="">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={typing ? id : undefined} id={`${id}-label`} className="flex items-center gap-1 text-xs font-medium text-text-secondary">
          {label}
          {required && <span className="text-error" aria-hidden="true">*</span>}
        </label>
        {!typing && <Badge size="sm" variant={isSet ? 'success' : 'neutral'}>{isSet ? m.secret.set : m.secret.notSet}</Badge>}
        {typing && <Badge size="sm" variant="info">{m.secret.willChange}</Badge>}
      </div>
      {typing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={id}
            type={shown ? 'text' : 'password'}
            autoComplete="new-password"
            value={value}
            minLength={minLength}
            maxLength={maxLength}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-label={fill(m.secret.newValue, { field: label })}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          <Button size="sm" variant="ghost" onClick={() => setShown((s) => !s)} disabled={disabled}>{shown ? m.secret.hide : m.secret.show}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setShown(false); onChange(hadOne ? original : undefined); }} disabled={disabled}>
            {hadOne ? m.secret.keep : m.common.cancel}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => onChange('')} disabled={disabled} aria-describedby={describedBy}>
          {isSet ? m.secret.change : m.secret.setNew}
        </Button>
      )}
      <p id={`${id}-desc`} className="mt-1.5 text-[11px] leading-snug text-text-secondary">{description ? `${description} ` : ''}{m.secret.hidden}</p>
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
