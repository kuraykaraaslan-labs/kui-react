# Stepper

- **id:** `stepper`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Stepper.tsx`
- **status:** stable
- **since:** 2025-02

Multi-step progress indicator with complete, active, warning, error, and pending states. Supports horizontal and vertical orientations.

## Variants

### Horizontal

```tsx
<Stepper steps={[
  { label: 'Account', state: 'complete' },
  { label: 'Billing', state: 'active' },
  { label: 'Review', state: 'pending' },
  { label: 'Confirm', state: 'pending' },
]} />
```

### Vertical

```tsx
<Stepper orientation="vertical" steps={[
  { label: 'Create account', state: 'complete' },
  { label: 'Verify email', state: 'error' },
  { label: 'Set up profile', state: 'pending' },
]} />
```

### Steps that ran with a warning

```tsx
<Stepper orientation="vertical" steps={[
  { label: 'Path analysis', state: 'complete' },
  { label: 'Shelter allocation', description: '69 % housed on site', state: 'warning' },
]} />
```

## Full source

```tsx
import { cn } from '@/libs/utils/cn';

export function Stepper({ steps, orientation = 'horizontal' }) {
  // renders step circles with connectors, supports complete/active/warning/error/pending states
}
```
