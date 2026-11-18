import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PostComposer } from './PostComposer';

afterEach(cleanup);

const CATEGORIES = [
  { value: 'general', label: 'General Discussion' },
  { value: 'tech-help', label: 'Tech Help' },
];
const SIMILAR = [{ topicId: 't1', title: 'Deploy Next.js on a VPS', href: '/t/1', solved: true, forumName: 'Tech Help', replyCount: 17 }];

function fill(title: string, body = 'A body that is long enough.') {
  fireEvent.change(screen.getByLabelText(/Topic title/), { target: { value: title } });
  fireEvent.change(screen.getByLabelText(/^Body/), { target: { value: body } });
}

describe('PostComposer assistant', () => {
  it('works as before without the assistant props', () => {
    const onSubmit = vi.fn();
    render(<PostComposer categories={CATEGORIES} initialCategoryValue="general" onSubmit={onSubmit} />);
    expect(screen.queryByText(/Suggested forum/)).toBeNull();
    expect(screen.queryByText(/Already asked/)).toBeNull();
    fill('My new topic');
    fireEvent.click(screen.getByRole('button', { name: 'Post topic' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'My new topic', categoryValue: 'general' }));
  });

  it('reports the title as it is typed', () => {
    const onTitleChange = vi.fn();
    render(<PostComposer categories={CATEGORIES} onTitleChange={onTitleChange} />);
    fireEvent.change(screen.getByLabelText(/Topic title/), { target: { value: 'Deploy' } });
    expect(onTitleChange).toHaveBeenLastCalledWith('Deploy');
  });

  it('lists similar topics and pre-selects the suggested category', () => {
    const onSubmit = vi.fn();
    render(
      <PostComposer
        categories={CATEGORIES}
        initialCategoryValue="general"
        similarTopics={SIMILAR}
        suggestedCategoryValue="tech-help"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole('link', { name: 'Deploy Next.js on a VPS' })).toBeInTheDocument();
    expect(screen.getByText('Suggested forum (AI):', { exact: false })).toHaveTextContent('Tech Help');
    fill('Deploy without Docker');
    fireEvent.click(screen.getByRole('button', { name: 'Post topic' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ categoryValue: 'tech-help' }));
  });

  it('keeps the category the user picked over a later suggestion', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<PostComposer categories={CATEGORIES} suggestedCategoryValue="tech-help" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Category/ }), { target: { value: 'general' } });
    rerender(<PostComposer categories={CATEGORIES} suggestedCategoryValue="tech-help" onSubmit={onSubmit} />);
    fill('Deploy without Docker');
    fireEvent.click(screen.getByRole('button', { name: 'Post topic' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ categoryValue: 'general' }));
  });

  it('ignores an unknown suggestion', () => {
    render(<PostComposer categories={CATEGORIES} suggestedCategoryValue="nope" />);
    expect(screen.queryByText(/Suggested forum/)).toBeNull();
  });
});
