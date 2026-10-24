'use client';
// The what-if panel: override a symbol's readings (value, second value, capacity, running, status) and the board's
// parameters to preview every rule, without touching the data or the saved diagram. The values go to `onChange` as a
// `WhatIfState` the shell lays over the drawn model; nothing is stored. It lists the rules that hold with these values,
// the ids the things table brings (the Data list of the things layer) and sample things to preview them.
import { useId, useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { SCADA_SYMBOL_DEFS, SCADA_SYMBOLS, isScadaSymbol, type SymbolDef } from './scada-logic';
import { rowsById } from './scada-scene-logic';
import { elementIds, isRec } from './scene-edit-core';
import { mergeMessages, DEFAULT_WHATIF_MESSAGES, DEFAULT_RULE_WORDS, type DeepPartial, type RuleWords, type WhatIfMessages } from './scene-editor-messages-panels';
import type { EditorCtx, WhatIfState } from './scene-editor-types';
import { CONTROL, PanelField, SMALL_BUTTON } from './scene-panel-ui';
import { describeRule, matchingRules } from './scene-rules-edit';
import {
  addSampleThing, emptyWhatIf, isEmptyWhatIf, MAX_SAMPLE_THINGS, overlayParams, overlayRows, overrideCount, readOverride, removeSampleThing, sampleId,
  sampleThings, setOverride, setParamOverride, setSampleThing, thingColumns,
} from './scene-whatif-logic';
import { thingIdsOf } from './scene-editor-state';
import { patchId } from './scene-patch';

/** At most this many thing ids are listed by name. */
const LISTED_THINGS = 24;

export interface SceneWhatIfProps {
  ctx: EditorCtx;
  value: WhatIfState;
  onChange: (next: WhatIfState) => void;
  /** Any part of the panel's texts, in the host's language. */
  messages?: DeepPartial<WhatIfMessages>;
  /** The words the matching rules are written in (the Rules tab's `words`). */
  ruleWords?: RuleWords;
  className?: string;
}

const ALL = '*';
const STATUSES = ['none', 'warning', 'critical'] as const;

const shown = (v: unknown, none: string): string => (v === undefined || v === null || v === '' ? none : typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));

