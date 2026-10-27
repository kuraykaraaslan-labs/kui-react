import Link from 'next/link';
import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { PropertyCard } from '@/modules/domains/real-estate/property/PropertyCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faLocationDot,
  faArrowRight,
  faBuilding,
  faUsers,
  faHandshake,
  faCity,
  faHome,
  faWarehouse,
  faTree,
  faBriefcase,
  faStar,
  faShieldHalved,
  faHeadset,
  faChartLine,
  faCheckCircle,
  faFire,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import { PROPERTIES, CITIES, PROPERTY_TYPES, TESTIMONIALS, NEIGHBORHOODS } from './real-estate.data';
import type { PropertyType } from '@/modules/domains/real-estate/types';

export const metadata: Metadata = {
  title: { absolute: THEME_TITLES['real-estate'] },
};

const STATS = [
  { label: 'Properties Listed',  value: '2,400+', icon: faBuilding   },
  { label: 'Cities Covered',     value: '24+',    icon: faCity       },
  { label: 'Satisfied Buyers',   value: '1,800+', icon: faHandshake  },
  { label: 'Expert Agents',      value: '120+',   icon: faUsers      },
];

const TYPE_META: Record<PropertyType, { label: string; icon: typeof faHome }> = {
  APARTMENT:  { label: 'Apartments',  icon: faBuilding   },
  HOUSE:      { label: 'Houses',      icon: faHome       },
  VILLA:      { label: 'Villas',      icon: faHome       },
  LAND:       { label: 'Land',        icon: faTree       },
  COMMERCIAL: { label: 'Commercial',  icon: faWarehouse  },
  OFFICE:     { label: 'Office',      icon: faBriefcase  },
};

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: faMagnifyingGlass,
    title: 'Search & Filter',
    desc: 'Use our powerful filters to narrow down thousands of verified listings by city, type, price, and more.',
  },
  {
    step: '02',
    icon: faHeadset,
    title: 'Connect with an Agent',
    desc: 'Each listing is backed by a certified agent ready to answer your questions and arrange viewings.',
  },
  {
    step: '03',
    icon: faHandshake,
    title: 'Close the Deal',
    desc: 'We guide you through every step — from offer to keys — with full legal and documentation support.',
  },
];

const WHY_US = [
  { icon: faShieldHalved, title: 'Verified Listings', desc: 'Every property is verified by our team before going live.' },
  { icon: faStar, title: 'Rated Agents', desc: 'All agents carry proven track records and client reviews.' },
  { icon: faChartLine, title: 'Market Insights', desc: 'Real-time pricing trends and neighbourhood analytics.' },
  { icon: faCheckCircle, title: 'Legal Support', desc: 'End-to-end documentation and title deed assistance.' },
];

