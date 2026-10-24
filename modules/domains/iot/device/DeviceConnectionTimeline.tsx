'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft, faClock, faPlug, faPlugCircleXmark, faCircleDot } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Timeline, type TimelineItem } from '@/modules/ui/Timeline';
import { Button } from '@/modules/ui/Button';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, toDate } from '../format';
import type { DeviceConnectionEvent } from '../types/device';
import type { IotMessagesInput } from '../messages';

/**
 * DeviceConnectionTimeline — a device's connection log (connects, disconnects with their protocol reason, takeovers, rule
 * switches) on top of the generic `Timeline`, newest first, grouped by day. Paged by the host (`onLoadMore`).
 */
export type DeviceConnectionTimelineProps = {
  events: readonly DeviceConnectionEvent[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  locale?: string;
  timeZone?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const KIND: Record<string, { icon: IconDefinition; tone: TimelineItem['tone'] }> = {
  connected: { icon: faPlug, tone: 'success' },
  disconnected: { icon: faPlugCircleXmark, tone: 'default' },
  taken_over: { icon: faArrowRightArrowLeft, tone: 'warning' },
  last_seen_only: { icon: faClock, tone: 'info' },
};

export function DeviceConnectionTimeline({
  events, loading = false, hasMore = false, onLoadMore, locale, timeZone, messages, className,
}: DeviceConnectionTimelineProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const titles: Record<string, string> = {
    connected: m.connection.connected,
    disconnected: m.connection.disconnected,
    taken_over: m.connection.taken_over,
    last_seen_only: m.connection.last_seen_only,
  };
  const items: TimelineItem[] = events.map((e) => {
    const meta = KIND[e.kind] ?? { icon: faCircleDot, tone: 'default' as const };
    const parts = [
      e.reason ? fill(m.connection.reason, { reason: e.reason }) : null,
      e.transport ? fill(m.connection.via, { transport: e.transport }) : null,
      e.remoteIp ? fill(m.connection.from, { ip: e.remoteIp }) : null,
    ].filter(Boolean);
    return {
      id: e.id,
      at: toDate(e.at) ?? new Date(0),
      title: titles[e.kind] ?? m.connection.other,
      body: parts.length || e.detail ? (
        <span className="text-xs text-text-secondary">
          {parts.join(' · ')}
          {e.detail ? <code className="ml-1 rounded bg-surface-sunken px-1">{e.detail}</code> : null}
        </span>
      ) : undefined,
      icon: <FontAwesomeIcon icon={meta.icon} className="h-3 w-3" aria-hidden="true" />,
      tone: meta.tone,
    };
  });
  return (
    <div className={cn('space-y-3', className)}>
      <Timeline items={items} locale={lang} timeZone={timeZone} emptyMessage={loading ? m.common.loading : m.connection.empty} />
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" loading={loading} onClick={onLoadMore}>{m.connection.loadMore}</Button>
        </div>
      )}
    </div>
  );
}
