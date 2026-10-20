'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/modules/ui/Modal';
import type { ReactNode } from 'react';
import { WidgetCard, type WidgetCardState } from './WidgetCard';
import { resolvePlacement, toCsvText } from './settings/resolve';
import { primaryMeta } from './settings/source-meta';
import type { SettingsTemplate, Sparse } from './settings/types';
import type { ControlRequest, SlotData, SlotSpec, WidgetKindView, WidgetViewProps } from './kind';
import { useKitMessages, useWidgetKit } from './WidgetKitContext';
import { useNow } from './useNow';

export interface PlacementCardProps {
  title?: string;
  template: SettingsTemplate;
  slots: SlotSpec[];
  view: WidgetKindView;
  /** Stored placement settings (sparse, with `$card`, `$format`, `$v`). */
  settings: Sparse | null | undefined;
  /** Board settings (`core:board`) for the board's card defaults. */
  board?: Sparse | null;
  definitionDefaults?: Sparse | null;
  data: Record<string, SlotData | undefined>;
  /** Slot keys that are bound to a source. */
  boundSlots?: string[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onControl?: (request: ControlRequest) => Promise<unknown>;
  controlDisabledReason?: string;
  /** Viewers see "No data" for an unbound widget; editors see "Not configured yet". */
  isEditor?: boolean;
  headerRight?: ReactNode;
  badges?: ReactNode;
  renderLink?: (href: string, children: ReactNode, className?: string) => ReactNode;
  className?: string;
  /** The card sits in a fixed-height grid cell (see `WidgetCard.fixedHeight`). */
  fixedHeight?: boolean;
  /** Fixed "now" (tests, screenshots); by default the card ticks every 30 seconds. */
  now?: number;
  /**
   * The data the CSV export writes, when it is more than what the card shows: a server-paged table holds
   * one page in `data`, and the host fetches every page of the current filter here. Defaults to `data`.
   * A rejection exports nothing (the host reports its own error).
   */
  exportData?: () => Promise<Record<string, SlotData | undefined>>;
  /** Host props for the view beyond the common ones (params, resolveUrl, confirm, a table's paging and row actions, …). */
  viewProps?: Partial<WidgetViewProps> & Record<string, unknown>;
}

/** What a view's empty shape is drawn from: no slot at all. */
const NO_DATA: Record<string, SlotData | undefined> = Object.freeze({}) as Record<string, SlotData | undefined>;

/** The newest `fetchedAt` across bound slots. */
function newestFetch(data: Record<string, SlotData | undefined>): number | null {
  let best: number | null = null;
  for (const d of Object.values(data)) {
    const t = d?.fetchedAt ? Date.parse(d.fetchedAt) : NaN;
    if (Number.isFinite(t) && (best === null || t > best)) best = t;
  }
  return best;
}

function download(name: string, text: string) {
  const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One placement: resolved settings → `WidgetCard` + the type's view, with full screen and CSV. */
export function PlacementCard({
  title, template, slots, view, settings, board, definitionDefaults, data, boundSlots, loading = false, error,
  onRetry, onRefresh, refreshing, onControl, controlDisabledReason, isEditor = false, headerRight, badges, renderLink,
  className, now: nowProp, viewProps, fixedHeight = false, exportData,
}: PlacementCardProps) {
  const { locale } = useWidgetKit();
  const m = useKitMessages();
  const ticking = useNow();
  const now = nowProp ?? ticking;
  const [full, setFull] = useState(false);
  const sourceMeta = useMemo(() => primaryMeta(slots, data), [slots, data]);
  const r = useMemo(
    () => resolvePlacement({ template, slotCount: slots.length, settings, board, definitionDefaults, sourceMeta }),
    [template, slots.length, settings, board, definitionDefaults, sourceMeta],
  );
  const bound = boundSlots ?? Object.keys(data).filter((k) => data[k] !== undefined);
  const requiredUnbound = slots.some((s) => s.required && !bound.some((b) => b === s.key || b.startsWith(`${s.key}#`)));
  const fetchedAt = newestFetch(data);
  const stale = !!r.card.staleAfterSeconds && fetchedAt !== null && now - fetchedAt > r.card.staleAfterSeconds * 1000;

  let state: WidgetCardState = 'ready';
  if (error) state = 'error';
  else if (loading && fetchedAt === null) state = 'loading';
  else if (slots.length > 0 && requiredUnbound) state = isEditor ? 'unconfigured' : 'empty';
  else if (view.isEmpty?.(data, r.settings)) state = 'empty';

  const body = (
    <view.View {...viewProps} settings={r.settings} format={r.format} data={data} locale={locale} stale={stale} title={title}
      onControl={onControl} controlDisabledReason={controlDisabledReason} renderLink={renderLink ?? viewProps?.renderLink} />
  );
  // No data, no command to send, nothing old: the shape only. Drawn by WidgetCard only in its empty and unconfigured states.
  const emptyBody = view.emptyShape && (r.card.emptyDisplay ?? 'shape') === 'shape'
    ? <view.View {...viewProps} settings={r.settings} format={r.format} data={NO_DATA} locale={locale} stale={false} title={title}
      onControl={undefined} renderLink={renderLink ?? viewProps?.renderLink} />
    : undefined;
  const onExport = r.caps.exportable && view.toCsv
    ? async () => {
      let rows: Record<string, SlotData | undefined>;
      try { rows = exportData ? await exportData() : data; } catch { return; }
      download(`${(title || template.label).replace(/[^\w.-]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsvText(view.toCsv!(rows, r.settings, r.format)));
    }
    : undefined;

  return (
    <>
      <WidgetCard
        title={title}
        card={isEditor && (r.card.hideOnMobile || r.card.hideOnDesktop) ? { ...r.card, hideOnMobile: false, hideOnDesktop: false } : r.card}
        state={state}
        stale={stale}
        updatedAt={fetchedAt}
        unconfiguredText={m.card.bindData}
        emptyBody={emptyBody}
        errorText={error ?? undefined}
        onRetry={onRetry}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onExport={onExport}
        onFullscreen={() => setFull(true)}
        headerRight={headerRight}
        badges={badges}
        className={className}
        locale={locale}
        fixedHeight={fixedHeight}
      >
        {body}
      </WidgetCard>
      {full && (
        <Modal open fullscreen onClose={() => setFull(false)} title={title || template.label} closeLabel={m.card.closeFullscreen}>
          <div className="@container h-full min-h-[60vh]">{body}</div>
        </Modal>
      )}
    </>
  );
}

