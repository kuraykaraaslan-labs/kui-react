'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { cn } from '@/libs/utils/cn';
import type { SavedCard } from '../PaymentTypes';
import { CardBrandBadge } from './CardBrandBadge';

export type SavedCardSelectorMessages = {
  legend: string;
  empty: string;
  isDefault: string;
  remove: string;
  addNew: string;
  /** The ConfirmDialog before a removal: `{last4}` is the card's last four digits. */
  removeTitle: string;
  removeMessage: string;
  cancel: string;
};

export const SAVED_CARD_SELECTOR_MESSAGES: SavedCardSelectorMessages = {
  legend: 'Select payment card',
  empty: 'No saved cards.',
  isDefault: 'Default',
  remove: 'Remove',
  addNew: '+ Add new card',
  removeTitle: 'Remove card',
  removeMessage: 'The card ending in {last4} is removed from your saved cards.',
  cancel: 'Cancel',
};

type SavedCardSelectorProps = {
  cards: SavedCard[];
  selectedCardId?: string;
  onSelect: (cardId: string, card: SavedCard) => void;
  /** Called once the removal is confirmed in the ConfirmDialog (never straight from the button). */
  onRemove?: (cardId: string) => void | Promise<void>;
  onAddNew?: () => void;
  messages?: Partial<SavedCardSelectorMessages>;
  className?: string;
};

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

export function SavedCardSelector({
  cards,
  selectedCardId,
  onSelect,
  onRemove,
  onAddNew,
  messages,
  className,
}: SavedCardSelectorProps) {
  const m = { ...SAVED_CARD_SELECTOR_MESSAGES, ...messages };
  const [active, setActive] = useState<string | undefined>(selectedCardId);
  const [removing, setRemoving] = useState<SavedCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function handleSelect(card: SavedCard) {
    setActive(card.cardId);
    onSelect(card.cardId, card);
  }

  async function confirmRemove() {
    if (!removing || !onRemove) return;
    setBusy(true);
    setError(undefined);
    try {
      await onRemove(removing.cardId);
      setRemoving(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="sr-only">{m.legend}</legend>

      {cards.length === 0 ? (
        <p className="text-sm text-text-secondary py-4 text-center">{m.empty}</p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => {
            const isSelected = active === card.cardId;
            return (
              <label
                key={card.cardId}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-surface-raised p-3 cursor-pointer transition-colors',
                  'focus-within:ring-2 focus-within:ring-border-focus',
                  isSelected ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-border hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="saved-card"
                  value={card.cardId}
                  checked={isSelected}
                  onChange={() => handleSelect(card)}
                  className="sr-only"
                />

                {/* Radio dot */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isSelected ? 'border-primary bg-primary' : 'border-border bg-surface-base',
                  )}
                >
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>

                <CardBrandBadge brand={card.brand} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary font-mono">
                    •••• •••• •••• {card.last4}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {card.cardholderName} &middot; {card.expiryMonth}/{card.expiryYear}
                    {card.isDefault && (
                      <span className="ml-2 text-[10px] font-semibold text-primary uppercase">{m.isDefault}</span>
                    )}
                  </p>
                </div>

                {onRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={(e) => { e.preventDefault(); setError(undefined); setRemoving(card); }}
                    className="text-error shrink-0"
                  >
                    {m.remove}
                  </Button>
                )}
              </label>
            );
          })}
        </div>
      )}

      {onAddNew && (
        <Button variant="outline" size="sm" onClick={onAddNew} className="w-full">
          {m.addNew}
        </Button>
      )}

      {onRemove && (
        <ConfirmDialog
          open={removing !== null}
          tone="danger"
          title={m.removeTitle}
          message={removing ? fill(m.removeMessage, { last4: removing.last4 }) : undefined}
          confirmLabel={m.remove}
          cancelLabel={m.cancel}
          busy={busy}
          error={error}
          onConfirm={() => void confirmRemove()}
          onCancel={() => { if (!busy) setRemoving(null); }}
        />
      )}
    </fieldset>
  );
}
