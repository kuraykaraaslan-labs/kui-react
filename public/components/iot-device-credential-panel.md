# DeviceCredentialPanel

- **id:** `iot-device-credential-panel`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceCredentialPanel.tsx`
- **status:** beta
- **since:** 2026-10

A device credential without its secret (type, client id, username, X.509 fingerprint and expiry) with Rotate behind a Popconfirm; a newly issued secret is shown once (masked, copyable) and never stored.

## Variants

### Token, just rotated

```tsx
<DeviceCredentialPanel credential={c} secret={{ token }} />
```

### X.509 and MQTT basic

```tsx
<DeviceCredentialPanel credential={{ type: 'X509_CERTIFICATE', certFingerprint }} />
```

## Full source

```tsx
<DeviceCredentialPanel credential={c} secret={issued} onSecretDismiss={() => setIssued(null)} onRotate={rotate} />
```
