import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { Avatar } from '@/modules/ui/Avatar';
import { Button } from '@/modules/ui/Button';
import { Breadcrumb } from '@/modules/ui/Breadcrumb';
import { TopicStatusBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';
import { ReactionTypeBadge } from '@/modules/domains/forum/reaction/ReactionTypeBadge';
import { TopicSolvedBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';
import { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from '@/modules/domains/forum/post/AcceptedSolution';
import { TranslatedContent } from '@/modules/domains/forum/post/TranslatedContent';
import { StaffBadge } from '@/modules/domains/forum/user/StaffBadge';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faThumbtack,
  faLock,
  faReply,
  faQuoteLeft,
  faFlag,
  faPencil,
  faEye,
} from '@fortawesome/free-solid-svg-icons';
import { TOPICS, POSTS, FORUM_CATEGORIES } from '../../forum.data';

export async function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = TOPICS.find((t) => t.slug === slug);
  return { title: buildPageTitle(topic?.title ?? slug, THEME_TITLES.forum) };
}

function formatPostDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatJoinDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function userRank(postCount: number) {
  if (postCount >= 1000) return 'Administrator';
  if (postCount >= 500)  return 'Senior Member';
  if (postCount >= 100)  return 'Member';
  if (postCount >= 10)   return 'Junior Member';
  return 'Newbie';
}

function userRankStars(postCount: number): number {
  if (postCount >= 1000) return 5;
  if (postCount >= 500)  return 4;
  if (postCount >= 100)  return 3;
  if (postCount >= 10)   return 2;
  return 1;
}

export default async function TopicDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) notFound();

  const category = FORUM_CATEGORIES.find((c) => c.categoryId === topic.categoryId);
  const posts = POSTS.filter((p) => p.topicId === topic.topicId);

  const relatedTopics = TOPICS
    .filter((t) => t.topicId !== topic.topicId && t.categoryId === topic.categoryId)
    .slice(0, 4);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Board index', href: '/theme/forum' },
          ...(category ? [{ label: category.title, href: `/theme/forum/topics?category=${category.slug}` }] : []),
          { label: topic.title },
        ]}
      />

      {/* Topic action bar */}
      <div className="flex items-center gap-2 my-3 flex-wrap">
        <Button
          as="a"
          href={category ? `/theme/forum/topics?category=${category.slug}` : '/theme/forum/topics'}
          variant="outline"
          size="xs"
        >
          ← {category?.title ?? 'Topics'}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {topic.status === 'OPEN' && (
            <Button as="a" href="/theme/forum" variant="primary" size="xs"
              iconLeft={<FontAwesomeIcon icon={faReply} className="w-3 h-3" aria-hidden="true" />}
            >
              Post Reply
            </Button>
          )}
          {topic.status === 'LOCKED' && (
            <div className="inline-flex items-center gap-1.5 text-xs text-warning bg-warning-subtle border border-warning/20 px-2.5 py-1 rounded font-medium">
              <FontAwesomeIcon icon={faLock} className="w-3 h-3" aria-hidden="true" />
              Topic Locked
            </div>
          )}
        </div>
      </div>

      {/* Topic title bar */}
      <div className="border border-border rounded overflow-hidden mb-3">
        <div className="bg-primary text-primary-fg px-3 py-2 flex items-center gap-2">
          {topic.isPinned && (
            <FontAwesomeIcon icon={faThumbtack} className="w-3.5 h-3.5 shrink-0" aria-label="Sticky" />
          )}
          {topic.isLocked && (
            <FontAwesomeIcon icon={faLock} className="w-3.5 h-3.5 shrink-0" aria-label="Locked" />
          )}
          <h1 className="font-bold text-sm leading-snug flex-1">{topic.title}</h1>
          <div className="flex items-center gap-3 text-xs text-primary-fg/70 shrink-0">
            <TopicStatusBadge status={topic.status} size="sm" />
            {topic.solutionPostId && <TopicSolvedBadge size="sm" />}
            <span className="flex items-center gap-1">
              <FontAwesomeIcon icon={faReply} className="w-3 h-3" aria-hidden="true" />
              {topic.replyCount}
            </span>
            <span className="flex items-center gap-1 hidden sm:flex">
              <FontAwesomeIcon icon={faEye} className="w-3 h-3" aria-hidden="true" />
              {topic.viewCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-2">
        {posts.length > 0 ? (
          posts.map((post, index) => {
            const stars = userRankStars(post.authorPostCount);
            const rank  = userRank(post.authorPostCount);
            const isSolution = topic.solutionPostId === post.postId;
            // Demo viewer: the topic's author, who may mark any reply (not their own opening post) as the solution.
            const canMarkSolution = index > 0 && post.authorName !== topic.authorName;

            return (
              <article
                key={post.postId}
                className={cn('border border-border rounded overflow-hidden', isSolution && acceptedSolutionClasses.card)}
              >
                <div className="flex">
                  {/* User sidebar */}
                  <div
                    className={cn(
                      'w-32 sm:w-40 shrink-0 bg-surface-raised border-r border-border px-3 py-3 flex flex-col items-center gap-2 text-center',
                      isSolution && acceptedSolutionClasses.author,
                    )}
                  >
                    <Avatar name={post.authorName} size="lg" />

                    <div>
                      <Link
                        href="/theme/forum"
                        className="font-bold text-primary hover:underline text-sm leading-tight block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
                      >
                        {post.authorName}
                      </Link>
                      <span className="text-xs text-text-disabled block">{rank}</span>
                      {post.staff && (
                        <StaffBadge org={post.staff.org} colour={post.staff.colour} className="mt-1" />
                      )}

                      {/* Rank stars */}
                      <div className="flex justify-center gap-0.5 mt-1" aria-label={`${stars} of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, si) => (
                          <span
                            key={si}
                            className={`text-[10px] ${si < stars ? 'text-warning' : 'text-border-strong'}`}
                            aria-hidden="true"
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-text-disabled space-y-0.5 w-full">
                      <div>Posts: <span className="text-text-secondary">{post.authorPostCount.toLocaleString()}</span></div>
                      <div>Joined: <span className="text-text-secondary">{formatJoinDate(post.createdAt)}</span></div>
                    </div>

                    {index === 0 && (
                      <span className="text-xs bg-primary-subtle border border-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                        OP
                      </span>
                    )}
                  </div>

                  {/* Post content */}
                  <div className={cn('flex-1 min-w-0 bg-surface-base flex flex-col', isSolution && 'bg-transparent')}>
                    {/* Post meta row */}
                    <div
                      className={cn(
                        'flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-surface-raised/50 text-xs',
                        isSolution && acceptedSolutionClasses.meta,
                      )}
                    >
                      <span className={cn('text-text-disabled', isSolution && 'text-current')}>
                        Posted: <span className={cn('text-text-secondary font-medium', isSolution && 'text-current')}>{formatPostDate(post.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {isSolution && <AcceptedSolutionBadge />}
                        <span className={cn('text-text-disabled', isSolution && 'text-current')}>#{index + 1}</span>
                      </span>
                    </div>

                    {/* Post body */}
                    <div className="px-4 py-4 flex-1">
                      {post.translation ? (
                        <TranslatedContent
                          sourceLanguage={post.translation.sourceLanguage}
                          sourceLang={post.translation.sourceLang}
                          translated={<p className="text-text-primary leading-relaxed text-sm">{post.content}</p>}
                          original={<p className="text-text-primary leading-relaxed text-sm">{post.translation.original}</p>}
                        />
                      ) : (
                        <p className="text-text-primary leading-relaxed text-sm">{post.content}</p>
                      )}
                    </div>

                    {/* Reactions + actions */}
                    <div className="px-4 py-2.5 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <ReactionTypeBadge type="LIKE" count={post.likeCount} size="sm" />
                        {canMarkSolution && <MarkSolutionButton isSolution={isSolution} />}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="xs"
                          iconLeft={<FontAwesomeIcon icon={faQuoteLeft} className="w-3 h-3" aria-hidden="true" />}
                        >
                          Quote
                        </Button>
                        {topic.status === 'OPEN' && (
                          <Button variant="outline" size="xs"
                            iconLeft={<FontAwesomeIcon icon={faReply} className="w-3 h-3" aria-hidden="true" />}
                          >
                            Reply
                          </Button>
                        )}
                        <Button variant="ghost" size="xs"
                          iconLeft={<FontAwesomeIcon icon={faPencil} className="w-3 h-3" aria-hidden="true" />}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="xs" className="text-error hover:bg-error-subtle"
                          iconLeft={<FontAwesomeIcon icon={faFlag} className="w-3 h-3" aria-hidden="true" />}
                        >
                          Report
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="border border-border rounded bg-surface-raised px-4 py-6 text-center text-text-secondary text-sm">
            No replies yet — be the first to post!
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
        <span>
          Page <strong className="text-text-primary">1</strong> of 1 &mdash;{' '}
          <strong className="text-text-primary">{posts.length}</strong> posts
        </span>
        <span className="px-2 py-1 border border-primary bg-primary text-primary-fg rounded font-semibold text-xs">1</span>
      </div>

      {/* Quick reply */}
      {topic.status === 'OPEN' && (
        <div className="mt-4 border border-border rounded overflow-hidden">
          <div className="bg-surface-overlay border-b border-border px-3 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Quick Reply
          </div>
          <div className="bg-surface-base p-3 space-y-2">
            <textarea
              rows={4}
              placeholder="Write your reply here…"
              className="w-full rounded border border-border bg-surface-raised text-sm text-text-primary placeholder:text-text-disabled px-3 py-2 focus:outline-none focus:ring-2 focus:ring-border-focus resize-none"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" className="rounded border-border accent-primary w-3.5 h-3.5" />
                Notify me of replies
              </label>
              <div className="flex gap-2">
                <Button variant="outline" size="xs">Preview</Button>
                <Button variant="primary" size="xs">Submit Reply</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Related / similar topics */}
      {relatedTopics.length > 0 && (
        <div className="mt-3 border border-border rounded overflow-hidden">
          <div className="bg-surface-overlay border-b border-border px-3 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Similar Topics
          </div>
          <div>
            {relatedTopics.map((t, i) => (
              <div
                key={t.topicId}
                className={`flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0 text-xs ${
                  i % 2 === 0 ? 'bg-surface-base' : 'bg-surface-raised'
                }`}
              >
                <div>
                  <Link
                    href={`/theme/forum/topics/${t.slug}`}
                    className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
                  >
                    {t.title}
                  </Link>
                  <span className="text-text-disabled ml-2">
                    by <Link href="/theme/forum" className="text-primary hover:underline">{t.authorName}</Link>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-text-disabled ml-4 shrink-0">
                  <TopicStatusBadge status={t.status} size="sm" />
                  {t.solutionPostId && <TopicSolvedBadge size="sm" />}
                  <span className="hidden sm:inline">{t.replyCount} replies</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
