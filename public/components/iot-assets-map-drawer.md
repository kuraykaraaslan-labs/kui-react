# AssetsMapDrawer

- **id:** `iot-assets-map-drawer`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetsMapDrawer.tsx`
- **status:** beta
- **since:** 2026-10

The sites on the map in a wide drawer: markers coloured by the worst active alarm, the sites listed by alarm beside the map (under it on a phone), a site summary with List assets, Details and Alarms, and "Only with active alarms".

## Variants

### Fixture summary

```tsx
<AssetsMapDrawer summary={summary} onClose={close} onListAssets={filterTo} onOpenSite={open} />
```

### Without alarms

```tsx
<AssetsMapDrawer summary={{ ...summary, alarms: false }} onClose={close} onListAssets={filterTo} onOpenSite={open} />
```

## Full source

```tsx
<AssetsMapDrawer summary={summary} onClose={close} onListAssets={filterTo} onOpenSite={openDrawer} />
```
