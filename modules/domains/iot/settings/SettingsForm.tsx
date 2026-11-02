'use client';
import { createContext, useContext, useId, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { SchemaForm } from '@/modules/app/SchemaForm';
import type { FieldSchema } from '@/modules/app/SchemaForm/types';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableRowAction } from '@/modules/ui/Table/types';
import { fill } from '../format';
import type { SettingClass, SettingsSchemaNode } from '../types/settings';
import type { SettingsMessages, SettingsMessagesInput } from './messages';
import { ChoiceField, FixedField, ScalarListField } from './SettingsFields';
import { SecretField } from './SecretField';
import { fieldLabel, presetFor, valueLabel, type PresetContext } from './settings-presets';
import {
  annotationsOf, branchOf, classOf, defaultFor, discriminatorOf, FORMAT_EXAMPLES, isKeptSecret, localized, nodeKind, pathOf, pathText, schemaAt, schemaKey,
  validateValues, valueAt, type Path,
} from './settings-schema';
import { useSettingsText } from './SettingsText';

/**
 * SettingsForm — the generic editor of one settings section, drawn from the section's JSON Schema and its annotations (D64): plain fields
 * through the kui schema form (`SchemaForm`), write-only secrets (`SecretField`), values only the device can change shown read-only, a
 * choice that is a word or a number, lists of objects as a DataTable with sort and filters and a drawer per row, groups of settings as
 * one titled frame each (never an accordion), and a list whose entries come in kinds (a `oneOf` told apart by a constant) with the kind
 * picked first. A setting the viewer's role may not change is shown but locked. The firewall, Wi-Fi and LTE sections take their hints from
 * `settings-presets` (columns, ordered lists, zone and profile pickers, checkboxes, the internet warning); any other section a device
 * describes is drawn the same way with no code of its own.
 *
 * `mode="baseline"`: a partial set of values for many devices. Each top-level setting has an Include switch; secrets and values only the
 * device can change are left out.
 */
export interface SettingsFormProps {
  section: string;
  schema: SettingsSchemaNode;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** What the device reported for this section, for the values only the device can change. */
  reported?: Record<string, unknown> | null;
  /** The classes the viewer may change; absent: all of them. */
  classes?: ReadonlySet<SettingClass> | null;
  readOnly?: boolean;
  /** Messages by value path (`ssids.0.ssid`). */
  errors?: Record<string, string>;
  /** The other sections' values (the firewall's zones for a rule's zone picker, …). */
  sections?: PresetContext['sections'];
  mode?: 'device' | 'baseline';
  /** Baseline mode: which top-level settings are part of it. */
  include?: { keys: ReadonlySet<string>; onToggle: (key: string, on: boolean) => void };
  messages?: SettingsMessagesInput;
  locale?: string;
  className?: string;
}

interface FormCtx {
  section: string;
  root: SettingsSchemaNode;
  reported: Record<string, unknown> | null;
  classes: ReadonlySet<SettingClass> | null;
  readOnly: boolean;
  errors: Record<string, string>;
  preset: PresetContext;
  mode: 'device' | 'baseline';
  include?: SettingsFormProps['include'];
  m: SettingsMessages;
  locale?: string;
  idBase: string;
}

const Ctx = createContext<FormCtx | null>(null);
const useForm = (): FormCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error('settings form part outside <SettingsForm>');
  return c;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const idOf = (base: string, path: Path) => `${base}-${pathText(path).replace(/[^a-zA-Z0-9_-]/g, '_') || 'root'}`;

