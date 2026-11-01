'use client';
// modules/ui/TranslatableField/index.tsx
//
// TranslatableField — one text in several languages (a menu label, a product
// name). One row per language: flag, the language's own name, the input
// (right to left for a right-to-left language, `lang` set), a state mark in
// words (filled / missing / suggested) and a clear button. A required language
// left empty is an error. An empty language with a suggestion (from another
// source, e.g. an existing translation with the same English) shows it in the
// field and offers "Accept". A note can sit under a row ("overridden in
// Translations"). `addLanguage` is a slot after the rows.
//
// The value is a code → text record; an emptied language is removed from it.

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faLightbulb, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

export type TranslatableLanguage = {
  code: string;
  /** The language's own name (endonym): `Türkçe`, `العربية`. */
  name: string;
  flag?: React.ReactNode;
  rtl?: boolean;
};

export type TranslatableSuggestion = { text: string; source?: string };

export type TranslatableFieldMessages = {
  filled: string;
  missing: string;
  suggested: string;
  /** `{language}` is replaced. */
  requiredError: string;
  accept: string;
  /** `{language}` is replaced. */
  acceptAria: string;
  /** `{source}` is replaced. */
  source: string;
  /** `{language}` is replaced. */
  clear: string;
  /** Read after a required language's name. */
  requiredMark: string;
};

export const DEFAULT_TRANSLATABLE_FIELD_MESSAGES: TranslatableFieldMessages = {
  filled: 'Filled',
  missing: 'Missing',
  suggested: 'Suggested',
  requiredError: '{language} is required.',
  accept: 'Accept',
  acceptAria: 'Accept the suggestion for {language}',
  source: 'from {source}',
  clear: 'Clear {language}',
  requiredMark: '(required)',
};

export type TranslatableFieldProps = {
  id: string;
  label: string;
  languages: TranslatableLanguage[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** Language codes that must be filled, e.g. `['en']`. */
  required?: string[];
  /** Shown in an empty field, with an "Accept" action that copies it in. */
  suggestions?: Record<string, TranslatableSuggestion>;
  /** A small note under a language's row. */
  notes?: Record<string, string>;
  maxLength?: number;
  /** Rendered after the rows (an "Add language" control). */
  addLanguage?: React.ReactNode;
  disabled?: boolean;
  messages?: Partial<TranslatableFieldMessages>;
  className?: string;
};

type RowState = 'filled' | 'missing' | 'suggested';

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

const markClasses: Record<RowState | 'error', string> = {
  filled: 'bg-success-subtle text-success-fg',
  missing: 'bg-surface-sunken text-text-secondary',
  suggested: 'bg-info-subtle text-text-primary',
  error: 'bg-error-subtle text-error',
};

export function TranslatableField({
  id,
  label,
  languages,
  value,
  onChange,
  required = [],
  suggestions,
  notes,
  maxLength,
  addLanguage,
  disabled = false,
  messages,
  className,
}: TranslatableFieldProps) {
  const msg = useMemo(() => ({ ...DEFAULT_TRANSLATABLE_FIELD_MESSAGES, ...messages }), [messages]);

  const set = (code: string, text: string) => {
    const next = { ...value };
    if (text) next[code] = text;
    else delete next[code];
    onChange(next);
  };

  return (
    <fieldset className={cn('min-w-0 space-y-2', className)} disabled={disabled} data-translatable-field={id}>
      <legend className="mb-1 block text-sm font-medium text-text-primary">{label}</legend>
      {languages.map((lang) => {
        const text = value[lang.code] ?? '';
        const isRequired = required.includes(lang.code);
        const suggestion = !text ? suggestions?.[lang.code] : undefined;
        const state: RowState = text ? 'filled' : suggestion ? 'suggested' : 'missing';
        const error = isRequired && !text;
        const inputId = `${id}-${lang.code}`;
        const errorId = `${inputId}-error`;
        const suggestionId = `${inputId}-suggestion`;
        const noteId = `${inputId}-note`;
        const note = notes?.[lang.code];
        const describedBy = [error && errorId, suggestion && suggestionId, note && noteId].filter(Boolean).join(' ');
        const dir = lang.rtl ? 'rtl' : 'ltr';

        return (
          <div key={lang.code} className="space-y-1" data-lang={lang.code} data-state={error ? 'error' : state}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
              <label htmlFor={inputId} className="flex w-full min-w-0 items-center gap-2 text-sm text-text-primary sm:w-36 sm:shrink-0">
                {lang.flag && (
                  <span className="flex h-4 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm" aria-hidden="true">
                    {lang.flag}
                  </span>
                )}
                <span lang={lang.code} dir={dir} className="truncate">{lang.name}</span>
                {isRequired && (
                  <>
                    <span className="text-error" aria-hidden="true">*</span>
                    <span className="sr-only">{msg.requiredMark}</span>
                  </>
                )}
              </label>
              <input
                id={inputId}
                type="text"
                lang={lang.code}
                dir={dir}
                value={text}
                maxLength={maxLength}
                placeholder={suggestion?.text}
                aria-required={isRequired || undefined}
                aria-invalid={error || undefined}
                aria-describedby={describedBy || undefined}
                onChange={(e) => set(lang.code, e.target.value)}
                className={cn(
                  'block min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm text-text-primary transition-colors',
                  'placeholder:text-text-disabled placeholder:italic',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken',
                  error ? 'border-error ring-1 ring-error bg-error-subtle' : 'border-border bg-surface-base',
                )}
              />
              <span
                data-state-mark={state}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  markClasses[error ? 'error' : state],
                )}
              >
                {state === 'filled' && <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" aria-hidden="true" />}
                {state === 'suggested' && <FontAwesomeIcon icon={faLightbulb} className="h-2.5 w-2.5" aria-hidden="true" />}
                {msg[state]}
              </span>
              {text ? (
                <button
                  type="button"
                  aria-label={fill(msg.clear, { language: lang.name })}
                  onClick={() => set(lang.code, '')}
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-disabled transition-colors',
                    'hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : (
                <span className="h-7 w-7 shrink-0" aria-hidden="true" />
              )}
            </div>
            {suggestion && (
              <div id={suggestionId} className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary sm:pl-[9.5rem]">
                <span>
                  {msg.suggested}: <span lang={lang.code} dir={dir} className="text-text-primary">{suggestion.text}</span>
                  {suggestion.source && <> · {fill(msg.source, { source: suggestion.source })}</>}
                </span>
                <button
                  type="button"
                  aria-label={fill(msg.acceptAria, { language: lang.name })}
                  onClick={() => set(lang.code, suggestion.text)}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-medium text-primary transition-colors',
                    'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {msg.accept}
                </button>
              </div>
            )}
            {error && (
              <p id={errorId} className="text-xs text-error sm:pl-[9.5rem]">{fill(msg.requiredError, { language: lang.name })}</p>
            )}
            {note && (
              <p id={noteId} className="text-xs text-text-secondary sm:pl-[9.5rem]">{note}</p>
            )}
          </div>
        );
      })}
      {addLanguage && <div className="pt-1">{addLanguage}</div>}
    </fieldset>
  );
}
