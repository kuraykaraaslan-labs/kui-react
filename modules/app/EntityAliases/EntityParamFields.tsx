'use client';
// The fields of one entity parameter (next-boilerplate dashboard phase 41): the entity type, how the entity is chosen and
// the fields of that choice, one or many, the filter-bar mode, "with no value, take the first" and the default entity,
// searched by name. No path, search key or value key: the host's access lists and searches the entities. The relation
// details (direction, depth, relation type, last level only, relation filters) show only with `advanced`; the host owns
// that disclosure, with the parameter's key beside them. Controlled: every edit calls `onChange` with a whole parameter.
// The label and the key are the host's: they belong to every kind of parameter.

import { useId, useMemo } from 'react';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Toggle } from '@/modules/ui/Toggle';
import { EntityListPicker, EntityPicker, EntityTypeSelect, SubtypesPicker } from './EntityPickers';
import { FormPanel, QueryOptions, RelationFiltersEditor, RelationTypeSelect } from './RelationFields';
import {
  ENTITY_CHOICE_TYPES,
  barModesFor,
  choiceTakesMany,
  fitChoice,
  isMixedRelated,
  peerFits,
  takesDefault,
  takesFirst,
  withChoice,
  withEntityType,
  type EntityParamErrors,
} from './entity-params';
import { mergeAliasMessages, type EntityAliasesMessagesInput, type EntityParamErrorField } from './messages';
import { useAliasCatalog } from './useAliasData';
import { NAME_PREFIX_MAX } from './validate';
import type { EntityAliasesAccess, EntityChoice, EntityChoiceType, EntityParam, ParamBarMode, ParamPeer } from './types';

export interface EntityParamFieldsProps {
  value: EntityParam;
  onChange: (param: EntityParam) => void;
  /** The board's other parameters (values and entities): what a page choice may follow and a relation may start from. */
  params: readonly ParamPeer[];
  access: EntityAliasesAccess;
  /** Show the relation details. The host owns the "Advanced" disclosure (the parameter's key sits there too). */
  advanced?: boolean;
  /** Field errors from `validateEntityParam`, shown under their fields. */
  errors?: EntityParamErrors;
  messages?: EntityAliasesMessagesInput;
  className?: string;
}

/** The value of the "Related to" select that stands for a fixed root entity (a parameter key never has a colon). */
const FIXED_ROOT = ':entity';

