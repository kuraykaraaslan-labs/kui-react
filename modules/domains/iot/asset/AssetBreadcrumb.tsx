'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Breadcrumb } from '@/modules/ui/Breadcrumb';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import type { AssetCrumb } from '../types/asset';
import { assetKindIcon } from './asset-kind';

/**
 * AssetBreadcrumb — an asset's path, root first, from the materialised path (phase 08 §8.2): each step with its kind icon and a link
 * when the host gives `href`. Long paths collapse in the middle (`maxItems`).
 */
export type AssetBreadcrumbProps = {
  path: AssetCrumb[];
  href?: (assetId: string) => string;
  /** The last step is the current page (no link). */
  currentLast?: boolean;
  maxItems?: number;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function AssetBreadcrumb({ path, href, currentLast = false, maxItems = 5, locale, messages, className }: AssetBreadcrumbProps) {
  const { m } = useIotText(messages, locale);
  if (!path.length) return null;
  return (
    <Breadcrumb
      ariaLabel={m.asset.breadcrumb}
      maxItems={maxItems}
      className={className}
      items={path.map((p, i) => ({
        label: p.name,
        href: href && !(currentLast && i === path.length - 1) ? href(p.assetId) : undefined,
        icon: <FontAwesomeIcon icon={assetKindIcon(p.kind)} className="h-3 w-3" aria-hidden="true" />,
      }))}
    />
  );
}
