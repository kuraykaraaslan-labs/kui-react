'use client';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { cn } from '@/libs/utils/cn';
import { SkipLink } from '@/modules/ui/SkipLink';
import { Button } from '@/modules/ui/Button';
import { NavDrawer } from '@/modules/app/NavDrawer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faBars,
  faHome,
  faKey,
  faUsers,
  faTag,
  faChevronDown,
  faHeart,
  faPhone,
  faEnvelope,
  faGlobe,
  faArrowRight,
  faTree,
  faWarehouse,
  faBriefcase,
  faFire,
  faLocationDot,
} from '@fortawesome/free-solid-svg-icons';
import {
  faXTwitter as faXTwitterBrand,
  faLinkedin as faLinkedinBrand,
  faInstagram as faInstagramBrand,
} from '@fortawesome/free-brands-svg-icons';

const BUY_TYPES = [
  { label: 'Apartments',  icon: faBuilding,  href: '/theme/real-estate/properties' },
  { label: 'Houses',      icon: faHome,       href: '/theme/real-estate/properties' },
  { label: 'Villas',      icon: faHome,       href: '/theme/real-estate/properties' },
  { label: 'Land',        icon: faTree,       href: '/theme/real-estate/properties' },
  { label: 'Commercial',  icon: faWarehouse,  href: '/theme/real-estate/properties' },
  { label: 'Office',      icon: faBriefcase,  href: '/theme/real-estate/properties' },
];

const POPULAR_CITIES = ['Istanbul', 'Ankara', 'Izmir', 'Antalya', 'Bursa'];

