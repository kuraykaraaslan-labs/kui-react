'use client';
// The two parts of a rule's form the diagram editor's rules and the Scene drawer's Rules step share: the form of one condition (what
// it reads, the operator, the value) and the colour control of an effect. Kept apart from `SceneRulesEditor` so the drawer does not
// carry the diagram editor (the symbol library) along.
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FieldControl } from '../../SchemaForm/fields/FieldControl';
import { DEFAULT_RULES_MESSAGES, type RulesMessages } from './scene-editor-messages-panels';
import type { EditorCtx } from './scene-editor-types';
import { THINGS_TARGET } from './scene-rules-logic';
import { CONTROL, PanelField } from './scene-panel-ui';

type Rec = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

const NEEDS_VALUE = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in']);
const NUMERIC = new Set(['gt', 'gte', 'lt', 'lte', 'between']);
const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'set', 'unset', 'true', 'false'] as const;

/** A colour effect's field (the kit's colour control). Shared with the Scene drawer's Rules step. */
export function ColorField({ id, title, value, onChange, error }: { id: string; title: string; value: string; onChange: (v: string | undefined) => void; error?: string }) {
  return (
    <PanelField id={id} label={title} error={error}>
      <FieldControl id={id} field={{ label: title, type: 'color' }} value={value || undefined} onChange={(v) => onChange(typeof v === 'string' ? v : undefined)} invalid={!!error} />
    </PanelField>
  );
}

export type Choices = (current: string, extra: Array<{ value: string; label: string }>) => Array<{ value: string; label: string }>;

/** What a condition's form reads of the editor around it: its texts, an id prefix, the columns and parameters it suggests, the issue of a field. */
export interface ConditionEnv {
  m: ConditionMessages;
  base: string;
  columns: Array<{ key: string; label?: string }>;
  params: NonNullable<EditorCtx['host']['params']>;
  issue: (index: number, field: string) => string | undefined;
  /**
   * The values a symbol draws (its fields, with the names the person knows them by), by the symbol's id; undefined when the host does not know them:
   * "Which value" then offers `columns` (next-boilerplate e2e round 5, E14).
   */
  valuesOf?: (symbolId: string) => ReadonlyArray<{ key: string; label?: string }> | undefined;
}
/** The texts of a condition's form (a part of `RulesMessages`). */
export type ConditionMessages = Pick<
  RulesMessages,
  'read' | 'column' | 'parameter' | 'columnLabel' | 'parameterLabel' | 'ofRow' | 'ownRow' | 'operator' | 'alwaysOption' | 'opLabels' | 'list' | 'value' | 'upTo'
  | 'otherValue' | 'otherValueLabel' | 'valueNames'
>;

/** The choice that opens the box for any other name. */
const OTHER = '\u0000other';

/**
 * One condition of a rule (the first, or with `n` = '2' the second): what it reads (a value of a symbol, or a board parameter), the
 * operator and the value. Shared by the diagram editor's rules and the Scene drawer's Rules step (`SceneSetupRules`). "Which value" is a
 * choice of the values the symbol it reads draws (`env.valuesOf` of the "Of symbol" choice, else of the rule's target), each by its name
 * ("Reading", never `value`); the last choice opens a box for any other name, for a column of a data row (next-boilerplate e2e round 5, E14:
 * a free text box with a non-empty check, so a typed "Opening" never matched the door's `position`).
 */
