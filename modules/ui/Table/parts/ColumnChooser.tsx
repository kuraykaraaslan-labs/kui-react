'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../Button';
import { Badge } from '../../Badge';
import { Checkbox } from '../../Checkbox';
import { useKeepInViewport } from '../../Overlays/shared/useKeepInViewport';

// The `columnChooser` toolbar button: a panel of one checkbox per column the viewer may hide.

export type ColumnChoice = {
  key: string;
  label: string;
  shown: boolean;
  /** The last column shown, which the table keeps. */
  locked: boolean;
};

export function ColumnChooser({
  id,
  label,
  resetLabel,
  hiddenLabel,
  choices,
  hiddenCount,
  changed,
  onChange,
  onReset,
}: {
  id: string;
  /** The button's text and the panel's name (`messages.columns`). */
  label: string;
  resetLabel: string;
  /** Accessible text of the hidden-count badge. */
  hiddenLabel: string;
  choices: ColumnChoice[];
  hiddenCount: number;
  /** The viewer changed the defaults: Reset is enabled. */
  changed: boolean;
  onChange: (key: string, shown: boolean) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = `${id}-columns`;
  useKeepInViewport(panelRef, open);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
      wrapperRef.current?.querySelector<HTMLButtonElement>('[data-part="column-chooser-toggle"]')?.focus();
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0" data-part="column-chooser">
      <Button
        variant="outline"
        size="md"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        iconLeft={<FontAwesomeIcon icon={faTableColumns} className="w-3.5 h-3.5" aria-hidden="true" />}
        className={cn(open && 'bg-surface-overlay')}
        data-part="column-chooser-toggle"
      >
        {label}
        {hiddenCount > 0 && (
          <Badge variant="neutral" size="sm" className="ml-1" aria-label={hiddenLabel}>
            {hiddenCount}
          </Badge>
        )}
      </Button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-full mt-1 z-[70] w-max min-w-[12rem] max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface-raised shadow-xl p-3"
        >
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {choices.map((c) => (
              <Checkbox
                key={c.key}
                id={`${panelId}-${c.key.replace(/[^\w-]/g, '_')}`}
                label={c.label}
                checked={c.shown}
                disabled={c.locked}
                onChange={(e) => onChange(c.key, e.target.checked)}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-end border-t border-border pt-2">
            <Button variant="ghost" size="xs" disabled={!changed} onClick={onReset} data-part="column-chooser-reset">
              {resetLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
