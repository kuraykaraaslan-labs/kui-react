'use client';
import { cn } from '@/libs/utils/cn';
import { sortByOrder } from '@/libs/utils/orderItems';
import { Suspense, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { ContributionBoundary } from './ContributionBoundary';
import { Spinner } from './Spinner';
import { UnavailableContribution } from './UnavailableContribution';

export type Tab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  content: React.ReactNode;
  /** Position among the tabs, like CSS `order`: missing counts as 0, ties keep array order. */
  order?: number;
  /** Overrides the group's `isolate` for this tab (e.g. `true` for a tab another module contributes). */
  isolate?: boolean;
  /** Overrides the group's `lazy` for this tab. */
  lazy?: boolean;
};

export type TabErrorContext = {
  tab: Tab;
  error: Error;
  reset: () => void;
};

export function TabGroup({
  tabs,
  defaultTab,
  label = 'Tabs',
  lazy = false,
  isolate = false,
  renderError,
  loadingFallback,
  onTabError,
  retryLabel = 'Retry',
  className,
}: {
  tabs: Tab[];
  defaultTab?: string;
  label?: string;
  lazy?: boolean;
  /**
   * Wrap each tab panel in an error boundary and a Suspense boundary, so one tab that throws
   * or suspends cannot take the others down. Per tab, `tab.isolate` overrides it.
   */
  isolate?: boolean;
  /** What an isolated tab shows after it throws. Defaults to a "failed" placeholder with a retry. */
  renderError?: (context: TabErrorContext) => ReactNode;
  /** What an isolated tab shows while it suspends. Defaults to a spinner. */
  loadingFallback?: ReactNode;
  /** Called when an isolated tab throws, for reporting. */
  onTabError?: (tabId: string, error: Error, info: ErrorInfo) => void;
  /** Label of the default error fallback's retry button. */
  retryLabel?: string;
  className?: string;
}) {
  const ordered = useMemo(() => sortByOrder(tabs), [tabs]);
  const firstId = ordered[0]?.id ?? '';
  const [active, setActive] = useState(defaultTab ?? firstId);
  const [activated, setActivated] = useState<ReadonlySet<string>>(
    () => new Set([defaultTab ?? firstId]),
  );
  // A tab that went away (a contributed tab that was removed) hands over to the first one.
  const current = ordered.some((t) => t.id === active) ? active : firstId;

  function activate(id: string) {
    setActive(id);
    setActivated((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIdx = (index + 1) % ordered.length;
      while (ordered[nextIdx].disabled && nextIdx !== index) nextIdx = (nextIdx + 1) % ordered.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (index - 1 + ordered.length) % ordered.length;
      while (ordered[nextIdx].disabled && nextIdx !== index) nextIdx = (nextIdx - 1 + ordered.length) % ordered.length;
    } else if (e.key === 'Home') {
      nextIdx = ordered.findIndex((t) => !t.disabled);
    } else if (e.key === 'End') {
      nextIdx = ordered.length - 1 - [...ordered].reverse().findIndex((t) => !t.disabled);
    }
    if (nextIdx !== null && !ordered[nextIdx].disabled) {
      activate(ordered[nextIdx].id);
    }
  }

  function panelContent(tab: Tab): ReactNode {
    if (!(tab.isolate ?? isolate)) return tab.content;
    return (
      <ContributionBoundary
        onError={onTabError ? (error, info) => onTabError(tab.id, error, info) : undefined}
        fallback={({ error, reset }) =>
          renderError ? (
            renderError({ tab, error, reset })
          ) : (
            <UnavailableContribution reason="failed" size="tab" action={{ label: retryLabel, onClick: reset }} />
          )
        }
      >
        <Suspense
          fallback={
            loadingFallback ?? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            )
          }
        >
          {tab.content}
        </Suspense>
      </ContributionBoundary>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      {/* A row wider than its box (many tabs, a phone) scrolls sideways inside the tab list instead of the page. */}
      <div role="tablist" aria-label={label} className="flex overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-border pb-3">
        {ordered.map((tab, i) => {
          const isActive = tab.id === current;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-btn-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              onClick={() => !tab.disabled && activate(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border',
                tab.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
              )}
            >
              {tab.icon && <span aria-hidden="true" className="shrink-0">{tab.icon}</span>}
              {tab.label}
              {tab.badge && <span className="shrink-0">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
      {ordered.map((tab) => {
        const isActive = tab.id === current;
        const everActivated = isActive || activated.has(tab.id);
        const shouldRender = !(tab.lazy ?? lazy) || everActivated;
        return (
          <div
            key={tab.id}
            id={`tabpanel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-btn-${tab.id}`}
            tabIndex={0}
            hidden={!isActive}
            className="py-4 focus-visible:outline-none"
          >
            {shouldRender ? panelContent(tab) : null}
          </div>
        );
      })}
    </div>
  );
}
