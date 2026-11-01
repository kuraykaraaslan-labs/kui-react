import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { TranslatableField, type TranslatableLanguage } from './index';

const LANGS: TranslatableLanguage[] = [
  { code: 'en', name: 'English', flag: <span data-testid="flag-en">GB</span> },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية', rtl: true },
];

function Harness(props: { initial?: Record<string, string>; onChange?: (v: Record<string, string>) => void } & Partial<React.ComponentProps<typeof TranslatableField>>) {
  const { initial, onChange, ...rest } = props;
  const [value, setValue] = useState<Record<string, string>>(initial ?? {});
  return (
    <TranslatableField
      id="label"
      label="Label"
      languages={LANGS}
      required={['en']}
      {...rest}
      value={value}
      onChange={(v) => {
        onChange?.(v);
        setValue(v);
      }}
    />
  );
}

const row = (code: string) => document.querySelector<HTMLElement>(`[data-lang="${code}"]`)!;

describe('TranslatableField', () => {
  it('draws one row per language: flag, own name as the label, lang and direction on the input', () => {
    render(<Harness initial={{ en: 'Flows' }} />);
    expect(screen.getByRole('group', { name: 'Label' })).toBeInTheDocument();
    const en = screen.getByRole('textbox', { name: /English/ });
    expect(en).toHaveValue('Flows');
    expect(en).toHaveAttribute('lang', 'en');
    expect(en).toHaveAttribute('dir', 'ltr');
    expect(screen.getByTestId('flag-en')).toBeInTheDocument();
    const ar = screen.getByRole('textbox', { name: 'العربية' });
    expect(ar).toHaveAttribute('dir', 'rtl');
    expect(ar).toHaveAttribute('lang', 'ar');
  });

  it('marks each row filled or missing in words; typing and clearing update the record', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={{ en: 'Flows' }} onChange={onChange} />);
    expect(within(row('en')).getByText('Filled')).toBeInTheDocument();
    expect(within(row('tr')).getByText('Missing')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Türkçe' }), 'Akış');
    expect(onChange).toHaveBeenLastCalledWith({ en: 'Flows', tr: 'Akış' });
    expect(within(row('tr')).getByText('Filled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Türkçe' }));
    expect(onChange).toHaveBeenLastCalledWith({ en: 'Flows' });
    expect(screen.queryByRole('button', { name: 'Clear Türkçe' })).toBeNull();
  });

  it('a required language left empty is an error', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ en: 'Flows' }} />);
    const en = screen.getByRole('textbox', { name: /English/ });
    expect(en).toHaveAttribute('aria-required', 'true');
    expect(en).not.toHaveAttribute('aria-invalid');
    await user.click(screen.getByRole('button', { name: 'Clear English' }));
    expect(en).toHaveAttribute('aria-invalid', 'true');
    expect(en).toHaveAccessibleDescription('English is required.');
    expect(row('en')).toHaveAttribute('data-state', 'error');
    // Not required: empty is only "missing".
    expect(screen.getByRole('textbox', { name: 'Türkçe' })).not.toHaveAttribute('aria-invalid');
  });

  it('shows a suggestion in an empty field and accepts it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={{ en: 'Flows' }} onChange={onChange} suggestions={{ tr: { text: 'Akışlar', source: 'automation.menu.flows' }, en: { text: 'Never shown' } }} />);
    const tr = screen.getByRole('textbox', { name: 'Türkçe' });
    expect(tr).toHaveAttribute('placeholder', 'Akışlar');
    expect(within(row('tr')).getAllByText('Suggested')[0]).toBeInTheDocument();
    expect(row('tr')).toHaveTextContent('Akışlar · from automation.menu.flows');
    expect(row('en')).not.toHaveTextContent('Never shown');
    await user.click(screen.getByRole('button', { name: 'Accept the suggestion for Türkçe' }));
    expect(onChange).toHaveBeenLastCalledWith({ en: 'Flows', tr: 'Akışlar' });
    expect(tr).toHaveValue('Akışlar');
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();
  });

  it('notes sit under their row and describe the input; the addLanguage slot comes after the rows', () => {
    render(
      <Harness
        initial={{ en: 'Flows', tr: 'Akışlar' }}
        notes={{ tr: 'Overridden in Translations' }}
        addLanguage={<button type="button">Add language</button>}
        maxLength={40}
      />,
    );
    const tr = screen.getByRole('textbox', { name: 'Türkçe' });
    expect(tr).toHaveAccessibleDescription('Overridden in Translations');
    expect(tr).toHaveAttribute('maxlength', '40');
    const add = screen.getByRole('button', { name: 'Add language' });
    expect(row('ar').compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('takes its words from messages and can be disabled', () => {
    render(
      <Harness
        initial={{}}
        disabled
        messages={{ missing: 'Eksik', requiredError: '{language} zorunlu.', clear: '{language} temizle' }}
      />,
    );
    expect(within(row('tr')).getByText('Eksik')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /English/ })).toHaveAccessibleDescription('English zorunlu.');
    expect(screen.getByRole('textbox', { name: 'Türkçe' })).toBeDisabled();
  });
});
