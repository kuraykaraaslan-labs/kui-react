# Tour

- **id:** `tour`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/Tour/index.tsx`
- **status:** stable
- **since:** 2026-11

Guided tour over the live page: each step dims the page, cuts out its target and explains it. Driver.js draws; the runner owns the steps, the text (plain text, never HTML) and the keyboard. Steps can wait for late content, run on other pages (beforeStep) and move on when the target is clicked. RTL mirrors placement and arrow keys.

## Depends on

- `button`

## Accessibility

- WCAG: AA
- ARIA patterns: role="dialog", aria-describedby
- Keyboard:
  - `Enter / Click` — Next / Previous / Close
  - `→ / ←` — Next / previous step, on the popover or the bare page (mirrored in RTL); a focused field, list or canvas keeps its own arrows
  - `Escape` — Stop the tour

Focus moves to the step's Next button on every step and returns to where it was when the tour ends.

## Design tokens consumed

- `--surface-raised`
- `--text-primary`
- `--text-secondary`
- `--primary`
- `--border`
- `--border-focus`

## Variants

### Three steps: click to advance, a plain step, a centred step

```tsx
<Tour steps={steps} open={open} onClose={(reason, index) => setOpen(false)} />
```

### Right-to-left: placement and arrow keys mirrored

```tsx
<Tour steps={steps} open={open} dir="rtl" labels={{ next: 'التالي', previous: 'السابق', done: 'تم', close: 'إغلاق', progress: '{current} / {total}' }} onClose={() => setOpen(false)} />
```

## Full source

```tsx
'use client';
import { useState } from 'react';
import { Tour, type TourStep } from '@/modules/app/Tour';

const steps: TourStep[] = [
  { id: 'new', target: '[data-tour="demo.new"]', title: 'New rule', text: 'Start a rule here.', placement: 'bottom', advanceOn: 'click' },
  { id: 'filter', target: '[data-tour="demo.filter"]', text: 'Narrow the list.', placement: 'bottom' },
  { id: 'done', text: 'That is all. Open the tour again from the top bar.' },
];

const [open, setOpen] = useState(false);
<Button data-tour="demo.new">New rule</Button>
<Button onClick={() => setOpen(true)}>Take the tour</Button>
<Tour steps={steps} open={open} onClose={() => setOpen(false)} />
```
