'use client';
import Link from 'next/link';
import { use } from 'react';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { ForumUserCard } from '@/modules/domains/forum/user/ForumUserCard';
import { ReputationBar } from '@/modules/domains/forum/user/ReputationBar';
import { BadgeShelf } from '@/modules/domains/forum/user/BadgeShelf';
import { UserActivityRow } from '@/modules/domains/forum/user/UserActivityRow';
import { FORUM_USERS } from '../../forum.data';

export default function ForumUserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const user = FORUM_USERS.find((u) => u.username === username) ?? FORUM_USERS[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DocumentTitle text={`${user.displayName ?? user.username} — ${THEME_TITLES.forum}`} />
      <Link
        href="/theme/forum"
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary mb-4 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" aria-hidden="true" />
        Back to board index
      </Link>

      <div className="space-y-5">
        <ForumUserCard
          user={{
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            joinedAt: user.joinedAt,
            postCount: user.postCount,
            reputation: user.reputation,
            role: user.role,
            online: user.online,
            staff: user.staff,
          }}
          onFollow={() => undefined}
          onMessage={() => undefined}
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="rounded-xl border border-border bg-surface-raised shadow-sm overflow-hidden">
              <header className="border-b border-border bg-surface-overlay px-4 py-3">
                <h2 className="text-sm font-semibold text-text-primary">Recent activity</h2>
              </header>
              <ol className="flex flex-col">
                {user.activity.map((a, i) => (
                  <UserActivityRow
                    key={i}
                    kind={a.kind}
                    topicTitle={a.topicTitle}
                    topicHref={a.topicHref}
                    excerpt={a.excerpt}
                    badgeName={a.badgeName}
                    createdAt={a.createdAt}
                  />
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-5">
            <ReputationBar reputation={user.reputation} />
            <BadgeShelf badges={user.badges} />
          </aside>
        </div>
      </div>
    </div>
  );
}
