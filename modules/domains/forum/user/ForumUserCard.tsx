'use client';
import { cn } from '@/libs/utils/cn';
import { Avatar } from '@/modules/ui/Avatar';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { StaffBadge } from './StaffBadge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarPlus,
  faComments,
  faShield,
  faStar,
} from '@fortawesome/free-solid-svg-icons';

type ForumUserCardUser = {
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  joinedAt?: Date | string;
  bio?: string;
  postCount?: number;
  reputation?: number;
  role?: 'member' | 'moderator' | 'admin';
  online?: boolean;
  /** Verified employee of an organisation: a StaffBadge beside the role. */
  staff?: { org: string; colour?: string };
};

type ForumUserCardProps = {
  user: ForumUserCardUser;
  onMessage?: () => void;
  onFollow?: () => void;
  className?: string;
};

function joinedLabel(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const ROLE_META: Record<NonNullable<ForumUserCardUser['role']>, { label: string; variant: 'primary' | 'success' | 'warning' }> = {
  admin: { label: 'Admin', variant: 'warning' },
  moderator: { label: 'Moderator', variant: 'primary' },
  member: { label: 'Member', variant: 'success' },
};

export function ForumUserCard({ user, onMessage, onFollow, className }: ForumUserCardProps) {
  const role = ROLE_META[user.role ?? 'member'];
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-surface-raised p-5 shadow-sm',
        className,
      )}
      aria-label={`Profile for ${user.username}`}
    >
      <div className="flex items-start gap-4">
        <Avatar
          src={user.avatarUrl}
          name={user.displayName ?? user.username}
          size="xl"
          status={user.online ? 'online' : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-text-primary">
              {user.displayName ?? user.username}
            </h2>
            <Badge variant={role.variant} size="sm">
              <FontAwesomeIcon
                icon={user.role === 'admin' ? faShield : user.role === 'moderator' ? faStar : faComments}
                className="w-3 h-3 mr-1"
                aria-hidden="true"
              />
              {role.label}
            </Badge>
            {user.staff && <StaffBadge org={user.staff.org} colour={user.staff.colour} />}
          </div>
          <p className="text-sm text-text-secondary">@{user.username}</p>

          {user.bio && (
            <p className="mt-3 text-sm text-text-secondary leading-relaxed line-clamp-3">{user.bio}</p>
          )}

          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-text-secondary">
            {user.joinedAt && (
              <div className="flex items-center gap-1.5">
                <FontAwesomeIcon icon={faCalendarPlus} className="w-3.5 h-3.5" aria-hidden="true" />
                <dt className="sr-only">Joined</dt>
                <dd>Joined {joinedLabel(user.joinedAt)}</dd>
              </div>
            )}
            {user.postCount !== undefined && (
              <div className="flex items-center gap-1.5">
                <FontAwesomeIcon icon={faComments} className="w-3.5 h-3.5" aria-hidden="true" />
                <dt className="sr-only">Posts</dt>
                <dd>
                  <span className="font-semibold text-text-primary tabular-nums">
                    {user.postCount.toLocaleString()}
                  </span>{' '}
                  posts
                </dd>
              </div>
            )}
            {user.reputation !== undefined && (
              <div className="flex items-center gap-1.5">
                <FontAwesomeIcon icon={faStar} className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                <dt className="sr-only">Reputation</dt>
                <dd>
                  <span className="font-semibold text-text-primary tabular-nums">
                    {user.reputation.toLocaleString()}
                  </span>{' '}
                  rep
                </dd>
              </div>
            )}
          </dl>

          {(onMessage || onFollow) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {onFollow && (
                <Button variant="primary" size="sm" onClick={onFollow}>
                  Follow
                </Button>
              )}
              {onMessage && (
                <Button variant="outline" size="sm" onClick={onMessage}>
                  Message
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
