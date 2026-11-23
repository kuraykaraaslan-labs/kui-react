# modules/domains/ai

AI workspace domain — model catalog, chat, fine-tuning jobs, usage telemetry, and the AI chat report.

## Subdirectories

```
chat/
compare/
job/
model/
report/
usage/
index.ts
types.ts
```

## The AI chat report (`report/`)

`ChatbotReportView` shows how a site's AI chat assistant is used and what it could and could not answer. The host
builds one `ChatbotReport` (`report/types.ts`, Zod schemas) and the view only reads it:

- totals for the period and the one before it (KPIs: conversations, questions, answered from pages, handed on,
  could not answer, declined or held back, errors, estimated cost);
- a row per day (questions per outcome; the trend chart groups them as answered, handed on and not answered,
  colours `--chart-1..3` in that fixed order, the outcome bars use their group's colour);
- languages, the pages chats start on and the site-search terms the assistant used;
- the stored questions (the text as the model saw it, contact details already replaced by placeholders, with
  language, page path, outcome, whether it answered, sources, search terms, model, tokens and cost);
- the forum help bot's topics (`forumBot`, null when it is not installed).

Questions are kept `retentionDays` (30) and the daily counts 13 months, so a longer period has shorter lists
(`listsRange`); the view says both. The nine outcomes (`ChatbotOutcomeEnum`) and the "could not answer" flag
(`answered: false`) are defined in `types.ts`; `chatbotReport.ts` holds the sums and shares (tested in
`report.test.tsx`). Words come from `DEFAULT_CHATBOT_REPORT_MESSAGES`; a host translates them with `messages`.
The KPI tiles and the delta are the analytics vertical's `InsightsKpiTile` and `insightsDelta`.

The WordPress set mirrors it: kui-wordpress-saas `plugin/kui-ai-chatbot` records the questions and prints Dashboard ›
AI chat from the same shape (`wp kui-ai-chatbot report --json`); keep the outcomes and sums in step.

## Parity

NextJS-only, no EJS counterpart (the report has a WordPress port, see above).

## Conventions

1. `'use client';` at top of every component file.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. Zod schemas in `types.ts`; each subdirectory re-exports through the root `index.ts`.

See [/AGENTS.md](../../../AGENTS.md).
