# modules/domains/forum

Discussion forum domain — categories, topics, posts, reactions, and forum user profile components.

## Subdirectories

```
category/
moderation/
post/
reaction/
topic/
user/
index.ts
types.ts
```

## Community patterns

Four patterns first built for the kui-community WordPress forum (kui-wordpress-saas) and owned here since 2026-11-08:

| Pattern | Components | Notes |
|---|---|---|
| Accepted solution | `post/AcceptedSolution.tsx`: `AcceptedSolutionBadge`, `MarkSolutionButton`, `acceptedSolutionClasses`; `topic/TopicStatusBadge.tsx`: `TopicSolvedBadge` | The chip on the answer post; the "Mark as solution" / "Unmark solution" toggle (`aria-pressed`) for the topic author or a moderator; `acceptedSolutionClasses.card` / `.author` / `.meta` turn a post card green (success token mixed into the surface). A topic with `solutionPostId` is solved: `TopicRow`'s `topic.isSolved` adds "Solved" beside the status, which stays a separate `TopicStatus`. |
| Staff badge | `user/StaffBadge.tsx` | `{ org, colour?, label? }`: "<Org> staff" with a check, white text on the organisation's colour (any CSS colour, default `var(--primary-active)`), soft ring of the same colour. `ForumUserCard` shows it from `user.staff`. |
| Machine-translated post | `post/TranslatedContent.tsx` | `{ sourceLanguage, sourceLang?, translated, original, defaultShowOriginal?, labels? }`: "Translated from <Language> by AI · Show original", a real button toggling to the original (with `lang={sourceLang}`) and back ("Show translation"). |
| Composer assistant | `topic/SimilarTopics.tsx`: `SimilarTopics`, `SuggestedCategoryHint`; `PostComposer` props `onTitleChange`, `similarTopics`, `suggestedCategoryValue`, `assistLabels` | While the title is typed the host looks up similar topics and a suggested category; the panel under the title lists them ("Already asked? These look similar:", Solved chip, forum, replies) in a polite live region, and the suggestion pre-selects the category until the user picks one. |

## Moderation

`moderation/` holds the moderation screen and the members' Report action, built for kui-community's moderation
(kui-wordpress-saas `plugin/kui-community`: Forums › Moderation and the Report button) and owned here.

| Piece | File | Notes |
|---|---|---|
| Contract | `types.ts`: `ModerationQueueSchema`, `ModerationItemSchema`, `ModerationReportSchema`, `ModerationReportInputSchema`, the enums | One queue the host builds (`wp kui-community moderation --json` prints the same shape). Dates ISO 8601, no IP or e-mail anywhere; `reporter` is null for anyone who is not a moderator. |
| Logic | `moderation/queue.ts` | `itemTabs` (Reported while open reports and not spam, Held while pending, Spam while spam), `moderationCounts`, `itemsForTab` (working order), `itemActions` / `bulkActions` / `applicableIds`, `isDestructive` (spam, trash), `reasonSummary`, `relativeAge`, `applyModerationAction` (the state change a host makes: approve dismisses open reports, spam resolves them, dismiss keeps the post, trash takes it out). |
| Screen | `moderation/ModerationQueueView.tsx` | Tabs with counts; each post with excerpt, topic and forum, author (level, title, posts, joined), age, hold reasons in words, open reports (reason, note, reporter, time); Approve / Not spam, Dismiss reports, Mark as spam, Trash, Open in forum; select all and bulk actions; spam and trash confirmed in a ConfirmDialog; a polite live region says what was done. Container queries: from `@3xl` the author sits beside the post. |
| Report | `moderation/ReportPostDialog.tsx`: `ReportPostDialog`, `ReportPostButton` | Reason (radio cards) + optional note (500 characters, counter); "Reported, thank you" after sending; the button then reads "Reported" (also when the host says `reported`). A failed send keeps the dialog open with an error. |
| Words | `moderation/messages.ts` | `DEFAULT_FORUM_MODERATION_MESSAGES` + `fillModeration`; kui-community carries the same words in its text domain. |
| Demo | `moderation/demo.ts` | `demoModerationQueue()` measured from `MODERATION_DEMO_NOW` (showcase and tests). |

Hold codes: `first_posts`, `links`, `blocklist`, `site_rules`, `reports`, `ai` (any other code reads "Held for review").
Report reasons: `spam`, `abuse`, `off_topic`, `personal_data`, `other`.

## Parity

NextJS-only, no EJS counterpart. The community patterns above mirror kui-wordpress-saas `plugin/kui-community` (`Solution.php`, `Staff.php`, `Translate.php`, `Assist.php` + `assets/community.js`; moderation: `Moderation.php`, `Reports.php`, `ModerationView.php` + `assets/moderation.*`, `assets/report.js`); kui-react is the design source.

## Conventions

1. `'use client';` at top of every component file.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. User/Id types reused from `@/modules/domains/common`.

See [/AGENTS.md](../../../AGENTS.md).
