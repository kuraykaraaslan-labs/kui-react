'use client';
// One key filter (TB's key-filter dialog, inline): the key type (entity field, attribute, latest telemetry), the key
// name (suggested through `access.entityKeys` when the entity type is known, typed otherwise; a typed name is always
// offered), the attribute scope, the value type (preset from a suggested key's type), how the conditions are joined
// and the condition rows. Controlled: every edit calls `onChange` with a whole new key filter.

import { useCallback, useId, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { ComboBox, type ComboBoxOption } from '@/modules/ui/ComboBox';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { PredicateRow } from './PredicateFields';
import { FormPanel } from './RelationFields';
import {
  ATTRIBUTE_SCOPES,
  KEY_FILTER_KEY_TYPES,
  KEY_FILTER_OPERATIONS,
  KEY_FILTER_VALUE_TYPES,
  emptyPredicate,
  withValueType,
} from './key-filters';
import { mergeAliasMessages, type EntityAliasesMessages, type EntityAliasesMessagesInput, type KeyFilterErrorField } from './messages';
import { useLatestRef } from './useAliasData';
import { FILTER_STRING_MAX, MAX_PREDICATES, type KeyFilterErrors } from './validate-filters';
import type {
  AttributeScope,
  BoardParamInfo,
  EntityAliasesAccess,
  EntityKeyInfo,
  KeyFilter,
  KeyFilterKeyType,
  KeyFilterValueType,
} from './types';

export interface KeyFilterEditorProps {
  value: KeyFilter;
  onChange: (keyFilter: KeyFilter) => void;
  /** The board's params: a condition's value can read one of them. */
  params: readonly BoardParamInfo[];
  /** The entity type to suggest keys for (`access.entityKeys`); absent = the user types key names. */
  entityType?: string;
  access: EntityAliasesAccess;
  /** Field errors from `validateKeyFilter` (or `keyFilterErrorsAt` of a filter's errors), shown under their fields. */
  errors?: KeyFilterErrors;
  messages?: EntityAliasesMessagesInput;
  className?: string;
}

/** Whether a suggested key fits the chosen key type and attribute scope (`any` takes every scope). */
export function keyFitsSelection(key: EntityKeyInfo, type: KeyFilterKeyType, scope: AttributeScope | undefined): boolean {
  if (key.type !== type) return false;
  if (type !== 'attribute' || !scope || scope === 'any' || !key.scope) return true;
  return key.scope === scope;
}

/**
 * The key name suggestions: the keys that fit, one per name, the typed text first when no key has that exact name
 * (so a key the host does not know can still be used).
 */
export function keyNameOptions(
  keys: readonly EntityKeyInfo[],
  query: string,
  type: KeyFilterKeyType,
  scope: AttributeScope | undefined,
  m: EntityAliasesMessages,
): { options: ComboBoxOption[]; byName: Map<string, EntityKeyInfo> } {
  const byName = new Map<string, EntityKeyInfo>();
  const options: ComboBoxOption[] = [];
  for (const k of keys) {
    if (!keyFitsSelection(k, type, scope) || byName.has(k.name)) continue;
    byName.set(k.name, k);
    const parts = [k.label && k.label !== k.name ? k.label : null, m.valueTypes[k.valueType], k.scope ? m.attributeScopes[k.scope] : null];
    options.push({ value: k.name, label: k.name, description: parts.filter(Boolean).join(' · ') });
  }
  const typed = query.trim();
  if (typed && !byName.has(typed) && typed.length <= FILTER_STRING_MAX) {
    options.unshift({ value: typed, label: typed, description: m.typedKeyName });
  }
  return { options, byName };
}

function KeyNameField({
  id,
  access,
  entityType,
  keyType,
  scope,
  value,
  onPick,
  error,
  m,
}: {
  id: string;
  access: EntityAliasesAccess;
  entityType: string;
  keyType: KeyFilterKeyType;
  scope: AttributeScope | undefined;
  value: string;
  onPick: (name: string, info: EntityKeyInfo | undefined) => void;
  error?: string;
  m: EntityAliasesMessages;
}) {
  const accessRef = useLatestRef(access);
  const known = useRef(new Map<string, EntityKeyInfo>());
  const onSearch = useCallback(
    async (q: string) => {
      let keys: EntityKeyInfo[] = [];
      try {
        keys = await accessRef.current.entityKeys(entityType, q);
      } catch {
        // No suggestions: the typed name is still offered.
      }
      const { options, byName } = keyNameOptions(keys, q, keyType, scope, m);
      for (const [name, info] of byName) known.current.set(name, info);
      return options;
    },
    [entityType, keyType, scope, accessRef, m],
  );
  return (
    <ComboBox messages={m.comboBox}
      // A new key type or scope starts a new search cache.
      key={`${entityType}:${keyType}:${scope ?? ''}`}
      id={id}
      label={m.keyName}
      options={value ? [{ value, label: value }] : []}
      value={value}
      onChange={(name) => onPick(name, known.current.get(name))}
      onSearch={onSearch}
      placeholder={m.keyNamePlaceholder}
      noResultsText={m.noKeysFound}
      clearable={false}
      error={error}
      required
    />
  );
}

export function KeyFilterEditor({ value, onChange, params, entityType, access, errors, messages, className }: KeyFilterEditorProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const idBase = useId();
  const kf = value;
  const err = (field: KeyFilterErrorField) => {
    const code = errors?.[field];
    return code ? m.filterError(field, code) : undefined;
  };
  const predicates = kf.predicates ?? [];

  function changeKeyType(type: KeyFilterKeyType) {
    onChange({ ...kf, key: { type, name: kf.key.name, ...(type === 'attribute' ? { scope: kf.key.scope ?? 'any' } : {}) } });
  }

  function pickKey(name: string, info: EntityKeyInfo | undefined) {
    const next: KeyFilter = { ...kf, key: { ...kf.key, name } };
    onChange(info && info.valueType !== kf.valueType ? withValueType(next, info.valueType) : next);
  }

  const grid = 'grid grid-cols-1 gap-3 sm:grid-cols-2';
  return (
    <div className={className}>
      <div className="space-y-4">
        <div className={grid}>
          <Select messages={m.select}
            id={`${idBase}-key-type`}
            label={m.keyType}
            options={KEY_FILTER_KEY_TYPES.map((t) => ({ value: t, label: m.keyTypes[t] }))}
            value={kf.key.type}
            onChange={(e) => changeKeyType(e.target.value as KeyFilterKeyType)}
            error={err('key.type')}
            required
          />
          {entityType ? (
            <KeyNameField id={`${idBase}-key-name`} access={access} entityType={entityType} keyType={kf.key.type}
              scope={kf.key.scope} value={kf.key.name} onPick={pickKey} error={err('key.name')} m={m} />
          ) : (
            <Input id={`${idBase}-key-name`} label={m.keyName} value={kf.key.name}
              onChange={(e) => onChange({ ...kf, key: { ...kf.key, name: e.target.value } })}
              maxLength={FILTER_STRING_MAX} hint={m.keyNameHint} error={err('key.name')} required />
          )}
          {kf.key.type === 'attribute' && (
            <Select messages={m.select}
              id={`${idBase}-scope`}
              label={m.attributeScope}
              options={ATTRIBUTE_SCOPES.map((s) => ({ value: s, label: m.attributeScopes[s] }))}
              value={kf.key.scope ?? 'any'}
              onChange={(e) => onChange({ ...kf, key: { ...kf.key, scope: e.target.value as AttributeScope } })}
              error={err('key.scope')}
              required
            />
          )}
          <Select messages={m.select}
            id={`${idBase}-value-type`}
            label={m.valueType}
            options={KEY_FILTER_VALUE_TYPES.map((t) => ({ value: t, label: m.valueTypes[t] }))}
            value={kf.valueType}
            onChange={(e) => onChange(withValueType(kf, e.target.value as KeyFilterValueType))}
            error={err('valueType')}
            required
          />
        </div>

        <FormPanel title={m.predicates}>
          {predicates.length > 1 && (
            <Select messages={m.select}
              id={`${idBase}-operation`}
              label={m.operation}
              options={KEY_FILTER_OPERATIONS.map((o) => ({ value: o, label: m.operations[o] }))}
              value={kf.operation}
              onChange={(e) => onChange({ ...kf, operation: e.target.value === 'or' ? 'or' : 'and' })}
              error={err('operation')}
              className="sm:max-w-xs"
            />
          )}
          {predicates.length === 0 ? (
            <p className="text-sm text-text-secondary">{m.noPredicates}</p>
          ) : (
            <ol className="space-y-2" aria-label={m.predicates}>
              {predicates.map((p, i) => (
                <PredicateRow
                  key={i}
                  idBase={idBase}
                  index={i}
                  predicate={p}
                  valueType={kf.valueType}
                  joinText={m.textJoin[kf.operation] ?? kf.operation}
                  onChange={(next) => onChange({ ...kf, predicates: predicates.map((x, j) => (j === i ? next : x)) })}
                  onRemove={() => onChange({ ...kf, predicates: predicates.filter((_, j) => j !== i) })}
                  params={params}
                  errors={errors}
                  m={m}
                />
              ))}
            </ol>
          )}
          {err('predicates') && <p className="text-xs text-error" role="alert">{err('predicates')}</p>}
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" />}
            disabled={predicates.length >= MAX_PREDICATES}
            onClick={() => onChange({ ...kf, predicates: [...predicates, emptyPredicate(kf.valueType)] })}
          >
            {m.addPredicate}
          </Button>
        </FormPanel>
      </div>
    </div>
  );
}
