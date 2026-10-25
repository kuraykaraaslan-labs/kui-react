# ChatThread

- **id:** `chat-thread`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/ChatThread/index.tsx`
- **status:** stable
- **since:** 2026-10

A controlled chat thread: messages oldest first (own / other / system), sticks to the bottom while the reader is there and offers a "New messages" button once they scroll up, "Load older" that keeps the reading position, a streamed last message, who is typing, day separators, status badges, attachments, keyboard-reachable per-message actions, a composer slot and every string from `messages`. role="log", each message an article named by author and time.

## Variants

### Team conversation (load older, day separators, actions, typing)

```tsx
<ChatThread items={items} daySeparators hasOlder={hasOlder} loadingOlder={loading} onLoadOlder={loadOlder} typing={[{ name: 'Grace Hopper' }]} composer={<Composer … />} />
```

### Assistant with a streamed reply

```tsx
<ChatThread items={items} pending={streaming} typing={waiting ? [{ name: 'Assistant', avatar: <BotIcon /> }] : undefined} emptyMessage={…} composer={…} />
```

## Full source

```tsx
<ChatThread
  className="h-[32rem]"
  items={messages.map((m) => ({
    id: m.id,
    side: m.senderId === me ? 'own' : 'other',
    author: { name: m.senderName, avatarUrl: m.avatarUrl },
    body: m.body,
    at: m.createdAt,
    status: m.held ? <Badge variant="warning" size="sm">Held for review</Badge> : undefined,
    actions: m.senderId === me ? [] : [{ id: 'report', label: 'Report', onClick: () => report(m) }],
  }))}
  hasOlder={hasMore}
  loadingOlder={loading}
  onLoadOlder={loadOlder}
  typing={typers}
  pending={streaming}
  daySeparators
  messages={{ empty: t('chat.empty'), loadOlder: t('chat.loadOlder') }}
  composer={<MyComposer onSend={send} />}
/>
```
