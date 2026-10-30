'use client';
// The inspector of the diagram editor: Properties, Rules and Actions of the selection. Properties draws the scene
// template's own field definitions for what is selected (a symbol, a connection, a title, zone or divider, several of one
// kind, or the diagram itself when nothing is), so a field added to the template shows up here without a change.
// Every change is one operation of the edit model through `ctx.apply`.
import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/libs/utils/cn';
import { FieldControl } from '../../SchemaForm/fields/FieldControl';
import { useFieldOverrides } from '../../SchemaForm/schema-form.context';
import type { FieldSchema } from '../../SchemaForm/types';
import { SCADA_SCENE } from '../templates/scada-scene';
import { localizeTemplate } from '../localize';
import { useWidgetKit } from '../WidgetKitContext';
import { SCADA_SYMBOL_DEFS, isScadaSymbol, type SymbolDef } from './scada-logic';
import { renameElement, type EditResult, type Rec } from './scene-edit-logic';
import { mergeMessages, DEFAULT_INSPECTOR_MESSAGES, type DeepPartial, type InspectorMessages, type RulesMessages } from './scene-editor-messages-panels';
import type { EditorCtx, InspectedThing } from './scene-editor-types';
import {
  colourProblem, elementOp, elementRow, fieldsOf, fieldVisible, inspectorTarget, linkOp, sceneOp, shapeOp, sharedValues, storedValue, thingSummary, type FieldEntry, type FieldScope,
} from './scene-inspector-logic';
import { CONTROL, PanelField } from './scene-panel-ui';
import { SceneRulesEditor } from './SceneRulesEditor';

export type InspectorTab = 'properties' | 'rules' | 'actions';

export interface SceneInspectorProps {
  ctx: EditorCtx;
  /** Any part of the inspector's texts, in the host's language. */
  messages?: DeepPartial<InspectorMessages>;
  /** The Rules tab's texts. */
  rulesMessages?: DeepPartial<RulesMessages>;
  /** Controlled tab (a shell that opens Rules from the problems list); without it the inspector keeps its own. */
  tab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  /** The tabs offered, in order (default: Properties, Rules and, when the host has an actions editor, Actions). */
  tabs?: readonly InspectorTab[];
  /** Draw no tab strip: the shell has its own tabs and sets `tab` (default true). */
  showTabs?: boolean;
  className?: string;
}

/** The diagram's groups that fold under Advanced when nothing is selected: the canvas size, the table columns, the things from data. */
const SCENE_ADVANCED_GROUPS: ReadonlySet<string> = new Set(['canvas', 'source', 'things']);
/** Fields that make no sense written to several things at once. */
const SINGLE_ONLY: Record<FieldScope, readonly string[]> = { element: ['id', 'x', 'y'], link: ['from', 'to', 'id'], shape: ['x', 'y'], scene: [] };
/** Fields committed when the author is done typing (a rename or an end moves things; a half-typed id is not an id). */
const ON_COMMIT: Record<FieldScope, readonly string[]> = { element: ['id'], link: ['from', 'to', 'id'], shape: [], scene: [] };

const nameOfSymbol = (row: Rec | undefined): string => {
  if (!row) return '';
  if (typeof row.label === 'string' && row.label) return row.label;
  return isScadaSymbol(row.symbol) ? (SCADA_SYMBOL_DEFS[row.symbol] as SymbolDef).label : String(row.symbol ?? '');
};

