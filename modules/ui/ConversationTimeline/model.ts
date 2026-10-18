// modules/ui/ConversationTimeline/model.ts
//
// Totals and formatting for an AI investigation timeline. Pure.

export type StepType = 'model' | 'tool' | 'evidence' | 'citation';
export type StepStatus = 'ok' | 'error' | 'running';

export type StepTokens = { input?: number; output?: number; cached?: number };

export type ConversationStep = {
  id: string;
  type: StepType;
  /** `Plan`, `search_logs`, `Evidence [1]`... */
  title: string;
  summary?: string;
  /** Epoch ms or ISO string. */
  startedAt?: number | string;
  durationMs?: number;
  status?: StepStatus;
  /** A model call's model name. */
  model?: string;
  tokens?: StepTokens;
  /** Cost of this step. */
  cost?: number;
  /** A citation step: whether the claim's citation was kept, and why not when it was dropped. */
  citation?: { kept: boolean; index?: number; reason?: string };
  /** Collapsible text: a tool call's arguments, a model prompt, a raw result. */
  input?: string;
  output?: string;
};

export type Totals = {
  steps: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
  durationMs: number;
  modelCalls: number;
  toolCalls: number;
  citationsKept: number;
  citationsDropped: number;
  errors: number;
};

export function computeTotals(steps: readonly ConversationStep[]): Totals {
  const t: Totals = { steps: steps.length, inputTokens: 0, outputTokens: 0, cachedTokens: 0, cost: 0, durationMs: 0, modelCalls: 0, toolCalls: 0, citationsKept: 0, citationsDropped: 0, errors: 0 };
  for (const s of steps) {
    t.inputTokens += s.tokens?.input ?? 0;
    t.outputTokens += s.tokens?.output ?? 0;
    t.cachedTokens += s.tokens?.cached ?? 0;
    t.cost += s.cost ?? 0;
    t.durationMs += s.durationMs ?? 0;
    if (s.type === 'model') t.modelCalls++;
    if (s.type === 'tool') t.toolCalls++;
    if (s.type === 'citation') { if (s.citation?.kept) t.citationsKept++; else t.citationsDropped++; }
    if (s.status === 'error') t.errors++;
  }
  return t;
}

/** A money amount: at least two decimals, up to four below one unit (token costs are tiny). */
export function formatCost(amount: number, currency = 'USD', locale?: string): string {
  if (!Number.isFinite(amount)) return '–';
  const small = Math.abs(amount) < 1;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: small ? 4 : 2 }).format(amount);
  } catch {
    return `${amount.toFixed(small ? 4 : 2)} ${currency}`;
  }
}
