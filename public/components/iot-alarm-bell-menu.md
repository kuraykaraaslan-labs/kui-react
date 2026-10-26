# AlarmBellMenu

- **id:** `iot-alarm-bell-menu`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmBellMenu.tsx`
- **status:** beta
- **since:** 2026-10

The IoT bell: the count of OPEN alarms (its dot in the colour of the worst severity), the latest open alarms with inline acknowledge, Acknowledge all (behind a confirmation with an optional note), and View all. Counts and list follow the live alarm events without asking the host again (alarm-bell-state.ts); the host is asked at the start, after a reconnect, when the list runs short and every 5 minutes. In a host that already has a bell, useAlarmBellSource puts the alarms into its NotificationMenu's one list (sources): their severity look, device and site, inline Acknowledge, a click that opens the alarm, and every OPEN alarm in the badge. AlarmBellSection (a section above that list) still works.

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

### One bell, one list: the alarms are items of the notification menu

```tsx
const alarms = useAlarmBellSource({ hrefs, onNavigate: router.push });
<NotificationMenu items={notifications} sources={alarms ? [alarms] : []} />
```

## Full source

```tsx
<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => `/alarms/${id}` }} />
```
