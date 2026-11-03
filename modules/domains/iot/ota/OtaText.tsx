'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { fill } from '../format';
import { isOtaApiError } from './ota-adapter';
import { mergeOtaMessages, type OtaMessages, type OtaMessagesInput } from './messages';

const OtaTextContext = createContext<{ messages?: OtaMessagesInput; locale?: string } | null>(null);

/** The OTA views' texts and language for every view under it (a view's own `messages` / `locale` props win). */
export function OtaTextProvider({ messages, locale, children }: { messages?: OtaMessagesInput; locale?: string; children: ReactNode }) {
  const value = useMemo(() => ({ messages, locale }), [messages, locale]);
  return <OtaTextContext.Provider value={value}>{children}</OtaTextContext.Provider>;
}

export function useOtaText(own?: OtaMessagesInput, ownLocale?: string): { m: OtaMessages; locale: string | undefined } {
  const ctx = useContext(OtaTextContext);
  const fromCtx = ctx?.messages;
  const m = useMemo(() => mergeOtaMessages(fromCtx, own), [fromCtx, own]);
  return { m, locale: ownLocale ?? ctx?.locale };
}

/** A refusal in plain words: the server's `reason` when the texts know it, else its message. */
export function otaErrorText(m: OtaMessages, e: unknown): string {
  if (isOtaApiError(e)) return (e.reason && (m.errors as Record<string, string>)[e.reason]) || fill(m.common.unknownError, { message: e.message });
  return fill(m.common.unknownError, { message: e instanceof Error ? e.message : String(e) });
}
