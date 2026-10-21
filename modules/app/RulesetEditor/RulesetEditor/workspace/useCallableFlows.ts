'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParamChoices } from '../../catalog/types';
import type { LinkFlow } from '../../graph/links';
import { FLOW_INPUT } from '../../graph/types';
import type { WorkspaceFlow } from './types';

type Options = {
  flows: WorkspaceFlow[];
  /** the open flow: never offered, a flow cannot run itself */
  hereId: string | null;
  /** the host loads flows with their blocks; used to find out which flows have a Flow input block */
  loadFlows?: (ids: string[]) => Promise<LinkFlow[] | null | undefined>;
  /** the catalog has a block that asks for the list (a Run flow block); without one nothing is loaded */
  enabled?: boolean;
};

/**
 * The choices of a Run flow block: the flows of the workspace that are callable (have a Flow input block), the open one
 * left out. A flow the host marks with `callable` needs no look; for the others the blocks are loaded once through
 * `loadFlows`. Without `loadFlows` a flow of unknown state is offered. Pass the result as the `flows` list of `choices`.
 */
export function useCallableFlows({ flows, hereId, loadFlows, enabled = true }: Options): ParamChoices[string] {
  const others = useMemo(() => flows.filter((f) => f.id !== hereId), [flows, hereId]);
  const unknownIds = useMemo(() => others.filter((f) => typeof f.callable !== 'boolean').map((f) => f.id), [others]);
  const unknownKey = unknownIds.join('\u0000');
  const [found, setFound] = useState<Record<string, boolean>>({});
  const loadRef = useRef(loadFlows);
  useEffect(() => { loadRef.current = loadFlows; });

  useEffect(() => {
    const load = loadRef.current;
    if (!enabled || !load || !unknownKey) return;
    const ids = unknownKey.split('\u0000');
    let live = true;
    load(ids)
      .then((got) => {
        if (!live || !got) return;
        const next: Record<string, boolean> = {};
        for (const id of ids) next[id] = false;
        for (const f of got) next[f.id] = (f.nodes ?? []).some((n) => n?.type === FLOW_INPUT);
        setFound(next);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [unknownKey, enabled]);

  return useMemo(() => others
    .filter((f) => (typeof f.callable === 'boolean' ? f.callable : loadFlows ? found[f.id] === true : true))
    .map((f) => ({ value: f.id, label: f.name || f.id })), [others, loadFlows, found]);
}
