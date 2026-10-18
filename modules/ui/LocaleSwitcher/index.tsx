'use client';
// modules/ui/LocaleSwitcher/index.tsx
//
// LocaleSwitcher — a language picker for public pages. Options are links when they have an `href` (they work with no
// JavaScript: the menu is a native <details>), or buttons when they do not. Names are shown in their own language
// with `lang` and `dir` set, the current locale is marked in text, and a locale whose page is only available in a
// fallback language says so. Logical CSS properties keep it right in right-to-left pages.
//
// Not the same as `LanguageSwitcher` in `domains/common` (a flag dropdown wired to the demo's i18n config): this one has no
// flag assets and no i18n dependency, so an app can vendor it as is.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown, faGlobe, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { fillMessage } from '../_shared/format';
import { activeElement, addOutsideListener } from '../_shared/dom';

export type LocaleOption = {
  /** BCP 47 code: `en`, `pt-BR`, `ar`. Becomes the link's `hreflang` and the name's `lang`. */
  code: string;
  /** The language's own name: `Türkçe`, `العربية`. */
  name: string;
  /** A second, familiar name (`Turkish`), shown small. */
  englishName?: string;
  /** Makes this option a link (good for SEO and for no-JS). */
  href?: string;
  /** Text direction of the name. Default = from the language (Arabic, Hebrew, Persian and Urdu are right to left). */
  dir?: 'ltr' | 'rtl';
  /** This page has no translation in this locale, so the fallback language is shown. */
  fallback?: boolean;
};

export type LocaleSwitcherMessages = {
  label: string;
  current: string;
  fallback: string;
  fallbackHint: string;
  /** `{name}` */
  triggerAria: string;
};

export const DEFAULT_LOCALE_SWITCHER_MESSAGES: LocaleSwitcherMessages = {
  label: 'Language',
  current: 'current',
  fallback: 'fallback shown',
  fallbackHint: 'This page is not translated into this language yet; the fallback language is shown.',
  triggerAria: 'Language: {name}',
};

export type LocaleSwitcherProps = {
  locales: LocaleOption[];
  /** Code of the current locale. */
  current: string;
  /** Called when an option is chosen (before a link navigates; call `event.preventDefault()` to handle navigation yourself). */
  onChange?: (code: string, option: LocaleOption, event: React.SyntheticEvent) => void;
  /** `menu`: a disclosure (default). `inline`: every option visible in a row. */
  variant?: 'menu' | 'inline';
  size?: 'sm' | 'md';
  /** Show `englishName` beside each name. Default = true when given. */
  showEnglishName?: boolean;
  /** Align the open menu to the end instead of the start. */
  alignEnd?: boolean;
  /** Force a text direction for the whole control. Default = inherited. */
  dir?: 'ltr' | 'rtl';
  messages?: Partial<LocaleSwitcherMessages>;
  className?: string;
};

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']);

/** The text direction of a language code (`ar`, `ar-EG`, `he` are right to left). */
export function localeDirection(code: string): 'ltr' | 'rtl' {
  return RTL_LANGS.has(code.toLowerCase().split('-')[0]) ? 'rtl' : 'ltr';
}

