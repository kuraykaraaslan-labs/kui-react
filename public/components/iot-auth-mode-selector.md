# AuthModeSelector

- **id:** `iot-auth-mode-selector`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/AuthModeSelector.tsx`
- **status:** beta
- **since:** 2026-10

The authentication modes a profile allows: access token, MQTT basic (always a username and a password, OD-163: no client-ID-only mode) and X.509; at least one; locked for an X.509-only template.

## Variants

### Token and MQTT basic

```tsx
<AuthModeSelector value={['ACCESS_TOKEN', 'MQTT_BASIC']} />
```

### Locked to X.509

```tsx
<AuthModeSelector value={['X509_CERTIFICATE']} locked />
```

## Full source

```tsx
<AuthModeSelector value={allowedAuthModes} onChange={set} />
```
