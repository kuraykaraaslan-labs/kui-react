import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TranslatedContent } from './TranslatedContent';

afterEach(cleanup);

const props = {
  sourceLanguage: 'Turkish',
  sourceLang: 'tr',
  translated: <p>Restart the service after the upgrade.</p>,
  original: <p>Yükseltmeden sonra servisi yeniden başlatın.</p>,
};

describe('TranslatedContent', () => {
  it('shows the translation first with the AI label, the original hidden with its lang', () => {
    render(<TranslatedContent {...props} />);
    expect(screen.getByText('Translated from Turkish by AI')).toBeInTheDocument();
    expect(screen.getByText('Restart the service after the upgrade.')).toBeVisible();
    const original = screen.getByText('Yükseltmeden sonra servisi yeniden başlatın.');
    expect(original).not.toBeVisible();
    expect(original.closest('[lang]')).toHaveAttribute('lang', 'tr');
  });

  it('toggles to the original and back', () => {
    render(<TranslatedContent {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(screen.getByText('Yükseltmeden sonra servisi yeniden başlatın.')).toBeVisible();
    expect(screen.getByText('Restart the service after the upgrade.')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Show translation' }));
    expect(screen.getByText('Restart the service after the upgrade.')).toBeVisible();
  });

  it('takes its words from labels', () => {
    render(
      <TranslatedContent
        {...props}
        labels={{ translatedFrom: (l) => `AI translation (${l})`, showOriginal: 'Original' }}
      />,
    );
    expect(screen.getByText('AI translation (Turkish)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Original' })).toBeInTheDocument();
  });
});
