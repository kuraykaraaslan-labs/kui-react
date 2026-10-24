# DeviceLogTimeline

- **id:** `iot-device-log-timeline`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceLogTimeline.tsx`
- **status:** beta
- **since:** 2026-10

Everything that happened to one device, newest first: the connection log (with the client address and transport) and the audited changes with who made them, a chip row All / Connections / Changes, paged; compact for short lists.

## Variants

### With the filter

```tsx
<DeviceLogTimeline entries={entries} filter={filter} onFilterChange={setFilter} />
```

### Compact (the quick view)

```tsx
<DeviceLogTimeline entries={recent} compact />
```

### Empty

```tsx
<DeviceLogTimeline entries={[]} />
```

## Full source

```tsx
<DeviceLogTimeline entries={entries} filter={filter} onFilterChange={setFilter} hasMore={more} onLoadMore={next} />
```
