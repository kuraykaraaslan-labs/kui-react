'use client';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle } from '../settings/style';
import type { Sparse } from '../settings/types';
import { useKitMessages, useWidgetKit } from '../WidgetKitContext';
import type { FeedMessages } from '../messages';
import { useNow } from '../useNow';
import type { SlotData, WidgetKindView, WidgetViewProps } from '../kind';
import {
  declaredColumns, formatDateValue, fullDate, matchValue, rawText, relativeTime, statusColor, toEpoch,
  type DateDisplay, type ValueColor,
} from './DataTableView';
import { IconTile, Meta, tint } from './ui';

export { relativeTime };

type S = {
  timeColumn?: string;
  titleColumn?: string;
  descriptionColumn?: string;
  colorColumn?: string;
  iconColumn?: string;
  valueColors?: ValueColor[];
  layout?: 'timeline' | 'list' | 'compact' | 'cards';
  order?: 'newest' | 'oldest';
  maxItems?: number;
  timeDisplay?: DateDisplay;
  timePattern?: string;
  timePosition?: 'side' | 'below';
  groupByDay?: boolean;
  indicator?: 'dot' | 'icon' | 'bar' | 'none';
  divider?: boolean;
  dividerColor?: string;
  titleFont?: FontValue;
  titleColor?: string;
  descriptionFont?: FontValue;
  descriptionColor?: string;
  descriptionLines?: number;
  timeFont?: FontValue;
  timeColor?: string;
  markerColor?: string;
  icon?: string;
  lineColor?: string;
};

type Row = Record<string, unknown>;

export interface FeedItem {
  id: string;
  /** Epoch ms, or null when the time cannot be read. */
  at: number | null;
  title: string;
  description: string;
  /** A colour safe for `style`, or undefined (the marker colour applies). */
  color?: string;
  icon?: string;
  row: Row;
}

const ICON_RE = /^[a-z0-9:-]+(?: [a-z0-9:-]+){0,3}$/i;
const iconName = (v: unknown) => (typeof v === 'string' && v.length <= 64 && ICON_RE.test(v.trim()) ? v.trim() : undefined);

/** The icon a severity colour suggests when the row names none (indicator "icon"). */
const TONE_ICON: Record<string, string> = {
  'var(--success)': 'fas fa-circle-check',
  'var(--warning)': 'fas fa-triangle-exclamation',
  'var(--error)': 'fas fa-circle-exclamation',
  'var(--info)': 'fas fa-circle-info',
  'var(--primary)': 'fas fa-circle-info',
};

/**
 * Table rows → feed items in the configured order. A row with no title is skipped (an untitled
 * line says nothing); a row whose time does not parse is kept but always sorts last, so a bad
 * timestamp never hides an event. `max` caps the result (0 = no cap). The colour column may hold a
 * colour, a tone name, a status word or a value the value-colour map names.
 */
export function feedItems(slot: SlotData | undefined, settings: Sparse, max?: number): FeedItem[] {
  const s = settings as S;
  const timeKey = s.timeColumn || 'time';
  const titleKey = s.titleColumn || 'title';
  const items: FeedItem[] = [];
  (slot?.rows ?? []).forEach((row, i) => {
    const title = row[titleKey];
    if (title === null || title === undefined || String(title).trim() === '') return;
    const description = s.descriptionColumn && row[s.descriptionColumn] != null ? String(row[s.descriptionColumn]) : '';
    const colorRaw = s.colorColumn ? row[s.colorColumn] : undefined;
    const mapped = matchValue(colorRaw, s.valueColors);
    const icon = iconName(s.iconColumn ? row[s.iconColumn] : undefined) ?? iconName(mapped?.icon);
    items.push({
      id: String(i),
      at: toEpoch(row[timeKey]),
      title: typeof title === 'object' ? JSON.stringify(title) : String(title),
      description: description.length > 500 ? `${description.slice(0, 497)}…` : description,
      color: cssColor(mapped?.color) ?? statusColor(colorRaw),
      icon,
      row,
    });
  });
  const sign = s.order === 'oldest' ? 1 : -1;
  items.sort((a, b) => {
    if (a.at === null || b.at === null) return a.at === b.at ? 0 : a.at === null ? 1 : -1;
    return sign * (a.at - b.at);
  });
  const cap = max ?? Math.max(1, Math.min(50, Number(s.maxItems) || 10));
  return cap > 0 ? items.slice(0, cap) : items;
}

