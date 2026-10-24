# AlarmBellMenu

- **id:** `iot-alarm-bell-menu`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmBellMenu.tsx`
- **status:** beta
- **since:** 2026-10

The IoT bell: the count of alarms not resolved (its dot in the colour of the worst severity), the latest open alarms with inline acknowledge, and View all.

## Variants

### With open alarms

```tsx
<AlarmBellMenu hrefs={hrefs} />
```

### Five at most

```tsx
<AlarmBellMenu hrefs={hrefs} limit={2} />
```

## Full source

```tsx
<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => `/alarms/${id}` }} />
```
