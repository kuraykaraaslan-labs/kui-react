'use client';
// The relation parts of the filter form (TB's relations query and entity search query panels): the root entity (the
// page's entity through a board param, or a fixed entity), the query options (direction, max level, last level only)
// and the relation filters list (relation type, entity types, NOT).

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Input } from '@/modules/ui/Input';
import { MultiSelect } from '@/modules/ui/MultiSelect';
import { Select } from '@/modules/ui/Select';
import { Toggle } from '@/modules/ui/Toggle';
import { EntityPicker, EntityTypeSelect } from './EntityPickers';
import { MAX_RELATION_FILTERS, MAX_RELATION_LEVEL } from './validate';
import type { EntityAliasesMessages } from './messages';
import type {
  AliasRoot,
  BoardParamInfo,
  EntityAliasesAccess,
  EntityTypeInfo,
  RelationDirection,
  RelationFilter,
  RelationProviderInfo,
} from './types';

export function FormPanel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn('space-y-3 rounded-lg border border-border p-4', className)}>
      <legend className="px-1 text-sm font-semibold text-text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

export function RootFields({
  idBase,
  root,
  onChange,
  params,
  entityTypes,
  allowedEntityTypes,
  access,
  error,
  m,
}: {
  idBase: string;
  root: AliasRoot;
  onChange: (root: AliasRoot) => void;
  params: readonly BoardParamInfo[];
  entityTypes: readonly EntityTypeInfo[];
  allowedEntityTypes?: readonly string[];
  access: EntityAliasesAccess;
  error?: string;
  m: EntityAliasesMessages;
}) {
  const fromPage = 'param' in root;
  const noParams = params.length === 0;
  return (
    <FormPanel title={m.rootTitle}>
      <Toggle
        id={`${idBase}-root-page`}
        label={m.rootFromPage}
        checked={fromPage}
        disabled={!fromPage && noParams}
        description={!fromPage && noParams ? m.noParams : undefined}
        onChange={(on) => onChange(on ? { param: params[0]?.key ?? '' } : { entity: { type: '', id: '' } })}
      />
      {'param' in root ? (
        <Select messages={m.select}
          id={`${idBase}-root-param`}
          label={m.param}
          options={params.map((p) => ({ value: p.key, label: p.label }))}
          placeholder={m.paramPlaceholder}
          value={root.param}
          onChange={(e) => onChange({ param: e.target.value })}
          hint={m.paramHint}
          error={error}
          required
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <EntityTypeSelect
            id={`${idBase}-root-type`}
            value={root.entity.type}
            onChange={(type) => onChange({ entity: { type, id: '' } })}
            entityTypes={entityTypes}
            allowedEntityTypes={allowedEntityTypes}
            m={m}
          />
          <EntityPicker
            id={`${idBase}-root-entity`}
            access={access}
            entityType={root.entity.type}
            value={root.entity.id}
            onChange={(id) => onChange({ entity: { type: root.entity.type, id } })}
            error={error}
            m={m}
          />
        </div>
      )}
    </FormPanel>
  );
}

export function QueryOptions({
  idBase,
  direction,
  maxLevel,
  lastLevelOnly,
  onChange,
  error,
  m,
}: {
  idBase: string;
  direction: RelationDirection;
  maxLevel: number;
  lastLevelOnly: boolean;
  onChange: (patch: { direction?: RelationDirection; maxLevel?: number; lastLevelOnly?: boolean }) => void;
  error?: string;
  m: EntityAliasesMessages;
}) {
  return (
    <FormPanel title={m.queryOptions}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select messages={m.select}
          id={`${idBase}-direction`}
          label={m.direction}
          options={(['from', 'to'] as const).map((d) => ({ value: d, label: m.directionOptions[d] }))}
          value={direction}
          onChange={(e) => onChange({ direction: e.target.value === 'to' ? 'to' : 'from' })}
          required
        />
        <Input
          id={`${idBase}-max-level`}
          label={m.maxLevel}
          type="number"
          min={1}
          max={MAX_RELATION_LEVEL}
          step={1}
          value={Number.isFinite(maxLevel) ? String(maxLevel) : ''}
          onChange={(e) => onChange({ maxLevel: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
          hint={m.maxLevelHint(MAX_RELATION_LEVEL)}
          error={error}
          required
        />
      </div>
      {maxLevel > 1 && (
        <Toggle
          id={`${idBase}-last-level`}
          label={m.lastLevelOnly}
          checked={lastLevelOnly}
          onChange={(on) => onChange({ lastLevelOnly: on })}
        />
      )}
    </FormPanel>
  );
}

export function RelationTypeSelect({
  id,
  provider,
  value,
  onChange,
  m,
}: {
  id: string;
  provider: RelationProviderInfo | undefined;
  value: string | undefined;
  onChange: (relationType: string | undefined) => void;
  m: EntityAliasesMessages;
}) {
  const options = provider?.relationTypes ?? [];
  const withCurrent = value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options;
  return (
    <Select messages={m.select}
      id={id}
      label={m.relationType}
      options={withCurrent}
      placeholder={m.anyRelationType}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  );
}

export function RelationFiltersEditor({
  idBase,
  filters,
  onChange,
  provider,
  entityTypes,
  allowedEntityTypes,
  error,
  m,
}: {
  idBase: string;
  filters: readonly RelationFilter[];
  onChange: (filters: RelationFilter[]) => void;
  provider: RelationProviderInfo | undefined;
  entityTypes: readonly EntityTypeInfo[];
  allowedEntityTypes?: readonly string[];
  error?: string;
  m: EntityAliasesMessages;
}) {
  const typeOptions = entityTypes
    .filter((t) => !allowedEntityTypes?.length || allowedEntityTypes.includes(t.key))
    .map((t) => ({ value: t.key, label: t.labelPlural }));
  const patch = (i: number, next: RelationFilter) => onChange(filters.map((f, j) => (j === i ? next : f)));
  return (
    <FormPanel title={m.relationFilters}>
      {filters.length === 0 ? (
        <p className="text-sm text-text-secondary">{m.noRelationFilters}</p>
      ) : (
        <ol className="space-y-3">
          {filters.map((f, i) => (
            <li key={i} className="grid grid-cols-1 items-start gap-3 rounded-md border border-border bg-surface-base p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <RelationTypeSelect
                id={`${idBase}-rf${i}-type`}
                provider={provider}
                value={f.relationType}
                onChange={(relationType) => patch(i, { ...f, relationType })}
                m={m}
              />
              <MultiSelect messages={m.multiSelect}
                id={`${idBase}-rf${i}-entities`}
                label={m.relationEntityTypes}
                options={typeOptions}
                value={f.entityTypes ?? []}
                onChange={(entityTypes) => patch(i, { ...f, entityTypes })}
                placeholder={m.anyEntityType}
              />
              <Checkbox
                id={`${idBase}-rf${i}-negate`}
                label={m.negate}
                hint={m.negateHint}
                checked={!!f.negate}
                onChange={(e) => patch(i, { ...f, negate: e.target.checked })}
                className="sm:mt-7"
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={m.removeRelationFilter(i + 1)}
                onClick={() => onChange(filters.filter((_, j) => j !== i))}
                className="sm:mt-6"
              >
                <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-xs text-error" role="alert">{error}</p>}
      <Button
        variant="outline"
        size="sm"
        iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" />}
        disabled={filters.length >= MAX_RELATION_FILTERS}
        onClick={() => onChange([...filters, {}])}
      >
        {m.addRelationFilter}
      </Button>
    </FormPanel>
  );
}
