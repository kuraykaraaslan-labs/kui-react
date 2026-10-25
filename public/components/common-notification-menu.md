# NotificationMenu

- **id:** `common-notification-menu`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/notification/NotificationMenu.tsx`
- **status:** stable
- **since:** 2025-05

Bell icon button with unread count badge. Opens a dropdown panel showing notification items grouped by read/unread state with variant color dots, timestamps, and mark-all-read / view-all actions. `sections` puts more of the same bell above the list (an alarm section, say) and `extraCount` adds its count to the badge, so a host shows one bell. The panel stays inside the visible screen on a phone.

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
