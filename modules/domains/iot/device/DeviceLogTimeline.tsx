'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft, faBan, faBellSlash, faCircleCheck, faCircleDot, faCircleExclamation, faClock, faEraser, faFlagCheckered, faKey,
  faLock, faPen, faPenToSquare, faPlug, faPlugCircleXmark, faPlus, faPowerOff, faRotate, faShieldHalved, faSliders, faTerminal, faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Timeline, type TimelineItem } from '@/modules/ui/Timeline';
import { Button } from '@/modules/ui/Button';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatNumber, toDate } from '../format';
import type { DeviceLogEntry, DeviceLogFilter, DeviceLogSource } from '../types/device';
import type { IotMessages, IotMessagesInput } from '../messages';
import { DeviceAddress } from './DeviceAddress';
import { disconnectReasonText } from './DeviceConnectionBadge';

/**
 * DeviceLogTimeline — everything that happened to one device, newest first (NB iot_device 05 §5.3, the Log tab): its connection log
 * (connects, disconnects with their protocol reason, takeovers, rule switches, with the client address and transport through
 * `DeviceAddress`) and its audited changes (created, edited, status, credential, attribute writes, commands, alarm handling) with who
 * made them ("by Ada Lovelace"). A chip row filters All / Connections / Changes; paging is the host's (`onLoadMore`). `compact`
 * draws a short list without day headings, filter or paging (the quick view's recent lines). Times carry seconds and the zone (the
 * host's `timeZone`, else the viewer's); an audit line names fields, statuses, credential types and scopes in words, a code it does
 * not know as it is. `auditAvailable` false says the changes could not be read instead of "No changes yet" (NB 41-ui-fixes/22 4.1,
 * 6.3, 6.4).
 */
