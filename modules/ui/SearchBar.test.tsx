import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('takes the host\'s longest search as the input\'s limit (NB 41-ui-fixes/24 1.17)', () => {
    const { rerender } = render(<SearchBar id="s" label="Search alarms" value="" onChange={() => undefined} maxLength={128} />);
    expect(screen.getByRole('searchbox', { name: 'Search alarms' })).toHaveAttribute('maxlength', '128');
    rerender(<SearchBar id="s" label="Search alarms" value="" onChange={() => undefined} />);
    expect(screen.getByRole('searchbox', { name: 'Search alarms' })).not.toHaveAttribute('maxlength');
  });
});
