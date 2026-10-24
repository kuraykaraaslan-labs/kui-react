'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { AssetsView } from '@/modules/domains/iot/asset/AssetsView';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { demoHrefs } from '../_demo/demo-hrefs';

/**
 * /theme/iot/assets — "Sites & assets" (phase 08): a thin page over `AssetsView` on the demo adapter. The selected asset and its open
 * tab live in the URL (`?asset=`, `&tab=`), so a link opens the same node; NB maps the same view onto `/admin/iot/assets`.
 */
export default function AssetsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const selected = sp.get('asset');
  const tab = sp.get('tab') ?? undefined;
  const go = (asset: string | null, nextTab?: string) => {
    const p = new URLSearchParams();
    if (asset) p.set('asset', asset);
    if (asset && nextTab) p.set('tab', nextTab);
    router.replace(`/theme/iot/assets${p.size ? `?${p}` : ''}`, { scroll: false });
  };
  return (
    <>
      <DocumentTitle text="Sites & assets — IoT Theme" />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <AssetsView
          selectedId={selected}
          onSelect={(id) => go(id)}
          tab={tab}
          onTabChange={(t) => go(selected, t)}
          hrefs={{ asset: demoHrefs.asset, device: demoHrefs.device }}
        />
      </div>
    </>
  );
}
