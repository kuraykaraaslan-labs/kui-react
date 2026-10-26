'use client';
// The filter bar's entity picker (next-boilerplate dashboard phase 41, D41-5): an entity parameter the viewer picks is a
// search box, not a long dropdown. Typing a name asks the host for the matching entities of the parameter's set
// (`loadOptions`, which the host pages, e.g. 50 at a time); one entity is a ComboBox, many are chips (MultiSelect). The
// value is ids; a picked id the box has not seen in a search (a link's pick, a reload) is named through `resolve`, else
// shown as it is. `current` is the entity in effect with no pick (the set's first, a default), shown, never written.
// Read-only shows the entities in a disabled box. The toolbar entity select (`AliasEntitySelect`) is this same picker.

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ComboBox } from '@/modules/ui/ComboBox';
import { MultiSelect } from '@/modules/ui/MultiSelect';
import { mergeAliasMessages, type EntityAliasesMessagesInput } from './messages';
import { toEntityOption, useLatestRef } from './useAliasData';
import type { EntityRef } from './types';

export interface EntityParamPickerProps {
  id?: string;
  label: string;
  /** Many entities (chips) instead of one. */
  multiple?: boolean;
  /** The picked id, or ids with `multiple`; empty = none. */
  value: string | readonly string[] | null | undefined;
  /** The entities of the parameter's set whose name holds `search`, by name. */
  loadOptions: (search: string) => Promise<EntityRef[]>;
  /** Picked ids by name, for ids no search returned yet; absent = such an id is shown as it is. */
  resolve?: (ids: string[]) => Promise<EntityRef[]>;
  /** The entity in effect with no pick (the set's first, a default): shown in the box, never written as a pick. */
  current?: EntityRef | null;
  /** A pick ('' or [] when cleared). */
  onChange: (value: string | string[]) => void;
  /** The entities are shown and cannot be changed. */
  readOnly?: boolean;
  /** A single pick cannot be cleared. */
  required?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  messages?: EntityAliasesMessagesInput;
  className?: string;
}

const idsOf = (value: EntityParamPickerProps['value']): string[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v !== '') : typeof value === 'string' && value !== '' ? [value] : [];

export function EntityParamPicker({
  id,
  label,
  multiple = false,
  value,
  loadOptions,
  resolve,
  current,
  onChange,
  readOnly = false,
  required = false,
  placeholder,
  hint,
  error,
  messages,
  className,
}: EntityParamPickerProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const autoId = useId();
  const boxId = id ?? `entity-param-${autoId}`;
  const loadRef = useLatestRef(loadOptions);
  const resolveRef = useLatestRef(resolve);
  const ids = idsOf(value);
  const [known, setKnown] = useState<Record<string, EntityRef>>({});
  const remember = useCallback((refs: readonly EntityRef[]) => {
    if (refs.length === 0) return;
    setKnown((k) => {
      const next = { ...k };
      for (const r of refs) next[r.id] = r;
      return next;
    });
  }, []);

  // Name the picked ids no search returned yet, once each.
  const missing = ids.filter((x) => !known[x] && x !== current?.id);
  const missingKey = missing.length > 0 && resolve ? JSON.stringify(missing) : '';
  useEffect(() => {
    if (!missingKey) return;
    let live = true;
    resolveRef.current?.(JSON.parse(missingKey) as string[]).then(
      (refs) => { if (live) remember(refs); },
      () => { /* an id the host cannot name is shown as it is */ },
    );
    return () => { live = false; };
  }, [missingKey, resolveRef, remember]);

  const onSearch = useCallback(async (q: string) => {
    const refs = await loadRef.current(q);
    remember(refs);
    return refs.map(toEntityOption);
  }, [loadRef, remember]);

  const option = (x: string) => {
    const ref = known[x] ?? (current?.id === x ? current : undefined);
    return ref ? toEntityOption(ref) : { value: x, label: x };
  };

  if (multiple) {
    return (
      <MultiSelect messages={m.multiSelect}
        id={boxId}
        label={label}
        options={ids.map(option)}
        value={ids}
        onChange={(next) => { if (!readOnly) onChange(next); }}
        onSearch={onSearch}
        placeholder={placeholder ?? m.entitiesPlaceholder}
        disabled={readOnly}
        hint={hint}
        error={error}
        className={className}
      />
    );
  }
  const shown = ids[0] ?? current?.id ?? '';
  return (
    <ComboBox messages={m.comboBox}
      id={boxId}
      label={label}
      options={shown ? [option(shown)] : []}
      value={shown}
      onChange={(next) => {
        if (readOnly || next === shown) return;
        // A required pick is never cleared; an optional one is cleared with ''.
        if (!next && required) return;
        onChange(next);
      }}
      onSearch={onSearch}
      placeholder={placeholder ?? m.entityPlaceholder}
      noResultsText={m.noEntitiesFound}
      disabled={readOnly}
      clearable={!required && !readOnly && ids.length > 0}
      required={required}
      hint={hint}
      error={error}
      className={className}
    />
  );
}
