'use client';
import { lazy, Suspense, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { ContributionBoundary } from '@/modules/ui/ContributionBoundary';
import { cn } from '@/libs/utils/cn';
import { useDarkMode } from '@/modules/ui/MapView/hooks/useDarkMode';
import { cssColor } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { SlotData, WidgetKindView, WidgetViewProps } from '../kind';
import { resolveModelUrl } from './content-logic';
import { cellText, declaredColumns, matchValue, num, rawText } from './DataTableView';
import { mapLegend } from './MapView';
import { IconTile, Meta } from './ui';
import { useKitMessages } from '../WidgetKitContext';
import type { CommonMessages } from '../messages';
import {
  applyViewerRules, buildThings, MAX_MODELS, MAX_SENSORS, MAX_TOOLTIP_FIELDS, rowColor, toWorld,
  type Row, type SensorMarker, type ViewerModelSettings,
} from './viewer-model-logic';

// The pure part (settings, markers, things, rules) lives in `viewer-model-logic.ts`; it is re-exported here so the
// kit's imports of `buildSensors`, `toWorld`, `MAX_MODELS` and the types keep one address.
export * from './viewer-model-logic';

type S = ViewerModelSettings;

export interface ModelSource { url: string; label: string }

/**
 * The models to load: visible rows whose address passes the allow-list (internal path or https),
 * rewritten by the host and checked again, without duplicates, at most `MAX_MODELS`.
 */
export function modelSources(settings: Sparse, resolveUrl?: (url: string) => string): ModelSource[] {
  const rows = Array.isArray((settings as S).models) ? (settings as S).models! : [];
  const out: ModelSource[] = [];
  for (const row of rows) {
    if (out.length >= MAX_MODELS) break;
    if (!row || typeof row !== 'object' || row.visible === false) continue;
    let url = resolveModelUrl(row.url);
    if (url && resolveUrl && url.startsWith('/')) url = resolveModelUrl(resolveUrl(url));
    if (!url || out.some((m) => m.url === url)) continue;
    const name = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : url.split('/').pop()!.split('?')[0];
    out.push({ url, label: name });
  }
  return out;
}

const tooltipKeys = (s: S): string[] =>
  [...new Set((Array.isArray(s.tooltipColumns) ? s.tooltipColumns : []).filter((k) => typeof k === 'string' && k))].slice(0, MAX_TOOLTIP_FIELDS);

/**
 * Table rows → sensor markers. Rows without three finite coordinates are skipped (never placed at the
 * origin). Capped at `MAX_SENSORS`. Each marker keeps its row (a click reports it).
 */
export function buildSensors(
  slot: SlotData | undefined, settings: Sparse, locale?: string,
  texts: { reading?: string } & Partial<CommonMessages> = {},
): { sensors: SensorMarker[]; rows: Map<string, Row> } {
  const yesNo = texts.yes || texts.no ? { yes: texts.yes ?? 'Yes', no: texts.no ?? 'No' } : undefined;
  const s = settings as S;
  const declared = declaredColumns(slot);
  const def = (key: string) => declared.find((c) => c.key === key);
  const fixed = cssColor(s.markerColor) ?? 'var(--primary)';
  const fieldsOf = tooltipKeys(s);
  const byColumn = (s.colorBy ?? 'column') === 'column' && !!s.colorColumn;
  const sensors: SensorMarker[] = [];
  const rows = new Map<string, Row>();
  (slot?.rows ?? []).forEach((row, i) => {
    if (sensors.length >= MAX_SENSORS) return;
    const x = num(row[s.xColumn || 'x']);
    const y = num(row[s.yColumn || 'y']);
    const z = num(row[s.zColumn || 'z']);
    if (x === null || y === null || z === null) return;
    const rawId = s.idColumn && row[s.idColumn] != null && row[s.idColumn] !== '' ? String(row[s.idColumn]) : String(i);
    const id = rows.has(rawId) ? `${rawId}#${i}` : rawId;
    rows.set(id, row);
    const label = s.labelColumn && row[s.labelColumn] != null && row[s.labelColumn] !== '' ? String(row[s.labelColumn]) : undefined;
    const raw = s.valueColumn ? row[s.valueColumn] : undefined;
    const unit = s.unitColumn && typeof row[s.unitColumn] === 'string' && row[s.unitColumn] ? String(row[s.unitColumn]) : undefined;
    const valueText = raw === null || raw === undefined || raw === ''
      ? undefined
      : cellText(raw, def(s.valueColumn!)?.type, {}, unit !== undefined ? { unit } : {}, locale, undefined, yesNo);
    const own = rowColor(row, s);
    const color = own ?? fixed;
    const fields = fieldsOf.flatMap((key) => {
      const v = row[key];
      if (v === null || v === undefined || v === '' || key === s.valueColumn) return [];
      const d = def(key);
      const mapped = key === s.colorColumn ? matchValue(v, s.valueColors)?.label : undefined;
      return [{ label: d?.label || key, value: mapped || cellText(v, d?.type, {}, {}, locale, undefined, yesNo) }];
    });
    if (valueText) fields.unshift({ label: (s.valueColumn && def(s.valueColumn)?.label) || texts.reading || 'Reading', value: valueText });
    const statusRaw = byColumn && !fieldsOf.includes(s.colorColumn!) ? row[s.colorColumn!] : undefined;
    const status = statusRaw !== undefined && statusRaw !== null && statusRaw !== '' && !cssColor(statusRaw)
      ? matchValue(statusRaw, s.valueColors)?.label || String(statusRaw)
      : undefined;
    sensors.push({
      id,
      position: toWorld([x, y, z], s.coordinates),
      label,
      valueText,
      color,
      alarm: color === 'var(--error)',
      tooltip: { title: label ?? (s.idColumn ? rawId : `#${i + 1}`), fields, ...(status ? { description: status } : {}) },
      row,
    });
  });
  return { sensors, rows };
}

/** WebGL is there (a context can be made). False on the server, in jsdom and with WebGL switched off. */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** The kit's in-body status: a centred line of meta text, with a spinner or a warning tile. */
export function ViewerStatus({ kind, text, className }: { kind: 'loading' | 'error'; text: string; className?: string }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} data-part={`viewer-${kind}`}
      className={cn('absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-sunken/40 p-4 text-center', className)}>
      {kind === 'loading'
        ? <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        : <IconTile name="fas fa-cube" color="var(--warning)" />}
      <Meta className="max-w-xs text-xs">{text}</Meta>
    </div>
  );
}

