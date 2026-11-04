import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTicket } from '@fortawesome/free-solid-svg-icons';
import { SAMPLE_BOOKINGS } from '../travel.data';
import { BookingsTable } from './BookingsTable';

export const metadata: Metadata = {
  title: buildPageTitle('Bookings', THEME_TITLES['travel']),
};

export default function BookingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <FontAwesomeIcon icon={faTicket} className="w-5 h-5 text-primary" aria-hidden="true" />
          My Bookings
        </h1>
        <p className="mt-1 text-text-secondary text-sm">Manage your upcoming and past travel</p>
      </div>

      {/* Bookings: the kit's DataTable (search, sort, filters, paging) */}
      <BookingsTable bookings={SAMPLE_BOOKINGS} />

      {/* Empty state hint */}
      <p className="text-xs text-text-secondary mt-4 text-center">
        Showing {SAMPLE_BOOKINGS.length} booking{SAMPLE_BOOKINGS.length !== 1 ? 's' : ''}. Book a flight or hotel to see more.
      </p>
    </div>
  );
}
