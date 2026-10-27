import type { Metadata } from 'next';
import { Breadcrumb } from '@/modules/ui/Breadcrumb';
import { Button } from '@/modules/ui/Button';
import { Card } from '@/modules/ui/Card';
import { Input } from '@/modules/ui/Input';
import { PageHeader } from '@/modules/ui/PageHeader';
import { SearchBar } from '@/modules/ui/SearchBar';
import { CategoryBadge } from '@/modules/domains/blog/category/CategoryBadge';
import { CommentForm } from '@/modules/domains/blog/comment/CommentForm';
import { CommentList } from '@/modules/domains/blog/comment/CommentList';
import { PostCard } from '@/modules/domains/blog/post/PostCard';
import { PostContent } from '@/modules/domains/blog/post/PostContent';
import { PostMeta } from '@/modules/domains/blog/post/PostMeta';
import { PostStatusBadge } from '@/modules/domains/blog/post/PostStatusBadge';
import { UserProfileCard } from '@/modules/domains/common/user/UserProfileCard';
import {
  BLOG_AUTHORS,
  BLOG_CATEGORIES,
  BLOG_COMMENTS,
  BLOG_POSTS,
  FEATURED_POST,
} from '@/app/theme/blog/blog.data';
import { THEME_TITLES } from '@/libs/config/showcase.config';

export const metadata: Metadata = {
  title: { absolute: THEME_TITLES.blog },
};

const LATEST_POSTS = BLOG_POSTS.slice(1, 5);
const FEATURED_CATEGORY = FEATURED_POST.category;

