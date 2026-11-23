// Barrel exports for the Forum domain vertical.
export * from './types';
export { ForumCategoryCard } from './category/ForumCategoryCard';
export { PostStatusBadge } from './post/PostStatusBadge';
export { ReactionTypeBadge } from './reaction/ReactionTypeBadge';
export { TopicRow } from './topic/TopicRow';
export { TopicStatusBadge, TopicSolvedBadge } from './topic/TopicStatusBadge';
export { SimilarTopics, SuggestedCategoryHint } from './topic/SimilarTopics';
export type { SimilarTopic } from './topic/SimilarTopics';
export { ForumUserCard } from './user/ForumUserCard';
export { ReputationBar } from './user/ReputationBar';
export type { ReputationTier } from './user/ReputationBar';
export { BadgeShelf } from './user/BadgeShelf';
export type { ForumBadge, ForumBadgeTier } from './user/BadgeShelf';
export { UserActivityRow } from './user/UserActivityRow';
export type { UserActivityKind } from './user/UserActivityRow';
export { PostComposer } from './post/PostComposer';
export { AcceptedSolutionBadge, MarkSolutionButton, acceptedSolutionClasses } from './post/AcceptedSolution';
export { TranslatedContent } from './post/TranslatedContent';
export { StaffBadge } from './user/StaffBadge';
export { ModerationQueueView } from './moderation/ModerationQueueView';
export { ReportPostDialog, ReportPostButton } from './moderation/ReportPostDialog';
export { DEFAULT_FORUM_MODERATION_MESSAGES, fillModeration } from './moderation/messages';
export type { ForumModerationMessages } from './moderation/messages';
export {
  MODERATION_TABS,
  applicableIds,
  applyModerationAction,
  bulkActions,
  isDestructive,
  itemActions,
  itemTabs,
  itemsForTab,
  moderationCounts,
  openReports,
  reasonSummary,
  relativeAge,
} from './moderation/queue';
export { demoModerationQueue, MODERATION_DEMO_NOW } from './moderation/demo';
