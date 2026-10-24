'use client';
import { RpcConsoleView } from '@/modules/domains/iot/rpc/RpcConsoleView';
import { PageHeader } from '@/modules/ui/PageHeader';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

/** /theme/iot/rpc — the fleet's command log (phase 04 §4.2): every device's requests, live; a row opens its detail. */
export default function RpcFleetPage() {
  return (
    <>
      <DocumentTitle text="Commands — IoT Theme" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <PageHeader title="Commands" subtitle="Every command sent to the devices of this workspace, newest first." />
        <RpcConsoleView />
      </div>
    </>
  );
}
