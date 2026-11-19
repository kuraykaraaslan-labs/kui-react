# IotAccessView

- **id:** `iot-access-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/access/IotAccessView.tsx`
- **status:** beta
- **since:** 2026-11

The IoT access page: pick a member or a group (members and groups searched together), then see and change which sites, assets and devices they can see; an empty state explains the page until a pick.

## Variants

### Nothing picked yet

```tsx
<IotAccessView />
```

### A member picked

```tsx
<IotAccessView defaultSubject={subject} />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><IotAccessView subject={fromUrl} onSubjectChange={toUrl} /></IotAdapterProvider>
```
