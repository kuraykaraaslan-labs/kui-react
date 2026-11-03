'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { cn } from '@/libs/utils/cn';
import { ImageMarks, type ImageMark } from '../media/ImageMarks';

export type ListingFact = { icon?: IconDefinition; text: string };

export type Listing = {
  title: string;
  /** Free text, as the business writes it: "₺4,250,000", "From €89". */
  price?: string;
  /** "/ month", "/ night". */
  period?: string;
  location?: string;
  /** "For sale", "For rent", "Sold", "Booked"… */
  status?: string;
  /** Mark the listing as gone (sold, rented, booked); by default worked out from `status`. */
  closed?: boolean;
  facts?: ListingFact[];
  imageUrl?: string | null;
  imageAlt?: string;
  marks?: ImageMark[];
  href?: string;
};

type ListingCardsProps = {
  title?: string;
  subtitle?: string;
  listings: Listing[];
  columns?: 2 | 3 | 4;
  imageShape?: 'standard' | 'wide' | 'square';
  /** The link text on each card; the listing title is added for screen readers. */
  linkLabel?: string;
  /** What the trade must show under the listings, e.g. an estate agent's authorisation number. */
  footnote?: string;
  className?: string;
};

const CLOSED = /^(sold|rented|let|booked|reserved|unavailable|satıldı|kiralandı|dolu|rezerve)$/i;
/** A status that means the listing is gone, in English or Turkish. */
export const isClosedStatus = (status: string): boolean => CLOSED.test(status.trim());

// Container queries: the columns follow the space the section has (a preview pane, a sidebar layout), not the window.
const COLS = { 2: '@xl:grid-cols-2', 3: '@xl:grid-cols-2 @4xl:grid-cols-3', 4: '@xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4' } as const;
const ASPECT = { standard: 'aspect-[4/3]', wide: 'aspect-video', square: 'aspect-square' } as const;

/**
 * Website listing cards: a property, a vehicle or a room, with its picture, a status, a free-text price and its
 * period, where it is, and its key facts with icons. One section for an estate agent, a car dealer or a hotel. A
 * sold or booked listing stays on the page, dimmed and grey, which agents use as proof of work. The website
 * counterpart of the record-shaped `PropertyCard` and `HotelCard`; mirrors next-boilerplate's dynamic_page Listings
 * block.
 */
export function ListingCards({
  title,
  subtitle,
  listings,
  columns = 3,
  imageShape = 'standard',
  linkLabel = 'View details',
  footnote,
  className,
}: ListingCardsProps) {
  const items = listings.filter((l) => l.title);
  if (items.length === 0) return null;
  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      <ul className={cn('grid gap-6', COLS[columns])}>
        {items.map((l, i) => {
          const status = l.status?.trim() ?? '';
          const closed = l.closed ?? (status ? isClosedStatus(status) : false);
          return (
            <li
              key={i}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface-raised transition-shadow hover:shadow-lg',
                closed && 'opacity-70',
              )}
            >
              <div className={cn('relative overflow-hidden', ASPECT[imageShape])}>
                {l.imageUrl ? (
                  <img
                    src={l.imageUrl}
                    alt={l.imageAlt ?? ''}
                    loading="lazy"
                    className={cn('h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]', closed && 'grayscale')}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-overlay text-text-disabled" aria-hidden="true">
                    <FontAwesomeIcon icon={faImage} className="h-8 w-8" />
                  </div>
                )}
                {status && (
                  <span
                    className={cn(
                      'absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide shadow',
                      closed ? 'bg-text-primary text-surface-base' : 'bg-primary text-primary-fg',
                    )}
                  >
                    {status}
                  </span>
                )}
                <ImageMarks marks={l.marks} size="md" />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                {l.price && (
                  <p>
                    <span className="text-2xl font-bold tabular-nums [overflow-wrap:anywhere]">{l.price}</span>
                    {l.period && <span className="ml-1 text-sm text-text-secondary">{l.period}</span>}
                  </p>
                )}
                <h3 className="text-lg font-semibold leading-snug">{l.title}</h3>
                {l.location && (
                  <p className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <FontAwesomeIcon icon={faLocationDot} className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {l.location}
                  </p>
                )}
                {l.facts && l.facts.length > 0 && (
                  <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
                    {l.facts.slice(0, 6).map((f, fi) => (
                      <li key={fi} className="inline-flex items-center gap-1.5">
                        {f.icon && <FontAwesomeIcon icon={f.icon} className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />}
                        {f.text}
                      </li>
                    ))}
                  </ul>
                )}
                {l.href && linkLabel && (
                  <a
                    href={l.href}
                    className="text-sm font-semibold text-primary after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    {linkLabel}
                    <span className="sr-only">: {l.title}</span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {footnote && <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-text-secondary">{footnote}</p>}
    </section>
  );
}
