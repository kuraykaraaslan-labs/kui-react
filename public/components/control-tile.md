# ControlTile

- **id:** `control-tile`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/ControlTile/index.ts`
- **status:** stable
- **since:** 2026-10

Async controls: a frame (`ControlTile`) plus `ControlButton`, `ControlSwitch`, `ControlSlider` and `ControlSetpoint`. Each takes the bound `value` and an `onCommit` that returns a Promise, and shows idle -> pending -> confirmed / mismatch / failed with the previous value restored on failure. The slider writes once on release. State machine: `useAsyncControl` (libs/hooks). No transport knowledge; all text is overridable through `messages`.

## Depends on

- `toggle`
- `range-slider`
- `button`

## Used by

- `widget-kit`

## Accessibility

- WCAG: AA
- ARIA patterns: switch, slider, status

The status line is an aria-live region; a failure is role="alert". Pending sets aria-busy and disables the input. A bad set-point is a field error (aria-invalid + described-by) and sends nothing.

## Design tokens consumed

- `--surface-raised`
- `--border`
- `--primary`
- `--success`
- `--warning`
- `--error`
- `--text-secondary`

## Variants

### Switch: pending then confirmed

```tsx
<ControlSwitch title="Heater" value={on} onCommit={write} />
```

### Switch: failure rolls back (with Retry)

```tsx
<ControlSwitch title="Heater" value={on} onCommit={() => Promise.reject(new Error('Device offline'))} />
```

### Switch: the device reports a different value (mismatch)

```tsx
<ControlSwitch title="Heater" value={on} reported={deviceState} timeoutMs={2500} onCommit={write} />
```

### Slider: commit on release

```tsx
<ControlSlider title="Fan speed" value={speed} min={0} max={100} step={5} unit="%" onCommit={write} />
```

### Set point: validated entry

```tsx
<ControlSetpoint title="Target temperature" value={t} min={5} max={30} step={0.5} unit="°C" decimals={1} onCommit={write} />
```

### Button: none / confirm / typed confirmation

```tsx
<ControlButton label="Reboot" confirm="typed" confirmText="reboot" onCommit={(c) => api.reboot(c)} />
```

### Read-only (no permission)

```tsx
<ControlSwitch title="Heater" value={on} readOnly onCommit={write} />
```

## Full source

```tsx
'use client';
import { ControlSwitch, ControlSlider, ControlSetpoint, ControlButton } from '@/modules/ui/ControlTile';

<ControlSwitch title="Heater" value={on} onCommit={async (next) => { await api.setHeater(next); }} />
<ControlSlider title="Fan speed" value={speed} min={0} max={100} step={5} unit="%" onCommit={(n) => api.setFan(n)} />
<ControlSetpoint title="Target" value={target} min={5} max={30} unit="°C" onCommit={(n) => api.setTarget(n)} />
<ControlButton label="Reboot" confirm="typed" confirmText="reboot" onCommit={(c) => api.reboot(c)} />
```
