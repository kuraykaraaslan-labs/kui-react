'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkSlash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableQuery } from '@/modules/ui/Table/types';
import { useIotText } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { DeviceAddress } from '../device/DeviceAddress';
import { DeviceOnlineDot } from '../device/DeviceOnlineDot';
import type { IotMessagesInput } from '../messages';
import type { PlacedDevice } from '../types/asset';
import { onlineStateOf } from '../types/device';
import { AssetKindBadge } from './AssetKindBadge';

/**
 * PlacedDeviceTable — the devices placed under an asset (phase 08 §8.2): the device (a link) with the node it sits on under its name
 * when that is a descendant, and its connection (`DeviceOnlineDot`, OD-57) with the address of its newest connect (`DeviceAddress`)
 * under it. With `onUnplace`, each row can lose its placement. With `paging` the rows are one page of `total` and the table's own
 * pagination and rows per page move through them (the host reads each page).
 *
 * Its host is a drawer (`AssetDrawer`, 40rem), narrow at any screen width, so the table keeps to two columns and the actions, and
 * caps its texts (each in full in its tooltip): a column hidden below a screen breakpoint would still show in a narrow drawer on a
 * wide screen. On a phone the connection is the dot alone (its text is the tooltip and for screen readers) and the address goes.
 */
export type PlacedDeviceTableProps = {
  rows: PlacedDevice[];
  /** The asset the table is about: a device placed on it directly shows no "placed on" cell. */
  assetId?: string;
  deviceHref?: (deviceId: string) => string;
  assetHref?: (assetId: string) => string;
  onUnplace?: (deviceId: string) => void;
  busyId?: string | null;
  /** Server paging: the page shown, its size and every row's count; `onChange` reads another page or size. */
  paging?: { page: number; pageSize: number; total: number; onChange: (page: number, pageSize: number) => void };
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  now?: number;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function PlacedDeviceTable({
  rows, assetId, deviceHref, assetHref, onUnplace, busyId, paging, loading, error, onRetry, now, locale, messages, className,
}: PlacedDeviceTableProps) {
  const { m } = useIotText(messages, locale);
  const link = 'rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
  const columns: Column<PlacedDevice>[] = [
    {
      key: 'name',
      header: m.devices.name,
      render: ({ device: d, placement: p }) => {
        const inner = (
          <>
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-text-primary">
              <span className="truncate" title={d.name}>{d.name}</span>
              {d.isGateway && <Badge variant="primary" size="sm">{m.device.gateway}</Badge>}
            </span>
            {d.label && <span className="truncate text-xs text-text-secondary" title={d.label}>{d.label}</span>}
          </>
        );
        return (
          <span className="flex min-w-0 max-w-[8rem] flex-col sm:max-w-[16rem]">
            {deviceHref
              ? <a href={deviceHref(d.deviceId)} className={cn('flex min-w-0 flex-col', link)}>{inner}</a>
              : <span className="flex min-w-0 flex-col">{inner}</span>}
            {p.assetId !== assetId && (
              <span className="mt-0.5 inline-flex min-w-0 items-center gap-1.5 text-xs text-text-secondary" title={`${m.asset.placedOn}: ${p.name}`}>
                <span className="sr-only">{m.asset.placedOn}:</span>
                <AssetKindBadge kind={p.kind} iconOnly />
                {assetHref
                  ? <a href={assetHref(p.assetId)} className={cn('truncate', link)}>{p.name}</a>
                  : <span className="truncate">{p.name}</span>}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'connection',
      header: m.devices.connection,
      render: ({ device: d }) => (
        <span className="flex min-w-0 flex-col gap-0.5 sm:max-w-[13rem]">
          <DeviceOnlineDot state={onlineStateOf(d.online)} lastSeenAt={d.lastActivityAt} now={now} compact className="sm:hidden" />
          <DeviceOnlineDot state={onlineStateOf(d.online)} lastSeenAt={d.lastActivityAt} now={now} className="hidden sm:inline-flex" />
          {d.lastRemoteIp && <DeviceAddress ip={d.lastRemoteIp} transport={d.lastTransport} className="hidden sm:inline-flex" />}
        </span>
      ),
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
      total={paging?.total}
      query={paging ? { page: paging.page, pageSize: paging.pageSize } : undefined}
      onQueryChange={paging ? (q: DataTableQuery) => { if (q.page !== paging.page || q.pageSize !== paging.pageSize) paging.onChange(q.page, q.pageSize); } : undefined}
      pageSizeOptions={paging ? LIST_PAGE_SIZES : []}
      rowId={(r) => r.device.deviceId}
      loading={loading}
      error={error || undefined}
      onRetry={onRetry}
      emptyMessage={m.asset.noDevices}
      messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
      searchable={false}
      keyboardNavigation
    />
  );
}
