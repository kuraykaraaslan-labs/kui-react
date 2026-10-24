# DeviceConnectionTimeline

- **id:** `iot-device-connection-timeline`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceConnectionTimeline.tsx`
- **status:** beta
- **since:** 2026-10

A device connection log on the generic Timeline: connects, disconnects with the protocol reason, takeovers and rule switches, paged.

## Variants

### Events

```tsx
<DeviceConnectionTimeline events={events} />
```

### Empty

```tsx
<DeviceConnectionTimeline events={[]} />
```

## Full source

```tsx
<DeviceConnectionTimeline events={events} hasMore={more} onLoadMore={next} />
```
