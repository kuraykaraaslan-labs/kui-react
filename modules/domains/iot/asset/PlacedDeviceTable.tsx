'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkSlash } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { useIotText } from '../api/IotAdapterProvider';
import { DeviceAddress } from '../device/DeviceAddress';
import { DeviceOnlineDot } from '../device/DeviceOnlineDot';
import type { IotMessagesInput } from '../messages';
import type { PlacedDevice } from '../types/asset';
import { onlineStateOf } from '../types/device';
import { AssetKindBadge } from './AssetKindBadge';

/**
 * PlacedDeviceTable — the devices placed under an asset (phase 08 §8.2): the device (a link), its connection (`DeviceOnlineDot`, OD-57)
 * and the address of its newest connect (`DeviceAddress`), and the node it sits on when that is a descendant. With `onUnplace`, each
 * row can lose its placement.
 */
export type PlacedDeviceTableProps = {
  rows: PlacedDevice[];
  /** The asset the table is about: a device placed on it directly shows no "placed on" cell. */
  assetId?: string;
  deviceHref?: (deviceId: string) => string;
  assetHref?: (assetId: string) => string;
  onUnplace?: (deviceId: string) => void;
  busyId?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  now?: number;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function PlacedDeviceTable({
  rows, assetId, deviceHref, assetHref, onUnplace, busyId, loading, error, onRetry, now, locale, messages, className,
}: PlacedDeviceTableProps) {
  const { m } = useIotText(messages, locale);
  const columns: Column<PlacedDevice>[] = [
    {
      key: 'name',
      header: m.devices.name,
      render: ({ device: d }) => {
        const inner = (
          <>
            <span className="flex items-center gap-1.5 truncate font-medium text-text-primary">
              {d.name}
              {d.isGateway && <Badge variant="primary" size="sm">{m.device.gateway}</Badge>}
            </span>
            {d.label && <span className="truncate text-xs text-text-secondary">{d.label}</span>}
          </>
        );
        return deviceHref
          ? <a href={deviceHref(d.deviceId)} className="flex min-w-0 flex-col rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{inner}</a>
          : <span className="flex min-w-0 flex-col">{inner}</span>;
      },
    },
    {
      key: 'connection',
      header: m.devices.connection,
      render: ({ device: d }) => <DeviceOnlineDot state={onlineStateOf(d.online)} lastSeenAt={d.lastActivityAt} now={now} />,
    },
    { key: 'address', header: m.devices.address, hideBelow: 'md', render: ({ device: d }) => <DeviceAddress ip={d.lastRemoteIp} transport={d.lastTransport} /> },
    {
      key: 'placement',
      header: m.asset.placedOn,
      hideBelow: 'sm',
      render: ({ placement: p }) => (p.assetId === assetId ? <span className="text-text-secondary">—</span> : (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <AssetKindBadge kind={p.kind} iconOnly />
          {assetHref
            ? <a href={assetHref(p.assetId)} className="truncate text-sm text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{p.name}</a>
            : <span className="truncate text-sm">{p.name}</span>}
        </span>
      )),
    },
    ...(onUnplace ? [{
      key: 'actions',
      header: <span className="sr-only">{m.asset.unplace}</span>,
      align: 'right' as const,
      render: ({ device: d }: PlacedDevice) => (
        <Button
          variant="ghost"
          size="xs"
          iconOnly
          loading={busyId === d.deviceId}
          aria-label={`${m.asset.unplace}: ${d.name}`}
          title={m.asset.unplace}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onUnplace(d.deviceId); }}
        >
          <FontAwesomeIcon icon={faLinkSlash} className="h-3 w-3" aria-hidden="true" />
        </Button>
      ),
    }] : []),
  ];
  return (
    <DataTable<PlacedDevice>
      mode="manual"
      variant="plain"
      className={className}
      caption={m.asset.devices}
      columns={columns}
      rows={rows}
      rowId={(r) => r.device.deviceId}
      loading={loading}
      error={error || undefined}
      onRetry={onRetry}
      emptyMessage={m.asset.noDevices}
      messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
      searchable={false}
      pageSizeOptions={[]}
      keyboardNavigation
    />
  );
}
