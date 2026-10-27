'use client';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { Button } from '@/modules/ui/Button';
import { FlightCard } from '@/modules/domains/travel/flight/FlightCard';
import { HotelCard } from '@/modules/domains/travel/hotel/HotelCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlane, faHotel, faArrowRight, faLocationDot,
  faCalendar, faUsers, faMagnifyingGlass,
  faStar, faCircleCheck, faHeadset, faShield,
  faBolt, faPercent,
} from '@fortawesome/free-solid-svg-icons';
import { FLIGHTS, HOTELS, POPULAR_DESTINATIONS } from './travel.data';

const TRUST_STATS = [
  { icon: faStar,         stat: '5M+',  label: 'Verified reviews'     },
  { icon: faHotel,        stat: '1M+',  label: 'Properties worldwide' },
  { icon: faShield,       stat: '100%', label: 'Secure payments'      },
  { icon: faHeadset,      stat: '24/7', label: 'Customer support'     },
];

const DEAL_BADGES = ['Save 25%', 'Save 20%', undefined, undefined];

export default function TravelHomePage() {
  const [activeTab, setActiveTab] = useState<'stays' | 'flights'>('stays');

  const featuredHotels = HOTELS.slice(0, 4);
  const featuredFlights = FLIGHTS.slice(0, 3);

  return (
    <div className="bg-surface-base text-text-primary">
      <DocumentTitle text={THEME_TITLES['travel']} absolute />

      {/* ── Hero ── */}
      <section className="relative flex items-end justify-center overflow-hidden" style={{ minHeight: '520px' }}>
        <img
          src="https://picsum.photos/seed/travel-hero/1600/700"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/75" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 text-center pb-0">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-3">
            Find your perfect stay
          </h1>
          <p className="text-white/85 text-lg mb-8">
            Compare prices from 100+ booking sites — in seconds
          </p>

          {/* Search card — tabs sit flush on the bottom of the hero */}
          <div className="bg-surface-base rounded-t-2xl shadow-2xl overflow-hidden">
            {/* Tab row */}
            <div className="flex border-b border-border px-3 pt-2 gap-1">
              {(['stays', 'flights'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-lg border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus capitalize',
                    activeTab === tab
                      ? 'border-primary text-primary bg-primary-subtle'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  )}
                >
                  <FontAwesomeIcon icon={tab === 'stays' ? faHotel : faPlane} className="w-4 h-4" aria-hidden="true" />
                  {tab === 'stays' ? 'Stays' : 'Flights'}
                </button>
              ))}
            </div>

            {/* Search fields */}
            <div className="p-4">
              {activeTab === 'stays' ? (
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-[2] min-w-[200px]">
                    <FontAwesomeIcon icon={faLocationDot} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <input
                      type="text"
                      placeholder="Where are you going?"
                      className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus"
                      aria-label="Destination"
                    />
                  </div>
                  <div className="relative min-w-[152px]">
                    <FontAwesomeIcon icon={faCalendar} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <input type="date" aria-label="Check-in date" className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus" />
                  </div>
                  <div className="relative min-w-[152px]">
                    <FontAwesomeIcon icon={faCalendar} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <input type="date" aria-label="Check-out date" className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus" />
                  </div>
                  <div className="relative min-w-[160px]">
                    <FontAwesomeIcon icon={faUsers} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <select aria-label="Guests" className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary appearance-none focus:outline-none focus:ring-2 focus:ring-border-focus">
                      <option>2 adults · 0 children</option>
                      <option>1 adult · 0 children</option>
                      <option>2 adults · 1 child</option>
                      <option>2 adults · 2 children</option>
                    </select>
                  </div>
                  <Button
                    as="a"
                    href="/theme/travel/hotels"
                    variant="primary"
                    size="lg"
                    iconLeft={<FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4" aria-hidden="true" />}
                    className="px-8"
                  >
                    Search
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[160px]">
                    <FontAwesomeIcon icon={faLocationDot} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <input type="text" placeholder="From — city or airport" className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus" aria-label="Origin" />
                  </div>
                  <div className="relative flex-1 min-w-[160px]">
                    <FontAwesomeIcon icon={faLocationDot} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <input type="text" placeholder="To — city or airport" className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus" aria-label="Destination" />
                  </div>
                  <div className="relative min-w-[152px]">
                    <FontAwesomeIcon icon={faCalendar} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <input type="date" aria-label="Departure date" className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus" />
                  </div>
                  <div className="relative min-w-[148px]">
                    <FontAwesomeIcon icon={faUsers} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" aria-hidden="true" />
                    <select aria-label="Passengers" className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface-base text-sm text-text-primary appearance-none focus:outline-none focus:ring-2 focus:ring-border-focus">
                      <option>1 adult</option>
                      <option>2 adults</option>
                      <option>3 adults</option>
                      <option>2 adults · 1 child</option>
                    </select>
                  </div>
                  <Button
                    as="a"
                    href="/theme/travel/flights"
                    variant="primary"
                    size="lg"
                    iconLeft={<FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4" aria-hidden="true" />}
                    className="px-8"
                  >
                    Search
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Stats ── */}
      <section className="bg-surface-raised border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUST_STATS.map(({ icon, stat, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <FontAwesomeIcon icon={icon} className="w-4 h-4 text-primary" aria-hidden="true" />
                <span className="font-bold text-text-primary">{stat}</span>
                <span className="text-text-secondary">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular Destinations ── */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Popular Destinations</h2>
        <p className="text-sm text-text-secondary mb-6">Trending cities travelers are searching right now</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {POPULAR_DESTINATIONS.map((dest) => (
            <Link
              key={dest.code}
              href="/theme/travel/hotels"
              className="relative rounded-xl overflow-hidden h-40 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <img
                src={dest.imageUrl}
                alt={dest.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white font-bold text-sm leading-tight">{dest.name}</p>
                <p className="text-white/70 text-xs">{dest.hotelCount.toLocaleString()} hotels</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Hot Deals ── */}
      <section className="bg-surface-raised border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faBolt} className="w-5 h-5 text-warning" aria-hidden="true" />
              <h2 className="text-2xl font-bold text-text-primary">Hot Deals</h2>
              <span className="text-xs bg-warning text-white px-2 py-0.5 rounded-full font-bold tracking-wide">LIMITED</span>
            </div>
            <Link href="/theme/travel/hotels" className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
              See all deals
              <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredHotels.map((hotel, i) => (
              <HotelCard
                key={hotel.hotelId}
                hotel={hotel}
                href={`/theme/travel/hotels/${hotel.slug}`}
                dealBadge={DEAL_BADGES[i]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Flights ── */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Cheapest Flights This Week</h2>
            <p className="text-sm text-text-secondary mt-1">Best fares found across all airlines</p>
          </div>
          <Link href="/theme/travel/flights" className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
            All flights
            <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredFlights.map((flight) => (
            <FlightCard
              key={flight.flightId}
              flight={flight}
              href={`/theme/travel/flights/${flight.flightId}`}
            />
          ))}
        </div>
      </section>

      {/* ── Members CTA ── */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-2xl bg-primary px-8 py-12 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 mb-4">
              <FontAwesomeIcon icon={faPercent} className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              <span className="text-white text-xs font-bold tracking-widest uppercase">Member Exclusive</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-primary-fg leading-tight">
              Save up to 30% on your next trip
            </h2>
            <p className="text-primary-fg/80 text-sm mt-2 max-w-md leading-relaxed">
              Join millions of travelers. Unlock member-only prices, free cancellation deals, and instant price alerts.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <input
              type="email"
              placeholder="your@email.com"
              className="px-4 py-2.5 rounded-lg text-sm text-text-primary bg-surface-base focus:outline-none focus:ring-2 focus:ring-border-focus min-w-[200px]"
              aria-label="Email address"
            />
            <Button variant="accent" size="md">
              <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Join Free
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
