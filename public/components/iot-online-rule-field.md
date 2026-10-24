# OnlineRuleField

- **id:** `iot-online-rule-field`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/OnlineRuleField.tsx`
- **status:** beta
- **since:** 2026-10

The online rule of a profile (OD-57): live connection, recent message (interval × factor with a live "offline after" hint) or last seen only. Required and empty on a new profile (OD-63); a rule the transport cannot serve is disabled with the reason, and a chosen one that became impossible blocks saving.

## Variants

### New profile: nothing chosen

```tsx
<OnlineRuleField value={{ onlineRule: null, … }} transport="MQTT" />
```

### Recent message on HTTP

```tsx
<OnlineRuleField value={{ onlineRule: "UPLINK_WINDOW", expectedIntervalS: 600, onlineWindowFactor: 3 }} transport="HTTP" />
```

### Live connection chosen, transport became LoRaWAN

```tsx
<OnlineRuleField value={{ onlineRule: "LIVE_SOCKET", … }} transport="LORAWAN" />
```

## Full source

```tsx
<OnlineRuleField value={{ onlineRule, expectedIntervalS, onlineWindowFactor }} transport={transportType} onChange={set} />
```
