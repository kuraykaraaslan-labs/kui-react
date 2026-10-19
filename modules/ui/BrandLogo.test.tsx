import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandLogo } from './BrandLogo';

describe('BrandLogo', () => {
  it('without a logo: the children on the brand-coloured tile, sized', () => {
    const { container } = render(<BrandLogo size="lg">K</BrandLogo>);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.textContent).toBe('K');
    expect(tile.className).toContain('bg-primary');
    expect(tile.className).toContain('h-16');
    expect(container.querySelector('img')).toBeNull();
  });

  it('one logo: a single image used in both themes, with the alt text, and no tile', () => {
    const { container } = render(<BrandLogo logoLight="/l.svg" alt="Acme">K</BrandLogo>);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Acme' }).getAttribute('src')).toBe('/l.svg');
    expect(imgs[0].className).not.toContain('dark:hidden');
    expect(container.textContent).not.toContain('K');
    expect((container.firstElementChild as HTMLElement).className).not.toContain('bg-primary');
  });

  it('only a dark logo: used in both themes too', () => {
    const { container } = render(<BrandLogo logoDark="/d.svg" alt="Acme" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/d.svg');
  });

  it('light and dark logos: one image per theme', () => {
    const { container } = render(<BrandLogo logoLight="/l.svg" logoDark="/d.svg" alt="Acme" size="sm" />);
    const [light, dark] = Array.from(container.querySelectorAll('img'));
    expect(light.getAttribute('src')).toBe('/l.svg');
    expect(light.className).toContain('dark:hidden');
    expect(dark.getAttribute('src')).toBe('/d.svg');
    expect(dark.className).toContain('hidden');
    expect(dark.className).toContain('dark:block');
    expect(light.className).toContain('h-8');
  });

  it('the same URL for both themes renders one image', () => {
    const { container } = render(<BrandLogo logoLight="/x.svg" logoDark="/x.svg" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('empty logo strings fall back to the tile', () => {
    const { container } = render(<BrandLogo logoLight="" logoDark="">Z</BrandLogo>);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('Z');
  });
});
