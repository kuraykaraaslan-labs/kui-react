# ProvisioningKeysPanel

- **id:** `iot-provisioning-keys-panel`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/ProvisioningKeysPanel.tsx`
- **status:** beta
- **since:** 2026-10

A profile’s provisioning keys through the IoT adapter (OD-1): the keys in a DataTable (key id and key, state, created, until when an old key is accepted), Create / Replace key with the days the old key keeps working, the new secret shown once with copy and “you will not see it again”, and Revoke through the ConfirmDialog with a reason and the key id typed again.

## Variants

### Keys of a customer profile

```tsx
<ProvisioningKeysPanel profileId="p1" />
```

### Keys of a factory template (no grace)

```tsx
<ProvisioningKeysPanel profileId="roltek-m1" />
```

### No key yet

```tsx
<ProvisioningKeysPanel profileId="p2" />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><ProvisioningKeysPanel profileId={id} onInfo={(i) => setServed(i.availableStrategies)} /></IotAdapterProvider>
```
