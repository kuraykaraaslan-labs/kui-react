import type { ChatbotOutcome, ForumBotStatus } from './types'
import type { ChatbotOutcomeGroup } from './chatbotReport'

/**
 * The words of the AI chat report, English by default. A host passes `messages` (any subset) to translate them.
 * `{count}`, `{days}`, `{date}`, `{start}`, `{end}`, `{model}`, `{total}`, `{turn}` and `{shown}` are filled in.
 */
export const DEFAULT_CHATBOT_REPORT_MESSAGES = {
  title: 'AI chat report',
  rangeLine: '{start} – {end} · compared with the previous {days} days',
  updated: 'Updated {date}',
  neverUpdated: 'Not built yet',
  modelLine: 'Model: {model}',
  rangeLabel: 'Period',
  rangeDays: '{days} days',
  retention: 'Visitors\' questions are kept for {days} days, then deleted. Daily counts (no text) are kept for 13 months.',
  listsShorter: 'The questions, pages and search terms cover the last {days} days: questions are not kept longer.',
  emptyTitle: 'No questions yet',
  emptyDescription: 'Questions visitors ask the AI chat will show here.',
  noData: 'No data for this period yet.',
  vsPrevious: 'vs previous period',
  noPrevious: 'no earlier data',
  lowerIsBetter: 'lower is better',
  // KPIs
  conversations: 'Conversations',
  questions: 'Questions',
  sourcedRate: 'Answered from pages',
  handoffs: 'Handed on',
  handoffsDetail: 'forum {forum} · quote {quote} · contact {contact}',
  couldNotAnswer: 'Could not answer',
  refusedBlocked: 'Declined or held back',
  errors: 'Errors',
  cost: 'Estimated cost',
  costUnknown: '{count} questions on a model without a known price are left out.',
  // Outcomes
  outcomes: 'How questions ended',
  outcome: 'Outcome',
  outcomeSourced: 'Answered with sources',
  outcomeUnsourced: 'Answered without sources',
  outcomeForum: 'Sent to the forum',
  outcomeQuote: 'Offered a quote',
  outcomeContact: 'Pointed to the team',
  outcomeUnanswered: 'Could not answer',
  outcomeRefused: 'Declined',
  outcomeBlocked: 'Held back',
  outcomeError: 'Error',
  groupAnswered: 'Answered',
  groupHandoff: 'Handed on',
  groupNotAnswered: 'Not answered',
  trend: 'Questions per day',
  // Lists
  languages: 'Languages',
  language: 'Language',
  pages: 'Pages where chats start',
  page: 'Page',
  searchTerms: 'What the assistant searched for',
  searchTerm: 'Search term',
  count: 'Count',
  share: 'Share',
  unansweredTitle: 'Questions it could not answer',
  unansweredNone: 'Every question in this period got an answer.',
  unansweredMore: '{count} more in the table below (filter: Could not answer).',
  // Questions table
  questionsTitle: 'Questions',
  questionsShown: 'The newest {shown} of {total} questions.',
  question: 'Question',
  askedAt: 'Asked',
  searchPlaceholder: 'Search questions…',
  allOutcomes: 'All outcomes',
  answeredYes: 'The assistant answered the question.',
  answeredNo: 'The assistant said it could not find the answer.',
  sources: 'Sources shown',
  noSources: 'No sources.',
  searches: 'Searched for',
  noSearches: 'No searches.',
  details: 'Details',
  turn: 'Message {turn} of the conversation',
  conversation: 'Conversation',
  model: 'Model',
  tokens: 'Tokens',
  tokensLine: '{in} read · {out} written',
  signedIn: 'Signed-in visitor',
  anonymous: 'Anonymous visitor',
  costUnknownOne: 'unknown',
  opensInNewTab: '(opens in a new tab)',
  // Forum help bot
  forumBot: 'Forum help bot',
  forumBotIntro: 'New forum topics the bot looked at in this period, and what it did.',
  forumBotOff: 'The forum help bot is switched off. Topics it looked at earlier are still counted.',
  forumBotTopics: 'Topics',
  forumBotRecent: 'Latest topics',
  forumBotAccepted: 'Accepted as the solution',
  forumBotAcceptedShort: 'Accepted',
  forumAnswered: 'Answered',
  forumNoSources: 'No sources',
  forumNotAnswerable: 'Not answerable',
  forumStopped: 'Stopped',
  forumErrors: 'Errors',
  forumSkipped: 'Skipped',
  forumPending: 'Waiting',
  topic: 'Topic',
  status: 'Status',
}

export type ChatbotReportMessages = typeof DEFAULT_CHATBOT_REPORT_MESSAGES

/** The message key of each outcome's label. */
export const OUTCOME_LABEL_KEY: Record<ChatbotOutcome, keyof ChatbotReportMessages> = {
  sourced: 'outcomeSourced',
  unsourced: 'outcomeUnsourced',
  forum: 'outcomeForum',
  quote: 'outcomeQuote',
  contact: 'outcomeContact',
  unanswered: 'outcomeUnanswered',
  refused: 'outcomeRefused',
  blocked: 'outcomeBlocked',
  error: 'outcomeError',
}

export const GROUP_LABEL_KEY: Record<ChatbotOutcomeGroup, keyof ChatbotReportMessages> = {
  answered: 'groupAnswered',
  handoff: 'groupHandoff',
  notAnswered: 'groupNotAnswered',
}

export const FORUM_STATUS_LABEL_KEY: Record<ForumBotStatus, keyof ChatbotReportMessages> = {
  answered: 'forumAnswered',
  noSources: 'forumNoSources',
  notAnswerable: 'forumNotAnswerable',
  stopped: 'forumStopped',
  errors: 'forumErrors',
  skipped: 'forumSkipped',
  pending: 'forumPending',
}

/** `{name}` placeholders filled from `vars`. */
export function fillChatbot(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
