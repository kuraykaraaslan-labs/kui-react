import type { ChatbotDay, ChatbotOutcome, ChatbotOutcomeCounts, ChatbotQuestion, ChatbotTotals } from './types'
import { CHATBOT_OUTCOMES } from './types'

/**
 * The outcomes in three groups, the identity of the trend chart's three series and of the outcome bars:
 * answered (`sourced`, `unsourced`), handed on (`forum`, `quote`, `contact`) and not answered (`unanswered`,
 * `refused`, `blocked`, `error`).
 */
export type ChatbotOutcomeGroup = 'answered' | 'handoff' | 'notAnswered'

export const CHATBOT_OUTCOME_GROUPS: ChatbotOutcomeGroup[] = ['answered', 'handoff', 'notAnswered']

export const OUTCOME_GROUP: Record<ChatbotOutcome, ChatbotOutcomeGroup> = {
  sourced: 'answered',
  unsourced: 'answered',
  forum: 'handoff',
  quote: 'handoff',
  contact: 'handoff',
  unanswered: 'notAnswered',
  refused: 'notAnswered',
  blocked: 'notAnswered',
  error: 'notAnswered',
}

/** Each group's fixed series colour (validated `--chart-*` set). Identity follows the group, never its rank. */
export const OUTCOME_GROUP_COLOR: Record<ChatbotOutcomeGroup, string> = {
  answered: 'var(--chart-1)',
  handoff: 'var(--chart-2)',
  notAnswered: 'var(--chart-3)',
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** The sum of a group's outcomes. */
export function groupCount(outcomes: Partial<ChatbotOutcomeCounts> | undefined, group: ChatbotOutcomeGroup): number {
  return CHATBOT_OUTCOMES.reduce((s, o) => (OUTCOME_GROUP[o] === group ? s + n(outcomes?.[o]) : s), 0)
}

/** Share of `part` in `whole` (0 when the whole is 0). */
export const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

/**
 * The headline numbers of a period. `sourcedRate` = questions answered with sources / all questions;
 * `handoffs` = forum + quote + contact; `refusedBlocked` = declined by the model + held back.
 */
export type ChatbotKpis = {
  conversations: number
  questions: number
  sourcedRate: number
  handoffs: number
  couldNotAnswer: number
  refusedBlocked: number
  errors: number
  cost: number
}

export function chatbotKpis(t: Partial<ChatbotTotals> | undefined): ChatbotKpis {
  const o = t?.outcomes
  const questions = n(t?.questions)
  return {
    conversations: n(t?.conversations),
    questions,
    sourcedRate: share(n(o?.sourced), questions),
    handoffs: groupCount(o, 'handoff'),
    couldNotAnswer: n(t?.couldNotAnswer),
    refusedBlocked: n(o?.refused) + n(o?.blocked),
    errors: n(o?.error),
    cost: n(t?.cost),
  }
}

/** Whether the previous period has a value for a KPI (absent or never recorded = nothing to compare with). */
export function hasPrevious(t: Partial<ChatbotTotals> | undefined): boolean {
  return !!t && (n(t.questions) > 0 || n(t.conversations) > 0)
}

/** One row per outcome, in the fixed order, with its share of all questions. */
export function outcomeRows(outcomes: Partial<ChatbotOutcomeCounts> | undefined): { outcome: ChatbotOutcome; group: ChatbotOutcomeGroup; count: number; share: number }[] {
  const total = CHATBOT_OUTCOMES.reduce((s, o) => s + n(outcomes?.[o]), 0)
  return CHATBOT_OUTCOMES.map((outcome) => ({ outcome, group: OUTCOME_GROUP[outcome], count: n(outcomes?.[outcome]), share: share(n(outcomes?.[outcome]), total) }))
}

/** The trend's three series: questions per day in each group (a day without a row is a gap, not zero). */
export function trendPoints(days: ChatbotDay[]): { date: string; answered: number; handoff: number; notAnswered: number }[] {
  return [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, answered: groupCount(d.outcomes, 'answered'), handoff: groupCount(d.outcomes, 'handoff'), notAnswered: groupCount(d.outcomes, 'notAnswered') }))
}

/** The questions the model said it could not answer (whatever it offered instead), newest first. */
export function couldNotAnswer(questions: ChatbotQuestion[]): ChatbotQuestion[] {
  return questions.filter((q) => q.answered === false).sort((a, b) => b.at.localeCompare(a.at))
}

/** The text a question is found by in the table's search: its words, page, language, terms and sources. */
export function questionSearchText(q: ChatbotQuestion): string {
  return [q.text, q.page, q.lang, ...q.searches, ...q.sources.map((s) => s.title)].join(' ').toLowerCase()
}