export function SceneWhatIf({ ctx, value, onChange, messages, ruleWords = DEFAULT_RULE_WORDS, className }: SceneWhatIfProps) {
  const m = useMemo(() => mergeMessages<WhatIfMessages>(DEFAULT_WHATIF_MESSAGES, messages), [messages]);
  const base = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const s = ctx.settings;
  const symbols = useMemo(() => {
    const out: Array<{ id: string; text: string; row: Record<string, unknown> }> = [];
    for (const e of Array.isArray(s.elements) ? (s.elements as unknown[]) : []) {
      if (!isRec(e) || typeof e.id !== 'string') continue;
      const own = typeof e.label === 'string' && e.label ? e.label : isScadaSymbol(e.symbol) ? (SCADA_SYMBOL_DEFS[e.symbol] as SymbolDef).label : '';
      out.push({ id: e.id, text: own ? `${e.id} (${own})` : e.id, row: e });
    }
    return out;
  }, [s.elements]);

  // What the controls change: the one selected symbol by default, any symbol or all of them by the author's choice.
  const picked = ctx.selection.elements?.length === 1 ? ctx.selection.elements[0] : null;
  const scope = choice ?? (picked && elementIds(s).has(picked) ? picked : ALL);
  const exists = scope === ALL || symbols.some((x) => x.id === scope);
  const ids = !exists ? [] : scope === ALL ? symbols.map((x) => x.id) : [scope];
  const only = ids.length === 1 ? symbols.find((x) => x.id === ids[0]) : undefined;

  const real = useMemo(() => rowsById(ctx.data.points, s.idColumn || 'id'), [ctx.data.points, s.idColumn]);
  const realOf = (column: string): unknown => (ids.length === 1 ? real.get(ids[0])?.[column] : undefined);

  const min = typeof only?.row.min === 'number' ? only.row.min : 0;
  const max = typeof only?.row.max === 'number' && only.row.max > min ? only.row.max : min + 100;
  const range = (column: string) => (column === 'capacity' ? { min: 0, max: Math.max(max, 100) * 2 } : { min, max });

  const put = (column: string, v: unknown) => onChange(setOverride(value, ids, column, v));

  const number = (column: 'value' | 'value2' | 'capacity', label: string) => {
    const id = `${base}-${column}`;
    const o = readOverride(value, ids, column);
    const over = o.kind !== 'none';
    const now = o.kind === 'same' ? o.value : o.kind === 'mixed' ? undefined : realOf(column);
    const r = range(column);
    const num = typeof now === 'number' ? now : typeof now === 'string' && now !== '' && Number.isFinite(Number(now)) ? Number(now) : undefined;
    return (
      <PanelField key={column} id={id} label={label} tag={over ? m.overridden(1) : undefined} className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            type="range" aria-label={`${label} (slider)`} min={r.min} max={r.max} step={(r.max - r.min) / 100} value={num ?? r.min} disabled={ids.length === 0}
            onChange={(e) => put(column, Number(e.target.value))} className="min-w-0 flex-1 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          <input
            id={id} type="number" className={cn(CONTROL, 'w-24')} value={num ?? ''} placeholder={o.kind === 'mixed' ? m.mixed : undefined} disabled={ids.length === 0}
            onChange={(e) => put(column, e.target.value === '' ? undefined : Number(e.target.value))}
          />
          {over && (
            <button type="button" className={SMALL_BUTTON} aria-label={m.useReal(label)} title={m.useReal(label)} onClick={() => put(column, undefined)}>×</button>
          )}
        </div>
        {over && ids.length === 1 && <p className="text-[11px] text-text-secondary">{m.realValue(shown(realOf(column), m.noData))}</p>}
      </PanelField>
    );
  };

  const runningO = readOverride(value, ids, 'running');
  const runningNow = runningO.kind === 'same' ? runningO.value === true : runningO.kind === 'mixed' ? false : realOf('running') === true || realOf('running') === 'true';
  const statusO = readOverride(value, ids, 'status');
  const statusReal = realOf('status');

  // The things (the table's rows, then the samples): their rows join the rule context, their ids are targets.
  const cols = thingColumns(s);
  const realThings = useMemo(() => thingIdsOf(ctx.data, s), [ctx.data, s]);
  const samples = sampleThings(value);
  const effective = useMemo(() => {
    const rows = overlayRows(rowsById(ctx.data.points, s.idColumn || 'id'), value);
    const thingIds: string[] = [];
    for (const row of [...(ctx.data.things?.rows ?? []), ...(value.things ?? [])]) {
      const id = patchId(row?.[cols.id]);
      if (id !== null && !thingIds.includes(id)) { thingIds.push(id); rows.set(id, row); }
    }
    return { rows, params: overlayParams(ctx.params, value), thingIds };
  }, [ctx.data.points, ctx.data.things, ctx.params, s.idColumn, cols.id, value]);
  const addSample = () => onChange(addSampleThing(
    value, s, { x: (typeof s.width === 'number' ? s.width : 1200) / 2, y: (typeof s.height === 'number' ? s.height : 700) / 2 },
    SCADA_SYMBOLS[0] ?? '', [...elementIds(s), ...realThings],
  ));
  const matching = useMemo(() => matchingRules(s, effective), [s, effective]);
  const params = ctx.host.params ?? [];
  const total = overrideCount(value);

  return (
    <section aria-label={m.title} className={cn('space-y-4', className)} data-panel="whatif">
      <p className="rounded-md bg-info-subtle px-3 py-2 text-xs leading-snug text-info-fg">{m.note}</p>

      <PanelField id={`${base}-scope`} label={m.scope}>
        <select id={`${base}-scope`} className={CONTROL} value={exists ? scope : ALL} onChange={(e) => setChoice(e.target.value)}>
          <option value={ALL}>{m.all}</option>
          {symbols.map((x) => <option key={x.id} value={x.id}>{x.id === picked ? m.selected(x.text) : x.text}</option>)}
        </select>
      </PanelField>

      <fieldset className="space-y-3 rounded-lg border border-border p-3" disabled={ids.length === 0}>
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">{only ? only.id : m.all}</legend>
        {number('value', m.value)}
        {number('value2', m.value2)}
        {number('capacity', m.capacity)}
        <div className="flex items-center gap-2">
          <label htmlFor={`${base}-running`} className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              id={`${base}-running`} type="checkbox" checked={runningNow} onChange={(e) => put('running', e.target.checked)}
              className="h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus"
            />
            {m.running}
          </label>
          {runningO.kind !== 'none' && (
            <button type="button" className={SMALL_BUTTON} aria-label={m.useReal(m.running)} title={m.useReal(m.running)} onClick={() => put('running', undefined)}>×</button>
          )}
        </div>
        <PanelField id={`${base}-status`} label={m.status} tag={statusO.kind !== 'none' ? m.overridden(1) : undefined}>
          <select
            id={`${base}-status`} className={CONTROL} value={statusO.kind === 'same' ? String(statusO.value) : ''}
            onChange={(e) => put('status', e.target.value === '' ? undefined : e.target.value)}
          >
            <option value="">{statusO.kind === 'mixed' ? m.mixed : `${m.real}${ids.length === 1 && statusReal !== undefined ? ` (${shown(statusReal, '')})` : ''}`}</option>
            {STATUSES.map((st) => <option key={st} value={st}>{m.statuses[st]}</option>)}
          </select>
        </PanelField>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">{m.params}</legend>
        {params.length === 0 && <p className="text-xs text-text-secondary">{m.noParams}</p>}
        {params.map((p) => {
          const id = `${base}-param-${p.key}`;
          const over = Object.hasOwn(value.params, p.key);
          const current = over ? String(value.params[p.key]) : '';
          const realValue = ctx.params[p.key];
          return (
            <PanelField key={p.key} id={id} label={p.label || p.key} tag={over ? m.overridden(1) : undefined}>
              <div className="flex items-center gap-2">
                {p.values?.length ? (
                  <select id={id} className={CONTROL} value={current} onChange={(e) => onChange(setParamOverride(value, p.key, e.target.value))}>
                    <option value="">{`${m.real}${realValue !== undefined ? ` (${shown(realValue, '')})` : ''}`}</option>
                    {p.values.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    id={id} type="text" className={CONTROL} value={current} placeholder={shown(realValue, m.real)} autoComplete="off"
                    onChange={(e) => onChange(setParamOverride(value, p.key, e.target.value))}
                  />
                )}
                {over && (
                  <button type="button" className={SMALL_BUTTON} aria-label={m.useReal(p.label || p.key)} title={m.useReal(p.label || p.key)} onClick={() => onChange(setParamOverride(value, p.key, undefined))}>×</button>
                )}
              </div>
            </PanelField>
          );
        })}
      </fieldset>

      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-xs text-text-secondary">{total ? m.overridden(total) : ''}</p>
        <button
          type="button" onClick={() => onChange(emptyWhatIf())} disabled={isEmptyWhatIf(value)} title={m.resetHelp}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary hover:border-border-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {m.reset}
        </button>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border p-3" data-part="things">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">{m.things}</legend>
        <p className="text-xs leading-snug text-text-secondary">{m.thingsNote}</p>
        <p className="text-xs text-text-primary" data-part="thing-ids">
          {realThings.length ? m.thingIds(realThings.slice(0, LISTED_THINGS), Math.max(0, realThings.length - LISTED_THINGS), realThings.length) : m.noThings}
        </p>
        {samples.length > 0 && (
          <ul className="space-y-2">
            {samples.map((row) => {
              const id = sampleId(s, row);
              const num = (column: string, label: string) => (
                <label className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  {label}
                  <input
                    type="number" className={cn(CONTROL, 'w-20')} value={typeof row[column] === 'number' ? (row[column] as number) : ''}
                    onChange={(e) => onChange(setSampleThing(value, s, id, column, e.target.value === '' ? undefined : Number(e.target.value)))}
                  />
                </label>
              );
              return (
                <li key={id} data-sample={id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-raised px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{id}</span>
                  {num(cols.x, m.sampleX)}
                  {num(cols.y, m.sampleY)}
                  <select
                    aria-label={`${m.status}: ${id}`} className={cn(CONTROL, 'w-28')} value={typeof row.status === 'string' ? row.status : ''}
                    onChange={(e) => onChange(setSampleThing(value, s, id, 'status', e.target.value === '' || e.target.value === 'none' ? undefined : e.target.value))}
                  >
                    <option value="">{m.statuses.none}</option>
                    <option value="warning">{m.statuses.warning}</option>
                    <option value="critical">{m.statuses.critical}</option>
                  </select>
                  <button type="button" className={SMALL_BUTTON} aria-label={m.removeSample(id)} title={m.removeSample(id)} onClick={() => onChange(removeSampleThing(value, s, id))}>×</button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button" onClick={addSample} disabled={samples.length >= MAX_SAMPLE_THINGS} title={samples.length >= MAX_SAMPLE_THINGS ? m.sampleFull : undefined}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary hover:border-border-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {m.addSample}
        </button>
      </fieldset>

      <section aria-labelledby={`${base}-matching`} className="space-y-2" data-part="matching">
        <h3 id={`${base}-matching`} className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{m.matching}</h3>
        {matching.length === 0 ? (
          <p className="text-xs text-text-secondary">{m.noneMatching}</p>
        ) : (
          <ul className="space-y-1.5">
            {matching.map((r) => (
              <li key={r.index} data-rule={r.index} className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm leading-snug text-text-primary">
                {describeRule((s.rules as unknown[])[r.index], ruleWords)}
                <span className="mt-0.5 block text-[11px] text-text-secondary">{m.targets(r.targets.slice(0, 4), Math.max(0, r.targets.length - 4))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
