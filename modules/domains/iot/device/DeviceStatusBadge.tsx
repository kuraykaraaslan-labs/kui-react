'use client';
import { Badge } from '@/modules/ui/Badge';
import type { DeviceStatus } from '../types';

/**
 * DeviceStatusBadge — the demo's operational status. OD-1 (owner, 2026-10-04): a `QUARANTINED` state, "waiting for activation —
 * data is not stored"; `DeviceConnectionBadge` shows the same state for the platform's devices.
 */
type DeviceStatusBadgeStatus = DeviceStatus | 'QUARANTINED';

const statusMeta: Record<DeviceStatusBadgeStatus, { label: string; variant: 'success' | 'error' | 'warning' | 'neutral'; title?: string }> = {
  ONLINE:      { label: 'Online',      variant: 'success' },
  OFFLINE:     { label: 'Offline',     variant: 'neutral' },
  ERROR:       { label: 'Error',       variant: 'error' },
  MAINTENANCE: { label: 'Maintenance', variant: 'warning' },
  QUARANTINED: { label: 'Quarantined', variant: 'warning', title: 'Waiting for activation: data is not stored. Counts toward your device limit.' },
};

type DeviceStatusBadgeProps = { status: DeviceStatusBadgeStatus; size?: 'sm' | 'md'; className?: string };

export function DeviceStatusBadge({ status, size = 'md', className }: DeviceStatusBadgeProps) {
  const meta = statusMeta[status] ?? { label: status, variant: 'neutral' as const };
  return (
    <Badge variant={meta.variant} size={size} dot className={className} title={meta.title}>
      {meta.label}
    </Badge>
  );
}
