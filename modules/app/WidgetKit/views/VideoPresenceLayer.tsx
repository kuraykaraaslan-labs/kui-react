'use client';
// Its own chunk (video-presence lazy-loads it): the shared presence group and its page-level prompt need kui-player's
// React subpath, which a board without a stream never downloads.
import { useEffect, useMemo, useState } from 'react';
import { createPresenceGroup, PresencePrompt, type PresenceGroup } from '@kuraykaraaslan/kui-player/react';
import type { PartialDictionary } from '@kuraykaraaslan/kui-player/locales';
import { playerLocale } from './video-player-locale';

/**
 * One presence group for every video card of the board, and the one "Still watching?" prompt for it. It hands the group
 * up (`onGroup`) so each card can join it; a new interval is a new group, the cards rejoin on their own.
 */
export function VideoPresenceLayer({
  everyMs, graceMs, locale, onGroup,
}: {
  everyMs: number;
  graceMs: number;
  locale?: string;
  onGroup: (group: PresenceGroup | null) => void;
}) {
  // A group holds nothing until a player joins it and stops its timer when the last one leaves: nothing to dispose.
  const group = useMemo(() => createPresenceGroup({ everyMs, graceMs }), [everyMs, graceMs]);
  const [dictionary, setDictionary] = useState<PartialDictionary | undefined>(undefined);

  useEffect(() => {
    onGroup(group);
    return () => onGroup(null);
  }, [group, onGroup]);

  useEffect(() => {
    let live = true;
    playerLocale(locale).then((d) => { if (live) setDictionary(d); }).catch(() => {});
    return () => { live = false; };
  }, [locale]);

  return <PresencePrompt group={group} locale={dictionary} />;
}
