# ProvisioningSettingsCard

- **id:** `iot-provisioning-settings-card`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/ProvisioningSettingsCard.tsx`
- **status:** beta
- **since:** 2026-10

A profile’s provisioning strategy (strategies the host cannot serve yet are marked) and its provisioning keys; without the host’s key management the keys are a clearly disabled placeholder and no secret is ever drawn (OD-1).

## Variants

### No provisioning yet (placeholder)

```tsx
<ProvisioningSettingsCard strategy="DISABLED" />
```

### Strategies offered

```tsx
<ProvisioningSettingsCard strategy="CHECK_PRE_PROVISIONED_DEVICES" availableStrategies={[…]} />
```

### With the keys panel

```tsx
<ProvisioningSettingsCard strategy={draft.provisionStrategy} availableStrategies={served} keys={<ProvisioningKeysPanel profileId={id} />} />
```

## Full source

```tsx
<ProvisioningSettingsCard strategy={draft.provisionStrategy} availableStrategies={['DISABLED']} />
```
