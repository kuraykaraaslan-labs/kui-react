'use client';
// The entity filter form (TB's entity-filter): a filter type select and the fields of that type. Controlled: `value` is
// the filter (null before a type is picked) and every edit calls `onChange` with a whole new filter. Picking a type
// sets "resolve as multiple" the TB way (off for a single entity and the page's entity, on otherwise) through
// `onResolveMultipleChange`. The two relation types are offered only when the host has a relation provider.

import { useId, useMemo } from 'react';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { EntityListPicker, EntityPicker, EntityTypeSelect, SubtypesPicker } from './EntityPickers';
import { FormPanel, QueryOptions, RelationFiltersEditor, RelationTypeSelect, RootFields } from './RelationFields';
import { defaultResolveMultiple, emptyFilter, isRelationFilterType } from './filters';
import { mergeAliasMessages, type AliasErrorField, type EntityAliasesMessagesInput } from './messages';
import { useAliasCatalog } from './useAliasData';
import { ALIAS_FILTER_TYPES, NAME_PREFIX_MAX, type AliasErrors } from './validate';
import type { AliasFilterType, BoardParamInfo, EntityAliasFilter, EntityAliasesAccess } from './types';

export interface EntityFilterFormProps {
  value: EntityAliasFilter | null;
  onChange: (filter: EntityAliasFilter) => void;
  resolveMultiple: boolean;
  onResolveMultipleChange: (resolveMultiple: boolean) => void;
  params: readonly BoardParamInfo[];
  access: EntityAliasesAccess;
  /** Limits the entity type selects (TB `allowedEntityTypes`). */
  allowedEntityTypes?: readonly string[];
  /** Field errors from `validateAlias` (`filter.*`), shown under their fields. */
  errors?: AliasErrors;
  messages?: EntityAliasesMessagesInput;
  className?: string;
}

