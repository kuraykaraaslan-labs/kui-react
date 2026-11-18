'use client';
import { useState } from 'react';
import Link from 'next/link';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { THEME_TITLES } from '@/libs/config/showcase.config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { PostComposer } from '@/modules/domains/forum/post/PostComposer';
import type { SimilarTopic } from '@/modules/domains/forum/topic/SimilarTopics';
import { FORUM_CATEGORIES, TOPICS } from '../../forum.data';

/** Words that carry no topic on their own. */
const STOP_WORDS = new Set(['what', 'with', 'without', 'about', 'after', 'from', 'your', 'this', 'that', 'have', 'help', 'needed', 'best', 'please']);

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9.]+/).filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

/**
 * Demo of the composer assistant. A real host searches its topics (and asks a model for the forum) from a debounced
 * `onTitleChange`; here the sample topics are matched on shared words, and the best match's category is suggested.
 */
function assist(title: string): { similar: SimilarTopic[]; suggested?: string } {
  const typed = new Set(words(title));
  if (typed.size === 0) return { similar: [] };
  const scored = TOPICS
    .map((t) => ({ t, score: words(t.title).filter((w) => typed.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const similar = scored.map(({ t }) => ({
    topicId: t.topicId,
    title: t.title,
    href: `/theme/forum/topics/${t.slug}`,
    solved: Boolean(t.solutionPostId),
    forumName: FORUM_CATEGORIES.find((c) => c.categoryId === t.categoryId)?.title,
    replyCount: t.replyCount,
  }));
  const best = scored[0]?.t;
  return { similar, suggested: FORUM_CATEGORIES.find((c) => c.categoryId === best?.categoryId)?.slug };
}

export default function NewTopicPage() {
  const categoryOptions = FORUM_CATEGORIES.map((c) => ({
    value: c.slug,
    label: c.title,
  }));
  const [title, setTitle] = useState('');
  const { similar, suggested } = assist(title);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <DocumentTitle text={`New Topic — ${THEME_TITLES.forum}`} />
      <Link
        href="/theme/forum/topics"
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary mb-4 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" aria-hidden="true" />
        Back to topics
      </Link>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-text-primary">Start a new topic</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Got a question or something to share? Be specific and respectful — the community will help you out.
          Try a title like “Deploy Next.js on my VPS”: similar topics and a suggested forum appear under it.
        </p>
      </header>

      <PostComposer
        categories={categoryOptions}
        initialCategoryValue={categoryOptions[0]?.value}
        onTitleChange={setTitle}
        similarTopics={similar}
        suggestedCategoryValue={suggested}
        onSubmit={(data) => {
          // Demo: log the submission. A real flow would POST to an API and redirect to the topic.
          console.log('New topic submitted:', data);
        }}
        onCancel={() => {
          if (typeof window !== 'undefined') window.history.back();
        }}
      />
    </div>
  );
}
