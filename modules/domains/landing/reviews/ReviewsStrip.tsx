'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faInstagram, faFacebook, faYelp } from '@fortawesome/free-brands-svg-icons';
import { cn } from '@/libs/utils/cn';
import { StarRating } from '@/modules/ui/StarRating';

export type ReviewSource = 'google' | 'instagram' | 'facebook' | 'tripadvisor' | 'yelp';
export type StripReview = { name?: string; rating?: number; text: string; source?: ReviewSource; date?: string };

const SOURCES: Record<ReviewSource, { icon: typeof faGoogle; label: string }> = {
  google: { icon: faGoogle, label: 'Google' }, instagram: { icon: faInstagram, label: 'Instagram' }, facebook: { icon: faFacebook, label: 'Facebook' },
  tripadvisor: { icon: faComments, label: 'Tripadvisor' }, yelp: { icon: faYelp, label: 'Yelp' },
};

type ReviewsStripProps = {
  title?: string;
  /** The overall score (1-5) on the source, and how many reviews it has. */
  score?: number;
  count?: number;
  source?: ReviewSource;
  /** Where all the reviews can be read. */
  profileHref?: string;
  reviews: StripReview[];
  labels?: Partial<{ reviews: string; readOn: string; readAll: string }>;
  className?: string;
};

/**
 * A reviews strip for a website: short reviews the owner copies from Google, Instagram, Facebook or Tripadvisor, each
 * with its stars and source, scrolling sideways beside the overall score and a link to read them all at the source.
 * Nothing is fetched. The platform-review components (ReviewCard, ReviewSummaryCard) stay for review systems; this
 * reuses StarRating. Mirrors next-boilerplate's dynamic_page Reviews strip block.
 */
export function ReviewsStrip({ title, score, count = 0, source, profileHref, reviews, labels, className }: ReviewsStripProps) {
  const list = reviews.filter((r) => r.text?.trim()).slice(0, 12);
  const s = source ? SOURCES[source] : undefined;
  const valid = score !== undefined && score >= 1 && score <= 5;
  if (list.length === 0 && !valid) return null;
  return (
    <section className={cn('w-full text-text-primary', className)}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {title && <h2 className="text-2xl font-bold">{title}</h2>}
          {valid && (
            <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
              {s && <FontAwesomeIcon icon={s.icon} className="h-4 w-4" aria-hidden="true" />}
              <span className="text-xl font-bold tabular-nums text-text-primary">{score!.toFixed(1)}</span>
              <StarRating value={score!} size="sm" />
              {count > 0 && <span>{(labels?.reviews ?? '{{count}} reviews').replace('{{count}}', String(count))}{s ? ` · ${s.label}` : ''}</span>}
            </p>
          )}
        </div>
        {profileHref && /^https?:\/\//i.test(profileHref) && (
          <a href={profileHref} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">
            {s ? (labels?.readOn ?? 'Read all on {{source}}').replace('{{source}}', s.label) : labels?.readAll ?? 'Read all reviews'}
          </a>
        )}
      </div>
      {list.length > 0 && (
        <ul className="-mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-2">
          {list.map((r, i) => {
            const from = r.source ? SOURCES[r.source] : s;
            return (
              <li key={i} className="flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl border border-border bg-surface-raised p-5">
                <div className="flex items-center justify-between">
                  {r.rating !== undefined && r.rating >= 1 && r.rating <= 5 ? <StarRating value={r.rating} size="sm" /> : <span />}
                  {from && <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary"><FontAwesomeIcon icon={from.icon} className="h-3.5 w-3.5" aria-hidden="true" />{from.label}</span>}
                </div>
                <p className="text-sm leading-relaxed">“{r.text}”</p>
                <p className="mt-auto text-xs text-text-secondary">{[r.name, r.date].filter(Boolean).join(' · ')}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
