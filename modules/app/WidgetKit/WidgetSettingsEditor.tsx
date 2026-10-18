'use client';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { TabGroup, type Tab } from '@/modules/ui/TabGroup';
import { SchemaForm } from '../SchemaForm/SchemaForm';
import type { FieldSchema } from '../SchemaForm/types';
import { effective, prune, readSettings, templateDefaults, visibleGroups, writeNamespace } from './settings/engine';
import type { EditorTab, Issue, SettingsTemplate, Sparse, TemplateId, WidgetCaps } from './settings/types';
import { useWidgetKit } from './WidgetKitContext';
import { useLocalSetting } from './useLocalSetting';

const MODE_KEY = 'kui.widgetSettings.mode';
const TAB_ORDER: EditorTab[] = ['Display', 'Data', 'Card', 'Actions', 'Look', 'Toolbar', 'Behaviour'];

export interface WidgetSettingsEditorProps {
  /** The templates of this widget: its type first, then core:card, core:format, extensions. */
  templates: SettingsTemplate[];
  /** The stored (sparse) settings object. */
  settings: Sparse;
  onChange: (next: Sparse) => void;
  /** Defaults below the placement, per template (board card defaults, the type's card/format defaults). */
  layers?: Partial<Record<TemplateId, Sparse>>;
  caps: WidgetCaps;
  /** Data slots that are bound (some groups only apply then, e.g. Comparison). */
  boundSlots?: string[];
  /** The placement title, edited above the tabs. Omit to hide the field. */
  title?: string;
  onTitleChange?: (title: string) => void;
  /** Host-owned tab content (data binding, actions…), shown before the template groups of that tab. */
  extraTabs?: Partial<Record<EditorTab, ReactNode>>;
  /** Messages from the server, by dotted path ('$card.padding', 'ranges.1.color'). */
  issues?: Issue[];
  className?: string;
}

/**
 * The settings editor of one widget (ThingsBoard-style): the title above, then tabs (Display, Data,
 * Card, Actions), each a set of collapsible groups. Basic mode hides advanced fields unless they
 * differ from their default. A part written by a newer template version opens read-only. A
 * deprecated field is hidden, unless it still holds a stored value: then it is shown read-only under
 * "No longer used", with the version that removes it and its replacement.
 */
export function WidgetSettingsEditor({
  templates, settings, onChange, layers = {}, caps, boundSlots = [], title, onTitleChange,
  extraTabs = {}, issues = [], className,
}: WidgetSettingsEditorProps) {
  const { fieldOverrides } = useWidgetKit();
  const [mode, setMode] = useLocalSetting(MODE_KEY);
  const advanced = mode === 'advanced';
  const toggleMode = () => setMode(advanced ? 'basic' : 'advanced');

  const read = useMemo(() => readSettings(settings, {
    type: templates[0], card: templates[1], format: templates[2], extensions: templates.slice(3),
  }), [settings, templates]);
  const newer = new Set(read.newer.map((n) => n.id));

  // One SchemaForm per (tab, template): a template's fields are split by the tab of their group.
  const tabContent = new Map<EditorTab, ReactNode[]>();
  for (const t of templates) {
    if (!t) continue;
    const groups = visibleGroups(t, caps, boundSlots);
    const groupById = new Map(t.groups.map((g) => [g.id, g]));
    const base = { ...templateDefaults(t), ...(layers[t.id] ?? {}) };
    const values = effective(t, layers[t.id], read.parts[t.id]);
    const prefix = t.namespace ? `${t.namespace}.` : '';
    const errors: Record<string, string> = {};
    for (const i of issues) if (i.path.startsWith(prefix)) errors[i.path.slice(prefix.length).split('.')[0]] ??= i.message;

    for (const tab of TAB_ORDER) {
      const schema: Record<string, FieldSchema> = {};
      // Deprecated fields are not edited; one that still holds a stored value is shown read-only.
      const retiring: Record<string, FieldSchema> = {};
      for (const [k, f] of Object.entries(t.fields)) {
        const g = f.group ? groupById.get(f.group) : undefined;
        const fieldTab = g?.tab ?? 'Display';
        if (fieldTab !== tab || (g && !groups.has(g.id))) continue;
        if (f.deprecated) {
          if (read.parts[t.id]?.[k] === undefined) continue;
          const by = f.deprecated.replacedBy;
          const note = `No longer used; removed in v${f.deprecated.removeIn}.${by ? ` Replaced by ${t.fields[by]?.label ?? by}.` : ''}`;
          retiring[k] = { ...f, group: undefined, description: f.description ? `${f.description} ${note}` : note };
        } else {
          schema[k] = { ...f, group: g?.label ?? f.group };
        }
      }
      if (!Object.keys(schema).length && !Object.keys(retiring).length) continue;
      const form = (
        <div key={`${t.id}-${tab}`} className="space-y-2">
          {newer.has(t.id) && (
            <p role="status" className="rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
              These settings were saved by a newer version of this widget. Editing is disabled until this app is updated.
            </p>
          )}
          {Object.keys(schema).length > 0 && (
            <SchemaForm
              schema={schema}
              values={values}
              defaults={base}
              readOnly={newer.has(t.id)}
              fieldOverrides={fieldOverrides}
              errors={errors}
              debounceMs={150}
              fieldFilter={advanced ? undefined : (_k, f, v, d) => !f.advanced || (v !== undefined && JSON.stringify(v) !== JSON.stringify(d))}
              onChange={(next) => onChange(writeNamespace(settings, t, prune(next, base)))}
            />
          )}
          {Object.keys(retiring).length > 0 && (
            <section aria-label="No longer used" className="space-y-2 rounded-md border border-dashed border-border px-3 py-2">
              <p className="text-xs font-medium text-text-secondary">No longer used</p>
              <SchemaForm schema={retiring} values={values} defaults={base} readOnly fieldOverrides={fieldOverrides} onChange={() => {}} />
            </section>
          )}
        </div>
      );
      tabContent.set(tab, [...(tabContent.get(tab) ?? []), form]);
    }
  }

  const tabs: Tab[] = TAB_ORDER
    .filter((tab) => tabContent.has(tab) || extraTabs[tab])
    .map((tab) => ({
      id: tab,
      label: tab,
      content: (
        <div className="space-y-4 pt-3">
          {extraTabs[tab]}
          {tabContent.get(tab)}
        </div>
      ),
    }));

  return (
    <div className={cn('space-y-3', className)}>
      {onTitleChange && (
        <div>
          <label htmlFor="wk-title" className="mb-1.5 block text-xs font-medium text-text-secondary">Title</label>
          <input id="wk-title" type="text" value={title ?? ''} maxLength={120} onChange={(e) => onTitleChange(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
        </div>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={toggleMode} aria-pressed={advanced}
          className="rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          {advanced ? 'Advanced settings: on' : 'Advanced settings: off'}
        </button>
      </div>
      {tabs.length > 0 ? <TabGroup tabs={tabs} label="Widget settings" /> : <p className="text-xs text-text-secondary">No settings.</p>}
    </div>
  );
}
