# AssetsView

- **id:** `iot-assets-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetsView.tsx`
- **status:** beta
- **since:** 2026-10

The Sites & assets page through the IoT adapter: a KPI row, one DataTable of every site and asset (search over name, code or place; site, kind and alarm filters; sortable columns; server paging), a row opening the asset drawer, Map, ⋯ and New site; the filters and the open drawer belong to the host URL.

## Variants

### Fixture adapter

```tsx
<AssetsView initialQuery={q} onQueryChange={setQ} hrefs={hrefs} />
```

### Failing adapter

```tsx
<AssetsView />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><AssetsView initialQuery={fromUrl} onQueryChange={toUrl} hrefs={{ device, alarms }} /></IotAdapterProvider>
```