export function SceneInspector({ ctx, messages, rulesMessages, tab, onTabChange, tabs: offered, showTabs = true, className }: SceneInspectorProps) {
  const m = useMemo(() => mergeMessages<InspectorMessages>(DEFAULT_INSPECTOR_MESSAGES, messages), [messages]);
  const base = useId();
  const [own, setOwn] = useState<InspectorTab>('properties');
  const [status, setStatus] = useState('');
  const hasActions = !!ctx.host.renderActions;
  const tabs: InspectorTab[] = (offered ?? ['properties', 'rules', 'actions']).filter((t, i, all) => (t !== 'actions' || hasActions) && all.indexOf(t) === i);
  if (!tabs.length) tabs.push('properties');
  const wanted = tab ?? own;
  const current: InspectorTab = tabs.includes(wanted) ? wanted : tabs[0];
  const choose = (t: InspectorTab) => { setOwn(t); onTabChange?.(t); };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(tabs[to]);
    (e.currentTarget.parentElement?.children[to] as HTMLElement | undefined)?.focus();
  };

  const target = inspectorTarget(ctx.selection, ctx.settings);
  return (
    <section aria-label={m.title} className={cn('flex min-h-0 flex-col gap-3', className)} data-panel="inspector">
      {showTabs && <div role="tablist" aria-label={m.tabsLabel} className="flex gap-1 border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t} id={`${base}-tab-${t}`} type="button" role="tab" aria-selected={current === t} aria-controls={`${base}-panel-${t}`} tabIndex={current === t ? 0 : -1}
            onClick={() => choose(t)} onKeyDown={(e) => onKey(e, i)}
            className={cn(
              '-mb-px border-b-2 px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              current === t ? 'border-primary font-medium text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {m.tabs[t]}
          </button>
        ))}
      </div>}
      <p role="status" className="sr-only">{status}</p>
      <div
        id={`${base}-panel-${current}`} role={showTabs ? 'tabpanel' : 'region'} aria-labelledby={showTabs ? `${base}-tab-${current}` : undefined} aria-label={showTabs ? undefined : m.tabs[current]}
        tabIndex={showTabs ? 0 : undefined} className="min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:outline-none"
      >
        {current === 'properties' && <Properties key={JSON.stringify(target)} ctx={ctx} m={m} announce={setStatus} />}
        {current === 'rules' && <SceneRulesEditor ctx={ctx} messages={rulesMessages} />}
        {current === 'actions' && (
          target.kind === 'elements' && target.ids.length === 1
            ? ctx.host.renderActions?.(target.ids[0]) ?? <p className="text-xs text-text-secondary">{m.actionsMissing}</p>
            : <p className="text-xs text-text-secondary">{m.actionsNone}</p>
        )}
      </div>
    </section>
  );
}

// ─── A thing from data ───────────────────────────────────────────────────────

