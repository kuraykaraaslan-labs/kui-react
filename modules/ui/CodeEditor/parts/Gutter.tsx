'use client';
// modules/ui/CodeEditor/parts/Gutter.tsx
//
// Line-number gutter for the CodeMirror fallback engine. Mirrors what CM6
// produces natively so once the engine swaps the visual width is unchanged.
// M3: a diagnostic dot next to the number of a line that has a marker (its
// worst severity; the message is the dot's title).
//
// TODO M2: breakpoint dots column (left of numbers), click-to-toggle.
// TODO M4: code-folding chevrons.

import { cn } from '@/libs/utils/cn';
import type { Marker } from '../types';

type GutterProps = {
  lineCount: number;
  activeLine: number;
  minHeight: number;
  /** the worst marker of each line that has one */
  markers?: Map<number, Marker>;
};

const DOT: Record<Marker['severity'], string> = { error: 'bg-error', warning: 'bg-warning', info: 'bg-info', hint: 'bg-text-disabled' };

export function Gutter({ lineCount, activeLine, minHeight, markers }: GutterProps) {
  return (
    <div
      data-kui-codeeditor-gutter
      aria-hidden="true"
      className={cn(
        'select-none overflow-hidden border-r border-border bg-surface-overlay',
        'px-2 py-2 text-right font-mono text-xs leading-5 text-text-disabled'
      )}
      style={{ minHeight }}
    >
      {Array.from({ length: lineCount }, (_, i) => i + 1).map((n) => {
        const mk = markers?.get(n);
        return (
          <div
            key={n}
            data-marker={mk?.severity}
            title={mk?.message}
            className={cn(
              'flex items-center justify-end gap-1 tabular-nums',
              n === activeLine && 'text-text-primary font-semibold'
            )}
          >
            {markers && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', mk ? DOT[mk.severity] : 'bg-transparent')} />}
            {n}
          </div>
        );
      })}
    </div>
  );
}
