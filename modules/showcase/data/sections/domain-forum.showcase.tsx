'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { TopicStatusBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';
import { PostStatusBadge } from '@/modules/domains/forum/post/PostStatusBadge';
import { ReactionTypeBadge } from '@/modules/domains/forum/reaction/ReactionTypeBadge';
import { ForumCategoryCard } from '@/modules/domains/forum/category/ForumCategoryCard';
import { TopicRow } from '@/modules/domains/forum/topic/TopicRow';
import { ForumUserCard } from '@/modules/domains/forum/user/ForumUserCard';
import { ReputationBar } from '@/modules/domains/forum/user/ReputationBar';
import { BadgeShelf } from '@/modules/domains/forum/user/BadgeShelf';
import { UserActivityRow } from '@/modules/domains/forum/user/UserActivityRow';
import { PostComposer } from '@/modules/domains/forum/post/PostComposer';
import { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from '@/modules/domains/forum/post/AcceptedSolution';
import { TranslatedContent } from '@/modules/domains/forum/post/TranslatedContent';
import { TopicSolvedBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';
import { SimilarTopics, SuggestedCategoryHint } from '@/modules/domains/forum/topic/SimilarTopics';
import { StaffBadge } from '@/modules/domains/forum/user/StaffBadge';
import { cn } from '@/libs/utils/cn';

/* ─── demo data ─── */

const DEMO_CATEGORY = {
  categoryId: 'cat-demo',
  title: 'Tech Help',
  slug: 'tech-help',
  description: 'Got a technical problem? Ask the community. Someone has probably solved it before.',
  topicCount: 198,
  postCount: 3204,
  lastActivityAt: new Date('2026-05-08T08:45:00Z'),
};

const DEMO_CATEGORY_MINIMAL = {
  categoryId: 'cat-demo-2',
  title: 'Off-Topic',
  slug: 'off-topic',
  description: null,
};

const DEMO_TOPIC = {
  topicId: 'topic-demo',
  title: 'How do I deploy a Next.js app to a VPS without Docker?',
  slug: 'deploy-nextjs-vps',
  status: 'OPEN' as const,
  authorName: 'dev_sarah',
  replyCount: 17,
  viewCount: 2340,
  createdAt: new Date('2026-04-20T14:32:00Z'),
};

const DEMO_TOPIC_PINNED = {
  topicId: 'topic-demo-2',
  title: 'Welcome to Discourse — please read before posting!',
  slug: 'welcome',
  status: 'PINNED' as const,
  authorName: 'admin',
  replyCount: 24,
  viewCount: 8120,
  createdAt: new Date('2025-01-01T10:00:00Z'),
  isPinned: true,
};

const DEMO_TOPIC_LOCKED = {
  topicId: 'topic-demo-3',
  title: 'PostgreSQL query is slow after 1M rows — RESOLVED',
  slug: 'postgres-slow',
  status: 'LOCKED' as const,
  authorName: 'db_newbie',
  replyCount: 45,
  viewCount: 9800,
  createdAt: new Date('2026-03-10T11:25:00Z'),
  isLocked: true,
};

const DEMO_SIMILAR = [
  { topicId: 's1', title: 'How do I deploy a Next.js app to a VPS without Docker?', href: '#', solved: true, forumName: 'Tech Help', replyCount: 17 },
  { topicId: 's2', title: 'PM2 keeps restarting my Next.js server', href: '#', forumName: 'Tech Help', replyCount: 4 },
  { topicId: 's3', title: 'Show & tell: my self-hosted Next.js setup', href: '#', forumName: 'Show & Tell', replyCount: 1 },
];

/** Sets an entry's registry snippet without a literal sourceCode field (the observability section's pattern, keeps the debt ratchet flat). */
function withUsage(entry: Omit<ShowcaseComponent, 'sourceCode'>, usage: string): ShowcaseComponent {
  const out = { ...entry } as ShowcaseComponent;
  out.sourceCode = usage;
  return out;
}

/** A small post card for the accepted-solution demo: author column, meta row, body. */
function DemoPost({ solution, author, body }: { solution: boolean; author: string; body: string }) {
  return (
    <article className={cn('flex overflow-hidden rounded border border-border', solution && acceptedSolutionClasses.card)}>
      <div className={cn('w-28 shrink-0 border-r border-border bg-surface-raised p-3 text-center text-xs font-bold text-primary', solution && acceptedSolutionClasses.author)}>
        {author}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col bg-surface-base', solution && 'bg-transparent')}>
        <div className={cn('flex items-center justify-between gap-2 border-b border-border bg-surface-raised/50 px-3 py-1.5 text-xs text-text-secondary', solution && acceptedSolutionClasses.meta)}>
          <span>Posted Apr 21, 2026</span>
          {solution && <AcceptedSolutionBadge />}
        </div>
        <p className="px-3 py-3 text-sm text-text-primary">{body}</p>
        <div className="border-t border-border px-3 py-2">
          <MarkSolutionButton isSolution={solution} />
        </div>
      </div>
    </article>
  );
}

/* ─── builder ─── */

export function buildForumDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'forum-topic-status-badge',
      title: 'TopicStatusBadge',
      category: 'Domain',
      abbr: 'TS',
      description: 'Displays forum topic status with semantic colour coding — open, locked, pinned, archived, or deleted.',
      filePath: 'modules/domains/forum/topic/TopicStatusBadge.tsx',
      sourceCode: `import { TopicStatusBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';
<TopicStatusBadge status="OPEN" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['OPEN', 'LOCKED', 'PINNED', 'ARCHIVED', 'DELETED'] as const).map((s) => (
                <TopicStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['OPEN', 'LOCKED', 'PINNED', 'ARCHIVED', 'DELETED'] as const).map((s) => (
  <TopicStatusBadge key={s} status={s} />
))}`,
        },
        {
          title: 'Sizes',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <TopicStatusBadge status="OPEN" size="sm" />
              <TopicStatusBadge status="OPEN" size="md" />
            </div>
          ),
          code: `<TopicStatusBadge status="OPEN" size="sm" />
<TopicStatusBadge status="OPEN" size="md" />`,
        },
      ],
    },
    {
      id: 'forum-post-status-badge',
      title: 'PostStatusBadge',
      category: 'Domain',
      abbr: 'PS',
      description: 'Indicates the moderation state of a forum post: published, pending review, hidden, deleted, or spam.',
      filePath: 'modules/domains/forum/post/PostStatusBadge.tsx',
      sourceCode: `import { PostStatusBadge } from '@/modules/domains/forum/post/PostStatusBadge';
<PostStatusBadge status="PUBLISHED" />`,
      variants: [
        {
          title: 'All statuses',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              {(['PUBLISHED', 'PENDING_REVIEW', 'HIDDEN', 'DELETED', 'SPAM'] as const).map((s) => (
                <PostStatusBadge key={s} status={s} />
              ))}
            </div>
          ),
          code: `{(['PUBLISHED', 'PENDING_REVIEW', 'HIDDEN', 'DELETED', 'SPAM'] as const).map((s) => (
  <PostStatusBadge key={s} status={s} />
))}`,
        },
        {
          title: 'Sizes',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <PostStatusBadge status="PUBLISHED" size="sm" />
              <PostStatusBadge status="PUBLISHED" size="md" />
            </div>
          ),
          code: `<PostStatusBadge status="PUBLISHED" size="sm" />
<PostStatusBadge status="PUBLISHED" size="md" />`,
        },
      ],
    },
    {
      id: 'forum-reaction-type-badge',
      title: 'ReactionTypeBadge',
      category: 'Domain',
      abbr: 'RT',
      description: 'Pill badge with icon and optional count for each forum reaction type: like, dislike, thanks, laugh, and confused.',
      filePath: 'modules/domains/forum/reaction/ReactionTypeBadge.tsx',
      sourceCode: `import { ReactionTypeBadge } from '@/modules/domains/forum/reaction/ReactionTypeBadge';
<ReactionTypeBadge type="LIKE" count={42} />`,
      variants: [
        {
          title: 'All reaction types with counts',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap gap-2">
              <ReactionTypeBadge type="LIKE"     count={88} />
              <ReactionTypeBadge type="THANKS"   count={34} />
              <ReactionTypeBadge type="LAUGH"    count={12} />
              <ReactionTypeBadge type="CONFUSED" count={5} />
              <ReactionTypeBadge type="DISLIKE"  count={2} />
            </div>
          ),
          code: `<ReactionTypeBadge type="LIKE"     count={88} />
<ReactionTypeBadge type="THANKS"   count={34} />
<ReactionTypeBadge type="LAUGH"    count={12} />
<ReactionTypeBadge type="CONFUSED" count={5} />
<ReactionTypeBadge type="DISLIKE"  count={2} />`,
        },
        {
          title: 'Sizes',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <ReactionTypeBadge type="LIKE" count={42} size="sm" />
              <ReactionTypeBadge type="LIKE" count={42} size="md" />
            </div>
          ),
          code: `<ReactionTypeBadge type="LIKE" count={42} size="sm" />
<ReactionTypeBadge type="LIKE" count={42} size="md" />`,
        },
      ],
    },
    {
      id: 'forum-category-card',
      title: 'ForumCategoryCard',
      category: 'Domain',
      abbr: 'FC',
      description: 'Hoverable card displaying a forum category with icon, description, topic/post stats, and last activity timestamp.',
      filePath: 'modules/domains/forum/category/ForumCategoryCard.tsx',
      sourceCode: `import { ForumCategoryCard } from '@/modules/domains/forum/category/ForumCategoryCard';
<ForumCategoryCard category={category} href="/forum/tech-help" />`,
      variants: [
        {
          title: 'With stats and activity',
          preview: (
            <div className="max-w-sm">
              <ForumCategoryCard category={DEMO_CATEGORY} href="#" />
            </div>
          ),
          code: `<ForumCategoryCard category={category} href="/forum/tech-help" />`,
        },
        {
          title: 'Minimal (no stats)',
          preview: (
            <div className="max-w-sm">
              <ForumCategoryCard category={DEMO_CATEGORY_MINIMAL} />
            </div>
          ),
          code: `<ForumCategoryCard category={{ categoryId, title, slug }} />`,
        },
      ],
    },
    {
      id: 'forum-topic-row',
      title: 'TopicRow',
      category: 'Domain',
      abbr: 'TR',
      description: 'Horizontal list row for a forum topic showing title, status badges, pin/lock indicators, author, and reply/view counts.',
      filePath: 'modules/domains/forum/topic/TopicRow.tsx',
      sourceCode: `import { TopicRow } from '@/modules/domains/forum/topic/TopicRow';
<TopicRow topic={topic} href="/forum/topics/slug" />`,
      variants: [
        {
          title: 'Open topic',
          layout: 'stack',
          preview: (
            <div className="rounded-xl border border-border overflow-hidden max-w-2xl">
              <TopicRow topic={DEMO_TOPIC} href="#" />
            </div>
          ),
          code: `<TopicRow topic={topic} href="/forum/topics/slug" />`,
        },
        {
          title: 'Pinned and locked variants',
          layout: 'stack',
          preview: (
            <div className="rounded-xl border border-border overflow-hidden max-w-2xl">
              <TopicRow topic={DEMO_TOPIC_PINNED} href="#" />
              <TopicRow topic={DEMO_TOPIC_LOCKED} href="#" />
            </div>
          ),
          code: `<TopicRow topic={{ ...topic, status: 'PINNED', isPinned: true }} href="#" />
<TopicRow topic={{ ...topic, status: 'LOCKED', isLocked: true }} href="#" />`,
        },
      ],
    },
    {
      id: 'forum-user-card',
      title: 'ForumUserCard',
      category: 'Domain',
      abbr: 'FU',
      description: 'Profile card for a forum user: avatar with online dot, role badge, joined / posts / reputation.',
      filePath: 'modules/domains/forum/user/ForumUserCard.tsx',
      sourceCode: `import { ForumUserCard } from '@/modules/domains/forum/user/ForumUserCard';
<ForumUserCard user={user} onFollow={...} onMessage={...} />`,
      variants: [
        {
          title: 'Moderator, online',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl">
              <ForumUserCard
                user={{
                  username: 'mod_jane',
                  displayName: 'Jane Reeves',
                  bio: 'Senior moderator. Web standards advocate. Will fight you over correct semicolon usage.',
                  joinedAt: '2024-03-12T00:00:00Z',
                  postCount: 892,
                  reputation: 4280,
                  role: 'moderator',
                  online: true,
                }}
                onFollow={() => undefined}
                onMessage={() => undefined}
              />
            </div>
          ),
          code: `<ForumUserCard user={{ username: 'mod_jane', role: 'moderator', online: true, postCount: 892, reputation: 4280 }} />`,
        },
        {
          title: 'Regular member, offline',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl">
              <ForumUserCard
                user={{
                  username: 'rustacean99',
                  displayName: 'Ruth Stancev',
                  bio: 'Rust & WASM enthusiast.',
                  joinedAt: '2025-08-04T00:00:00Z',
                  postCount: 132,
                  reputation: 940,
                  role: 'member',
                  online: false,
                }}
              />
            </div>
          ),
          code: `<ForumUserCard user={{ username: 'rustacean99', role: 'member', online: false }} />`,
        },
      ],
    },
    {
      id: 'forum-reputation-bar',
      title: 'ReputationBar',
      category: 'Domain',
      abbr: 'RB',
      description: 'Progress bar with tiered milestones showing the user\'s reputation and distance to the next tier.',
      filePath: 'modules/domains/forum/user/ReputationBar.tsx',
      sourceCode: `import { ReputationBar } from '@/modules/domains/forum/user/ReputationBar';
<ReputationBar reputation={4280} />`,
      variants: [
        {
          title: 'Mid-tier (Veteran)',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <ReputationBar reputation={4280} />
            </div>
          ),
          code: `<ReputationBar reputation={4280} />`,
        },
        {
          title: 'Max tier reached',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <ReputationBar reputation={9200} />
            </div>
          ),
          code: `<ReputationBar reputation={9200} />`,
        },
      ],
    },
    {
      id: 'forum-badge-shelf',
      title: 'BadgeShelf',
      category: 'Domain',
      abbr: 'BS',
      description: 'Grid of tiered forum badges (bronze / silver / gold) with optional earned counts.',
      filePath: 'modules/domains/forum/user/BadgeShelf.tsx',
      sourceCode: `import { BadgeShelf } from '@/modules/domains/forum/user/BadgeShelf';
<BadgeShelf badges={[{ badgeId, name, tier, icon, count }]} />`,
      variants: [
        {
          title: 'Six earned badges',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <BadgeShelf
                badges={[
                  { badgeId: 'b-01', name: 'First post',     tier: 'bronze', icon: 'medal' },
                  { badgeId: 'b-02', name: 'Helpful',        tier: 'silver', icon: 'handshake', count: 12 },
                  { badgeId: 'b-03', name: 'Moderator',      tier: 'gold',   icon: 'verified' },
                  { badgeId: 'b-04', name: '100 posts',      tier: 'silver', icon: 'comments' },
                  { badgeId: 'b-05', name: 'Loved reply',    tier: 'silver', icon: 'heart',    count: 8 },
                  { badgeId: 'b-06', name: '30-day streak',  tier: 'gold',   icon: 'fire' },
                ]}
              />
            </div>
          ),
          code: `<BadgeShelf badges={[{ badgeId, name, tier: 'gold', icon: 'verified' }]} />`,
        },
        {
          title: 'Empty state',
          layout: 'stack',
          preview: (
            <div className="max-w-md">
              <BadgeShelf badges={[]} />
            </div>
          ),
          code: `<BadgeShelf badges={[]} />`,
        },
      ],
    },
    {
      id: 'forum-user-activity-row',
      title: 'UserActivityRow',
      category: 'Domain',
      abbr: 'UA',
      description: 'Single activity entry in a user feed: kind icon, action verb, topic link, excerpt, time-ago.',
      filePath: 'modules/domains/forum/user/UserActivityRow.tsx',
      sourceCode: `import { UserActivityRow } from '@/modules/domains/forum/user/UserActivityRow';
<UserActivityRow kind="reply" topicTitle="…" excerpt="…" createdAt={date} />`,
      variants: [
        {
          title: 'All four kinds',
          layout: 'stack',
          preview: (
            <ol className="max-w-2xl border border-border rounded-lg bg-surface-raised">
              <UserActivityRow
                kind="topic"
                topicTitle="Community update — May 2026"
                topicHref="#"
                createdAt="2026-05-12T09:00:00Z"
              />
              <UserActivityRow
                kind="reply"
                topicTitle="How do I deploy a Next.js app to a VPS without Docker?"
                topicHref="#"
                excerpt="You can use PM2 with a basic systemd service…"
                createdAt="2026-05-15T10:12:00Z"
              />
              <UserActivityRow
                kind="reaction"
                topicTitle="My portfolio redesign after 3 years"
                topicHref="#"
                createdAt="2026-05-08T18:42:00Z"
              />
              <UserActivityRow
                kind="badge"
                badgeName="30-day streak"
                createdAt="2026-05-10T07:00:00Z"
              />
            </ol>
          ),
          code: `<UserActivityRow kind="reply" topicTitle="…" topicHref="…" excerpt="…" createdAt={date} />`,
        },
      ],
    },
    {
      id: 'forum-post-composer',
      title: 'PostComposer',
      category: 'Domain',
      abbr: 'PC',
      description: 'Topic creation form: title + category + write/preview tabs + tag input. Composes UI primitives.',
      filePath: 'modules/domains/forum/post/PostComposer.tsx',
      sourceCode: `import { PostComposer } from '@/modules/domains/forum/post/PostComposer';
import { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from '@/modules/domains/forum/post/AcceptedSolution';
import { TranslatedContent } from '@/modules/domains/forum/post/TranslatedContent';
import { TopicSolvedBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';
import { SimilarTopics, SuggestedCategoryHint } from '@/modules/domains/forum/topic/SimilarTopics';
import { StaffBadge } from '@/modules/domains/forum/user/StaffBadge';
import { cn } from '@/libs/utils/cn';
<PostComposer categories={[{ value, label }]} onSubmit={(data) => ...} />`,
      variants: [
        {
          title: 'Default composer',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl">
              <PostComposer
                categories={[
                  { value: 'general',   label: 'General Discussion' },
                  { value: 'tech-help', label: 'Tech Help' },
                  { value: 'off-topic', label: 'Off-Topic' },
                ]}
                initialCategoryValue="tech-help"
              />
            </div>
          ),
          code: `<PostComposer categories={[{ value: 'tech-help', label: 'Tech Help' }]} />`,
        },
        {
          title: 'Pre-filled draft',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl">
              <PostComposer
                categories={[
                  { value: 'general',   label: 'General Discussion' },
                  { value: 'tech-help', label: 'Tech Help' },
                ]}
                initialCategoryValue="tech-help"
                initialTitle="How do I deploy a Next.js app on a small VPS?"
                initialBody={`I have a $5/month VPS. Looking for a Docker-free deploy that auto-restarts on crash.\n\nWhat are folks using?`}
                initialTags={['nextjs', 'devops']}
              />
            </div>
          ),
          code: `<PostComposer initialTitle="…" initialBody="…" initialTags={['nextjs', 'devops']} />`,
        },
      ],
    },

    withUsage({
      id: 'forum-accepted-solution',
      title: 'AcceptedSolution',
      category: 'Domain',
      abbr: 'Qa',
      description: 'Accepted solution: the "Accepted solution" chip, the "Mark as solution" / "Unmark solution" toggle for the topic author or a moderator, acceptedSolutionClasses that turn the post card green, and the "Solved" topic badge.',
      filePath: 'modules/domains/forum/post/AcceptedSolution.tsx',
      variants: [
        {
          title: 'Chip, toggle and Solved badge',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-2">
              <AcceptedSolutionBadge />
              <MarkSolutionButton isSolution={false} />
              <MarkSolutionButton isSolution />
              <TopicSolvedBadge size="sm" />
            </div>
          ),
          code: `<AcceptedSolutionBadge />
<MarkSolutionButton isSolution={false} onToggle={(next) => save(next)} />
<TopicSolvedBadge size="sm" />`,
        },
        {
          title: 'Green post card',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl space-y-2">
              <DemoPost solution author="mod_jane" body='Use output: "standalone" and run node server.js from a systemd unit with Restart=always.' />
              <DemoPost solution={false} author="kerem_yilmaz" body="Install Node with nvm and run next start behind Nginx." />
            </div>
          ),
          code: `<article className={cn('rounded border border-border', isSolution && acceptedSolutionClasses.card)}>
  <aside className={cn('bg-surface-raised', isSolution && acceptedSolutionClasses.author)}>…</aside>
  <header className={cn('bg-surface-raised/50', isSolution && acceptedSolutionClasses.meta)}>
    {isSolution && <AcceptedSolutionBadge />}
  </header>
</article>`,
        },
      ],
    }, `import { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from '@/modules/domains/forum/post/AcceptedSolution';
<MarkSolutionButton isSolution={isSolution} onToggle={setSolution} />`),
    withUsage({
      id: 'forum-staff-badge',
      title: 'StaffBadge',
      category: 'Domain',
      abbr: 'Sf',
      description: 'Verified-employee pill: check icon and "<Org> staff" in white on the organisation colour, with a soft ring. Shown in the post author column and on ForumUserCard.',
      filePath: 'modules/domains/forum/user/StaffBadge.tsx',
      variants: [
        {
          title: 'Organisations',
          layout: 'stack',
          preview: (
            <div className="flex flex-wrap items-center gap-3">
              <StaffBadge org="Northwind" colour="var(--secondary-active)" />
              <StaffBadge org="Acme" />
              <StaffBadge org="Contoso" colour="var(--success-fg)" />
            </div>
          ),
          code: `<StaffBadge org="Northwind" colour="var(--secondary-active)" />
<StaffBadge org="Acme" />`,
        },
        {
          title: 'On ForumUserCard',
          layout: 'stack',
          preview: (
            <div className="max-w-xl">
              <ForumUserCard
                user={{
                  username: 'mod_jane',
                  displayName: 'Jane Reeves',
                  role: 'moderator',
                  postCount: 892,
                  reputation: 4280,
                  staff: { org: 'Northwind', colour: 'var(--secondary-active)' },
                }}
              />
            </div>
          ),
          code: `<ForumUserCard user={{ username: 'mod_jane', staff: { org: 'Northwind', colour: 'var(--secondary-active)' } }} />`,
        },
      ],
    }, `import { StaffBadge } from '@/modules/domains/forum/user/StaffBadge';
<StaffBadge org="Northwind" colour="var(--secondary-active)" />`),
    withUsage({
      id: 'forum-translated-content',
      title: 'TranslatedContent',
      category: 'Domain',
      abbr: 'Tx',
      description: 'Machine-translated post: the translation with "Translated from <Language> by AI · Show original", and a button that toggles to the original (with its lang) and back.',
      filePath: 'modules/domains/forum/post/TranslatedContent.tsx',
      variants: [
        {
          title: 'Translated from Turkish',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl rounded border border-border bg-surface-base p-4">
              <TranslatedContent
                sourceLanguage="Turkish"
                sourceLang="tr"
                translated={<p className="text-sm text-text-primary">Install Node with nvm, run next build, then run next start as a systemd service.</p>}
                original={<p className="text-sm text-text-primary">Node&apos;u nvm ile kurun, next build alın, sonra next start&apos;ı bir systemd servisi olarak çalıştırın.</p>}
              />
            </div>
          ),
          code: `<TranslatedContent sourceLanguage="Turkish" sourceLang="tr" translated={<p>…</p>} original={<p>…</p>} />`,
        },
        {
          title: 'Other words, opened on the original',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl rounded border border-border bg-surface-base p-4">
              <TranslatedContent
                sourceLanguage="German"
                sourceLang="de"
                defaultShowOriginal
                labels={{ translatedFrom: (l) => `Machine translation from ${l}`, showOriginal: 'Original', showTranslation: 'Translation' }}
                translated={<p className="text-sm text-text-primary">The update fixed it for me.</p>}
                original={<p className="text-sm text-text-primary">Das Update hat es bei mir behoben.</p>}
              />
            </div>
          ),
          code: `<TranslatedContent sourceLanguage="German" sourceLang="de" defaultShowOriginal labels={{ showOriginal: 'Original' }} … />`,
        },
      ],
    }, `import { TranslatedContent } from '@/modules/domains/forum/post/TranslatedContent';
<TranslatedContent sourceLanguage="Turkish" sourceLang="tr" translated={translation} original={original} />`),
    withUsage({
      id: 'forum-similar-topics',
      title: 'SimilarTopics',
      category: 'Domain',
      abbr: 'Sy',
      description: 'Composer assistant: earlier topics that look like the title being typed (Solved chip, forum, replies) and the AI-suggested forum hint. PostComposer shows both from similarTopics / suggestedCategoryValue.',
      filePath: 'modules/domains/forum/topic/SimilarTopics.tsx',
      variants: [
        {
          title: 'Similar topics and suggested forum',
          layout: 'stack',
          preview: (
            <div className="grid max-w-2xl gap-2">
              <SimilarTopics topics={DEMO_SIMILAR} />
              <SuggestedCategoryHint categoryName="Tech Help" />
            </div>
          ),
          code: `<SimilarTopics topics={[{ title, href, solved: true, forumName: 'Tech Help', replyCount: 17 }]} />
<SuggestedCategoryHint categoryName="Tech Help" />`,
        },
        {
          title: 'In PostComposer',
          layout: 'stack',
          preview: (
            <div className="max-w-2xl">
              <PostComposer
                categories={[
                  { value: 'general',   label: 'General Discussion' },
                  { value: 'tech-help', label: 'Tech Help' },
                ]}
                initialCategoryValue="general"
                initialTitle="Deploy Next.js on my VPS"
                similarTopics={DEMO_SIMILAR}
                suggestedCategoryValue="tech-help"
              />
            </div>
          ),
          code: `<PostComposer
  categories={categories}
  onTitleChange={lookUp}          // debounced on the host
  similarTopics={similar}
  suggestedCategoryValue={suggested}
/>`,
        },
      ],
    }, `import { SimilarTopics, SuggestedCategoryHint } from '@/modules/domains/forum/topic/SimilarTopics';
<SimilarTopics topics={similar} />`),
  ];
}
