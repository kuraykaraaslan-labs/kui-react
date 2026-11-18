'use client';
import { useId } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

export type SimilarTopic = {
  topicId?: string;
  title: string;
  href: string;
  /** The topic has an accepted solution. */
  solved?: boolean;
  /** The forum (category) it was asked in. */
  forumName?: string;
  replyCount?: number;
};

type SimilarTopicsLabels = {
  /** Default "Already asked? These look similar:". */
  heading?: string;
  /** Default "Solved". */
  solved?: string;
  /** Default `${n} replies` (`1 reply`). */
  replies?: (count: number) => string;
};

type SimilarTopicsProps = {
  topics: SimilarTopic[];
  labels?: SimilarTopicsLabels;
  /** Render each title link (e.g. with next/link). Default a plain `<a>`. */
  renderLink?: (topic: SimilarTopic, children: React.ReactNode, className: string) => React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>;

const LINK_CLASS = cn(
  'rounded font-semibold text-primary hover:underline',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
);

function repliesLabel(count: number) {
  return count === 1 ? '1 reply' : `${count.toLocaleString()} replies`;
}

/** Earlier topics that look like the one being written, listed under the new topic's title. Renders nothing when empty. */
export function SimilarTopics({ topics, labels, renderLink, className, ...rest }: SimilarTopicsProps) {
  const headingId = useId();
  if (topics.length === 0) return null;
  const heading = labels?.heading ?? 'Already asked? These look similar:';
  const replies = labels?.replies ?? repliesLabel;
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface-raised px-4 py-3.5', className)}
      {...rest}
    >
      <p id={headingId} className="mb-2 text-[0.8125rem] font-bold text-text-primary">{heading}</p>
      <ul className="grid gap-1.5" aria-labelledby={headingId}>
        {topics.map((t) => {
          const meta = [t.forumName, t.replyCount !== undefined ? replies(t.replyCount) : undefined].filter(Boolean).join(' · ');
          return (
            <li key={t.topicId ?? t.href} className="flex flex-wrap items-baseline gap-1.5 text-sm">
              {renderLink ? renderLink(t, t.title, LINK_CLASS) : <a href={t.href} className={LINK_CLASS}>{t.title}</a>}
              {t.solved && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-success-subtle px-1.5 text-[0.6875rem] font-bold text-success-fg">
                  <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" aria-hidden="true" />
                  {labels?.solved ?? 'Solved'}
                </span>
              )}
              {meta && <span className="text-xs text-text-secondary">{meta}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type SuggestedCategoryHintProps = {
  /** The suggested forum's name. */
  categoryName: string;
  /** Text before the name. Default "Suggested forum (AI):". */
  label?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLParagraphElement>, 'children'>;

/** "✦ Suggested forum (AI): <name>" under a new topic's title. */
export function SuggestedCategoryHint({ categoryName, label = 'Suggested forum (AI):', className, ...rest }: SuggestedCategoryHintProps) {
  return (
    <p className={cn('m-0 rounded-xl bg-primary-subtle px-3.5 py-2.5 text-[0.8125rem] text-text-primary', className)} {...rest}>
      <FontAwesomeIcon icon={faWandMagicSparkles} className="mr-1.5 w-3 h-3 text-primary" aria-hidden="true" />
      {label} <strong className="font-semibold">{categoryName}</strong>
    </p>
  );
}
