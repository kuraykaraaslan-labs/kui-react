'use client';
// modules/ui/InlineEditList/index.tsx
//
// InlineEditList — a list whose rows edit in place: add, edit, remove and reorder, all from the keyboard, with a
// validation message per row and an async save state per row. The list is controlled: every change goes through
// `onChange(nextItems, change)`; when that returns a promise the row shows "saving", and a rejection becomes the
// row's error (the parent keeps its items, so the row simply stays as it was).
//
// Keys on a row: Up / Down / Home / End move, Enter or F2 edits, Delete removes, Alt + Up / Down reorders.
// In the editor: Enter saves, Escape cancels.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faCheck, faPen, faPlus, faSpinner, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { fillMessage } from '../_shared/format';

export type InlineEditItem = { id: string; text: string };

export type InlineEditChange<T> =
  | { type: 'add'; id: string; item: T }
  | { type: 'edit'; id: string; item: T }
  | { type: 'remove'; id: string; item: T }
  | { type: 'reorder'; id: string; item: T; from: number; to: number };

export type InlineEditListMessages = {
  label: string;
  add: string;
  empty: string;
  edit: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  save: string;
  cancel: string;
  saving: string;
  saved: string;
  required: string;
  saveFailed: string;
  removeFailed: string;
  reorderFailed: string;
  /** `{name}` */
  editAria: string;
  /** `{name}` */
  removeAria: string;
  /** `{name}` */
  moveUpAria: string;
  /** `{name}` */
  moveDownAria: string;
  /** `{name}`, `{position}`, `{total}` */
  movedAnnounce: string;
  /** `{name}` */
  removedAnnounce: string;
  /** `{name}` */
  addedAnnounce: string;
  /** `{max}` */
  maxReached: string;
  newItem: string;
  editorLabel: string;
};

export const DEFAULT_INLINE_EDIT_LIST_MESSAGES: InlineEditListMessages = {
  label: 'List',
  add: 'Add item',
  empty: 'Nothing here yet.',
  edit: 'Edit',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  save: 'Save',
  cancel: 'Cancel',
  saving: 'Saving…',
  saved: 'Saved',
  required: 'This field is required.',
  saveFailed: 'Could not save. Try again.',
  removeFailed: 'Could not remove. Try again.',
  reorderFailed: 'Could not move. Try again.',
  editAria: 'Edit {name}',
  removeAria: 'Remove {name}',
  moveUpAria: 'Move {name} up',
  moveDownAria: 'Move {name} down',
  movedAnnounce: 'Moved {name} to position {position} of {total}.',
  removedAnnounce: 'Removed {name}.',
  addedAnnounce: 'Added {name}.',
  maxReached: 'At most {max} items.',
  newItem: 'New item',
  editorLabel: 'Value',
};

export type InlineEditorContext<T> = {
  draft: T;
  update: (patch: Partial<T>) => void;
  invalid: boolean;
  /** Spread on the main input: id, aria-invalid, aria-describedby, aria-label, disabled. */
  inputProps: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    'aria-label': string;
    disabled: boolean;
  };
  saving: boolean;
};

export type InlineEditListProps<T extends InlineEditItem = InlineEditItem> = {
  items: T[];
  /**
   * Every change, with the full next list. Return a promise to show a saving state; reject (or throw) to show the
   * row's error. The list does not change until the parent passes new `items`.
   */
  onChange: (next: T[], change: InlineEditChange<T>) => void | Promise<void>;
  /** Return a message to refuse a draft. May be async (a uniqueness check). Default: text must not be empty. */
  validate?: (draft: T, ctx: { items: T[]; mode: 'add' | 'edit' }) => string | null | undefined | Promise<string | null | undefined>;
  /** How a row reads when not editing. Default = its text. */
  renderItem?: (item: T) => React.ReactNode;
  /** A custom editor for the row's fields. Default = one text input bound to `text`. */
  renderEditor?: (ctx: InlineEditorContext<T>) => React.ReactNode;
  /** A blank item for "Add". Needed when `T` has more than `id` and `text`. */
  createItem?: () => T;
  /** What names a row for screen readers. Default = `text`. */
  getName?: (item: T) => string;
  maxItems?: number;
  reorderable?: boolean;
  editable?: boolean;
  removable?: boolean;
  /** Everything off: a plain list. */
  readOnly?: boolean;
  disabled?: boolean;
  messages?: Partial<InlineEditListMessages>;
  className?: string;
};

