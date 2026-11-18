'use client';
import Link from 'next/link';
import { SkipLink } from '@/modules/ui/SkipLink';
import { Button } from '@/modules/ui/Button';
import { NavDrawer } from '@/modules/app/NavDrawer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUtensils,
  faStore,
  faClipboardList,
  faCartShopping,
  faBars,
  faMagnifyingGlass,
  faLocationDot,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { faInstagram, faXTwitter as faXTwitterBrand } from '@fortawesome/free-brands-svg-icons';

const CART_ITEM_COUNT = 2;

const NAV_ITEMS = [
  { label: 'Home',        href: '/theme/food',              icon: faUtensils },
  { label: 'Restaurants', href: '/theme/food/restaurants',  icon: faStore },
  { label: 'Orders',      href: '/theme/food/orders',       icon: faClipboardList },
  { label: 'Cart',        href: '/theme/food/cart',         icon: faCartShopping },
];

const CUISINE_LINKS = [
  { label: 'Italian',  href: '/theme/food/cuisines/italian' },
  { label: 'Japanese', href: '/theme/food/cuisines/japanese' },
  { label: 'Turkish',  href: '/theme/food/cuisines/turkish' },
];

const FOOTER_COLUMNS = [
  {
    heading: 'Discover',
    links: [
      { label: 'All Restaurants', href: '/theme/food/restaurants' },
      { label: 'Italian',         href: '/theme/food/cuisines/italian' },
      { label: 'Japanese',        href: '/theme/food/cuisines/japanese' },
      { label: 'Turkish',         href: '/theme/food/cuisines/turkish' },
      { label: 'Vegan Options',   href: '/theme/food/restaurants' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'My Orders',       href: '/theme/food/orders' },
      { label: 'Saved Addresses', href: '/theme/food' },
      { label: 'Payment Methods', href: '/theme/food' },
      { label: 'Profile',         href: '/theme/food' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us',   href: '/theme/food' },
      { label: 'Blog',       href: '/theme/food' },
      { label: 'Careers',    href: '/theme/food' },
      { label: 'Contact',    href: '/theme/food' },
    ],
  },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy',   href: '/theme/food' },
  { label: 'Terms of Service', href: '/theme/food' },
  { label: 'Cookie Settings',  href: '/theme/food' },
];

export default function FoodThemeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-text-primary">
      <SkipLink href="#main-content" />

      <header className="sticky top-0 z-50 shadow-sm">
        {/* Brand + Nav row */}
        <div className="bg-[var(--surface-base)] border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex items-center gap-4 h-16">
              {/* Logo */}
              <Link href="/theme/food" className="inline-flex items-center gap-2 shrink-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
                  <FontAwesomeIcon icon={faUtensils} className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="text-base font-extrabold tracking-tight text-text-primary hidden sm:block">
                  Yum<span className="text-primary">Dash</span>
                </span>
              </Link>

              {/* Delivery address chip */}
              <button
                type="button"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-raised text-sm text-text-primary hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                aria-label="Change delivery address"
              >
                <FontAwesomeIcon icon={faLocationDot} className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span className="font-medium">New York, NY</span>
                <FontAwesomeIcon icon={faChevronDown} className="w-2.5 h-2.5 text-text-secondary" aria-hidden="true" />
              </button>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Primary navigation">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary-subtle rounded-lg transition-colors"
                  >
                    <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5" aria-hidden="true" />
                    {item.label}
                  </a>
                ))}
              </nav>

              {/* Desktop search */}
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 w-52 focus-within:ring-2 focus-within:ring-border-focus transition-shadow">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search…"
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
                  aria-label="Search restaurants"
                />
              </div>

              {/* Cart + mobile hamburger */}
              <div className="ml-auto md:ml-0 flex items-center gap-2 shrink-0">
                {/* Cart with badge */}
                <Link
                  href="/theme/food/cart"
                  className="relative hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  aria-label={`Cart, ${CART_ITEM_COUNT} items`}
                >
                  <FontAwesomeIcon icon={faCartShopping} className="w-4 h-4" aria-hidden="true" />
                  <span>Cart</span>
                  {CART_ITEM_COUNT > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-fg text-[10px] font-bold" aria-hidden="true">
                      {CART_ITEM_COUNT}
                    </span>
                  )}
                </Link>

                {/* Mobile hamburger */}
                <div className="md:hidden">
                  <NavDrawer
                    title="YumDash"
                    side="right"
                    trigger={(
                      <Button variant="ghost" size="sm" iconOnly aria-label="Open menu">
                        <FontAwesomeIcon icon={faBars} className="w-5 h-5" aria-hidden="true" />
                      </Button>
                    )}
                  >
                    <div className="space-y-5">
                      {/* Mobile search */}
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
                        <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 text-text-secondary" aria-hidden="true" />
                        <input
                          type="search"
                          placeholder="Search restaurants…"
                          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
                        />
                      </div>

                      <nav className="flex flex-col" aria-label="Mobile navigation">
                        {NAV_ITEMS.map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            className="flex items-center gap-3 px-2 py-3 text-sm font-medium text-text-primary hover:bg-surface-overlay rounded-lg transition-colors"
                          >
                            <FontAwesomeIcon icon={item.icon} className="w-4 h-4 text-text-secondary" aria-hidden="true" />
                            {item.label}
                          </a>
                        ))}
                      </nav>

                      <div className="pt-3 border-t border-border">
                        <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                          Cuisines
                        </p>
                        <nav className="flex flex-col" aria-label="Mobile cuisines">
                          {CUISINE_LINKS.map((c) => (
                            <a
                              key={c.label}
                              href={c.href}
                              className="flex items-center gap-3 px-2 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-overlay rounded-lg transition-colors"
                            >
                              {c.label}
                            </a>
                          ))}
                        </nav>
                      </div>
                    </div>
                  </NavDrawer>
                </div>
              </div>
            </div>
          </div>

          {/* Cuisine quick-links */}
          <div className="hidden md:block border-t border-border bg-surface-raised">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <nav className="flex items-center gap-1 py-2 overflow-x-auto" aria-label="Cuisine quick links">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary mr-3 shrink-0">
                  Cuisines
                </span>
                {CUISINE_LINKS.map((c) => (
                  <a
                    key={c.label}
                    href={c.href}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-primary hover:bg-primary-subtle rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus whitespace-nowrap"
                  >
                    {c.label}
                  </a>
                ))}
              </nav>
            </div>
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
              <Link href="/theme/food" className="inline-flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
                  <FontAwesomeIcon icon={faUtensils} className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="text-base font-extrabold tracking-tight">
                  Yum<span className="text-primary">Dash</span>
                </span>
              </Link>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                Your favourite food, delivered fast. Hundreds of restaurants, one app.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://x.com" aria-label="X (Twitter)" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faXTwitterBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="https://instagram.com" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faInstagram} className="w-3.5 h-3.5" aria-hidden="true" />
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
              &copy; {new Date().getFullYear()} YumDash, Inc. All rights reserved.
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
