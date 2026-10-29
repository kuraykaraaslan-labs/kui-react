'use client';
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/libs/utils/cn';
import { shouldShow, type FieldOption, type FieldSchema, type FontValue } from '../types';
import { useOptionPreview, useSchemaFormMessages, type FieldOverrides } from '../schema-form.context';
import { THEME_COLOR_MESSAGE } from '../messages';

export const controlCls =
  'w-full px-3 py-2 rounded-md text-sm bg-surface-raised text-text-primary border border-border ' +
  'placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ' +
  'disabled:opacity-50';

const optVal = (o: FieldOption): string => (typeof o === 'string' ? o : o.value);
const optLabel = (o: FieldOption): string => (typeof o === 'string' ? o : o.label);

export interface FieldControlProps {
  id: string;
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  overrides?: FieldOverrides;
  /** Reports a JSON parse problem for `json` fields (the value is not updated then). */
  onJsonError?: (hasError: boolean) => void;
  depth?: number;
  invalid?: boolean;
  describedBy?: string;
}

/** The input for one field. Pure presentation: values go in, `onChange` comes out. */
export function FieldControl(props: FieldControlProps) {
  const { id, field, value, onChange, overrides, invalid, describedBy } = props;
  const m = useSchemaFormMessages();
  const Override = overrides?.[field.type];
  if (Override) return <Override id={id} field={field} value={value} onChange={onChange} />;

  const aria = { 'aria-invalid': invalid || undefined, 'aria-describedby': describedBy } as const;
  const str = (value ?? field.value ?? '') as string;

  switch (field.type) {
    case 'text':
    case 'url':
      return (
        <input id={id} type={field.type} value={str} placeholder={field.placeholder} maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)} className={controlCls} {...aria} />
      );
    case 'data-key':
      return field.multiple ? (
        <input id={id} type="text" value={Array.isArray(value) ? (value as string[]).join(', ') : ''}
          placeholder={field.placeholder || m.commaSeparated}
          onChange={(e) => onChange(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} className={controlCls} {...aria} />
      ) : (
        <input id={id} type="text" value={str} placeholder={field.placeholder} maxLength={128}
          onChange={(e) => onChange(e.target.value)} className={controlCls} {...aria} />
      );
    case 'font':
      return <FontControl {...props} />;
    case 'date':
      return <input id={id} type="date" value={str} onChange={(e) => onChange(e.target.value)} className={controlCls} {...aria} />;
    case 'datetime':
      return <input id={id} type="datetime-local" value={str} onChange={(e) => onChange(e.target.value)} className={controlCls} {...aria} />;
    case 'textarea':
      return (
        <textarea id={id} rows={3} value={str} placeholder={field.placeholder} maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)} className={cn(controlCls, 'resize-y')} {...aria} />
      );
    case 'number':
      return (
        <input id={id} type="number" min={field.min} max={field.max} step={field.step}
          value={typeof value === 'number' ? value : typeof field.value === 'number' && value === undefined ? field.value : ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className={controlCls} {...aria} />
      );
    case 'boolean':
      return (
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
          <input id={id} type="checkbox" checked={Boolean(value ?? field.value ?? false)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus" {...aria} />
          {field.placeholder || m.enabled}
        </label>
      );
    case 'select':
      if (field.display === 'segmented' || field.display === 'cards') return <ChoiceControl {...props} />;
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value)} className={controlCls} {...aria}>
          {!field.required && <option value="">-</option>}
          {(field.options ?? []).map((o) => <option key={optVal(o)} value={optVal(o)}>{optLabel(o)}</option>)}
        </select>
      );
    case 'multi-select':
      return <MultiSelectControl {...props} />;
    case 'color':
      return <ColorControl {...props} />;
    case 'json':
      return <JsonControl {...props} />;
    case 'repeater':
      return <RepeaterControl {...props} />;
    case 'rich-text':
      return (
        <textarea id={id} rows={6} value={str} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)} className={cn(controlCls, 'font-mono text-xs')} {...aria} />
      );
    case 'link':
    case 'background':
    case 'media':
      // Compound app-bound values with no renderer here: edit the raw JSON.
      return <JsonControl {...props} />;
    default:
      // icon, img, symbol, color-token, remote-select ...: degrade to a text
      // input instead of crashing; the host plugs a real picker in via overrides.
      return (
        <input id={id} type="text" value={typeof value === 'string' ? value : ''} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)} className={controlCls} {...aria} />
      );
  }
}

