'use client';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlag, faPaperPlane, faRobot } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { ChatThread, type ChatThreadMessage } from '@/modules/ui/ChatThread';
import type { ShowcaseComponent } from '../showcase.types';

// Phase 11.15: one controlled chat thread for support desks, team messaging and AI assistants.

const BASE = Date.UTC(2026, 9, 24, 9, 0);
const minutes = (n: number) => new Date(BASE + n * 60_000);

const TEAM: ChatThreadMessage[] = [
  { id: 'm1', side: 'other', author: { name: 'Grace Hopper' }, body: 'Morning! The 08:00 deploy is out.', at: minutes(0) },
  { id: 'm2', side: 'other', author: { name: 'Grace Hopper' }, body: 'Checkout errors are back to normal.', at: minutes(1) },
  { id: 'm3', side: 'own', author: { name: 'You' }, body: 'Great, thanks. I will close the incident.', at: minutes(4), delivery: 'read' },
  { id: 'm4', side: 'system', author: { name: 'System' }, body: 'Linus Torvalds joined the conversation', at: minutes(60 * 24) },
  {
    id: 'm5',
    side: 'other',
    author: { name: 'Linus Torvalds' },
    body: 'Here is the post-mortem draft.',
    at: minutes(60 * 24 + 2),
    attachments: [{ name: 'post-mortem.pdf', href: '#', size: 248_000 }],
  },
  {
    id: 'm6',
    side: 'own',
    author: { name: 'You' },
    body: 'Can we add the timeline?',
    at: minutes(60 * 24 + 5),
    status: <Badge variant="warning" size="sm">Held for review</Badge>,
    delivery: 'sent',
  },
];

function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState('');
  return (
    <form
      className="flex items-end gap-2 border-t border-border px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        onSend(draft.trim());
        setDraft('');
      }}
    >
      <label htmlFor="chat-thread-demo-draft" className="sr-only">Message</label>
      <textarea
        id="chat-thread-demo-draft"
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a message…"
        className="flex-1 resize-none rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      />
      <Button type="submit" size="sm" disabled={disabled || !draft.trim()} iconLeft={<FontAwesomeIcon icon={faPaperPlane} />}>
        Send
      </Button>
    </form>
  );
}

function TeamThreadDemo() {
  const [items, setItems] = useState<ChatThreadMessage[]>(TEAM.slice(2));
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const report = (id: string) => setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status: <Badge variant="error" size="sm">Reported</Badge> } : m)));
  const withActions = items.map((m) =>
    m.side === 'other'
      ? { ...m, actions: [{ id: 'report', label: 'Report this message', icon: <FontAwesomeIcon icon={faFlag} />, onClick: () => report(m.id) }] }
      : m,
  );
  return (
    <div className="h-[26rem] w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface-base">
      <ChatThread
        className="h-full"
        items={withActions}
        daySeparators
        hasOlder={hasOlder}
        loadingOlder={loadingOlder}
        onLoadOlder={() => {
          setLoadingOlder(true);
          setTimeout(() => {
            setItems((prev) => [...TEAM.slice(0, 2), ...prev]);
            setHasOlder(false);
            setLoadingOlder(false);
          }, 600);
        }}
        typing={[{ name: 'Grace Hopper' }]}
        composer={
          <Composer
            onSend={(text) => setItems((prev) => [...prev, { id: `own-${prev.length}`, side: 'own', author: { name: 'You' }, body: text, at: new Date(), delivery: 'sent' }])}
          />
        }
      />
    </div>
  );
}

const BOT = <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-overlay text-text-secondary"><FontAwesomeIcon icon={faRobot} className="h-3.5 w-3.5" /></span>;
const REPLY = 'A controlled thread keeps the newest line in view while you read at the bottom, and leaves you alone once you scroll up.';

function AssistantDemo() {
  const [items, setItems] = useState<ChatThreadMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function send(text: string) {
    const now = Date.now();
    setItems((prev) => [...prev, { id: `u${now}`, side: 'own', author: { name: 'You' }, body: text, at: new Date(now) }]);
    setWaiting(true);
    setTimeout(() => {
      setWaiting(false);
      setPending(true);
      const id = `a${now}`;
      setItems((prev) => [...prev, { id, side: 'other', author: { name: 'Assistant', avatar: BOT }, body: '', at: new Date(now + 1) }]);
      let shown = 0;
      timer.current = setInterval(() => {
        shown += 6;
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, body: REPLY.slice(0, shown) } : m)));
        if (shown >= REPLY.length && timer.current) {
          clearInterval(timer.current);
          setPending(false);
        }
      }, 60);
    }, 700);
  }

  return (
    <div className="h-[22rem] w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface-base">
      <ChatThread
        className="h-full"
        items={items}
        pending={pending}
        typing={waiting ? [{ name: 'Assistant', avatar: BOT }] : undefined}
        emptyMessage={<p className="py-16 text-center text-sm text-text-secondary">Ask me anything</p>}
        composer={<Composer onSend={send} disabled={pending || waiting} />}
      />
    </div>
  );
}

export function buildChatThreadData(): ShowcaseComponent[] {
  return [
    {
      id: 'chat-thread',
      title: 'ChatThread',
      category: 'Organism',
      abbr: 'Th',
      description:
        'A controlled chat thread: messages oldest first (own / other / system), sticks to the bottom while the reader is there and offers a "New messages" button once they scroll up, "Load older" that keeps the reading position, a streamed last message, who is typing, day separators, status badges, attachments, keyboard-reachable per-message actions, a composer slot and every string from `messages`. role="log", each message an article named by author and time.',
      filePath: 'modules/ui/ChatThread/index.tsx',
      sourceCode: `<ChatThread
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
/>`,
      variants: [
        {
          title: 'Team conversation (load older, day separators, actions, typing)',
          layout: 'stack' as const,
          preview: <TeamThreadDemo />,
          code: `<ChatThread items={items} daySeparators hasOlder={hasOlder} loadingOlder={loading} onLoadOlder={loadOlder} typing={[{ name: 'Grace Hopper' }]} composer={<Composer … />} />`,
        },
        {
          title: 'Assistant with a streamed reply',
          layout: 'stack' as const,
          preview: <AssistantDemo />,
          code: `<ChatThread items={items} pending={streaming} typing={waiting ? [{ name: 'Assistant', avatar: <BotIcon /> }] : undefined} emptyMessage={…} composer={…} />`,
        },
      ],
    },
  ];
}
