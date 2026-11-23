# ChatbotReportView

- **id:** `ai-chatbot-report-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/ai/report/ChatbotReportView.tsx`
- **status:** stable
- **since:** 2026-11

How a site's AI chat assistant is used and what it could and could not answer: KPIs against the previous period (conversations, questions, answered from pages, handed on, could not answer, declined or held back, errors, estimated cost), how questions ended, questions per day in three groups, languages, the pages chats start on, what the assistant searched for, the questions it could not answer, every stored question (kept 30 days) and the forum help bot.

## Variants

### 30 days with the period picker, the questions and the forum help bot

```tsx
<ChatbotReportView report={report} locale="en-US" siteUrl="https://example.com" rangeOptions={[7, 30, 90]} onRangeChange={setDays} />
```

### 90 days (lists cover the 30 days questions are kept), forum bot off, translated words

```tsx
<ChatbotReportView report={report} locale="de-DE" messages={{ title: 'KI-Chat-Bericht' }} />
```

### Nobody has asked yet

```tsx
<ChatbotReportView report={emptyReport} />
```

## Full source

```tsx
import { ChatbotReportView } from '@/modules/domains/ai';
<ChatbotReportView report={report} locale="en-US" siteUrl="https://example.com" rangeOptions={[7, 30, 90]} onRangeChange={setDays} />
```