function MultiSelectControl({ id, field, value, onChange }: FieldControlProps) {
  const m = useSchemaFormMessages();
  const current = Array.isArray(value) ? (value as string[]) : [];
  const options = field.options ?? [];
  const toggle = (v: string) => onChange(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
  if (options.length === 0) {
    return (
      <input id={id} type="text" value={current.join(', ')} placeholder={field.placeholder || m.commaSeparated}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} className={controlCls} />
    );
  }
  return (
    <div id={id} role="group" className="flex flex-wrap gap-x-4 gap-y-1.5">
      {options.map((o) => (
        <label key={optVal(o)} className="inline-flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={current.includes(optVal(o))} onChange={() => toggle(optVal(o))}
            className="h-4 w-4 rounded accent-primary" />
          {optLabel(o)}
        </label>
      ))}
    </div>
  );
}

/**
 * Theme colours offered first by every colour field: they follow light/dark and tenant themes. The
 * labels shown come from the form's messages, by `value` (`THEME_COLOR_MESSAGE`); these are the English.
 */
export const THEME_COLOR_TOKENS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Primary', value: 'var(--primary)' },
  { label: 'Secondary', value: 'var(--secondary)' },
  { label: 'Success', value: 'var(--success)' },
  { label: 'Info', value: 'var(--info)' },
  { label: 'Warning', value: 'var(--warning)' },
  { label: 'Error', value: 'var(--error)' },
  { label: 'Text', value: 'var(--text-primary)' },
  { label: 'Muted text', value: 'var(--text-secondary)' },
  { label: 'Strong border', value: 'var(--border-strong)' },
  { label: 'Raised surface', value: 'var(--surface-raised)' },
  { label: 'Sunken surface', value: 'var(--surface-sunken)' },
];

/**
 * Any CSS colour or a theme token. Theme swatches first (they adapt to dark mode), then a free
 * value: the native picker for a hex, or type rgb()/hsl()/hex by hand. Empty = the default.
 */
