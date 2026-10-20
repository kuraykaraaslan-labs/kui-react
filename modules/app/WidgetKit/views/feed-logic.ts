// The pure logic of the event feed widget (no React): table rows as feed items in order, the time text, the day
// groups and the look of every entry for the four layouts. `DataFeedView.tsx` draws it; kui-ejs and KUInative vendor
// this file.

import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import { cssColor, fontStyle, tint } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { SlotData } from '../kind';
import {
  formatDateValue, fullDate, matchValue, relativeTime, statusColor, toEpoch,
  type DateDisplay, type ValueColor,
} from './table-logic';

export { relativeTime };

export type FeedSettings = {
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
  const s = settings as FeedSettings;
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

export const dayKey = (at: number | null) => {
  if (at === null) return 'unknown';
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "Today", "Yesterday", else "Tue, 13 Oct". */
export function dayLabel(at: number, now: number, locale?: string): string {
  const start = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((start(at) - start(now)) / 86_400_000);
  if (days === 0 || days === -1) {
    const text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  }
  return new Date(at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}


export interface FeedEntry {
  id: string;
  layout: NonNullable<FeedSettings['layout']>;
  className: string;
  style?: StyleRecord;
  /** The marker before the item; null when there is none. */
  marker: { kind: 'tile'; icon: string; color: string; size: number } | { kind: 'dot'; className: string; color: string; shadow: string } | null;
  /** Cards draw the marker only for the icon indicator. */
  showMarker: boolean;
  /** Timeline: the vertical line down to the next item. */
  line: { style: StyleRecord } | null;
  title: string;
  description: string;
  time: { iso: string; title: string; text: string; className: string } | null;
  timeBelow: boolean;
}

export interface FeedGroup { key: string; heading: string | null; entries: FeedEntry[] }

/** Everything the feed draws, decided once. */
export function feedModel(
  s: FeedSettings, data: Record<string, SlotData | undefined>, locale: string | undefined, now: number, unknownDay: string,
  iconAvailable: (name: string) => boolean = () => true,
) {
  const items = feedItems(data.events, s as Sparse);
  const layout = s.layout ?? 'timeline';
  const lines = typeof s.descriptionLines === 'number' ? s.descriptionLines : 2;
  const indicator = s.indicator ?? 'dot';
  const timeBelow = s.timePosition === 'below';
  const divider = s.divider !== false;
  const dividerColor = cssColor(s.dividerColor);
  const titleStyle = fontStyle(s.titleFont, s.titleColor) as StyleRecord;
  const descStyle: StyleRecord = {
    ...fontStyle(s.descriptionFont, s.descriptionColor) as StyleRecord,
    ...(lines > 0 ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
  };
  const timeStyle = fontStyle(s.timeFont, s.timeColor) as StyleRecord;
  const markerDefault = cssColor(s.markerColor) ?? 'var(--text-disabled)';
  const colorOf = (it: FeedItem) => it.color ?? markerDefault;
  // An icon only when the host can draw it; otherwise the dot (never an empty tile).
  const drawable = (name: string | undefined) => (name && iconAvailable(name) ? name : undefined);
  const iconOf = (it: FeedItem) => drawable(it.icon) ?? drawable(s.icon) ?? drawable(it.color ? TONE_ICON[it.color] : undefined);
  const markerOf = (it: FeedItem, size: 'sm' | 'md' = 'md'): FeedEntry['marker'] => {
    if (indicator === 'none' || indicator === 'bar') return null;
    const color = colorOf(it);
    const icon = indicator === 'icon' ? iconOf(it) : undefined;
    if (icon) return { kind: 'tile', icon, color, size: size === 'sm' ? 22 : 28 };
    return {
      kind: 'dot', color, shadow: `0 0 0 3px ${tint(color, 18)}`,
      className: cn(
        'flex shrink-0 items-center justify-center',
        // In icon mode a dot keeps the icon's slot, so every title starts at the same x.
        indicator === 'icon' ? (size === 'sm' ? 'h-[22px] w-[22px]' : 'h-7 w-7') : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
      ),
    };
  };
  const barStyle = (it: FeedItem): StyleRecord | undefined =>
    indicator === 'bar' ? { boxShadow: `inset 3px 0 0 ${colorOf(it)}`, paddingLeft: 12 } : undefined;
  const rule = divider ? 'border-b border-border last:border-b-0' : '';
  const ruleStyle = divider && dividerColor ? { borderColor: dividerColor } : undefined;
  const lineColor = cssColor(s.lineColor);

  const entryOf = (it: FeedItem, last: boolean): FeedEntry => {
    const base = {
      id: it.id, layout, title: it.title, description: it.description, timeBelow,
      time: it.at === null ? null : {
        iso: new Date(it.at).toISOString(), title: fullDate(it.at, locale),
        text: feedTime(it.at, s.timeDisplay, locale, now, s.timePattern),
        className: 'whitespace-nowrap tabular-nums',
      },
    };
    if (layout === 'compact') {
      return { ...base, className: cn('flex min-h-8 min-w-0 items-center gap-2.5 py-1', rule), style: { ...ruleStyle, ...barStyle(it) }, marker: markerOf(it, 'sm'), showMarker: true, line: null };
    }
    if (layout === 'cards') {
      return {
        ...base, className: 'flex gap-3 rounded-lg border border-border p-2.5',
        style: { background: tint('var(--text-primary)', 2), ...(indicator === 'bar' || indicator === 'dot' ? { boxShadow: `inset 3px 0 0 ${colorOf(it)}`, paddingLeft: 13 } : {}) },
        marker: markerOf(it), showMarker: indicator === 'icon', line: null,
      };
    }
    if (layout === 'list') {
      return { ...base, className: cn('flex min-h-9 items-start gap-3 py-2', rule), style: { ...ruleStyle, ...barStyle(it) }, marker: markerOf(it), showMarker: true, line: null };
    }
    const hasLine = !last && indicator !== 'none' && indicator !== 'bar';
    return {
      ...base, className: 'relative flex gap-3 pb-3 last:pb-0', style: barStyle(it), marker: markerOf(it), showMarker: true,
      line: hasLine ? { style: { left: indicator === 'icon' && iconOf(it) ? 13.5 : 9.5, top: indicator === 'icon' && iconOf(it) ? 32 : 22, ...(lineColor ? { background: lineColor } : {}) } } : null,
    };
  };

  const groupsOf = (group: FeedItem[]) => group.map((it, i) => entryOf(it, i === group.length - 1));
  let groups: FeedGroup[];
  if (!s.groupByDay) groups = [{ key: 'all', heading: null, entries: groupsOf(items) }];
  else {
    const raw: Array<{ key: string; at: number | null; items: FeedItem[] }> = [];
    for (const it of items) {
      const key = dayKey(it.at);
      const g = raw.find((x) => x.key === key);
      if (g) g.items.push(it);
      else raw.push({ key, at: it.at, items: [it] });
    }
    groups = raw.map((g) => ({ key: g.key, heading: g.at === null ? unknownDay : dayLabel(g.at, now, locale), entries: groupsOf(g.items) }));
  }
  return {
    layout, items, groups, grouped: !!s.groupByDay, titleStyle, descStyle, timeStyle,
    olClass: cn('flex flex-col', layout === 'cards' && 'gap-2'),
    compactTitleClass: 'min-w-0 flex-1 truncate text-[13px] text-text-primary',
  };
}
