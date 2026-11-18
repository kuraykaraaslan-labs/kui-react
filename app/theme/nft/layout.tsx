'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SkipLink } from '@/modules/ui/SkipLink';
import { Button } from '@/modules/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPalette,
  faMagnifyingGlass,
  faBars,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { faEthereum } from '@fortawesome/free-brands-svg-icons';
import {
  faXTwitter,
  faInstagram,
  faDiscord,
  faGithub,
} from '@fortawesome/free-brands-svg-icons';
import { WalletConnectButton } from '@/modules/domains/nft/wallet/WalletConnectButton';
import { DEMO_WALLET } from './nft.data';

const NAV_LINKS = [
  { label: 'Explore',     href: '/theme/nft/explore' },
  { label: 'Collections', href: '/theme/nft/collections' },
  { label: 'Activity',    href: '/theme/nft/activity' },
  { label: 'Create',      href: '/theme/nft/create' },
];

const FOOTER_COLUMNS = [
  {
    heading: 'Marketplace',
    links: [
      { label: 'Explore NFTs',  href: '/theme/nft/explore' },
      { label: 'Collections',   href: '/theme/nft/collections' },
      { label: 'Live activity', href: '/theme/nft/activity' },
      { label: 'Auctions',      href: '/theme/nft' },
      { label: 'Drops',         href: '/theme/nft' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Learn',        href: '/theme/nft' },
      { label: 'Help center',  href: '/theme/nft' },
      { label: 'Newsletter',   href: '/theme/nft' },
      { label: 'API',          href: '/theme/nft' },
      { label: 'Status',       href: '/theme/nft' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About',    href: '/theme/nft' },
      { label: 'Careers',  href: '/theme/nft' },
      { label: 'Press',    href: '/theme/nft' },
      { label: 'Brand',    href: '/theme/nft' },
      { label: 'Contact',  href: '/theme/nft' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of service', href: '/theme/nft' },
      { label: 'Privacy policy',   href: '/theme/nft' },
      { label: 'Royalty policy',   href: '/theme/nft' },
      { label: 'Verified rules',   href: '/theme/nft' },
    ],
  },
];

export default function NftThemeLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-text-primary">
      <SkipLink href="#main-content" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-surface-base/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center h-16 gap-3">

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:bg-surface-overlay transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <FontAwesomeIcon icon={mobileOpen ? faXmark : faBars} className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Logo */}
            <Link href="/theme/nft" className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-fg">
                <FontAwesomeIcon icon={faPalette} className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-text-primary">Glyph</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 ml-4" aria-label="Main navigation">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex-1" />

            {/* Search */}
            {searchOpen ? (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="flex flex-1 items-center rounded-lg border border-border bg-surface-raised px-3 py-1.5">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="w-3.5 h-3.5 text-text-secondary shrink-0 mr-2" aria-hidden="true" />
                  <input
                    autoFocus
                    type="search"
                    placeholder="Search collections, NFTs, creators…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
                    aria-label="Search"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                  aria-label="Close search"
                >
                  <FontAwesomeIcon icon={faXmark} className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                aria-label="Open search"
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

            {/* ETH price ticker (md+) */}
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-raised border border-border text-xs font-medium text-text-secondary">
              <FontAwesomeIcon icon={faEthereum} className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-text-primary tabular-nums">$3,102</span>
              <span className="text-success">+1.4%</span>
            </span>

            {/* Wallet */}
            <WalletConnectButton wallet={DEMO_WALLET} />
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-surface-base border-t border-border">
            <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1" aria-label="Mobile navigation">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 pt-2 border-t border-border flex flex-col gap-2">
                <Button variant="outline" size="sm" fullWidth>Browse drops</Button>
                <Button variant="primary" size="sm" fullWidth>Start creating</Button>
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
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-4">
              <Link href="/theme/nft" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-text-primary">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-secondary-fg">
                  <FontAwesomeIcon icon={faPalette} className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
                Glyph
              </Link>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                Discover, collect, and trade digital art across the most active chains in Web3.
              </p>
              <div className="flex items-center gap-2">
                {[
                  { icon: faXTwitter,  label: 'X',         href: 'https://x.com' },
                  { icon: faInstagram, label: 'Instagram', href: 'https://instagram.com' },
                  { icon: faDiscord,   label: 'Discord',   href: 'https://discord.com' },
                  { icon: faGithub,    label: 'GitHub',    href: 'https://github.com' },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary hover:text-secondary hover:border-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-text-primary">{col.heading}</h2>
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
              &copy; {new Date().getFullYear()} Glyph Labs. All rights reserved.
            </p>
            <div className="flex gap-4">
              {['Terms', 'Privacy', 'Royalties', 'Accessibility'].map((label) => (
                <Link key={label} href="/theme/nft" className="text-xs text-text-secondary hover:text-text-primary transition-colors">
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
