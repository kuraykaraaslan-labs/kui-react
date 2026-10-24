# TransportPolicyCard

- **id:** `iot-transport-policy-card`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/TransportPolicyCard.tsx`
- **status:** beta
- **since:** 2026-10

How a profile’s devices reach the platform: transport, TLS only or plain MQTT (OD-160, TLS by default), tokens in the URL for devices without headers (OD-161, HTTP-only) and the networks devices may connect from (invalid entries named).

## Variants

### TLS only, pinned network

```tsx
<TransportPolicyCard value={{ transportType: "ANY", mqttTransport: "TLS_REQUIRED", … }} />
```

### Plain MQTT and URL tokens (warns)

```tsx
<TransportPolicyCard value={{ mqttTransport: "PLAINTEXT_ALLOWED", allowTokenInUrl: true, … }} />
```

## Full source

```tsx
<TransportPolicyCard value={draft} onChange={(p) => set(p)} />
```
