'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkSlash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
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
 * under it. With `onUnplace`, each row can lose its placement (the host asks first; the row's label names the device and, below the
 * asset, the node it sits on). With `onNavigate` the links open through the host's router.
 *
 * A full list on the DataTable's own toolbar: search (name, label, the node), the Filters panel (connection, devices placed below),
 * sortable columns (device, connection; one at a time), rows per page and paging. With `onQueryChange` the host serves every page
 * (`mode="manual"`, `total` rows in all; sort keys `PLACED_DEVICE_SORT_KEYS`, filter ids `online` as `true` / `false` and `recursive`,
 * a checkbox ticked at first). Without it the table does the same over `rows` in the browser.
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
  /** Remove a row's placement (the row is given so the host can name it). */
  onUnplace?: (deviceId: string, row: PlacedDevice) => void;
  busyId?: string | null;
  /** Open a link in the app (the host's router); without it the links are plain. */
  onNavigate?: (href: string) => void;
  /** With `onQueryChange`: the rows across every page. */
  total?: number;
  /** The host serves the pages: every change of page, rows per page, sort, search or filters, and the first query on mount. */
  onQueryChange?: (query: DataTableQuery) => void;
  /** The query to start from (rows per page, a sort). */
  defaultQuery?: Partial<DataTableQuery>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  now?: number;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

/** A plain left click (no modifier): the host navigates; anything else is the browser's. */
function plainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/** The columns a placed-device list sorts by on the host. */
export const PLACED_DEVICE_SORT_KEYS = ['name', 'connection'] as const;

export function PlacedDeviceTable({
  rows, assetId, deviceHref, assetHref, onUnplace, busyId, onNavigate, total, onQueryChange, defaultQuery, loading, error, onRetry, now, locale, messages, className,
}: PlacedDeviceTableProps) {
  const { m } = useIotText(messages, locale);
  const inApp = (href: string) => (onNavigate ? (e: React.MouseEvent) => { if (plainClick(e)) { e.preventDefault(); onNavigate(href); } } : undefined);
  const link = 'rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
  const columns: Column<PlacedDevice>[] = [
    {
      key: 'name',
      header: m.devices.name,
      sortable: true,
      sortValue: (r) => r.device.name,
      searchValue: (r) => `${r.device.name} ${r.device.label ?? ''} ${r.placement.name}`,
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
              ? <a href={deviceHref(d.deviceId)} onClick={inApp(deviceHref(d.deviceId))} className={cn('flex min-w-0 flex-col', link)}>{inner}</a>
              : <span className="flex min-w-0 flex-col">{inner}</span>}
            {p.assetId !== assetId && (
              <span className="mt-0.5 inline-flex min-w-0 items-center gap-1.5 text-xs text-text-secondary" title={`${m.asset.placedOn}: ${p.name}`}>
                <span className="sr-only">{m.asset.placedOn}:</span>
                <AssetKindBadge kind={p.kind} iconOnly />
                {assetHref
                  ? <a href={assetHref(p.assetId)} onClick={inApp(assetHref(p.assetId))} className={cn('truncate', link)}>{p.name}</a>
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
      sortable: true,
      searchable: false,
      // online first, then the most recently active
      sortValue: (r) => (r.device.online ? 0 : 1) * 1e15 - (r.device.lastActivityAt ? new Date(r.device.lastActivityAt).getTime() : 0),
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
      searchable: false,
      render: (r: PlacedDevice) => (
        <Button
          variant="ghost"
          size="xs"
          iconOnly
          loading={busyId === r.device.deviceId}
          aria-label={`${m.asset.unplace}: ${r.device.name}${r.placement.assetId !== assetId ? ` (${r.placement.name})` : ''}`}
          title={m.asset.unplace}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onUnplace(r.device.deviceId, r); }}
        >
          <FontAwesomeIcon icon={faLinkSlash} className="h-3 w-3" aria-hidden="true" />
        </Button>
      ),
    }] : []),
  ];
  const filterFields: DataTableFilterField<PlacedDevice>[] = [
    {
      id: 'online', label: m.devices.connection, type: 'select',
      options: [{ value: 'true', label: m.device.online }, { value: 'false', label: m.device.offline }],
      match: (r, v) => !v || String(r.device.online === true) === v,
    },
    ...(onQueryChange ? [{ id: 'recursive', label: m.asset.recursive, type: 'checkbox' as const, defaultValue: true }] : []),
  ];
  return (
    <DataTable<PlacedDevice>
      {...(onQueryChange
        ? { mode: 'manual' as const, total: total ?? rows.length, onQueryChange, loading, error: error || undefined }
        : { mode: 'paginated' as const, state: error ? 'error' as const : loading && !rows.length ? 'loading' as const : undefined, errorMessage: error || undefined })}
      variant="plain"
      className={className}
      caption={m.asset.devices}
      columns={columns}
      rows={rows}
      defaultQuery={defaultQuery}
      multiSort={false}
      searchPlaceholder={m.asset.searchDevices}
      filterFields={filterFields}
      pageSize={defaultQuery?.pageSize ?? 10}
      pageSizeOptions={LIST_PAGE_SIZES}
      rowId={(r) => r.device.deviceId}
      onRetry={onRetry}
      emptyMessage={m.asset.noDevices}
      messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
      keyboardNavigation
    />
  );
}
