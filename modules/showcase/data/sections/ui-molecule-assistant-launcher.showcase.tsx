'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import {
  AssistantCard,
  AssistantLauncher,
  AssistantQuickReplies,
  AssistantQuote,
  AssistantSources,
  type AssistantLauncherProps,
  type AssistantQuickReply,
} from '@/modules/ui/AssistantLauncher';
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

// A request taken as chat messages instead of a form: the assistant asks one detail at a time, the
// answers never go to the model, and the visitor confirms the summary before it is sent.
type Step = {
  key: 'name' | 'email' | 'company' | 'need' | 'consent';
  ask: (answers: Record<string, string>) => ReactNode;
  check?: (text: string) => string | null;
  replies?: AssistantQuickReply[];
  input?: AssistantLauncherProps['inputProps'];
};
const SKIP = { value: 'skip', label: 'Skip' };
const CANCEL = { value: 'cancel', label: 'Cancel' };
const NEED = 'Wants 120 Modbus devices on the cloud plan.';
const STEPS: Step[] = [
  { key: 'name', ask: () => 'What is your name?', check: (t) => (t.length < 2 ? 'Please write your name.' : null), replies: [CANCEL], input: { autoComplete: 'name' } },
  {
    key: 'email',
    ask: (a) => `Thanks ${a.name.split(' ')[0]}. Which e-mail address should we reply to?`,
    check: (t) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? null : 'That does not look like an e-mail address. Could you check it?'),
    replies: [CANCEL],
    input: { autoComplete: 'email', inputMode: 'email' },
  },
  { key: 'company', ask: () => 'Which company are you with?', replies: [SKIP, CANCEL], input: { autoComplete: 'organization' } },
  {
    key: 'need',
    ask: () => (
      <>
        Is this what you need? Confirm, or write it in your own words.
        <AssistantQuote>{NEED}</AssistantQuote>
      </>
    ),
    replies: [{ value: 'confirm', label: 'Confirm', primary: true }, CANCEL],
  },
  {
    key: 'consent',
    ask: () => (
      <>
        We will use these details only to answer this request (<a href="#privacy" className="text-primary underline">privacy policy</a>). Send it?
      </>
    ),
    replies: [{ value: 'send', label: 'Send request', primary: true }, CANCEL],
  },
];

function InterviewDemo() {
  const [open, setOpen] = useState(true);
  const [sound, setSound] = useState(false);
  const [items, setItems] = useState<ChatThreadMessage[]>([
    { id: 'u1', side: 'own', author: YOU, body: 'Can I get an offer for 120 devices?', at: at(1) },
    {
      id: 'a1',
      side: 'other',
      author: ASSISTANT,
      body: 'Gladly: the team prepares offers for fleets that size. I will take a few details so they can get back to you.',
      at: at(2),
    },
  ]);
  const [step, setStep] = useState<number | null>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const asked = useRef(false);

  const say = (body: ReactNode, side: 'own' | 'other' = 'other') =>
    setItems((prev) => [...prev, { id: `${side}${prev.length}`, side, author: side === 'own' ? YOU : ASSISTANT, body, at: new Date() }]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    say(STEPS[0].ask({}));
  }, []);

  function advance(next: Record<string, string>, from: number) {
    setAnswers(next);
    if (from + 1 < STEPS.length) {
      setStep(from + 1);
      say(STEPS[from + 1].ask(next));
    } else {
      setStep(null);
      say('Thanks! Your request is with the team; they usually reply within one working day.');
    }
  }

  function answer(text: string) {
    if (step === null) {
      say(text, 'own');
      return;
    }
    const s = STEPS[step];
    say(text, 'own');
    const problem = s.check?.(text) ?? null;
    if (problem) say(problem);
    else advance({ ...answers, [s.key]: text }, step);
  }

  function choose(value: string) {
    if (step === null) return;
    if (value === 'cancel') {
      say('Cancel', 'own');
      setStep(null);
      say('No problem, nothing was sent. Ask me anything else.');
      return;
    }
    const s = STEPS[step];
    say(s.replies?.find((r) => r.value === value)?.label ?? value, 'own');
    advance({ ...answers, [s.key]: value === 'confirm' ? NEED : value === 'skip' ? '' : 'yes' }, step);
  }

  const lastId = items[items.length - 1]?.id;
  const current = step === null ? undefined : STEPS[step];

  return (
    <Frame>
      <AssistantLauncher
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        greeting={GREETING}
        items={items}
        onSend={answer}
        inputProps={current?.input}
        renderAfter={(item) =>
          item.id === lastId && item.side === 'other' && current?.replies ? (
            <AssistantQuickReplies replies={current.replies} onSelect={choose} />
          ) : null
        }
        onRestart={() => {
          setItems([]);
          setStep(null);
          setAnswers({});
        }}
        sound={sound}
        onSoundChange={setSound}
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
        'A floating AI-assistant chat for marketing sites: a 56px launcher fixed bottom right, an optional teaser bubble and a 380px chat panel (full screen under 640px). Controlled: the host owns `open`, the messages and every call. The list is ChatThread (greeting first, typing row while `pending`), cards under a message through `renderAfter` with `AssistantSources` and `AssistantCard`, details asked as chat messages with `AssistantQuickReplies`, `AssistantQuote` and per-step `inputProps`, a header Restart (`onRestart`) and a Sound toggle (`sound`/`onSoundChange`, a two-note Web Audio chime for each new reply), a consent gate, an offline state, a composer with Enter to send, Shift+Enter for a new line, auto-grow to four lines and a counter past 80 % of `maxLength`. Escape closes and returns focus to the launcher; every string from `messages`.',
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
          title: 'A request asked as chat messages, with Restart and Sound',
          layout: 'stack' as const,
          preview: <InterviewDemo />,
          code: `<AssistantLauncher … onSend={answerStep} inputProps={step.input /* autoComplete="email" … */}
  renderAfter={(item) => item.id === lastId && (
    <AssistantQuickReplies replies={[{ value: 'confirm', label: 'Confirm', primary: true }, { value: 'cancel', label: 'Cancel' }]} onSelect={choose} />
  )}
  onRestart={clearConversation} sound={sound} onSoundChange={saveSoundChoice} />`,
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
