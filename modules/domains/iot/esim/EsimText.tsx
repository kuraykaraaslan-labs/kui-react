'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { fill } from '../format';
import { isEsimApiError } from './esim-adapter';
import { mergeEsimMessages, type EsimMessages, type EsimMessagesInput } from './messages';

const EsimTextContext = createContext<{ messages?: EsimMessagesInput; locale?: string } | null>(null);

/** The eSIM views' texts and language for every view under it (a view's own `messages` / `locale` props win). */
export function EsimTextProvider({ messages, locale, children }: { messages?: EsimMessagesInput; locale?: string; children: ReactNode }) {
  const value = useMemo(() => ({ messages, locale }), [messages, locale]);
  return <EsimTextContext.Provider value={value}>{children}</EsimTextContext.Provider>;
}

export function useEsimText(own?: EsimMessagesInput, ownLocale?: string): { m: EsimMessages; locale: string | undefined } {
  const ctx = useContext(EsimTextContext);
  const fromCtx = ctx?.messages;
  const m = useMemo(() => mergeEsimMessages(fromCtx, own), [fromCtx, own]);
  return { m, locale: ownLocale ?? ctx?.locale };
}

/** A reason code in plain words (the router's, the operator's or the platform's), else the code itself. */
export function esimReasonText(m: EsimMessages, reason: string | null | undefined): string {
  if (!reason) return m.common.none;
  return (m.errors as Record<string, string>)[reason] ?? reason;
}

/** A refusal in plain words: the server's `reason` when the texts know it, else its message. */
export function esimErrorText(m: EsimMessages, e: unknown): string {
  if (isEsimApiError(e)) return (e.reason && (m.errors as Record<string, string>)[e.reason]) || fill(m.common.unknownError, { message: e.message });
  return fill(m.common.unknownError, { message: e instanceof Error ? e.message : String(e) });
}
