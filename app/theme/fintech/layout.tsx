'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SkipLink } from '@/modules/ui/SkipLink';
import { Button } from '@/modules/ui/Button';
import { NavDrawer } from '@/modules/app/NavDrawer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faBell,
  faChevronDown,
  faCircleUser,
  faWallet,
  faArrowRightArrowLeft,
  faPaperPlane,
  faChartLine,
  faShieldHalved,
  faLock,
  faCreditCard,
} from '@fortawesome/free-solid-svg-icons';
import { faXTwitter as faXTwitterBrand, faLinkedin as faLinkedinBrand, faInstagram as faInstagramBrand } from '@fortawesome/free-brands-svg-icons';

const NAV_ITEMS = [
  { label: 'Summary',          href: '/theme/fintech',              icon: faChartLine },
  { label: 'Send & Request',   href: '/theme/fintech/transfer',     icon: faPaperPlane },
  { label: 'Wallet',           href: '/theme/fintech/wallets',      icon: faWallet },
  { label: 'Activity',         href: '/theme/fintech/transactions', icon: faArrowRightArrowLeft },
  { label: 'Portfolio',        href: '/theme/fintech/portfolio',    icon: faChartLine },
  { label: 'Cards',            href: '/theme/fintech/cards',        icon: faCreditCard },
];

const FOOTER_COLUMNS = [
  {
    heading: 'Send Money',
    links: [
      { label: 'Send to a Friend', href: '/theme/fintech/transfer' },
      { label: 'Request Money',    href: '/theme/fintech/transfer' },
      { label: 'Pay Online',       href: '/theme/fintech/transfer' },
      { label: 'Pay in Person',    href: '/theme/fintech/transfer' },
    ],
  },
  {
    heading: 'Manage',
    links: [
      { label: 'Wallet',          href: '/theme/fintech/wallets' },
      { label: 'Activity',        href: '/theme/fintech/transactions' },
      { label: 'Statements',      href: '/theme/fintech' },
      { label: 'Tax Documents',   href: '/theme/fintech' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'Resolution Center', href: '/theme/fintech' },
      { label: 'Contact Us',        href: '/theme/fintech' },
      { label: 'Security Center',   href: '/theme/fintech' },
      { label: 'Fees',              href: '/theme/fintech' },
    ],
  },
];

const LEGAL_LINKS = [
  { label: 'Privacy',           href: '/theme/fintech' },
  { label: 'Legal',             href: '/theme/fintech' },
  { label: 'Policy Updates',    href: '/theme/fintech' },
  { label: 'Site Map',          href: '/theme/fintech' },
  { label: 'Cookies',           href: '/theme/fintech' },
];

