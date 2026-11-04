# DeviceProfileEditorView

- **id:** `iot-device-profile-editor-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/DeviceProfileEditorView.tsx`
- **status:** beta
- **since:** 2026-10

One device profile through the IoT adapter: General, Transport & auth, Online status, Limits, Telemetry keys, Configuration keys and Provisioning on one draft with one Save that sends only the changed fields and blocks what the host would refuse; contributed tabs (alarm rules, commands) follow. The header copies the ID, makes the profile the default, duplicates it (`onDuplicated` gets the copy) and deletes it.

## Variants

### Editable profile with contributed tabs

```tsx
<DeviceProfileEditorView profileId="p1" extraTabs={tabs} />
```

### Template copy (schemas from firmware)

```tsx
<DeviceProfileEditorView profileId="p2" tab="telemetry" />
```

## Full source

```tsx
<DeviceProfileEditorView profileId={id} extraTabs={[{ id: 'alarm-rules', label: 'Alarm rules', content: <AlarmRuleSetEditor profileId={id} /> }]} />
```