function ColorControl({ id, value, field, onChange }: FieldControlProps) {
  const m = useSchemaFormMessages();
  const tokenLabel = (t: { label: string; value: string }) => {
    const key = THEME_COLOR_MESSAGE[t.value];
    const text = key ? m[key] : undefined;
    return typeof text === 'string' ? text : t.label;
  };
  const current = typeof value === 'string' ? value : '';
  const hex = /^#[0-9a-fA-F]{6}$/.test(current) ? current : '#000000';
  // a theme colour is shown by its name, never as `var(--text-primary)` (next-boilerplate e2e round 3, M-R3-04); "Custom…" opens the free value
  const token = THEME_COLOR_TOKENS.find((t) => t.value === current);
  const [custom, setCustom] = useState(false);
  const freeValue = custom || !token;
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={m.themeColours(field.label)} className="flex flex-wrap gap-1.5">
        {THEME_COLOR_TOKENS.map((t) => (
          <button key={t.value} type="button" role="radio" aria-checked={current === t.value} title={tokenLabel(t)} aria-label={tokenLabel(t)}
            onClick={() => onChange(t.value)}
            className={cn('h-6 w-6 rounded-full border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              current === t.value && 'ring-2 ring-offset-1 ring-border-focus')}
            style={{ background: t.value }} />
        ))}
      </div>
      {freeValue ? (
        <div className="flex items-center gap-2">
          <input type="color" aria-label={m.pickColour(field.label)} value={hex}
            onChange={(e) => onChange(e.target.value)} className="h-9 w-12 shrink-0 rounded border border-border bg-transparent p-0.5" />
          <input id={id} type="text" value={current} placeholder={field.placeholder || m.colourDefault}
            onChange={(e) => onChange(e.target.value.trim() || undefined)} className={controlCls} />
          {current && (
            <button type="button" onClick={() => onChange(undefined)} aria-label={m.clearLabel(field.label)}
              className="shrink-0 rounded px-2 text-xs text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus">
              {m.clear}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span id={id} className="min-w-0 flex-1 truncate text-text-primary" data-part="colour-token">{tokenLabel(token)}</span>
          <button type="button" onClick={() => setCustom(true)}
            className="shrink-0 rounded px-2 text-xs text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus">
            {m.colourCustom}
          </button>
          <button type="button" onClick={() => onChange(undefined)} aria-label={m.clearLabel(field.label)}
            className="shrink-0 rounded px-2 text-xs text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus">
            {m.clear}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A select drawn as a segmented row or as picture cards (`display`): a radiogroup with one tab stop
 * (the picked option, else the first) and arrow keys, Home and End moving the pick, as in the WAI-ARIA
 * radio pattern. A card whose option carries a `preview` id shows the thumbnail the form's
 * `renderOptionPreview` draws for it above its label.
 */
function ChoiceControl({ id, field, value, onChange, invalid, describedBy }: FieldControlProps) {
  const renderPreview = useOptionPreview();
  const current = (value ?? field.value ?? '') as string;
  const cards = field.display === 'cards';
  const options = field.options ?? [];
  const picked = options.findIndex((o) => optVal(o) === current);
  const thumbs = cards && !!renderPreview && options.some((o) => typeof o !== 'string' && o.preview);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = options.length - 1;
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i >= last ? 0 : i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i <= 0 ? last : i - 1)
        : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
    if (to < 0) return;
    e.preventDefault();
    const group = e.currentTarget.parentElement;
    onChange(optVal(options[to]));
    (group?.children[to] as HTMLElement | undefined)?.focus();
  };
  return (
    <div id={id} role="radiogroup" aria-label={field.label} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      className={cards ? cn('grid gap-2', thumbs ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3') : 'inline-flex flex-wrap rounded-md border border-border p-0.5'}>
      {options.map((o, i) => {
        const v = optVal(o);
        const on = v === current;
        const previewId = typeof o === 'string' ? undefined : o.preview;
        const thumb = thumbs && previewId ? renderPreview(previewId) : null;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
            tabIndex={i === (picked < 0 ? 0 : picked) ? 0 : -1} onKeyDown={(e) => onKeyDown(e, i)}
            data-preview={previewId}
            className={cn(
              'text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              cards
                ? cn('rounded-lg border text-center', thumb ? 'flex flex-col items-center gap-1.5 px-1.5 py-2' : 'px-2 py-3',
                  on ? 'border-primary bg-primary-subtle text-primary' : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary')
                : cn('rounded px-2.5 py-1', on ? 'bg-primary text-primary-fg' : 'text-text-secondary hover:text-text-primary'),
            )}>
            {thumb && <span className="flex w-full justify-center" aria-hidden="true">{thumb}</span>}
            <span className={thumb ? 'leading-tight' : undefined}>{optLabel(o)}</span>
          </button>
        );
      })}
    </div>
  );
}

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800] as const;

/** Size + unit, weight, family, italic. An empty part inherits the theme's. */
function FontControl({ id, field, value, onChange }: FieldControlProps) {
  const m = useSchemaFormMessages();
  const f = (value && typeof value === 'object' ? value : (field.value ?? {})) as FontValue;
  const set = (patch: Partial<FontValue>) => {
    const next: FontValue = { ...f, ...patch };
    for (const k of Object.keys(next) as (keyof FontValue)[]) if (next[k] === undefined) delete next[k];
    onChange(Object.keys(next).length ? next : undefined);
  };
  const small = cn(controlCls, 'px-2');
  return (
    <div id={id} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <input type="number" min={1} max={400} aria-label={m.fontSize(field.label)} placeholder={m.fontSizePlaceholder} value={f.size ?? ''}
        onChange={(e) => set({ size: e.target.value === '' ? undefined : Number(e.target.value) })} className={small} />
      <select aria-label={m.fontUnit(field.label)} value={f.unit ?? 'px'} onChange={(e) => set({ unit: e.target.value as FontValue['unit'] })} className={small}>
        <option value="px">px</option><option value="rem">rem</option><option value="em">em</option>
      </select>
      <select aria-label={m.fontWeight(field.label)} value={f.weight ?? ''}
        onChange={(e) => set({ weight: e.target.value ? (Number(e.target.value) as FontValue['weight']) : undefined })} className={small}>
        <option value="">{m.fontWeightPlaceholder}</option>
        {FONT_WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      <select aria-label={m.fontFamily(field.label)} value={f.family ?? ''}
        onChange={(e) => set({ family: (e.target.value || undefined) as FontValue['family'] })} className={small}>
        <option value="">{m.fontFamilyPlaceholder}</option><option value="sans">{m.fontSans}</option><option value="serif">{m.fontSerif}</option>
        <option value="mono">{m.fontMono}</option>
      </select>
      <label className="col-span-2 inline-flex items-center gap-2 text-xs text-text-secondary sm:col-span-4">
        <input type="checkbox" checked={f.style === 'italic'} onChange={(e) => set({ style: e.target.checked ? 'italic' : undefined })}
          className="h-4 w-4 rounded accent-primary" />
        {m.fontItalic}
      </label>
    </div>
  );
}

function JsonControl({ id, value, field, onChange, onJsonError, invalid }: FieldControlProps) {
  const m = useSchemaFormMessages();
  const [raw, setRaw] = useState<string>(() => {
    const v = value ?? field.value;
    return v === undefined ? '' : JSON.stringify(v, null, 2);
  });
  const [bad, setBad] = useState(false);
  return (
    <>
      <textarea id={id} rows={5} value={raw} spellCheck={false} placeholder={field.placeholder || '{ }'}
        aria-invalid={bad || invalid || undefined}
        onChange={(e) => {
          const text = e.target.value;
          setRaw(text);
          if (!text.trim()) { setBad(false); onJsonError?.(false); onChange(undefined); return; }
          try { const parsed = JSON.parse(text); setBad(false); onJsonError?.(false); onChange(parsed); }
          catch { setBad(true); onJsonError?.(true); }
        }}
        className={cn(controlCls, 'font-mono text-xs', bad && 'border-error')} />
      {bad && <p role="alert" className="mt-1 text-xs text-error">{m.invalidJson}</p>}
    </>
  );
}

type Row = Record<string, unknown>;

function RepeaterControl({ id, field, value, onChange, overrides, depth = 0 }: FieldControlProps) {
  const m = useSchemaFormMessages();
  const sub = field.fields ?? {};
  const items: Row[] = Array.isArray(value) ? (value as Row[]) : [];
  const set = (i: number, k: string, v: unknown) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i: number, d: -1 | 1) => {
    const t = i + d;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[i], next[t]] = [next[t], next[i]];
    onChange(next);
  };
  // A new item starts with the declared defaults; text starts empty, and a number, colour or choice
  // without a default stays absent (not 0 or ''), so it means "automatic" until someone sets it.
  const add = () => onChange([...items, Object.fromEntries(
    Object.entries(sub).filter(([, f]) => f.value !== undefined || ['repeater', 'boolean', 'text', 'textarea', 'url'].includes(f.type))
      .map(([k, f]) => [k, f.type === 'repeater' ? [] : f.value ?? (f.type === 'boolean' ? false : '')]),
  )]);
  const btn = 'px-1.5 py-0.5 text-xs rounded text-text-secondary hover:text-text-primary disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-border-focus';
  const title = (it: Row, i: number) => {
    for (const [k, f] of Object.entries(sub)) if (['text', 'url', 'select'].includes(f.type) && it[k]) return String(it[k]);
    return m.item(i + 1);
  };
  return (
    <div id={id} className="space-y-2">
      {items.map((it, i) => (
        // The item's buttons sit over the right end of its <summary> instead of inside it: a
        // summary is itself interactive, and controls nested in it are an a11y error
        // (nested-interactive). min-h-9 keeps the header the height the buttons gave it.
        <div key={i} className="relative">
          <span className="absolute top-px right-px z-10 flex items-center gap-0.5 h-9 px-3">
            <button type="button" className={btn} disabled={i === 0} aria-label={m.moveUp} onClick={() => move(i, -1)}>{m.up}</button>
            <button type="button" className={btn} disabled={i === items.length - 1} aria-label={m.moveDown} onClick={() => move(i, 1)}>{m.down}</button>
            <button type="button" className={cn(btn, 'hover:text-error')} aria-label={m.removeItem} onClick={() => onChange(items.filter((_, j) => j !== i))}>{m.remove}</button>
          </span>
          <details open={i === items.length - 1} className="rounded-lg border border-border">
            <summary className="flex items-center min-h-9 px-3 pr-36 cursor-pointer select-none bg-surface-overlay">
              <span className="text-xs font-medium text-text-secondary truncate">{title(it, i)}</span>
            </summary>
            <div className="p-3 space-y-3 border-t border-border">
              {Object.entries(sub).map(([k, f]) => {
                const cid = `${id}-${i}-${k}`;
                if (f.type === 'repeater' && depth >= 1) return null; // nesting is capped at two levels
                if (!shouldShow(f, it)) return null; // an item field's showIf reads its own item
                return (
                  <div key={k}>
                    <label htmlFor={cid} className="block mb-1 text-[11px] text-text-secondary">{f.label}</label>
                    <FieldControl id={cid} field={f} value={it[k]} onChange={(v) => set(i, k, v)} overrides={overrides} depth={depth + 1} />
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2 text-xs rounded-md border border-dashed border-border text-text-secondary hover:text-text-primary hover:border-border-strong focus-visible:ring-2 focus-visible:ring-border-focus">
        {m.addItem}
      </button>
    </div>
  );
}
