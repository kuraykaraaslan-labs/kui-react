# NotificationMenu

- **id:** `common-notification-menu`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/notification/NotificationMenu.tsx`
- **status:** stable
- **since:** 2025-05

Bell icon button with unread count badge. Opens a dropdown panel with one list: the notifications and the items of every other source (`sources`, the IoT alarms say) newest first, each with its colour dot or its own icon, a line under the title, a relative time in `locale` and an optional inline action. A filter All / <source> / Notifications appears with sources; "Mark all read" and each source's action (Acknowledge all) show where they apply, and the footer links to each page there is. An item with `href` is a link (a modified click opens a new tab) whose plain click runs `onClick`, so the host opens it inside the app and marks it read. `sections` still puts content above the list and `extraCount` adds to the badge. The panel stays inside the visible screen on a phone.

## Variants

### With unread notifications

```tsx
<NotificationMenu
  items={[
    { id: 'n1', title: 'New comment on your post', description: 'Jane replied to your article.', timestamp: '2 min ago', read: false, variant: 'info' },
    { id: 'n2', title: 'Payment received', description: 'Invoice #1042 paid ($153.96).', timestamp: '1 hr ago', read: false, variant: 'success' },
    { id: 'n3', title: 'Storage limit at 90%', timestamp: '3 hr ago', read: false, variant: 'warning' },
    { id: 'n4', title: 'Deployment complete', timestamp: 'Yesterday', read: true, variant: 'success' },
  ]}
  onMarkAllRead={handleMarkAllRead}
  onViewAll={() => router.push('/notifications')}
/>
```

### Empty state

```tsx
<NotificationMenu items={[]} onViewAll={() => router.push('/notifications')} />
```

### One list with another source (alarms)

```tsx
<NotificationMenu
  items={notifications}
  sources={[{
    key: 'alarms',
    label: 'Alarms',
    unread: openAlarms,
    items: alarms.map((a) => ({ id: a.id, title: a.title, meta: a.device, at: a.openedAt, read: a.acknowledged, icon: <SeverityIcon level={a.severity} />, href: `/alarms/${a.id}`, onClick: () => router.push(`/alarms/${a.id}`), action: { label: 'Acknowledge', onClick: () => acknowledge(a) } })),
    action: { label: `Acknowledge all (${openAlarms})`, onClick: confirmAcknowledgeAll },
    viewAll: { label: 'View all alarms', href: '/alarms' },
  }]}
  onMarkAllRead={markAllRead}
/>
```

## Full source

```tsx
'use client';
import { NotificationMenu } from '@/modules/domains/common/notification/NotificationMenu';

const [items, setItems] = useState(initialNotifications);

<NotificationMenu
  items={items}
  onMarkAllRead={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}
  onViewAll={() => router.push('/notifications')}
/>
```
