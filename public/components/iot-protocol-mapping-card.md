# ProtocolMappingCard

- **id:** `iot-protocol-mapping-card`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/ProtocolMappingCard.tsx`
- **status:** beta
- **since:** 2026-10

Topic schemes (Roltek default and/or ThingsBoard compatible, at least one; ThingsBoard carries telemetry and attributes only, OD-85) and custom topics with the decided limits 8 / 128 / 50 / 4 KB (OD-35, OD-43).

## Variants

### Roltek default

```tsx
<ProtocolMappingCard value={{ topicSchemes: ['ROLTEK'], … }} />
```

### Both schemes

```tsx
<ProtocolMappingCard value={{ topicSchemes: ['ROLTEK', 'TB'], … }} />
```

## Full source

```tsx
<ProtocolMappingCard value={draft} onChange={(p) => set(p)} />
```
