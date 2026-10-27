'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faPenToSquare, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Modal } from '@/modules/ui/Modal';
import { paramLabel, type ParamValues } from '../catalog/params';
import type { ParamSpec } from '../catalog/types';
import {
  OUTPUT_NAME_MAX, outputNameProblems, outputRows, outputsExample, paramsOfRows, type OutputNameProblem, type OutputParams, type OutputRow,
} from '../catalog/outputs';
import { useMessages, type EditorMessages } from '../RulesetEditor/messages';
import { PrimaryButton, SecondaryButton } from '../RulesetEditor/dialogs/buttons';

/** what the panel hands back after the dialog: the new params, for each new output the index it was (null: added), and how many outputs there were */
export type OutputsChange = (patch: ParamValues, order: (number | null)[], before: number) => void;

type Row = OutputRow & { key: number };

function problemText(m: EditorMessages, p: OutputNameProblem): string {
  return p === 'chars' ? m.outputsNameChars : p === 'duplicate' ? m.outputsNameDuplicate : p === 'reserved' ? m.outputsNameReserved : m.outputsNameLong(OUTPUT_NAME_MAX);
}

const cellInput = 'w-full min-w-0 rounded-md border bg-surface-base px-2 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const iconBtn = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40';

/**
 * The outputs of a block whose port count is a number param with `pins` (the script block): a short list in the panel
 * ("1 · alarm") and an "Edit outputs" dialog with one row per output (name, and a description when the block declares
 * `pin_notes`), add, remove and drag to reorder. The count is the number of rows; the stored params stay the count and
 * the comma list of names.
 */
export function OutputsField({ id, schema, keys, values, readOnly, error, prefix, onApply }: {
  id: string;
  schema: Record<string, ParamSpec>;
  keys: OutputParams;
  values: ParamValues;
  readOnly: boolean;
  error?: string;
  prefix: string;
  onApply: OutputsChange;
}) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const rows = outputRows(values, schema, keys);
  const label = paramLabel(keys.count, schema[keys.count]);
  return (
    <div data-testid="outputs-field" className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium text-text-primary">{label}</span>
        {!readOnly && (
          <button type="button" data-testid="outputs-edit" onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <FontAwesomeIcon icon={faPenToSquare} className="h-3 w-3" aria-hidden="true" /> {m.outputsEdit}
          </button>
        )}
      </div>
      <ol aria-labelledby={`${id}-label`} data-testid="outputs-list" className="space-y-0.5 rounded-lg border border-border bg-surface-base px-2.5 py-1.5 text-xs">
        {rows.map((r, i) => (
          <li key={i} className="flex min-w-0 items-baseline gap-1.5">
            <span className="font-mono tabular-nums text-text-secondary">{i + 1}</span>
            <span aria-hidden="true" className="text-text-disabled">·</span>
            {r.name ? <span className="truncate font-mono font-semibold text-text-primary">{r.name}</span> : <span className="italic text-text-secondary">{m.outputsUnnamed}</span>}
            {r.note && <span className="min-w-0 truncate text-text-secondary">— {r.note}</span>}
          </li>
        ))}
      </ol>
      {error && <p className="text-xs text-error">{error}</p>}
      {open && (
        <OutputsDialog title={label} schema={schema} keys={keys} initial={rows} prefix={prefix} onClose={() => setOpen(false)}
          onSave={(next) => { setOpen(false); onApply(paramsOfRows(next, keys), next.map((r) => r.from), rows.length); }} />
      )}
    </div>
  );
}

