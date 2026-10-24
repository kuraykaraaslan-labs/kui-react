'use client';
// The pickers the filter form is built from, each a kui primitive fed through the host's access: the entity type
// select (Select), one entity (ComboBox with async search), a list of entities (MultiSelect with async search) and the
// subtype chips (MultiSelect). Stored ids get their names through `entitiesByIds`.

import { useCallback, useEffect, useState } from 'react';
import { Select, type SelectOption } from '@/modules/ui/Select';
import { ComboBox } from '@/modules/ui/ComboBox';
import { MultiSelect } from '@/modules/ui/MultiSelect';
import { toEntityOption, useEntityRefs, useLatestRef } from './useAliasData';
import type { EntityAliasesMessages } from './messages';
import type { EntityAliasesAccess, EntityTypeInfo } from './types';

/** Keeps a stored value visible even when the list no longer offers it. */
function withCurrent(options: SelectOption[], value: string): SelectOption[] {
  return value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options;
}

export function EntityTypeSelect({
  id,
  label,
  value,
  onChange,
  entityTypes,
  allowedEntityTypes,
  subtypesOnly,
  error,
  m,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (entityType: string) => void;
  entityTypes: readonly EntityTypeInfo[];
  allowedEntityTypes?: readonly string[];
  /** Only types that have subtypes (the subtype filter). */
  subtypesOnly?: boolean;
  error?: string;
  m: EntityAliasesMessages;
}) {
  const options = withCurrent(
    entityTypes
      .filter((t) => !allowedEntityTypes?.length || allowedEntityTypes.includes(t.key))
      .filter((t) => !subtypesOnly || t.hasSubtypes)
      .map((t) => ({ value: t.key, label: t.label })),
    value,
  );
  return (
    <Select
      id={id}
      label={label ?? m.entityType}
      options={options}
      placeholder={m.entityTypePlaceholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      required
    />
  );
}

export function EntityPicker({
  id,
  label,
  access,
  entityType,
  value,
  onChange,
  error,
  m,
}: {
  id: string;
  label?: string;
  access: EntityAliasesAccess;
  entityType: string;
  value: string;
  onChange: (id: string) => void;
  error?: string;
  m: EntityAliasesMessages;
}) {
  const accessRef = useLatestRef(access);
  const { known, remember } = useEntityRefs(access, entityType, value ? [value] : []);
  const onSearch = useCallback(
    async (q: string) => {
      if (!entityType) return [];
      const refs = await accessRef.current.searchEntities(entityType, q);
      remember(refs);
      return refs.map(toEntityOption);
    },
    [entityType, remember, accessRef],
  );
  const current = value ? (known[value] ? toEntityOption(known[value]) : { value, label: value }) : null;
  return (
    <ComboBox
      // A new entity type starts a new search cache.
      key={entityType}
      id={id}
      label={label ?? m.entity}
      options={current ? [current] : []}
      value={value}
      onChange={onChange}
      onSearch={onSearch}
      placeholder={m.entityPlaceholder}
      noResultsText={m.noEntitiesFound}
      disabled={!entityType}
      clearable={false}
      error={error}
      required
    />
  );
}

export function EntityListPicker({
  id,
  access,
  entityType,
  value,
  onChange,
  error,
  m,
}: {
  id: string;
  access: EntityAliasesAccess;
  entityType: string;
  value: readonly string[];
  onChange: (ids: string[]) => void;
  error?: string;
  m: EntityAliasesMessages;
}) {
  const accessRef = useLatestRef(access);
  const { known, remember } = useEntityRefs(access, entityType, value);
  const onSearch = useCallback(
    async (q: string) => {
      if (!entityType) return [];
      const refs = await accessRef.current.searchEntities(entityType, q);
      remember(refs);
      return refs.map(toEntityOption);
    },
    [entityType, remember, accessRef],
  );
  return (
    <MultiSelect
      key={entityType}
      id={id}
      label={m.entities}
      options={value.map((v) => (known[v] ? toEntityOption(known[v]) : { value: v, label: v }))}
      value={[...value]}
      onChange={onChange}
      onSearch={onSearch}
      placeholder={m.entitiesPlaceholder}
      disabled={!entityType}
      error={error}
    />
  );
}

export function SubtypesPicker({
  id,
  label,
  access,
  entityType,
  value,
  onChange,
  hint,
  error,
  m,
}: {
  id: string;
  label: string;
  access: EntityAliasesAccess;
  entityType: string;
  value: readonly string[];
  onChange: (subtypes: string[]) => void;
  hint?: string;
  error?: string;
  m: EntityAliasesMessages;
}) {
  const accessRef = useLatestRef(access);
  const [loaded, setLoaded] = useState<{ entityType: string; options: SelectOption[] }>({ entityType: '', options: [] });
  useEffect(() => {
    if (!entityType) return;
    let live = true;
    accessRef.current.subtypes(entityType, '').then(
      (options) => { if (live) setLoaded({ entityType, options }); },
      () => { /* the chips still show the stored values */ },
    );
    return () => { live = false; };
  }, [entityType, accessRef]);
  const onSearch = useCallback(
    (q: string) => (entityType ? accessRef.current.subtypes(entityType, q) : Promise.resolve([])),
    [entityType, accessRef],
  );
  const base = loaded.entityType === entityType ? loaded.options : [];
  const options = [...base, ...value.filter((v) => !base.some((o) => o.value === v)).map((v) => ({ value: v, label: v }))];
  return (
    <MultiSelect
      key={entityType}
      id={id}
      label={label}
      options={options}
      value={[...value]}
      onChange={onChange}
      onSearch={onSearch}
      placeholder={m.subtypesPlaceholder}
      disabled={!entityType}
      hint={hint}
      error={error}
    />
  );
}
