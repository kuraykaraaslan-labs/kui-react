import type { Metadata } from 'next';
import { Badge } from '@/modules/ui/Badge';
import { Breadcrumb } from '@/modules/ui/Breadcrumb';
import { Button } from '@/modules/ui/Button';
import { Card } from '@/modules/ui/Card';
import { PageHeader } from '@/modules/ui/PageHeader';
import { SearchBar } from '@/modules/ui/SearchBar';
import { CategoryBadge } from '@/modules/domains/blog/category/CategoryBadge';
import { PostCard } from '@/modules/domains/blog/post/PostCard';
import { PostStatusBadge } from '@/modules/domains/blog/post/PostStatusBadge';
import { BLOG_CATEGORIES, BLOG_POSTS, FEATURED_POST } from '../blog.data';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';

export const metadata: Metadata = {
  title: buildPageTitle('Archive', THEME_TITLES.blog),
};

const ARCHIVE_POSTS = BLOG_POSTS.slice(1);

export default function BlogArchivePage() {
  return (
    <div className="bg-surface-base text-text-primary">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_15%_10%,_var(--primary-subtle),_transparent_70%)]" />
          <div className="absolute -top-24 right-12 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6 pt-10 pb-12">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Domains', href: '/domain' },
              { label: 'Blog', href: '/domains/blog' },
              { label: 'Archive' },
            ]}
            className="text-text-secondary"
          />

          <div className="mt-8">
            <PageHeader
              title="Archive"
              subtitle="Every story, every signal, in one focused library."
              badge={<Badge variant="neutral" size="md">All stories</Badge>}
              actions={[
                { label: 'Back to overview', href: '/domains/blog', variant: 'outline' },
                { label: 'Subscribe', href: '#subscribe', variant: 'accent' },
              ]}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={FEATURED_POST.category} size="sm" />
                {FEATURED_POST.status !== 'PUBLISHED' && (
                  <PostStatusBadge status={FEATURED_POST.status} size="sm" />
                )}
              </div>
              <PostCard post={FEATURED_POST} showStatus className="shadow-xl" />
            </div>

            <Card title="Filters" subtitle="Refine by topic or search quickly.">
              <div className="space-y-5">
                <SearchBar id="archive-search" placeholder="Search archive" />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">
                    Topics
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BLOG_CATEGORIES.map((category) => (
                      <CategoryBadge key={category.categoryId} category={category} size="sm" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">Reset</Button>
                  <Button variant="primary" size="sm">Apply filters</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">All stories</h2>
            <p className="text-sm text-text-secondary">{BLOG_POSTS.length} entries total</p>
          </div>
          <Button variant="outline" size="sm">Sort: Latest</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ARCHIVE_POSTS.map((post) => (
            <PostCard
              key={post.postId}
              post={post}
              showStatus={post.status !== 'PUBLISHED'}
              href={`/domains/blog/${post.slug}`}
              className="h-full"
            />
          ))}
        </div>

        <div id="subscribe" className="mt-12">
          <Card title="Subscribe" subtitle="Weekly editorial notes, no noise.">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-text-secondary max-w-xl">
                Get the Sunday brief: highlights, research signals, and the next story queue.
              </p>
              <Button variant="primary" size="sm">Join the list</Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
