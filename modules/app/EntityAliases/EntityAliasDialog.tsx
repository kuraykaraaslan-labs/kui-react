'use client';
// Add or edit one alias (TB's entity-alias dialog): the name (the key is derived from it on add and read-only after),
// "resolve as multiple entities" with its hint, the entity filter form and a preview. Saving validates the caps and
// refuses a filter that matches no entity (TB `noEntityMatched`).

import { useId, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Input } from '@/modules/ui/Input';
import { Modal } from '@/modules/ui/Modal';
import { Toggle } from '@/modules/ui/Toggle';
import { AliasPreviewPanel, useAliasPreview } from './AliasPreview';
import { EntityFilterForm } from './EntityFilterForm';
import { isFilterComplete, normalizeAlias } from './filters';
import { mergeAliasMessages, type AliasErrorField, type EntityAliasesMessagesInput } from './messages';
import { ALIAS_NAME_MAX, slugKey, validateAlias, type AliasErrors } from './validate';
import type { BoardParamInfo, EntityAlias, EntityAliasFilter, EntityAliasesAccess } from './types';

export interface EntityAliasDialogProps {
  open: boolean;
  /** The alias to edit; absent = add a new one. */
  alias?: EntityAlias;
  /** Keys of the board's other aliases (the new key avoids them). */
  existingKeys: readonly string[];
  /** Names of the board's other aliases (a name must be unique, case-insensitive). */
  existingNames?: readonly string[];
  params: readonly BoardParamInfo[];
  access: EntityAliasesAccess;
  allowedEntityTypes?: readonly string[];
  onSave: (alias: EntityAlias) => void;
  onClose: () => void;
  messages?: EntityAliasesMessagesInput;
}

/** The key and name of the alias sent to `access.preview` (only its filter and resolve-multiple matter). */
export const PREVIEW_KEY = 'draft';
export const PREVIEW_NAME = 'Draft';

type Draft = { name: string; resolveMultiple: boolean; filter: EntityAliasFilter | null; submitted: boolean };

const draftOf = (alias?: EntityAlias): Draft => ({
  name: alias?.name ?? '',
  resolveMultiple: alias?.resolveMultiple ?? false,
  filter: alias?.filter ?? null,
  submitted: false,
});

export function EntityAliasDialog({
  open,
  alias,
  existingKeys,
  existingNames,
  params,
  access,
  allowedEntityTypes,
  onSave,
  onClose,
  messages,
}: EntityAliasDialogProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const idBase = useId();
  const isAdd = !alias;
  const [draft, setDraft] = useState<Draft>(() => draftOf(alias));
  const [saving, setSaving] = useState(false);

  // A new session each time the dialog opens: start from the alias given.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(draftOf(alias));
      setSaving(false);
    }
  }

  const key = alias ? alias.key : slugKey(draft.name, existingKeys);
  const single = draft.filter?.type === 'singleEntity';
  const candidate: EntityAlias | null = draft.filter
    ? normalizeAlias({ key, name: draft.name, resolveMultiple: single ? false : draft.resolveMultiple, filter: draft.filter })
    : null;
  // The preview depends on the filter only: it is asked with a fixed key and name, so typing the name does not
  // start a new request.
  const previewJson =
    candidate && isFilterComplete(candidate.filter, params)
      ? JSON.stringify({ key: PREVIEW_KEY, name: PREVIEW_NAME, resolveMultiple: candidate.resolveMultiple, filter: candidate.filter })
      : '';
  const preview = useAliasPreview(access, open ? previewJson : '');

  // Before a type is picked there is no filter yet; validateAlias then reports `filter.type`.
  const toValidate = candidate ?? { key, name: draft.name, resolveMultiple: false, filter: null as unknown as EntityAliasFilter };
  const errors: AliasErrors = draft.submitted ? validateAlias(toValidate, { existingKeys, existingNames, params }) : {};
  const err = (field: AliasErrorField) => (errors[field] ? m.error(field, errors[field]!) : undefined);
  const listError = err('aliases');

  async function save() {
    setDraft((d) => ({ ...d, submitted: true }));
    if (!candidate) return;
    if (Object.keys(validateAlias(candidate, { existingKeys, existingNames, params })).length > 0) return;
    setSaving(true);
    const status = previewJson ? await preview.checkNow(previewJson) : 'error';
    setSaving(false);
    if (status === 'empty') return;
    onSave(candidate);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAdd ? m.addAlias : m.editAlias}
      closeLabel={m.close}
      closeOnBackdropClick={false}
      scrollable
      className="max-h-[calc(100vh-2rem)] max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{m.cancel}</Button>
          <Button onClick={() => { void save(); }} loading={saving} disabled={saving || preview.status === 'empty'}>
            {isAdd ? m.add : m.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {listError && <p role="alert" className="text-sm text-error">{listError}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <Input
            id={`${idBase}-name`}
            label={m.name}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            maxLength={ALIAS_NAME_MAX}
            error={err('name')}
            required
          />
          <Input id={`${idBase}-key`} label={m.key} value={key} readOnly error={err('key')} />
        </div>
        <p className="-mt-2 text-xs text-text-secondary">{m.keyHint}</p>
        <Toggle
          id={`${idBase}-multiple`}
          label={m.resolveMultiple}
          description={single ? m.resolveMultipleSingleEntity : m.resolveMultipleHint}
          checked={single ? false : draft.resolveMultiple}
          disabled={single}
          onChange={(on) => setDraft((d) => ({ ...d, resolveMultiple: on }))}
        />
        <EntityFilterForm
          value={draft.filter}
          onChange={(filter) => setDraft((d) => ({ ...d, filter }))}
          resolveMultiple={draft.resolveMultiple}
          onResolveMultipleChange={(resolveMultiple) => setDraft((d) => ({ ...d, resolveMultiple }))}
          params={params}
          access={access}
          allowedEntityTypes={allowedEntityTypes}
          errors={errors}
          messages={messages}
        />
        <AliasPreviewPanel status={preview.status} result={preview.result} m={m} />
      </div>
    </Modal>
  );
}
