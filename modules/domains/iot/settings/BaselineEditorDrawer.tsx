'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Spinner } from '@/modules/ui/Spinner';
import { fill } from '../format';
import type { DeviceSettingsSchema, SettingsBaseline, SettingsModel, SettingsSchemaNode } from '../types/settings';
import type { SettingsMessagesInput } from './messages';
import type { SettingsFleetAdapter } from './settings-adapter';
import { errorText } from './SectionEditorDrawer';
import { issueMessages, SettingsForm } from './SettingsForm';
import { localized, validateValues } from './settings-schema';
import { useSettingsText } from './SettingsText';

export interface BaselineEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  adapter: SettingsFleetAdapter;
  /** The baseline to change; absent: a new one. */
  baseline?: SettingsBaseline | null;
  canManage: boolean;
  onSaved: (b: SettingsBaseline) => void;
  messages?: SettingsMessagesInput;
  locale?: string;
}

type Patches = Record<string, Record<string, unknown>>;

/**
 * BaselineEditorDrawer — a baseline: its name, the models it is for, and the part of each section it sets. The sections offered are those
 * of the newest settings list of the chosen models (schema forms restricted to the chosen models); a section one of them does not have
 * says so. Only what is included is part of the baseline (a JSON merge patch: everything else stays as each device has it); passwords,
 * keys and what only the device can change are never part of one. Mount it per baseline (`key`): it starts from the baseline it is given.
 */
