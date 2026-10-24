'use client';
// Add or edit one filter (TB's filter dialog): the name (the key is derived from it on add and read-only after), the
// key filters (each edited in place with KeyFilterEditor; TB opens a third dialog for one) joined by "and" or "or"
// (the select appears from two key filters on), and the filter as text. Saving validates the caps and normalises the
// filter (only the fields each operation reads).

import { useId, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Input } from '@/modules/ui/Input';
import { Modal } from '@/modules/ui/Modal';
import { Select } from '@/modules/ui/Select';
import { KeyFilterEditor } from './KeyFilterEditor';
import { FormPanel } from './RelationFields';
import { boardFilterText } from './board-filter-text';
import { KEY_FILTER_OPERATIONS, emptyKeyFilter, normalizeBoardFilter } from './key-filters';
import { mergeAliasMessages, type BoardFilterErrorField, type EntityAliasesMessagesInput } from './messages';
import { slugKey } from './validate';
import {
  BOARD_FILTER_NAME_MAX,
  MAX_KEY_FILTERS,
  keyFilterErrorsAt,
  validateBoardFilter,
  type BoardFilterErrors,
} from './validate-filters';
import type { BoardFilter, BoardParamInfo, EntityAliasesAccess, KeyFilter } from './types';

export interface BoardFilterDialogProps {
  open: boolean;
  /** The filter to edit; absent = add a new one. */
  filter?: BoardFilter;
  /** Keys of the board's other filters (the new key avoids them). */
  existingKeys: readonly string[];
  /** Names of the board's other filters (a name must be unique, case-insensitive). */
  existingNames?: readonly string[];
  params: readonly BoardParamInfo[];
  /** The entity type to suggest keys for; absent = the user types key names. */
  entityType?: string;
  access: EntityAliasesAccess;
  onSave: (filter: BoardFilter) => void;
  onClose: () => void;
  messages?: EntityAliasesMessagesInput;
}

type Draft = { name: string; operation: KeyFilter['operation']; keyFilters: KeyFilter[]; submitted: boolean };

const draftOf = (filter?: BoardFilter): Draft => ({
  name: filter?.name ?? '',
  operation: filter?.operation === 'or' ? 'or' : 'and',
  // A new filter starts with one key filter to fill in.
  keyFilters: filter ? [...filter.keyFilters] : [emptyKeyFilter()],
  submitted: false,
});

export function BoardFilterDialog({
  open,
  filter,
  existingKeys,
  existingNames,
  params,
  entityType,
  access,
  onSave,
  onClose,
  messages,
}: BoardFilterDialogProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const idBase = useId();
  const isAdd = !filter;
  const [draft, setDraft] = useState<Draft>(() => draftOf(filter));

  // A new session each time the dialog opens: start from the filter given.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(draftOf(filter));
  }

  const key = filter ? filter.key : slugKey(draft.name, existingKeys, 'filter');
  const candidate = normalizeBoardFilter({ key, name: draft.name, operation: draft.operation, keyFilters: draft.keyFilters });
  const errors: BoardFilterErrors = draft.submitted ? validateBoardFilter(candidate, { existingKeys, existingNames, params }) : {};
  const err = (field: BoardFilterErrorField) => (errors[field] ? m.filterError(field, errors[field]!) : undefined);
  const setKeyFilters = (keyFilters: KeyFilter[]) => setDraft((d) => ({ ...d, keyFilters }));

  function save() {
    setDraft((d) => ({ ...d, submitted: true }));
    if (Object.keys(validateBoardFilter(candidate, { existingKeys, existingNames, params })).length > 0) return;
    onSave(candidate);
  }

  const listError = err('filters');
  const keyFiltersError = err('keyFilters');
  const full = draft.keyFilters.length >= MAX_KEY_FILTERS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAdd ? m.addFilter : m.editFilter}
      closeLabel={m.close}
      closeOnBackdropClick={false}
      scrollable
      className="max-h-[calc(100vh-2rem)] max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{m.cancel}</Button>
          <Button onClick={save}>{isAdd ? m.add : m.save}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {listError && <p role="alert" className="text-sm text-error">{listError}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <Input
            id={`${idBase}-name`}
            label={m.filterName}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            maxLength={BOARD_FILTER_NAME_MAX}
            error={err('name')}
            required
          />
          <Input id={`${idBase}-key`} label={m.key} value={key} readOnly error={err('key')} />
        </div>
        <p className="-mt-2 text-xs text-text-secondary">{m.filterKeyHint}</p>

        <section aria-labelledby={`${idBase}-kf-title`} className="space-y-3">
          <div>
            <h3 id={`${idBase}-kf-title`} className="text-sm font-semibold text-text-primary">{m.keyFilters}</h3>
            <p className="text-xs text-text-secondary">{m.keyFiltersHint(draft.keyFilters.length > 1 ? draft.operation : 'and')}</p>
          </div>
          {draft.keyFilters.length > 1 && (
            <Select messages={m.select}
              id={`${idBase}-operation`}
              label={m.keyFiltersOperation}
              options={KEY_FILTER_OPERATIONS.map((o) => ({ value: o, label: m.operations[o] }))}
              value={draft.operation}
              onChange={(e) => setDraft((d) => ({ ...d, operation: e.target.value === 'or' ? 'or' : 'and' }))}
              error={err('operation')}
              className="sm:max-w-xs"
            />
          )}
          {draft.keyFilters.length === 0 ? (
            <p className="text-sm text-text-secondary">{m.noKeyFilters}</p>
          ) : (
            <ol className="space-y-3">
              {draft.keyFilters.map((kf, i) => {
                const kfErrors = keyFilterErrorsAt(errors, i);
                const titleId = `${idBase}-kf${i}-title`;
                return (
                  <li key={i} className="space-y-2">
                    {i > 0 && (
                      <p className="pl-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">{m.textJoin[draft.operation]}</p>
                    )}
                    <section
                      aria-labelledby={titleId}
                      className={cn(
                        'space-y-3 rounded-lg border bg-surface-raised p-4',
                        Object.keys(kfErrors).length > 0 ? 'border-error' : 'border-border',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 id={titleId} className="text-sm font-semibold text-text-primary">{m.keyFilterTitle(i + 1)}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label={m.removeKeyFilter(i + 1)}
                          onClick={() => setKeyFilters(draft.keyFilters.filter((_, j) => j !== i))}
                        >
                          <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <KeyFilterEditor
                        value={kf}
                        onChange={(next) => setKeyFilters(draft.keyFilters.map((x, j) => (j === i ? next : x)))}
                        params={params}
                        entityType={entityType}
                        access={access}
                        errors={kfErrors}
                        messages={messages}
                      />
                    </section>
                  </li>
                );
              })}
            </ol>
          )}
          {keyFiltersError && <p role="alert" className="text-xs text-error">{keyFiltersError}</p>}
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" />}
            disabled={full}
            onClick={() => setKeyFilters([...draft.keyFilters, emptyKeyFilter()])}
          >
            {m.addKeyFilter}
          </Button>
        </section>

        <FormPanel title={m.filterPreview}>
          <p className="text-sm text-text-primary" aria-live="polite">
            {boardFilterText(candidate, { params, messages: m })}
          </p>
        </FormPanel>
      </div>
    </Modal>
  );
}