/** The time as the `timeDisplay` setting asks. */
export function feedTime(at: number, display: DateDisplay = 'relative', locale?: string, now = Date.now(), pattern?: string): string {
  return formatDateValue(at, { display, pattern, now, relativeStyle: 'long' }, locale);
}

const dayKey = (at: number | null) => {
  if (at === null) return 'unknown';
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "Today", "Yesterday", else "Tue, 13 Oct". */
function dayLabel(at: number, now: number, locale?: string): string {
  const start = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((start(at) - start(now)) / 86_400_000);
  if (days === 0 || days === -1) {
    const text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  }
  return new Date(at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

export type { FeedMessages } from '../messages';

export type DataFeedViewProps = WidgetViewProps & {
  /** Fixed "now" for relative times (tests, snapshots). */
  now?: number;
  messages?: Partial<FeedMessages>;
};

/** `data.feed`: events as a timeline, a list, compact lines or cards. */
export function DataFeedView({ settings, data, locale, now, messages }: DataFeedViewProps) {
  const s = settings as S;
  const items = useMemo(() => feedItems(data.events, settings), [data.events, settings]);
  const layout = s.layout ?? 'timeline';
  const clock = useNow(30_000);
  const nowMs = now ?? clock;
  const kit = useKitMessages();
  const unknownDay = messages?.unknownDay ?? kit.feed.unknownDay;
  const lines = typeof s.descriptionLines === 'number' ? s.descriptionLines : 2;
  const indicator = s.indicator ?? 'dot';
  const timeBelow = s.timePosition === 'below';
  const divider = s.divider !== false;
  const dividerColor = cssColor(s.dividerColor);

  const titleStyle = fontStyle(s.titleFont, s.titleColor);
  const descStyle: CSSProperties = {
    ...fontStyle(s.descriptionFont, s.descriptionColor),
    ...(lines > 0 ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
  };
  const timeStyle = fontStyle(s.timeFont, s.timeColor);
  const markerDefault = cssColor(s.markerColor) ?? 'var(--text-disabled)';
  const colorOf = (it: FeedItem) => it.color ?? markerDefault;

  const time = (it: FeedItem, className?: string): ReactNode => it.at === null ? null : (
    <Meta className={cn('whitespace-nowrap tabular-nums', className)} style={timeStyle}>
      <time dateTime={new Date(it.at).toISOString()} title={fullDate(it.at, locale)}>
        {feedTime(it.at, s.timeDisplay, locale, nowMs, s.timePattern)}
      </time>
    </Meta>
  );

  const { renderIcon } = useWidgetKit();
  // An icon only when the host can draw it; otherwise the dot (never an empty tile).
  const drawable = (name: string | undefined) => (name && renderIcon && renderIcon(name, {}) != null ? name : undefined);
  const iconOf = (it: FeedItem) => drawable(it.icon) ?? drawable(s.icon) ?? drawable(it.color ? TONE_ICON[it.color] : undefined);

  /** The marker before an item: a dot, a tinted icon tile, or nothing (a bar is drawn on the item itself). */
  const marker = (it: FeedItem, size: 'sm' | 'md' = 'md'): ReactNode => {
    if (indicator === 'none' || indicator === 'bar') return null;
    const color = colorOf(it);
    const icon = indicator === 'icon' ? iconOf(it) : undefined;
    if (icon) return <span data-part="marker" aria-hidden="true"><IconTile name={icon} color={color} size={size === 'sm' ? 22 : 28} /></span>;
    return (
      <span
        data-part="marker"
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center',
          // In icon mode a dot keeps the icon's slot, so every title starts at the same x.
          indicator === 'icon' ? (size === 'sm' ? 'h-[22px] w-[22px]' : 'h-7 w-7') : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
        )}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 0 3px ${tint(color, 18)}` }} />
      </span>
    );
  };
  const barStyle = (it: FeedItem): CSSProperties | undefined =>
    indicator === 'bar' ? { boxShadow: `inset 3px 0 0 ${colorOf(it)}`, paddingLeft: 12 } : undefined;

  const title = (it: FeedItem, className?: string) => (
    <p data-part="title" className={cn('min-w-0 break-words text-[13px] font-medium leading-snug text-text-primary', className)} style={titleStyle}>{it.title}</p>
  );
  const desc = (it: FeedItem) => it.description
    ? <p data-part="description" className="mt-0.5 break-words text-xs leading-snug text-text-secondary" style={descStyle}>{it.description}</p>
    : null;
  const text = (it: FeedItem) => (
    <div className="min-w-0 flex-1">
      {timeBelow ? title(it) : (
        <div className="flex items-baseline justify-between gap-3">
          {title(it)}
          {time(it, 'shrink-0')}
        </div>
      )}
      {desc(it)}
      {timeBelow && time(it, 'mt-0.5 block')}
    </div>
  );
  const rule = divider ? 'border-b border-border last:border-b-0' : '';
  const ruleStyle = divider && dividerColor ? { borderColor: dividerColor } : undefined;

  const entry = (it: FeedItem, last: boolean): ReactNode => {
    if (layout === 'compact') {
      return (
        <li key={it.id} className={cn('flex min-h-8 min-w-0 items-center gap-2.5 py-1', rule)} style={{ ...ruleStyle, ...barStyle(it) }} data-feed-item>
          {marker(it, 'sm')}
          <span data-part="title" className="min-w-0 flex-1 truncate text-[13px] text-text-primary" style={titleStyle}>{it.title}</span>
          {time(it, 'shrink-0')}
        </li>
      );
    }
    if (layout === 'cards') {
      return (
        <li
          key={it.id}
          className="flex gap-3 rounded-lg border border-border p-2.5"
          style={{
            background: tint('var(--text-primary)', 2),
            ...(indicator === 'bar' || indicator === 'dot' ? { boxShadow: `inset 3px 0 0 ${colorOf(it)}`, paddingLeft: 13 } : {}),
          }}
          data-feed-item
        >
          {indicator === 'icon' && marker(it)}
          {text(it)}
        </li>
      );
    }
    if (layout === 'list') {
      return (
        <li key={it.id} className={cn('flex min-h-9 items-start gap-3 py-2', rule)} style={{ ...ruleStyle, ...barStyle(it) }} data-feed-item>
          {marker(it)}
          {text(it)}
        </li>
      );
    }
    // Timeline: markers on a vertical line.
    const line = cssColor(s.lineColor);
    return (
      <li key={it.id} className="relative flex gap-3 pb-3 last:pb-0" style={barStyle(it)} data-feed-item>
        {!last && indicator !== 'none' && indicator !== 'bar' && (
          <span
            className="absolute bottom-0 w-px bg-border"
            style={{ left: indicator === 'icon' && iconOf(it) ? 13.5 : 9.5, top: indicator === 'icon' && iconOf(it) ? 32 : 22, ...(line ? { background: line } : {}) }}
            aria-hidden="true"
          />
        )}
        {marker(it)}
        {text(it)}
      </li>
    );
  };

  const list = (group: FeedItem[]) => (
    <ol className={cn('flex flex-col', layout === 'cards' && 'gap-2')}>
      {group.map((it, i) => entry(it, i === group.length - 1))}
    </ol>
  );

  if (!s.groupByDay) return list(items);

  const groups: Array<{ key: string; at: number | null; items: FeedItem[] }> = [];
  for (const it of items) {
    const key = dayKey(it.at);
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(it);
    else groups.push({ key, at: it.at, items: [it] });
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {g.at === null ? unknownDay : dayLabel(g.at, nowMs, locale)}
            </h4>
            {list(g.items)}
        </section>
      ))}
    </div>
  );
}

export const DATA_FEED_VIEW: WidgetKindView = {
  View: DataFeedView,
  isEmpty: (data, settings) => feedItems(data.events, settings, 1).length === 0,
  toCsv: (data, settings) => {
    const s = settings as S;
    const declared = declaredColumns(data.events);
    const known = new Set(declared.map((c) => c.key));
    // Configured columns the result actually has (defaults such as `icon` may name a column the query lacks).
    const keys = [s.timeColumn || 'time', s.titleColumn || 'title', s.descriptionColumn, s.colorColumn, s.iconColumn]
      .filter((k, i, a): k is string => !!k && a.indexOf(k) === i && (i < 2 || known.has(k)));
    const label = (k: string) => declared.find((c) => c.key === k)?.label || k;
    const items = feedItems(data.events, settings, 0);
    return [keys.map(label), ...items.map((it) => keys.map((k) => rawText(it.row[k])))];
  },
};
