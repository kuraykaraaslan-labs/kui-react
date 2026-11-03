'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { RestaurantStatusBadge } from '@/modules/domains/food/restaurant/RestaurantStatusBadge';
import { OrderStatusBadge } from '@/modules/domains/food/order/OrderStatusBadge';
import { DeliveryStatusBadge } from '@/modules/domains/food/order/DeliveryStatusBadge';
import { RestaurantCard } from '@/modules/domains/food/restaurant/RestaurantCard';
import { MenuItemCard } from '@/modules/domains/food/menu/MenuItemCard';
import { OrderTrackingTimeline } from '@/modules/domains/food/order/OrderTrackingTimeline';
import { CourierCard } from '@/modules/domains/food/order/CourierCard';
import { EtaCountdownCard } from '@/modules/domains/food/order/EtaCountdownCard';
import { CuisineHeroBanner } from '@/modules/domains/food/cuisine/CuisineHeroBanner';
import { CuisineTagChip } from '@/modules/domains/food/cuisine/CuisineTagChip';
import { FeaturedDishCard } from '@/modules/domains/food/menu/FeaturedDishCard';
import { MenuSection, type MenuSectionItem } from '@/modules/domains/food/menu/MenuSection';

/* ─── demo data ─── */

const DEMO_MENU_SECTION: MenuSectionItem[] = [
  { name: 'Lentil soup', description: 'Red lentils, lemon, mint butter', price: '₺160', tags: ['vegetarian'] },
  { name: 'Grilled halloumi', description: 'Watermelon, basil', price: '₺240', tags: ['vegetarian', 'popular'] },
  { name: 'Stuffed vine leaves', description: 'Rice, pine nuts, currants', price: '₺240', tags: ['vegan', 'gluten-free'] },
];

const DEMO_PRICE_LIST: MenuSectionItem[] = [
  { name: 'Cut & blow-dry', price: 'from ₺600' },
  { name: 'Balayage', description: 'Including toner and care', price: 'from ₺2.500', tags: ['popular'] },
  { name: 'Gel polish', price: '₺650', tags: ['new'] },
];

const DEMO_RESTAURANT = {
  restaurantId: 'r-demo',
  name: 'Bella Napoli',
  slug: 'bella-napoli',
  description: 'Authentic Neapolitan pizza and pasta made with imported Italian ingredients.',
  cuisineTypes: ['Italian'],
  address: '12 Piazza Verde',
  city: 'New York',
  rating: 4.8,
  deliveryTimeMin: 25,
  deliveryTimeMax: 40,
  status: 'ACTIVE' as const,
};

const DEMO_RESTAURANT_CLOSED = {
  ...DEMO_RESTAURANT,
  restaurantId: 'r-demo-2',
  name: 'Sakura Bento',
  cuisineTypes: ['Japanese'],
  rating: 4.6,
  deliveryTimeMin: 30,
  deliveryTimeMax: 50,
  status: 'CLOSED' as const,
};

const DEMO_MENU_ITEM_VEG = {
  menuItemId: 'mi-demo-1',
  name: 'Margherita Pizza',
  description: 'Classic San Marzano tomato base, fior di latte mozzarella, fresh basil, extra virgin olive oil.',
  price: 14.5,
  currency: 'USD',
  imageUrl: null,
  calories: 780,
  isVegetarian: true,
  isVegan: false,
  status: 'AVAILABLE' as const,
};

const DEMO_MENU_ITEM_VEGAN = {
  menuItemId: 'mi-demo-2',
  name: 'Vegetable Biryani',
  description: 'Fragrant basmati rice layered with seasonal vegetables, saffron, and fried onions.',
  price: 12.0,
  currency: 'USD',
  imageUrl: null,
  calories: 710,
  isVegetarian: true,
  isVegan: true,
  status: 'AVAILABLE' as const,
};

const DEMO_MENU_ITEM_OOS = {
  menuItemId: 'mi-demo-3',
  name: 'Tonkotsu Ramen',
  description: 'Rich pork bone broth, chashu pork, soft-boiled egg, bamboo shoots.',
  price: 15.5,
  currency: 'USD',
  imageUrl: null,
  calories: 850,
  isVegetarian: false,
  isVegan: false,
  status: 'OUT_OF_STOCK' as const,
};

/* ─── builder ─── */

