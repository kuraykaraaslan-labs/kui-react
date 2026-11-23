# ChatbotQuestionsTable

- **id:** `ai-chatbot-questions-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/ai/report/ChatbotQuestionsTable.tsx`
- **status:** stable
- **since:** 2026-11

The visitors' questions to the AI chat, newest first: searchable, filtered by outcome or "could not answer", 10 a page; a row opens to the sources shown, what the assistant searched for, the page, conversation, model, tokens and cost.

## Variants

### All questions

```tsx
<ChatbotQuestionsTable questions={questions} locale="en-US" siteUrl="https://example.com" />
```

### Filtered to the questions it could not answer, 5 a page

```tsx
<ChatbotQuestionsTable questions={questions} defaultOutcome={COULD_NOT_ANSWER_FILTER} pageSize={5} />
```

## Full source

```tsx
<ChatbotQuestionsTable questions={report.questions} locale="en-US" siteUrl="https://example.com" />
```
