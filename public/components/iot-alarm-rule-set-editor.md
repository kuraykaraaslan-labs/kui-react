# AlarmRuleSetEditor

- **id:** `iot-alarm-rule-set-editor`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmRuleSetEditor.tsx`
- **status:** beta
- **since:** 2026-10

The alarm rules of a device profile through the IoT adapter: rule cards with the comparison per severity, add a threshold or the device-offline rule, edit in a drawer (form or JSON), remove; Save rules replaces the whole set. Read-only without canManageAlarmRules.

## Variants

### Rules

```tsx
<AlarmRuleSetEditor profileId="p1" />
```

### Read error

```tsx
<AlarmRuleSetEditor profileId="p1" />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><AlarmRuleSetEditor profileId={id} /></IotAdapterProvider>
```
