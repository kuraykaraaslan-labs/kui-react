import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ContributionBoundary } from '@/modules/ui/ContributionBoundary';
import { PlacementCard, FailedPlacementCard } from '../PlacementCard';
import { WidgetBoard } from '../WidgetBoard';
import { WidgetKitProvider } from '../WidgetKitContext';
import { BUILTIN_KINDS, builtinKind } from '../templates';
import { BUILTIN_VIEWS } from '../views';
import { DEFAULT_WIDGET_KIT_MESSAGES } from '../messages';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import type { BoardDocument } from '../settings/board';

/**
 * A card that throws while it draws (next-boilerplate phase 52.10.2, D597; the board's own card did the same in 52.3.1, UI test 3 #2): it keeps its
 * place with its title, the "Failed to load" badge and a one-line why, in the kit's words, instead of taking the board down (no boundary before) or
 * drawing nothing. A card that draws keeps drawing; a host with its own boundary turns the card's off and draws the same fallback.
 */
const NOW = Date.parse('2026-10-19T10:00:00.000Z');
const kind = builtinKind('stat.value')!;
const fine = BUILTIN_VIEWS['stat.value'];
function Thrower(): never { throw new Error('Error creating WebGL context.'); }
const broken: WidgetKindView = { ...fine, View: Thrower as unknown as WidgetKindView['View'] };
const value = { value: { shape: 'scalar' as const, value: 21.4, fetchedAt: new Date(NOW - 60_000).toISOString() } };

const card = (view: WidgetKindView, title?: string, extra: Record<string, unknown> = {}) => (
  <PlacementCard title={title} template={kind.template} slots={kind.slots} view={view} settings={{}} data={value} now={NOW} {...extra} />
);

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); });

describe('PlacementCard: a card that fails while it draws', () => {
  it('keeps its place with its title, "Failed to load" and why; nothing of the view is drawn', () => {
    render(card(broken, 'Pump room 3D'));
    const note = screen.getByRole('note');
    expect(note).toHaveAttribute('data-reason', 'failed');
    expect(note).toHaveAttribute('data-size', 'card');
    expect(note).toHaveTextContent('Pump room 3D');
    expect(note).toHaveTextContent('Failed to load');
    expect(note).toHaveTextContent('Something went wrong while this card was drawn. Reload the page to try again.');
    // the dashed frame of an unavailable card, filling the cell
    expect(note.className).toContain('border-dashed');
    expect(note.className).toContain('h-full');
    expect(screen.queryByText('21.4')).toBeNull();
  });

  it('a card without a title of its own is "This card"', () => {
    render(card(broken, '  '));
    expect(screen.getByRole('note')).toHaveTextContent('This card');
  });

  it('says it in the host\'s words (messages.card)', () => {
    render(
      <WidgetKitProvider value={{ messages: { card: { failedTitle: 'Bu kart', failedLabel: 'Yüklenemedi', failedDetail: 'Bu kart çizilirken bir sorun oluştu.' } } }}>
        {card(broken)}
      </WidgetKitProvider>,
    );
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Bu kart');
    expect(note).toHaveTextContent('Yüklenemedi');
    expect(note).toHaveTextContent('Bu kart çizilirken bir sorun oluştu.');
    expect(note).not.toHaveTextContent('Failed to load');
  });

  it('a card that draws keeps drawing, with no placeholder', () => {
    render(card(fine, 'Temperature'));
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('draws again when its settings change (a fix made in the editor)', () => {
    let fail = true;
    function Sometimes(p: WidgetViewProps) { if (fail) throw new Error('bad'); return <fine.View {...p} />; }
    const flaky: WidgetKindView = { ...fine, View: Sometimes as WidgetKindView['View'] };
    function Host() {
      const [settings, setSettings] = useState<Record<string, unknown>>({});
      return (
        <>
          <button type="button" onClick={() => { fail = false; setSettings({ label: 'Fixed' }); }}>fix</button>
          <PlacementCard title="Load" template={kind.template} slots={kind.slots} view={flaky} settings={settings} data={value} now={NOW} />
        </>
      );
    }
    render(<Host />);
    expect(screen.getByRole('note')).toHaveTextContent('Failed to load');
    fireEvent.click(screen.getByRole('button', { name: 'fix' }));
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });

  it('isolate={false}: the failure reaches the host\'s own boundary, which draws the same fallback', () => {
    const onError = vi.fn();
    render(
      <ContributionBoundary onError={onError} fallback={<FailedPlacementCard title="Host's" data-testid="host-fallback" />}>
        {card(broken, 'Pump room 3D', { isolate: false })}
      </ContributionBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('host-fallback')).toHaveTextContent('Host\'s');
    expect(screen.getByTestId('host-fallback')).toHaveTextContent('Failed to load');
  });
});

describe('WidgetBoard: one card fails, the others keep drawing', () => {
  it('the failed card keeps its cell; its neighbour draws', () => {
    const doc: BoardDocument = {
      format: 'widgetkit.board', version: 1, templates: {}, board: { title: 'Plant', settings: {} },
      placements: [
        { id: 'a', type: 'stat.value', title: 'Temperature', x: 0, y: 0, w: 6, h: 3, settings: {} },
        { id: 'b', type: 'progress', title: 'Pump room 3D', x: 6, y: 0, w: 6, h: 3, settings: {} },
      ],
    };
    const { container } = render(
      <WidgetBoard doc={doc} data={{ a: value }} kinds={BUILTIN_KINDS} views={{ ...BUILTIN_VIEWS, progress: { ...BUILTIN_VIEWS.progress, View: Thrower as unknown as WidgetKindView['View'] } }} now={NOW} />,
    );
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    const cell = container.querySelector('[data-placement="b"]')!;
    expect(cell).toHaveTextContent('Pump room 3D');
    expect(cell).toHaveTextContent('Failed to load');
  });
});

describe('the failed card\'s texts', () => {
  it('are the English defaults of messages.card', () => {
    expect(DEFAULT_WIDGET_KIT_MESSAGES.card.failedTitle).toBe('This card');
    expect(DEFAULT_WIDGET_KIT_MESSAGES.card.failedLabel).toBe('Failed to load');
    expect(DEFAULT_WIDGET_KIT_MESSAGES.card.failedDetail).toBe('Something went wrong while this card was drawn. Reload the page to try again.');
  });
});
