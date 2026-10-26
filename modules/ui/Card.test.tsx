import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

const parts = (container: HTMLElement) => {
  const root = container.firstElementChild as HTMLElement;
  const [header, body, footer] = Array.from(root.children) as HTMLElement[];
  return { header, body, footer };
};

describe('Card', () => {
  it('pads header, body and footer 24 px at the sides by default', () => {
    const { container } = render(<Card title="Title" footer="Footer">Body</Card>);
    const { header, body, footer } = parts(container);
    expect(header.className).toMatch(/\bpx-6\b/);
    expect(body.className).toMatch(/\bpx-6\b/);
    expect(footer.className).toMatch(/\bpx-6\b/);
  });

  it('pads 16 px at the sides with density="compact", in every slot and the loading skeleton', () => {
    const { container, rerender } = render(<Card density="compact" title="Title" footer="Footer">Body</Card>);
    const { header, body, footer } = parts(container);
    for (const el of [header, body, footer]) {
      expect(el.className).toMatch(/\bpx-4\b/);
      expect(el.className).not.toMatch(/\bpx-6\b/);
    }
    rerender(<Card density="compact" loading />);
    expect((container.firstElementChild!.firstElementChild as HTMLElement).className).toMatch(/\bpx-4\b/);
  });

  it('keeps its footer styling when compact (tailwind-merge does not drop the border)', () => {
    const { container } = render(<Card density="compact" title="Title" footer="Footer">Body</Card>);
    const { footer } = parts(container);
    expect(footer.className).toMatch(/\bborder-t\b/);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
