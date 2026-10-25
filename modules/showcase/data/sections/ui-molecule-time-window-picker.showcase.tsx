'use client';
import { useState } from 'react';
import { TimeWindowPicker, DEFAULT_CALENDAR_PERIODS, type TimeWindowValue } from '@/modules/ui/TimeWindowPicker';
import { TimeWindowSelect } from '@/modules/ui/TimeWindowSelect';
import type { ShowcaseComponent } from '../showcase.types';

export function buildTimeWindowPickerData(): ShowcaseComponent[] {
  return [
    {
      id: 'time-window-picker',
      title: 'TimeWindowPicker',
      category: 'Molecule',
      abbr: 'Tw',
      since: '2026-10',
      description:
        'Relative presets ("1h", "7d"), an optional custom "last N minutes / hours / days", calendar periods ("today", "previous month", optionally "so far"), an absolute UTC range, and the interval / aggregation / time zone that go with a window. Controlled: the value is a structural `TimeWindowValue`, nothing here knows about dashboards. Every label, period names included, is overridable through `messages`.',
      filePath: 'modules/ui/TimeWindowPicker.tsx',
      relatedTo: ['date-range-picker', 'time-picker'],
      designTokens: ['--primary', '--border', '--surface-base', '--surface-sunken', '--text-secondary', '--border-focus'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['radiogroup', 'group'],
        notes: 'Presets, Last, Calendar and Custom form one radiogroup; the inputs, the period select, the so-far checkbox (disabled for a past period) and the selects carry accessible names from `messages`.',
      },
      sourceCode: `'use client';
import { TimeWindowPicker, type TimeWindowValue } from '@/modules/ui/TimeWindowPicker';

const [win, setWin] = useState<TimeWindowValue | null>({ mode: 'relative', last: '24h' });
<TimeWindowPicker value={win} onChange={setWin} />`,
      variants: [
        {
          title: 'Default',
          layout: 'stack' as const,
          preview: <WindowDemo />,
          code: `<TimeWindowPicker value={win} onChange={setWin} />`,
        },
        {
          title: 'Calendar periods, custom duration and time zone',
          layout: 'stack' as const,
          preview: <WindowDemo full />,
          code: `<TimeWindowPicker value={win} onChange={setWin} calendarPeriods={DEFAULT_CALENDAR_PERIODS} allowDuration showTimezone />`,
        },
        {
          title: 'Presets only',
          layout: 'stack' as const,
          preview: <WindowDemo compact />,
          code: `<TimeWindowPicker value={win} onChange={setWin} presets={['1h', '24h', '7d']} allowAbsolute={false} showInterval={false} showAggregation={false} />`,
        },
      ],
    },
    {
      id: 'time-window-select',
      title: 'TimeWindowSelect',
      category: 'Molecule',
      abbr: 'TW',
      since: '2026-10',
      description:
        'A time window behind one button, the dashboard way: the button names the window and opens a panel with Realtime (last N sliding, or the current calendar period, optionally so far) and History (last N anchored when applied, a fixed range typed in the window\'s zone, or a past period). Aggregation, grouping interval with a bucket estimate, and time zone apply to both. Edits are a draft until Update. Same `TimeWindowValue` as TimeWindowPicker.',
      filePath: 'modules/ui/TimeWindowSelect.tsx',
      relatedTo: ['time-window-picker', 'popover', 'date-range-picker'],
      designTokens: ['--primary', '--primary-fg', '--border', '--surface-base', '--surface-sunken', '--surface-raised', '--text-secondary', '--border-focus', '--warning'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['dialog', 'tablist', 'radiogroup', 'status'],
        notes: 'The trigger has aria-haspopup="dialog" and aria-expanded; Realtime / History are tabs (arrow keys); every input has an accessible name from `messages`; the bucket estimate is a status; Escape and Cancel discard the draft.',
      },
      sourceCode: `'use client';
import { TimeWindowSelect } from '@/modules/ui/TimeWindowSelect';
import type { TimeWindowValue } from '@/modules/ui/TimeWindowPicker';

const [win, setWin] = useState<TimeWindowValue | null>({ mode: 'relative', last: '24h' });
<TimeWindowSelect value={win} onChange={setWin} />`,
      variants: [
        {
          title: 'Default',
          layout: 'stack' as const,
          preview: <SelectDemo />,
          code: `<TimeWindowSelect value={win} onChange={setWin} />`,
        },
        {
          title: 'History range in a chosen zone, no period options',
          layout: 'stack' as const,
          preview: <SelectDemo history />,
          code: `<TimeWindowSelect value={{ mode: 'absolute', from, to, timezone: 'Europe/Istanbul' }} onChange={setWin} calendarPeriods={[]} />`,
        },
      ],
    },
  ];
}

function SelectDemo({ history = false }: { history?: boolean }) {
  const [w, setW] = useState<TimeWindowValue | null>(history
    ? { mode: 'absolute', from: '2026-10-16T05:00:00.000Z', to: '2026-10-16T17:00:00.000Z', timezone: 'Europe/Istanbul', interval: '1h' }
    : { mode: 'relative', last: '24h', interval: '5m', aggregation: 'avg' });
  return (
    <div className="min-w-0 max-w-full space-y-2">
      <TimeWindowSelect value={w} onChange={setW} idPrefix={history ? 'tws-history' : 'tws-demo'} {...(history ? { calendarPeriods: [] } : {})} />
      <pre className="whitespace-pre-wrap break-all text-xs text-text-secondary">{JSON.stringify(w)}</pre>
    </div>
  );
}

function WindowDemo({ compact = false, full = false }: { compact?: boolean; full?: boolean }) {
  const [w, setW] = useState<TimeWindowValue | null>(full ? { mode: 'calendar', period: 'current.day', soFar: true } : { mode: 'relative', last: '24h' });
  // min-w-0 max-w-full and a wrapping readout: a wide value stays inside the centred preview pane.
  return (
    <div className="min-w-0 max-w-full space-y-2">
      <TimeWindowPicker
        value={w}
        onChange={setW}
        idPrefix={compact ? 'tw-compact' : full ? 'tw-full' : 'tw-demo'}
        {...(compact ? { presets: ['1h', '24h', '7d'], allowAbsolute: false, showInterval: false, showAggregation: false } : {})}
        {...(full ? { calendarPeriods: DEFAULT_CALENDAR_PERIODS, allowDuration: true, showTimezone: true } : {})}
      />
      <pre className="whitespace-pre-wrap break-all text-xs text-text-secondary">{JSON.stringify(w)}</pre>
    </div>
  );
}
