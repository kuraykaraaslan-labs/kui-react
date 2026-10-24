'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBarcode, faCircleNodes, faCodeBranch, faLayerGroup, faMicrochip, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { useIotText } from '../api/IotAdapterProvider';
import type { DeviceRecord } from '../types/device';
import type { IotMessagesInput } from '../messages';
import { DeviceAddress } from './DeviceAddress';
import { DeviceConnectionBadge } from './DeviceConnectionBadge';

/**
 * DeviceDetailHeader — a device page's header: name and label, connection badge (quarantined / disabled win, OD-1),
 * gateway tag, serial, profile (a link when `profileHref` is given), firmware and protocol, and an `actions` slot the host
 * fills (Activate, Release device, delete, copy id). There is no factory-reset action anywhere (OD-8): the slot is the
 * only place actions come from.
 */
export type DeviceDetailHeaderProps = {
  device: Pick<DeviceRecord, 'name' | 'label' | 'serial' | 'status' | 'online' | 'isGateway' | 'fwTitle' | 'fwVersion' | 'protocolMajor' | 'profileName' | 'deviceProfileId' | 'lastActivityAt' | 'lastDisconnectReason' | 'lastRemoteIp' | 'lastTransport'>;
  profileHref?: string;
  actions?: React.ReactNode;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

export function DeviceDetailHeader({ device, profileHref, actions, locale, now, messages, className }: DeviceDetailHeaderProps) {
  const { m } = useIotText(messages, locale);
  const firmware = [device.fwTitle, device.fwVersion].filter(Boolean).join(' ');
  const profile = device.profileName ?? device.deviceProfileId;
  return (
    <section
      aria-label={device.name}
      className={cn('rounded-xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FontAwesomeIcon icon={device.isGateway ? faCircleNodes : faMicrochip} className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            <h1 className="break-words text-xl font-bold leading-snug text-text-primary">{device.name}</h1>
            <DeviceConnectionBadge
              online={device.online}
              status={device.status}
              lastActivityAt={device.lastActivityAt}
              lastDisconnectReason={device.lastDisconnectReason}
              locale={locale}
              now={now}
              messages={messages}
            />
            {device.isGateway && <Badge variant="primary" size="sm">{m.device.gateway}</Badge>}
          </div>
          {device.label && <p className="mt-1 text-sm text-text-secondary">{device.label}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Meta icon={faBarcode} term={m.device.serial} value={device.serial ? <code className="font-mono text-text-primary">{device.serial}</code> : '—'} />
        <Meta
          icon={faLayerGroup}
          term={m.device.profile}
          value={profileHref ? (
            <a href={profileHref} className="rounded font-medium text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{profile}</a>
          ) : <span className="font-medium text-text-primary">{profile}</span>}
        />
        <Meta icon={faCodeBranch} term={m.device.firmware} value={firmware ? <span className="text-text-primary">{firmware}</span> : '—'} />
        <Meta icon={faMicrochip} term={m.device.protocol} value={device.protocolMajor != null ? <span className="text-text-primary">v{device.protocolMajor}</span> : '—'} />
        <Meta icon={faNetworkWired} term={m.device.address} value={<DeviceAddress ip={device.lastRemoteIp} transport={device.lastTransport} locale={locale} messages={messages} />} />
      </dl>
    </section>
  );
}

function Meta({ icon, term, value }: { icon: Parameters<typeof FontAwesomeIcon>[0]['icon']; term: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <dt>{term}:</dt>
      <dd className="min-w-0 truncate">{value}</dd>
    </div>
  );
}
