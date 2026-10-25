# DescriptionList

- **id:** `description-list`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/DescriptionList.tsx`
- **status:** stable
- **since:** 2026-10

Label/value pairs of one record for detail pages: inline (label left, value right) or stacked, 1–3 columns that collapse on a phone, a dash for empty values, monospace values and a copy button for ids and keys, wide items that span the grid.

## Variants

### Inline (key/value sheet)

```tsx
<DescriptionList items={[{ label: 'API key', value: key, mono: true, copyValue: key }, …]} />
```

### Stacked, two columns

```tsx
<DescriptionList layout="stacked" columns={2} items={items} />
```

## Full source

```tsx
<DescriptionList
  columns={2}
  items={[
    { label: 'Invoice', value: 'INV-1001', mono: true, copyValue: 'INV-1001' },
    { label: 'Status', value: <Badge variant="success">Paid</Badge> },
    { label: 'Customer', value: 'Northwind Traders' },
    { label: 'Due', value: '' }, // shows —
    { label: 'Notes', value: longText, wide: true },
  ]}
/>
```
