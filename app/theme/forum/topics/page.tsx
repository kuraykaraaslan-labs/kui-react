import Link from 'next/link';
import type { Metadata } from 'next';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { Breadcrumb } from '@/modules/ui/Breadcrumb';
import { TopicStatusBadge, TopicSolvedBadge } from '@/modules/domains/forum/topic/TopicStatusBadge';

export const metadata: Metadata = {
  title: buildPageTitle('Topics', THEME_TITLES.forum),
};
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faThumbtack,
  faLock,
  faEnvelopeOpen,
  faEnvelope,
  faFire,
  faPenToSquare,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons';
import { TOPICS, FORUM_CATEGORIES } from '../forum.data';

function topicIcon(topic: (typeof TOPICS)[number]) {
  if (topic.isPinned)              return { icon: faThumbtack,    color: 'text-primary' };
  if (topic.isLocked)              return { icon: faLock,          color: 'text-text-disabled' };
  if (topic.viewCount > 10000)     return { icon: faFire,          color: 'text-warning' };
  if (topic.status === 'ARCHIVED') return { icon: faEnvelope,      color: 'text-text-disabled' };
  return                                  { icon: faEnvelopeOpen,  color: 'text-primary' };
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date('2026-05-09T12:00:00Z');
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function TopicsPage() {
  const pinned  = TOPICS.filter((t) => t.isPinned);
  const regular = TOPICS.filter((t) => !t.isPinned);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Board index', href: '/theme/forum' },
          { label: 'Latest Topics' },
        ]}
      />

      {/* Action bar */}
      <div className="flex items-center gap-2 my-3 flex-wrap">
        <Button
          as="a"
          href="/theme/forum"
          variant="primary"
          size="xs"
          iconLeft={<FontAwesomeIcon icon={faPenToSquare} className="w-3 h-3" aria-hidden="true" />}
        >
          New Topic
        </Button>
        <Button
          as="a"
          href="/theme/forum"
          variant="outline"
          size="xs"
          iconLeft={<FontAwesomeIcon icon={faMagnifyingGlass} className="w-3 h-3" aria-hidden="true" />}
        >
          Search this forum
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-text-secondary">Sort:</label>
          <select className="text-xs border border-border bg-surface-base text-text-primary px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-border-focus">
            <option>Latest Activity</option>
            <option>Most Replies</option>
            <option>Most Views</option>
            <option>Newest</option>
          </select>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="mb-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-text-secondary">Category:</span>
        {FORUM_CATEGORIES.map((cat) => (
          <Link key={cat.categoryId} href={`/theme/forum/topics?category=${cat.slug}`}>
            <Badge variant="neutral" size="sm">{cat.title}</Badge>
          </Link>
        ))}
      </div>

      {/* Topic table */}
      <div className="border border-border rounded overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-primary-fg grid grid-cols-[auto_1fr_auto_auto_auto] text-xs font-bold uppercase tracking-wide">
          <div className="px-3 py-2 w-8" aria-hidden="true" />
          <div className="px-2 py-2">Topics</div>
          <div className="px-3 py-2 text-center w-16 hidden sm:block">Replies</div>
          <div className="px-3 py-2 text-center w-16 hidden sm:block">Views</div>
          <div className="px-3 py-2 w-36 hidden md:block">Last post</div>
        </div>

        {/* Sticky topics */}
        {pinned.map((topic, i) => {
          const { icon, color } = topicIcon(topic);
          const cat = FORUM_CATEGORIES.find((c) => c.categoryId === topic.categoryId);
          return (
            <div
              key={topic.topicId}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] border-b border-border text-xs ${
                i % 2 === 0 ? 'bg-primary-subtle/20' : 'bg-primary-subtle/10'
              }`}
            >
              <div className="px-3 py-2.5 w-8 flex items-start justify-center pt-3">
                <FontAwesomeIcon icon={icon} className={`w-3.5 h-3.5 ${color}`} aria-hidden="true" />
              </div>
              <div className="px-2 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <TopicStatusBadge status={topic.status} size="sm" />
                  {topic.solutionPostId && <TopicSolvedBadge size="sm" />}
                  <Link
                    href={`/theme/forum/topics/${topic.slug}`}
                    className="font-semibold text-text-primary hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
                  >
                    {topic.title}
                  </Link>
                </div>
                <div className="text-text-disabled mt-0.5">
                  by{' '}
                  <Link href="/theme/forum" className="text-primary hover:underline">{topic.authorName}</Link>
                  {cat && (
                    <span className="ml-2">
                      in{' '}
                      <Link href={`/theme/forum/topics?category=${cat.slug}`} className="text-primary hover:underline">
                        {cat.title}
                      </Link>
                    </span>
                  )}
                  <span className="sm:hidden ml-2">&bull; {topic.replyCount} replies</span>
                </div>
              </div>
              <div className="px-3 py-2.5 text-center text-text-secondary w-16 hidden sm:flex items-center justify-center">
                {topic.replyCount.toLocaleString()}
              </div>
              <div className="px-3 py-2.5 text-center text-text-secondary w-16 hidden sm:flex items-center justify-center">
                {topic.viewCount.toLocaleString()}
              </div>
              <div className="px-3 py-2.5 text-text-secondary w-36 hidden md:flex items-start flex-col justify-center">
                <span className="text-text-disabled">{formatDate(topic.createdAt)}</span>
                <span>by <Link href="/theme/forum" className="text-primary hover:underline">{topic.authorName}</Link></span>
              </div>
            </div>
          );
        })}

        {/* Regular topics */}
        {regular.map((topic, i) => {
          const { icon, color } = topicIcon(topic);
          const cat = FORUM_CATEGORIES.find((c) => c.categoryId === topic.categoryId);
          return (
            <div
              key={topic.topicId}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] border-b border-border last:border-b-0 text-xs ${
                i % 2 === 0 ? 'bg-surface-base' : 'bg-surface-raised'
              }`}
            >
              <div className="px-3 py-2.5 w-8 flex items-start justify-center pt-3">
                <FontAwesomeIcon icon={icon} className={`w-3.5 h-3.5 ${color}`} aria-hidden="true" />
              </div>
              <div className="px-2 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(topic.status === 'LOCKED' || topic.status === 'ARCHIVED') && (
                    <TopicStatusBadge status={topic.status} size="sm" />
                  )}
                  {topic.solutionPostId && <TopicSolvedBadge size="sm" />}
                  <Link
                    href={`/theme/forum/topics/${topic.slug}`}
                    className="font-semibold text-text-primary hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
                  >
                    {topic.title}
                  </Link>
                </div>
                <div className="text-text-disabled mt-0.5">
                  by{' '}
                  <Link href="/theme/forum" className="text-primary hover:underline">{topic.authorName}</Link>
                  {cat && (
                    <span className="ml-2">
                      in{' '}
                      <Link href={`/theme/forum/topics?category=${cat.slug}`} className="text-primary hover:underline">
                        {cat.title}
                      </Link>
                    </span>
                  )}
                  <span className="sm:hidden ml-2">&bull; {topic.replyCount} replies</span>
                </div>
              </div>
              <div className="px-3 py-2.5 text-center text-text-secondary w-16 hidden sm:flex items-center justify-center">
                {topic.replyCount.toLocaleString()}
              </div>
              <div className="px-3 py-2.5 text-center text-text-secondary w-16 hidden sm:flex items-center justify-center">
                {topic.viewCount.toLocaleString()}
              </div>
              <div className="px-3 py-2.5 text-text-secondary w-36 hidden md:flex items-start flex-col justify-center">
                <span className="text-text-disabled">{formatDate(topic.createdAt)}</span>
                <span>by <Link href="/theme/forum" className="text-primary hover:underline">{topic.authorName}</Link></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination stub */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
        <span>
          Page <strong className="text-text-primary">1</strong> of 1 &mdash;{' '}
          <strong className="text-text-primary">{TOPICS.length}</strong> topics
        </span>
        <div className="flex items-center gap-1">
          <span className="px-2 py-1 border border-primary bg-primary text-primary-fg rounded font-semibold text-xs">1</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border text-xs text-text-disabled flex flex-wrap gap-x-5 gap-y-1.5">
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faEnvelopeOpen} className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          New posts
        </span>
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5 text-text-disabled" aria-hidden="true" />
          No new posts
        </span>
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faFire} className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
          Hot topic
        </span>
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faThumbtack} className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          Sticky
        </span>
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faLock} className="w-3.5 h-3.5 text-text-disabled" aria-hidden="true" />
          Locked
        </span>
      </div>
    </div>
  );
}
