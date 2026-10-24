'use client';
// A widget's data tab binds an entity slot to an alias (E36-4): pick one of the board's aliases, "None", or create a
// new one. Aliases that do not fit the slot are listed but disabled, with the reason: a wrong entity type, or "resolves
// to many" for a slot that takes one entity. A relations query's type is only known after resolving, so it is allowed.
// Once an alias is chosen and the board has filters, a second select picks one of them (E36-10:
// `{ "$alias": "<key>", "filter": "<filterKey>" }`) or none.

import { useId, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { ComboBox, type ComboBoxOption } from '@/modules/ui/ComboBox';
import { Select } from '@/modules/ui/Select';
import { boardFilterText } from './board-filter-text';
import { entityFilterText } from './filter-text';
import { aliasCompatibility } from './filters';
import { mergeAliasMessages, type EntityAliasesMessages, type EntityAliasesMessagesInput } from './messages';
import type { AliasSlot, BoardFilter, BoardParamInfo, EntityAlias, EntityTypeInfo } from './types';

export interface EntityAliasPickerProps {
  value?: string;
  onChange: (aliasKey: string | undefined) => void;
  aliases: readonly EntityAlias[];
  slot: AliasSlot;
  entityTypes: readonly EntityTypeInfo[];
  /** For the filter text of state-entity and param-rooted aliases. */
  params?: readonly BoardParamInfo[];
  /** Shows "New alias"; the host opens the alias dialog and then sets `value` to the new key. */
  onCreate?: () => void;
  label?: string;
  hint?: string;
  error?: string;
  messages?: EntityAliasesMessagesInput;
  className?: string;
  /** The board's key filters; with an alias chosen, a second select picks one of them (or none). */
  filters?: readonly BoardFilter[];
  /** The chosen filter's key. */
  filterValue?: string;
  onFilterChange?: (filterKey: string | undefined) => void;
  /** The filter select's label (`messages.pickerFilterLabel` by default). */
  filterLabel?: string;
}

/** The picker's options: "None" first, then every alias, the ones that do not fit the slot disabled with the reason. */
export function aliasPickerOptions(
  aliases: readonly EntityAlias[],
  slot: AliasSlot,
  entityTypes: readonly EntityTypeInfo[],
  params: readonly BoardParamInfo[],
  m: EntityAliasesMessages,
): ComboBoxOption[] {
  const plural = (key: string) => entityTypes.find((t) => t.key === key)?.labelPlural ?? key;
  return [
    { value: '', label: m.none },
    ...aliases.map((alias): ComboBoxOption => {
      const fit = aliasCompatibility(alias, slot);
      if (fit.ok) {
        return { value: alias.key, label: alias.name, description: entityFilterText(alias.filter, { entityTypes, params, messages: m }) };
      }
      const reason =
        fit.reason === 'multiple'
          ? m.incompatibleMultiple
          : m.incompatibleType(plural(fit.entityType), slot.entityTypes.map(plural).join(', '));
      return { value: alias.key, label: alias.name, description: reason, disabled: true };
    }),
  ];
}

export function EntityAliasPicker({
  value,
  onChange,
  aliases,
  slot,
  entityTypes,
  params = [],
  onCreate,
  label,
  hint,
  error,
  messages,
  className,
  filters,
  filterValue,
  onFilterChange,
  filterLabel,
}: EntityAliasPickerProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const id = useId();
  const options = aliasPickerOptions(aliases, slot, entityTypes, params, m);
  const showFilter = !!value && !!filters && (filters.length > 0 || !!filterValue);
  const filterOptions = (filters ?? []).map((f) => ({ value: f.key, label: f.name }));
  // A stored filter the board no longer has stays visible by its key, so it can be cleared.
  if (filterValue && !filterOptions.some((o) => o.value === filterValue)) filterOptions.push({ value: filterValue, label: filterValue });
  const chosenFilter = filters?.find((f) => f.key === filterValue);
  return (
    <div className={cn('space-y-2', className)}>
      <ComboBox messages={m.comboBox}
        id={id}
        label={label ?? m.pickerLabel}
        options={options}
        value={value ?? ''}
        onChange={(key) => {
          onChange(key || undefined);
          // No alias, no filter.
          if (!key && filterValue) onFilterChange?.(undefined);
        }}
        placeholder={m.pickerPlaceholder}
        clearable={false}
        hint={hint}
        error={error}
      />
      {showFilter && (
        <Select messages={m.select}
          id={`${id}-filter`}
          label={filterLabel ?? m.pickerFilterLabel}
          options={[{ value: '', label: m.none }, ...filterOptions]}
          value={filterValue ?? ''}
          onChange={(e) => onFilterChange?.(e.target.value || undefined)}
          hint={chosenFilter ? boardFilterText(chosenFilter, { params, messages: m }) : undefined}
        />
      )}
      {onCreate && (
        <Button variant="ghost" size="sm" iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" />} onClick={onCreate}>
          {m.newAlias}
        </Button>
      )}
    </div>
  );
}