export function EntityParamFields({ value, onChange, params, access, advanced = false, errors, messages, className }: EntityParamFieldsProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const idBase = useId();
  const { entityTypes, providers } = useAliasCatalog(access);
  const err = (field: EntityParamErrorField) => {
    const code = errors?.[field];
    return code ? m.paramError(field, code) : undefined;
  };
  const p = value;
  const c = p.choose;
  const others = params.filter((x) => x.key !== p.key);
  const typeInfo = (key: string | undefined) => entityTypes.find((t) => t.key === key);
  const mixed = isMixedRelated(c);
  const set = (next: EntityParam) => onChange(next);
  const setChoice = (patch: Partial<EntityChoice>) => set(fitChoice({ ...p, choose: { ...c, ...patch } as EntityChoice }));

  // A subtype choice needs a type with subtypes, a relation a relation source; a stored choice always stays offered.
  const choices = ENTITY_CHOICE_TYPES.filter((t) => {
    if (t === c.type) return true;
    if (t === 'subtype') return !p.entityType || !!typeInfo(p.entityType)?.hasSubtypes;
    if (t === 'related') return providers.length > 0;
    return true;
  });
  const modes = barModesFor(p);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mixed ? (
            <p className="text-xs text-text-secondary sm:col-span-1 sm:self-end">{m.mixedTypesHint}</p>
          ) : (
            <EntityTypeSelect
              id={`${idBase}-entity-type`}
              value={p.entityType ?? ''}
              onChange={(t) => set(withEntityType(p, t))}
              entityTypes={entityTypes}
              error={err('entityType')}
              m={m}
            />
          )}
          <Select messages={m.select}
            id={`${idBase}-choice`}
            label={m.chooseHow}
            options={choices.map((t) => ({ value: t, label: m.choiceTypes[t] }))}
            value={c.type}
            onChange={(e) => set(withChoice(p, e.target.value as EntityChoiceType, { providers, params: others }))}
            hint={m.choiceHints[c.type]}
            error={err('choose.type')}
            required
          />
        </div>
        {renderChoice()}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {choiceTakesMany(c) && (
            <Select messages={m.select}
              id={`${idBase}-many`}
              label={m.howMany}
              options={[{ value: 'one', label: m.howManyOptions.one }, { value: 'many', label: m.howManyOptions.many }]}
              value={p.multiple ? 'many' : 'one'}
              onChange={(e) => set(fitChoice({ ...p, multiple: e.target.value === 'many' }))}
              error={err('multiple')}
            />
          )}
          {modes.length > 0 && (
            <Select messages={m.select}
              id={`${idBase}-bar`}
              label={m.barMode}
              options={modes.map((mode) => ({ value: mode, label: m.barModes[mode] }))}
              value={p.viewer ?? 'edit'}
              onChange={(e) => set({ ...p, viewer: e.target.value as ParamBarMode })}
            />
          )}
        </div>
        {takesDefault(p) && (
          <EntityPicker
            id={`${idBase}-default`}
            label={m.defaultEntity}
            access={access}
            entityType={p.entityType ?? ''}
            value={p.default ?? ''}
            onChange={(id) => {
              const next = { ...p };
              if (id) next.default = id; else delete next.default;
              set(next);
            }}
            hint={m.defaultEntityHint}
            error={err('default')}
            required={false}
            clearable
            m={m}
          />
        )}
        {takesFirst(p) && (
          <Checkbox
            id={`${idBase}-first`}
            label={m.takeFirst}
            hint={m.takeFirstHint}
            checked={p.defaultFrom === 'firstOption'}
            onChange={(e) => {
              const next = { ...p };
              if (e.target.checked) next.defaultFrom = 'firstOption'; else delete next.defaultFrom;
              set(next);
            }}
          />
        )}
      </div>
    </div>
  );

  // A plain function called during render (not a nested component), so React never remounts the pickers below it.
  function renderChoice(): React.ReactNode {
    const entityType = p.entityType ?? '';
    switch (c.type) {
      case 'single':
        return (
          <EntityPicker id={`${idBase}-entity`} label={m.fixedEntity} access={access} entityType={entityType} value={c.id}
            onChange={(id) => setChoice({ id })} error={err('choose.id')} m={m} />
        );
      case 'list':
        return (
          <EntityListPicker id={`${idBase}-entities`} access={access} entityType={entityType} value={c.ids}
            onChange={(ids) => setChoice({ ids })} error={err('choose.ids')} m={m} />
        );
      case 'name':
        return (
          <Input id={`${idBase}-prefix`} label={m.namePrefix} value={c.namePrefix} maxLength={NAME_PREFIX_MAX}
            onChange={(e) => setChoice({ namePrefix: e.target.value })} hint={m.namePrefixHint} error={err('choose.namePrefix')} required />
        );
      case 'subtype':
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SubtypesPicker id={`${idBase}-subtypes`} label={typeInfo(entityType)?.subtypeLabel ?? m.subtypes} access={access}
              entityType={entityType} value={c.subtypes} onChange={(subtypes) => setChoice({ subtypes })} error={err('choose.subtypes')} m={m} />
            <Input id={`${idBase}-prefix`} label={m.namePrefix} value={c.namePrefix ?? ''} maxLength={NAME_PREFIX_MAX}
              onChange={(e) => setChoice({ namePrefix: e.target.value })} hint={m.namePrefixOptionalHint} error={err('choose.namePrefix')} />
          </div>
        );
      case 'page': {
        const options = others.filter((x) => peerFits(x, 'page') && (!x.entityType || !p.entityType || x.entityType === p.entityType || x.key === c.param));
        return (
          <Select messages={m.select}
            id={`${idBase}-follow`}
            label={m.followParam}
            options={[{ value: '', label: m.followLink }, ...options.map((x) => ({ value: x.key, label: x.label || x.key }))]}
            value={c.param ?? ''}
            onChange={(e) => set(fitChoice({ ...p, choose: e.target.value ? { type: 'page', param: e.target.value } : { type: 'page' } }))}
            error={err('choose.param')}
          />
        );
      }
      case 'related':
        return renderRelated(c);
      default:
        return null;
    }
  }

  function renderRelated(r: Extract<EntityChoice, { type: 'related' }>): React.ReactNode {
    const provider = providers.find((x) => x.key === r.provider);
    const roots = others.filter((x) => peerFits(x, 'root'));
    const rootValue = 'param' in r.root ? r.root.param : FIXED_ROOT;
    const setRelated = (patch: Partial<typeof r>) => setChoice(patch);
    return (
      <div className="space-y-3">
        {(providers.length > 1 || !provider) && (
          <Select messages={m.select} id={`${idBase}-provider`} label={m.provider}
            options={providers.map((x) => ({ value: x.key, label: x.label }))}
            placeholder={m.providerPlaceholder} value={r.provider}
            onChange={(e) => setRelated({ provider: e.target.value })} error={err('choose.provider')} required />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select messages={m.select}
            id={`${idBase}-root`}
            label={m.relatedTo}
            options={[...roots.map((x) => ({ value: x.key, label: x.label || x.key })), { value: FIXED_ROOT, label: m.relatedToEntity }]}
            value={rootValue}
            onChange={(e) => setRelated({
              root: e.target.value === FIXED_ROOT ? { entity: { type: p.entityType ?? '', id: '' } } : { param: e.target.value },
            })}
            error={'param' in r.root ? err('choose.root') : undefined}
            required
          />
          {'entity' in r.root && (
            <EntityTypeSelect id={`${idBase}-root-type`} value={r.root.entity.type}
              onChange={(type) => setRelated({ root: { entity: { type, id: '' } } })} entityTypes={entityTypes} m={m} />
          )}
        </div>
        {'entity' in r.root && (
          <EntityPicker id={`${idBase}-root-entity`} access={access} entityType={r.root.entity.type} value={r.root.entity.id}
            onChange={(id) => setRelated({ root: { entity: { type: (r.root as { entity: { type: string } }).entity.type, id } } })}
            error={err('choose.root')} m={m} />
        )}
        {!advanced && (err('choose.maxLevel') || err('choose.filters')) && (
          // A relation detail that is wrong is said here too, so it is never hidden behind the closed "Advanced".
          <p className="text-xs text-error" role="alert">{err('choose.maxLevel') ?? err('choose.filters')}</p>
        )}
        {advanced && (
          <FormPanel title={m.relationDetails}>
            <QueryOptions idBase={idBase} direction={r.direction} maxLevel={r.maxLevel} lastLevelOnly={!!r.lastLevelOnly}
              onChange={(patch) => setRelated(patch)} error={err('choose.maxLevel')} m={m} />
            <Toggle
              id={`${idBase}-mixed`}
              label={m.matchRelationFilters}
              checked={isMixedRelated(r)}
              onChange={(on) => {
                const walk = {
                  type: 'related' as const, provider: r.provider, root: r.root, direction: r.direction, maxLevel: r.maxLevel,
                  ...(r.lastLevelOnly ? { lastLevelOnly: true } : {}),
                };
                const next: EntityParam = { ...p, choose: on ? { ...walk, filters: [] } : walk };
                if (on) delete next.entityType;
                set(fitChoice(next));
              }}
            />
            {isMixedRelated(r) ? (
              <RelationFiltersEditor idBase={idBase} filters={r.filters} onChange={(filters) => setRelated({ filters })}
                provider={provider} entityTypes={entityTypes} error={err('choose.filters')} m={m} />
            ) : (
              <>
                <RelationTypeSelect id={`${idBase}-relation-type`} provider={provider} value={r.relationType}
                  onChange={(relationType) => setRelated({ relationType })} m={m} />
                {typeInfo(p.entityType)?.hasSubtypes && (
                  <SubtypesPicker id={`${idBase}-related-subtypes`} label={typeInfo(p.entityType)?.subtypeLabel ?? m.subtypes}
                    access={access} entityType={p.entityType ?? ''} value={r.subtypes ?? []}
                    onChange={(subtypes) => setRelated({ subtypes })} hint={m.subtypesOptionalHint} error={err('choose.subtypes')} m={m} />
                )}
              </>
            )}
          </FormPanel>
        )}
      </div>
    );
  }
}
