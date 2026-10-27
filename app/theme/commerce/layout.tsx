'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SkipLink } from '@/modules/ui/SkipLink';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShoppingCart,
  faBars,
  faMagnifyingGlass,
  faXmark,
  faHeart,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { faXTwitter as faXTwitterBrand, faInstagram as faInstagramBrand, faPinterest as faPinterestBrand } from '@fortawesome/free-brands-svg-icons';
import { CART_ITEMS } from './commerce.data';

const NAV_LINKS = [
  { label: 'Home',     href: '/theme/commerce' },
  { label: 'Products', href: '/theme/commerce/products' },
  { label: 'Deals',    href: '/theme/commerce/products' },
  { label: 'Orders',   href: '/theme/commerce/orders' },
];

const FOOTER_COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { label: 'All Products',     href: '/theme/commerce/products' },
      { label: 'Electronics',      href: '/theme/commerce/products' },
      { label: 'Clothing',         href: '/theme/commerce/products' },
      { label: 'Software',         href: '/theme/commerce/products' },
      { label: 'Books',            href: '/theme/commerce/products' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'My Orders',  href: '/theme/commerce/orders' },
      { label: 'My Cart',    href: '/theme/commerce/cart' },
      { label: 'Wishlist',   href: '/theme/commerce' },
      { label: 'Profile',    href: '/theme/commerce' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'FAQ',          href: '/theme/commerce' },
      { label: 'Shipping',     href: '/theme/commerce' },
      { label: 'Returns',      href: '/theme/commerce' },
      { label: 'Track Order',  href: '/theme/commerce' },
      { label: 'Contact Us',   href: '/theme/commerce' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us',         href: '/theme/commerce' },
      { label: 'Blog',             href: '/theme/commerce' },
      { label: 'Careers',          href: '/theme/commerce' },
      { label: 'Privacy Policy',   href: '/theme/commerce' },
      { label: 'Terms of Service', href: '/theme/commerce' },
    ],
  },
];

export default function CommerceThemeLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const cartCount = CART_ITEMS.length;

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-text-primary">
      <SkipLink href="#main-content" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[var(--success-fg)] shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center h-16 gap-4">

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded text-[var(--text-inverse)] hover:bg-[var(--success)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-inverse)]"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <FontAwesomeIcon icon={mobileOpen ? faXmark : faBars} className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Logo */}
            <Link href="/theme/commerce" className="shrink-0 text-xl font-extrabold tracking-tight text-[var(--text-inverse)]">
              Shop<span className="text-[var(--warning)]">Flow</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 ml-6" aria-label="Main navigation">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="px-3 py-2 rounded text-sm font-medium text-[var(--text-inverse)]/80 hover:text-[var(--text-inverse)] hover:bg-[var(--success)] transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex-1" />

            {/* Search bar — expands on desktop */}
            {searchOpen ? (
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="flex flex-1 items-center rounded-lg bg-[var(--text-inverse)] px-3 py-1.5 shadow-inner">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="w-3.5 h-3.5 text-text-secondary shrink-0 mr-2" aria-hidden="true" />
                  <input
                    autoFocus
                    type="search"
                    placeholder="Search products…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
                    aria-label="Search products"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-[var(--text-inverse)]/70 hover:text-[var(--text-inverse)] transition-colors"
                  aria-label="Close search"
                >
                  <FontAwesomeIcon icon={faXmark} className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded text-[var(--text-inverse)]/80 hover:text-[var(--text-inverse)] hover:bg-[var(--success)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-inverse)]"
                aria-label="Open search"
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
            )}

            {/* Wishlist */}
            <button
              type="button"
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded text-[var(--text-inverse)]/80 hover:text-[var(--text-inverse)] hover:bg-[var(--success)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-inverse)]"
              aria-label="Wishlist"
            >
              <FontAwesomeIcon icon={faHeart} className="w-4.5 h-4.5" aria-hidden="true" />
            </button>

            {/* Account */}
            <button
              type="button"
              className="hidden md:flex items-center justify-center w-9 h-9 rounded text-[var(--text-inverse)]/80 hover:text-[var(--text-inverse)] hover:bg-[var(--success)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-inverse)]"
              aria-label="Account"
            >
              <FontAwesomeIcon icon={faUser} className="w-4.5 h-4.5" aria-hidden="true" />
            </button>

            {/* Cart */}
            <Link
              href="/theme/commerce/cart"
              className="relative flex items-center justify-center w-9 h-9 rounded text-[var(--text-inverse)]/80 hover:text-[var(--text-inverse)] hover:bg-[var(--success)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-inverse)]"
              aria-label={`Cart, ${cartCount} items`}
            >
              <FontAwesomeIcon icon={faShoppingCart} className="w-4.5 h-4.5" aria-hidden="true" />
              {cartCount > 0 && (
                <Badge
                  variant="warning"
                  size="sm"
                  className="absolute -top-1 -right-1 !px-1.5 !py-0 !text-[9px] !min-w-[16px] !h-4 flex items-center justify-center"
                >
                  {cartCount}
                </Badge>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-[var(--success-fg)] border-t border-[var(--success)]">
            <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1" aria-label="Mobile navigation">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded text-sm font-medium text-[var(--text-inverse)] hover:bg-[var(--success)] transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 pt-2 border-t border-[var(--success)] flex flex-col gap-2">
                <Button variant="outline" size="sm" fullWidth>Sign In</Button>
                <Button variant="accent" size="sm" fullWidth>Register</Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-surface-raised border-t border-border mt-16">
        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Top: brand + columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-4">
              <Link href="/theme/commerce" className="text-lg font-extrabold tracking-tight text-text-primary">
                Shop<span className="text-[var(--success-fg)]">Flow</span>
              </Link>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                Discover thousands of products you will love, delivered fast with easy returns.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://x.com" aria-label="X" className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary hover:text-[var(--success-fg)] hover:border-[var(--success-fg)] transition-colors">
                  <FontAwesomeIcon icon={faXTwitterBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="https://instagram.com" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary hover:text-[var(--success-fg)] hover:border-[var(--success-fg)] transition-colors">
                  <FontAwesomeIcon icon={faInstagramBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="https://pinterest.com" aria-label="Pinterest" className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary hover:text-[var(--success-fg)] hover:border-[var(--success-fg)] transition-colors">
                  <FontAwesomeIcon icon={faPinterestBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Link columns */}
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading} className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-text-primary">{col.heading}</h3>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-10 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              &copy; {new Date().getFullYear()} ShopFlow, Inc. All rights reserved.
            </p>
            <div className="flex gap-4">
              {['Privacy Policy', 'Terms', 'Accessibility'].map((label) => (
                <Link key={label} href="/theme/commerce" className="text-xs text-text-secondary hover:text-text-primary transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
