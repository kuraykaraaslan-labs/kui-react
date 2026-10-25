# Timeline

- **id:** `timeline`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Timeline.tsx`
- **status:** stable
- **since:** 2026-08

Chronological activity feed with sticky day headings, `order` (newest or oldest first), step `status` (done, current, upcoming: a hollow marker) and undated entries (no or invalid `at`: drawn last without a time, never a RangeError). Grouping uses the viewer’s local day via `Intl`, not the raw ISO date — an event at 23:50 UTC otherwise lands under the wrong heading for anyone east or west of the server.

## Variants

### Grouped by day

```tsx
<Timeline
  items={activities.map((a) => ({
    id: a.activityId,
    at: a.occurredAt,
    title: a.type,
    body: a.summary,
  }))}
/>
```

### Empty, and ungrouped

```tsx
<Timeline items={[]} emptyMessage="No activity yet." />
<Timeline items={items} groupByDay={false} />
```

### Process steps: oldest first, current and upcoming, undated

```tsx
<Timeline
  order="oldest"                 // default "newest"
  items={[
    { id: 'sent', at: sentAt, title: 'Invitation sent', status: 'done' },
    { id: 'opened', at: openedAt, title: 'Opened', status: 'current' },  // aria-current="step"
    { id: 'expires', at: expiresAt, title: 'Expires', status: 'upcoming' }, // hollow, muted
    { id: 'accepted', at: null, title: 'Accepted', status: 'upcoming' },   // undated: last, no time
  ]}
/>
```

## Full source

```tsx
'use client';
// Chronological feed with sticky day headings.
export function Timeline({ items, timeZone, locale, groupByDay = true, emptyMessage = 'Nothing here yet.' }) {
  if (items.length === 0) return <p>{emptyMessage}</p>;

  // Grouping uses the VIEWER's local day. An event at 23:50 UTC belongs to a
  // different day depending on who is looking, and grouping on the raw ISO
  // date puts it under the wrong heading for anyone east or west of the server.
  const dayFormat  = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // hourCycle, not hour12:false — the latter renders midnight as hour "24".
  const timeFormat = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  // Grouping is computed BEFORE rendering. React 19 may restart a render, and
  // a closure variable mutated inside map() survives the restart and puts the
  // day headings in the wrong places.
  const sorted   = [...items].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const rendered = sorted.map((item, i) => ({
    item,
    day: dayFormat.format(new Date(item.at)),
    showDay: groupByDay && dayFormat.format(new Date(item.at)) !== (i === 0 ? null : dayFormat.format(new Date(sorted[i - 1].at))),
  }));

  return (
    <ol>
      {rendered.map(({ item, day, showDay }) => (
        <Fragment key={item.id}>
          {showDay && <li className="sticky top-0">{day}</li>}
          <li>
            <span className={TONE_CLASS[item.tone ?? 'default']}>{item.icon}</span>
            <span>{item.title}</span>
            <time dateTime={new Date(item.at).toISOString()}>{timeFormat.format(new Date(item.at))}</time>
            {item.body && <div>{item.body}</div>}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
```