export function SettingsForm({
  section, schema, values, onChange, reported = null, classes = null, readOnly = false, errors = {}, sections = {}, mode = 'device', include,
  messages, locale, className,
}: SettingsFormProps) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const idBase = useId().replace(/:/g, '');
  const ctx = useMemo<FormCtx>(() => ({
    section, root: schema, reported, classes, readOnly, errors, mode, include, m, locale: lang, idBase,
    preset: { sections: { ...sections, [section]: values }, m, locale: lang },
  }), [section, schema, reported, classes, readOnly, errors, mode, include, m, lang, idBase, sections, values]);
  return (
    <Ctx.Provider value={ctx}>
      <div className={cn('min-w-0 space-y-4', className)} data-settings-form={section}>
        {mode === 'baseline' && hasSecretsOrFixed(schema) && <p className="text-xs text-text-secondary">{m.fleet.noSecrets}</p>}
        <ObjectFields node={schema} value={values} onChange={onChange} path={[]} inherited={classOf(schema)} />
      </div>
    </Ctx.Provider>
  );
}

function hasSecretsOrFixed(node: SettingsSchemaNode): boolean {
  const a = annotationsOf(node);
  if (a.sensitive || a.remote === false) return true;
  return Object.values(node.properties ?? {}).some(hasSecretsOrFixed) || (!!node.items && hasSecretsOrFixed(node.items)) || (node.oneOf ?? []).some(hasSecretsOrFixed);
}

/** The localized description, and why a locked setting is locked. */
function describe(c: FormCtx, node: SettingsSchemaNode, locked: boolean): string | undefined {
  const d = localized(node.description, c.locale);
  return locked && !c.readOnly ? [d, c.m.editor.locked].filter(Boolean).join(' ') : d;
}

function ObjectFields({ node, value, onChange, path, inherited }: {
  node: SettingsSchemaNode;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  path: Path;
  inherited: SettingClass;
}) {
  const c = useForm();
  const preset = presetFor(c.section);
  const set = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  const top = path.length === 0 && c.mode === 'baseline' && !!c.include;
  const parts: React.ReactNode[] = [];
  let run: Array<[string, SettingsSchemaNode, boolean]> = [];
  const flush = () => {
    if (!run.length) return;
    const entries = run;
    run = [];
    parts.push(<ScalarRun key={`run-${entries[0][0]}`} entries={entries} node={node} value={value} onChange={onChange} path={path} />);
  };
  for (const [key, prop] of Object.entries(node.properties ?? {})) {
    if (prop.const !== undefined) continue;
    const childPath = [...path, key];
    const sk = schemaKey(childPath);
    const hint = preset.fields?.[sk];
    if (hint?.visible && !hint.visible(value)) continue;
    const kind = nodeKind(prop);
    if (c.mode === 'baseline' && (kind === 'secret' || kind === 'fixed')) continue;
    const cls = classOf(prop, inherited);
    const locked = c.readOnly || (!!c.classes && !c.classes.has(cls));
    if (!top && kind === 'scalar' && !hint?.widget) {
      if (run.length && run[run.length - 1][2] !== locked) flush();
      run.push([key, prop, locked]);
      continue;
    }
    flush();
    const control = kind === 'scalar' && !hint?.widget
      ? <ScalarRun entries={[[key, prop, locked]]} node={node} value={value} onChange={onChange} path={path} />
      : <Control name={key} node={prop} parent={node} value={value[key]} siblings={value} onChange={(v) => set(key, v)} path={childPath} cls={cls} locked={locked} />;
    if (top) {
      const on = c.include!.keys.has(key);
      const label = fieldLabel(c.m, c.section, sk, key, prop, c.locale);
      parts.push(
        <div key={key} className={cn('rounded-lg border p-3', on ? 'border-primary' : 'border-border')} data-include={on ? 'on' : 'off'}>
          <label className="mb-2 flex min-h-11 items-center gap-2 text-sm font-medium text-text-primary sm:min-h-0">
            <input type="checkbox" checked={on} disabled={c.readOnly} onChange={(e) => c.include!.onToggle(key, e.target.checked)}
              className="h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus" />
            {c.m.fleet.partialField}: {label}
          </label>
          {on && control}
        </div>,
      );
    } else parts.push(<div key={key}>{control}</div>);
  }
  flush();
  return <div className="space-y-4">{parts}</div>;
}

