'use client';
import { Countdown } from '@/modules/ui/Countdown';
import type { ShowcaseComponent } from '../showcase.types';

// Fixed dates keep the server and client renders equal; the countdown ticks on the client.
const NEW_YEAR = '2027-01-01T00:00:00Z';
const PAST = '2026-01-01T00:00:00Z';

export function buildCountdownData(): ShowcaseComponent[] {
  return [
    {
      id: 'countdown',
      title: 'Countdown',
      category: 'Atom',
      abbr: 'Cd',
      description:
        'Counts down to an end date: compact ("2d 4h 12m") or one box per unit, sm/md, seconds optional. Ticks once a minute (once a second with seconds), never announces each tick to screen readers (role="timer", aria-live="off") and reads the end date from a <time datetime>. Renders "--" on the server (or the server time when `now` is given) and ticks on the client, so hydration never mismatches. English and Turkish words built in, all overridable.',
      filePath: 'modules/ui/Countdown/Countdown.tsx',
      since: '2026-11',
      whenToUse: 'Time-boxed offers and campaigns (top bar, banner, pricing), event starts, deadlines.',
      whenNotToUse: 'Elapsed time or durations that do not end (use a plain formatted value or Statistic).',
      relatedTo: ['landing-promo-banner', 'statistic'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['Timer (aria-live off)'],
        notes: 'The ticking numbers sit in role="timer" with aria-live="off"; a visually hidden "Ends <time datetime>…</time>" gives the end date. No animation, so reduced motion needs no special case.',
      },
      designTokens: ['--border', '--surface-raised', '--text-primary', '--text-secondary'],
      sourceCode: `'use client';
import { Countdown } from '@/modules/ui/Countdown';

<Countdown endsAt="2027-01-01T00:00:00Z" />
<Countdown endsAt={campaign.endsAt} now={requestTime} variant="boxed" showSeconds locale="tr" onEnd={hideBanner} />`,
      variants: [
        {
          title: 'Compact (sm, md, with seconds)',
          preview: (
            <div className="flex flex-col items-start gap-3 text-text-primary">
              <Countdown endsAt={NEW_YEAR} size="sm" />
              <Countdown endsAt={NEW_YEAR} />
              <Countdown endsAt={NEW_YEAR} showSeconds />
            </div>
          ),
          code: `<Countdown endsAt="2027-01-01T00:00:00Z" size="sm" />\n<Countdown endsAt="2027-01-01T00:00:00Z" />\n<Countdown endsAt="2027-01-01T00:00:00Z" showSeconds />`,
        },
        {
          title: 'Boxed (md, sm, Turkish)',
          preview: (
            <div className="flex flex-col items-start gap-4">
              <Countdown endsAt={NEW_YEAR} variant="boxed" showSeconds />
              <Countdown endsAt={NEW_YEAR} variant="boxed" size="sm" locale="tr" />
            </div>
          ),
          code: `<Countdown endsAt="2027-01-01T00:00:00Z" variant="boxed" showSeconds />\n<Countdown endsAt="2027-01-01T00:00:00Z" variant="boxed" size="sm" locale="tr" />`,
        },
        {
          title: 'Ended',
          preview: (
            <div className="flex flex-col items-start gap-3 text-text-primary">
              <Countdown endsAt={PAST} />
              <Countdown endsAt={PAST} endedLabel="This offer has ended" variant="boxed" />
            </div>
          ),
          code: `<Countdown endsAt="2026-01-01T00:00:00Z" />\n<Countdown endsAt="2026-01-01T00:00:00Z" endedLabel="This offer has ended" variant="boxed" />`,
        },
      ],
    },
  ];
}
