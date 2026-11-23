import { z } from 'zod'

/* =========================================================
   AI CHAT REPORT — how a site's AI chat assistant is used, what it could and could not answer, and the
   visitors' questions (kept 30 days), plus the forum help bot's topics. The host builds the report and the view
   only reads it. The WordPress port (kui-wordpress-saas plugin/kui-ai-chatbot, Dashboard › AI chat and
   `wp kui-ai-chatbot report --json`) produces exactly this shape.
========================================================= */

/**
 * What one question (one visitor message that reached the model) ended in:
 * - `sourced`: answered from the site's pages (with sources)
 * - `unsourced`: answered without sources (small talk, a follow-up the conversation answered)
 * - `forum`: sent to the community forum with the question drafted
 * - `quote`: offered a quote request
 * - `contact`: pointed to the team (contact)
 * - `unanswered`: the model said it could not find the answer and offered no next step
 * - `refused`: the model declined
 * - `blocked`: the reply was held back (it repeated the instructions)
 * - `error`: no usable answer (the model was busy, failed or answered out of shape)
 */
export const ChatbotOutcomeEnum = z.enum(['sourced', 'unsourced', 'forum', 'quote', 'contact', 'unanswered', 'refused', 'blocked', 'error'])

/** The outcomes in their fixed display order. */
export const CHATBOT_OUTCOMES = ChatbotOutcomeEnum.options

const count = z.number().nonnegative().default(0)

export const ChatbotOutcomeCountsSchema = z.object({
  sourced: count,
  unsourced: count,
  forum: count,
  quote: count,
  contact: count,
  unanswered: count,
  refused: count,
  blocked: count,
  error: count,
})

export const ChatbotRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.number().int().nonnegative(),
})

/**
 * A period's totals. `questions` = messages that reached the model (one row each); `limited` = messages refused by a
 * limit before the model saw them; `quotesSent` = quote and information requests the visitor actually sent.
 * `cost` is in `currency` (USD), estimated from each question's tokens at its model's list price; `costUnknown`
 * counts questions whose model has no price in the table (their cost is left out).
 */
export const ChatbotTotalsSchema = z.object({
  conversations: count,
  questions: count,
  outcomes: ChatbotOutcomeCountsSchema.prefault({}),
  couldNotAnswer: count,
  limited: count,
  quotesSent: count,
  tokensIn: count,
  tokensOut: count,
  cost: count,
  costUnknown: count,
})

export const ChatbotDaySchema = z.object({
  date: z.string(),
  conversations: count,
  questions: count,
  outcomes: ChatbotOutcomeCountsSchema.prefault({}),
  cost: count,
})

/** A language code, a page path or a site-search term with how often it came up. */
export const ChatbotKeyCountSchema = z.object({ key: z.string(), count: count })

export const ChatbotSourceSchema = z.object({ title: z.string(), url: z.string() })

/**
 * One stored question: the text as the model saw it (contact details already replaced by placeholders), its
 * language, the page path it was asked on (no query string), the outcome, whether the model said it answered the
 * question (`null` when there was no answer: refused, blocked, error), the sources shown with the reply, the
 * site-search terms the model used, the model, tokens and estimated cost. `conversation` is an opaque per-chat id;
 * `signedIn` says the visitor was signed in (the row is linked to their account for export and erasure).
 */
export const ChatbotQuestionSchema = z.object({
  id: z.string(),
  at: z.string(),
  conversation: z.string(),
  turn: z.number().int().positive().default(1),
  lang: z.string().default(''),
  page: z.string().default(''),
  text: z.string(),
  outcome: ChatbotOutcomeEnum,
  answered: z.boolean().nullable().default(null),
  sources: z.array(ChatbotSourceSchema).default([]),
  searches: z.array(z.string()).default([]),
  model: z.string().default(''),
  tokensIn: count,
  tokensOut: count,
  cost: z.number().nonnegative().nullable().default(null),
  signedIn: z.boolean().default(false),
})

