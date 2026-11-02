'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faClockRotateLeft, faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import { DeviceProfileEditorView } from '@/modules/domains/iot/profile/DeviceProfileEditorView';
import { ProvisioningKeysPanel } from '@/modules/domains/iot/profile/ProvisioningKeysPanel';
import { useIotCapabilities } from '@/modules/domains/iot/api/IotAdapterProvider';
import type { ProvisionStrategy } from '@/modules/domains/iot/types/profile';
import { AlarmRuleSetEditor } from '@/modules/domains/iot/alarm/AlarmRuleSetEditor';
import { RpcCommandCatalogEditor } from '@/modules/domains/iot/rpc/RpcCommandCatalogEditor';
import { EmptyState } from '@/modules/ui/EmptyState';
import { demoHrefs } from '../../_demo/demo-hrefs';

/**
 * The client half of /theme/iot/profiles/[slug]: `DeviceProfileEditorView` with the tabs other modules contribute in NB (Alarm rules
 * from the alarm module and Commands from the RPC module, real here; Firmware and Flows as placeholders until their phases). The
 * Provisioning tab carries the provisioning keys (`ProvisioningKeysPanel`) for a viewer who may manage them, and offers the strategies
 * the demo host serves (`availableStrategies`, from the panel's read). The open tab lives in `?tab=`.
 */
export function ProfileEditorScreen({ profileId }: { profileId: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const caps = useIotCapabilities();
  const [strategies, setStrategies] = useState<ProvisionStrategy[] | undefined>();
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <Link href={demoHrefs.profiles} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" aria-hidden="true" />
        Device profiles
      </Link>
      <DeviceProfileEditorView
        profileId={profileId}
        tab={sp.get('tab') ?? undefined}
        onTabChange={(tab) => router.replace(`?tab=${tab}`, { scroll: false })}
        onDeleted={() => router.push(demoHrefs.profiles)}
        availableStrategies={strategies}
        provisioningKeys={caps.canManageProvisioning ? <ProvisioningKeysPanel profileId={profileId} onInfo={(i) => setStrategies(i.availableStrategies)} /> : undefined}
        extraTabs={[
          { id: 'alarm-rules', label: 'Alarm rules', order: 100, content: <AlarmRuleSetEditor profileId={profileId} /> },
          { id: 'commands', label: 'Commands', order: 110, content: <RpcCommandCatalogEditor profileId={profileId} /> },
          {
            id: 'firmware', label: 'Firmware', order: 120,
            content: <EmptyState icon={<FontAwesomeIcon icon={faClockRotateLeft} aria-hidden="true" />} title="Firmware" description="Contributed by the OTA module (phase 06)." />,
          },
          {
            id: 'flows', label: 'Flows', order: 130,
            content: <EmptyState icon={<FontAwesomeIcon icon={faDiagramProject} aria-hidden="true" />} title="Flows" description="The profile's root flow, contributed by the automation module." />,
          },
        ]}
      />
    </div>
  );
}
