# ChatbotOutcomeBadge

- **id:** `ai-chatbot-outcome-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/ai/report/ChatbotOutcomeBadge.tsx`
- **status:** stable
- **since:** 2026-11

What one AI chat question ended in (answered with or without sources, sent to the forum, offered a quote, pointed to the team, could not answer, declined, held back, error), as an icon and words; status colours only where the outcome is a status.

## Variants

### Every outcome

```tsx
{CHATBOT_OUTCOMES.map((o) => <ChatbotOutcomeBadge key={o} outcome={o} />)}
```

### Small, translated

```tsx
<ChatbotOutcomeBadge outcome="unanswered" size="sm" label="Keine Antwort gefunden" />
```

## Full source

```tsx
<ChatbotOutcomeBadge outcome="forum" />
```
