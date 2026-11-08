# modules/domains/forum

Discussion forum domain — categories, topics, posts, reactions, and forum user profile components.

## Subdirectories

```
category/
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

## Parity

NextJS-only, no EJS counterpart. The community patterns above mirror kui-wordpress-saas `plugin/kui-community` (`Solution.php`, `Staff.php`, `Translate.php`, `Assist.php` + `assets/community.js`); kui-react is the design source.

## Conventions

1. `'use client';` at top of every component file.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. User/Id types reused from `@/modules/domains/common`.

See [/AGENTS.md](../../../AGENTS.md).