/** Consecutive plain settings of one object, as one schema form (locked ones as a read-only form of their own). */
function ScalarRun({ entries, node, value, onChange, path }: {
  entries: Array<[string, SettingsSchemaNode, boolean]>;
  node: SettingsSchemaNode;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  path: Path;
}) {
  const c = useForm();
  const preset = presetFor(c.section);
  const locked = entries[0][2];
  const required = new Set(node.required ?? []);
  const schema: Record<string, FieldSchema> = {};
  const values: Record<string, unknown> = {};
  const errors: Record<string, string | undefined> = {};
  const numericSelect = new Set<string>();
  for (const [key, prop] of entries) {
    const childPath = [...path, key];
    const sk = schemaKey(childPath);
    const label = fieldLabel(c.m, c.section, sk, key, prop, c.locale);
    const base = { label, description: describe(c, prop, locked), required: required.has(key) || undefined };
    const hinted = preset.fields?.[sk]?.options?.(c.preset, value);
    const current = value[key];
    const choices = hinted ? [...new Set([...hinted, ...(typeof current === 'string' && current ? [current] : [])])] : Array.isArray(prop.enum) ? prop.enum : null;
    if (choices) {
      if (choices.some((x) => typeof x === 'number')) numericSelect.add(key);
      schema[key] = { ...base, type: 'select', options: choices.map((v) => ({ value: String(v), label: valueLabel(c.m, c.section, sk, v) })) };
    } else if (prop.type === 'boolean') schema[key] = { ...base, type: 'boolean', placeholder: c.m.common.yes };
    else if (prop.type === 'integer' || prop.type === 'number') {
      schema[key] = { ...base, type: 'number', min: prop.minimum, max: prop.maximum, step: prop.type === 'integer' ? 1 : undefined, placeholder: prop.format ? FORMAT_EXAMPLES[prop.format] : undefined };
    } else if (prop.type === 'string') {
      schema[key] = { ...base, type: prop.format === 'textarea' ? 'textarea' : 'text', maxLength: prop.maxLength, placeholder: prop.format ? FORMAT_EXAMPLES[prop.format] : undefined };
    } else schema[key] = { ...base, type: 'json' };
    if (current !== undefined) values[key] = choices ? String(current) : current;
    const err = c.errors[pathText(childPath)];
    if (err) errors[key] = err;
  }
  return (
    <SchemaForm
      schema={schema}
      values={values}
      errors={errors}
      debounceMs={0}
      readOnly={locked}
      onChange={(next) => {
        const out = { ...value };
        for (const [key, prop] of entries) {
          let v = next[key];
          if (numericSelect.has(key) && typeof v === 'string' && v !== '') v = Number(v);
          if (v === '' && schema[key].type === 'select') v = undefined;
          if (v === undefined) delete out[key];
          else out[key] = v;
          void prop;
        }
        onChange(out);
      }}
    />
  );
}