/**
 * The forum help bot (it answers new forum topics from the docs and solved topics, or stays silent). Per topic the
 * bot was due on: `answered` (it replied), `noSources` (nothing to answer from), `notAnswerable` (the sources did not
 * answer it), `stopped` (the model refused or was cut off), `errors` (the API failed or it gave up after retries),
 * `skipped` (solved, closed or answered by the team first), `pending` (not due yet). `accepted` = its replies marked
 * as the solution.
 */
export const ForumBotStatusEnum = z.enum(['answered', 'noSources', 'notAnswerable', 'stopped', 'errors', 'skipped', 'pending'])
export const FORUM_BOT_STATUSES = ForumBotStatusEnum.options

export const ForumBotTotalsSchema = z.object({
  topics: count,
  answered: count,
  noSources: count,
  notAnswerable: count,
  stopped: count,
  errors: count,
  skipped: count,
  pending: count,
  accepted: count,
})

export const ForumBotTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().default(''),
  at: z.string(),
  status: ForumBotStatusEnum,
  /** Why it stopped or failed (stop reason, short error), when known. */
  detail: z.string().default(''),
  accepted: z.boolean().default(false),
})

/** `off`: the bot is switched off or the forum is missing (the totals may still hold earlier topics). */
export const ForumBotReportSchema = z.object({
  state: z.enum(['ok', 'off']),
  totals: ForumBotTotalsSchema.prefault({}),
  previousTotals: ForumBotTotalsSchema.partial().optional(),
  recent: z.array(ForumBotTopicSchema).default([]),
})

export const ChatbotReportSchema = z.object({
  generatedAt: z.string().nullable().default(null),
  range: ChatbotRangeSchema,
  previousRange: ChatbotRangeSchema.optional(),
  /** The part of the range the question lists cover (questions are kept `retentionDays`). */
  listsRange: ChatbotRangeSchema,
  retentionDays: z.number().int().positive().default(30),
  /** The model the chat uses now. */
  model: z.string().default(''),
  currency: z.string().default('USD'),
  totals: ChatbotTotalsSchema,
  previousTotals: ChatbotTotalsSchema.partial().optional(),
  days: z.array(ChatbotDaySchema).default([]),
  languages: z.array(ChatbotKeyCountSchema).default([]),
  pages: z.array(ChatbotKeyCountSchema).default([]),
  searchTerms: z.array(ChatbotKeyCountSchema).default([]),
  /** The newest questions of `listsRange`, newest first (the host may cap them; `questionsTotal` is the full count). */
  questions: z.array(ChatbotQuestionSchema).default([]),
  questionsTotal: count,
  /** Null when the forum help bot is not installed. */
  forumBot: ForumBotReportSchema.nullable().default(null),
})

/* =========================================================
   TYPES
========================================================= */

export type ChatbotOutcome = z.infer<typeof ChatbotOutcomeEnum>
export type ChatbotOutcomeCounts = z.infer<typeof ChatbotOutcomeCountsSchema>
export type ChatbotRange = z.infer<typeof ChatbotRangeSchema>
export type ChatbotTotals = z.infer<typeof ChatbotTotalsSchema>
export type ChatbotDay = z.infer<typeof ChatbotDaySchema>
export type ChatbotKeyCount = z.infer<typeof ChatbotKeyCountSchema>
export type ChatbotSource = z.infer<typeof ChatbotSourceSchema>
export type ChatbotQuestion = z.infer<typeof ChatbotQuestionSchema>
export type ForumBotStatus = z.infer<typeof ForumBotStatusEnum>
export type ForumBotTotals = z.infer<typeof ForumBotTotalsSchema>
export type ForumBotTopic = z.infer<typeof ForumBotTopicSchema>
export type ForumBotReport = z.infer<typeof ForumBotReportSchema>
export type ChatbotReport = z.infer<typeof ChatbotReportSchema>
