'use client';
import { Modal } from '@/modules/ui/Modal';
import type { LinkHit } from '../../graph/links';
import { SecondaryButton } from '../dialogs/buttons';
import { useMessages } from '../messages';

/** Several places a link block leads to: pick one. `here` marks the blocks of the open flow. */
export function LinkHitsDialog({ title, hits, here, onPick, onClose }: {
  title: string;
  hits: LinkHit[];
  here: { id: string | null };
  onPick: (hit: LinkHit) => void;
  onClose: () => void;
}) {
  const m = useMessages();
  return (
    <Modal open onClose={onClose} title={title} size="sm" footer={<div className="flex w-full justify-end"><SecondaryButton onClick={onClose}>{m.wsClose}</SecondaryButton></div>}>
      <ul data-testid="flow-link-hits" className="space-y-1">
        {hits.map((h) => (
          <li key={`${h.flow}:${h.node}`}>
            <button type="button" data-testid="flow-link-hit" onClick={() => onPick(h)}
              className="w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm text-text-primary transition-colors hover:bg-primary-subtle hover:text-primary focus-visible:bg-primary-subtle focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              {h.flow === (here.id ?? '') ? '' : `${h.flowName} › `}{h.name}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