export default function FintechThemeLayout({ children }: { children: React.ReactNode }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa] text-text-primary">
      <SkipLink href="#main-content" />

      {/* Top promo bar */}
      <div className="bg-primary text-primary-fg text-center text-xs py-2 px-4 font-medium">
        New: Send money internationally with zero fees until June 2026.{' '}
        <Link href="/theme/fintech/transfer" className="underline font-semibold">Start sending →</Link>
      </div>

      <header className="sticky top-0 z-50 bg-surface-base border-b border-border shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-4 h-16">

            {/* Logo */}
            <Link href="/theme/fintech" className="inline-flex items-center gap-1 shrink-0">
              <span className="text-2xl font-black tracking-tighter">
                <span className="text-primary">Pay</span><span className="text-[#003087]">Flow</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center border-l border-border pl-4 ml-2 gap-0.5" aria-label="Primary navigation">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary rounded-md transition-colors whitespace-nowrap"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface-overlay transition-colors"
              >
                <FontAwesomeIcon icon={faBell} className="w-4 h-4" aria-hidden="true" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error ring-2 ring-surface-base" aria-label="2 unread notifications" />
              </button>

              {/* User menu */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-fg text-sm font-bold">A</span>
                  <span className="hidden md:block">Alex Johnson</span>
                  <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3 text-text-secondary" aria-hidden="true" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-56 rounded-xl border border-border bg-surface-base shadow-lg py-1 z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-text-primary">Alex Johnson</p>
                      <p className="text-xs text-text-secondary mt-0.5">alex@example.com</p>
                    </div>
                    {[
                      { label: 'Profile Settings', icon: faCircleUser, href: '/theme/fintech' },
                      { label: 'Security',          icon: faShieldHalved, href: '/theme/fintech' },
                    ].map((item) => (
                      <a key={item.label} href={item.href} className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors">
                        <FontAwesomeIcon icon={item.icon} className="w-4 h-4" aria-hidden="true" />
                        {item.label}
                      </a>
                    ))}
                    <div className="border-t border-border mt-1">
                      <button className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error-subtle transition-colors">
                        <FontAwesomeIcon icon={faLock} className="w-4 h-4" aria-hidden="true" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Auth buttons (logged-out state) hidden behind sm */}
              <Button variant="outline" size="sm" className="hidden sm:inline-flex border-primary text-primary hover:bg-primary-subtle">
                Log In
              </Button>
              <Button variant="primary" size="sm" className="hidden md:inline-flex font-semibold rounded-full">
                Sign Up
              </Button>

              {/* Mobile hamburger */}
              <div className="md:hidden">
                <NavDrawer
                  title="PayFlow"
                  side="right"
                  trigger={(
                    <Button variant="ghost" size="sm" iconOnly aria-label="Open menu">
                      <FontAwesomeIcon icon={faBars} className="w-5 h-5" aria-hidden="true" />
                    </Button>
                  )}
                >
                  <div className="flex items-center gap-3 px-2 py-3 rounded-xl bg-primary-subtle mb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-fg font-bold">A</span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Alex Johnson</p>
                      <p className="text-xs text-text-secondary">alex@example.com</p>
                    </div>
                  </div>
                  <nav className="flex flex-col" aria-label="Mobile navigation">
                    {NAV_ITEMS.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        className="flex items-center gap-3 px-2 py-3 text-sm font-medium text-text-primary hover:bg-surface-overlay rounded-lg transition-colors"
                      >
                        <FontAwesomeIcon icon={item.icon} className="w-4 h-4 text-primary" aria-hidden="true" />
                        {item.label}
                      </a>
                    ))}
                  </nav>
                  <div className="flex flex-col gap-2 pt-4 border-t border-border mt-4">
                    <Button variant="outline" fullWidth size="sm">Log In</Button>
                    <Button variant="primary" fullWidth size="sm" className="rounded-full">Sign Up Free</Button>
                  </div>
                </NavDrawer>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface-base mt-16">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-2 lg:col-span-1 space-y-4">
              <Link href="/theme/fintech" className="inline-flex items-center">
                <span className="text-2xl font-black tracking-tighter">
                  <span className="text-primary">Pay</span><span className="text-[#003087]">Flow</span>
                </span>
              </Link>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                The safer, easier way to pay and get paid. Trusted by millions worldwide.
              </p>
              <div className="flex items-center gap-3">
                {[
                  { icon: faXTwitterBrand, label: 'X (Twitter)', href: 'https://x.com' },
                  { icon: faLinkedinBrand, label: 'LinkedIn',   href: 'https://linkedin.com' },
                  { icon: faInstagramBrand, label: 'Instagram',  href: 'https://instagram.com' },
                ].map((s) => (
                  <a key={s.label} href={s.href} aria-label={s.label}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-primary hover:border-primary transition-colors">
                    <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                ))}
              </div>
              {/* Trust badges */}
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text-secondary">
                  <FontAwesomeIcon icon={faShieldHalved} className="w-3 h-3 text-success-fg" aria-hidden="true" />
                  Buyer Protection
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text-secondary">
                  <FontAwesomeIcon icon={faLock} className="w-3 h-3 text-success-fg" aria-hidden="true" />
                  256-bit SSL
                </span>
              </div>
            </div>

            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                  {col.heading}
                </h2>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-text-secondary hover:text-primary transition-colors">
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
              &copy; {new Date().getFullYear()} PayFlow Inc. All rights reserved.
            </p>
            <nav className="flex flex-wrap items-center gap-4 order-1 sm:order-2" aria-label="Legal navigation">
              {LEGAL_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="text-xs text-text-secondary hover:text-primary transition-colors">
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
