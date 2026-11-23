/**
 * The words of the moderation screen and the Report dialog, English by default. A host passes `messages` (any subset)
 * to translate them. `{count}`, `{max}`, `{age}`, `{date}`, `{topic}`, `{name}` and `{detail}` are filled in.
 * kui-community (kui-wordpress-saas) carries the same words in its text domain.
 */
export const DEFAULT_FORUM_MODERATION_MESSAGES = {
  title: 'Moderation',
  subtitle: 'Posts members reported, posts held back before anyone saw them, and spam.',
  tabsLabel: 'Moderation queues',
  tabReported: 'Reported',
  tabHeld: 'Held',
  tabSpam: 'Spam',
  // Items
  topic: 'Topic',
  reply: 'Reply',
  statusPublish: 'Published',
  statusPending: 'Held',
  statusSpam: 'Spam',
  inTopic: 'in {topic}',
  postedAgo: 'posted {age}',
  postsOne: '1 post',
  postsMany: '{count} posts',
  joined: 'joined {date}',
  author: 'Author',
  excerpt: 'Post',
  // Hold reasons
  heldBecause: 'Held because',
  hold_first_posts: 'A new account’s first posts',
  hold_links: 'Links from a member below the links level',
  hold_blocklist: 'Contains a blocked word',
  hold_site_rules: 'Matched the forum’s moderation rules',
  hold_reports: 'Hidden after member reports',
  hold_ai: 'Flagged by the automatic check',
  hold_other: 'Held for review',
  markedBy: 'Marked as spam by {name} {age}',
  markedSpam: 'Marked as spam {age}',
  // Reports
  reportsOne: '1 open report',
  reportsMany: '{count} open reports',
  reportsHandledOne: '1 earlier report handled',
  reportsHandledMany: '{count} earlier reports handled',
  reports: 'Reports',
  reportedBy: 'by {name}',
  aMember: 'a member',
  reason_spam: 'Spam or advertising',
  reason_abuse: 'Abuse or harassment',
  reason_off_topic: 'Off-topic',
  reason_personal_data: 'Personal data',
  reason_other: 'Something else',
  // Actions
  approve: 'Approve',
  notSpam: 'Not spam',
  markSpam: 'Mark as spam',
  trash: 'Trash',
  dismiss: 'Dismiss reports',
  open: 'Open in forum',
  actionsFor: 'Actions for the post by {name}',
  select: 'Select the post by {name}',
  selectAll: 'Select all',
  selected: '{count} selected',
  clearSelection: 'Clear selection',
  bulkLabel: 'Actions for the selected posts',
  // Confirmations
  confirmSpamTitleOne: 'Mark this post as spam',
  confirmSpamTitleMany: 'Mark {count} posts as spam',
  confirmSpamMessage: 'Spam leaves the forum and its author loses the points it earned. Open reports on it are closed.',
  confirmTrashTitleOne: 'Move this post to the trash',
  confirmTrashTitleMany: 'Move {count} posts to the trash',
  confirmTrashMessage: 'The post leaves the forum and its author loses the points it earned. It can be restored from the trash.',
  cancel: 'Cancel',
  // Results
  doneApprove: '{count} approved',
  doneSpam: '{count} marked as spam',
  doneTrash: '{count} moved to the trash',
  doneDismiss: 'Reports dismissed on {count}',
  failed: 'That did not work. Nothing was changed; please try again.',
  // Empty states
  emptyReportedTitle: 'No open reports',
  emptyReportedText: 'When members report a post, it shows up here with their reasons.',
  emptyHeldTitle: 'Nothing is waiting',
  emptyHeldText: 'Posts held by the spam rules show up here until a moderator approves them.',
  emptySpamTitle: 'No spam',
  emptySpamText: 'Posts marked as spam stay here until they are deleted or restored.',
  // Report dialog (members)
  report: 'Report',
  reportPost: 'Report this post',
  reported: 'Reported',
  reportedAlready: 'You reported this post',
  reportIntro: 'Moderators will look at it. The author is not told who reported it.',
  reasonLegend: 'What is wrong with it?',
  hint_spam: 'Advertising, scams or links that have nothing to do with the topic.',
  hint_abuse: 'Insults, threats or attacks on a person.',
  hint_off_topic: 'It does not belong in this topic or forum.',
  hint_personal_data: 'Someone’s private details: address, phone number, e-mail, documents.',
  hint_other: 'Tell the moderators what is wrong in the note.',
  noteLabel: 'Note for the moderators (optional)',
  noteCount: '{count} / {max}',
  send: 'Send report',
  sending: 'Sending…',
  thanksTitle: 'Reported, thank you',
  thanksText: 'A moderator will review the post. You will not hear back about each report.',
  close: 'Close',
  sendFailed: 'The report could not be sent. Please try again.',
}

export type ForumModerationMessages = typeof DEFAULT_FORUM_MODERATION_MESSAGES

/** `{name}` placeholders filled from `vars`. */
export function fillModeration(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
