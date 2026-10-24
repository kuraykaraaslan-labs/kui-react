import { describe, it, expect } from 'vitest';
import { DEFAULT_ALIAS_MESSAGES, mergeAliasMessages } from './messages';
import { DEFAULT_COMBOBOX_MESSAGES } from '@/modules/ui/ComboBox';
import { DEFAULT_SELECT_MESSAGES } from '@/modules/ui/Select';
import { DEFAULT_MULTI_SELECT_MESSAGES } from '@/modules/ui/MultiSelect';

// The kit forwards the primitives' texts through its own messages (so a host translates them with the rest). messages.ts
// imports no .tsx, so it holds literal copies: they must stay equal to the primitives' defaults.
describe('primitive texts inside the kit', () => {
  it('copies the primitives\' English defaults exactly', () => {
    expect(DEFAULT_ALIAS_MESSAGES.comboBox).toEqual(DEFAULT_COMBOBOX_MESSAGES);
    expect(DEFAULT_ALIAS_MESSAGES.select).toEqual(DEFAULT_SELECT_MESSAGES);
    expect(DEFAULT_ALIAS_MESSAGES.multiSelect).toEqual(DEFAULT_MULTI_SELECT_MESSAGES);
  });

  it('merges a host\'s partial primitive texts key by key', () => {
    const m = mergeAliasMessages({ comboBox: { clear: 'Seçimi temizle' } });
    expect(m.comboBox.clear).toBe('Seçimi temizle');
    expect(m.comboBox.loading).toBe(DEFAULT_COMBOBOX_MESSAGES.loading);
  });
});
