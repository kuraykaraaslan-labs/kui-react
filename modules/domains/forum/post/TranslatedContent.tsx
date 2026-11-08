'use client';
import { useId, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

type TranslatedContentLabels = {
  /** The label before the toggle. Default `Translated from ${language} by AI`. */
  translatedFrom?: (language: string) => string;
  showOriginal?: string;
  showTranslation?: string;
};

type TranslatedContentProps = {
  /** The source language's name as the reader should see it, e.g. "Turkish". */
  sourceLanguage: string;
  /** The source language's BCP 47 code, set as `lang` on the original, e.g. "tr". */
  sourceLang?: string;
  /** The machine translation shown first. */
  translated: React.ReactNode;
  /** The post as its author wrote it. */
  original: React.ReactNode;
  /** Open on the original instead of the translation. */
  defaultShowOriginal?: boolean;
  labels?: TranslatedContentLabels;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>;

/**
 * A machine-translated post: the translation with "Translated from <Language> by AI · Show original", and a toggle
 * between the translation and the original. Both stay in the DOM; the one not shown is `hidden`.
 */
export function TranslatedContent({
  sourceLanguage,
  sourceLang,
  translated,
  original,
  defaultShowOriginal = false,
  labels,
  className,
  ...rest
}: TranslatedContentProps) {
  const [showOriginal, setShowOriginal] = useState(defaultShowOriginal);
  const id = useId();
  const translatedId = `${id}-translated`;
  const originalId = `${id}-original`;
  const label = labels?.translatedFrom?.(sourceLanguage) ?? `Translated from ${sourceLanguage} by AI`;

  return (
    <div className={cn('flex flex-col', className)} {...rest}>
      <p className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3 h-3 text-primary" aria-hidden="true" />
          {label}
        </span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          aria-controls={`${translatedId} ${originalId}`}
          onClick={() => setShowOriginal((v) => !v)}
          className={cn(
            'rounded font-semibold text-primary hover:underline',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          )}
        >
          {showOriginal ? (labels?.showTranslation ?? 'Show translation') : (labels?.showOriginal ?? 'Show original')}
        </button>
      </p>
      <div id={translatedId} hidden={showOriginal}>
        {translated}
      </div>
      <div id={originalId} lang={sourceLang} hidden={!showOriginal}>
        {original}
      </div>
    </div>
  );
}