/** The dialog: one row per output, the count from the rows, names checked on their row, a live code example under them. */
export function OutputsDialog({ title, schema, keys, initial, prefix, onSave, onClose }: {
  title: string;
  schema: Record<string, ParamSpec>;
  keys: OutputParams;
  initial: OutputRow[];
  prefix: string;
  onSave: (rows: OutputRow[]) => void;
  onClose: () => void;
}) {
  const m = useMessages();
  const uid = useId();
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((r, i) => ({ ...r, key: i })));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [said, setSaid] = useState('');
  /* after a move by keys or an add, the focus goes to that row's handle or name */
  const focusNext = useRef<{ key: number; part: 'handle' | 'name' } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-row="${f.key}"] [data-part="${f.part}"]`)?.focus();
  }, [rows]);

  const spec = schema[keys.count];
  const min = Math.max(1, spec?.min ?? 1);
  const max = spec?.max ?? 16;
  const namesMax = schema[keys.names]?.max_len;
  /* the names the block had keep working as they are (an old flow may have `Too hot`) */
  const [kept] = useState(() => initial.map((r) => r.name));
  const problems = outputNameProblems(rows, prefix, kept);
  const joined = String(paramsOfRows(rows, keys)[keys.names] ?? '');
  const tooLong = namesMax !== undefined && joined.length > namesMax;
  const valid = !tooLong && problems.every((p) => !p) && rows.length >= min && rows.length <= max;

  const update = (i: number, patch: Partial<OutputRow>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    setRows((rs) => { const next = rs.slice(); const [r] = next.splice(from, 1); next.splice(to, 0, r); return next; });
    setSaid(m.outputsMoved(from + 1, to + 1));
  };
  const add = () => {
    const key = nextKey.current++;
    focusNext.current = { key, part: 'name' };
    setRows((rs) => [...rs, { name: '', note: '', from: null, key }]);
  };
  const submit = () => { if (valid) onSave(rows.map((r) => ({ name: r.name, note: r.note, from: r.from }))); };

  return (
    <Modal open onClose={onClose} title={title} description={m.outputsIntro} size="lg"
      footer={
        <div className="flex w-full items-center gap-2">
          <PrimaryButton data-testid="outputs-save" onClick={submit} disabled={!valid}>{m.outputsSave}</PrimaryButton>
          <SecondaryButton onClick={onClose}>{m.dialogCancel}</SecondaryButton>
        </div>
      }>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
        <div aria-hidden="true" className={cn('grid items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary',
          keys.notes ? 'grid-cols-[2rem_1.5rem_minmax(0,1fr)_minmax(0,1.3fr)_2rem]' : 'grid-cols-[2rem_1.5rem_minmax(0,1fr)_2rem]')}>
          <span /><span>#</span><span>{m.outputsName}</span>{keys.notes && <span>{m.outputsNote}</span>}<span />
        </div>
        <ol ref={listRef} data-testid="outputs-rows" className="space-y-1.5">
          {rows.map((r, i) => {
            const problem = problems[i];
            const errId = `${uid}-err-${r.key}`;
            return (
              <li key={r.key} data-row={r.key} data-testid="outputs-row"
                onDragOver={(e) => { if (dragFrom === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropAt !== i) setDropAt(i); }}
                onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setDropAt(null); }}
                className={cn('rounded-lg border px-1 py-1', dropAt === i && dragFrom !== null && dragFrom !== i ? 'border-primary bg-primary-subtle' : 'border-transparent',
                  dragFrom === i && 'opacity-50')}>
                <div className={cn('grid items-center gap-2', keys.notes ? 'grid-cols-[2rem_1.5rem_minmax(0,1fr)_minmax(0,1.3fr)_2rem]' : 'grid-cols-[2rem_1.5rem_minmax(0,1fr)_2rem]')}>
                  <button type="button" data-part="handle" draggable aria-label={m.outputsMove(i + 1)} title={m.outputsMove(i + 1)} aria-keyshortcuts="ArrowUp ArrowDown"
                    onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                    onDragEnd={() => { setDragFrom(null); setDropAt(null); }}
                    onKeyDown={(e) => {
                      const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
                      if (to === null || to < 0 || to >= rows.length) return;
                      e.preventDefault();
                      focusNext.current = { key: r.key, part: 'handle' };
                      move(i, to);
                    }}
                    className={cn(iconBtn, 'cursor-grab hover:bg-surface-overlay hover:text-text-primary active:cursor-grabbing')}>
                    <FontAwesomeIcon icon={faGripVertical} className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="text-center font-mono text-sm tabular-nums text-text-secondary">{i + 1}</span>
                  <input data-part="name" data-testid="outputs-name" value={r.name} maxLength={OUTPUT_NAME_MAX + 8} placeholder={m.outputsNamePlaceholder}
                    aria-label={`${m.outputsName}, ${m.outputsRow(i + 1)}`} aria-invalid={!!problem} aria-describedby={problem ? errId : undefined}
                    spellCheck={false} autoComplete="off"
                    onChange={(e) => update(i, { name: e.target.value })}
                    className={cn(cellInput, 'font-mono', problem ? 'border-error' : 'border-border')} />
                  {keys.notes && (
                    <input data-part="note" data-testid="outputs-note" value={r.note} maxLength={200}
                      aria-label={`${m.outputsNote}, ${m.outputsRow(i + 1)}`} onChange={(e) => update(i, { note: e.target.value })}
                      className={cn(cellInput, 'border-border')} />
                  )}
                  <button type="button" aria-label={m.outputsRemove(i + 1)} title={m.outputsRemove(i + 1)} disabled={rows.length <= min}
                    onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}
                    className={cn(iconBtn, 'hover:bg-error-subtle hover:text-error disabled:hover:bg-transparent disabled:hover:text-text-secondary')}>
                    <FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
                {problem && <p id={errId} data-testid="outputs-error" className="mt-1 pl-[4.5rem] text-xs text-error">{problemText(m, problem)}</p>}
              </li>
            );
          })}
        </ol>
        <p aria-live="polite" className="sr-only">{said}</p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" data-testid="outputs-add" onClick={add} disabled={rows.length >= max}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-strong disabled:hover:text-text-secondary">
            <FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" /> {m.outputsAdd}
          </button>
          <span className="text-xs tabular-nums text-text-secondary">{rows.length} / {max}</span>
        </div>
        {tooLong && <p role="alert" data-testid="outputs-too-long" className="text-xs text-error">{m.outputsTooLong(namesMax!)}</p>}
        <div>
          <p id={`${uid}-example`} className="mb-1 text-xs font-semibold text-text-secondary">{m.outputsExampleTitle}</p>
          <pre data-testid="outputs-example" aria-labelledby={`${uid}-example`} tabIndex={0}
            className="overflow-x-auto whitespace-pre rounded-lg border border-border bg-surface-sunken px-3 py-2 font-mono text-[11px] leading-relaxed text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            {outputsExample(rows, m.outputsExampleTo, m.outputsExampleEach)}
          </pre>
        </div>
      </form>
    </Modal>
  );
}
