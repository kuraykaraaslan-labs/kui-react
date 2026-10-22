'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

export type BreadcrumbTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export type BreadcrumbItem = {
  label: string;
  href?: string;
  /** Drawn before the label (decorative). */
  icon?: React.ReactNode;
  /** Draw the crumb as a pill: rounded, bordered, on the surface colour, semibold. */
  chip?: boolean;
  /** A small status dot before the label. */
  tone?: BreadcrumbTone;
};

const toneDotClasses: Record<BreadcrumbTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-text-disabled',
};

const chipClasses = 'rounded-full border border-border bg-surface-raised px-2 py-0.5 font-semibold';

function isDecorated(item: BreadcrumbItem): boolean {
  return Boolean(item.icon || item.tone || item.chip);
}

/** The crumb's content: the plain label, or icon + tone dot + label. */
function crumbContent(item: BreadcrumbItem): React.ReactNode {
  if (!item.icon && !item.tone) return item.label;
  return (
    <>
      {item.icon && <span aria-hidden="true" className="inline-flex shrink-0">{item.icon}</span>}
      {item.tone && (
        <span
          aria-hidden="true"
          data-tone={item.tone}
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full', toneDotClasses[item.tone])}
        />
      )}
      <span>{item.label}</span>
    </>
  );
}

export function Breadcrumb({
  items,
  leading,
  separator,
  maxItems,
  className,
  renderLink,
  ariaLabel = 'Breadcrumb',
}: {
  items: BreadcrumbItem[];
  /** Rendered as the first crumb, before the items (a menu button); `maxItems` never hides it. */
  leading?: React.ReactNode;
  separator?: React.ReactNode;
  /** Collapse the middle of `items` (never `leading`) to an ellipsis past this many. */
  maxItems?: number;
  className?: string;
  /**
   * Render a linked item yourself (a router `Link` for client-side navigation); defaults to a
   * plain anchor. `content` is the crumb's inside (icon, tone dot and label) for the link.
   */
  renderLink?: (item: BreadcrumbItem & { href: string }, className: string, content: React.ReactNode) => React.ReactNode;
  /** Accessible name of the nav landmark. Default = "Breadcrumb". */
  ariaLabel?: string;
}) {
  const sep = separator ?? <FontAwesomeIcon icon={faChevronRight} className="w-2.5 h-2.5 text-text-disabled" aria-hidden="true" />;

  let displayed = items;
  let truncated = false;

  if (maxItems && items.length > maxItems) {
    truncated = true;
    displayed = [items[0], { label: '…', href: undefined }, ...items.slice(-(maxItems - 1))];
  }

  const hasLeading = leading !== undefined && leading !== null && leading !== false;

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {hasLeading && (
          <li className="flex items-center gap-1">
            {leading}
            {displayed.length > 0 && sep}
          </li>
        )}
        {displayed.map((item, i) => {
          const isLast = i === displayed.length - 1;
          const isEllipsis = item.label === '…' && truncated;
          const content = crumbContent(item);

          return (
            <li key={i} className="flex items-center gap-1">
              {!isLast && item.href ? (
                <>
                  {(() => {
                    const linkClass = cn(
                      'text-text-secondary hover:text-text-primary transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded',
                      isDecorated(item) && 'inline-flex items-center gap-1.5',
                      item.chip && chipClasses,
                      item.chip && 'hover:bg-surface-overlay'
                    );
                    return renderLink
                      ? renderLink({ ...item, href: item.href }, linkClass, content)
                      : <a href={item.href} className={linkClass}>{content}</a>;
                  })()}
                  {sep}
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      isLast ? 'text-text-primary font-medium' : 'text-text-secondary',
                      isEllipsis && 'select-none',
                      isDecorated(item) && 'inline-flex items-center gap-1.5',
                      item.chip && chipClasses
                    )}
                    aria-current={isLast ? 'page' : undefined}
                    aria-hidden={isEllipsis ? 'true' : undefined}
                  >
                    {content}
                  </span>
                  {!isLast && sep}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
