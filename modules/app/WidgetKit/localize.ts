// Template and widget-type texts through the host's hooks (`WidgetKitHost.templateText`, `kindText`).
// Only what is SHOWN changes: field keys, option values, defaults, versions and migrations stay as
// they are, so a localized template edits and stores exactly what the original does. Pure.

import type { FieldOption, FieldSchema } from '../SchemaForm/types';
import type { BuiltinKindSpec } from './kind';
import type { KindTextFn, TemplateTextFn, TemplateTextRef } from './messages';
import type { SettingsTemplate, TemplateField } from './settings/types';

// Per hook, then per template: a new hook (another language) never sees the old one's labels.
const templateCache = new WeakMap<TemplateTextFn, WeakMap<SettingsTemplate, SettingsTemplate>>();
const kindCache = new WeakMap<KindTextFn, WeakMap<BuiltinKindSpec, BuiltinKindSpec>>();

function localizeField<F extends FieldSchema>(f: F, path: string, text: (ref: Omit<TemplateTextRef, 'templateId'>) => string): F {
  const out: F = { ...f, label: text({ path, prop: 'label', english: f.label }) };
  if (f.description) out.description = text({ path, prop: 'description', english: f.description });
  if (f.placeholder) out.placeholder = text({ path, prop: 'placeholder', english: f.placeholder });
  if (f.options) {
    out.options = f.options.map((o): FieldOption => {
      const value = typeof o === 'string' ? o : o.value;
      const english = typeof o === 'string' ? o : o.label;
      const label = text({ path, prop: 'option', value, english });
      if (typeof o === 'string') return label === o ? o : { value: o, label };
      return label === o.label ? o : { ...o, label };
    });
  }
  if (f.fields) {
    out.fields = Object.fromEntries(Object.entries(f.fields).map(([k, sub]) => [k, localizeField(sub, `${path}.${k}`, text)]));
  }
  return out;
}

/**
 * A copy of `template` with its labels, descriptions, placeholders, option labels and group labels
 * from `fn` (`undefined` or an empty string keeps the English). Group labels are also the editor's
 * grouping key, so a translation that two groups of the template would share is not used for the
 * later one (it keeps its English) and the groups stay apart. Memoized per `fn` and template.
 */
export function localizeTemplate(template: SettingsTemplate, fn: TemplateTextFn): SettingsTemplate {
  let byTemplate = templateCache.get(fn);
  if (!byTemplate) { byTemplate = new WeakMap(); templateCache.set(fn, byTemplate); }
  const hit = byTemplate.get(template);
  if (hit) return hit;

  const templateId = template.id;
  const text = (ref: Omit<TemplateTextRef, 'templateId'>) => {
    const got = fn({ templateId, ...ref });
    return typeof got === 'string' && got.trim() ? got : ref.english;
  };
  const used = new Set<string>();
  const groups = template.groups.map((g) => {
    let label = text({ path: g.id, prop: 'group', english: g.label });
    if (used.has(label)) label = g.label;
    used.add(label);
    return label === g.label ? g : { ...g, label };
  });
  const fields: Record<string, TemplateField> = {};
  for (const [k, f] of Object.entries(template.fields)) fields[k] = localizeField(f, k, text);
  const out: SettingsTemplate = { ...template, label: text({ path: '', prop: 'label', english: template.label }), groups, fields };
  byTemplate.set(template, out);
  return out;
}

/** A copy of a widget type with its label, description, category and slot labels from `fn`. Memoized per `fn` and kind. */
export function localizeKind(kind: BuiltinKindSpec, fn: KindTextFn): BuiltinKindSpec {
  let byKind = kindCache.get(fn);
  if (!byKind) { byKind = new WeakMap(); kindCache.set(fn, byKind); }
  const hit = byKind.get(kind);
  if (hit) return hit;
  const text = (prop: 'label' | 'description' | 'category' | 'slot', english: string, key?: string) => {
    const got = fn({ type: kind.type, prop, english, ...(key !== undefined ? { key } : {}) });
    return typeof got === 'string' && got.trim() ? got : english;
  };
  const out: BuiltinKindSpec = {
    ...kind,
    label: text('label', kind.label),
    description: text('description', kind.description),
    category: text('category', kind.category),
    slots: kind.slots.map((s) => ({ ...s, label: text('slot', s.label, s.key) })),
  };
  byKind.set(kind, out);
  return out;
}
