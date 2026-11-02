'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { mergeSettingsMessages, type SettingsMessages, type SettingsMessagesInput } from './messages';

/** The settings views' texts and language, for every view under it (a view's own `messages` / `locale` props win). */
const SettingsTextContext = createContext<{ messages?: SettingsMessagesInput; locale?: string } | null>(null);

export function SettingsTextProvider({ messages, locale, children }: { messages?: SettingsMessagesInput; locale?: string; children: ReactNode }) {
  const value = useMemo(() => ({ messages, locale }), [messages, locale]);
  return <SettingsTextContext.Provider value={value}>{children}</SettingsTextContext.Provider>;
}

export function useSettingsText(own?: SettingsMessagesInput, ownLocale?: string): { m: SettingsMessages; locale: string | undefined } {
  const ctx = useContext(SettingsTextContext);
  const fromCtx = ctx?.messages;
  const m = useMemo(() => mergeSettingsMessages(fromCtx, own), [fromCtx, own]);
  return { m, locale: ownLocale ?? ctx?.locale };
}
