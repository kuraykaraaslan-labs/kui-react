'use client';
import { useMemo, useState } from 'react';
import { RecordingTimeline, type RecordingClipRange, type RecordingMarker, type RecordingRange } from '@/modules/domains/iot/camera/RecordingTimeline';
import { Card } from '@/modules/ui/Card';
import { PageHeader } from '@/modules/ui/PageHeader';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

const HOUR = 3_600_000;
const MIN = 60_000;
const EVENTS: Record<string, string> = { motion: 'Motion', tamper: 'Tampering', video_loss: 'Video lost' };

/** A day of one camera, relative to the start of today: two outages, three events, two kept clips (one per event that was kept). */
function demoDay(dayStart: number) {
  const r = (a: number, b: number): RecordingRange => ({ from: new Date(dayStart + a), to: new Date(dayStart + b) });
  const coverage = [r(0, 6 * HOUR + 20 * MIN), r(6 * HOUR + 50 * MIN, 13 * HOUR), r(14 * HOUR + 5 * MIN, 24 * HOUR)];
  const gaps = [r(6 * HOUR + 20 * MIN, 6 * HOUR + 50 * MIN), r(13 * HOUR, 14 * HOUR + 5 * MIN)];
  const markers: RecordingMarker[] = [
    { id: 'e1', at: new Date(dayStart + 2 * HOUR + 14 * MIN), kind: 'motion' },
    { id: 'e2', at: new Date(dayStart + 9 * HOUR + 3 * MIN), kind: 'tamper' },
    { id: 'e3', at: new Date(dayStart + 18 * HOUR + 40 * MIN), kind: 'motion' },
  ];
  const clips: RecordingClipRange[] = [
    { id: 'k1', from: new Date(dayStart + 2 * HOUR + 13 * MIN), to: new Date(dayStart + 2 * HOUR + 16 * MIN) },
    { id: 'k2', from: new Date(dayStart + 9 * HOUR + 2 * MIN), to: new Date(dayStart + 9 * HOUR + 5 * MIN) },
  ];
  return { coverage, gaps, markers, clips };
}

/** /theme/iot/recordings — a camera's recordings day (NB iot_camera phase 10): the timeline the Recordings tab of a device puts above its player. */
export default function RecordingsPage() {
  const [dayStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); });
  const day = useMemo(() => demoDay(dayStart), [dayStart]);
  const [cursor, setCursor] = useState<Date | null>(null);
  const [playing, setPlaying] = useState<Date | null>(null);
  return (
    <>
      <DocumentTitle text="Recordings — IoT Theme" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <PageHeader title="Recordings" subtitle="Front door camera, today. Click the bar or use the arrow keys to choose a moment; Enter plays from there." />
        <Card className="space-y-4 p-4">
          <RecordingTimeline
            from={new Date(dayStart)}
            to={new Date(dayStart + 24 * HOUR)}
            coverage={day.coverage}
            gaps={day.gaps}
            clips={day.clips}
            markers={day.markers}
            cursor={cursor}
            onPick={setCursor}
            onPlay={() => setPlaying(cursor)}
            markerLabel={(k) => EVENTS[k ?? ''] ?? 'Event'}
          />
          <div className="flex aspect-video w-full items-center justify-center rounded-md bg-black text-sm text-white/80" role="status">
            {playing ? `The player plays the recording from ${playing.toLocaleString()} (the host's player; the demo has no video).` : 'Choose a moment on the bar and press Enter.'}
          </div>
        </Card>
      </div>
    </>
  );
}