const FOOTER_COLUMNS = [
  {
    heading: 'Browse',
    links: [
      { label: 'All Properties', href: '/theme/real-estate/properties' },
      { label: 'For Sale',       href: '/theme/real-estate/properties' },
      { label: 'For Rent',       href: '/theme/real-estate/properties' },
      { label: 'Short-term',     href: '/theme/real-estate/properties' },
      { label: 'New Listings',   href: '/theme/real-estate/properties' },
    ],
  },
  {
    heading: 'Property Types',
    links: [
      { label: 'Apartments', href: '/theme/real-estate/properties' },
      { label: 'Houses',     href: '/theme/real-estate/properties' },
      { label: 'Villas',     href: '/theme/real-estate/properties' },
      { label: 'Commercial', href: '/theme/real-estate/properties' },
      { label: 'Land',       href: '/theme/real-estate/properties' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us',   href: '/theme/real-estate/about' },
      { label: 'Our Agents', href: '/theme/real-estate/agents' },
      { label: 'Careers',    href: '/theme/real-estate' },
      { label: 'Blog',       href: '/theme/real-estate' },
      { label: 'Contact',    href: '/theme/real-estate/contact' },
    ],
  },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy',   href: '/theme/real-estate' },
  { label: 'Terms of Service', href: '/theme/real-estate' },
  { label: 'Cookie Settings',  href: '/theme/real-estate' },
];

const MOBILE_NAV = [
  { label: 'Home',        href: '/theme/real-estate',            icon: faHome    },
  { label: 'Buy',         href: '/theme/real-estate/properties', icon: faTag     },
  { label: 'Rent',        href: '/theme/real-estate/properties', icon: faKey     },
  { label: 'Short-term',  href: '/theme/real-estate/properties', icon: faFire    },
  { label: 'Agents',      href: '/theme/real-estate/agents',     icon: faUsers   },
];

type DropdownKey = 'buy' | 'rent' | null;

function MegaDropdown({ label, icon, dropKey, active, onEnter, onLeave, children }: {
  label: string;
  icon: typeof faChevronDown;
  dropKey: DropdownKey;
  active: DropdownKey;
  onEnter: (k: DropdownKey) => void;
  onLeave: () => void;
  children: React.ReactNode;
}) {
  const isOpen = active === dropKey;
  return (
    <div
      className="relative"
      onMouseEnter={() => onEnter(dropKey)}
      onMouseLeave={onLeave}
    >
      <button
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          isOpen ? 'text-primary bg-primary-subtle' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />
        {label}
        <FontAwesomeIcon
          icon={faChevronDown}
          className={cn('w-3 h-3 transition-transform duration-200', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown panel */}
      <div
        className={cn(
          'absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 transition-all duration-200',
          isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function RealEstateThemeLayout({ children }: { children: React.ReactNode }) {
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleEnter(key: DropdownKey) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveDropdown(key);
  }

  function handleLeave() {
    closeTimer.current = setTimeout(() => setActiveDropdown(null), 120);
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-text-primary">
      <SkipLink href="#main-content" />

      <header className="sticky top-0 z-50">

        {/* ── Top utility bar ── */}
        <div style={{ background: '#0f172a' }} className="hidden md:block">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex items-center justify-between h-9 text-xs">
              {/* Left: contact info */}
              <div className="flex items-center gap-5 text-white/60">
                <a
                  href="tel:+908501234567"
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <FontAwesomeIcon icon={faPhone} className="w-3 h-3" aria-hidden="true" />
                  +90 850 123 45 67
                </a>
                <a
                  href="mailto:info@estateview.com"
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <FontAwesomeIcon icon={faEnvelope} className="w-3 h-3" aria-hidden="true" />
                  info@estateview.com
                </a>
              </div>

              {/* Right: language + quick links */}
              <div className="flex items-center gap-4 text-white/60">
                <Link href="/theme/real-estate" className="hover:text-white transition-colors">Blog</Link>
                <Link href="/theme/real-estate" className="hover:text-white transition-colors">Contact</Link>
                <div className="w-px h-3.5 bg-white/20" />
                <button className="inline-flex items-center gap-1 hover:text-white transition-colors">
                  <FontAwesomeIcon icon={faGlobe} className="w-3 h-3" aria-hidden="true" />
                  EN / TR
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main nav ── */}
        <div className="bg-surface-base border-b border-border shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex items-center h-16 gap-2">

              {/* Logo */}
              <Link href="/theme/real-estate" className="inline-flex items-center gap-2.5 shrink-0 mr-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm">
                  <FontAwesomeIcon icon={faBuilding} className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="text-xl font-black tracking-tight text-text-primary hidden sm:block">
                  Estate<span className="text-primary">View</span>
                </span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden lg:flex items-center gap-0.5 flex-1" aria-label="Primary navigation">

                {/* Buy mega menu */}
                <MegaDropdown
                  label="Buy"
                  icon={faTag}
                  dropKey="buy"
                  active={activeDropdown}
                  onEnter={handleEnter}
                  onLeave={handleLeave}
                >
                  <div className="w-[480px] rounded-2xl border border-border bg-surface-base shadow-xl p-5">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-3">Browse by type</p>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {BUY_TYPES.map((t) => (
                        <a
                          key={t.label}
                          href={t.href}
                          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-primary-subtle hover:text-primary transition-colors"
                        >
                          <FontAwesomeIcon icon={t.icon} className="w-4 h-4 shrink-0" aria-hidden="true" />
                          {t.label}
                        </a>
                      ))}
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2.5">Popular cities</p>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_CITIES.map((city) => (
                          <Link
                            key={city}
                            href="/theme/real-estate/properties"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border text-xs text-text-secondary hover:border-primary hover:text-primary transition-colors"
                          >
                            <FontAwesomeIcon icon={faLocationDot} className="w-2.5 h-2.5" aria-hidden="true" />
                            {city}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <Link
                      href="/theme/real-estate/properties"
                      className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      View all properties for sale
                      <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                </MegaDropdown>

                {/* Rent mega menu */}
                <MegaDropdown
                  label="Rent"
                  icon={faKey}
                  dropKey="rent"
                  active={activeDropdown}
                  onEnter={handleEnter}
                  onLeave={handleLeave}
                >
                  <div className="w-[360px] rounded-2xl border border-border bg-surface-base shadow-xl p-5">
                    <div className="space-y-1 mb-4">
                      {[
                        { label: 'Long-term Rental',  sub: 'Monthly contracts',    href: '/theme/real-estate/properties' },
                        { label: 'Short-term / Holiday', sub: 'Weekly or nightly', href: '/theme/real-estate/properties' },
                        { label: 'Student Housing',   sub: 'Near universities',    href: '/theme/real-estate/properties' },
                        { label: 'Office & Commercial', sub: 'Business spaces',    href: '/theme/real-estate/properties' },
                      ].map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-primary-subtle group transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-text-primary group-hover:text-primary">{item.label}</p>
                            <p className="text-xs text-text-secondary">{item.sub}</p>
                          </div>
                          <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5 text-text-disabled group-hover:text-primary" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                    <Link
                      href="/theme/real-estate/properties"
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      View all rental listings
                      <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                </MegaDropdown>

                {/* Simple links */}
                <Link
                  href="/theme/real-estate/properties"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
                >
                  <FontAwesomeIcon icon={faFire} className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                  New Listings
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-warning text-white text-xs font-bold leading-none">8</span>
                </Link>

                <Link
                  href="/theme/real-estate/agents"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
                >
                  <FontAwesomeIcon icon={faUsers} className="w-3.5 h-3.5" aria-hidden="true" />
                  Agents
                </Link>
              </nav>

              {/* Right actions */}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {/* Saved */}
                <button
                  aria-label="Saved properties"
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-error hover:border-error transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <FontAwesomeIcon icon={faHeart} className="w-4 h-4" aria-hidden="true" />
                </button>

                {/* Divider */}
                <div className="hidden sm:block w-px h-6 bg-border mx-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex text-text-secondary font-medium"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="hidden sm:inline-flex font-semibold shadow-sm"
                >
                  <FontAwesomeIcon icon={faBuilding} className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                  List Property
                </Button>

                {/* Mobile hamburger */}
                <div className="lg:hidden">
                  <NavDrawer
                    title="EstateView"
                    side="right"
                    trigger={
                      <Button variant="outline" size="sm" aria-label="Open menu">
                        <FontAwesomeIcon icon={faBars} className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    }
                  >
                    <div className="space-y-6">
                      {/* Mobile brand */}
                      <div className="flex items-center gap-2.5 pb-4 border-b border-border">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
                          <FontAwesomeIcon icon={faBuilding} className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="text-lg font-black tracking-tight">
                          Estate<span className="text-primary">View</span>
                        </span>
                      </div>

                      {/* Nav links */}
                      <nav className="flex flex-col gap-0.5" aria-label="Mobile navigation">
                        {MOBILE_NAV.map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-text-primary hover:bg-primary-subtle hover:text-primary transition-colors"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay text-text-secondary">
                              <FontAwesomeIcon icon={item.icon} className="w-4 h-4" aria-hidden="true" />
                            </span>
                            {item.label}
                          </a>
                        ))}
                      </nav>

                      {/* Property types */}
                      <div>
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest px-1 mb-2">By Type</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {BUY_TYPES.map((t) => (
                            <a
                              key={t.label}
                              href={t.href}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface-overlay transition-colors border border-border"
                            >
                              <FontAwesomeIcon icon={t.icon} className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                              {t.label}
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Auth */}
                      <div className="flex flex-col gap-2 pt-4 border-t border-border">
                        <Button variant="outline" fullWidth size="sm">Sign In</Button>
                        <Button variant="primary" fullWidth size="sm">
                          <FontAwesomeIcon icon={faBuilding} className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                          List Property
                        </Button>
                      </div>

                      {/* Contact */}
                      <div className="text-xs text-text-secondary space-y-1.5 pt-2 border-t border-border">
                        <a href="tel:+908501234567" className="flex items-center gap-2 hover:text-text-primary">
                          <FontAwesomeIcon icon={faPhone} className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                          +90 850 123 45 67
                        </a>
                        <a href="mailto:info@estateview.com" className="flex items-center gap-2 hover:text-text-primary">
                          <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                          info@estateview.com
                        </a>
                      </div>
                    </div>
                  </NavDrawer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-surface-raised mt-16">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-4">
              <Link href="/theme/real-estate" className="inline-flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
                  <FontAwesomeIcon icon={faBuilding} className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="text-base font-black tracking-tight">
                  Estate<span className="text-primary">View</span>
                </span>
              </Link>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                Find your perfect property in Turkey. Thousands of verified listings from trusted agents.
              </p>
              <div className="flex items-center gap-2.5">
                <a href="https://x.com" aria-label="X (Twitter)" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faXTwitterBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="https://linkedin.com" aria-label="LinkedIn" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faLinkedinBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="https://instagram.com" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">
                  <FontAwesomeIcon icon={faInstagramBrand} className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
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
                      <a href={link.href} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
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
              &copy; {new Date().getFullYear()} EstateView. All rights reserved.
            </p>
            <nav className="flex flex-wrap items-center gap-4 order-1 sm:order-2" aria-label="Legal navigation">
              {LEGAL_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="text-xs text-text-secondary hover:text-text-primary transition-colors">
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
