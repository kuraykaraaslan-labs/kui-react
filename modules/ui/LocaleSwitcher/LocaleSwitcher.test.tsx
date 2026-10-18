import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSwitcher, localeDirection, type LocaleOption } from './index';

const locales: LocaleOption[] = [
  { code: 'en', name: 'English', englishName: 'English', href: '/en/status' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', href: '/tr/status', fallback: true },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', href: '/ar/status' },
];
const buttonLocales: LocaleOption[] = locales.map(({ href: _href, ...rest }) => { void _href; return rest; });

const details = () => document.querySelector('details') as HTMLDetailsElement;
const summary = () => document.querySelector('summary') as HTMLElement;
const open = () => { details().open = true; fireEvent(details(), new Event('toggle')); };

describe('localeDirection', () => {
  it('knows right-to-left languages, with or without a region', () => {
    expect(localeDirection('ar')).toBe('rtl');
    expect(localeDirection('ar-EG')).toBe('rtl');
    expect(localeDirection('he')).toBe('rtl');
    expect(localeDirection('fa')).toBe('rtl');
    expect(localeDirection('en')).toBe('ltr');
    expect(localeDirection('pt-BR')).toBe('ltr');
  });
});

describe('LocaleSwitcher', () => {
  it('renders as a native disclosure whose trigger names the current language', () => {
    render(<LocaleSwitcher locales={locales} current="en" />);
    expect(details().tagName).toBe('DETAILS');
    expect(summary()).toHaveAccessibleName('Language: English');
    expect(details().open).toBe(false);
  });

  it('lists options as links with hreflang, own-language lang and the right dir', () => {
    render(<LocaleSwitcher locales={locales} current="en" />);
    const ar = screen.getByRole('link', { name: /العربية/ });
    expect(ar).toHaveAttribute('href', '/ar/status');
    expect(ar).toHaveAttribute('hreflang', 'ar');
    const name = ar.querySelector('[lang="ar"]')!;
    expect(name).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('link', { name: /Türkçe/ }).querySelector('[lang="tr"]')).toHaveAttribute('dir', 'ltr');
  });

  it('marks the current locale in text and with aria-current', () => {
    render(<LocaleSwitcher locales={locales} current="tr" />);
    const cur = screen.getByRole('link', { name: /Türkçe/ });
    expect(cur).toHaveAttribute('aria-current', 'true');
    expect(cur).toHaveTextContent('(current)');
    expect(screen.getByRole('link', { name: /English/ })).not.toHaveAttribute('aria-current');
  });

  it('says when the page is shown in a fallback language, on the option and on the trigger', () => {
    const { container } = render(<LocaleSwitcher locales={locales} current="tr" />);
    expect(container.querySelector('[data-part="fallback"]')).toHaveTextContent('fallback shown');
    expect(screen.getByRole('link', { name: /Türkçe/ })).toHaveTextContent('fallback shown');
    expect(screen.getByRole('link', { name: /English/ })).not.toHaveTextContent('fallback shown');
  });

  it('shows no fallback indicator on the trigger when the current page is translated', () => {
    const { container } = render(<LocaleSwitcher locales={locales} current="en" />);
    expect(container.querySelector('[data-part="fallback"]')).toBeNull();
  });

  it('shows the secondary name when given, and can hide it', () => {
    const { rerender } = render(<LocaleSwitcher locales={locales} current="en" />);
    expect(screen.getByRole('link', { name: /Türkçe/ })).toHaveTextContent('Turkish');
    rerender(<LocaleSwitcher locales={locales} current="en" showEnglishName={false} />);
    expect(screen.getByRole('link', { name: /Türkçe/ })).not.toHaveTextContent('Turkish');
  });

  it('works as buttons without hrefs: pressed state and onChange', () => {
    const onChange = vi.fn();
    render(<LocaleSwitcher locales={buttonLocales} current="en" onChange={onChange} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: /English/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Türkçe/ }));
    expect(onChange).toHaveBeenCalledWith('tr', expect.objectContaining({ code: 'tr' }), expect.anything());
  });

  it('calls onChange for a link and lets the app take over navigation', () => {
    const onChange = vi.fn((_c: string, _o: LocaleOption, e: React.SyntheticEvent) => e.preventDefault());
    render(<LocaleSwitcher locales={locales} current="en" onChange={onChange} />);
    const link = screen.getByRole('link', { name: /Türkçe/ });
    const notPrevented = fireEvent.click(link);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it('closes after a choice, on Escape (returning focus to the trigger) and on an outside press', () => {
    render(<LocaleSwitcher locales={locales} current="en" />);
    open();
    expect(details().open).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: /Türkçe/ }));
    expect(details().open).toBe(false);

    open();
    fireEvent.keyDown(screen.getByRole('link', { name: /English/ }), { key: 'Escape' });
    expect(details().open).toBe(false);
    expect(document.activeElement).toBe(summary());

    open();
    fireEvent.mouseDown(document.body);
    expect(details().open).toBe(false);
  });

  it('moves between options with the arrow keys, Home and End', () => {
    render(<LocaleSwitcher locales={locales} current="en" />);
    open();
    const [en, tr, ar] = screen.getAllByRole('link');
    en.focus();
    fireEvent.keyDown(en, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tr);
    fireEvent.keyDown(tr, { key: 'End' });
    expect(document.activeElement).toBe(ar);
    fireEvent.keyDown(ar, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tr);
    fireEvent.keyDown(tr, { key: 'Home' });
    expect(document.activeElement).toBe(en);
  });

  it('renders the inline variant as a nav of links', () => {
    render(<LocaleSwitcher locales={locales} current="ar" variant="inline" />);
    expect(screen.getByRole('navigation', { name: 'Language' })).toBeInTheDocument();
    expect(document.querySelector('details')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /العربية/ })).toHaveAttribute('aria-current', 'true');
  });

  it('can be forced right to left and takes its text from messages', () => {
    const { container } = render(<LocaleSwitcher locales={locales} current="ar" dir="rtl" messages={{ label: 'Langue', current: 'actuelle', triggerAria: 'Langue : {name}' }} />);
    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl');
    expect(summary()).toHaveAccessibleName('Langue : العربية');
    expect(screen.getByRole('link', { name: /العربية/ })).toHaveTextContent('(actuelle)');
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<LocaleSwitcher locales={[]} current="en" />);
    expect(container).toBeEmptyDOMElement();
  });
});
