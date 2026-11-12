# AssistantLauncher

- **id:** `assistant-launcher`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/AssistantLauncher/index.tsx`
- **status:** stable
- **since:** 2026-11

A floating AI-assistant chat for marketing sites: a 56px launcher fixed bottom right, an optional teaser bubble and a 380px chat panel (full screen under 640px). Controlled: the host owns `open`, the messages and every call. The list is ChatThread (greeting first, typing row while `pending`), cards under a message through `renderAfter` with `AssistantSources` and `AssistantCard`, a consent gate, an offline state, a composer with Enter to send, Shift+Enter for a new line, auto-grow to four lines and a counter past 80 % of `maxLength`. Escape closes and returns focus to the launcher; every string from `messages`.

## Variants

### Closed, with a teaser

```tsx
<AssistantLauncher open={open} onOpenChange={setOpen} title="Hermetry assistant" greeting={greeting} items={items} onSend={send} teaser={{ text: 'Questions about pricing or devices?', onDismiss }} />
```

### Open, before consent

```tsx
<AssistantLauncher … consent={{ text: <ConsentText />, accepted, onAccept: () => setAccepted(true) }} />
```

### A conversation with sources and a quote card

```tsx
<AssistantLauncher … items={items} pending={pending} renderAfter={(item) => (
  <>
    <AssistantSources sources={item.sources} />
    <AssistantCard title="Get a quote" actions={<Button size="sm">Request a quote</Button>}>…</AssistantCard>
  </>
)} />
```

### Offline

```tsx
<AssistantLauncher … offline={<p>The assistant is resting. <a href="/contact">Write to us</a> or <a href="/forum">ask the forum</a>.</p>} />
```

## Full source

```tsx
<AssistantLauncher
  open={open}
  onOpenChange={setOpen}
  title="Hermetry assistant"
  greeting="Hi! What would you like to know?"
  items={messages}
  pending={waitingForReply}
  onSend={(text) => ask(text)}
  consent={{ text: <ConsentText />, accepted, onAccept: () => setAccepted(true) }}
  teaser={showTeaser ? { text: 'Questions? Ask our assistant.', onDismiss: hideTeaser } : undefined}
  offline={resting ? <p>The assistant is resting. <a href="/contact">Write to us</a>.</p> : undefined}
  renderAfter={(item) => item.side === 'other' && sourcesOf(item).length > 0 && (
    <AssistantSources sources={sourcesOf(item)} />
  )}
  messages={{ open: t('chat.open'), send: t('chat.send') }}
/>
```
