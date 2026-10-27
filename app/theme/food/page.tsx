import Link from 'next/link';
import type { Metadata } from 'next';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { Button } from '@/modules/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const metadata: Metadata = {
  title: { absolute: THEME_TITLES['food'] },
};
import {
  faLocationDot,
  faMagnifyingGlass,
  faArrowRight,
  faTag,
  faFire,
  faLeaf,
  faUtensils,
  faStar,
  faMotorcycle,
  faPercent,
  faMugHot,
} from '@fortawesome/free-solid-svg-icons';
import { RestaurantCard } from '@/modules/domains/food/restaurant/RestaurantCard';
import { RESTAURANTS, FOOD_CATEGORIES, PROMO_BANNERS } from './food.data';

const CATEGORY_ICONS: Record<string, typeof faTag> = {
  all:      faUtensils,
  deals:    faTag,
  pizza:    faFire,
  burgers:  faFire,
  japanese: faStar,
  healthy:  faLeaf,
  indian:   faPercent,
  mexican:  faMugHot,
};

const PROMO_GRADIENTS = [
  'from-primary to-blue-600',
  'from-orange-500 to-red-500',
  'from-secondary to-purple-600',
];

export default function FoodThemePage() {
  const featuredRestaurants = RESTAURANTS.slice(0, 4);

  return (
    <div className="bg-surface-base text-text-primary">

      {/* ── Hero: Delivery / Pickup toggle + address ── */}
      <section className="border-b border-border bg-surface-base">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14 text-center">
          {/* Delivery / Pickup toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-overlay mb-6">
            <button
              type="button"
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-surface-base text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              Delivery
            </button>
            <button
              type="button"
              className="px-5 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              Pickup
            </button>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary mb-3 tracking-tight">
            Order food to your door
          </h1>
          <p className="text-text-secondary text-sm sm:text-base mb-8">
            From the best local restaurants — delivered fast.
          </p>

          {/* Address + Search bar */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 max-w-2xl mx-auto">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-surface-base shadow-sm focus-within:ring-2 focus-within:ring-border-focus transition">
              <FontAwesomeIcon icon={faLocationDot} className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <input
                type="text"
                placeholder="Enter delivery address…"
                defaultValue="New York, NY 10001"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
                aria-label="Delivery address"
              />
            </div>
            <Button as="a" href="/theme/food/restaurants" variant="primary" size="lg" className="shrink-0 sm:px-8 justify-center">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 mr-2" aria-hidden="true" />
              Find food
            </Button>
          </div>
        </div>
      </section>

      {/* ── Category scroll ── */}
      <section className="border-b border-border bg-surface-base">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="flex gap-2 overflow-x-auto py-4 scrollbar-hide"
            role="list"
            aria-label="Food categories"
          >
            {FOOD_CATEGORIES.map((cat, i) => {
              const icon = CATEGORY_ICONS[cat.id] ?? faUtensils;
              const isActive = i === 0;
              return (
                <Link
                  key={cat.id}
                  href="/theme/food/restaurants"
                  role="listitem"
                  className={[
                    'inline-flex items-center gap-2 shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    isActive
                      ? 'bg-text-primary text-surface-base'
                      : 'border border-border bg-surface-base text-text-secondary hover:border-border-strong hover:text-text-primary',
                  ].join(' ')}
                >
                  <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />
                  {cat.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Promo banners ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-2">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {PROMO_BANNERS.map((banner, i) => (
            <Link
              key={banner.id}
              href="/theme/food/restaurants"
              className={[
                'shrink-0 w-64 sm:w-72 rounded-2xl bg-gradient-to-br p-5 flex flex-col gap-2 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                PROMO_GRADIENTS[i % PROMO_GRADIENTS.length],
              ].join(' ')}
            >
              <span className="inline-block self-start rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold text-white">
                {banner.badgeLabel}
              </span>
              <p className="text-lg font-extrabold text-white leading-tight">{banner.title}</p>
              <p className="text-xs text-white/80 leading-snug">{banner.subtitle}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Popular near you ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Popular near you</h2>
          <Link
            href="/theme/food/restaurants"
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
          >
            See all
            <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredRestaurants.map((r) => (
            <RestaurantCard
              key={r.restaurantId}
              restaurant={r}
              href={`/theme/food/restaurants/${r.slug}`}
            />
          ))}
        </div>
      </section>

      {/* ── Offers near you ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Offers near you</h2>
          <Link
            href="/theme/food/restaurants"
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
          >
            See all
            <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RESTAURANTS.filter((r) => r.promoText).map((r) => (
            <RestaurantCard
              key={r.restaurantId}
              restaurant={r}
              href={`/theme/food/restaurants/${r.slug}`}
            />
          ))}
        </div>
      </section>

      {/* ── Why YumDash ── */}
      <section className="border-t border-border bg-surface-raised">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-3 text-center">
            {[
              { icon: faLocationDot, title: 'Live tracking',   body: 'Follow your order in real time from the restaurant to your door.' },
              { icon: faMotorcycle,  title: 'Fast delivery',   body: 'Average delivery under 30 minutes from hundreds of local restaurants.' },
              { icon: faLeaf,        title: 'Fresh every time', body: 'Partners commit to quality standards so your food arrives perfect.' },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                  <FontAwesomeIcon icon={item.icon} className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">{item.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed max-w-xs">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="rounded-2xl bg-[var(--text-primary)] px-8 py-10 text-center space-y-4">
          <h2 className="text-2xl font-extrabold text-[var(--surface-base)]">Hungry? Let&apos;s go.</h2>
          <p className="text-[var(--surface-base)]/70 max-w-sm mx-auto text-sm leading-relaxed">
            Join over a million happy customers ordering from their favourite restaurants every day.
          </p>
          <Button as="a" href="/theme/food/restaurants" variant="accent" size="lg">
            Order now
          </Button>
        </div>
      </section>
    </div>
  );
}