export function LocaleSwitcher({
  locales, current, onChange, variant = 'menu', size = 'md', showEnglishName, alignEnd = false, dir, messages, className,
}: LocaleSwitcherProps) {
  const msg = useMemo(() => ({ ...DEFAULT_LOCALE_SWITCHER_MESSAGES, ...messages }), [messages]);
  const uid = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const currentOption = locales.find((l) => l.code === current) ?? locales[0];
  const withEnglish = showEnglishName ?? locales.some((l) => l.englishName);

  // Outside click and focus leaving close the menu (the native <details> only closes on its own summary).
  useEffect(() => {
    if (!open) return;
    return addOutsideListener(rootRef.current, () => setOpen(false));
  }, [open]);

  const choose = (opt: LocaleOption, e: React.SyntheticEvent) => {
    onChange?.(opt.code, opt, e);
    setOpen(false);
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-locale]') ?? [])];
    const i = items.indexOf(activeElement() as HTMLElement);
    if (e.key === 'Escape') { setOpen(false); summaryRef.current?.focus(); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') items[Math.min(items.length - 1, i + 1)]?.focus();
    else if (e.key === 'ArrowUp') items[Math.max(0, i - 1)]?.focus();
    else if (e.key === 'Home') items[0]?.focus();
    else if (e.key === 'End') items[items.length - 1]?.focus();
    else return;
    e.preventDefault();
  };

  const itemClasses = (isCurrent: boolean) => cn(
    'flex w-full items-center gap-2 rounded px-2.5 text-start text-sm transition-colors',
    size === 'sm' ? 'py-1' : 'py-1.5',
    'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
    isCurrent ? 'font-semibold text-text-primary' : 'text-text-primary',
  );

  const renderOption = (opt: LocaleOption) => {
    const isCurrent = opt.code === currentOption?.code;
    const optDir = opt.dir ?? localeDirection(opt.code);
    const inner = (
      <>
        <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
          {isCurrent && <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-primary" />}
        </span>
        <span lang={opt.code} dir={optDir} className="min-w-0 flex-1 truncate">{opt.name}</span>
        {withEnglish && opt.englishName && <span className="text-xs text-text-secondary">{opt.englishName}</span>}
        {opt.fallback && (
          <span title={msg.fallbackHint} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] font-medium text-warning-fg">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" className="h-2.5 w-2.5" />
            {msg.fallback}
          </span>
        )}
        {isCurrent && <span className="sr-only">({msg.current})</span>}
      </>
    );
    return opt.href ? (
      <a
        href={opt.href}
        hrefLang={opt.code}
        data-locale={opt.code}
        aria-current={isCurrent ? 'true' : undefined}
        onClick={(e) => choose(opt, e)}
        className={itemClasses(isCurrent)}
      >
        {inner}
      </a>
    ) : (
      <button
        type="button"
        data-locale={opt.code}
        aria-pressed={isCurrent}
        onClick={(e) => choose(opt, e)}
        className={itemClasses(isCurrent)}
      >
        {inner}
      </button>
    );
  };

  if (!currentOption) return null;

  if (variant === 'inline') {
    return (
      <nav aria-label={msg.label} dir={dir} className={className}>
        <ul className="flex flex-wrap items-center gap-1">
          {locales.map((opt) => <li key={opt.code}>{renderOption(opt)}</li>)}
        </ul>
      </nav>
    );
  }

  const currentDir = currentOption.dir ?? localeDirection(currentOption.code);
  return (
    <div ref={rootRef} dir={dir} className={cn('relative inline-block text-sm', className)} onKeyDown={onMenuKeyDown}>
      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="group"
      >
        <summary
          ref={summaryRef}
          aria-label={fillMessage(msg.triggerAria, { name: currentOption.name })}
          className={cn(
            'flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-surface-base text-text-primary transition-colors [&::-webkit-details-marker]:hidden',
            size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5',
            'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          )}
        >
          <FontAwesomeIcon icon={faGlobe} aria-hidden="true" className="h-3.5 w-3.5 text-text-secondary" />
          <span lang={currentOption.code} dir={currentDir}>{currentOption.name}</span>
          {currentOption.fallback && (
            <span title={msg.fallbackHint} data-part="fallback" className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] font-medium text-warning-fg">
              <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" className="h-2.5 w-2.5" />
              {msg.fallback}
            </span>
          )}
          <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className="h-3 w-3 text-text-disabled transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <ul
          id={`${uid}-menu`}
          aria-label={msg.label}
          className={cn(
            'absolute top-full z-20 mt-1 min-w-48 max-w-xs rounded-md border border-border bg-surface-raised p-1 shadow-lg',
            alignEnd ? 'end-0' : 'start-0',
          )}
        >
          {locales.map((opt) => <li key={opt.code}>{renderOption(opt)}</li>)}
        </ul>
      </details>
    </div>
  );
}
