// Barrel exports for the AI domain vertical.
export * from './types';
export { ChatConversationSidebar } from './chat/ChatConversationSidebar';
export { ChatInputBar } from './chat/ChatInputBar';
export { ChatMessage } from './chat/ChatMessage';
export { AIJobStatusBadge } from './job/AIJobStatusBadge';
export { ModelCard } from './model/ModelCard';
export { ModelProviderBadge } from './model/ModelProviderBadge';
export { ModelTypeBadge } from './model/ModelTypeBadge';
export { UsageStatsCard } from './usage/UsageStatsCard';
export { ModelComparisonTable } from './compare/ModelComparisonTable';
export type { ModelComparisonRow, ModelComparisonTableProps } from './compare/ModelComparisonTable';
export { FeatureCheckCell } from './compare/FeatureCheckCell';
export type { FeatureCheckValue } from './compare/FeatureCheckCell';
export { ModelScoreSparkline } from './compare/ModelScoreSparkline';
// AI chat report: the site assistant's questions, outcomes and the forum help bot.
export * from './report/types';
export {
  CHATBOT_OUTCOME_GROUPS,
  OUTCOME_GROUP,
  OUTCOME_GROUP_COLOR,
  chatbotKpis,
  couldNotAnswer,
  groupCount,
  hasPrevious,
  outcomeRows,
  questionSearchText,
  share as chatbotShare,
  trendPoints,
} from './report/chatbotReport';
export type { ChatbotKpis, ChatbotOutcomeGroup } from './report/chatbotReport';
export { chatbotFormat } from './report/format';
export type { ChatbotFormat } from './report/format';
export { DEFAULT_CHATBOT_REPORT_MESSAGES, fillChatbot } from './report/messages';
export type { ChatbotReportMessages } from './report/messages';
export { ChatbotOutcomeBadge } from './report/ChatbotOutcomeBadge';
export { ChatbotQuestionsTable, COULD_NOT_ANSWER_FILTER } from './report/ChatbotQuestionsTable';
export { ForumHelpBotCard, ForumBotStatusBadge } from './report/ForumHelpBotCard';
export { ChatbotReportView } from './report/ChatbotReportView';
export { demoChatbotReport } from './report/demo';
