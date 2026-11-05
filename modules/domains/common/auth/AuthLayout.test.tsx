import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('puts the brand and tagline above the card and the page title inside it, once each', () => {
    const { container } = render(
      <AuthLayout brand={<span role="img" aria-label="Hermetry">H</span>} tagline="From the field to your screen." title="Sign in" description="Use your work email." footer={<button type="button">Sign up</button>}>
        <form aria-label="sign in" />
      </AuthLayout>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign in');
    expect(screen.getByText('Use your work email.')).toBeTruthy();
    expect(screen.getAllByText('From the field to your screen.')).toHaveLength(1);
    const card = container.querySelector('.rounded-2xl')!;
    // the brand is outside the card, the title and the form inside it
    expect(card.contains(screen.getByRole("img", { name: "Hermetry" }))).toBe(false);
    expect(card.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
    expect(card.contains(screen.getByRole('form', { name: 'sign in' }))).toBe(true);
    expect(card.contains(screen.getByRole("button", { name: "Sign up" }))).toBe(false);
  });

  it('without a brand, a tagline, a description or a footer it renders none of their wrappers', () => {
    const { container } = render(<AuthLayout title="Verify your email"><p>body</p></AuthLayout>);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('.rounded-2xl')!.previousElementSibling).toBeNull();
    expect(container.querySelector('.rounded-2xl')!.nextElementSibling).toBeNull();
    expect(container.querySelector('header p')).toBeNull();
  });
});
