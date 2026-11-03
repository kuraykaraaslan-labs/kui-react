'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeaf, faSeedling, faPepperHot, faWheatAwnCircleExclamation, faStar, faFire } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type MenuSectionTag = 'vegan' | 'vegetarian' | 'gluten-free' | 'spicy' | 'new' | 'popular';

export type MenuSectionItem = {
  name: string;
  description?: string | null;
  /** Free text as the business writes it: "₺180", "from ₺500", "12.50". */
  price?: string | null;
  tags?: MenuSectionTag[];
  imageUrl?: string | null;
  imageAlt?: string;
};

type MenuSectionLayout = 'list' | 'cards';

type MenuSectionProps = {
  /** Section heading ("Starters", "Hair"); leave out for a single unnamed list. */
  title?: string;
  items: MenuSectionItem[];
  /** `list`: a classic menu, name and price joined by a dotted leader. `cards`: bordered cards with an optional photo. */
  layout?: MenuSectionLayout;
  /** Visible tag names, for another language; English by default. */
  tagLabels?: Partial<Record<MenuSectionTag, string>>;
  /** Accessible name of each item's tag list. */
  tagsLabel?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>;

const TAGS: Record<MenuSectionTag, { icon: IconDefinition; label: string; tone: string }> = {
  vegan:         { icon: faSeedling, label: 'Vegan', tone: 'bg-success-subtle text-success-fg' },
  vegetarian:    { icon: faLeaf, label: 'Vegetarian', tone: 'bg-success-subtle text-success-fg' },
  'gluten-free': { icon: faWheatAwnCircleExclamation, label: 'Gluten-free', tone: 'bg-warning-subtle text-warning-fg' },
  spicy:         { icon: faPepperHot, label: 'Spicy', tone: 'bg-error-subtle text-error-fg' },
  new:           { icon: faStar, label: 'New', tone: 'bg-surface-overlay text-text-primary' },
  popular:       { icon: faFire, label: 'Popular', tone: 'bg-surface-overlay text-text-primary' },
};

/**
 * One section of a website menu or price list: a restaurant's starters, a café's drinks, a salon's treatments.
 * The website counterpart of `MenuItemCard` (which is a delivery-app card with an add-to-cart button): prices are
 * free text, items may carry dietary / highlight tags, and the classic layout joins name and price with a dotted
 * leader. Mirrors next-boilerplate's dynamic_page Menu block.
 */
export function MenuSection({
  title,
  items,
  layout = 'list',
  tagLabels,
  tagsLabel = 'Notes',
  className,
  ...rest
}: MenuSectionProps) {
  const tags = (list?: MenuSectionTag[]) =>
    list && list.length > 0 ? (
      <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={tagsLabel}>
        {list.map((tag) => (
          <li key={tag} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', TAGS[tag].tone)}>
            <FontAwesomeIcon icon={TAGS[tag].icon} className="h-3 w-3" aria-hidden="true" />
            {tagLabels?.[tag] ?? TAGS[tag].label}
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <section aria-label={title || undefined} className={cn('text-text-primary', className)} {...rest}>
      {title && <h3 className="mb-2 border-b border-border pb-2 text-xl font-semibold">{title}</h3>}
      <ul className={cn(layout === 'cards' ? 'mt-4 grid gap-3 sm:grid-cols-2' : 'divide-y divide-border')}>
        {items.map((item, i) =>
          layout === 'cards' ? (
            <li key={`${item.name}-${i}`} className="flex gap-4 rounded-xl border border-border bg-surface-raised p-4">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.imageAlt ?? ''} loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{item.name}</span>
                  {item.price && <span className="shrink-0 font-bold tabular-nums">{item.price}</span>}
                </div>
                {item.description && <p className="mt-1 text-sm leading-relaxed text-text-secondary">{item.description}</p>}
                {tags(item.tags)}
              </div>
            </li>
          ) : (
            <li key={`${item.name}-${i}`} className="py-3">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold">{item.name}</span>
                <span aria-hidden="true" className="mx-1 flex-1 -translate-y-[0.2em] border-b border-dotted border-text-secondary/40" />
                {item.price && <span className="shrink-0 font-semibold tabular-nums">{item.price}</span>}
              </div>
              {item.description && <p className="mt-0.5 text-sm text-text-secondary">{item.description}</p>}
              {tags(item.tags)}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