export function buildFoodDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'food-restaurant-status-badge',
      title: 'RestaurantStatusBadge',
      category: 'Domain',
      abbr: 'RS',
      description: 'Displays restaurant operational status with semantic colour coding.',
      filePath: 'modules/domains/food/restaurant/RestaurantStatusBadge.tsx',
      sourceCode: `import { RestaurantStatusBadge } from '@/modules/domains/food/restaurant/RestaurantStatusBadge';
<RestaurantStatusBadge status="ACTIVE" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['ACTIVE', 'INACTIVE', 'CLOSED'] as const).map((s) => (
                <RestaurantStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['ACTIVE', 'INACTIVE', 'CLOSED'] as const).map((s) => (
  <RestaurantStatusBadge key={s} status={s} />
))}`,
        },
        {
          title: 'Sizes',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <RestaurantStatusBadge status="ACTIVE" size="sm" />
              <RestaurantStatusBadge status="ACTIVE" size="md" />
            </div>
          ),
          code: `<RestaurantStatusBadge status="ACTIVE" size="sm" />
<RestaurantStatusBadge status="ACTIVE" size="md" />`,
        },
      ],
    },
    {
      id: 'food-order-status-badge',
      title: 'OrderStatusBadge',
      category: 'Domain',
      abbr: 'FO',
      description: 'Tracks a food order through its full lifecycle with semantic colours.',
      filePath: 'modules/domains/food/order/OrderStatusBadge.tsx',
      sourceCode: `import { OrderStatusBadge } from '@/modules/domains/food/order/OrderStatusBadge';
<OrderStatusBadge status="PREPARING" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const).map((s) => (
                <OrderStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const).map((s) => (
  <OrderStatusBadge key={s} status={s} />
))}`,
        },
        {
          title: 'Key states',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status="PREPARING" size="sm" />
              <OrderStatusBadge status="DELIVERED" size="sm" />
              <OrderStatusBadge status="CANCELLED" size="sm" />
            </div>
          ),
          code: `<OrderStatusBadge status="PREPARING" size="sm" />
<OrderStatusBadge status="DELIVERED" size="sm" />
<OrderStatusBadge status="CANCELLED" size="sm" />`,
        },
      ],
    },
    {
      id: 'food-delivery-status-badge',
      title: 'DeliveryStatusBadge',
      category: 'Domain',
      abbr: 'DS',
      description: 'Shows courier delivery progress from assignment through completion.',
      filePath: 'modules/domains/food/order/DeliveryStatusBadge.tsx',
      sourceCode: `import { DeliveryStatusBadge } from '@/modules/domains/food/order/DeliveryStatusBadge';
<DeliveryStatusBadge status="ON_THE_WAY" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['PENDING', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'FAILED'] as const).map((s) => (
                <DeliveryStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['PENDING', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'FAILED'] as const).map((s) => (
  <DeliveryStatusBadge key={s} status={s} />
))}`,
        },
        {
          title: 'Sizes',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryStatusBadge status="ON_THE_WAY" size="sm" />
              <DeliveryStatusBadge status="ON_THE_WAY" size="md" />
            </div>
          ),
          code: `<DeliveryStatusBadge status="ON_THE_WAY" size="sm" />
<DeliveryStatusBadge status="ON_THE_WAY" size="md" />`,
        },
      ],
    },
    {
      id: 'food-restaurant-card',
      title: 'RestaurantCard',
      category: 'Domain',
      abbr: 'RC',
      description: 'Hoverable restaurant summary card with gradient image placeholder, cuisine tags, star rating, and delivery estimate.',
      filePath: 'modules/domains/food/restaurant/RestaurantCard.tsx',
      sourceCode: `import { RestaurantCard } from '@/modules/domains/food/restaurant/RestaurantCard';
<RestaurantCard restaurant={restaurant} href="/theme/food/restaurants/bella-napoli" />`,
      variants: [
        {
          title: 'Active with link',
          preview: (
            <div className="max-w-xs">
              <RestaurantCard restaurant={DEMO_RESTAURANT} href="#" />
            </div>
          ),
          code: `<RestaurantCard restaurant={restaurant} href="/restaurants/slug" />`,
        },
        {
          title: 'Closed restaurant',
          preview: (
            <div className="max-w-xs">
              <RestaurantCard restaurant={DEMO_RESTAURANT_CLOSED} />
            </div>
          ),
          code: `<RestaurantCard restaurant={{ ...restaurant, status: 'CLOSED' }} />`,
        },
      ],
    },
    {
      id: 'food-menu-item-card',
      title: 'MenuItemCard',
      category: 'Domain',
      abbr: 'MI',
      description: 'Horizontal menu item card showing name, description, dietary badges, calories, price, and an add-to-cart button.',
      filePath: 'modules/domains/food/menu/MenuItemCard.tsx',
      sourceCode: `import { MenuItemCard } from '@/modules/domains/food/menu/MenuItemCard';
<MenuItemCard item={item} onAddToCart={() => addToCart(item)} />`,
      variants: [
        {
          title: 'Vegetarian with add to cart',
          preview: (
            <div className="max-w-sm">
              <MenuItemCard item={DEMO_MENU_ITEM_VEG} onAddToCart={() => {}} />
            </div>
          ),
          code: `<MenuItemCard item={item} onAddToCart={() => addToCart(item)} />`,
        },
        {
          title: 'Vegan item',
          preview: (
            <div className="max-w-sm">
              <MenuItemCard item={DEMO_MENU_ITEM_VEGAN} onAddToCart={() => {}} />
            </div>
          ),
          code: `<MenuItemCard item={{ ...item, isVegan: true }} onAddToCart={() => addToCart(item)} />`,
        },
        {
          title: 'Out of stock',
          preview: (
            <div className="max-w-sm">
              <MenuItemCard item={DEMO_MENU_ITEM_OOS} />
            </div>
          ),
          code: `<MenuItemCard item={{ ...item, status: 'OUT_OF_STOCK' }} />`,
        },
      ],
    },
    {
      id: 'food-order-tracking-timeline',
      title: 'OrderTrackingTimeline',
      category: 'Domain',
      abbr: 'OT',
      description: 'Vertical timeline of order milestones (placed → preparing → on the way → delivered) with timestamps.',
      filePath: 'modules/domains/food/order/OrderTrackingTimeline.tsx',
      sourceCode: `import { OrderTrackingTimeline } from '@/modules/domains/food/order/OrderTrackingTimeline';
<OrderTrackingTimeline steps={[{ key: 'PLACED', label: 'Order placed', occurredAt: date }]} />`,
      variants: [
        {
          title: 'In progress',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <OrderTrackingTimeline
                steps={[
                  { key: 'PLACED',     label: 'Order placed',           occurredAt: '2026-05-08T12:10:00Z' },
                  { key: 'PREPARING',  label: 'Restaurant is preparing', occurredAt: '2026-05-08T12:12:00Z' },
                  { key: 'READY',      label: 'Ready for pickup',        occurredAt: '2026-05-08T12:34:00Z' },
                  { key: 'ON_THE_WAY', label: 'Out for delivery',        occurredAt: '2026-05-08T12:42:00Z', isCurrent: true },
                  { key: 'DELIVERED',  label: 'Delivered' },
                ]}
              />
            </div>
          ),
          code: `<OrderTrackingTimeline steps={[{ key: 'PLACED', ... }, { key: 'ON_THE_WAY', isCurrent: true }, { key: 'DELIVERED' }]} />`,
        },
        {
          title: 'Cancelled',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <OrderTrackingTimeline
                steps={[
                  { key: 'PLACED',    label: 'Order placed',  occurredAt: '2026-05-06T20:45:00Z' },
                  { key: 'CANCELLED', label: 'Order cancelled', description: 'Restaurant declined the order.', occurredAt: '2026-05-06T20:47:00Z' },
                ]}
              />
            </div>
          ),
          code: `<OrderTrackingTimeline steps={[{ key: 'PLACED', ... }, { key: 'CANCELLED', occurredAt: date }]} />`,
        },
      ],
    },
    {
      id: 'food-courier-card',
      title: 'CourierCard',
      category: 'Domain',
      abbr: 'CR',
      description: 'Delivery courier summary: avatar with online dot, vehicle, rating, and call / message actions.',
      filePath: 'modules/domains/food/order/CourierCard.tsx',
      sourceCode: `import { CourierCard } from '@/modules/domains/food/order/CourierCard';
<CourierCard courier={{ name, vehicle, rating, online }} onCall={...} onMessage={...} />`,
      variants: [
        {
          title: 'Scooter, online',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <CourierCard
                courier={{
                  name: 'Marco Bianchi',
                  rating: 4.92,
                  reviewCount: 1834,
                  vehicle: 'scooter',
                  vehicleLabel: 'Vespa · 124-AB-89',
                  online: true,
                }}
                onCall={() => undefined}
                onMessage={() => undefined}
              />
            </div>
          ),
          code: `<CourierCard courier={{ name, vehicle: 'scooter', rating: 4.9, online: true }} onCall={...} />`,
        },
        {
          title: 'Bike, no actions',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <CourierCard
                courier={{
                  name: 'Lia Patel',
                  rating: 4.78,
                  reviewCount: 612,
                  vehicle: 'bike',
                  online: false,
                }}
              />
            </div>
          ),
          code: `<CourierCard courier={{ name, vehicle: 'bike', rating: 4.78, online: false }} />`,
        },
      ],
    },
    {
      id: 'food-eta-countdown-card',
      title: 'EtaCountdownCard',
      category: 'Domain',
      abbr: 'EC',
      description: 'Live ETA tile: shows minutes remaining and arrival clock time. Auto-refreshes every 30s.',
      filePath: 'modules/domains/food/order/EtaCountdownCard.tsx',
      sourceCode: `import { EtaCountdownCard } from '@/modules/domains/food/order/EtaCountdownCard';
<EtaCountdownCard estimatedArrival={date} destinationLabel="..." />`,
      variants: [
        {
          title: 'Default',
          layout: 'stack',
          preview: (
            <div className="max-w-xs">
              <EtaCountdownCard
                estimatedArrival={new Date(Date.now() + 14 * 60_000).toISOString()}
                destinationLabel="221B Baker St · Apt 4"
              />
            </div>
          ),
          code: `<EtaCountdownCard estimatedArrival={isoString} destinationLabel="..." />`,
        },
        {
          title: 'Urgent (≤ 5 min)',
          layout: 'stack',
          preview: (
            <div className="max-w-xs">
              <EtaCountdownCard
                estimatedArrival={new Date(Date.now() + 3 * 60_000).toISOString()}
                destinationLabel="221B Baker St"
              />
            </div>
          ),
          code: `<EtaCountdownCard estimatedArrival={near} variant="urgent" />`,
        },
      ],
    },
    {
      id: 'food-cuisine-hero-banner',
      title: 'CuisineHeroBanner',
      category: 'Domain',
      abbr: 'CB',
      description: 'Hero banner for a cuisine landing page: icon, headline, description, key stats over a tinted image.',
      filePath: 'modules/domains/food/cuisine/CuisineHeroBanner.tsx',
      sourceCode: `import { CuisineHeroBanner } from '@/modules/domains/food/cuisine/CuisineHeroBanner';
<CuisineHeroBanner cuisine="Italian" description="…" icon="pizza" restaurantCount={5} averageRating={4.7} averageDeliveryMin={32} />`,
      variants: [
        {
          title: 'Italian',
          layout: 'stack',
          preview: (
            <CuisineHeroBanner
              cuisine="Italian"
              icon="pizza"
              description="Wood-fired pizzas and fresh handmade pasta from the best Italian kitchens in town."
              restaurantCount={12}
              averageRating={4.7}
              averageDeliveryMin={32}
            />
          ),
          code: `<CuisineHeroBanner cuisine="Italian" icon="pizza" description="..." restaurantCount={12} averageRating={4.7} averageDeliveryMin={32} />`,
        },
        {
          title: 'No image, gradient fallback',
          layout: 'stack',
          preview: (
            <CuisineHeroBanner
              cuisine="Japanese"
              icon="bowl"
              description="Sushi, sashimi, ramen, and seasonal specials made by chefs trained in traditional Japanese technique."
            />
          ),
          code: `<CuisineHeroBanner cuisine="Japanese" icon="bowl" description="…" />`,
        },
      ],
    },
    {
      id: 'food-cuisine-tag-chip',
      title: 'CuisineTagChip',
      category: 'Domain',
      abbr: 'TC',
      description: 'Pill button for cuisine filtering. Supports selected state and an optional result count badge.',
      filePath: 'modules/domains/food/cuisine/CuisineTagChip.tsx',
      sourceCode: `import { CuisineTagChip } from '@/modules/domains/food/cuisine/CuisineTagChip';
<CuisineTagChip label="Italian" selected count={12} />`,
      variants: [
        {
          title: 'Selected + neutral',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <CuisineTagChip label="Italian" selected count={12} />
              <CuisineTagChip label="Japanese" count={8} />
              <CuisineTagChip label="Turkish" count={5} />
              <CuisineTagChip label="Indian" count={6} />
              <CuisineTagChip label="American" count={9} />
            </div>
          ),
          code: `<CuisineTagChip label="Italian" selected count={12} />`,
        },
        {
          title: 'Without counts',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <CuisineTagChip label="Vegan" />
              <CuisineTagChip label="Healthy" selected />
              <CuisineTagChip label="Burgers" />
            </div>
          ),
          code: `<CuisineTagChip label="Healthy" selected />`,
        },
      ],
    },
    {
      id: 'food-featured-dish-card',
      title: 'FeaturedDishCard',
      category: 'Domain',
      abbr: 'FD',
      description: 'Featured/promoted dish tile: large image, restaurant attribution, rating, prep time, optional badges.',
      filePath: 'modules/domains/food/menu/FeaturedDishCard.tsx',
      sourceCode: `import { FeaturedDishCard } from '@/modules/domains/food/menu/FeaturedDishCard';
<FeaturedDishCard name="..." restaurantName="..." price={14.5} currency="USD" rating={4.8} badge="Chef pick" />`,
      variants: [
        {
          title: 'Chef pick',
          layout: 'stack',
          preview: (
            <div className="max-w-xs">
              <FeaturedDishCard
                name="Margherita Pizza"
                restaurantName="Bella Napoli"
                imageUrl="https://picsum.photos/seed/dish-mi-01/800/600"
                price={14.5}
                currency="USD"
                rating={4.8}
                reviewCount={312}
                prepTimeMin={25}
                badge="Chef pick"
              />
            </div>
          ),
          code: `<FeaturedDishCard name="Margherita Pizza" restaurantName="Bella Napoli" price={14.5} currency="USD" badge="Chef pick" />`,
        },
        {
          title: 'Hot, no badge',
          layout: 'stack',
          preview: (
            <div className="max-w-xs">
              <FeaturedDishCard
                name="Spicy Tonkotsu Ramen"
                restaurantName="Sakura Bento"
                imageUrl="https://picsum.photos/seed/dish-mi-04/800/600"
                price={15.5}
                currency="USD"
                rating={4.6}
                reviewCount={198}
                prepTimeMin={30}
                hot
              />
            </div>
          ),
          code: `<FeaturedDishCard name="Spicy Tonkotsu Ramen" restaurantName="Sakura Bento" price={15.5} currency="USD" hot />`,
        },
      ],
    },
    {
      id: 'food-menu-section',
      title: 'MenuSection',
      category: 'Domain',
      abbr: 'MS',
      description: 'A website menu or price list section: free-text prices, dietary and highlight tags, a classic dotted-leader list or cards with photos. The website counterpart of MenuItemCard.',
      filePath: 'modules/domains/food/menu/MenuSection.tsx',
      sourceCode: `import { MenuSection } from '@/modules/domains/food/menu/MenuSection';
<MenuSection title="Starters" items={items} />`,
      variants: [
        {
          title: 'Classic list (dotted leaders)',
          preview: <div className="max-w-xl"><MenuSection title="Starters" items={DEMO_MENU_SECTION} /></div>,
          code: `<MenuSection title="Starters" items={[{ name: 'Lentil soup', price: '₺160', tags: ['vegetarian'] }]} />`,
        },
        {
          title: 'Cards',
          preview: <div className="max-w-3xl"><MenuSection title="Starters" layout="cards" items={DEMO_MENU_SECTION} /></div>,
          code: `<MenuSection title="Starters" layout="cards" items={items} />`,
        },
        {
          title: 'Salon price list (no title, "from" prices)',
          preview: <div className="max-w-xl"><MenuSection items={DEMO_PRICE_LIST} /></div>,
          code: `<MenuSection items={[{ name: 'Cut & blow-dry', price: 'from ₺600' }]} />`,
        },
      ],
    },
  ];
}
