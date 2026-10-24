'use client';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare, faCheck, faChevronDown, faChevronUp, faCopy } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime, formatRelative } from '../format';
import type { DeviceRecord } from '../types/device';
import { DeviceAddress } from './DeviceAddress';
import { DeviceConnectionBadge } from './DeviceConnectionBadge';
import { DeviceLogTimeline } from './DeviceLogTimeline';
import { useDeviceLog } from './useDeviceLog';

/**
 * DeviceQuickView — a device seen from its list without leaving it (NB iot_device 05 §5.3, owner request 2026-10-24): a right-side
 * drawer with the header facts (name, connection, IP address and transport, profile, firmware, last seen), the five newest log lines
 * (`DeviceLogTimeline`, compact) and the quick actions (copy ID, open the full page, open the log). ↑ / ↓ and the Previous / Next
 * buttons move to the neighbouring device of the list page without closing; Esc closes and focus goes back to the list. The host
 * (`DeviceListView`) owns which device is open, keeps it in the URL and patches it live. Latest telemetry values are not shown: the
 * adapter has no latest-values call yet; the full page has them.
 */
export type DeviceQuickViewProps = {
  open: boolean;
  deviceId: string;
  /** The device as the list shows it (live patched); null while the host reads one that is not on the page. */
  device: DeviceRecord | null;
  /** Set when the host could not read the device. */
  error?: string | null;
  onClose: () => void;
  /** Absent: no neighbour on that side (the button is disabled, the key does nothing). */
  onPrevious?: () => void;
  onNext?: () => void;
  /** Where the device sits in the list page (1-based). */
  position?: { n: number; total: number };
  /** The full device page. */
  href: string;
  profileName?: string | null;
  now?: number;
};

const RECENT = 5;

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest('input,textarea,select,[contenteditable="true"]');
}

const withTab = (href: string, tab: string) => `${href}${href.includes('?') ? '&' : '?'}tab=${tab}`;

export function DeviceQuickView({
  open, deviceId, device, error, onClose, onPrevious, onNext, position, href, profileName, now,
}: DeviceQuickViewProps) {
  const api = useIotAdapter().devices;
  const { m, locale } = useIotText();
  const [copied, setCopied] = useState(false);
  const log = useDeviceLog(api, deviceId, { pageSize: RECENT, errorText: m.detail.loadError });

  // ↑ / ↓ move through the list page while the drawer is open (it is modal: focus is inside it)
  const nav = useRef({ onPrevious, onNext });
  useEffect(() => { nav.current = { onPrevious, onNext }; });
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isEditable(e.target)) return;
      const go = e.key === 'ArrowUp' ? nav.current.onPrevious : e.key === 'ArrowDown' ? nav.current.onNext : undefined;
      if (!go) return;
      e.preventDefault();
      go();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // a new session or a disconnect writes a connection line: read the recent lines again when the live state says so
  const sessionMark = device ? `${String(device.lastConnectAt ?? '')}|${String(device.lastDisconnectAt ?? '')}` : '';
  const reload = useRef(log.reload);
  useEffect(() => { reload.current = log.reload; });
  const seenMark = useRef<{ id: string; mark: string } | null>(null);
  useEffect(() => {
    if (!device) return;
    const prev = seenMark.current;
    seenMark.current = { id: deviceId, mark: sessionMark };
    if (prev && prev.id === deviceId && prev.mark !== sessionMark) reload.current();
  }, [device, deviceId, sessionMark]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* nothing to copy into */ }
  }

  const name = device?.name ?? deviceId;
  const firmware = device ? [device.fwTitle, device.fwVersion].filter(Boolean).join(' ') : '';
  const profile = device ? (profileName ?? device.profileName ?? device.deviceProfileId) : '';
  const navButton = 'rounded p-1.5 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={fill(m.quickView.title, { name })}
      closeLabel={m.common.close}
      className="w-[28rem]"
      header={(
        <div className="flex min-w-0 items-center gap-2" data-testid="quick-view-header">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary" title={name}>{name}</h2>
          {position && <span className="shrink-0 text-xs text-text-secondary" aria-live="polite">{fill(m.quickView.position, position)}</span>}
          <button type="button" className={navButton} onClick={onPrevious} disabled={!onPrevious} aria-label={m.quickView.previous} title={m.quickView.previous}>
            <FontAwesomeIcon icon={faChevronUp} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button type="button" className={navButton} onClick={onNext} disabled={!onNext} aria-label={m.quickView.next} title={m.quickView.next}>
            <FontAwesomeIcon icon={faChevronDown} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => void copyId()} iconLeft={<FontAwesomeIcon icon={copied ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />}>
            {copied ? m.common.copied : m.device.copyId}
          </Button>
          <Button as="a" href={href} variant="primary" size="sm" iconLeft={<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" aria-hidden="true" />}>
            {m.quickView.openPage}
          </Button>
        </div>
      )}
    >
      {error && !device ? (
        <p role="alert" className="text-sm text-error">{error}</p>
      ) : !device ? (
        <SkeletonText lines={5} />
      ) : (
        <div className="space-y-5" data-device-id={deviceId}>
          <section aria-label={m.quickView.label} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <DeviceConnectionBadge online={device.online} status={device.status} lastActivityAt={device.lastActivityAt} lastDisconnectReason={device.lastDisconnectReason} now={now} />
              {device.isGateway && <Badge variant="primary" size="sm">{m.device.gateway}</Badge>}
            </div>
            {device.label && <p className="text-sm text-text-secondary">{device.label}</p>}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-secondary">{m.device.address}</dt>
              <dd className="min-w-0"><DeviceAddress ip={device.lastRemoteIp} transport={device.lastTransport} /></dd>
              <dt className="text-text-secondary">{m.device.profile}</dt>
              <dd className="min-w-0 truncate text-text-primary">{profile || '—'}</dd>
              <dt className="text-text-secondary">{m.device.firmware}</dt>
              <dd className="min-w-0 truncate text-text-primary">{firmware || '—'}</dd>
              <dt className="text-text-secondary">{m.device.lastActivity}</dt>
              <dd className="min-w-0 text-text-primary" title={formatDateTime(device.lastActivityAt, { locale })}>{formatRelative(device.lastActivityAt, { locale, now })}</dd>
            </dl>
          </section>
          <section aria-labelledby="device-quick-view-recent" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="device-quick-view-recent" className="text-sm font-semibold text-text-primary">{m.quickView.recent}</h3>
              <a href={withTab(href, 'log')} className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                {m.quickView.viewLog}
              </a>
            </div>
            {log.error && !log.entries.length
              ? <p role="alert" className="text-xs text-error">{log.error}</p>
              : <DeviceLogTimeline entries={log.entries.slice(0, RECENT)} loading={log.loading} compact />}
          </section>
          <p className="text-[11px] text-text-secondary">{m.quickView.keysHint}</p>
        </div>
      )}
    </Drawer>
  );
}
