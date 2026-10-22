# DocPager

- **id:** `doc-pager`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/DocPager.tsx`
- **status:** stable
- **since:** 2026-10

Previous / next page cards for the foot of a document. Each side names its neighbour; renderLink plugs in a router Link.

## Design tokens consumed

- `--border`
- `--border-focus`
- `--primary`
- `--secondary`
- `--surface-raised`
- `--text-primary`
- `--text-secondary`

## Variants

### Both neighbours

```tsx
<DocPager prev={{ title: 'Installation', href: '/docs/install' }} next={{ title: 'Configuration', href: '/docs/config' }} />
```

### First page (next only)

```tsx
<DocPager next={{ title: 'Getting started', href: '/docs/intro' }} labels={{ next: 'Start here' }} />
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

// Previous / next page cards at the foot of a document. Unlike Pagination
// (numbered pages of one list), each side names the neighbouring page.

export type DocPagerLink = { title: string; href: string };

type DocPagerProps = {
  prev?: DocPagerLink | null;
  next?: DocPagerLink | null;
  labels?: { previous?: string; next?: string };
  /** Render a link yourself (a router `Link` for client-side navigation); defaults to a plain anchor. */
  renderLink?: (link: DocPagerLink, className: string, children: React.ReactNode) => React.ReactNode;
  /** Accessible name of the nav landmark. Default "Docs pages". */
  ariaLabel?: string;
  className?: string;
} & React.HTMLAttributes<HTMLElement>;

const cardClass = cn(
  'group flex flex-col gap-0.5 rounded-lg border border-border bg-surface-raised px-4 py-3 transition-colors',
  'hover:border-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
);

export function DocPager({
  prev,
  next,
  labels,
  renderLink,
  ariaLabel = 'Docs pages',
  className,
  ...rest
}: DocPagerProps) {
  if (!prev && !next) return null;

  const link = (target: DocPagerLink, align: 'start' | 'end', label: string) => {
    const cls = cn(cardClass, align === 'end' && 'items-end text-right');
    const body = (
      <>
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          {align === 'start' && <FontAwesomeIcon icon={faChevronLeft} className="w-2.5 h-2.5" aria-hidden="true" />}
          {label}
          {align === 'end' && <FontAwesomeIcon icon={faChevronRight} className="w-2.5 h-2.5" aria-hidden="true" />}
        </span>
        <span className="text-sm font-medium text-text-primary group-hover:text-primary">{target.title}</span>
      </>
    );
    return renderLink ? renderLink(target, cls, body) : <a href={target.href} rel={align === 'start' ? 'prev' : 'next'} className={cls}>{body}</a>;
  };

  return (
    <nav aria-label={ariaLabel} className={cn('grid gap-3 sm:grid-cols-2', className)} {...rest}>
      {prev ? link(prev, 'start', labels?.previous ?? 'Previous') : <span aria-hidden="true" />}
      {next ? link(next, 'end', labels?.next ?? 'Next') : null}
    </nav>
  );
}

```
