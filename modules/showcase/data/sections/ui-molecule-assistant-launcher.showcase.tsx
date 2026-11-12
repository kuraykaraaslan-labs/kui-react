'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { AssistantCard, AssistantLauncher, AssistantSources } from '@/modules/ui/AssistantLauncher';
import type { ChatThreadMessage } from '@/modules/ui/ChatThread';
import type { ShowcaseComponent } from '../showcase.types';

// A floating AI assistant for marketing sites (kui-ai-chatbot for WordPress ports it pixel for pixel).

const TITLE = 'Hermetry assistant';
const GREETING = 'Hi! I can answer questions about Hermetry: plans, devices, set-up. What would you like to know?';
const CONSENT = (
  <>
    Your messages are processed by an AI provider to answer you. Do not share personal data. See our{' '}
    <a href="#privacy" className="text-primary underline">privacy policy</a>.
  </>
);
const BASE = Date.UTC(2026, 10, 12, 10, 0);
const at = (n: number) => new Date(BASE + n * 60_000);
const ASSISTANT = { name: TITLE };
const YOU = { name: 'You' };

const CONVERSATION: ChatThreadMessage[] = [
  { id: 'u1', side: 'own', author: YOU, body: 'How much does it cost for 40 devices?', at: at(1) },
  {
    id: 'a1',
    side: 'other',
    author: ASSISTANT,
    body: 'The Pro plan covers up to 50 devices for €290 a month, billed yearly. For a fixed price on your fleet, ask for a quote below.',
    at: at(2),
  },
];

const SOURCES: Record<string, { title: string; url: string }[]> = {
  a1: [
    { title: 'Pricing and plans', url: '#pricing' },
    { title: 'What counts as a device?', url: '#docs-devices' },
  ],
};

function QuoteCard() {
  const [sent, setSent] = useState(false);
  return (
    <AssistantCard
      title="Get a quote"
      actions={
        sent ? undefined : (
          <Button size="sm" onClick={() => setSent(true)}>Request a quote</Button>
        )
      }
    >
      {sent ? 'Thanks! Our team will write to you within one working day.' : 'We will send a fixed price for 40 devices to your e-mail.'}
    </AssistantCard>
  );
}

function renderAfter(item: ChatThreadMessage): ReactNode {
  const sources = SOURCES[item.id];
  if (!sources) return null;
  return (
    <>
      <AssistantSources sources={sources} newTab={false} />
      {item.id === 'a1' && <QuoteCard />}
    </>
  );
}

/** Fixed-position children are drawn inside this frame instead of over the showcase page (a transform makes it their containing block). */
function Frame({ children, height = 'h-[44rem]' }: { children: ReactNode; height?: string }) {
  return (
    <div className={cn('relative w-full overflow-hidden rounded-xl border border-border bg-surface-sunken [transform:translateZ(0)]', height)}>
      <div className="p-6 text-sm text-text-secondary">A marketing page…</div>
      {children}
    </div>
  );
}

function TeaserDemo() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(true);
  const [items, setItems] = useState<ChatThreadMessage[]>([]);
  return (
    <Frame height={open ? 'h-[44rem]' : 'h-64'}>
      <AssistantLauncher
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setTeaser(false);
        }}
        title={TITLE}
        greeting={GREETING}
        items={items}
        onSend={(text) => setItems((prev) => [...prev, { id: `u${prev.length}`, side: 'own', author: YOU, body: text, at: new Date() }])}
        teaser={teaser ? { text: 'Questions about pricing or devices? Ask our assistant.', onDismiss: () => setTeaser(false) } : undefined}
      />
    </Frame>
  );
}

function ConsentDemo() {
  const [open, setOpen] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [items, setItems] = useState<ChatThreadMessage[]>([]);
  return (
    <Frame>
      <AssistantLauncher
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        greeting={GREETING}
        items={items}
        onSend={(text) => setItems((prev) => [...prev, { id: `u${prev.length}`, side: 'own', author: YOU, body: text, at: new Date() }])}
        consent={{ text: CONSENT, accepted, onAccept: () => setAccepted(true) }}
      />
    </Frame>
  );
}

