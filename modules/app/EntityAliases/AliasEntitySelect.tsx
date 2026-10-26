'use client';
// The board toolbar's entity select (TB's aliases-entity-select): for each single-resolve alias that is not a single
// entity, the viewer picks the current entity, and every widget on that alias follows. The button shows the current
// entity's name when there is one alias to pick for, "Entities" otherwise; nothing is drawn when there is none.
// The host decides which aliases are selectable (E36-6) and loads the resolved set (`loadOptions`). Each alias is the
// filter bar's entity picker (`EntityParamPicker`, phase 41), the same search box an entity parameter shows there.

import { useCallback, useId, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCubes } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Popover } from '@/modules/ui/Popover';
import { mergeAliasMessages, type EntityAliasesMessages, type EntityAliasesMessagesInput } from './messages';
import { EntityParamPicker } from './EntityParamPicker';
import { useLatestRef } from './useAliasData';
import type { AliasEntitySelectItem, EntityRef } from './types';

export interface AliasEntitySelectProps {
  items: readonly AliasEntitySelectItem[];
  /** The entities the alias resolves to, filtered by `search` (the host pages them, e.g. 50 at a time). */
  loadOptions: (aliasKey: string, search: string) => Promise<EntityRef[]>;
  onChange: (aliasKey: string, entityId: string) => void;
  disabled?: boolean;
  messages?: EntityAliasesMessagesInput;
  className?: string;
}

function AliasEntityCombo({
  id,
  item,
  loadOptions,
  onChange,
  m,
}: {
  id: string;
  item: AliasEntitySelectItem;
  loadOptions: AliasEntitySelectProps['loadOptions'];
  onChange: AliasEntitySelectProps['onChange'];
  m: EntityAliasesMessages;
}) {
  const loadRef = useLatestRef(loadOptions);
  const onSearch = useCallback((q: string) => loadRef.current(item.aliasKey, q), [item.aliasKey, loadRef]);
  // The filter bar's entity picker (phase 41, D41-5): one control for both places a viewer picks an entity.
  return (
    <EntityParamPicker messages={m}
      id={id}
      label={item.aliasName}
      value={item.current?.id ?? ''}
      current={item.current}
      loadOptions={onSearch}
      onChange={(id) => { if (typeof id === 'string' && id) onChange(item.aliasKey, id); }}
      required
    />
  );
}

export function AliasEntitySelect({ items, loadOptions, onChange, disabled, messages, className }: AliasEntitySelectProps) {
  const m = useMemo(() => mergeAliasMessages(messages), [messages]);
  const idBase = useId();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const label = items.length === 1 ? items[0].current?.name ?? items[0].aliasName : m.entities;

  return (
    <div className={cn('inline-flex', className)}>
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => setOpen(disabled ? false : next)}
        trigger={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open && !disabled}
            title={m.selectEntities}
            iconLeft={<FontAwesomeIcon icon={faCubes} className="h-3.5 w-3.5" />}
          >
            <span className="max-w-[12rem] truncate">{label}</span>
          </Button>
        }
        className="w-80 p-3"
      >
        <div className="space-y-3" aria-label={m.selectEntities} role="group">
          {items.map((item) => (
            <AliasEntityCombo
              key={item.aliasKey}
              id={`${idBase}-${item.aliasKey}`}
              item={item}
              loadOptions={loadOptions}
              onChange={(aliasKey, id) => onChange(aliasKey, id)}
              m={m}
            />
          ))}
        </div>
      </Popover>
    </div>
  );
}
