# SubjectAccessPanel

- **id:** `iot-subject-access-panel`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/access/SubjectAccessPanel.tsx`
- **status:** beta
- **since:** 2026-11

What a member or group can see (restricted IoT access): for a member, a preview of what they see now (every site and device through their role or the Full IoT view group, or how many through their grants); their grants with a Site or asset / Device badge ("Removed" when the target is gone); Add a site or asset (the asset tree), Add a device (a device search) and Remove, each refreshing the preview.

## Variants

### A member with grants

```tsx
<SubjectAccessPanel subject={{ type: 'USER', id: 'u-ayse', label: 'Ayşe Kaya' }} />
```

### A member whose role sees everything

```tsx
<SubjectAccessPanel subject={{ type: 'USER', id: 'u-ada', label: 'Ada Lovelace' }} />
```

### A group, read-only

```tsx
<SubjectAccessPanel subject={{ type: 'GROUP', id: 'g-hall', label: 'Hall 2 operators' }} />
```

### Failing adapter

```tsx
<SubjectAccessPanel subject={subject} />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><SubjectAccessPanel subject={{ type: 'USER', id, label: name }} /></IotAdapterProvider>
```
