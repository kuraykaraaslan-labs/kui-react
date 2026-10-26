'use client';
import type { CSSProperties, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faDownload, faFileExcel, faRotateRight, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Tooltip } from '@/modules/ui/Tooltip';
import { UnavailableContribution, type UnavailableContributionContent } from '@/modules/ui/UnavailableContribution';
import { cssColor, fontStyle } from './settings/style';
import { ICON_BUTTON_CLASS, cardModel, formatUpdated, type StyleRecord, type WidgetCardState } from './card-logic';

export { formatUpdated };
import type { CardSettings } from './settings/types';
import { SettingIcon, useKitMessages } from './WidgetKitContext';

export type { CardSettings };

/** What the card body is showing. `unavailable`: the widget's provider cannot be shown (see `unavailable`). */
export type { WidgetCardState } from './card-logic';

export type WidgetCardProps = {
  title?: string;
  card: CardSettings;
  state?: WidgetCardState;
  /** The data is older than `staleAfterSeconds`. */
  stale?: boolean;
  /** When the shown data was produced (for "Updated …"). */
  updatedAt?: Date | string | number | null;
  /** Shown to editors when the widget has no data bound yet. Default: the host's `card.unconfigured` text. */
  unconfiguredText?: string;
  /**
   * The view drawn from no data (its empty shape, see `WidgetKindView.emptyShape`). When given, the empty
   * and unconfigured states show it faded, inert and hidden from assistive tech, under their text.
   */
  emptyBody?: ReactNode;
  /** Default: the host's `card.error` text. */
  errorText?: string;
  onRetry?: () => void;
  /**
   * The reason, texts and action of the `unavailable` state (an `UnavailableContribution` in the
   * card body; the card keeps its title). Defaults to reason `missing`.
   */
  unavailable?: UnavailableContributionContent;
  onFullscreen?: () => void;
  /** Present only when the widget can export; the button shows when `card.buttons` asks for it. */
  onExport?: () => void;
  /** The same data as an Excel file; shown next to the CSV button when `onExport` is. */
  onExportXlsx?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Extra header controls (e.g. action buttons), left of the card buttons. */
  headerRight?: ReactNode;
  /** Badges next to the title (e.g. a pinned time window); where the card hides its title, in the title row's place. */
  badges?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  locale?: string;
  /**
   * The card sits in a cell of fixed height (a placed grid cell). Then, from lg up, the body is a size
   * container and views can scale to the card's height too. Leave it off where cards size to their
   * content: size containment would collapse them.
   */
  fixedHeight?: boolean;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'children' | 'style'>;

const iconBtn = ICON_BUTTON_CLASS;

/**
 * The frame every dashboard widget sits in: title row (icon, title, subtitle, help, badges),
 * card buttons (full screen, CSV, refresh), the body states (loading, empty, unconfigured, error,
 * stale) and an "Updated …" footer. Every look comes from `card` (`core:card` settings): theme
 * tokens by default, any colour the author picks otherwise.
 */
export function WidgetCard({
  title, card, state = 'ready', stale = false, updatedAt, unconfiguredText, emptyBody, errorText, onRetry, unavailable, onFullscreen, onExport, onExportXlsx, onRefresh, refreshing = false,
  headerRight, badges, footer, children, className, style, locale, fixedHeight = false, ...rest
}: WidgetCardProps) {
  const m = useKitMessages().card;
  const model = cardModel({
    title, card, state, stale, updatedAt, locale, fixedHeight, refreshing,
    hasHeaderRight: !!headerRight, hasBadges: !!badges, hasFooter: !!footer, style: style as StyleRecord | undefined,
  });
  const { buttons, showTitle, staleMode, bodyState, updated } = model;
  const placeholder = (text: ReactNode) => (emptyBody ? (
    <div className="relative flex h-full min-h-16 flex-col">
      <div aria-hidden="true" inert className="pointer-events-none flex h-full min-h-0 flex-1 select-none flex-col opacity-40">{emptyBody}</div>
      <div className="absolute inset-0 flex items-center justify-center p-2">
        <p className="rounded-full border border-border bg-surface-raised px-3 py-1 text-center text-xs text-text-secondary shadow-sm">{text}</p>
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-16 items-center justify-center text-center text-sm text-text-secondary">{text}</div>
  ));

  return (
    <section
      aria-label={title || undefined}
      aria-busy={state === 'loading' || refreshing || undefined}
      className={cn(model.sectionClass, className)}
      style={model.frame as CSSProperties}
      {...rest}
    >
      {model.overlay && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={model.overlay as CSSProperties} />
      )}

      {model.hasHeader && (
        <header className="relative flex min-w-0 items-start gap-2" style={model.headerStyle as CSSProperties}>
          {showTitle && card.titleIcon && (
            <SettingIcon name={card.titleIcon} className="mt-0.5 shrink-0 text-text-secondary"
              style={{ width: card.titleIconSize ?? 16, height: card.titleIconSize ?? 16, fontSize: card.titleIconSize ?? 16, color: cssColor(card.titleIconColor) }} />
          )}
          <div className="min-w-0 flex-1">
            {showTitle && (
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="truncate text-sm font-semibold" style={fontStyle(card.titleFont, card.titleColor)}>{title}</h3>
                {card.titleTooltip && (
                  <Tooltip content={card.titleTooltip}>
                    <button type="button" aria-label={m.about(title ?? "")} className={cn(iconBtn, 'h-5 w-5')}>
                      <FontAwesomeIcon icon={faCircleInfo} className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
                {badges}
                {staleMode && (
                  <span className="shrink-0 rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-medium text-warning-fg">{m.oldData}</span>
                )}
              </div>
            )}
            {showTitle && card.subtitle && (
              <p className="truncate text-xs text-text-secondary" style={{ color: cssColor(card.subtitleColor) }}>{card.subtitle}</p>
            )}
            {/* Without the title row, the badges still show where it would be (the header is kept for them). */}
            {!showTitle && badges && <div className="flex min-w-0 items-center gap-1.5">{badges}</div>}
            {!showTitle && staleMode && (
              <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-medium text-warning-fg">{m.oldData}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover/wk:opacity-100 lg:group-focus-within/wk:opacity-100">
            {headerRight}
            {buttons.includes('refresh') && onRefresh && (
              <button type="button" onClick={onRefresh} disabled={refreshing} aria-label={m.refresh} title={m.refresh} className={iconBtn}>
                <FontAwesomeIcon icon={faRotateRight} className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
              </button>
            )}
            {buttons.includes('export') && onExport && (
              <button type="button" onClick={onExport} aria-label={m.download} title={m.download} className={iconBtn}>
                <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {buttons.includes('export') && onExport && onExportXlsx && (
              <button type="button" onClick={onExportXlsx} aria-label={m.downloadXlsx} title={m.downloadXlsx} className={iconBtn}>
                <FontAwesomeIcon icon={faFileExcel} className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {buttons.includes('fullscreen') && onFullscreen && (
              <button type="button" onClick={onFullscreen} aria-label={m.fullscreen} title={m.fullscreen} className={iconBtn}>
                <FontAwesomeIcon icon={faExpand} className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>
      )}

      {/* A container for the views' auto-sizing: width only, plus height from lg up when the card sits in
          a fixed-height cell (`fixedHeight`). */}
      <div className={model.bodyClass} style={model.bodyStyle as CSSProperties}>
        {bodyState === 'unavailable' ? (
          <UnavailableContribution
            size="card"
            framed={false}
            {...(unavailable ?? { reason: 'missing' })}
            title={unavailable?.title ?? (showTitle ? undefined : title)}
          />
        ) : bodyState === 'loading' ? (
          <div className="flex h-full min-h-16 flex-col gap-2" role="status" aria-label={m.loading}>
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-sunken" />
            <div className="h-full min-h-8 w-full animate-pulse rounded bg-surface-sunken" />
          </div>
        ) : bodyState === 'empty' ? (
          placeholder(card.noDataText || m.noData)
        ) : bodyState === 'unconfigured' ? (
          placeholder(unconfiguredText ?? m.unconfigured)
        ) : bodyState === 'error' ? (
          <div role="alert" className="flex h-full min-h-16 flex-col items-center justify-center gap-2 text-center text-sm text-error">
            <p>{errorText ?? m.error}</p>
            {onRetry && (
              <button type="button" onClick={onRetry}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-text-primary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                {m.retry}
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {model.showFooter && (
        <footer className="relative flex items-center justify-between gap-2 text-xs text-text-secondary" style={model.footerStyle as CSSProperties}>
          <span>{footer}</span>
          {updated && <span>{m.updated(updated)}</span>}
        </footer>
      )}
    </section>
  );
}
