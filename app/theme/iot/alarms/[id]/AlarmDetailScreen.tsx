'use client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { AlarmDetailView } from '@/modules/domains/iot/alarm/AlarmDetailView';
import { demoHrefs } from '../../_demo/demo-hrefs';

/** The client half of /theme/iot/alarms/[id]: the view with the demo's routes (functions cannot cross the server boundary). */
export function AlarmDetailScreen({ alarmId }: { alarmId: string }) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <Link href={demoHrefs.alarms} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" aria-hidden="true" />
        Alarms
      </Link>
      <AlarmDetailView
        alarmId={alarmId}
        hrefs={{ device: demoHrefs.device, rule: () => '/theme/iot', flow: () => '/theme/iot/rulesets' }}
      />
    </div>
  );
}