/** One setting that is not a plain field. */
function Control({ name, node, parent, value, siblings, onChange, path, cls, locked }: {
  name: string;
  node: SettingsSchemaNode;
  parent: SettingsSchemaNode;
  value: unknown;
  siblings: Record<string, unknown>;
  onChange: (next: unknown) => void;
  path: Path;
  cls: SettingClass;
  locked: boolean;
}) {
  const c = useForm();
  const sk = schemaKey(path);
  const id = idOf(c.idBase, path);
  const label = fieldLabel(c.m, c.section, sk, name, node, c.locale);
  const required = (parent.required ?? []).includes(name);
  const error = c.errors[pathText(path)];
  const description = describe(c, node, locked);
  const text = (v: unknown) => (typeof v === 'boolean' ? (v ? c.m.common.yes : c.m.common.no) : valueLabel(c.m, c.section, sk, v));
  const hint = presetFor(c.section).fields?.[sk];
  void siblings;
  switch (nodeKind(node)) {
    case 'secret':
      return <SecretField id={id} label={label} value={value} onChange={onChange} disabled={locked} required={required} minLength={node.minLength} maxLength={node.maxLength} error={error} description={description} messages={c.m} />;
    case 'fixed':
      return <FixedField id={id} label={label} value={valueAt(c.reported, path)} valueText={text} m={c.m} />;
    case 'choice':
      return <ChoiceField id={id} label={label} node={node} value={value} onChange={onChange} disabled={locked} required={required} error={error} description={description} valueText={text} m={c.m} />;
    case 'scalar-list':
      return <ScalarListField id={id} label={label} node={node} value={value} onChange={onChange} disabled={locked} error={error} description={description} valueText={text} checkboxes={hint?.widget === 'checkboxes'} />;
    case 'object':
      return (
        <fieldset className="min-w-0 rounded-lg border border-border p-3" data-group={sk}>
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</legend>
          {description && <p className="mb-3 text-xs text-text-secondary">{description}</p>}
          <ObjectFields node={node} value={isObj(value) ? value : {}} onChange={onChange} path={path} inherited={cls} />
        </fieldset>
      );
    case 'variant':
      return <VariantFields label={label} node={node} value={value} onChange={onChange} path={path} cls={cls} locked={locked} />;
    case 'object-list':
      return <ListTable label={label} node={node} rows={Array.isArray(value) ? value : []} onChange={onChange} path={path} cls={cls} locked={locked} description={description} error={error} />;
    default:
      return (
        <SchemaForm schema={{ [name]: { label, type: 'json', description } }} values={value === undefined ? {} : { [name]: value }} debounceMs={0} readOnly={locked}
          errors={error ? { [name]: error } : {}} onChange={(next) => onChange(next[name])} />
      );
  }
}

/** An object that comes in kinds: the kind first (its constant), then the fields of that kind. */
function VariantFields({ label, node, value, onChange, path, cls, locked }: {
  label: string;
  node: SettingsSchemaNode;
  value: unknown;
  onChange: (next: unknown) => void;
  path: Path;
  cls: SettingClass;
  locked: boolean;
}) {
  const c = useForm();
  const id = idOf(c.idBase, [...path, 'kind']);
  const d = discriminatorOf(node);
  const branch = branchOf(node, value);
  const obj = isObj(value) ? value : {};
  const kindLabel = (b: SettingsSchemaNode) => localized(b.title, c.locale) ?? (d ? valueLabel(c.m, c.section, schemaKey([...path, d]), b.properties?.[d]?.const) : '');
  return (
    <div className="space-y-4" data-variant={schemaKey(path)}>
      {d && (
        <div>
          <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-text-secondary">{fieldLabel(c.m, c.section, schemaKey([...path, d]), d, undefined, c.locale)}</label>
          <select id={id} value={String(branch?.properties?.[d]?.const ?? '')} disabled={locked}
            onChange={(e) => {
              const next = (node.oneOf ?? []).find((b) => String(b.properties?.[d]?.const) === e.target.value);
              if (next) onChange(defaultFor(next));
            }}
            className="block w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            {(node.oneOf ?? []).map((b, i) => <option key={i} value={String(b.properties?.[d]?.const ?? '')}>{kindLabel(b) || label}</option>)}
          </select>
        </div>
      )}
      {branch && <ObjectFields node={branch} value={obj} onChange={onChange} path={path} inherited={classOf(branch, cls)} />}
    </div>
  );
}

type Row = Record<string, unknown> & { __i: number };

/** A new entry of a list: the schema's defaults, and the first choice of a required choice (what the form shows is what is saved). */
function newEntry(item: SettingsSchemaNode): Record<string, unknown> {
  const out = (isObj(defaultFor(item)) ? defaultFor(item) : {}) as Record<string, unknown>;
  const node = item.oneOf ? branchOf(item, out) ?? item : item;
  for (const r of node.required ?? []) {
    const p = node.properties?.[r];
    if (out[r] === undefined && p && Array.isArray(p.enum) && p.enum.length) out[r] = p.enum[0];
  }
  return out;
}