export function Condition({
  env, index, rule, n, set, choices, rowOptions,
}: { env: ConditionEnv; index: number; rule: Rec; n: '' | '2'; set: (patch: Rec, group?: string) => void; choices: Choices; rowOptions: Array<{ value: string; label: string }> }) {
  const { m, base } = env;
  const k = (name: string) => `${name}${n}`;
  const id = (name: string) => `${base}-${index}-${k(name)}`;
  const param = rule[k('source')] === 'param';
  const op = str(rule[k('op')]);
  const key = str(rule[k('key')]);
  const suggestions = param ? env.params.map((p) => ({ key: p.key, label: p.label })) : env.columns;
  const values = param ? env.params.find((p) => p.key === key)?.values ?? [] : [];
  const err = (name: string) => env.issue(index, k(name));
  const typing = (name: string, value: string) => set({ [k(name)]: value }, `rule:${index}:${k(name)}`);
  // the values of the symbol the condition reads: the "Of symbol" one, else the rule's own target (none for * and things: every value then)
  const readOf = str(rule[k('of')]) || str(rule.target);
  const own = !param && readOf && readOf !== '*' && readOf !== THINGS_TARGET ? env.valuesOf?.(readOf) : undefined;
  const names = m.valueNames ?? DEFAULT_RULES_MESSAGES.valueNames ?? {};
  const choicesOfValue = (own ?? env.columns).map((c) => ({ value: c.key, label: c.label && c.label !== c.key ? c.label : names[c.key] ?? c.key }));
  const [otherOpen, setOtherOpen] = useState(false);
  // with no value known at all (no symbol values, no columns) the name is typed, as before
  const choosing = !param && choicesOfValue.length > 0;
  const freeText = choosing && (otherOpen || (key !== '' && !choicesOfValue.some((c) => c.value === key)));

  return (
    <div className="space-y-2" data-condition={n || '1'}>
      <PanelField id={id('source')} label={m.read} error={err('source')}>
        <select id={id('source')} className={CONTROL} value={param ? 'param' : 'column'} onChange={(e) => set({ [k('source')]: e.target.value })}>
          <option value="column">{m.column}</option>
          <option value="param">{m.parameter}</option>
        </select>
      </PanelField>
      {!choosing ? (
        <PanelField id={id('key')} label={param ? m.parameterLabel : m.columnLabel} error={err('key')}>
          <input
            id={id('key')} type="text" list={`${id('key')}-list`} className={CONTROL} value={key} maxLength={64} autoComplete="off" spellCheck={false}
            aria-invalid={!!err('key') || undefined} onChange={(e) => typing('key', e.target.value)}
          />
          <datalist id={`${id('key')}-list`}>
            {suggestions.map((c) => <option key={c.key} value={c.key}>{c.label && c.label !== c.key ? c.label : undefined}</option>)}
          </datalist>
        </PanelField>
      ) : (
        <>
          <PanelField id={id('key')} label={m.columnLabel} error={freeText ? undefined : err('key')}>
            <select
              id={id('key')} className={CONTROL} value={freeText ? OTHER : key} aria-invalid={(!freeText && !!err('key')) || undefined}
              onChange={(e) => {
                if (e.target.value === OTHER) { setOtherOpen(true); return; }
                setOtherOpen(false);
                set({ [k('key')]: e.target.value });
              }}
            >
              {!key && !freeText && <option value="" disabled>-</option>}
              {choicesOfValue.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value={OTHER}>{m.otherValue ?? DEFAULT_RULES_MESSAGES.otherValue}</option>
            </select>
          </PanelField>
          {freeText && (
            <PanelField id={id('keyText')} label={m.otherValueLabel ?? DEFAULT_RULES_MESSAGES.otherValueLabel ?? ''} error={err('key')}>
              <input
                id={id('keyText')} type="text" list={`${id('keyText')}-list`} className={CONTROL} value={key} maxLength={64} autoComplete="off" spellCheck={false}
                aria-invalid={!!err('key') || undefined} onChange={(e) => typing('key', e.target.value)}
              />
              <datalist id={`${id('keyText')}-list`}>
                {suggestions.map((c) => <option key={c.key} value={c.key}>{c.label && c.label !== c.key ? c.label : undefined}</option>)}
              </datalist>
            </PanelField>
          )}
        </>
      )}
      {!param && (
        <PanelField id={id('of')} label={m.ofRow} error={err('of')}>
          <select id={id('of')} className={CONTROL} value={str(rule[k('of')])} onChange={(e) => set({ [k('of')]: e.target.value })}>
            {choices(str(rule[k('of')]), [{ value: '', label: m.ownRow }, ...rowOptions]).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </PanelField>
      )}
      <PanelField id={id('op')} label={m.operator} error={err('op')}>
        <select id={id('op')} className={CONTROL} value={op} onChange={(e) => set({ [k('op')]: e.target.value })}>
          {!n && <option value="">{m.alwaysOption}</option>}
          {OPS.map((o) => <option key={o} value={o}>{m.opLabels[o]}</option>)}
        </select>
      </PanelField>
      {NEEDS_VALUE.has(op) && (
        <div className={cn('grid gap-2', op === 'between' ? 'grid-cols-2' : 'grid-cols-1')}>
          <PanelField id={id('value')} label={op === 'in' ? m.list : m.value} error={err('value')}>
            <input
              id={id('value')} type="text" inputMode={NUMERIC.has(op) ? 'decimal' : undefined} className={CONTROL} value={str(rule[k('value')])} maxLength={80}
              list={values.length ? `${id('value')}-list` : undefined} aria-invalid={!!err('value') || undefined} autoComplete="off"
              onChange={(e) => typing('value', e.target.value)}
            />
            {values.length > 0 && <datalist id={`${id('value')}-list`}>{values.map((v) => <option key={v} value={v} />)}</datalist>}
          </PanelField>
          {op === 'between' && (
            <PanelField id={id('to')} label={m.upTo} error={err('to')}>
              <input id={id('to')} type="text" inputMode="decimal" className={CONTROL} value={str(rule[k('to')])} maxLength={40} aria-invalid={!!err('to') || undefined}
                autoComplete="off" onChange={(e) => typing('to', e.target.value)} />
            </PanelField>
          )}
        </div>
      )}
    </div>
  );
}
