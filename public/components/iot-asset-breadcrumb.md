# AssetBreadcrumb

- **id:** `iot-asset-breadcrumb`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetBreadcrumb.tsx`
- **status:** beta
- **since:** 2026-10

An asset path from the materialised path, root first, each step with its kind icon and a link; long paths collapse in the middle.

## Variants

### Linked path

```tsx
<AssetBreadcrumb path={path} href={href} currentLast />
```

### Collapsed

```tsx
<AssetBreadcrumb path={path} maxItems={3} />
```

## Full source

```tsx
<AssetBreadcrumb path={asset.ancestors} href={(id) => assetHref(id)} />
```
