# TableOfContents

- **id:** `table-of-contents`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/TableOfContents.tsx`
- **status:** stable
- **since:** 2026-10

"On this page" heading navigation with built-in scroll-spy (IntersectionObserver) or a controlled activeId. Filters by heading depth.

## Design tokens consumed

- `--border`
- `--border-focus`
- `--border-strong`
- `--primary`
- `--secondary`
- `--text-primary`
- `--text-secondary`

## Variants

### Controlled active heading

```tsx
<TableOfContents items={headings} activeId="from-a-git-commit" />
```

### Top level only

```tsx
<TableOfContents items={headings} maxDepth={2} title="Contents" />
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useScrollSpy } from '@/libs/hooks/useScrollSpy';

// "On this page" navigation for long-form content. Items are the page's own
// headings (id + text + depth); the active one is tracked with an
// IntersectionObserver unless the caller controls `activeId`.

export type TocItem = { id: string; text: string; depth: number };

type TableOfContentsProps = {
  items: TocItem[];
  title?: React.ReactNode;
  /** Shallowest heading depth to show. Default 2 (h2). */
  minDepth?: number;
  /** Deepest heading depth to show. Default 3 (h3). */
  maxDepth?: number;
  /** Controlled active heading id. When omitted the component scroll-spies the headings itself. */
  activeId?: string;
  /** Distance in px from the viewport top at which a heading counts as current (sticky header height). Default 80. */
  offset?: number;
  /** Accessible name of the nav landmark. Default "Table of contents". */
  ariaLabel?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>;

export function TableOfContents({
  items,
  title = 'On this page',
  minDepth = 2,
  maxDepth = 3,
  activeId,
  offset = 80,
  ariaLabel = 'Table of contents',
  className,
  ...rest
}: TableOfContentsProps) {
  const visible = items.filter((i) => i.depth >= minDepth && i.depth <= maxDepth);
  const spyActive = useScrollSpy(activeId === undefined ? visible.map((i) => i.id) : [], offset);
  const current = activeId ?? spyActive;

  if (visible.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={cn('text-sm', className)} {...rest}>
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</p>}
      <ul className="space-y-1 border-l border-border">
        {visible.map((item) => {
          const isActive = item.id === current;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                style={{ paddingLeft: `${0.75 + (item.depth - minDepth) * 0.75}rem` }}
                className={cn(
                  '-ml-px block border-l py-0.5 pr-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-r',
                  isActive
                    ? 'border-primary font-medium text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

```
