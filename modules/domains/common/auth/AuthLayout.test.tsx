import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('puts the brand above the kit Card and the page title with its one line inside it', () => {
    const { container } = render(
      <AuthLayout brand={<span role="img" aria-label="Acme">A</span>} title="Sign in" description="acme.example.com" footer={<button type="button">Sign up</button>}>
        <form aria-label="sign in" />
      </AuthLayout>,
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Sign in');
    expect(heading.className).toContain('text-xl');
    expect(screen.getByText('acme.example.com')).toBeTruthy();
    const card = container.querySelector('.rounded-xl')!;
    expect(card).toBeTruthy();
    expect(card.contains(screen.getByRole('img', { name: 'Acme' }))).toBe(false);
    expect(card.contains(heading)).toBe(true);
    expect(card.contains(screen.getByRole('form', { name: 'sign in' }))).toBe(true);
    expect(card.contains(screen.getByRole('button', { name: 'Sign up' }))).toBe(false);
  });

  it('without a brand, a description or a footer it renders none of their wrappers', () => {
    const { container } = render(<AuthLayout title="Verify your email"><p>body</p></AuthLayout>);
    const card = container.querySelector('.rounded-xl')!;
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(card.previousElementSibling).toBeNull();
    expect(card.nextElementSibling).toBeNull();
    expect(container.querySelector('header p')).toBeNull();
  });
});
