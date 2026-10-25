# AlarmBellMenu

- **id:** `iot-alarm-bell-menu`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmBellMenu.tsx`
- **status:** beta
- **since:** 2026-10

The IoT bell: the count of OPEN alarms (its dot in the colour of the worst severity), the latest open alarms with inline acknowledge, Acknowledge all, and View all. In a host that already has a bell, AlarmBellSection goes inside its NotificationMenu (sections + extraCount) so there is one bell.

## Variants

### With open alarms

```tsx
<AlarmBellMenu hrefs={hrefs} />
```

### Five at most

```tsx
<AlarmBellMenu hrefs={hrefs} limit={2} />
```

### One bell: a section of the notification menu

```tsx
const [alarms, setAlarms] = useState(0);
<NotificationMenu items={items} extraCount={alarms} sections={<AlarmBellSection hrefs={hrefs} onCount={setAlarms} />} />
```

## Full source

```tsx
<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => `/alarms/${id}` }} />
```
