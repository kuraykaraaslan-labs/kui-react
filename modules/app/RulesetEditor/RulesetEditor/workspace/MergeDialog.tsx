'use client';
import { Modal } from '@/modules/ui/Modal';
import type { MergeConflict, MergeResult } from '../../graph/merge';
import type { RulesetGraph } from '../hooks/useGraphEditor';
import { PrimaryButton, SecondaryButton } from '../dialogs/buttons';
import { DEFAULT_MESSAGES, useMessages, type EditorMessages } from '../messages';
import type { ConflictInfo } from './types';

function whoWhen(info: ConflictInfo, locale: string): string {
  const at = info.at ? new Date(info.at * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '?';
  return `${at}${info.by ? ` (${info.by})` : ''}`;
}

/**
 * Someone saved this flow while it was open here. The host decides what else can be done (`actions`: overwrite,
 * reload…); Merge reads the other version and merges it with the changes made here.
 */
export function ConflictDialog({ info, canMerge, busy, error, actions, onMerge, onClose }: {
  info: ConflictInfo;
  canMerge: boolean;
  busy: boolean;
  error: string | null;
  /** more buttons of the host */
  actions?: React.ReactNode;
  onMerge: () => void;
  onClose: () => void;
}) {
  const m = useMessages();
  return (
    <Modal open onClose={onClose} title={m.wsConflictTitle} size="sm"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {canMerge && <PrimaryButton onClick={onMerge} disabled={busy} data-testid="flow-merge">{busy ? m.wsMerging : m.wsMerge}</PrimaryButton>}
          {actions}
          <SecondaryButton onClick={onClose} disabled={busy}>{m.dialogCancel}</SecondaryButton>
        </div>
      }>
      <div className="space-y-2 text-sm text-text-primary">
        <p>{m.wsConflictNewer(whoWhen(info, m.wsLocale))}</p>
        {canMerge && <p className="text-text-secondary">{m.wsMergeExplain}</p>}
        {error && <p role="alert" className="text-error">{error}</p>}
      </div>
    </Modal>
  );
}

/** what a node or group of a conflict is called */
export function conflictName(c: MergeConflict, graph: RulesetGraph, m: Pick<EditorMessages, 'wsGroupName'> = DEFAULT_MESSAGES): string {
  if (c.kind === 'group') return m.wsGroupName(graph.groups.find((g) => g.groupId === c.id)?.name || c.id);
  const n = graph.nodes.find((x) => x.nodeId === c.id);
  return n ? `${n.label || n.type} (${c.id})` : c.id;
}

/** What the merge did, and the blocks both sides changed (the editor's version was kept). */
export function MergedDialog({ info, result, theirs, onClose }: { info: ConflictInfo; result: MergeResult; theirs: RulesetGraph; onClose: () => void }) {
  const m = useMessages();
  // a block you deleted is not in the merged graph: name it from the other side's graph
  const taken = result.fromTheirs.length;
  return (
    <Modal open onClose={onClose} title={m.wsMergedTitle} size="sm"
      footer={<div className="flex w-full justify-end"><PrimaryButton onClick={onClose} data-testid="flow-merge-ok">{m.wsOk}</PrimaryButton></div>}>
      <div className="space-y-3 text-sm text-text-primary">
        <p data-testid="flow-merge-summary">{m.wsMergedSummary(whoWhen(info, m.wsLocale), taken)}</p>
        {result.conflicts.length > 0 ? (
          <div>
            <p>{m.wsBothSides}</p>
            <ul data-testid="flow-merge-conflicts" className="mt-1 list-disc space-y-0.5 pl-5">
              {result.conflicts.map((c) => (
                <li key={`${c.kind}:${c.id}`}>{conflictName(c, c.deleted ? theirs : result.graph, m)}{c.deleted ? m.wsYouDeleted : ''}</li>
              ))}
            </ul>
          </div>
        ) : <p className="text-text-secondary">{m.wsNoBothSides}</p>}
        <p className="text-xs text-text-secondary">{m.wsMergedHint}</p>
      </div>
    </Modal>
  );
}
