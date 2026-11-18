'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import type { TopicStatus } from '../types';

const statusMeta: Record<TopicStatus, { label: string; variant: 'success' | 'warning' | 'primary' | 'neutral' | 'error' }> = {
  OPEN:     { label: 'Open',     variant: 'success' },
  LOCKED:   { label: 'Locked',   variant: 'warning' },
  PINNED:   { label: 'Pinned',   variant: 'primary' },
  ARCHIVED: { label: 'Archived', variant: 'neutral' },
  DELETED:  { label: 'Deleted',  variant: 'error' },
};

type TopicStatusBadgeProps = { status: TopicStatus; size?: 'sm' | 'md'; className?: string };

export function TopicStatusBadge({ status, size = 'md', className }: TopicStatusBadgeProps) {
  const meta = statusMeta[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={meta.variant} size={size} dot className={className}>{meta.label}</Badge>;
}

type TopicSolvedBadgeProps = { label?: string; size?: 'sm' | 'md'; className?: string };

/**
 * "Solved": the topic has an accepted solution (`ForumTopic.solutionPostId`). Solved is not a `TopicStatus`: it sits
 * beside the status, so a solved topic can still be open, locked or pinned.
 */
export function TopicSolvedBadge({ label = 'Solved', size = 'md', className }: TopicSolvedBadgeProps) {
  return (
    <Badge variant="success" size={size} className={className}>
      <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}
