'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell, faBellSlash, faCheck, faCircleCheck, faCircleDot, faHand, faMessage, faRobot, faShuffle, faStairs, faTriangleExclamation,
  faVolumeXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Textarea } from '@/modules/ui/Textarea';
import { Timeline, type TimelineItem } from '@/modules/ui/Timeline';
import { errorMessage } from '../api/adapter';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, toDate } from '../format';
import type { AlarmEvent } from '../types/alarm';
import type { IotMessagesInput } from '../messages';

/**
 * AlarmEventTimeline — an alarm's history on the generic `Timeline` (newest first, grouped by day): opened, severity changes,
 * acknowledge and clear with their notes, notifications, throttles, mutes, flapping, automation and operator notes. With
 * `onAddNote` a comment box appends a note (the timeline updates when the host re-reads or a live event arrives). Unknown kinds
 * render as a neutral line. Renamed under OD-9 (the old names are deprecated aliases in `index.ts`); events of the old shape still render.
 *
 * Times show their seconds and zone, in the host's zone (`timeZone`, else the provider's); a clear says why when the host tells it
 * (`reason`: by hand, its condition ended, its device or rule gone, its rule switched off). A note box is emptied once the host took
 * the note; a note the host did not take (or never answered) keeps the text and says so (NB 41-ui-fixes/24 1.14, 1.18).
 */
export type { AlarmEvent };

export type AlarmEventTimelineProps = {
  events: readonly AlarmEvent[];
  onAddNote?: (text: string) => Promise<void> | void;
  /** Longest note accepted (NB: 2 000). */
  maxNoteLength?: number;
  locale?: string;
  timeZone?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const KIND: Record<string, { icon: IconDefinition; tone: TimelineItem['tone'] }> = {
  opened: { icon: faTriangleExclamation, tone: 'error' },
  severity_changed: { icon: faStairs, tone: 'warning' },
  acknowledged: { icon: faCheck, tone: 'warning' },
  resolved: { icon: faCircleCheck, tone: 'success' },
  reopened_suppressed: { icon: faHand, tone: 'info' },
  notified: { icon: faBell, tone: 'info' },
  throttled: { icon: faBellSlash, tone: 'default' },
  muted: { icon: faVolumeXmark, tone: 'default' },
  automation: { icon: faRobot, tone: 'default' },
  note: { icon: faMessage, tone: 'info' },
  flapping: { icon: faShuffle, tone: 'warning' },
};

/** Texts of the `event` group that are not an event kind (a kind of that name renders as an unknown one). */
const NOT_KINDS = new Set(['by', 'label', 'addNote', 'notePlaceholder', 'post', 'noteAdded', 'noteFailed', 'noteAddedStale', 'empty', 'other', 'backfilled']);

export function AlarmEventTimeline({
  events, onAddNote, maxNoteLength = 2000, locale, timeZone, messages, className,
}: AlarmEventTimelineProps) {
  const { m, locale: lang, timeZone: hostZone } = useIotText(messages, locale);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleOf = (e: AlarmEvent): string => {
    if (e.kind === 'severity_changed' && e.from && e.to) {
      return fill(m.event.severity_changed, { from: m.severity[e.from], to: m.severity[e.to] });
    }
    if (e.kind === 'severity_changed') return fill(m.event.severity_changed, { from: '?', to: '?' });
    const t = (m.event as Record<string, string>)[e.kind];
    return t && !NOT_KINDS.has(e.kind) && !e.kind.startsWith('reason') ? t : m.event.other;
  };

  /** The words of a known reason (an unknown one is not shown: the title already says what happened). */
  const reasonOf = (e: AlarmEvent): string | undefined => (e.reason ? (m.event as Record<string, string>)[`reason_${e.reason}`] : undefined);

  const items: TimelineItem[] = events.map((e) => {
    const meta = KIND[e.kind] ?? { icon: faCircleDot, tone: 'default' as const };
    return {
      id: e.eventId,
      at: toDate(e.at) ?? new Date(0),
      title: (
        <span>
          {titleOf(e)}
          {e.by && <span className="ml-1.5 font-normal text-text-secondary">{fill(m.event.by, { by: e.by })}</span>}
          {e.backfilled && <Badge variant="neutral" size="sm" className="ml-1.5 align-middle">{m.event.backfilled}</Badge>}
        </span>
      ),
      body: reasonOf(e) || e.note ? (
        <>
          {reasonOf(e) && <p className="text-xs text-text-secondary">{fill(m.event.reason, { reason: reasonOf(e) as string })}</p>}
          {e.note && <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{e.note}</p>}
        </>
      ) : undefined,
      icon: <FontAwesomeIcon icon={meta.icon} className="h-3 w-3" aria-hidden="true" />,
      tone: meta.tone,
    };
  });

  async function post() {
    if (!onAddNote || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAddNote(text.trim());
      setText('');
    } catch (e) {
      // the host's words, else this box's own (a note that got no answer)
      setError(errorMessage(e, m.event.noteFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn('space-y-4 rounded-xl border border-border bg-surface-raised p-4 shadow-sm sm:p-5', className)} aria-label={m.event.label}>
      <Timeline items={items} locale={lang} timeZone={timeZone ?? hostZone} timePrecision="seconds" showTimeZone emptyMessage={m.event.empty} surface="raised" />
      {onAddNote && (
        <div className="space-y-2 border-t border-border pt-4">
          <Textarea
            id="alarm-timeline-note"
            label={m.event.addNote}
            rows={3}
            maxLength={maxNoteLength}
            placeholder={m.event.notePlaceholder}
            value={text}
            error={error ?? undefined}
            onChange={(e) => { setText(e.target.value); setError(null); }}
          />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" loading={busy} disabled={!text.trim()} onClick={() => void post()}>
              {m.event.post}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
