# BarList

- **id:** `bar-list`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/BarList.tsx`
- **status:** stable
- **since:** 2026-10

A ranked breakdown for report pages: label, a bar to scale and the value, sorted by value (or label, or as given), optional share of the total, a row limit, links per row and an empty message.

## Design tokens consumed

- `--warning`

## Variants

### Revenue by channel

```tsx
<BarList showPercent valueFormatter={money} items={rows} />
```

### With counts and a limit

```tsx
<BarList limit={3} items={rows.map((r) => ({ label: r.status, value: r.value, meta: `${r.count} carts` }))} />
```

## Full source

```tsx
<BarList
  showPercent
  valueFormatter={(v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
  items={[
    { label: 'Web', value: 48210, href: '/reports/channel/web' },
    { label: 'Mobile', value: 31950 },
    { label: 'Marketplace', value: 12400, barClassName: 'bg-warning' },
  ]}
/>
```
