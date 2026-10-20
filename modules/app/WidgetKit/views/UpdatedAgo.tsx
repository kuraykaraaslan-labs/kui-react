'use client';
import { formatUpdated } from '../card-logic';
import { useKitMessages } from '../WidgetKitContext';
import { useNow } from '../useNow';
import { Meta } from './ui';

/** "Updated 5 minutes ago": the caption of a stat card, from the time its data was read. Nothing without a time. */
export function UpdatedAgo({ at, locale }: { at: string | number | undefined; locale?: string }) {
  const m = useKitMessages().card;
  const now = useNow(30_000);
  const when = formatUpdated(at, 'relative', locale, now);
  return when ? <Meta>{m.updated(when)}</Meta> : null;
}