export type DeviceLogTimelineProps = {
  entries: readonly DeviceLogEntry[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** The chip row is drawn when `onFilterChange` is given. */
  filter?: DeviceLogFilter;
  onFilterChange?: (filter: DeviceLogFilter) => void;
  /** Without a `log` call the host has connection entries only: the Changes chip is left out. */
  sources?: readonly DeviceLogSource[];
  /** False: the host could not read the audited changes this time (said above the timeline). */
  auditAvailable?: boolean;
  /** The host reads no deeper than this: "Showing the newest {n} entries" under the last one. */
  capped?: number | null;
  compact?: boolean;
  locale?: string;
  timeZone?: string;
  messages?: IotMessagesInput;
  className?: string;
};

type LogKey = Exclude<keyof IotMessages['log'], 'filter'>;
type Look = { icon: IconDefinition; tone: NonNullable<TimelineItem['tone']> };

const CONNECTION: Record<string, Look> = {
  connected: { icon: faPlug, tone: 'success' },
  disconnected: { icon: faPlugCircleXmark, tone: 'default' },
  taken_over: { icon: faArrowRightArrowLeft, tone: 'warning' },
  last_seen_only: { icon: faClock, tone: 'info' },
};

/** The audit actions the hosts write (NB: iot_device, iot_rpc, iot_alarm), their title and marker. Any other action is drawn neutral. */
export const DEVICE_LOG_ACTIONS: Readonly<Record<string, Look & { title: LogKey }>> = {
  'iot_device.device.created': { title: 'deviceCreated', icon: faPlus, tone: 'success' },
  'iot_device.device.updated': { title: 'deviceUpdated', icon: faPen, tone: 'default' },
  'iot_device.device.deleted': { title: 'deviceDeleted', icon: faTrash, tone: 'error' },
  'iot_device.device.activated': { title: 'deviceActivated', icon: faPowerOff, tone: 'success' },
  'iot_device.device.quarantined': { title: 'deviceQuarantined', icon: faShieldHalved, tone: 'warning' },
  'iot_device.device.disabled': { title: 'deviceDisabled', icon: faBan, tone: 'warning' },
  'iot_device.credential.set': { title: 'credentialSet', icon: faKey, tone: 'info' },
  'iot_device.credential.rotated': { title: 'credentialRotated', icon: faRotate, tone: 'info' },
  'iot_device.credential.revoked': { title: 'credentialRevoked', icon: faLock, tone: 'warning' },
  'iot_device.attributes.saved': { title: 'attributesSaved', icon: faSliders, tone: 'default' },
  'iot_device.attributes.deleted': { title: 'attributesDeleted', icon: faEraser, tone: 'default' },
  'iot_rpc.request.created': { title: 'rpcSent', icon: faTerminal, tone: 'info' },
  'iot_rpc.request.cancelled': { title: 'rpcCancelled', icon: faXmark, tone: 'default' },
  'iot_rpc.request.refused': { title: 'rpcRefused', icon: faCircleExclamation, tone: 'error' },
  'iot_rpc.request.completed': { title: 'rpcFinished', icon: faFlagCheckered, tone: 'default' },
  'iot_alarm.alarm.acknowledged': { title: 'alarmAcknowledged', icon: faBellSlash, tone: 'info' },
  'iot_alarm.alarm.cleared': { title: 'alarmCleared', icon: faCircleCheck, tone: 'success' },
};

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const list = (v: unknown): string | null => (Array.isArray(v) && v.length ? v.filter((x) => typeof x === 'string').join(', ') : null);

/** A device field's name in words (the edit drawer's labels); a field it does not know as it is. */
export function fieldLabel(field: string, m: IotMessages): string {
  const words: Record<string, string> = {
    name: m.editDevice.name, label: m.editDevice.label, type: m.editDevice.type, deviceProfileId: m.editDevice.profile, profileId: m.editDevice.profile,
    status: m.editDevice.status, additionalInfo: m.editDevice.additionalInfo, isGateway: m.device.gateway, serial: m.device.serial,
  };
  return words[field] ?? field;
}

/** A registry status in words; an unknown one as it is. */
export function statusLabel(status: string, m: IotMessages): string {
  const words: Record<string, string> = { ACTIVE: m.editDevice.statusActive, QUARANTINED: m.device.quarantined, DISABLED: m.device.disabled };
  return words[status] ?? status;
}

/** One short line from an audit row's metadata: the changed fields, the keys, the credential type, the command or the alarm, in words. */
export function auditSummary(e: DeviceLogEntry, m: IotMessages): string | null {
  const md = e.metadata ?? {};
  const parts: string[] = [];
  const fieldList = Array.isArray(md.fields) ? md.fields.filter((x): x is string => typeof x === 'string') : [];
  if (fieldList.length) parts.push(fill(m.log.changed, { fields: fieldList.map((f) => fieldLabel(f, m)).join(', ') }));
  const from = str(md.from);
  const to = str(md.to);
  if (from && to) parts.push(fill(m.log.status, { from: statusLabel(from, m), to: statusLabel(to, m) }));
  const keys = list(md.keys);
  const scope = str(md.scope);
  const scopeWord = scope ? ((m.attribute as Record<string, string>)[scope.toUpperCase()] ?? scope) : null;
  if (keys) parts.push(scopeWord ? fill(m.log.keys, { scope: scopeWord, keys }) : keys);
  const type = str(md.credentialType);
  if (type) parts.push(fill(m.log.credentialType, { type: (m.credential as Record<string, string>)[type] ?? type }));
  const method = str(md.method);
  if (method) parts.push(fill(m.log.method, { method }));
  const alarmType = str(md.alarmType) ?? (e.kind.startsWith('iot_alarm.') ? str(md.type) : null);
  if (alarmType) parts.push(fill(m.log.alarmType, { type: alarmType }));
  return parts.length ? parts.join(' · ') : null;
}

export function DeviceLogTimeline({
  entries, loading = false, hasMore = false, onLoadMore, filter = 'all', onFilterChange, sources = ['connection', 'audit'], compact = false,
  auditAvailable = true, capped = null, locale, timeZone, messages, className,
}: DeviceLogTimelineProps) {
  const { m, locale: lang, timeZone: hostZone } = useIotText(messages, locale);
  const zone = timeZone ?? hostZone;
  const connectionTitles: Record<string, string> = {
    connected: m.connection.connected,
    disconnected: m.connection.disconnected,
    taken_over: m.connection.taken_over,
    last_seen_only: m.connection.last_seen_only,
  };
  const actorLine = (e: DeviceLogEntry) => {
    if (!e.actor) return m.log.bySystem;
    return e.actor.name ? fill(m.log.by, { name: e.actor.name }) : m.log.byMember;
  };

  const items: TimelineItem[] = entries.map((e) => {
    const at = toDate(e.at) ?? new Date(0);
    if (e.source === 'connection') {
      const look = CONNECTION[e.kind] ?? { icon: faCircleDot, tone: 'default' as const };
      return {
        id: e.id,
        at,
        title: connectionTitles[e.kind] ?? m.connection.other,
        body: e.remoteIp || e.reason || e.detail ? (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-text-secondary" data-source="connection">
            {e.remoteIp && <DeviceAddress ip={e.remoteIp} transport={e.transport} messages={messages} locale={locale} />}
            {!e.remoteIp && e.transport && <span>{fill(m.connection.via, { transport: e.transport })}</span>}
            {e.reason && <span>{fill(m.connection.reason, { reason: disconnectReasonText(m, e.reason) })}</span>}
            {e.detail && <code className="rounded bg-surface-sunken px-1">{e.detail}</code>}
          </span>
        ) : undefined,
        icon: <FontAwesomeIcon icon={look.icon} className="h-3 w-3" aria-hidden="true" />,
        tone: look.tone,
      };
    }
    const known = DEVICE_LOG_ACTIONS[e.kind];
    const summary = auditSummary(e, m);
    return {
      id: e.id,
      at,
      title: known ? m.log[known.title] : fill(m.log.other, { action: e.kind }),
      body: (
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-text-secondary" data-source="audit">
          <span className="text-text-primary">{actorLine(e)}</span>
          {summary && <span className="min-w-0 break-words">{summary}</span>}
        </span>
      ),
      icon: <FontAwesomeIcon icon={known?.icon ?? faPenToSquare} className="h-3 w-3" aria-hidden="true" />,
      tone: known?.tone ?? 'default',
    };
  });

  const chips: Array<{ id: DeviceLogFilter; label: string }> = [
    { id: 'all', label: m.log.all },
    ...(sources.includes('connection') ? [{ id: 'connection' as const, label: m.log.connections }] : []),
    ...(sources.includes('audit') ? [{ id: 'audit' as const, label: m.log.changes }] : []),
  ];
  const empty = filter === 'connection' ? m.log.emptyConnections : filter === 'audit' ? (auditAvailable ? m.log.emptyChanges : m.log.auditUnavailable) : m.log.empty;

  return (
    <div className={cn('space-y-3', className)}>
      {onFilterChange && !compact && chips.length > 2 && (
        <div role="group" aria-label={m.log.filter} className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              onClick={() => onFilterChange(c.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                filter === c.id ? 'border-primary bg-primary-subtle text-primary' : 'border-border text-text-secondary hover:bg-surface-overlay',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {!compact && !auditAvailable && filter !== 'connection' && sources.includes('audit') && (items.length > 0 || filter === 'all') && (
        <p role="status" className="text-xs text-text-secondary">{m.log.auditUnavailable}</p>
      )}
      <Timeline items={items} locale={lang} timeZone={zone} groupByDay={!compact} timePrecision="seconds" showTimeZone={!compact}
        emptyMessage={loading ? m.common.loading : empty} />
      {!compact && hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" loading={loading} onClick={onLoadMore}>{m.log.loadMore}</Button>
        </div>
      )}
      {!compact && !hasMore && capped !== null && capped > 0 && (
        <p className="text-center text-xs text-text-secondary">{fill(m.log.depthCap, { n: formatNumber(capped, lang, 0) })}</p>
      )}
    </div>
  );
}
