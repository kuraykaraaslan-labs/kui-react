'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { shouldShow, type FieldSchema } from './types';
import { FieldControl, controlCls } from './fields/FieldControl';
import {
  OptionPreviewProvider, SchemaFormMessagesProvider, useFieldOverrides, useOptionPreview, type FieldOverrides, type OptionPreviewRenderer,
} from './schema-form.context';
import { mergeSchemaFormMessages, type SchemaFormMessages } from './messages';

export interface SchemaFormProps {
  schema: Record<string, FieldSchema>;
  values: Record<string, unknown>;
  /** Used for the "modified" dot and the reset-to-default button. */
  defaults?: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Show a search box (only when the schema has more than 6 fields). */
  searchable?: boolean;
  /** Debounce before `onChange` fires; 0 fires on every edit. Default 200. */
  debounceMs?: number;
  /** Renderers for field types kui-react does not own, keyed by `FieldSchema.type`. */
  fieldOverrides?: FieldOverrides;
  /** Messages per field key, e.g. from `validateSchemaValues`. */
  errors?: Record<string, string | undefined>;
  /** Shown when the schema has no field. Wins over `messages.empty`. */
  emptyMessage?: string;
  /** The form's own texts (reset, search, the colour, font, JSON and repeater controls); the rest stays English. */
  messages?: Partial<SchemaFormMessages>;
  className?: string;
  /** Keep only the fields this returns true for (e.g. a "Basic" mode hiding `advanced` fields). */
  fieldFilter?: (key: string, field: FieldSchema, value: unknown, defaultValue: unknown) => boolean;
  /** Show the values but accept no edits (e.g. settings written by a newer version). */
  readOnly?: boolean;
  /**
   * Draws the thumbnail of an option's `preview` id in a `display: 'cards'` select; an option it
   * returns `null` for shows its label only. Without it (and without an outer SchemaForm's), cards
   * are labels only. WidgetKit's settings editor passes its layout thumbnails.
   */
  renderOptionPreview?: OptionPreviewRenderer;
}

function seedFromSchema(schema: Record<string, FieldSchema>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(schema)) if (f.value !== undefined) out[k] = f.value;
  return out;
}

/**
 * A whole form from a `FieldSchema` map: seeds defaults, hides fields whose
 * `showIf` does not hold, groups by `group`, optionally searches, debounces writes.
 */
export function SchemaForm({
  schema, values, defaults = {}, onChange, searchable = false, debounceMs = 200,
  fieldOverrides, errors = {}, emptyMessage, messages, className, fieldFilter, readOnly = false,
  renderOptionPreview,
}: SchemaFormProps) {
  const baseId = useId();
  const ctxOverrides = useFieldOverrides();
  const overrides = fieldOverrides ?? ctxOverrides;
  const ctxPreview = useOptionPreview();
  const preview = renderOptionPreview ?? ctxPreview;
  const m = useMemo(() => mergeSchemaFormMessages(messages), [messages]);

  const seed = useMemo(() => ({ ...defaults, ...seedFromSchema(schema), ...values }), [schema, values, defaults]);
  const [local, setLocal] = useState<Record<string, unknown>>(seed);
  const localRef = useRef(local);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState('');
  const [jsonBad, setJsonBad] = useState<Record<string, boolean>>({});

  // Re-seed when the subject changes (a different key set), not on every parent
  // render: `values` is usually a fresh object and would clobber typing.
  const seedKey = JSON.stringify(Object.keys(seed).sort());
  const [appliedKey, setAppliedKey] = useState(seedKey);
  if (appliedKey !== seedKey) {
    setAppliedKey(seedKey);
    setLocal(seed);
    setJsonBad({});
  }
  useEffect(() => { localRef.current = local; }, [local]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const update = (key: string, value: unknown) => {
    if (readOnly) return;
    const next = { ...localRef.current, [key]: value };
    localRef.current = next;
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    if (debounceMs <= 0) onChange(next);
    else timer.current = setTimeout(() => onChange(next), debounceMs);
  };

  const q = search.trim().toLowerCase();
  const visible = Object.entries(schema)
    .filter(([, f]) => shouldShow(f, local))
    .filter(([k, f]) => !fieldFilter || fieldFilter(k, f, local[k], defaults[k] ?? f.value))
    .filter(([k, f]) => !q || f.label.toLowerCase().includes(q) || k.toLowerCase().includes(q));
  const ungrouped = visible.filter(([, f]) => !f.group);
  const groups = visible.filter(([, f]) => f.group).reduce<Record<string, [string, FieldSchema][]>>((acc, e) => {
    (acc[e[1].group as string] ??= []).push(e);
    return acc;
  }, {});

  const renderField = ([key, field]: [string, FieldSchema]) => {
    const id = `${baseId}-${key}`;
    const dv = defaults[key];
    const modified = dv !== undefined && local[key] !== undefined && JSON.stringify(local[key]) !== JSON.stringify(dv);
    const err = errors[key];
    const describedBy = [err ? `${id}-error` : '', field.description ? `${id}-desc` : ''].filter(Boolean).join(' ') || undefined;
    return (
      <div key={key} data-field={key}>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={id} className="text-xs font-medium text-text-secondary flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-error" aria-hidden="true">*</span>}
            {modified && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title={m.modified} />}
          </label>
          {dv !== undefined && (
            <button type="button" onClick={() => update(key, dv)} aria-label={m.resetLabel(field.label)}
              className="px-1 text-[10px] text-text-disabled hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus rounded">
              {m.reset}
            </button>
          )}
        </div>
        <FieldControl id={id} field={field} value={local[key]} overrides={overrides} invalid={!!err || !!jsonBad[key]}
          describedBy={describedBy} onChange={(v) => update(key, v)}
          onJsonError={(bad) => setJsonBad((p) => ({ ...p, [key]: bad }))} />
        {field.description && <p id={`${id}-desc`} className="mt-1.5 text-[11px] leading-snug text-text-secondary">{field.description}</p>}
        {err && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-error">{err}</p>}
      </div>
    );
  };

  if (Object.keys(schema).length === 0) return <p className="text-xs text-text-secondary">{emptyMessage ?? m.empty}</p>;

  return (
    <SchemaFormMessagesProvider value={m}>
      <OptionPreviewProvider value={preview}>
        <fieldset disabled={readOnly} className={cn('min-w-0 space-y-4', className)}>
          {searchable && Object.keys(schema).length > 6 && (
            <input type="search" aria-label={m.searchLabel} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={m.searchPlaceholder} className={controlCls} />
          )}
          {ungrouped.length > 0 && <div className="space-y-4">{ungrouped.map(renderField)}</div>}
          {Object.entries(groups).map(([group, entries]) => (
            <details key={group} open className="rounded-lg border border-border">
              <summary className="px-3 py-2 text-xs font-medium uppercase tracking-wide cursor-pointer text-text-secondary">{group}</summary>
              <div className="p-3 space-y-4 border-t border-border">{entries.map(renderField)}</div>
            </details>
          ))}
        </fieldset>
      </OptionPreviewProvider>
    </SchemaFormMessagesProvider>
  );
}
