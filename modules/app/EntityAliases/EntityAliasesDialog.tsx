'use client';
// The board's alias list (TB's entity-aliases dialog): numbered rows with the name, the filter as one line, the
// "resolve as multiple" switch, edit and remove; "Add alias"; Save / Cancel. Edits stay local until Save. An alias a
// widget uses cannot be removed: the dialog names the widgets instead (TB's "Unable to delete entity alias").

import { useId, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLayerGroup, faPen, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Modal } from '@/modules/ui/Modal';
import { Toggle } from '@/modules/ui/Toggle';
import { EntityAliasDialog } from './EntityAliasDialog';
import { entityFilterText } from './filter-text';
import { normalizeAlias } from './filters';
import { mergeAliasMessages, type EntityAliasesMessagesInput } from './messages';
import { useAliasCatalog } from './useAliasData';
import { MAX_ALIASES, validateAliases, type AliasErrors } from './validate';
import type { BoardParamInfo, EntityAlias, EntityAliasesAccess } from './types';

export interface EntityAliasesDialogProps {
  open: boolean;
  aliases: readonly EntityAlias[];
  /** Alias key → titles of the widgets that use it. A used alias cannot be removed. */
  usage?: Readonly<Record<string, readonly string[]>>;
  params: readonly BoardParamInfo[];
  access: EntityAliasesAccess;
  allowedEntityTypes?: readonly string[];
  onSave: (aliases: EntityAlias[]) => void;
  onClose: () => void;
  messages?: EntityAliasesMessagesInput;
  /** Hides "Add alias" (TB `disableAdd`). */
  disableAdd?: boolean;
  title?: string;
}

/** Whether an alias can be removed: not while a widget uses it. Returns the widget titles that block it. */
export function aliasRemovalBlockers(key: string, usage?: Readonly<Record<string, readonly string[]>>): readonly string[] {
  return usage?.[key] ?? [];
}

export function EntityAliasesDialog({
  open,
  aliases,
  usage,
  params,
  access,
  allowedEntityTypes,
  onSave,
  onClose,
  messages,
  disableAdd,
  title,
}: EntityAliasesDialogProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const idBase = useId();
  const { entityTypes, providers } = useAliasCatalog(access, open);
  const [list, setList] = useState<EntityAlias[]>(() => [...aliases]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<number | null>(null); // -1 = adding
  const [blocked, setBlocked] = useState<{ name: string; widgets: readonly string[] } | null>(null);
  const [rowErrors, setRowErrors] = useState<{ list?: string; byIndex: AliasErrors[] } | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setList([...aliases]);
      setDirty(false);
      setEditing(null);
      setBlocked(null);
      setRowErrors(null);
    }
  }

  const change = (next: EntityAlias[]) => {
    setList(next);
    setDirty(true);
    setRowErrors(null);
  };

  function remove(i: number) {
    const alias = list[i];
    const widgets = aliasRemovalBlockers(alias.key, usage);
    if (widgets.length > 0) {
      setBlocked({ name: alias.name, widgets });
      return;
    }
    setBlocked(null);
    change(list.filter((_, j) => j !== i));
  }

  function save() {
    const result = validateAliases(list, { params });
    if (!result.valid) {
      setRowErrors({ list: result.aliases ? m.tooManyAliases(MAX_ALIASES) : m.invalidAliases, byIndex: result.byIndex });
      return;
    }
    onSave(list.map(normalizeAlias));
  }

  const others = (i: number | null) => list.filter((_, j) => j !== i);
  const editingAlias = editing !== null && editing >= 0 ? list[editing] : undefined;
  const full = list.length >= MAX_ALIASES;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title ?? m.aliasesTitle}
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
                title={full ? m.tooManyAliases(MAX_ALIASES) : undefined}
              >
                {m.addAlias}
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
                <p className="font-semibold">{m.removeBlockedTitle}</p>
                <button
                  type="button"
                  onClick={() => setBlocked(null)}
                  aria-label={m.close}
                  className="rounded text-error-fg hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1">{m.removeBlocked(blocked.name)}</p>
              <ul className="mt-1 list-disc pl-5">
                {blocked.widgets.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}
          {rowErrors?.list && <p role="alert" className="text-sm text-error">{rowErrors.list}</p>}

          {list.length === 0 ? (
            <EmptyState
              icon={<FontAwesomeIcon icon={faLayerGroup} />}
              title={m.emptyTitle}
              description={m.emptyDescription}
              className="py-10"
            />
          ) : (
            <>
              <div aria-hidden="true" className="hidden grid-cols-[2rem_12rem_1fr_7rem_5rem] gap-3 px-3 text-xs font-semibold text-text-secondary sm:grid">
                <span />
                <span>{m.columnName}</span>
                <span>{m.columnFilter}</span>
                <span>{m.columnResolveMultiple}</span>
                <span />
              </div>
              <ol className="space-y-2" aria-label={title ?? m.aliasesTitle}>
                {list.map((alias, i) => {
                  const errs = rowErrors?.byIndex[i];
                  const firstError = errs ? (Object.entries(errs)[0] as [keyof AliasErrors, NonNullable<AliasErrors[keyof AliasErrors]>] | undefined) : undefined;
                  const single = alias.filter.type === 'singleEntity';
                  return (
                    <li
                      key={`${alias.key}-${i}`}
                      className={cn(
                        'grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border bg-surface-base px-3 py-2',
                        'sm:grid-cols-[2rem_12rem_1fr_7rem_5rem]',
                        firstError ? 'border-error' : 'border-border',
                      )}
                    >
                      <span className="text-sm text-text-secondary">{i + 1}.</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{alias.name}</p>
                        <p className="truncate font-mono text-xs text-text-disabled">{alias.key}</p>
                      </div>
                      <p className="col-span-3 min-w-0 text-sm text-text-secondary sm:col-span-1">
                        {entityFilterText(alias.filter, { entityTypes, params, messages: m, relationProviders: providers })}
                        {firstError && (
                          <span className="block text-xs text-error">{m.error(firstError[0], firstError[1])}</span>
                        )}
                      </p>
                      <Toggle
                        id={`${idBase}-rm-${i}`}
                        label=""
                        ariaLabel={m.resolveMultipleLabel(alias.name)}
                        checked={single ? false : alias.resolveMultiple}
                        disabled={single}
                        onChange={(on) => change(list.map((a, j) => (j === i ? { ...a, resolveMultiple: on } : a)))}
                        className="col-span-2 sm:col-span-1"
                      />
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" iconOnly aria-label={m.editLabel(alias.name)}
                          onClick={() => { setBlocked(null); setEditing(i); }}>
                          <FontAwesomeIcon icon={faPen} className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="sm" iconOnly aria-label={m.removeLabel(alias.name)} onClick={() => remove(i)}>
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

      <EntityAliasDialog
        open={open && editing !== null}
        alias={editingAlias}
        existingKeys={others(editing).map((a) => a.key)}
        existingNames={others(editing).map((a) => a.name)}
        params={params}
        access={access}
        allowedEntityTypes={allowedEntityTypes}
        onSave={(saved) => {
          change(editing !== null && editing >= 0 ? list.map((a, j) => (j === editing ? saved : a)) : [...list, saved]);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
        messages={messages}
      />
    </>
  );
}