function ThingCard({ thing, ctx, m }: { thing: InspectedThing; ctx: EditorCtx; m: InspectorMessages }) {
  const sum = thingSummary(ctx.settings, thing.row);
  return (
    <section className="space-y-3" data-part="thing" data-thing={thing.id} aria-label={m.thing(thing.name, thing.id)}>
      <h3 className="text-sm font-semibold text-text-primary">{m.thing(thing.name, thing.id)}</h3>
      <p className="rounded-md bg-surface-sunken px-3 py-2 text-xs leading-snug text-text-secondary" data-part="placed-by-data">{m.placedByData}</p>
      {thing.sample && <p className="text-xs text-info-fg">{m.thingSample}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-text-secondary">{m.thingFields.symbol}</dt><dd className="min-w-0 truncate text-text-primary">{sum.symbol || '—'}</dd>
        <dt className="text-text-secondary">{m.thingFields.place}</dt><dd className="text-text-primary tabular-nums">{sum.place}</dd>
      </dl>
      {sum.cells.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{m.thingFields.row}</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {sum.cells.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-text-secondary">{k}</dt><dd className="min-w-0 truncate text-text-primary">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

// ─── Properties ──────────────────────────────────────────────────────────────

function Properties({ ctx, m, announce }: { ctx: EditorCtx; m: InspectorMessages; announce: (text: string) => void }) {
  const base = useId();
  const { templateText } = useWidgetKit();
  const overrides = useFieldOverrides();
  const template = useMemo(() => (templateText ? localizeTemplate(SCADA_SCENE, templateText) : SCADA_SCENE), [templateText]);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const target = inspectorTarget(ctx.selection, ctx.settings);

  // A thing from data the author clicked: read-only, it is placed by its row.
  if (target.kind === 'scene' && ctx.thing) return <ThingCard thing={ctx.thing} ctx={ctx} m={m} />;
  if (target.kind === 'mixed') return <p className="text-sm text-text-secondary">{m.mixed(target.elements, target.links, target.shapes)}</p>;

  const scope: FieldScope = target.kind === 'elements' ? 'element' : target.kind === 'links' ? 'link' : target.kind === 'shapes' ? 'shape' : 'scene';
  const keys = target.kind === 'elements' ? target.ids : target.kind === 'scene' ? [] : target.indices;
  const many = keys.length > 1;
  const rows: Rec[] = target.kind === 'elements'
    ? target.ids.map((id) => elementRow(ctx.settings, id)).filter((r): r is Rec => !!r)
    : target.kind === 'links' ? target.indices.map((i) => (ctx.settings.links as Rec[])[i])
      : target.kind === 'shapes' ? target.indices.map((i) => (ctx.settings.shapes as Rec[])[i])
        : [ctx.settings as Rec];
  const entries = fieldsOf(scope, template).filter((f) => fieldVisible(scope, f.key, rows) && !(many && SINGLE_ONLY[scope].includes(f.key)));
  const { values, differs } = sharedValues(rows, entries.map((e) => e.key), Object.fromEntries(entries.map((e) => [e.key, e.field.value])));

  const heading = target.kind === 'scene' ? m.scene
    : target.kind === 'elements' ? (many ? m.severalSymbols(keys.length) : m.symbol(nameOfSymbol(rows[0]), target.ids[0]))
      : target.kind === 'links' ? (many ? m.severalConnections(keys.length) : m.connection(target.indices[0] + 1))
        : many ? m.severalShapes(keys.length) : m.shapes[(rows[0]?.kind as 'text' | 'zone' | 'divider') ?? 'text'] ?? m.shapes.text;

  const clear = (key: string) => {
    setDrafts((d) => { const { [key]: _gone, ...rest } = d; return rest; });
    setErrors((e) => { const { [key]: _gone, ...rest } = e; return rest; });
  };
  const fail = (key: string, why: string, raw?: unknown) => {
    if (raw !== undefined) setDrafts((d) => ({ ...d, [key]: raw }));
    setErrors((e) => ({ ...e, [key]: why }));
  };

  const opFor = (patch: Rec): ((s: EditorCtx['settings']) => EditResult) => (
    target.kind === 'elements' ? elementOp(target.ids, patch)
      : target.kind === 'links' ? linkOp(target.indices, patch)
        : target.kind === 'shapes' ? shapeOp(target.indices, patch)
          : sceneOp(patch, ctx.model)
  );

  const commit = (key: string, raw: unknown, field: FieldSchema) => {
    const value = storedValue(field, raw);
    if (field.type === 'color' && colourProblem(raw)) { fail(key, m.notAColour, raw); return; }
    const r = ctx.apply(opFor({ [key]: value }), `inspect:${scope}:${keys.join(',')}:${key}`);
    if (r.refused) fail(key, m.refused(r.refused), raw);
    else clear(key);
  };

  const rename = (to: string): boolean => {
    if (target.kind !== 'elements' || many) return true;
    const from = target.ids[0];
    if (to === from) { clear('id'); return true; }
    const r = ctx.apply((s) => renameElement(s, from, to));
    if (r.refused) { fail('id', m.refused(r.refused)); return false; }
    clear('id');
    ctx.host.onRename?.(from, r.id ?? to);
    // The selection holds ids: it follows the symbol to its new name.
    ctx.setSelection({ elements: [r.id ?? to] });
    announce(m.idRenamed(r.id ?? to));
    return true;
  };

  const committed = (key: string, text: string, field: FieldSchema): boolean => {
    if (target.kind === 'elements' && key === 'id') return rename(text.trim());
    const r = ctx.apply(opFor({ [key]: storedValue(field, text) }), `inspect:${scope}:${keys.join(',')}:${key}`);
    if (r.refused) { fail(key, m.refused(r.refused)); return false; }
    clear(key);
    return true;
  };

  const groups: Array<{ group: string; entries: FieldEntry[] }> = [];
  for (const e of entries) {
    const at = groups.find((g) => g.group === e.group);
    if (at) at.entries.push(e); else groups.push({ group: e.group, entries: [e] });
  }
  // nothing selected: the look and the colours are what a person changes; the canvas size, the table columns and the things from data fold under
  // Advanced (next-boilerplate e2e round 3, M-R3-09: "Row id column" and "Thing id column" met a customer on an empty click)
  const folded = scope === 'scene' ? groups.filter((g) => SCENE_ADVANCED_GROUPS.has(g.group)) : [];
  const plain = scope === 'scene' ? groups.filter((g) => !SCENE_ADVANCED_GROUPS.has(g.group)) : groups;

  const draw = (e: FieldEntry) => {
    const id = `${base}-${e.key}`;
    const isId = e.key === 'id' && scope === 'element';
    const stored = isId ? rows[0]?.id : values[e.key];
    const value = Object.hasOwn(drafts, e.key) ? drafts[e.key] : stored;
    const error = errors[e.key];
    const label = isId ? m.id : e.field.label;
    const hint = isId ? m.idHelp : e.field.description;
    const describedBy = [hint ? `${id}-hint` : '', differs.has(e.key) ? `${id}-tag` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
    return (
      <PanelField key={e.key} id={id} label={label} hint={hint} error={error} tag={differs.has(e.key) ? m.differs : undefined}>
        {ON_COMMIT[scope].includes(e.key) ? (
          <CommitInput
            id={id} value={typeof value === 'string' ? value : ''} placeholder={e.field.placeholder} maxLength={e.field.maxLength ?? 80} invalid={!!error} describedBy={describedBy}
            onCommit={(text) => committed(e.key, text, e.field)} onEdit={() => { if (errors[e.key]) clear(e.key); }}
          />
        ) : (
          <FieldControl
            id={id} field={e.field} value={differs.has(e.key) && !Object.hasOwn(drafts, e.key) ? undefined : value} overrides={overrides} invalid={!!error} describedBy={describedBy}
            onChange={(v) => commit(e.key, v, e.field)}
          />
        )}
      </PanelField>
    );
  };

  return (
    <div className="space-y-4" data-scope={scope}>
      <div>
        <h2 className="text-sm font-semibold text-text-primary">{heading}</h2>
        {target.kind === 'scene' && <p className="mt-1 text-xs text-text-secondary">{m.sceneHint}</p>}
        {target.kind === 'elements' && !many && <p className="mt-1 text-xs text-text-secondary" data-testid="inspector-device-hint">{m.deviceHint}</p>}
        {many && <p className="mt-1 text-xs text-text-secondary">{m.shared}</p>}
      </div>
      {plain.map((g) => (
        <section key={g.group} aria-labelledby={`${base}-g-${g.group}`} className="space-y-3 rounded-lg border border-border p-3" data-group={g.group}>
          <h3 id={`${base}-g-${g.group}`} className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
            {(m.groups as Record<string, string>)[g.group] ?? g.group}
          </h3>
          {g.entries.map(draw)}
        </section>
      ))}
      {folded.length > 0 && (
        <details className="rounded-lg border border-border p-3" data-part="scene-advanced">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">{m.advanced}</summary>
          <p className="mt-1 text-xs text-text-secondary">{m.advancedHint}</p>
          <div className="mt-3 space-y-4">
            {folded.map((g) => (
              <section key={g.group} aria-labelledby={`${base}-g-${g.group}`} className="space-y-3 rounded-lg border border-border p-3" data-group={g.group}>
                <h3 id={`${base}-g-${g.group}`} className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                  {(m.groups as Record<string, string>)[g.group] ?? g.group}
                </h3>
                {g.entries.map(draw)}
              </section>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** A text input that commits when the author presses Enter or leaves it, and goes back on Escape (a rename must not run per keystroke). */
function CommitInput({
  id, value, onCommit, onEdit, placeholder, maxLength, invalid, describedBy,
}: { id: string; value: string; onCommit: (text: string) => boolean; onEdit?: () => void; placeholder?: string; maxLength?: number; invalid?: boolean; describedBy?: string }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  // A value that changed under the field (an undo, a rename elsewhere) replaces what was typed.
  if (seen !== value) { setSeen(value); setText(value); }
  const commit = () => { if (text !== value) onCommit(text); };
  return (
    <input
      ref={ref} id={id} type="text" className={CONTROL} value={text} placeholder={placeholder} maxLength={maxLength} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      autoComplete="off" spellCheck={false}
      onChange={(e) => { setText(e.target.value); onEdit?.(); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { setText(value); onEdit?.(); }
      }}
    />
  );
}
