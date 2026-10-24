# CfgSchemaTable

- **id:** `iot-cfg-schema-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/CfgSchemaTable.tsx`
- **status:** beta
- **since:** 2026-10

A profile’s fallback cfg.* allowlist: integer, boolean or string keys with ranges, lengths, allowed values and the write-only secret flag; read-only when the firmware describes them.

## Variants

### Editable

```tsx
<CfgSchemaTable value={keys} onChange={setKeys} />
```

### From firmware (read-only)

```tsx
<CfgSchemaTable value={keys} fromFirmware="…" />
```

## Full source

```tsx
<CfgSchemaTable value={draft.cfgSchema} onChange={(v) => set({ cfgSchema: v })} />
```
