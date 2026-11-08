# StaffBadge

- **id:** `forum-staff-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/forum/user/StaffBadge.tsx`
- **status:** stable
- **since:** 2026-11

Verified-employee pill: check icon and "<Org> staff" in white on the organisation colour, with a soft ring. Shown in the post author column and on ForumUserCard.

## Design tokens consumed

- `--secondary`

## Variants

### Organisations

```tsx
<StaffBadge org="Northwind" colour="var(--secondary-active)" />
<StaffBadge org="Acme" />
```

### On ForumUserCard

```tsx
<ForumUserCard user={{ username: 'mod_jane', staff: { org: 'Northwind', colour: 'var(--secondary-active)' } }} />
```

## Full source

```tsx
import { StaffBadge } from '@/modules/domains/forum/user/StaffBadge';
<StaffBadge org="Northwind" colour="var(--secondary-active)" />
```
