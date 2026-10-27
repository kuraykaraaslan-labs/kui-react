'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { AssetsView } from '@/modules/domains/iot/asset/AssetsView';
import { assetQueryFromParams, assetQueryToParams } from '@/modules/domains/iot/asset/asset-query';
import type { AssetListQuery } from '@/modules/domains/iot/api/adapter';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { demoHrefs } from '../_demo/demo-hrefs';

/**
 * /theme/iot/assets — "Sites & assets" (owner 2026-10-27, option B): a thin page over `AssetsView` on the demo adapter. The filters,
 * the sort, the rows per page and the open drawers (`?asset=`, `?map=1`) live in the URL, so a link opens the same view; NB maps the
 * same view onto `/admin/iot/assets`.
 */
export default function AssetsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  function sync(q: AssetListQuery, how: 'push' | 'replace' = 'replace') {
    const href = `/theme/iot/assets${assetQueryToParams(q)}`;
    // opening a drawer is a history step (Back closes it); filters, paging and moving between assets are not
    if (how === 'push') router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }
  return (
    <>
      <DocumentTitle text="Sites & assets — IoT Theme" />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <AssetsView
          initialQuery={assetQueryFromParams(new URLSearchParams(sp.toString()))}
          onQueryChange={sync}
          hrefs={{ asset: demoHrefs.asset, device: demoHrefs.device, alarms: () => demoHrefs.alarms }}
          moreActions={[{ id: 'devices', label: 'Devices', href: demoHrefs.devices }, { id: 'alarms', label: 'Alarms', href: demoHrefs.alarms }]}
        />
      </div>
    </>
  );
}
