import Link from 'next/link';
import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { Slider } from '@/modules/ui/Slider';
import { ProductCard } from '@/modules/domains/commerce/product/ProductCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faTruck,
  faRotateLeft,
  faShieldHalved,
  faStar,
  faBolt,
  faFire,
  faTag,
} from '@fortawesome/free-solid-svg-icons';
import { PRODUCTS, CATEGORIES } from './commerce.data';

export const metadata: Metadata = {
  title: { absolute: THEME_TITLES['commerce'] },
};

/* ── Hero slides ────────────────────────────────────────── */
const HERO_SLIDES = [
  {
    eyebrow: 'New Season',
    title: 'Fresh Tech,\nFaster You',
    subtitle: 'Laptops, headphones, accessories — curated for makers and creators.',
    cta: 'Shop Electronics',
    href: '/theme/commerce/products?category=electronics',
    image: PRODUCTS[0].image,
    accent: 'var(--success-fg)',
  },
  {
    eyebrow: 'Limited Deals',
    title: 'Save Up to\n50% Today',
    subtitle: 'Hand-picked discounts across every category. While stocks last.',
    cta: 'See All Deals',
    href: '/theme/commerce/products',
    image: PRODUCTS[1].image,
    accent: 'var(--secondary)',
  },
  {
    eyebrow: 'Just Arrived',
    title: 'Books Worth\nYour Time',
    subtitle: 'From TypeScript deep-dives to design fundamentals — grow your skills.',
    cta: 'Browse Books',
    href: '/theme/commerce/products?category=books',
    image: PRODUCTS[4].image,
    accent: 'var(--primary)',
  },
];

/* ── Trust pillars ──────────────────────────────────────── */
const TRUST_PILLARS = [
  { icon: faTruck,        label: 'Free shipping over $100' },
  { icon: faRotateLeft,   label: '30-day easy returns' },
  { icon: faShieldHalved, label: 'Secure checkout' },
  { icon: faStar,         label: '18 k+ happy customers' },
];

export default function CommerceHomePage() {
  const bestsellers = [...PRODUCTS].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 4);
  const deals       = PRODUCTS.filter((p) => p.salePrice != null);
  const newArrivals = PRODUCTS.slice(4, 8);

  return (
    <div className="bg-surface-base text-text-primary">

      {/* ── Hero Carousel ── */}
      <Slider
        slides={HERO_SLIDES.map((slide) => (
          <div key={slide.title} className="relative bg-surface-raised overflow-hidden">
            {/* Accent blob */}
            <div
              className="absolute inset-y-0 right-0 w-1/2 opacity-10 rounded-l-[6rem]"
              style={{ backgroundColor: `${slide.accent}` }}
              aria-hidden="true"
            />

            <div className="mx-auto max-w-7xl px-6 py-16 flex items-center gap-10">
              {/* Text */}
              <div className="flex-1 max-w-md space-y-5 z-10">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: slide.accent }}>
                  {slide.eyebrow}
                </p>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-text-primary leading-tight whitespace-pre-line">
                  {slide.title}
                </h1>
                <p className="text-base text-text-secondary leading-relaxed">
                  {slide.subtitle}
                </p>
                <Button
                  as="a"
                  href={slide.href}
                  variant="primary"
                  size="lg"
                  iconRight={<FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" />}
                  className="!bg-[var(--success-fg)] hover:!bg-[var(--success)] !border-[var(--success-fg)]"
                >
                  {slide.cta}
                </Button>
              </div>

              {/* Product image */}
              {slide.image && (
                <div className="hidden md:block w-72 h-52 xl:w-96 xl:h-64 shrink-0 rounded-2xl overflow-hidden shadow-xl">
                  <img src={slide.image} alt="" className="w-full h-full object-cover" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
        ))}
        autoPlay
        autoPlayInterval={5000}
        showDots
        showArrows
        loop
        className="rounded-none border-b border-border"
      />

      {/* ── Trust strip ── */}
      <div className="border-b border-border bg-surface-raised">
        <div className="mx-auto max-w-7xl px-6">
          <ul className="flex flex-wrap justify-center sm:justify-between divide-y sm:divide-y-0 sm:divide-x divide-border">
            {TRUST_PILLARS.map((p) => (
              <li key={p.label} className="flex items-center gap-2 px-5 py-3 text-xs text-text-secondary">
                <FontAwesomeIcon icon={p.icon} className="w-4 h-4 text-[var(--success-fg)] shrink-0" aria-hidden="true" />
                {p.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Category cards ── */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="text-xl font-bold text-text-primary mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.categoryId}
              href={`/theme/commerce/products?category=${cat.slug}`}
              className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-surface-sunken block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {cat.image && (
                <img
                  src={cat.image}
                  alt={cat.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-sm font-semibold text-white">{cat.title}</p>
                <p className="text-[10px] text-white/70 mt-0.5 flex items-center gap-1">
                  Shop now
                  <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5" aria-hidden="true" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Best Sellers ── */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FontAwesomeIcon icon={faFire} className="w-5 h-5 text-error" aria-hidden="true" />
            Best Sellers
          </h2>
          <Link href="/theme/commerce/products" className="text-sm text-[var(--success-fg)] font-medium hover:underline flex items-center gap-1">
            View all <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {bestsellers.map((product) => (
            <ProductCard
              key={product.productId}
              product={product}
              href={`/theme/commerce/products/${product.slug}`}
            />
          ))}
        </div>
      </section>

      {/* ── Promo banner ── */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-2xl bg-[var(--success-fg)] px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <Badge variant="warning" size="sm">
              <FontAwesomeIcon icon={faTruck} className="w-3 h-3 mr-1" aria-hidden="true" />
              Free Shipping
            </Badge>
            <h2 className="text-2xl font-extrabold text-[var(--text-inverse)]">
              Orders over $100 — always free
            </h2>
            <p className="text-sm text-[var(--success-subtle)] leading-relaxed max-w-sm">
              No membership needed. No minimum fees. Just fast, free delivery on thousands of items.
            </p>
          </div>
          <Button
            as="a"
            href="/theme/commerce/products"
            variant="accent"
            size="lg"
            iconRight={<FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" />}
          >
            Start Shopping
          </Button>
        </div>
      </section>

      {/* ── Today's Deals ── */}
      {deals.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <FontAwesomeIcon icon={faTag} className="w-5 h-5 text-[var(--warning)]" aria-hidden="true" />
              {"Today's Deals"}
            </h2>
            <Link href="/theme/commerce/products" className="text-sm text-[var(--success-fg)] font-medium hover:underline flex items-center gap-1">
              All deals <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {deals.map((product) => (
              <ProductCard
                key={product.productId}
                product={product}
                href={`/theme/commerce/products/${product.slug}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── New Arrivals ── */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FontAwesomeIcon icon={faBolt} className="w-5 h-5 text-[var(--success)]" aria-hidden="true" />
            New Arrivals
          </h2>
          <Link href="/theme/commerce/products" className="text-sm text-[var(--success-fg)] font-medium hover:underline flex items-center gap-1">
            View all <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {newArrivals.map((product) => (
            <ProductCard
              key={product.productId}
              product={product}
              href={`/theme/commerce/products/${product.slug}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
