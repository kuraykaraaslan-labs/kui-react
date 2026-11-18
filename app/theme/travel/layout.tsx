'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/libs/utils/cn';
import { SkipLink } from '@/modules/ui/SkipLink';
import { Button } from '@/modules/ui/Button';
import { NavDrawer } from '@/modules/app/NavDrawer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlane,
  faHotel,
  faTicket,
  faHouse,
  faBars,
  faGlobe,
  faXmark,
  faBolt,
  faTag,
} from '@fortawesome/free-solid-svg-icons';
import {
  faXTwitter as faXTwitterBrand,
  faInstagram as faInstagramBrand,
  faFacebook as faFacebookBrand,
} from '@fortawesome/free-brands-svg-icons';

const NAV_ITEMS = [
  { label: 'Home',        href: '/theme/travel',          icon: faHouse,  exact: true  },
  { label: 'Stays',       href: '/theme/travel/hotels',   icon: faHotel,  exact: false },
  { label: 'Flights',     href: '/theme/travel/flights',  icon: faPlane,  exact: false },
  { label: 'My Bookings', href: '/theme/travel/bookings', icon: faTicket, exact: false },
];

const FOOTER_COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { label: 'Flights',          href: '/theme/travel/flights'  },
      { label: 'Hotels',           href: '/theme/travel/hotels'   },
      { label: 'Popular Deals',    href: '/theme/travel'          },
      { label: 'Last Minute',      href: '/theme/travel'          },
    ],
  },
  {
    heading: 'Destinations',
    links: [
      { label: 'Istanbul',  href: '/theme/travel' },
      { label: 'London',    href: '/theme/travel' },
      { label: 'Dubai',     href: '/theme/travel' },
      { label: 'Paris',     href: '/theme/travel' },
      { label: 'New York',  href: '/theme/travel' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us',    href: '/theme/travel' },
      { label: 'Careers',     href: '/theme/travel' },
      { label: 'Press',       href: '/theme/travel' },
      { label: 'Help Center', href: '/theme/travel' },
      { label: 'Contact',     href: '/theme/travel' },
    ],
  },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy',   href: '/theme/travel' },
  { label: 'Terms of Service', href: '/theme/travel' },
  { label: 'Cookie Settings',  href: '/theme/travel' },
];

export default function TravelThemeLayout({ children }: { children: React.ReactNode }) {
  const [promoVisible, setPromoVisible] = useState(true);
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-text-primary">
      <SkipLink href="#main-content" />

      <header className="sticky top-0 z-50">
        {/* ── Promo strip ── */}
        {promoVisible && (
          <div className="bg-primary text-primary-fg py-2 px-4 text-center text-xs sm:text-sm relative">
            <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            <strong>Flash Sale:</strong> Up to 30% off selected hotels —{' '}
            <Link href="/theme/travel/hotels" className="underline font-semibold hover:opacity-80">
              Book now
            </Link>
            <button
              type="button"
              onClick={() => setPromoVisible(false)}
              aria-label="Dismiss promotion"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-fg/80 hover:text-primary-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-fg"
            >
              <FontAwesomeIcon icon={faXmark} className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Row 1: Logo + auth ── */}
        <div className="bg-surface-base border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex items-center h-14 gap-4">

              {/* Logo */}
              <Link href="/theme/travel" className="inline-flex items-center gap-2 shrink-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
                  <FontAwesomeIcon icon={faGlobe} className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="text-lg font-extrabold tracking-tight text-text-primary hidden sm:block">
                  Voya<span className="text-primary">ger</span>
                </span>
              </Link>

              {/* Right: currency + auth + mobile menu */}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {/* Deals */}
                <Link
                  href="/theme/travel/hotels"
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-error bg-error-subtle rounded-lg hover:bg-error/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <FontAwesomeIcon icon={faTag} className="w-3 h-3" aria-hidden="true" />
                  Deals
                </Link>
                {/* Currency */}
                <select
                  aria-label="Currency"
                  className="hidden sm:block text-xs text-text-secondary bg-transparent border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-border-focus"
                >
                  <option>USD $</option>
                  <option>EUR €</option>
                  <option>GBP £</option>
                  <option>TRY ₺</option>
                </select>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign In</Button>
                <Button variant="primary" size="sm" className="hidden sm:inline-flex">Register</Button>

                {/* Mobile hamburger */}
                <div className="md:hidden">
                  <NavDrawer
                    title="Voyager"
                    side="right"
                    trigger={(
                      <Button variant="ghost" size="sm" iconOnly aria-label="Open menu">
                        <FontAwesomeIcon icon={faBars} className="w-5 h-5" aria-hidden="true" />
                      </Button>
                    )}
                  >
                    <div className="space-y-5">
                      <nav className="flex flex-col" aria-label="Mobile navigation">
                        {NAV_ITEMS.map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 px-2 py-3 text-sm font-medium rounded-lg transition-colors',
                              isActive(item.href, item.exact)
                                ? 'bg-primary-subtle text-primary'
                                : 'text-text-primary hover:bg-surface-overlay'
                            )}
                          >
                            <FontAwesomeIcon icon={item.icon} className="w-4 h-4" aria-hidden="true" />
                            {item.label}
                          </a>
                        ))}
                      </nav>
                      <div className="flex flex-col gap-2 pt-3 border-t border-border">
                        <Button variant="outline" fullWidth size="sm">Sign In</Button>
                        <Button variant="primary" fullWidth size="sm">Register</Button>
                      </div>
                    </div>
                  </NavDrawer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Category tab nav ── */}
        <div className="bg-surface-base border-b border-border shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <nav className="hidden md:flex items-end gap-0 h-11" aria-label="Category navigation">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset',
                      active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5" aria-hidden="true" />
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface-raised mt-16">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-4">
              <Link href="/theme/travel" className="inline-flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
                  <FontAwesomeIcon icon={faGlobe} className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="text-base font-extrabold tracking-tight">
                  Voya<span className="text-primary">ger</span>
                </span>
              </Link>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                Your trusted travel companion. Discover flights, hotels, and adventures around the world.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://x.com" aria-label="X (Twitter)" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faXTwitterBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="https://instagram.com" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faInstagramBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="https://facebook.com" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faFacebookBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Link columns */}
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                  {col.heading}
                </h2>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-text-secondary order-2 sm:order-1">
              &copy; {new Date().getFullYear()} Voyager Travel, Inc. All rights reserved.
            </p>
            <nav className="flex flex-wrap items-center gap-4 order-1 sm:order-2" aria-label="Legal navigation">
              {LEGAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