export function EntityFilterForm({
  value,
  onChange,
  resolveMultiple,
  onResolveMultipleChange,
  params,
  access,
  allowedEntityTypes,
  errors,
  messages,
  className,
}: EntityFilterFormProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const idBase = useId();
  const { entityTypes, providers } = useAliasCatalog(access);
  const err = (field: AliasErrorField) => {
    const code = errors?.[field];
    return code ? m.error(field, code) : undefined;
  };

  const types = ALIAS_FILTER_TYPES.filter((t) => !isRelationFilterType(t) || providers.length > 0 || value?.type === t);

  function changeType(type: AliasFilterType) {
    onChange(emptyFilter(type, value, { providers, params }));
    const rm = defaultResolveMultiple(type);
    if (rm !== resolveMultiple) onResolveMultipleChange(rm);
  }

  const typeSelect = (
    <Select
      id={`${idBase}-type`}
      label={m.filterType}
      options={types.map((t) => ({ value: t, label: m.filterTypes[t] }))}
      placeholder={m.filterTypePlaceholder}
      value={value?.type ?? ''}
      onChange={(e) => { if (e.target.value) changeType(e.target.value as AliasFilterType); }}
      error={err('filter.type')}
      required
    />
  );

  return (
    <div className={className}>
      <div className="space-y-4">
        {typeSelect}
        {value && renderFields()}
      </div>
    </div>
  );

  // A plain function called during render (not a nested component), so React never remounts the pickers below it.
  function renderFields(): React.ReactNode {
    if (!value) return null;
    const f = value;
    const set = (patch: Partial<EntityAliasFilter>) => onChange({ ...f, ...patch } as EntityAliasFilter);
    const typeInfo = (key: string) => entityTypes.find((t) => t.key === key);
    const entityTypeSelect = (entityType: string, extra: Partial<EntityAliasFilter>, subtypesOnly = false) => (
      <EntityTypeSelect
        id={`${idBase}-entity-type`}
        value={entityType}
        onChange={(t) => set({ entityType: t, ...extra } as Partial<EntityAliasFilter>)}
        entityTypes={entityTypes}
        allowedEntityTypes={allowedEntityTypes}
        subtypesOnly={subtypesOnly}
        error={err('filter.entityType')}
        m={m}
      />
    );
    const prefixInput = (prefix: string, optional: boolean) => (
      <Input
        id={`${idBase}-prefix`}
        label={m.namePrefix}
        value={prefix}
        onChange={(e) => set({ namePrefix: e.target.value } as Partial<EntityAliasFilter>)}
        maxLength={NAME_PREFIX_MAX}
        hint={optional ? m.namePrefixOptionalHint : m.namePrefixHint}
        error={err('filter.namePrefix')}
        required={!optional}
      />
    );
    const grid = 'grid grid-cols-1 gap-3 sm:grid-cols-2';

    switch (f.type) {
      case 'singleEntity':
        return (
          <div className={grid}>
            {entityTypeSelect(f.entityType, { id: '' })}
            <EntityPicker id={`${idBase}-entity`} access={access} entityType={f.entityType} value={f.id}
              onChange={(id) => set({ id })} error={err('filter.id')} m={m} />
          </div>
        );
      case 'entityList':
        return (
          <div className="space-y-3">
            {entityTypeSelect(f.entityType, { ids: [] })}
            <EntityListPicker id={`${idBase}-entities`} access={access} entityType={f.entityType} value={f.ids}
              onChange={(ids) => set({ ids })} error={err('filter.ids')} m={m} />
          </div>
        );
      case 'entityName':
        return <div className={grid}>{entityTypeSelect(f.entityType, {})}{prefixInput(f.namePrefix, false)}</div>;
      case 'entityType':
        return entityTypeSelect(f.entityType, {});
      case 'stateEntity': {
        const options = params
          .filter((p) => !p.entityType || !f.entityType || p.entityType === f.entityType || p.key === f.param)
          .map((p) => ({ value: p.key, label: p.label }));
        return (
          <div className={grid}>
            {entityTypeSelect(f.entityType, {})}
            <Select id={`${idBase}-param`} label={m.param} options={options} placeholder={m.paramPlaceholder}
              value={f.param}
              onChange={(e) => {
                const p = params.find((x) => x.key === e.target.value);
                set({ param: e.target.value, ...(p?.entityType && !f.entityType ? { entityType: p.entityType } : {}) });
              }}
              hint={params.length === 0 ? m.noParams : m.paramHint} error={err('filter.param')} required />
          </div>
        );
      }
      case 'entitySubtype':
        return (
          <div className="space-y-3">
            {entityTypeSelect(f.entityType, { subtypes: [] }, true)}
            <SubtypesPicker id={`${idBase}-subtypes`} label={typeInfo(f.entityType)?.subtypeLabel ?? m.subtypes}
              access={access} entityType={f.entityType} value={f.subtypes} onChange={(subtypes) => set({ subtypes })}
              error={err('filter.subtypes')} m={m} />
            {prefixInput(f.namePrefix ?? '', true)}
          </div>
        );
      case 'relationsQuery':
      case 'entitySearchQuery': {
        const provider = providers.find((p) => p.key === f.provider);
        const showProvider = providers.length > 1 || !provider;
        return (
          <div className="space-y-4">
            {showProvider && (
              <Select id={`${idBase}-provider`} label={m.provider}
                options={providers.map((p) => ({ value: p.key, label: p.label }))}
                placeholder={m.providerPlaceholder} value={f.provider}
                onChange={(e) => set({ provider: e.target.value })} error={err('filter.provider')} required />
            )}
            <RootFields idBase={idBase} root={f.root} onChange={(root) => set({ root })} params={params}
              entityTypes={entityTypes} allowedEntityTypes={allowedEntityTypes} access={access}
              error={err('filter.root')} m={m} />
            <QueryOptions idBase={idBase} direction={f.direction} maxLevel={f.maxLevel} lastLevelOnly={!!f.lastLevelOnly}
              onChange={(patch) => set(patch)} error={err('filter.maxLevel')} m={m} />
            {f.type === 'relationsQuery' ? (
              <RelationFiltersEditor idBase={idBase} filters={f.filters ?? []} onChange={(filters) => set({ filters })}
                provider={provider} entityTypes={entityTypes} allowedEntityTypes={allowedEntityTypes}
                error={err('filter.filters')} m={m} />
            ) : (
              <FormPanel title={m.relationFilter}>
                <RelationTypeSelect id={`${idBase}-relation-type`} provider={provider} value={f.relationType}
                  onChange={(relationType) => set({ relationType })} m={m} />
                {entityTypeSelect(f.entityType, { subtypes: [] })}
                {typeInfo(f.entityType)?.hasSubtypes && (
                  <SubtypesPicker id={`${idBase}-subtypes`} label={typeInfo(f.entityType)?.subtypeLabel ?? m.subtypes}
                    access={access} entityType={f.entityType} value={f.subtypes ?? []}
                    onChange={(subtypes) => set({ subtypes })} hint={m.subtypesOptionalHint}
                    error={err('filter.subtypes')} m={m} />
                )}
              </FormPanel>
            )}
          </div>
        );
      }
    }
  }
}