export default function RealEstateHomePage() {
  const featuredProperties = PROPERTIES.filter((p) => p.isFeatured).slice(0, 4);
  const newListings = [...PROPERTIES].sort((a, b) => (a.daysOnMarket ?? 99) - (b.daysOnMarket ?? 99)).slice(0, 3);

  return (
    <div className="bg-surface-base text-text-primary">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[580px] flex items-center">
        {/* Background */}
        <div className="absolute inset-0 z-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #0c1f3d 100%)' }}>
          {/* Grid lines */}
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          {/* Glow blobs */}
          <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-20 right-0 h-[500px] w-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }} />
          <div className="absolute top-0 right-1/4 h-[300px] w-[300px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)' }} />
          {/* Decorative building silhouette */}
          <svg className="absolute bottom-0 right-0 opacity-10 h-full w-auto" viewBox="0 0 600 500" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="320" y="100" width="80" height="400" />
            <rect x="410" y="180" width="60" height="320" />
            <rect x="480" y="220" width="50" height="280" />
            <rect x="540" y="260" width="40" height="240" />
            <rect x="240" y="150" width="70" height="350" />
            <rect x="160" y="200" width="70" height="300" />
            <rect x="100" y="240" width="50" height="260" />
            <rect x="330" y="110" width="8" height="20" />
            <rect x="350" y="110" width="8" height="20" />
            <rect x="370" y="110" width="8" height="20" />
            <rect x="335" y="140" width="8" height="12" /><rect x="350" y="140" width="8" height="12" /><rect x="365" y="140" width="8" height="12" /><rect x="380" y="140" width="8" height="12" />
            <rect x="335" y="165" width="8" height="12" /><rect x="350" y="165" width="8" height="12" /><rect x="365" y="165" width="8" height="12" /><rect x="380" y="165" width="8" height="12" />
            <rect x="335" y="190" width="8" height="12" /><rect x="350" y="190" width="8" height="12" /><rect x="365" y="190" width="8" height="12" /><rect x="380" y="190" width="8" height="12" />
            <rect x="415" y="195" width="7" height="10" /><rect x="428" y="195" width="7" height="10" /><rect x="441" y="195" width="7" height="10" />
            <rect x="415" y="215" width="7" height="10" /><rect x="428" y="215" width="7" height="10" /><rect x="441" y="215" width="7" height="10" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 w-full">
          <div className="max-w-2xl space-y-6">
            <Badge variant="warning" size="sm">
              <FontAwesomeIcon icon={faFire} className="w-3 h-3 mr-1" aria-hidden="true" />
              8 new listings added today
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              Find Your<br />
              <span className="text-primary">Dream Property</span>
            </h1>
            <p className="text-lg text-white/80 max-w-xl leading-relaxed">
              Thousands of verified listings across Turkey. Buy, rent, or explore short-stay options — all in one place.
            </p>

            {/* Search bar */}
            <div className="mt-6 bg-white rounded-2xl p-3 shadow-2xl flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <FontAwesomeIcon
                  icon={faLocationDot}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none"
                  aria-hidden="true"
                />
                <select
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-raised rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus transition appearance-none"
                  aria-label="Select city"
                  defaultValue=""
                >
                  <option value="" disabled>Select city…</option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div className="relative sm:w-40">
                <select
                  className="w-full px-4 py-2.5 bg-surface-raised rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus transition appearance-none"
                  aria-label="Property type"
                  defaultValue=""
                >
                  <option value="" disabled>Type…</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                  ))}
                </select>
              </div>
              <div className="relative sm:w-44">
                <select
                  className="w-full px-4 py-2.5 bg-surface-raised rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus transition appearance-none"
                  aria-label="Listing type"
                  defaultValue=""
                >
                  <option value="" disabled>For Sale / Rent…</option>
                  <option value="SALE">For Sale</option>
                  <option value="RENT">For Rent</option>
                  <option value="SHORT_TERM">Short-term</option>
                </select>
              </div>
              <Button variant="primary" size="md" className="shrink-0 px-6 rounded-xl">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 mr-2" aria-hidden="true" />
                Search
              </Button>
            </div>

            {/* City quick links */}
            <div className="flex flex-wrap gap-2">
              {CITIES.map((city) => (
                <Link
                  key={city}
                  href="/theme/real-estate/properties"
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 backdrop-blur text-white hover:bg-white/30 border border-white/30 transition-colors"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-b border-border bg-surface-raised">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 px-4 py-2 text-center">
                <FontAwesomeIcon icon={stat.icon} className="w-5 h-5 text-primary" aria-hidden="true" />
                <span className="text-2xl font-bold text-text-primary">{stat.value}</span>
                <span className="text-xs text-text-secondary">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured properties ── */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Featured Properties</h2>
            <p className="text-sm text-text-secondary mt-0.5">Hand-picked by our expert agents</p>
          </div>
          <Link
            href="/theme/real-estate/properties"
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            View all <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProperties.map((property) => (
            <PropertyCard
              key={property.propertyId}
              property={property}
              href={`/theme/real-estate/properties/${property.slug}`}
            />
          ))}
        </div>
      </section>

      {/* ── New listings ── */}
      <section className="bg-surface-raised border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-warning" aria-hidden="true" />
                <span className="text-xs font-semibold text-warning uppercase tracking-wide">Just Listed</span>
              </div>
              <h2 className="text-xl font-bold text-text-primary">Newest on the Market</h2>
            </div>
            <Link href="/theme/real-estate/properties" className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
              See all <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {newListings.map((p) => (
              <PropertyCard
                key={p.propertyId}
                property={p}
                href={`/theme/real-estate/properties/${p.slug}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Browse by type ── */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <h2 className="text-xl font-bold text-text-primary mb-6">Browse by Property Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PROPERTY_TYPES.map((type) => {
            const meta = TYPE_META[type];
            const count = PROPERTIES.filter((p) => p.type === type).length;
            return (
              <Link
                key={type}
                href="/theme/real-estate/properties"
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-raised p-4 hover:border-primary hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <FontAwesomeIcon icon={meta.icon} className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-text-primary">{meta.label}</span>
                <span className="text-xs text-text-secondary">{count} listing{count !== 1 ? 's' : ''}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Neighborhoods ── */}
      <section className="bg-surface-raised border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Popular Neighborhoods</h2>
              <p className="text-sm text-text-secondary mt-0.5">Explore the most sought-after areas</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {NEIGHBORHOODS.map((n) => (
              <Link
                key={n.id}
                href="/theme/real-estate/properties"
                className="group relative rounded-2xl overflow-hidden h-52 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <img
                  src={n.imageUrl}
                  alt={n.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white font-bold text-base leading-tight">{n.name}</p>
                  <p className="text-white/70 text-xs mt-0.5">{n.city} · {n.highlight}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-white text-xs font-medium">Avg {n.avgPrice}</span>
                    <span className="text-white/70 text-xs">{n.listingCount} listings</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-text-primary">How EstateView Works</h2>
          <p className="text-text-secondary mt-2 text-sm">From search to signed contract in three simple steps</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.step} className="relative text-center space-y-4">
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden sm:block absolute top-8 left-[calc(50%+3rem)] right-[calc(-50%+3rem)] h-px border-t-2 border-dashed border-border" />
              )}
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-subtle text-primary mx-auto">
                <FontAwesomeIcon icon={step.icon} className="w-7 h-7" aria-hidden="true" />
              </div>
              <span className="block text-xs font-bold text-primary tracking-widest uppercase">{step.step}</span>
              <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs mx-auto">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-surface-raised border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-text-primary">What Our Clients Say</h2>
            <p className="text-text-secondary mt-2 text-sm">Trusted by thousands of buyers, sellers, and tenants</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.id} className="rounded-2xl border border-border bg-surface-base p-6 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FontAwesomeIcon
                      key={i}
                      icon={faStar}
                      className={i < t.rating ? 'w-4 h-4 text-warning' : 'w-4 h-4 text-border'}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <img src={t.avatarUrl} alt={t.name} className="h-9 w-9 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                    <p className="text-xs text-text-secondary">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-text-primary">Why Choose EstateView?</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {WHY_US.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-surface-raised p-5 space-y-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                <FontAwesomeIcon icon={item.icon} className="w-5 h-5" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src="https://picsum.photos/seed/realestate-cta/1400/400"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-primary/85" />
            <div className="relative px-8 py-14 text-center space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary-fg">Ready to list your property?</h2>
              <p className="text-primary-fg/80 max-w-md mx-auto text-sm leading-relaxed">
                Reach thousands of qualified buyers and renters. List your property on EstateView today — it&apos;s free to get started.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button variant="accent" size="lg">
                  <FontAwesomeIcon icon={faChartLine} className="w-4 h-4 mr-2" aria-hidden="true" />
                  List Property — It&apos;s Free
                </Button>
                <Link
                  href="/theme/real-estate/agents"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/40 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <FontAwesomeIcon icon={faUsers} className="w-4 h-4" aria-hidden="true" />
                  Talk to an Agent
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
