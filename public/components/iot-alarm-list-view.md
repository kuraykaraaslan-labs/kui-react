# AlarmListView

- **id:** `iot-alarm-list-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmListView.tsx`
- **status:** beta
- **since:** 2026-10

The alarm list through the IoT adapter: count chips, status / severity filters and search, server paging, selection with bulk acknowledge / clear sharing one note, live arrivals ("N new alarms") and a 30 s re-read without a live source.

## Variants

### Fixture adapter

```tsx
<AlarmListView hrefs={hrefs} />
```

### Failing adapter

```tsx
<AlarmListView hrefs={hrefs} embedded />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter} live={live}><AlarmListView hrefs={{ alarm, device }} onQueryChange={toUrl} /></IotAdapterProvider>
```
