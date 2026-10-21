'use client';
import { useMemo } from 'react';
import type { ParamChoices } from '../../catalog/types';
import type { WorkspaceFlow } from './types';

type Options = {
  flows: WorkspaceFlow[];
  /** the open flow: never offered, a flow cannot run itself */
  hereId: string | null;
};

/**
 * The choices of a Run flow block: the flows of the workspace that are callable, the open one left out. Every flow has its
 * fixed Flow input block, so a flow is callable by default: an unset `callable` means callable and only an explicit `false`
 * hides the flow. Pass the result as the `flows` list of `choices`.
 */
export function useCallableFlows({ flows, hereId }: Options): ParamChoices[string] {
  return useMemo(() => flows
    .filter((f) => f.id !== hereId && f.callable !== false)
    .map((f) => ({ value: f.id, label: f.name || f.id })), [flows, hereId]);
}
