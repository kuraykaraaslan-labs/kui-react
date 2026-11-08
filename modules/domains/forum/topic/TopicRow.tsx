'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faThumbtack,
  faLock,
  faEye,
  faReply,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import { TopicStatusBadge, TopicSolvedBadge } from './TopicStatusBadge';
import type { TopicStatus } from '../types';

type TopicRowProps = {
  topic: {
    topicId: string;
    title: string;
    slug: string;
    status: TopicStatus;
    replyCount: number;
    viewCount: number;
    authorName: string;
    createdAt?: Date | string;
    isPinned?: boolean;
    isLocked?: boolean;
    /** The topic has an accepted solution: a "Solved" badge beside the status. */
    isSolved?: boolean;
  };
  href?: string;
  className?: string;
};

function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TopicRow({ topic, href, className }: TopicRowProps) {
  const body = (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Left: pin/lock icons + title + badges */}
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          {topic.isPinned && (
            <FontAwesomeIcon
              icon={faThumbtack}
              className="w-3.5 h-3.5 text-primary shrink-0"
              aria-label="Pinned"
            />
          )}
          {topic.isLocked && (
            <FontAwesomeIcon
              icon={faLock}
              className="w-3.5 h-3.5 text-warning shrink-0"
              aria-label="Locked"
            />
          )}
          <span className="font-medium text-text-primary text-sm leading-snug truncate">
            {topic.title}
          </span>
          <TopicStatusBadge status={topic.status} size="sm" />
          {topic.isSolved && <TopicSolvedBadge size="sm" />}
        </div>
        <p className="text-xs text-text-secondary">
          by{' '}
          <span className="font-medium text-text-primary">{topic.authorName}</span>
          {topic.createdAt && (
            <>
              {' · '}
              <FontAwesomeIcon icon={faClock} className="w-3 h-3 inline" aria-hidden="true" />
              {' '}
              {formatRelativeTime(topic.createdAt)}
            </>
          )}
        </p>
      </div>

      {/* Right: reply/view counts */}
      <div className="shrink-0 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1" title="Replies">
          <FontAwesomeIcon icon={faReply} className="w-3 h-3" aria-hidden="true" />
          <span className="font-medium text-text-primary">{topic.replyCount.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1 hidden sm:flex" title="Views">
          <FontAwesomeIcon icon={faEye} className="w-3 h-3" aria-hidden="true" />
          <span className="font-medium text-text-primary">{topic.viewCount.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );

  const baseClass = cn(
    'flex border-b border-border last:border-b-0 bg-surface-base',
    href && 'hover:bg-surface-overlay transition-colors cursor-pointer',
    className
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(baseClass, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus')}
      >
        {body}
      </a>
    );
  }
  return <div className={baseClass}>{body}</div>;
}