type Editing<T> = { id: string; mode: 'add' | 'edit'; draft: T; error: string | null; saving: boolean };
type RowState = { status: 'saving' | 'error' | 'saved'; message?: string };

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function InlineEditList<T extends InlineEditItem = InlineEditItem>({
  items,
  onChange,
  validate,
  renderItem,
  renderEditor,
  createItem,
  getName,
  maxItems,
  reorderable = true,
  editable = true,
  removable = true,
  readOnly = false,
  disabled = false,
  messages,
  className,
}: InlineEditListProps<T>) {
  const msg = useMemo(() => ({ ...DEFAULT_INLINE_EDIT_LIST_MESSAGES, ...messages }), [messages]);
  const uid = useId();
  const listRef = useRef<HTMLUListElement | null>(null);
  const counter = useRef(0);
  const [editing, setEditing] = useState<Editing<T> | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const nameOf = useCallback((item: T) => (getName ? getName(item) : item.text) || msg.newItem, [getName, msg.newItem]);
  const canEdit = editable && !readOnly && !disabled;
  const canRemove = removable && !readOnly && !disabled;
  const canReorder = reorderable && !readOnly && !disabled && items.length > 1;
  const canAdd = !readOnly && !disabled && editing === null && (maxItems === undefined || items.length < maxItems);

  const active = activeId && items.some((i) => i.id === activeId) ? activeId : items[0]?.id ?? null;

  // Put DOM focus on a row after a reorder or when an editor closes (a moved node loses focus in the browser).
  useEffect(() => {
    if (!focusRequest) return;
    listRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(focusRequest.id)}"]`)?.focus();
  }, [focusRequest]);
  const focusRow = (id: string) => { setActiveId(id); setFocusRequest((r) => ({ id, n: (r?.n ?? 0) + 1 })); };

  const setRow = (id: string, state: RowState | null) => setRows((prev) => {
    const next = { ...prev };
    if (state) next[id] = state; else delete next[id];
    return next;
  });
  const flashSaved = (id: string) => {
    setRow(id, { status: 'saved' });
    timers.current.push(setTimeout(() => setRows((prev) => (prev[id]?.status === 'saved' ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)) : prev)), 2000));
  };

  const run = async (id: string, change: InlineEditChange<T>, next: T[], failMessage: string): Promise<boolean> => {
    try {
      const r = onChange(next, change);
      if (r && typeof (r as Promise<void>).then === 'function') {
        setRow(id, { status: 'saving' });
        await r;
      }
      return true;
    } catch (e) {
      setRow(id, { status: 'error', message: errorMessage(e, failMessage) });
      return false;
    }
  };

  // ── Editing ────────────────────────────────────────────────────────────────────────────────
  const startEdit = (item: T) => {
    if (!canEdit || editing) return;
    setRow(item.id, null);
    setEditing({ id: item.id, mode: 'edit', draft: { ...item }, error: null, saving: false });
  };
  const startAdd = () => {
    if (!canAdd) return;
    const blank = createItem ? createItem() : ({ id: `${uid}-new-${++counter.current}`, text: '' } as T);
    setActiveId(blank.id);
    setEditing({ id: blank.id, mode: 'add', draft: blank, error: null, saving: false });
  };
  const cancelEdit = () => {
    const id = editing?.id;
    const wasEdit = editing?.mode === 'edit';
    setEditing(null);
    if (id && wasEdit) focusRow(id);
    else if (items.length) focusRow(items[items.length - 1].id);
  };
  const commit = async () => {
    if (!editing || editing.saving) return;
    const { draft, mode, id } = editing;
    let problem: string | null | undefined;
    try {
      problem = validate ? await validate(draft, { items, mode }) : draft.text?.trim() ? null : msg.required;
    } catch (e) {
      problem = errorMessage(e, msg.saveFailed);
    }
    if (problem) { setEditing((cur) => (cur ? { ...cur, error: problem as string } : cur)); return; }
    const next = mode === 'add' ? [...items, draft] : items.map((it) => (it.id === id ? draft : it));
    setEditing((cur) => (cur ? { ...cur, error: null, saving: true } : cur));
    setRow(id, null);
    const ok = await run(id, { type: mode, id, item: draft }, next, msg.saveFailed);
    if (ok) {
      setEditing(null);
      setRow(id, null);
      flashSaved(id);
      setAnnounce(mode === 'add' ? fillMessage(msg.addedAnnounce, { name: nameOf(draft) }) : msg.saved);
      focusRow(id);
    } else {
      setEditing((cur) => (cur ? { ...cur, saving: false, error: null } : cur));
    }
  };

  // ── Remove and reorder ─────────────────────────────────────────────────────────────────────
  const remove = async (item: T) => {
    if (!canRemove || rows[item.id]?.status === 'saving') return;
    const index = items.findIndex((i) => i.id === item.id);
    const ok = await run(item.id, { type: 'remove', id: item.id, item }, items.filter((i) => i.id !== item.id), msg.removeFailed);
    if (ok) {
      setRow(item.id, null);
      setAnnounce(fillMessage(msg.removedAnnounce, { name: nameOf(item) }));
      const neighbour = items[index + 1] ?? items[index - 1];
      if (neighbour) focusRow(neighbour.id);
    }
  };
  const move = async (item: T, delta: -1 | 1) => {
    if (!canReorder || rows[item.id]?.status === 'saving') return;
    const from = items.findIndex((i) => i.id === item.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    const ok = await run(item.id, { type: 'reorder', id: item.id, item, from, to }, next, msg.reorderFailed);
    if (ok) {
      setRow(item.id, null);
      setAnnounce(fillMessage(msg.movedAnnounce, { name: nameOf(item), position: to + 1, total: items.length }));
      focusRow(item.id);
    }
  };

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLLIElement>, item: T, index: number) => {
    if (e.target !== e.currentTarget) return; // keys inside a button or input belong to it
    const go = (i: number) => { const t = items[Math.min(Math.max(i, 0), items.length - 1)]; if (t) focusRow(t.id); };
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { void move(item, e.key === 'ArrowUp' ? -1 : 1); e.preventDefault(); return; }
    switch (e.key) {
      case 'ArrowDown': go(index + 1); break;
      case 'ArrowUp': go(index - 1); break;
      case 'Home': go(0); break;
      case 'End': go(items.length - 1); break;
      case 'Enter':
      case 'F2': startEdit(item); break;
      case 'Delete': void remove(item); break;
      default: return;
    }
    e.preventDefault();
  };

  const editorRow = (item: T | null, ed: Editing<T>) => {
    const inputId = `${uid}-input-${ed.id}`;
    const errId = `${uid}-err-${ed.id}`;
    const update = (patch: Partial<T>) => setEditing((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...patch }, error: null } : cur));
    const saveError = rows[ed.id]?.status === 'error' ? rows[ed.id].message : undefined;
    const shownError = ed.error ?? saveError ?? null;
    const props = {
      id: inputId,
      'aria-invalid': ed.error !== null,
      'aria-describedby': shownError ? errId : undefined,
      'aria-label': item ? fillMessage(msg.editAria, { name: nameOf(item) }) : msg.editorLabel,
      disabled: ed.saving,
    };
    return (
      <div
        className="flex flex-col gap-1.5"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
          else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); void commit(); }
        }}
      >
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-48 flex-1">
            {renderEditor
              ? renderEditor({ draft: ed.draft, update, invalid: ed.error !== null, inputProps: props, saving: ed.saving })
              : (
                <input
                  {...props}
                  type="text"
                  autoFocus
                  value={ed.draft.text}
                  onChange={(e) => update({ text: e.target.value } as Partial<T>)}
                  className={cn(
                    'w-full rounded-md border bg-surface-base px-2.5 py-1.5 text-sm text-text-primary disabled:opacity-50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    ed.error ? 'border-error' : 'border-border',
                  )}
                />
              )}
          </div>
          <button type="button" onClick={() => void commit()} disabled={ed.saving} className={cn(btn, 'border-primary bg-primary text-primary-fg hover:bg-primary-hover')}>
            <FontAwesomeIcon icon={ed.saving ? faSpinner : faCheck} aria-hidden="true" className={cn('me-1.5 h-3 w-3', ed.saving && 'animate-spin motion-reduce:animate-none')} />
            {ed.saving ? msg.saving : msg.save}
          </button>
          <button type="button" onClick={cancelEdit} disabled={ed.saving} className={btn}>
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" className="me-1.5 h-3 w-3" />{msg.cancel}
          </button>
        </div>
        {shownError && <p id={errId} role="alert" className="text-xs text-error-fg">{shownError}</p>}
      </div>
    );
  };

  const addingNew = editing?.mode === 'add' ? editing : null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul ref={listRef} aria-label={msg.label} className="flex flex-col gap-1.5">
        {items.map((item, index) => {
          const ed = editing?.mode === 'edit' && editing.id === item.id ? editing : null;
          const state = rows[item.id];
          const name = nameOf(item);
          const isActive = active === item.id;
          return (
            <li
              key={item.id}
              data-row-id={item.id}
              data-state={state?.status}
              tabIndex={ed ? -1 : isActive ? 0 : -1}
              aria-busy={state?.status === 'saving' || undefined}
              aria-label={ed ? undefined : name}
              onKeyDown={(e) => !ed && onRowKeyDown(e, item, index)}
              onFocus={(e) => { if (e.target === e.currentTarget) setActiveId(item.id); }}
              className={cn(
                'rounded-md border bg-surface-raised px-3 py-2 text-sm',
                state?.status === 'error' ? 'border-error' : 'border-border',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            >
              {ed ? editorRow(item, ed) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 break-words text-text-primary">{renderItem ? renderItem(item) : item.text}</div>
                  {state?.status === 'saving' && (
                    <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                      <FontAwesomeIcon icon={faSpinner} aria-hidden="true" className="h-3 w-3 animate-spin motion-reduce:animate-none" />{msg.saving}
                    </span>
                  )}
                  {state?.status === 'saved' && (
                    <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                      <FontAwesomeIcon icon={faCheck} aria-hidden="true" className="h-3 w-3" />{msg.saved}
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {canReorder && (
                      <>
                        <IconBtn icon={faArrowUp} label={fillMessage(msg.moveUpAria, { name })} title={msg.moveUp} tab={isActive} disabled={index === 0 || state?.status === 'saving'} onClick={() => void move(item, -1)} />
                        <IconBtn icon={faArrowDown} label={fillMessage(msg.moveDownAria, { name })} title={msg.moveDown} tab={isActive} disabled={index === items.length - 1 || state?.status === 'saving'} onClick={() => void move(item, 1)} />
                      </>
                    )}
                    {canEdit && <IconBtn icon={faPen} label={fillMessage(msg.editAria, { name })} title={msg.edit} tab={isActive} disabled={editing !== null || state?.status === 'saving'} onClick={() => startEdit(item)} />}
                    {canRemove && <IconBtn icon={faTrash} label={fillMessage(msg.removeAria, { name })} title={msg.remove} tab={isActive} disabled={state?.status === 'saving'} onClick={() => void remove(item)} />}
                  </div>
                </div>
              )}
              {!ed && state?.status === 'error' && <p role="alert" className="mt-1 text-xs text-error-fg">{state.message}</p>}
            </li>
          );
        })}
        {addingNew && (
          <li data-row-id={addingNew.id} data-new="true" aria-label={msg.newItem} className="rounded-md border border-primary bg-surface-raised px-3 py-2 text-sm">
            {editorRow(null, addingNew)}
          </li>
        )}
      </ul>

      {items.length === 0 && !addingNew && <p className="text-sm text-text-secondary">{msg.empty}</p>}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={startAdd} disabled={!canAdd} className={btn}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" className="me-1.5 h-3 w-3" />{msg.add}
          </button>
          {maxItems !== undefined && items.length >= maxItems && <span className="text-xs text-text-secondary">{fillMessage(msg.maxReached, { max: maxItems })}</span>}
        </div>
      )}
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  );
}

const btn = cn(
  'inline-flex items-center rounded border border-border bg-surface-base px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors',
  'hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
);

function IconBtn({ icon, label, title, tab, disabled, onClick }: { icon: typeof faPen; label: string; title: string; tab: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      tabIndex={tab ? 0 : -1}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <FontAwesomeIcon icon={icon} aria-hidden="true" className="h-3 w-3" />
    </button>
  );
}