export function BaselineEditorDrawer({ open, onClose, adapter, baseline, canManage, onSaved, messages, locale }: BaselineEditorDrawerProps) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const [models, setModels] = useState<SettingsModel[] | null>(null);
  const [schemas, setSchemas] = useState<Record<string, DeviceSettingsSchema>>({});
  const [name, setName] = useState(baseline?.name ?? '');
  const [description, setDescription] = useState(baseline?.description ?? '');
  const [chosen, setChosen] = useState<string[]>(baseline?.models ?? []);
  const [days, setDays] = useState(baseline?.offlineExpiryDays ?? 7);
  const [patches, setPatches] = useState<Patches>(() => structuredClone(baseline?.sections ?? {}));
  const [included, setIncluded] = useState<Record<string, Set<string>>>(() => Object.fromEntries(Object.entries(baseline?.sections ?? {}).map(([s, p]) => [s, new Set(Object.keys(p))])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; lines: string[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    adapter.models(ac.signal).then(setModels, (e) => { if (!ac.signal.aborted) setError({ text: errorText(m, e), lines: [] }); });
    return () => ac.abort();
  }, [open, adapter, m]);

  useEffect(() => {
    const missing = chosen.filter((mod) => !schemas[mod] && models?.some((x) => x.model === mod && x.manifest));
    if (!missing.length) return;
    const ac = new AbortController();
    Promise.all(missing.map((mod) => adapter.modelSchema(mod, ac.signal).then((s) => [mod, s] as const)))
      .then((pairs) => setSchemas((cur) => ({ ...cur, ...Object.fromEntries(pairs) })), (e) => { if (!ac.signal.aborted) setError({ text: errorText(m, e), lines: [] }); });
    return () => ac.abort();
  }, [chosen, models, schemas, adapter, m]);

  /** Each section of the chosen models: the schema it is edited with (the first model that has it) and the models without it. */
  const sections = useMemo(() => {
    const out = new Map<string, { schema: SettingsSchemaNode; title: string; missing: string[] }>();
    const loaded = chosen.filter((c) => schemas[c]);
    for (const mod of loaded) {
      for (const [id, sec] of Object.entries(schemas[mod].sections)) {
        if (!out.has(id)) out.set(id, { schema: sec.schema, title: localized(sec.title, lang) ?? id, missing: [] });
      }
    }
    for (const [id, v] of out) v.missing = loaded.filter((mod) => !schemas[mod].sections[id]);
    return [...out.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title));
  }, [chosen, schemas, lang]);

  const toggleSection = (id: string, on: boolean) => setIncluded((cur) => {
    const next = { ...cur };
    if (on) next[id] = next[id] ?? new Set();
    else delete next[id];
    return next;
  });
  const toggleKey = (id: string, key: string, on: boolean) => setIncluded((cur) => {
    const set = new Set(cur[id] ?? []);
    if (on) set.add(key);
    else set.delete(key);
    return { ...cur, [id]: set };
  });

  async function save() {
    const out: Patches = {};
    const issues: string[] = [];
    for (const [id, keys] of Object.entries(included)) {
      const sec = sections.find(([s]) => s === id)?.[1];
      const values = patches[id] ?? {};
      const part: Record<string, unknown> = {};
      for (const k of keys) {
        if (values[k] === undefined) continue;
        part[k] = values[k];
        const node = sec?.schema.properties?.[k];
        if (node) issues.push(...issueMessages(m, id, sec!.schema, validateValues(node, values[k], [k]), lang).lines);
      }
      if (Object.keys(part).length) out[id] = part;
    }
    if (issues.length) { setError({ text: m.editor.invalid, lines: issues }); return; }
    setBusy(true);
    setError(null);
    try {
      const input = { name: name.trim(), description: description.trim() || null, models: chosen, sections: out, driftPolicy: baseline?.driftPolicy ?? 'REPORT' as const, offlineExpiryDays: days };
      const saved = baseline ? await adapter.baselines.update(baseline.baselineId, input) : await adapter.baselines.create(input);
      onSaved(saved);
    } catch (e) {
      setError({ text: errorText(m, e), lines: [] });
    } finally {
      setBusy(false);
    }
  }

  const readOnly = !canManage;
  const valid = name.trim().length > 0 && chosen.length > 0;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={baseline ? baseline.name : m.fleet.newBaseline}
      closeLabel={m.common.close}
      className="w-full sm:max-w-2xl"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{readOnly ? m.common.close : m.common.cancel}</Button>
          {!readOnly && <Button onClick={() => void save()} loading={busy} disabled={busy || !valid}>{m.common.save}</Button>}
        </div>
      )}
    >
      <div className="space-y-4" data-baseline-editor="">
        {readOnly && <Callout variant="info">{m.fleet.canView}</Callout>}
        {error && (
          <Callout variant="danger" role="alert">
            <p>{error.text}</p>
            {error.lines.length > 0 && <ul className="mt-1 list-disc pl-5">{error.lines.slice(0, 20).map((l, i) => <li key={i}>{l}</li>)}</ul>}
          </Callout>
        )}
        <Input id="baseline-name" label={m.fleet.name} value={name} maxLength={80} required disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        <Input id="baseline-description" label={m.fleet.description} value={description} maxLength={500} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">{m.fleet.models}</legend>
          <p className="mb-2 text-xs text-text-secondary">{m.fleet.modelsHint}</p>
          {!models ? <Spinner size="sm" label={m.common.loading} /> : models.length === 0 ? <p className="text-sm text-text-secondary">{m.fleet.noModels}</p> : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {models.map((x) => (
                <label key={x.model} className="inline-flex min-h-11 items-center gap-2 text-sm text-text-primary sm:min-h-0">
                  <input type="checkbox" checked={chosen.includes(x.model)} disabled={readOnly || !x.manifest}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, x.model] : c.filter((v) => v !== x.model)))}
                    className="h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus" />
                  {x.model} <span className="text-text-secondary">{fill(m.fleet.modelDevices, { n: x.devices })}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <Input id="baseline-days" type="number" label={m.fleet.offlineDays} hint={m.fleet.offlineDaysHint} min={1} max={90} value={String(days)} disabled={readOnly}
          onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))} />
        <div className="space-y-3">
          <p className="text-sm font-medium text-text-primary">{m.fleet.sections}</p>
          <p className="text-xs text-text-secondary">{m.fleet.includeHint}</p>
          {chosen.length === 0 && <p className="text-sm text-text-secondary">{m.fleet.pickModels}</p>}
          {sections.map(([id, sec]) => {
            const on = !!included[id];
            return (
              <section key={id} className="rounded-lg border border-border p-3" data-baseline-section={id}>
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-text-primary sm:min-h-0">
                  <input type="checkbox" checked={on} disabled={readOnly} onChange={(e) => toggleSection(id, e.target.checked)}
                    className="h-4 w-4 rounded accent-primary focus-visible:ring-2 focus-visible:ring-border-focus" />
                  {sec.title}
                </label>
                {sec.missing.length > 0 && <p className="mt-1 text-xs text-warning-fg">{fill(m.fleet.sectionMissing, { models: sec.missing.join(', ') })}</p>}
                {on && (
                  <SettingsForm
                    className="mt-3"
                    section={id}
                    schema={sec.schema}
                    values={patches[id] ?? {}}
                    onChange={(v) => setPatches((p) => ({ ...p, [id]: v }))}
                    mode="baseline"
                    include={{ keys: included[id], onToggle: (k, v) => toggleKey(id, k, v) }}
                    readOnly={readOnly}
                    sections={patches}
                    messages={m}
                    locale={lang}
                  />
                )}
              </section>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
