# AlarmRuleDrawer

- **id:** `iot-alarm-rule-drawer`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmRuleDrawer.tsx`
- **status:** beta
- **since:** 2026-10

Edits one alarm rule as a form (one comparison per severity, optional topic, debounce, hysteresis, runbook; or the offline delay) or as JSON for combined conditions; Apply returns it to the set.

## Variants

### Threshold rule

```tsx
<AlarmRuleDrawer open rule={threshold} … />
```

### Device offline rule

```tsx
<AlarmRuleDrawer open rule={offline} … />
```

## Full source

```tsx
<AlarmRuleDrawer open rule={rule} others={otherRules} onApply={apply} onClose={close} />
```