/** A list of objects: a DataTable (sort, filters, search), a drawer per entry, Add, Remove through the ConfirmDialog, and Move up / down when order matters. */
function ListTable({ label, node, rows, onChange, path, cls, locked, description, error }: {
  label: string;
  node: SettingsSchemaNode;
  rows: unknown[];
  onChange: (next: unknown) => void;
  path: Path;
  cls: SettingClass;
  locked: boolean;
  description?: string;
  error?: string;
}) {
  const c = useForm();
  const sk = schemaKey(path);
  const item = node.items ?? {};
  const list = presetFor(c.section).lists?.[sk];
  const [editing, setEditing] = useState<{ index: number | null; draft: Record<string, unknown> } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const itemProps = item.properties ?? Object.assign({}, ...(item.oneOf ?? []).map((b) => b.properties ?? {})) as Record<string, SettingsSchemaNode>;
  const scalarKeys = Object.entries(itemProps).filter(([, p]) => ['scalar', 'choice', 'secret'].includes(nodeKind(p))).map(([k]) => k);
  const columnsWanted = (list?.columns ?? scalarKeys.filter((k) => nodeKind(itemProps[k]) !== 'secret').slice(0, 4)).filter((k) => itemProps[k]);
  const full = node.maxItems !== undefined && rows.length >= node.maxItems;
  const nameOf = (r: unknown, i: number) => {
    const o = isObj(r) ? r : {};
    const first = columnsWanted.map((k) => o[k]).find((v) => typeof v === 'string' && v);
    return typeof o.name === 'string' && o.name ? o.name : typeof first === 'string' ? first : fill(c.m.common.item, { n: i + 1 });
  };
  const cell = (k: string, v: unknown) => {
    const p = itemProps[k];
    if (p && nodeKind(p) === 'secret') return isKeptSecret(v) || (typeof v === 'string' && v) ? c.m.secret.set : c.m.secret.notSet;
    if (v === undefined || v === null || v === '') return c.m.common.none;
    if (typeof v === 'boolean') return v ? c.m.common.yes : c.m.common.no;
    if (Array.isArray(v)) return v.map((x) => valueLabel(c.m, c.section, `${sk}.${k}`, x)).join(', ');
    return valueLabel(c.m, c.section, `${sk}.${k}`, v);
  };
  const data: Row[] = rows.map((r, i) => {
    const o = isObj(r) ? r : {};
    const out: Row = { __i: i };
    for (const k of columnsWanted) out[k] = o[k] === undefined ? '' : typeof o[k] === 'number' ? o[k] : String(o[k]);
    out.__warn = list?.warning ? list.warning(o, c.preset) : null;
    return out;
  });
  const columns: Column<Row>[] = [
    ...(list?.ordered ? [{ key: '__i', header: c.m.list.position, sortable: true, width: '3rem', render: (r: Row) => String(r.__i + 1) } as Column<Row>] : []),
    ...columnsWanted.map((k): Column<Row> => ({
      key: k,
      header: fieldLabel(c.m, c.section, `${sk}.${k}`, k, itemProps[k], c.locale),
      sortable: true,
      render: (r) => cell(k, (isObj(rows[r.__i]) ? (rows[r.__i] as Record<string, unknown>) : {})[k]),
    })),
    ...(list?.warning ? [{
      key: '__warn',
      header: c.m.list.warning,
      render: (r: Row) => (r.__warn ? <Badge size="sm" variant="warning"><FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" aria-hidden="true" />{c.m.wan.badge}</Badge> : null),
    } as Column<Row>] : []),
  ];
  const filterFields: DataTableFilterField<Row>[] = columnsWanted.flatMap((k): DataTableFilterField<Row>[] => {
    const p = itemProps[k];
    const lab = fieldLabel(c.m, c.section, `${sk}.${k}`, k, p, c.locale);
    if (p?.type === 'boolean') return [{ id: k, label: lab, type: 'select', options: [{ value: 'true', label: c.m.common.yes }, { value: 'false', label: c.m.common.no }] }];
    if (Array.isArray(p?.enum)) return [{ id: k, label: lab, type: 'select', options: p.enum.map((v) => ({ value: String(v), label: valueLabel(c.m, c.section, `${sk}.${k}`, v) })) }];
    return [];
  });
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const actions: DataTableRowAction<Row>[] = [
    { id: 'edit', label: locked ? c.m.tab.open : c.m.common.edit, onClick: (r) => open(r.__i) },
    ...(list?.ordered && !locked ? [
      { id: 'up', label: c.m.common.moveUp, onClick: (r: Row) => move(r.__i, -1), disabled: (r: Row) => r.__i === 0, group: 'order' },
      { id: 'down', label: c.m.common.moveDown, onClick: (r: Row) => move(r.__i, 1), disabled: (r: Row) => r.__i === rows.length - 1, group: 'order' },
    ] : []),
    ...(!locked ? [{ id: 'remove', label: c.m.common.remove, destructive: true, onClick: (r: Row) => setRemoving(r.__i), group: 'remove' }] : []),
  ];
  function open(index: number | null) {
    setDraftErrors({});
    setEditing({ index, draft: index === null ? newEntry(item) : structuredClone((isObj(rows[index]) ? rows[index] : {}) as Record<string, unknown>) });
  }
  function commit() {
    if (!editing) return;
    let draft = editing.draft;
    if (list?.derive) draft = list.derive(draft, c.preset, item.oneOf ? branchOf(item, draft) ?? item : item);
    const at = editing.index ?? rows.length;
    const issues = validateValues(item, draft, []);
    if (issues.length) {
      const full = issues.map((i) => ({ ...i, path: pathText([...path, at, ...pathOf(i.path)]) }));
      setDraftErrors(issueMessages(c.m, c.section, c.root, full, c.locale).byPath);
      return;
    }
    const next = [...rows];
    if (editing.index === null) next.push(draft);
    else next[editing.index] = draft;
    onChange(next);
    setEditing(null);
  }
  const drawerWarning = editing && list?.warning ? list.warning(editing.draft, c.preset) : null;
  const draftCtx = useMemo<FormCtx>(() => ({ ...c, errors: { ...c.errors, ...draftErrors }, readOnly: locked }), [c, draftErrors, locked]);
  const editingPath = editing ? [...path, editing.index ?? rows.length] : path;
  return (
    <div data-list={sk} className="min-w-0">
      {description && <p className="mb-2 text-xs text-text-secondary">{description}</p>}
      <DataTable<Row>
        columns={columns}
        rows={data}
        mode="static"
        variant="plain"
        title={label}
        caption={label}
        searchable={data.length > 5}
        filterFields={filterFields.length ? filterFields : undefined}
        rowId={(r) => String(r.__i)}
        onRowClick={(r) => open(r.__i)}
        rowActions={actions}
        emptyMessage={c.m.list.empty}
        pageSize={25}
        headerActions={!locked && (
          <Button size="sm" variant="outline" onClick={() => open(null)} disabled={full} title={full ? fill(c.m.list.full, { max: node.maxItems ?? 0 }) : undefined}>
            <FontAwesomeIcon icon={faPlus} className="mr-1.5" aria-hidden="true" />{c.m.list.add}
          </Button>
        )}
      />
      {full && !locked && <p className="mt-1 text-xs text-text-secondary">{fill(c.m.list.full, { max: node.maxItems ?? 0 })}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-error">{error}</p>}
      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.index === null || !editing ? fill(c.m.list.addTitle, { list: label }) : fill(c.m.list.editTitle, { list: label, name: nameOf(rows[editing.index], editing.index) })}
        closeLabel={c.m.common.close}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>{locked ? c.m.common.close : c.m.common.cancel}</Button>
            {!locked && <Button onClick={commit}>{c.m.common.done}</Button>}
          </div>
        )}
      >
        {editing && (
          <Ctx.Provider value={draftCtx}>
            <div className="space-y-4">
              {drawerWarning && <Callout variant="warning" title={c.m.wan.badge}>{drawerWarning} {c.m.wan.note}</Callout>}
              {item.oneOf && !item.properties
                ? <VariantFields label={label} node={item} value={editing.draft} onChange={(v) => setEditing({ ...editing, draft: v as Record<string, unknown> })} path={editingPath} cls={cls} locked={locked} />
                : <ObjectFields node={item} value={editing.draft} onChange={(v) => setEditing({ ...editing, draft: v })} path={editingPath} inherited={classOf(item, cls)} />}
            </div>
          </Ctx.Provider>
        )}
      </Drawer>
      <ConfirmDialog
        open={removing !== null}
        tone="danger"
        title={c.m.list.removeTitle}
        message={removing !== null ? fill(c.m.list.removeMessage, { name: nameOf(rows[removing], removing) }) : undefined}
        confirmLabel={c.m.common.remove}
        cancelLabel={c.m.common.cancel}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing !== null) onChange(rows.filter((_, i) => i !== removing));
          setRemoving(null);
        }}
      />
    </div>
  );
}

