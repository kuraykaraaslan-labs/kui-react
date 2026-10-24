'use client';
// The board's filter list (TB's filters dialog): numbered rows with the name, the filter as one line, edit and remove;
// "Add filter"; Save / Cancel. Edits stay local until Save. A filter a widget uses cannot be removed: the dialog names
// the widgets instead (TB's "Unable to delete filter"), as the aliases dialog does.

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faPen, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Modal } from '@/modules/ui/Modal';
import { BoardFilterDialog } from './BoardFilterDialog';
import { boardFilterText } from './board-filter-text';
import { normalizeBoardFilter } from './key-filters';
import { mergeAliasMessages, type BoardFilterErrorField, type EntityAliasesMessagesInput, type FilterErrorCode } from './messages';
import { MAX_BOARD_FILTERS, validateBoardFilters, type BoardFilterErrors } from './validate-filters';
import type { BoardFilter, BoardParamInfo, EntityAliasesAccess } from './types';

export interface BoardFiltersDialogProps {
  open: boolean;
  filters: readonly BoardFilter[];
  /** Filter key → titles of the widgets that use it. A used filter cannot be removed. */
  usage?: Readonly<Record<string, readonly string[]>>;
  params: readonly BoardParamInfo[];
  /** The entity type to suggest keys for (`access.entityKeys`); absent = the user types key names. */
  entityType?: string;
  access: EntityAliasesAccess;
  onSave: (filters: BoardFilter[]) => void;
  onClose: () => void;
  messages?: EntityAliasesMessagesInput;
  /** Hides "Add filter" (TB `disableAdd`). */
  disableAdd?: boolean;
  title?: string;
}

/** Whether a filter can be removed: not while a widget uses it. Returns the widget titles that block it. */
export function filterRemovalBlockers(key: string, usage?: Readonly<Record<string, readonly string[]>>): readonly string[] {
  return usage?.[key] ?? [];
}

export function BoardFiltersDialog({
  open,
  filters,
  usage,
  params,
  entityType,
  access,
  onSave,
  onClose,
  messages,
  disableAdd,
  title,
}: BoardFiltersDialogProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const [list, setList] = useState<BoardFilter[]>(() => [...filters]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<number | null>(null); // -1 = adding
  const [blocked, setBlocked] = useState<{ name: string; widgets: readonly string[] } | null>(null);
  const [rowErrors, setRowErrors] = useState<{ list?: string; byIndex: BoardFilterErrors[] } | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setList([...filters]);
      setDirty(false);
      setEditing(null);
      setBlocked(null);
      setRowErrors(null);
    }
  }

  const change = (next: BoardFilter[]) => {
    setList(next);
    setDirty(true);
    setRowErrors(null);
  };

  function remove(i: number) {
    const filter = list[i];
    const widgets = filterRemovalBlockers(filter.key, usage);
    if (widgets.length > 0) {
      setBlocked({ name: filter.name, widgets });
      return;
    }
    setBlocked(null);
    change(list.filter((_, j) => j !== i));
  }

  function save() {
    const result = validateBoardFilters(list, { params });
    if (!result.valid) {
      setRowErrors({ list: result.filters ? m.tooManyFilters(MAX_BOARD_FILTERS) : m.invalidFilters, byIndex: result.byIndex });
      return;
    }
    onSave(list.map(normalizeBoardFilter));
  }

  const others = (i: number | null) => list.filter((_, j) => j !== i);
  const editingFilter = editing !== null && editing >= 0 ? list[editing] : undefined;
  const full = list.length >= MAX_BOARD_FILTERS;
  const heading = title ?? m.filtersTitle;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={heading}
        closeLabel={m.close}
        closeOnBackdropClick={false}
        scrollable
        className="max-h-[calc(100vh-2rem)] max-w-3xl"
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            {!disableAdd && (
              <Button
                variant="outline"
                iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" />}
                onClick={() => { setBlocked(null); setEditing(-1); }}
                disabled={full}
                title={full ? m.tooManyFilters(MAX_BOARD_FILTERS) : undefined}
              >
                {m.addFilter}
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="ghost" onClick={onClose}>{m.cancel}</Button>
            <Button onClick={save} disabled={!dirty}>{m.save}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {blocked && (
            <div role="alert" className="rounded-lg border border-error bg-error-subtle px-4 py-3 text-sm text-error-fg">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{m.removeFilterBlockedTitle}</p>
                <button
                  type="button"
                  onClick={() => setBlocked(null)}
                  aria-label={m.close}
                  className="rounded text-error-fg hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1">{m.removeFilterBlocked(blocked.name)}</p>
              <ul className="mt-1 list-disc pl-5">
                {blocked.widgets.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}
          {rowErrors?.list && <p role="alert" className="text-sm text-error">{rowErrors.list}</p>}

          {list.length === 0 ? (
            <EmptyState
              icon={<FontAwesomeIcon icon={faFilter} />}
              title={m.filtersEmptyTitle}
              description={m.filtersEmptyDescription}
              className="py-10"
            />
          ) : (
            <>
              <div aria-hidden="true" className="hidden grid-cols-[2rem_12rem_1fr_5rem] gap-3 px-3 text-xs font-semibold text-text-secondary sm:grid">
                <span />
                <span>{m.columnFilterName}</span>
                <span>{m.columnFilterText}</span>
                <span />
              </div>
              <ol className="space-y-2" aria-label={heading}>
                {list.map((filter, i) => {
                  const errs = rowErrors?.byIndex[i];
                  const firstError = errs
                    ? (Object.entries(errs)[0] as [BoardFilterErrorField, FilterErrorCode] | undefined)
                    : undefined;
                  return (
                    <li
                      key={`${filter.key}-${i}`}
                      className={cn(
                        'grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border bg-surface-base px-3 py-2',
                        'sm:grid-cols-[2rem_12rem_1fr_5rem]',
                        firstError ? 'border-error' : 'border-border',
                      )}
                    >
                      <span className="text-sm text-text-secondary">{i + 1}.</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{filter.name}</p>
                        <p className="truncate font-mono text-xs text-text-disabled">{filter.key}</p>
                      </div>
                      <p className="col-span-3 min-w-0 break-words text-sm text-text-secondary sm:col-span-1">
                        {boardFilterText(filter, { params, messages: m })}
                        {firstError && (
                          <span className="block text-xs text-error">{m.filterError(firstError[0], firstError[1])}</span>
                        )}
                      </p>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" iconOnly aria-label={m.editFilterLabel(filter.name)}
                          onClick={() => { setBlocked(null); setEditing(i); }}>
                          <FontAwesomeIcon icon={faPen} className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="sm" iconOnly aria-label={m.removeFilterLabel(filter.name)} onClick={() => remove(i)}>
                          <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </Modal>

      <BoardFilterDialog
        open={open && editing !== null}
        filter={editingFilter}
        existingKeys={others(editing).map((f) => f.key)}
        existingNames={others(editing).map((f) => f.name)}
        params={params}
        entityType={entityType}
        access={access}
        onSave={(saved) => {
          change(editing !== null && editing >= 0 ? list.map((f, j) => (j === editing ? saved : f)) : [...list, saved]);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
        messages={messages}
      />
    </>
  );
}
