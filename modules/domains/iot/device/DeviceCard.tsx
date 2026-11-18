'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrochip,
  faNetworkWired,
  faLocationDot,
  faClock,
  faCircleNodes,
} from '@fortawesome/free-solid-svg-icons';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { DeviceTypeBadge } from './DeviceTypeBadge';
import type { Device } from '../types';

type DeviceCardProps = {
  device: Device;
  className?: string;
  onClick?: () => void;
};

function formatLastSeen(date: Date | null | undefined): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DeviceCard({ device, className, onClick }: DeviceCardProps) {
  const roleIcon = device.role === 'GATEWAY' ? faCircleNodes : faMicrochip;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-border bg-surface-base p-4',
        'transition-shadow hover:shadow-md',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
            <FontAwesomeIcon icon={roleIcon} className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{device.name}</p>
            {device.model && (
              <p className="truncate text-xs text-text-secondary">{device.model}</p>
            )}
          </div>
        </div>
        <DeviceStatusBadge status={device.status} size="sm" />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faNetworkWired} className="w-3 h-3" aria-hidden="true" />
          <DeviceTypeBadge type={device.type} size="sm" />
        </span>
        {device.location?.label && (
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faLocationDot} className="w-3 h-3" aria-hidden="true" />
            {device.location.label}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faClock} className="w-3 h-3" aria-hidden="true" />
          {formatLastSeen(device.lastSeenAt)}
        </span>
      </div>

      {/* Tags */}
      {device.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {device.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-surface-overlay px-2 py-0.5 text-xs text-[color-mix(in_srgb,var(--text-secondary)_75%,var(--text-primary))]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Firmware */}
      {device.firmware && (
        <p className="text-xs text-text-secondary border-t border-border pt-2">
          Firmware: <span className="font-mono">{device.firmware}</span>
        </p>
      )}
    </div>
  );
}
