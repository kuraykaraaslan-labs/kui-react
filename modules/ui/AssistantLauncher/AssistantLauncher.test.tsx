import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ChatThreadMessage } from '@/modules/ui/ChatThread';
import { AssistantCard, AssistantLauncher, AssistantSources, type AssistantLauncherProps } from './index';

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
    expect(within(dialog).getByText('AI assistant · answers can be wrong')).toBeInTheDocument();
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
