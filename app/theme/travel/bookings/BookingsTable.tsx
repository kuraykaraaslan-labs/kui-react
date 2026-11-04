'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlane, faHotel } from '@fortawesome/free-solid-svg-icons';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { BookingStatusBadge } from '@/modules/domains/travel/booking/BookingStatusBadge';
import type { SampleBooking } from '../travel.data';

type Row = SampleBooking & Record<string, unknown>;

/** The traveller's bookings: the kit's DataTable, searchable, sortable, filterable by type and status, a page at a time. */
export function BookingsTable({ bookings }: { bookings: readonly SampleBooking[] }) {
  const columns: Column<Row>[] = [
    { key: 'bookingNumber', header: 'Booking', sortable: true, render: (b) => <span className="font-mono text-xs text-text-secondary">{b.bookingNumber}</span> },
    {
      key: 'type', header: 'Type', sortable: true, hideBelow: 'sm',
      render: (b) => (
        <span className="flex items-center gap-1.5 text-text-secondary">
          <FontAwesomeIcon icon={b.type === 'flight' ? faPlane : faHotel} className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-xs capitalize">{b.type}</span>
        </span>
      ),
    },
    { key: 'description', header: 'Details', sortable: true, render: (b) => <p className="text-text-primary font-medium line-clamp-1">{b.description}</p> },
    { key: 'traveler', header: 'Traveler', sortable: true, hideBelow: 'md' },
    { key: 'dates', header: 'Dates', hideBelow: 'lg', render: (b) => <span className="text-xs text-text-secondary">{b.dates}</span> },
    { key: 'total', header: 'Total', align: 'right', sortable: true, hideBelow: 'md', render: (b) => <span className="font-medium text-text-primary">{b.total}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (b) => <BookingStatusBadge status={b.status} size="sm" /> },
  ];
  const statuses = [...new Set(bookings.map((b) => b.status))];
  const filterFields: DataTableFilterField<Row>[] = [
    { id: 'type', label: 'Type', type: 'select', options: [{ value: 'flight', label: 'Flight' }, { value: 'hotel', label: 'Hotel' }] },
    { id: 'status', label: 'Status', type: 'checkboxes', options: statuses.map((s) => ({ value: s, label: s })) },
  ];
  return (
    <DataTable<Row>
      mode="paginated"
      caption="Bookings"
      columns={columns}
      rows={bookings as Row[]}
      rowId={(b) => b.bookingId}
      filterFields={filterFields}
      pageSize={10}
      pageSizeOptions={[10, 25, 50]}
    />
  );
}
