'use client';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { useKitMessages, useWidgetKit } from '../WidgetKitContext';
import type { FeedMessages } from '../messages';
import { useNow } from '../useNow';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { feedItems, feedModel, type FeedEntry, type FeedSettings as S } from './feed-logic';
import { rawText, declaredColumns } from './table-logic';
import { IconTile, Meta } from './ui';

export * from './feed-logic';

export type { FeedMessages } from '../messages';

export type DataFeedViewProps = WidgetViewProps & {
  /** Fixed "now" for relative times (tests, snapshots). */
  now?: number;
  messages?: Partial<FeedMessages>;
};

/** `data.feed`: events as a timeline, a list, compact lines or cards. */
export function DataFeedView({ settings, data, locale, now, messages }: DataFeedViewProps) {
  const s = settings as S;
  const clock = useNow(30_000);
  const nowMs = now ?? clock;
  const kit = useKitMessages();
  const unknownDay = messages?.unknownDay ?? kit.feed.unknownDay;
  const { renderIcon } = useWidgetKit();
  const m = useMemo(
    () => feedModel(s, data, locale, nowMs, unknownDay, (name) => (renderIcon ? renderIcon(name, {}) != null : false)),
    [s, data, locale, nowMs, unknownDay, renderIcon],
  );

  const time = (e: FeedEntry, className?: string): ReactNode => e.time === null ? null : (
    <Meta className={cn(e.time.className, className)} style={m.timeStyle as CSSProperties}>
      <time dateTime={e.time.iso} title={e.time.title}>{e.time.text}</time>
    </Meta>
  );
  const marker = (e: FeedEntry): ReactNode => {
    const k = e.marker;
    if (!k || !e.showMarker) return null;
    if (k.kind === 'tile') return <span data-part="marker" aria-hidden="true"><IconTile name={k.icon} color={k.color} size={k.size} /></span>;
    return (
      <span data-part="marker" aria-hidden="true" className={k.className}>
        <span className="h-2 w-2 rounded-full" style={{ background: k.color, boxShadow: k.shadow }} />
      </span>
    );
  };
  const title = (e: FeedEntry) => (
    <p data-part="title" className="min-w-0 break-words text-[13px] font-medium leading-snug text-text-primary" style={m.titleStyle as CSSProperties}>{e.title}</p>
  );
  const desc = (e: FeedEntry) => e.description
    ? <p data-part="description" className="mt-0.5 break-words text-xs leading-snug text-text-secondary" style={m.descStyle as CSSProperties}>{e.description}</p>
    : null;
  const text = (e: FeedEntry) => (
    <div className="min-w-0 flex-1">
      {e.timeBelow ? title(e) : (
        <div className="flex items-baseline justify-between gap-3">
          {title(e)}
          {time(e, 'shrink-0')}
        </div>
      )}
      {desc(e)}
      {e.timeBelow && time(e, 'mt-0.5 block')}
    </div>
  );

  const entry = (e: FeedEntry): ReactNode => {
    if (e.layout === 'compact') {
      return (
        <li key={e.id} className={e.className} style={e.style as CSSProperties | undefined} data-feed-item>
          {marker(e)}
          <span data-part="title" className={m.compactTitleClass} style={m.titleStyle as CSSProperties}>{e.title}</span>
          {time(e, 'shrink-0')}
        </li>
      );
    }
    return (
      <li key={e.id} className={e.className} style={e.style as CSSProperties | undefined} data-feed-item>
        {e.line && <span className="absolute bottom-0 w-px bg-border" style={e.line.style as CSSProperties} aria-hidden="true" />}
        {marker(e)}
        {text(e)}
      </li>
    );
  };
  const list = (entries: FeedEntry[]) => <ol className={m.olClass}>{entries.map(entry)}</ol>;

  if (!m.grouped) return list(m.groups[0].entries);
  return (
    <div className="flex flex-col gap-3">
      {m.groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{g.heading}</h4>
          {list(g.entries)}
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