export default function BlogDomainPage() {
  return (
    <div className="bg-surface-base text-text-primary">
      <style>{`
        @keyframes blog-fade {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes blog-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
      `}</style>

      <div className="relative">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(45%_45%_at_70%_10%,_var(--primary-subtle),_transparent_65%)]" />
            <div className="absolute -top-24 right-8 h-80 w-80 rounded-full bg-primary/15 blur-3xl motion-safe:animate-[blog-float_16s_ease-in-out_infinite]" />
            <div className="absolute top-32 -left-16 h-72 w-72 rounded-full bg-info/10 blur-3xl motion-safe:animate-[blog-float_20s_ease-in-out_infinite]" />
          </div>

          <div className="mx-auto max-w-6xl px-6 pt-12 pb-16">
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: 'Domains', href: '/domain' },
                { label: 'Blog' },
              ]}
              className="text-text-secondary"
            />

            <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
              <div className="space-y-6 motion-safe:animate-[blog-fade_0.8s_ease-out]">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge category={FEATURED_CATEGORY} size="sm" />
                  <PostStatusBadge status={FEATURED_POST.status} size="sm" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
                  The editorial rhythm of calm product teams
                </h1>
                <p className="text-lg text-text-secondary max-w-xl">
                  A modern blog experience built from domain components. Focused, intentional,
                  and deeply grounded in real workflow signals.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="md">Start reading</Button>
                  <Button variant="outline" size="md">Browse series</Button>
                  <div className="flex items-center gap-2 text-xs text-text-secondary font-mono">
                    <span className="rounded-full bg-surface-sunken px-2 py-1">Issue 24</span>
                    <span className="rounded-full bg-surface-sunken px-2 py-1">12 guides</span>
                    <span className="rounded-full bg-surface-sunken px-2 py-1">Weekly</span>
                  </div>
                </div>
                <PostMeta post={FEATURED_POST} showAvatar />
              </div>

              <div
                className="motion-safe:animate-[blog-fade_0.9s_ease-out]"
                style={{ animationDelay: '120ms' }}
              >
                <PostCard post={FEATURED_POST} showStatus className="shadow-xl" />
              </div>
            </div>
          </div>
        </section>

        <section id="archive" className="mx-auto max-w-6xl px-6 py-12">
          <PageHeader
            title="Latest stories"
            subtitle="Curated for product thinkers, designers, and research-led teams."
            actions={[
              { label: 'View archive', href: '/domains/blog/archive', variant: 'outline' },
              { label: 'Submit a pitch', href: '#pitch', variant: 'accent' },
            ]}
          />

          <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-10">
              <div className="grid gap-6 md:grid-cols-2">
                {LATEST_POSTS.map((post, index) => (
                  <div
                    key={post.postId}
                    className="motion-safe:animate-[blog-fade_0.7s_ease-out]"
                    style={{ animationDelay: `${80 + index * 60}ms` }}
                  >
                    <PostCard
                      post={post}
                      showStatus={post.status !== 'PUBLISHED'}
                      href={`/domains/blog/${post.slug}`}
                      className="h-full"
                    />
                  </div>
                ))}
              </div>

              <Card
                title="Field notes"
                subtitle="A longform sample rendered with PostContent."
                headerRight={(
                  <CategoryBadge category={BLOG_CATEGORIES[2]} size="sm" />
                )}
                className="motion-safe:animate-[blog-fade_0.8s_ease-out]"
                variant="raised"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <PostStatusBadge status="PUBLISHED" size="sm" />
                    <span className="text-xs text-text-secondary font-mono">Longform</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-text-primary">
                    Making space for the signals that matter
                  </h2>
                  <PostMeta post={FEATURED_POST} showAvatar={false} />
                  <PostContent content={FEATURED_POST.content} className="text-sm sm:text-base" />
                </div>
              </Card>

              <Card
                title="Community notes"
                subtitle="Reader responses and a fresh comment form."
                className="motion-safe:animate-[blog-fade_0.8s_ease-out]"
              >
                <div id="community" className="space-y-8">
                  <CommentList comments={BLOG_COMMENTS} postId={FEATURED_POST.postId} />
                  <div className="border-t border-border pt-6">
                    <h3 className="text-base font-semibold text-text-primary mb-4">
                      Join the discussion
                    </h3>
                    <CommentForm postId={FEATURED_POST.postId} />
                  </div>
                </div>
              </Card>

              <div id="pitch">
                <Card
                  title="Pitch a story"
                  subtitle="Share a signal worth writing about."
                  className="motion-safe:animate-[blog-fade_0.8s_ease-out]"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-text-secondary max-w-xl">
                      We review new story ideas every Friday. Send a concise brief and why it matters now.
                    </p>
                    <Button variant="accent" size="sm">Submit pitch</Button>
                  </div>
                </Card>
              </div>
            </div>

            <aside className="space-y-6">
              <Card title="Search" subtitle="Find a story in seconds.">
                <SearchBar id="sidebar-search" placeholder="Search the archive" />
              </Card>

              <UserProfileCard
                user={BLOG_AUTHORS[0]}
                className="motion-safe:animate-[blog-fade_0.9s_ease-out]"
              />

              <Card title="Topics" subtitle="Browse by focus area.">
                <div className="flex flex-wrap gap-2">
                  {BLOG_CATEGORIES.map((category) => (
                    <CategoryBadge key={category.categoryId} category={category} size="sm" />
                  ))}
                </div>
              </Card>

              <div id="newsletter">
                <Card title="Newsletter" subtitle="Weekly editorial notes, zero noise.">
                  <div className="space-y-3">
                    <Input
                      id="newsletter-email"
                      label="Email address"
                      type="email"
                      placeholder="you@studio.com"
                    />
                    <Button variant="primary" size="sm" fullWidth>
                      Subscribe
                    </Button>
                    <p className="text-xs text-text-secondary">
                      We only send one message per week and never share your data.
                    </p>
                  </div>
                </Card>
              </div>

              <Card title="Snapshot" subtitle="Signals from the editorial room.">
                <div className="space-y-3 text-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Stories published</span>
                    <span className="text-text-primary font-semibold">48</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg. read time</span>
                    <span className="text-text-primary font-semibold">6 min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active contributors</span>
                    <span className="text-text-primary font-semibold">12</span>
                  </div>
                </div>
              </Card>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