// The viewer (three.js, web-ifc, workers) loads only in the browser, only when a card shows it.
const ViewerModelCanvas = lazy(() => import('./ViewerModelCanvas').then((m) => ({ default: m.ViewerModelCanvas })));

const LEGEND_POS: Record<NonNullable<S['legendPosition']>, string> = {
  bottomleft: 'bottom-2 left-2',
  bottomright: 'bottom-2 right-2',
  topleft: 'top-2 left-2',
  topright: 'top-2 right-2',
};

const noop = () => () => {};

export type ViewerModelWidgetViewProps = WidgetViewProps & {
  loadingLabel?: string;
  ariaLabel?: string;
  legendLabel?: string;
};

/**
 * `viewer.model`: a card-less 3D viewer that fills the card, with sensor markers, things from a second table (simple
 * instanced shapes standing on their points), the rules over both (coloured, hidden, labelled, pulsing, resized or
 * lifted from their rows or the board's parameters) and an optional colour legend. A click on a marker or a thing
 * reports its row to the host (`onMarkerClick`).
 */
export function ViewerModelWidgetView({
  settings, data, locale, resolveUrl, title, params, onMarkerClick, loadingLabel: loadingProp, ariaLabel, legendLabel,
}: ViewerModelWidgetViewProps) {
  const s = settings as S;
  const client = useSyncExternalStore(noop, () => true, () => false);
  const dark = useDarkMode();
  const models = useMemo(() => modelSources(settings, resolveUrl), [settings, resolveUrl]);
  const kit = useKitMessages();
  const m = kit.viewer;
  const loadingLabel = loadingProp ?? m.loading;
  const built = useMemo(
    () => buildSensors(data.sensors, settings, locale, { reading: m.reading, ...kit.common }),
    [data.sensors, settings, locale, m.reading, kit.common],
  );
  const builtThings = useMemo(() => buildThings(data.things, settings), [data.things, settings]);
  const { sensors, things } = useMemo(
    () => applyViewerRules(built.sensors, builtThings.things, s.rules, params),
    [built.sensors, builtThings.things, s.rules, params],
  );
  // The legend counts the sensors' statuses (the things take their colours the same way, from their own rows).
  const legend = useMemo(
    () => (s.legend === false || (sensors.length === 0 && things.length === 0) ? [] : mapLegend(data.sensors, settings)),
    [data.sensors, settings, s.legend, sensors.length, things.length],
  );
  const webgl = useMemo(() => client && webglAvailable(), [client]);
  // The legend never sits under the view cube (top right).
  const legendAt = s.legendPosition ?? 'bottomleft';
  const legendCorner = legendAt === 'topright' && s.showNavCube !== false && s.interactive !== false ? 'bottomright' : legendAt;

  let body: ReactNode;
  if (!client) body = <ViewerStatus kind="loading" text={loadingLabel} />;
  else if (!webgl) body = <ViewerStatus kind="error" text={m.noWebgl} />;
  else {
    // Catches the viewer failing to start (no WebGL context, a broken chunk) and shows the error state.
    body = (
      <ContributionBoundary fallback={({ error: e }) => <ViewerStatus kind="error" text={m.startFailed(e.message ?? '')} />}>
        <Suspense fallback={<ViewerStatus kind="loading" text={loadingLabel} />}>
          <ViewerModelCanvas models={models} sensors={sensors} things={things} settings={s} dark={dark} onMarkerClick={onMarkerClick} />
        </Suspense>
      </ContributionBoundary>
    );
  }

  return (
    <div role="region" aria-label={ariaLabel ?? title ?? m.region} data-part="viewer-model"
      className="relative h-full min-h-40 w-full overflow-hidden" style={{ isolation: 'isolate' }}>
      {body}
      {legend.length > 0 && (
        <ul
          aria-label={legendLabel ?? m.legend}
          data-part="legend"
          className={cn(
            'pointer-events-none absolute z-20 flex max-w-[60%] flex-col gap-1 rounded-lg border border-border bg-surface-raised/90 px-2.5 py-2 shadow-sm backdrop-blur-sm',
            LEGEND_POS[legendCorner] ?? LEGEND_POS.bottomleft,
          )}
        >
          {legend.map((e) => (
            <li key={e.label} className="flex items-center gap-2 text-[11px] leading-4 text-text-primary">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className="min-w-0 truncate">{e.label}</span>
              {e.count !== undefined && <span className="ml-auto pl-2 tabular-nums text-text-secondary">{e.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const VIEWER_MODEL_VIEW: WidgetKindView = {
  View: ViewerModelWidgetView,
  // Nothing to show: no model to load, no sensor to place and no thing to draw.
  isEmpty: (data, settings) => modelSources(settings).length === 0
    && buildSensors(data.sensors, settings).sensors.length === 0
    && buildThings(data.things, settings).things.length === 0,
  toCsv: (data, settings) => {
    const s = settings as S;
    const by = s.colorBy ?? 'column';
    const known = new Set(declaredColumns(data.sensors).map((c) => c.key));
    const keys = [
      s.idColumn, s.labelColumn, s.xColumn || 'x', s.yColumn || 'y', s.zColumn || 'z', s.valueColumn, s.unitColumn,
      by === 'column' ? s.colorColumn : undefined, ...tooltipKeys(s),
    ].filter((k, i, a): k is string => !!k && a.indexOf(k) === i && known.has(k));
    const label = (k: string) => declaredColumns(data.sensors).find((c) => c.key === k)?.label || k;
    const { rows } = buildSensors(data.sensors, settings);
    return [keys.map(label), ...[...rows.values()].map((row) => keys.map((k) => rawText(row[k])))];
  },
  emptyShape: true,
};
