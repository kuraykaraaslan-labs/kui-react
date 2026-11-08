import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SimilarTopics, SuggestedCategoryHint } from './SimilarTopics';
import { TopicRow } from './TopicRow';
import { TopicSolvedBadge } from './TopicStatusBadge';

afterEach(cleanup);

const TOPICS = [
  { topicId: 't1', title: 'Deploy Next.js on a VPS', href: '/t/1', solved: true, forumName: 'Tech Help', replyCount: 17 },
  { topicId: 't2', title: 'PM2 restarts my app', href: '/t/2', replyCount: 1 },
];

describe('SimilarTopics', () => {
  it('lists the topics with links, a Solved chip and the meta line', () => {
    render(<SimilarTopics topics={TOPICS} />);
    const list = screen.getByRole('list', { name: 'Already asked? These look similar:' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('link', { name: 'Deploy Next.js on a VPS' })).toHaveAttribute('href', '/t/1');
    expect(within(items[0]).getByText('Solved')).toBeInTheDocument();
    expect(within(items[0]).getByText('Tech Help · 17 replies')).toBeInTheDocument();
    expect(within(items[1]).queryByText('Solved')).toBeNull();
    expect(within(items[1]).getByText('1 reply')).toBeInTheDocument();
  });

  it('renders nothing for no topics', () => {
    const { container } = render(<SimilarTopics topics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses renderLink and labels', () => {
    render(
      <SimilarTopics
        topics={TOPICS.slice(0, 1)}
        labels={{ heading: 'Benzer konular', solved: 'Çözüldü', replies: (n) => `${n} yanıt` }}
        renderLink={(t, children, className) => <a data-testid="custom" href={`/x${t.href}`} className={className}>{children}</a>}
      />,
    );
    expect(screen.getByText('Benzer konular')).toBeInTheDocument();
    expect(screen.getByTestId('custom')).toHaveAttribute('href', '/x/t/1');
    expect(screen.getByText('Çözüldü')).toBeInTheDocument();
    expect(screen.getByText('Tech Help · 17 yanıt')).toBeInTheDocument();
  });

  it('shows the suggested forum hint', () => {
    render(<SuggestedCategoryHint categoryName="Tech Help" />);
    expect(screen.getByText('Tech Help').closest('p')).toHaveTextContent('Suggested forum (AI): Tech Help');
  });

  it('marks a solved topic beside its status in TopicRow', () => {
    const topic = { topicId: 't', title: 'x', slug: 'x', status: 'OPEN' as const, replyCount: 0, viewCount: 0, authorName: 'a' };
    const { rerender } = render(<TopicRow topic={{ ...topic, isSolved: true }} />);
    expect(screen.getByText('Solved')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    rerender(<TopicRow topic={topic} />);
    expect(screen.queryByText('Solved')).toBeNull();
    rerender(<TopicSolvedBadge label="Çözüldü" />);
    expect(screen.getByText('Çözüldü')).toBeInTheDocument();
  });
});