const REPLY = 'Yes: every plan includes the mobile app, alarms by e-mail and SMS, and 12 months of history.';

function ConversationDemo() {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<ChatThreadMessage[]>(CONVERSATION);
  const [pending, setPending] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function send(text: string) {
    const now = Date.now();
    setItems((prev) => [...prev, { id: `u${now}`, side: 'own', author: YOU, body: text, at: new Date(now) }]);
    setPending(true);
    timers.current.push(
      setTimeout(() => {
        setItems((prev) => [...prev, { id: `a${now}`, side: 'other', author: ASSISTANT, body: REPLY, at: new Date(now + 1) }]);
        setPending(false);
      }, 1200),
    );
  }

  return (
    <Frame>
      <AssistantLauncher
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        greeting={GREETING}
        items={items}
        pending={pending}
        onSend={send}
        renderAfter={renderAfter}
      />
    </Frame>
  );
}

function OfflineDemo() {
  const [open, setOpen] = useState(true);
  return (
    <Frame>
      <AssistantLauncher
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        greeting={GREETING}
        items={[]}
        onSend={() => {}}
        offline={
          <p>
            The assistant is resting. <a href="#contact" className="text-primary underline">Write to us</a> or{' '}
            <a href="#forum" className="text-primary underline">ask the forum</a>.
          </p>
        }
      />
    </Frame>
  );
}

export function buildAssistantLauncherData(): ShowcaseComponent[] {
  return [
    {
      id: 'assistant-launcher',
      title: 'AssistantLauncher',
      category: 'Organism',
      abbr: 'Ai',
      description:
        'A floating AI-assistant chat for marketing sites: a 56px launcher fixed bottom right, an optional teaser bubble and a 380px chat panel (full screen under 640px). Controlled: the host owns `open`, the messages and every call. The list is ChatThread (greeting first, typing row while `pending`), cards under a message through `renderAfter` with `AssistantSources` and `AssistantCard`, a consent gate, an offline state, a composer with Enter to send, Shift+Enter for a new line, auto-grow to four lines and a counter past 80 % of `maxLength`. Escape closes and returns focus to the launcher; every string from `messages`.',
      filePath: 'modules/ui/AssistantLauncher/index.tsx',
      sourceCode: `<AssistantLauncher
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
/>`,
      variants: [
        {
          title: 'Closed, with a teaser',
          layout: 'stack' as const,
          preview: <TeaserDemo />,
          code: `<AssistantLauncher open={open} onOpenChange={setOpen} title="Hermetry assistant" greeting={greeting} items={items} onSend={send} teaser={{ text: 'Questions about pricing or devices?', onDismiss }} />`,
        },
        {
          title: 'Open, before consent',
          layout: 'stack' as const,
          preview: <ConsentDemo />,
          code: `<AssistantLauncher … consent={{ text: <ConsentText />, accepted, onAccept: () => setAccepted(true) }} />`,
        },
        {
          title: 'A conversation with sources and a quote card',
          layout: 'stack' as const,
          preview: <ConversationDemo />,
          code: `<AssistantLauncher … items={items} pending={pending} renderAfter={(item) => (
  <>
    <AssistantSources sources={item.sources} />
    <AssistantCard title="Get a quote" actions={<Button size="sm">Request a quote</Button>}>…</AssistantCard>
  </>
)} />`,
        },
        {
          title: 'Offline',
          layout: 'stack' as const,
          preview: <OfflineDemo />,
          code: `<AssistantLauncher … offline={<p>The assistant is resting. <a href="/contact">Write to us</a> or <a href="/forum">ask the forum</a>.</p>} />`,
        },
      ],
    },
  ];
}
