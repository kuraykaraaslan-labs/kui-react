# MenuSection

- **id:** `food-menu-section`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/food/menu/MenuSection.tsx`
- **status:** stable
- **since:** 2026-11

A website menu or price list section: free-text prices, dietary and highlight tags, a classic dotted-leader list or cards with photos. The website counterpart of MenuItemCard.

## Variants

### Classic list (dotted leaders)

```tsx
<MenuSection title="Starters" items={[{ name: 'Lentil soup', price: '₺160', tags: ['vegetarian'] }]} />
```

### Cards

```tsx
<MenuSection title="Starters" layout="cards" items={items} />
```

### Salon price list (no title, "from" prices)

```tsx
<MenuSection items={[{ name: 'Cut & blow-dry', price: 'from ₺600' }]} />
```

## Full source

```tsx
import { MenuSection } from '@/modules/domains/food/menu/MenuSection';
<MenuSection title="Starters" items={items} />
```