/** Turns issues of the whole section (client check or the server's `invalid_values`) into messages by value path, and a list in words. */
export function issueMessages(
  m: SettingsMessages, section: string, schema: SettingsSchemaNode, issues: Array<{ path: string; code: string; limit?: number | string }>, locale?: string,
): { byPath: Record<string, string>; lines: string[] } {
  const byPath: Record<string, string> = {};
  const lines: string[] = [];
  const LIMIT_OF: Record<string, keyof SettingsSchemaNode> = {
    minimum: 'minimum', maximum: 'maximum', minLength: 'minLength', maxLength: 'maxLength', maxItems: 'maxItems', minItems: 'minItems', format: 'format',
  };
  for (const i of issues) {
    const label = pathLabel(m, section, schema, i.path, locale);
    // the server names the rule, not its bound: the bound is the manifest's
    const limit = i.limit ?? (LIMIT_OF[i.code] ? schemaAt(schema, pathOf(i.path))?.[LIMIT_OF[i.code]] as number | string | undefined : undefined);
    const template = (m.issues as Record<string, string>)[i.code] ?? m.issues.other;
    const text = fill(limit === undefined && template.includes('{limit}') ? m.issues.notAccepted : template, { field: label, limit: limit ?? '', code: i.code });
    byPath[i.path] ??= text;
    lines.push(text);
  }
  return { byPath, lines };
}

/** A value path in words: "Wi-Fi networks › 2 › Network name". */
export function pathLabel(m: SettingsMessages, section: string, schema: SettingsSchemaNode, raw: string, locale?: string): string {
  const segs = raw.split('.').filter((s) => s !== '');
  const words: string[] = [];
  let node: SettingsSchemaNode | undefined = schema;
  const keys: string[] = [];
  for (const seg of segs) {
    if (/^\d+$/.test(seg)) { words.push(String(Number(seg) + 1)); node = node?.items ?? node?.oneOf?.[0]?.items; continue; }
    keys.push(seg);
    const props: Record<string, SettingsSchemaNode> | undefined = node?.properties ?? (node?.oneOf ? Object.assign({}, ...node.oneOf.map((b) => b.properties ?? {})) : undefined);
    node = props?.[seg];
    words.push(fieldLabel(m, section, keys.join('.'), seg, node, locale));
  }
  return words.join(' › ') || section;
}
