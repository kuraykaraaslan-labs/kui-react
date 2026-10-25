'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faClockRotateLeft, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { DeviceDetailView } from '@/modules/domains/iot/device/DeviceDetailView';
import { DeviceTelemetryView } from '@/modules/domains/iot/device/DeviceTelemetryView';
import { AlarmListView } from '@/modules/domains/iot/alarm/AlarmListView';
import { RpcConsoleView } from '@/modules/domains/iot/rpc/RpcConsoleView';
import { DevicePlacementPanel } from '@/modules/domains/iot/asset/DevicePlacementPanel';
import { EmptyState } from '@/modules/ui/EmptyState';
import { demoHrefs, deviceIdOfSlug } from '../../_demo/demo-hrefs';

/**
 * The client half of /theme/iot/devices/[slug]: `DeviceDetailView` with the tabs other modules contribute in NB (Alarms here
 * Commands (RPC), Placement (sites and assets, phase 08) and Telemetry (`DeviceTelemetryView`) for real; OTA as a placeholder until its phase). The open tab
 * lives in `?tab=`.
 */
export function DeviceDetailScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const deviceId = deviceIdOfSlug(slug);
  const placeholder = (icon: typeof faLocationDot, title: string, description: string) => (
    <EmptyState icon={<FontAwesomeIcon icon={icon} aria-hidden="true" />} title={title} description={description} />
  );
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <Link href={demoHrefs.devices} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" aria-hidden="true" />
        Devices
      </Link>
      <DeviceDetailView
        deviceId={deviceId}
        hrefs={{ profile: demoHrefs.profile }}
        tab={sp.get('tab') ?? undefined}
        onTabChange={(tab) => router.replace(`?tab=${tab}`, { scroll: false })}
        onDeleted={() => router.push(demoHrefs.devices)}
        extraTabs={[
          { id: 'telemetry', label: 'Telemetry', order: 40, content: <DeviceTelemetryView deviceId={deviceId} /> },
          { id: 'alarms', label: 'Alarms', order: 50, content: <AlarmListView hrefs={demoHrefs} deviceId={deviceId} embedded /> },
          { id: 'rpc', label: 'Commands', order: 60, content: <RpcConsoleView deviceId={deviceId} /> },
          { id: 'ota', label: 'OTA', order: 70, content: placeholder(faClockRotateLeft, 'Firmware updates', 'Contributed by the OTA module (phase 06).') },
          { id: 'placement', label: 'Placement', order: 80, content: <DevicePlacementPanel deviceId={deviceId} hrefs={{ asset: demoHrefs.asset }} /> },
        ]}
      />
    </div>
  );
}
