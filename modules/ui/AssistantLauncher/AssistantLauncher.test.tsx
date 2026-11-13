import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ChatThreadMessage } from '@/modules/ui/ChatThread';
import {
  AssistantCard,
  AssistantLauncher,
  AssistantQuickReplies,
  AssistantQuote,
  AssistantSources,
  type AssistantLauncherProps,
} from './index';

type HarnessProps = Partial<AssistantLauncherProps> & { initialOpen?: boolean };

function Harness({ initialOpen = false, ...props }: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <AssistantLauncher
      title="Hermetry assistant"
      greeting="Hi! Ask me anything about Hermetry."
      items={[]}
      onSend={() => {}}
      {...props}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

const textbox = () => screen.getByRole('textbox', { name: 'Message' });

describe('AssistantLauncher: launcher and panel', () => {
  it('opens from the launcher into a labelled, non-modal dialog and focuses the message box', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const launcher = screen.getByRole('button', { name: 'Open chat' });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(launcher);
    const dialog = screen.getByRole('dialog', { name: 'Hermetry assistant' });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(within(dialog).getByText('AI assistant')).toBeInTheDocument();
    expect(within(dialog).getByText('Hi! Ask me anything about Hermetry.')).toBeInTheDocument();
    expect(textbox()).toHaveFocus();
    expect(screen.getAllByRole('button', { name: 'Close chat' }).length).toBeGreaterThan(0);
  });

  it('Escape closes the panel and returns focus to the launcher', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(textbox()).toHaveFocus();
    fireEvent.keyDown(textbox(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open chat' })).toHaveFocus();
  });

  it('does not steal focus when it is open from the first render', () => {
    render(<Harness initialOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(textbox()).not.toHaveFocus();
  });
});

describe('AssistantLauncher: composer', () => {
  it('Enter sends the trimmed text and clears the box; Shift+Enter does not send', () => {
    const onSend = vi.fn();
    render(<Harness initialOpen onSend={onSend} />);
    fireEvent.change(textbox(), { target: { value: '  How much is it?  ' } });
    fireEvent.keyDown(textbox(), { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textbox(), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('How much is it?');
    expect(textbox()).toHaveValue('');
  });

  it('does not send blank text or while a reply is pending', () => {
    const onSend = vi.fn();
    const items: ChatThreadMessage[] = [
      { id: 'u1', side: 'own', author: { name: 'You' }, body: 'Hello', at: '2026-11-12T10:00:00Z' },
    ];
    render(<Harness initialOpen onSend={onSend} items={items} pending />);
    fireEvent.change(textbox(), { target: { value: '   ' } });
    fireEvent.keyDown(textbox(), { key: 'Enter' });
    fireEvent.change(textbox(), { target: { value: 'Next question' } });
    fireEvent.keyDown(textbox(), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    // The reply is being prepared: a typing row under the visitor's message.
    expect(screen.getByText('Hermetry assistant is typing…')).toBeInTheDocument();
  });

  it('shows the counter only past 80 % of maxLength', () => {
    render(<Harness initialOpen maxLength={10} />);
    expect(textbox()).toHaveAttribute('maxLength', '10');
    fireEvent.change(textbox(), { target: { value: '12345678' } });
    expect(screen.queryByText('8 / 10')).not.toBeInTheDocument();
    fireEvent.change(textbox(), { target: { value: '123456789' } });
    const counter = screen.getByText('9 / 10');
    expect(textbox()).toHaveAttribute('aria-describedby', counter.id);
  });
});

describe('AssistantLauncher: consent, offline, teaser', () => {
  function ConsentHarness() {
    const [accepted, setAccepted] = useState(false);
    return (
      <Harness
        consent={{ text: 'Messages are processed by an AI provider.', accepted, onAccept: () => setAccepted(true) }}
      />
    );
  }

  it('hides the composer behind the consent notice until it is accepted', () => {
    render(<ConsentHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(screen.getByText('Hi! Ask me anything about Hermetry.')).toBeInTheDocument();
    expect(screen.getByText('Messages are processed by an AI provider.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'Start chat' });
    expect(start).toHaveFocus();
    fireEvent.click(start);
    expect(screen.queryByRole('button', { name: 'Start chat' })).not.toBeInTheDocument();
    expect(textbox()).toHaveFocus();
  });

  it('offline replaces the composer', () => {
    render(<Harness initialOpen offline={<p>The assistant is resting.</p>} />);
    expect(screen.getByText('The assistant is resting.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('the teaser opens the panel and its close button dismisses it', () => {
    const onDismiss = vi.fn();
    render(<Harness teaser={{ text: 'Questions about pricing?', onDismiss }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Questions about pricing?' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Questions about pricing?')).not.toBeInTheDocument();
  });
});

describe('AssistantLauncher: extras', () => {
  it('renders cards under a message through renderAfter, with sources in the launcher language', () => {
    const items: ChatThreadMessage[] = [
      { id: 'a1', side: 'other', author: { name: 'Hermetry assistant' }, body: 'Plans start at €29.', at: '2026-11-12T10:00:00Z' },
    ];
    render(
      <Harness
        initialOpen
        items={items}
        messages={{ sources: 'Kaynaklar' }}
        renderAfter={(item) =>
          item.id === 'a1' ? (
            <>
              <AssistantSources sources={[{ title: 'Pricing', url: 'https://example.com/pricing' }]} />
              <AssistantCard title="Get a quote" actions={<button type="button">Request</button>}>
                Tell us about your fleet.
              </AssistantCard>
            </>
          ) : null
        }
      />,
    );
    const articles = screen.getAllByRole('article', { name: 'Hermetry assistant' });
    expect(articles.map((el) => el.getAttribute('data-message-id'))).toEqual(['__assistant-greeting', 'a1']);
    const article = articles[1];
    expect(within(article).getByRole('list', { name: 'Kaynaklar' })).toBeInTheDocument();
    const link = within(article).getByRole('link', { name: /Pricing/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(article).getByText('Get a quote')).toBeInTheDocument();
    expect(within(article).getByRole('button', { name: 'Request' })).toBeInTheDocument();
  });
});

describe('AssistantLauncher: restart, sound, interview parts', () => {
  const reply = (id: string, body = 'An answer.'): ChatThreadMessage => ({
    id,
    side: 'other',
    author: { name: 'Hermetry assistant' },
    body,
    at: '2026-11-13T10:00:00Z',
  });

  it('shows Restart only with onRestart and messages; it calls the host, clears the draft and keeps focus in the panel', () => {
    const onRestart = vi.fn();
    const { rerender } = render(<Harness initialOpen onRestart={onRestart} />);
    expect(screen.queryByRole('button', { name: 'Restart conversation' })).not.toBeInTheDocument();
    rerender(<Harness initialOpen onRestart={onRestart} items={[reply('a1')]} />);
    fireEvent.change(textbox(), { target: { value: 'half a question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restart conversation' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(textbox()).toHaveValue('');
    expect(textbox()).toHaveFocus();
  });

  it('the sound toggle reports its state and chimes for each new assistant message only while on', () => {
    let tones = 0;
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return { frequency: {}, connect() {}, start() { tones++; }, stop() {} };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    try {
      const onSoundChange = vi.fn();
      const props = { initialOpen: true, onSoundChange };
      const { rerender } = render(<Harness {...props} sound items={[reply('a1')]} />);
      const toggle = screen.getByRole('button', { name: 'Sound' });
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(tones).toBe(0); // messages already there on the first render are quiet
      fireEvent.pointerDown(textbox()); // a gesture lets the page start audio
      rerender(<Harness {...props} sound items={[reply('a1'), reply('a2')]} />);
      expect(tones).toBe(2); // two notes
      fireEvent.click(toggle);
      expect(onSoundChange).toHaveBeenCalledWith(false);
      rerender(<Harness {...props} sound={false} items={[reply('a1'), reply('a2'), reply('a3')]} />);
      expect(tones).toBe(2);
      expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(screen.getByRole('button', { name: 'Sound' }));
      expect(onSoundChange).toHaveBeenLastCalledWith(true);
      expect(tones).toBe(4); // turning it on plays it once
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('inputProps give the message box a step\'s hints', () => {
    render(<Harness initialOpen inputProps={{ autoComplete: 'email', inputMode: 'email', placeholder: 'Your e-mail' }} />);
    expect(textbox()).toHaveAttribute('autocomplete', 'email');
    expect(textbox()).toHaveAttribute('inputmode', 'email');
    expect(textbox()).toHaveAttribute('placeholder', 'Your e-mail');
  });

  it('quick replies hand back their value; a quote reads text back', () => {
    const onSelect = vi.fn();
    render(
      <Harness
        initialOpen
        items={[reply('q1', 'Is this what you need?')]}
        renderAfter={() => (
          <>
            <AssistantQuote>120 Modbus devices in the cloud by March.</AssistantQuote>
            <AssistantQuickReplies
              onSelect={onSelect}
              replies={[
                { value: 'confirm', label: 'Yes, send it', primary: true },
                { value: 'cancel', label: 'Cancel' },
              ]}
            />
          </>
        )}
      />,
    );
    expect(screen.getByText('120 Modbus devices in the cloud by March.').tagName).toBe('BLOCKQUOTE');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send it' }));
    expect(onSelect).toHaveBeenCalledWith('confirm');
  });

  it('disabled quick replies cannot be chosen', () => {
    const onSelect = vi.fn();
    render(<AssistantQuickReplies disabled onSelect={onSelect} replies={[{ value: 'skip', label: 'Skip' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
