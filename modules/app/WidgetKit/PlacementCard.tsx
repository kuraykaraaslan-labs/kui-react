'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/modules/ui/Modal';
import { ContributionBoundary } from '@/modules/ui/ContributionBoundary';
import { UnavailableContribution } from '@/modules/ui/UnavailableContribution';
import type { HTMLAttributes, ReactNode } from 'react';
import { WidgetCard, type CardTimeWindow } from './WidgetCard';
import { ZoomPane } from './ZoomPane';
import { FitBox } from './FitBox';
import { resolvePlacement, toCsvText } from './settings/resolve';
import { primaryMeta } from './settings/source-meta';
import { toXlsxBytes } from './settings/xlsx';
import { placementStatus } from './placement-logic';
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
  /** The card's time window selector (see `WidgetCard.timeWindow`): shown when the placement's `showWindow` asks for it. */
  timeWindow?: CardTimeWindow;
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
  /**
   * Isolate the card (default): when it throws while it draws, `FailedPlacementCard` takes its place (its title, "Failed to load" and why) and the
   * rest of the board keeps working; a change of its view or its settings draws it again. A host that already isolates each card in a boundary of
   * its own (to report the failure, say) passes `false` and draws `FailedPlacementCard` as that boundary's fallback.
   */
  isolate?: boolean;
}

/** What a view's empty shape is drawn from: no slot at all. */
const NO_DATA: Record<string, SlotData | undefined> = Object.freeze({}) as Record<string, SlotData | undefined>;

/**
 * What the empty shape is drawn from: the card's answers reduced to the columns a table declared, never a row or a value. An empty table so keeps the
 * headers its source named in the viewer's language (a site page's "Live values" with no rows showed `name, status, running` instead); a slot that
 * declares no columns is left out, so every other kind draws from no data as before.
 */
export function emptyShapeData(data: Record<string, SlotData | undefined> | undefined): Record<string, SlotData | undefined> {
  const out: Record<string, SlotData | undefined> = {};
  for (const [key, slot] of Object.entries(data ?? {})) {
    // no `rows` at all: a table drawn from it is the empty shape (headers over no rows), not an answer with no rows
    if (slot?.columns?.length) out[key] = { shape: 'table', columns: slot.columns };
  }
  return Object.keys(out).length ? out : NO_DATA;
}

function download(name: string, text: string | Uint8Array, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([typeof text === 'string' ? `﻿${text}` : text as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type FailedPlacementCardProps = {
  /** The card's own title; without one the kit's "This card" (`messages.card.failedTitle`). */
  title?: string;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'>;

/**
 * What a card that threw while it drew leaves in its cell: its title, the "Failed to load" badge and a one-line why, in the dashed frame of an
 * unavailable contribution, so the board keeps the card's place and says which card failed instead of drawing nothing. Nothing of the kind or its
 * code is shown: the card's own title, else the kit's words. The texts are the host's `messages.card` (`failedTitle`, `failedLabel`,
 * `failedDetail`). `PlacementCard` draws it by itself (`isolate`); a host with a boundary of its own draws it as that boundary's fallback.
 */
export function FailedPlacementCard({ title, className, ...rest }: FailedPlacementCardProps) {
  const m = useKitMessages().card;
  return (
    <UnavailableContribution
      size="card"
      reason="failed"
      title={title?.trim() || m.failedTitle}
      label={m.failedLabel}
      detail={m.failedDetail}
      className={className}
      {...rest}
    />
  );
}

/**
 * One placement: resolved settings → `WidgetCard` + the type's view, with full screen and CSV. A card that throws while it draws is replaced by
 * `FailedPlacementCard` (see `isolate`).
 */
export function PlacementCard({ isolate = true, ...props }: PlacementCardProps) {
  if (!isolate) return <PlacementCardBody {...props} />;
  return (
    <ContributionBoundary fallback={<FailedPlacementCard title={props.title} />} resetKeys={[props.view, props.settings]}>
      <PlacementCardBody {...props} />
    </ContributionBoundary>
  );
}

function PlacementCardBody({
  title, template, slots, view, settings, board, definitionDefaults, data, boundSlots, loading = false, error,
  onRetry, onRefresh, refreshing, onControl, controlDisabledReason, isEditor = false, headerRight, badges, timeWindow, renderLink,
  className, now: nowProp, viewProps, fixedHeight = false, exportData,
}: Omit<PlacementCardProps, 'isolate'>) {
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
  const { fetchedAt, stale, state } = placementStatus({
    slots, data, card: r.card, boundSlots, loading, error, isEditor, empty: !!view.isEmpty?.(data, r.settings), now,
  });

  const body = (
    <view.View {...viewProps} settings={r.settings} format={r.format} data={data} locale={locale} stale={stale} editing={isEditor} title={title}
      titleShown={r.card.showTitle !== false && !!title} onControl={onControl} controlDisabledReason={controlDisabledReason} renderLink={renderLink ?? viewProps?.renderLink} />
  );
  // No value, no command to send, nothing old: the shape only, with a table's declared headers. Drawn by WidgetCard only in its empty and
  // unconfigured states.
  const emptyBody = view.emptyShape && (r.card.emptyDisplay ?? 'shape') === 'shape'
    ? <view.View {...viewProps} settings={r.settings} format={r.format} data={emptyShapeData(data)} locale={locale} stale={false} title={title}
      titleShown={r.card.showTitle !== false && !!title} onControl={undefined} renderLink={renderLink ?? viewProps?.renderLink} />
    : undefined;
  const exportName = (ext: string) => `${(title || template.label).replace(/[^\w.-]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  const exportRows = async (): Promise<string[][] | null> => {
    try { return view.toCsv!(exportData ? await exportData() : data, r.settings, r.format); } catch { return null; }
  };
  const onExport = r.caps.exportable && view.toCsv
    ? async () => {
      const rows = await exportRows();
      if (rows) download(exportName('csv'), toCsvText(rows));
    }
    : undefined;
  const onExportXlsx = onExport
    ? async () => {
      const rows = await exportRows();
      if (rows) download(exportName('xlsx'), toXlsxBytes(rows, title || template.label), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
        onExportXlsx={onExportXlsx}
        onFullscreen={() => setFull(true)}
        headerRight={headerRight}
        badges={badges}
        timeWindow={timeWindow}
        className={className}
        locale={locale}
        fixedHeight={fixedHeight}
      >
        {/* In a fixed-height cell a view whose content has a height of its own is scaled down to fit rather than cut off. */}
        {view.fit && fixedHeight ? <FitBox>{body}</FitBox> : body}
      </WidgetCard>
      {full && (
        // A picture that zooms gets the zoom pane; anything else scrolls when it is taller than the screen.
        <Modal open fullscreen scrollable={!view.zoomable} onClose={() => setFull(false)} title={title || template.label} closeLabel={m.card.closeFullscreen}>
          {view.zoomable
            ? <ZoomPane className="min-h-[60vh]">{body}</ZoomPane>
            : <div className="@container h-full min-h-[60vh]">{body}</div>}
        </Modal>
      )}
    </>
  );
}

