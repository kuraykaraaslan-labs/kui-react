# AssetsView

- **id:** `iot-assets-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetsView.tsx`
- **status:** beta
- **since:** 2026-10

The Sites & assets page through the IoT adapter: the tree with search on the left, the selected asset on the right, New site; the selection and tab belong to the host URL.

## Variants

### Fixture adapter

```tsx
<AssetsView selectedId={id} onSelect={setId} hrefs={hrefs} />
```

### Failing adapter

```tsx
<AssetsView />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><AssetsView selectedId={id} onSelect={toUrl} hrefs={{ asset, device }} /></IotAdapterProvider>
```
