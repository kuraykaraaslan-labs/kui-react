'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import { isSuggestedAssetKind } from '../types/asset';
import { assetKindIcon, assetKindLabel } from './asset-kind';

/**
 * AssetKindBadge — the icon and label of an asset's kind (phase 08): a site, building, floor, room, area, line or machine. Kinds
 * are free (NB A-4): a kind outside the suggested list is drawn with a neutral icon and its own name.
 */
export type AssetKindBadgeProps = {
  kind: string;
  /** Icon only (the label stays for screen readers and as the tooltip). */
  iconOnly?: boolean;
  size?: 'sm' | 'md';
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function AssetKindBadge({ kind, iconOnly = false, size = 'sm', locale, messages, className }: AssetKindBadgeProps) {
  const { m } = useIotText(messages, locale);
  const label = assetKindLabel(kind, m);
  return (
    <span
      data-kind={kind.toUpperCase()}
      data-suggested={isSuggestedAssetKind(kind.toUpperCase()) ? 'true' : 'false'}
      title={iconOnly ? label : undefined}
      className={cn(
        'inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-overlay text-text-secondary',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        iconOnly && 'border-transparent bg-transparent px-0 py-0',
        className,
      )}
    >
      <FontAwesomeIcon icon={assetKindIcon(kind)} className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
    </span>
  );
}
