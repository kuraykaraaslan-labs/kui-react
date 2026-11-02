# SecretField

- **id:** `iot-secret-field`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/SecretField.tsx`
- **status:** beta
- **since:** 2026-11

A write-only setting (a Wi-Fi or APN password): says whether one is set, "Change" types a new one with Show / Hide, "Keep the current one" goes back. The value is never shown.

## Variants

### Set

```tsx
<SecretField label="Password" value={{ $keep: true }} … />
```

### Not set

```tsx
<SecretField label="Password" value={undefined} … />
```

## Full source

```tsx
<SecretField id="key" label="Password" value={value} onChange={setValue} />
```
