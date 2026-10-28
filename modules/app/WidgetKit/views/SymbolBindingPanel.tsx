'use client';
// The symbol binding panel (next-boilerplate phase 45.4, D45-10): a click on a symbol of a drawing opens this for THAT symbol
// only. Pick the device, pick which of its values feeds each thing the symbol draws, convert it with a one-liner when it needs
// flipping or scaling, see the result live, save, and go to the next symbol. One column that fits a 360 px side panel. It is a
// plain section the HOST places in its side drawer (no Drawer here), and it speaks of the symbol, the device and its values:
// no scene key, slot, kind, role or match is ever drawn.
//
// The kit fetches nothing. The HOST passes the symbol (its fields and what they read now), the device search, the values of a
// device (`loadKeys`, asked again every `refreshMs` so the list is live), the sandbox that previews a one-liner
// (`previewScript`, the phase 35 runner; in a test a stub) and answers `onSave` with the entry. Everything decided here (the
// proposed key, the draft, the entry, the age, the templates) is `symbol-binding-logic.ts`, pure and tested on its own.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faEllipsis, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { AlertBanner } from '@/modules/ui/AlertBanner';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { ComboBox } from '@/modules/ui/ComboBox';
import type { ComboBoxOption } from '@/modules/ui/ComboBox';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DropdownMenu, type DropdownItem } from '@/modules/ui/DropdownMenu';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { useNow } from '../useNow';
import {
  ageText, draftFromSymbol, entryFromDraft, entryFromSymbol, formatValue, hasOwnEntry, isDirty, previewLine, scriptTemplates,
  suggestKeysForFields, MAX_SCRIPT_LENGTH,
  type BindingDraft, type BindingEntry, type DeviceKey, type DeviceOption, type FieldDraft, type ScriptOutcome, type SymbolSpec,
} from './symbol-binding-logic';
import { DEFAULT_SYMBOL_BINDING_MESSAGES, mergeMessages, type DeepPartial, type SymbolBindingMessages } from './symbol-binding-messages';

/** The symbol the panel is about: `SymbolSpec` with the icon the host draws for it. */
export interface SymbolBindingSymbol extends SymbolSpec {
  /** The symbol's own picture (a small SVG, an icon). Decorative. */
  icon?: ReactNode;
}

/** An action the host adds to the panel's "…" menu (the bulk shortcuts: "bind every symbol to this device"). */
export interface SymbolBindingMenuAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface SymbolBindingPanelProps {
  symbol: SymbolBindingSymbol;
  /** The tenant's devices matching `query` (the empty query: the ones to offer first). Called debounced, so a host may fetch. */
  searchDevices: (query: string) => Promise<DeviceOption[]>;
  /** The latest values of a device, newest known. Called when a device is picked and again every `refreshMs`. */
  loadKeys: (deviceId: string) => Promise<DeviceKey[]>;
  /**
   * Writes the entry. Resolve to say it is saved; reject, or resolve `false`, to say it is not (the host shows `error`, the panel
   * stays on its changes). An entry with no fields means "this symbol reads nothing".
   */
  onSave: (entry: BindingEntry) => void | boolean | Promise<void | boolean>;
  /** Next symbol: called after the changes are saved (when there are any). The host chooses the symbol (`nextUnbound` helps). */
  onNext?: () => void;
  onClose: () => void;
  /** Clear from the "…" menu. Without it the panel saves an entry with no fields. */
  onClear?: () => void | boolean | Promise<void | boolean>;
  /** Runs a one-liner on a sample in the phase 35 sandbox. Without it the preview line stays empty. */
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  /** The host is writing: Save and Next symbol wait. */
  saving?: boolean;
  /** The text of the last failed save. */
  error?: string;
  /** Look, do not change: every control is off and there is no Save. */
  readOnly?: boolean;
  /** The host's own entries of the "…" menu, above Clear. */
  menuActions?: readonly SymbolBindingMenuAction[];
  /** The device a symbol with none starts on (the one the last symbol used); the panel remembers its own saves too. */
  defaultDevice?: { id: string; name: string } | null;
  /** How often the values are asked again, in ms; 0 asks once. Default 5000. */
  refreshMs?: number;
  /** The time the ages are counted from (ms); default the clock. */
  now?: number;
  messages?: DeepPartial<SymbolBindingMessages>;
  /** Where the confirmations mount (a fullscreen element); default the kit's. */
  portalTarget?: Element | string | null;
  className?: string;
}

const SEARCH_ROWS = 100;
const KEY_ROWS = 100;
const PREVIEW_DEBOUNCE_MS = 250;

export function SymbolBindingPanel(props: SymbolBindingPanelProps) {
  // The device last saved is the proposal for the next symbol that reads nothing; it outlives one symbol's form.
  const [last, setLast] = useState<{ id: string; name: string } | null>(null);
  // One form per symbol: moving to the next symbol starts its draft over.
  return <SymbolForm key={props.symbol.id} {...props} last={last} onRemember={setLast} />;
}

type KeysState = { deviceId: string; status: 'ready' | 'error'; keys: DeviceKey[] };

function SymbolForm(props: SymbolBindingPanelProps & { last: { id: string; name: string } | null; onRemember: (d: { id: string; name: string }) => void }) {
  const { symbol, readOnly = false, saving = false, refreshMs = 5000, last, onRemember } = props;
  const m = useMemo(() => mergeMessages<SymbolBindingMessages>(DEFAULT_SYMBOL_BINDING_MESSAGES, props.messages), [props.messages]);
  const uid = useId();
  const tick = useNow(5000);
  const now = props.now ?? tick;

  // The latest callbacks, so a host's inline functions never restart the loading of the values.
  const loadKeysRef = useRef(props.loadKeys);
  const searchRef = useRef(props.searchDevices);
  useEffect(() => {
    loadKeysRef.current = props.loadKeys;
    searchRef.current = props.searchDevices;
  });

  // ─── Draft and baseline ────────────────────────────────────────────────────
  const symbolEntry = useMemo(() => entryFromSymbol(symbol), [symbol]);
  const symbolSig = JSON.stringify(symbolEntry);
  const [draft, setDraft] = useState<BindingDraft>(() => draftFromSymbol(symbol, props.defaultDevice ?? last));
  const [baseline, setBaseline] = useState<BindingEntry>(symbolEntry);
  // The host answered with a changed symbol (a save came back): what it says is the new baseline.
  const [seenSig, setSeenSig] = useState(symbolSig);
  if (seenSig !== symbolSig) {
    setSeenSig(symbolSig);
    // With nothing unsaved the fields follow what the host now says (a save or a clear came back: a field that is no longer
    // automatic, or is again, shows so). The device the person is on stays.
    if (!isDirty(draft, baseline)) setDraft({ ...draftFromSymbol(symbol, null), deviceId: draft.deviceId, deviceName: draft.deviceName });
    setBaseline(symbolEntry);
  }
  const [suggested, setSuggested] = useState<ReadonlySet<string>>(new Set());
  const dirty = isDirty(draft, baseline);
  // Clear has something to clear when the symbol has settings of its own (an automatic source is not a setting).
  const bound = hasOwnEntry(symbol) || Object.keys(baseline.fields).length > 0;

  // ─── The device ────────────────────────────────────────────────────────────
  const known = useRef(new Map<string, DeviceOption>());
  const deviceOptions = useMemo<ComboBoxOption[]>(
    () => (draft.deviceId ? [{ value: draft.deviceId, label: draft.deviceName || draft.deviceId }] : []),
    [draft.deviceId, draft.deviceName],
  );
  const searchDevices = useCallback(async (query: string): Promise<ComboBoxOption[]> => {
    try {
      const found = (await searchRef.current(query)).slice(0, SEARCH_ROWS);
      for (const d of found) known.current.set(d.id, d);
      return found.map((d) => ({
        value: d.id,
        label: d.name,
        description: [d.code, d.hint].filter((s): s is string => !!s).join(' · ') || undefined,
      }));
    } catch {
      return [];
    }
  }, []);

  function pickDevice(id: string) {
    if (!id || id === draft.deviceId) return;
    const picked = known.current.get(id);
    setDraft((d) => {
      const fields: Record<string, FieldDraft> = {};
      for (const [name, f] of Object.entries(d.fields)) {
        // A field that read the old device has nothing to read on the new one until a key is picked; another device's field stays.
        const oldOnes = f.deviceId === '' || f.deviceId === d.deviceId;
        fields[name] = oldOnes ? { ...f, deviceId: '', deviceName: '', key: '', label: '', script: f.script, automatic: false } : f;
      }
      return { deviceId: id, deviceName: picked?.name ?? '', fields };
    });
    setSuggested(new Set());
    setSuggestedFor('');
  }

  // ─── The values of the device, live ────────────────────────────────────────
  const [keysState, setKeysState] = useState<KeysState | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const deviceId = draft.deviceId;
    if (!deviceId) return undefined;
    let cancelled = false;
    let seen = false;
    const run = async () => {
      try {
        const keys = await loadKeysRef.current(deviceId);
        if (cancelled) return;
        seen = true;
        setKeysState({ deviceId, status: 'ready', keys });
      } catch {
        // A refresh that fails keeps the last list; only the first answer can be an error.
        if (!cancelled && !seen) setKeysState({ deviceId, status: 'error', keys: [] });
      }
    };
    void run();
    const timer = refreshMs > 0
      ? setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void run();
      }, refreshMs)
      : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [draft.deviceId, refreshMs, retry]);

  const onThisDevice = keysState !== null && keysState.deviceId === draft.deviceId;
  const keysStatus: 'idle' | 'loading' | 'ready' | 'error' = !draft.deviceId ? 'idle' : !onThisDevice ? 'loading' : keysState.status;
  const keys = useMemo<DeviceKey[]>(() => (onThisDevice ? keysState.keys : []), [onThisDevice, keysState]);
  const keyByName = useMemo(() => new Map(keys.map((k) => [k.key, k])), [keys]);

  // ─── Proposing a key for each empty field, once per device (adjusted while rendering, not in an effect) ───
  const [suggestedFor, setSuggestedFor] = useState('');
  if (!readOnly && keysStatus === 'ready' && suggestedFor !== draft.deviceId) {
    setSuggestedFor(draft.deviceId);
    const empty = symbol.fields.filter((f) => draft.fields[f.name] && draft.fields[f.name].key === '');
    const taken = Object.values(draft.fields).filter((f) => f.key !== '' && (f.deviceId === '' || f.deviceId === draft.deviceId)).map((f) => f.key);
    const picks = suggestKeysForFields(empty, keys, symbol.id, taken);
    const names = Object.keys(picks);
    if (names.length > 0) {
      const fields = { ...draft.fields };
      for (const name of names) {
        fields[name] = { ...fields[name], deviceId: draft.deviceId, deviceName: draft.deviceName, key: picks[name], label: labelOfKey(keyByName.get(picks[name])), automatic: false };
      }
      setDraft({ ...draft, fields });
      setSuggested(new Set(names));
    }
  }

  function pickKey(name: string, key: string) {
    setSuggested((s) => {
      if (!s.has(name)) return s;
      const next = new Set(s);
      next.delete(name);
      return next;
    });
    setDraft((d) => {
      const f = d.fields[name];
      if (!f) return d;
      // "Not used" on a field the drawing fills automatically, still on that device, goes back to the automatic source: an entry
      // cannot switch the automatic match off, so the picker must not pretend it did.
      const auto = symbol.fields.find((sf) => sf.name === name)?.currentSource;
      const backToAuto = key === '' && auto?.automatic === true && auto.key !== '' && auto.deviceId === d.deviceId;
      const next: FieldDraft = backToAuto
        ? { deviceId: auto.deviceId, deviceName: auto.deviceName, key: auto.key, label: labelOfKey(keyByName.get(auto.key)), script: f.script, automatic: true }
        : key === ''
          ? { deviceId: '', deviceName: '', key: '', label: '', script: '' }
          : { ...f, deviceId: d.deviceId, deviceName: d.deviceName, key, label: labelOfKey(keyByName.get(key)), automatic: false };
      return { ...d, fields: { ...d.fields, [name]: next } };
    });
  }

  function setScript(name: string, script: string) {
    setDraft((d) => (d.fields[name] ? { ...d, fields: { ...d.fields, [name]: { ...d.fields[name], script } } } : d));
  }

  // ─── Save, next, clear, close ─────────────────────────────────────────────
  const [confirm, setConfirm] = useState<null | 'discard' | 'clear'>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  async function save(): Promise<boolean> {
    const entry = entryFromDraft(draft);
    let ok: boolean;
    try {
      ok = (await props.onSave(entry)) !== false;
    } catch {
      ok = false;
    }
    if (!ok) return false;
    if (draft.deviceId) onRemember({ id: draft.deviceId, name: draft.deviceName });
    if (alive.current) setBaseline(entry);
    return true;
  }

  async function next() {
    if (dirty && !readOnly && !(await save())) return;
    props.onNext?.();
  }

  async function clear() {
    setConfirm(null);
    let ok: boolean;
    try {
      ok = (await (props.onClear ? props.onClear() : props.onSave({ fields: {} }))) !== false;
    } catch {
      ok = false;
    }
    if (!ok || !alive.current) return;
    setBaseline({ fields: {} });
    // Fields the drawing fills automatically go back to that; the rest read nothing.
    setDraft((d) => ({
      ...d,
      fields: Object.fromEntries(Object.entries(d.fields).map(([n, f]) => {
        const auto = symbol.fields.find((sf) => sf.name === n)?.currentSource;
        const empty: FieldDraft = { ...f, deviceId: '', deviceName: '', key: '', label: '', script: '', automatic: false };
        return [n, auto?.automatic === true && auto.key !== '' && auto.deviceId === d.deviceId
          ? { ...empty, deviceId: auto.deviceId, deviceName: auto.deviceName, key: auto.key, automatic: true }
          : empty];
      })),
    }));
    setSuggested(new Set());
  }

  function close() {
    if (dirty && !readOnly) setConfirm('discard');
    else props.onClose();
  }

  // ─── Focus: the device search when there is no device yet, else the first value picker ───
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (readOnly) return;
    const root = rootRef.current;
    if (!root) return;
    const target = draft.deviceId ? root.querySelector<HTMLElement>('select') : root.querySelector<HTMLElement>('input[role="searchbox"]');
    target?.focus();
    // On open of this symbol only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Convert ──────────────────────────────────────────────────────────────
  const [convertOpen, setConvertOpen] = useState(() => symbol.fields.some((f) => (f.currentScript ?? '').trim() !== ''));
  const convertId = `${uid}-convert`;

  const usedBy = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of symbol.fields) {
      const d = draft.fields[f.name];
      if (d && d.key && (d.deviceId === '' || d.deviceId === draft.deviceId)) map.set(d.key, f.label);
    }
    return map;
  }, [symbol.fields, draft]);

  const menuItems: DropdownItem[] = [
    ...(props.menuActions ?? []).map((a): DropdownItem => ({ id: a.id, label: a.label, onClick: a.onClick, disabled: a.disabled })),
    ...((props.menuActions?.length ?? 0) > 0 ? [{ type: 'separator' } as DropdownItem] : []),
    { id: 'clear', label: m.clear, danger: true, disabled: !bound && !dirty, onClick: () => setConfirm('clear') },
  ];

  const busy = saving;
  const visibleKeys = keys.slice(0, KEY_ROWS);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={m.panel}
      data-symbol-id={symbol.id}
      className={cn('flex h-full min-h-0 w-full flex-col bg-surface-base text-text-primary', props.className)}
    >
      {/* Header: what this is, in the symbol's own words */}
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        {symbol.icon && (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken">
            {symbol.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{symbol.label}</h2>
          <p className="truncate text-xs text-text-secondary">{symbol.kindLabel}</p>
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label={m.close} onClick={close} iconLeft={<FontAwesomeIcon icon={faXmark} className="h-4 w-4" />} />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {readOnly && <p className="text-xs text-text-secondary">{m.readOnlyNote}</p>}

        {/* 1. Device */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{m.deviceSection}</h3>
          <ComboBox
            id={`${uid}-device`}
            label={m.deviceLabel}
            options={deviceOptions}
            value={draft.deviceId}
            onChange={pickDevice}
            onSearch={searchDevices}
            placeholder={m.devicePlaceholder}
            noResultsText={m.deviceNoResults}
            clearable={false}
            disabled={readOnly}
          />
        </div>

        {/* 2. Values */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{m.valuesSection}</h3>
          {keysStatus === 'idle' && <p className="text-sm text-text-secondary">{m.valuesNeedDevice}</p>}
          {keysStatus === 'loading' && <p className="text-sm text-text-secondary" role="status">{m.valuesLoading}</p>}
          {keysStatus === 'error' && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="text-error" role="alert">{m.valuesError}</p>
              <Button variant="outline" size="xs" onClick={() => { setKeysState(null); setRetry((n) => n + 1); }}>{m.valuesRetry}</Button>
            </div>
          )}
          {keysStatus === 'ready' && keys.length === 0 && <p className="text-sm text-text-secondary">{m.valuesEmpty}</p>}

          {keysStatus === 'ready' && keys.length > 0 && (
            <>
              <ul aria-label={m.valuesSection} className="max-h-44 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {visibleKeys.map((k) => (
                  <li key={k.key} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{k.label || k.key}</span>
                      {usedBy.has(k.key) && <span className="block truncate text-xs text-primary">{m.feeds(usedBy.get(k.key) ?? '')}</span>}
                    </span>
                    <span className="shrink-0 text-right text-xs text-text-secondary">
                      {m.valueAndAge(formatValue(k.value, k.unit), ageText(k.ts, now, m.age))}
                    </span>
                  </li>
                ))}
              </ul>
              {keys.length > KEY_ROWS && <p className="text-xs text-text-secondary">{m.valuesMore(keys.length - KEY_ROWS)}</p>}
            </>
          )}

          {draft.deviceId && symbol.fields.map((field) => {
            const f = draft.fields[field.name];
            if (!f) return null;
            const info = keyByName.get(f.key);
            const other = f.key !== '' && f.deviceId !== '' && f.deviceId !== draft.deviceId;
            const options = fieldOptions(keys, f.key);
            const valueLine = valueLineOf({ f, info, other, ready: keysStatus === 'ready', field, now, m });
            return (
              <div key={field.name} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.label}</span>
                  {suggested.has(field.name) && <Badge size="sm" variant="primary">{m.suggested}</Badge>}
                  {f.automatic && <span className="text-xs text-text-secondary">{m.automatic}</span>}
                  {other && <span className="truncate text-xs text-text-secondary">{m.fromOtherDevice(f.deviceName)}</span>}
                </div>
                <Select
                  id={`${uid}-field-${field.name}`}
                  label={m.fieldPicker(field.label)}
                  hideLabel
                  options={options}
                  placeholder={m.notUsed}
                  value={f.key}
                  disabled={readOnly || (keysStatus !== 'ready' && f.key === '')}
                  onChange={(e) => pickKey(field.name, e.target.value)}
                />
                {valueLine && <p className="text-xs text-text-secondary">{valueLine}</p>}
              </div>
            );
          })}
        </div>

        {/* 3. Convert (collapsed until a field has a one-liner) */}
        {draft.deviceId && (
          <div className="space-y-3">
            <button
              type="button"
              aria-expanded={convertOpen}
              aria-controls={convertId}
              onClick={() => setConvertOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-md text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <FontAwesomeIcon icon={convertOpen ? faChevronDown : faChevronRight} className="h-3 w-3 text-text-secondary" aria-hidden="true" />
              {m.convertSection}
            </button>
            {convertOpen && (
              <div id={convertId} className="space-y-4">
                <p className="text-xs text-text-secondary">{m.convertHint}</p>
                {symbol.fields.every((field) => !draft.fields[field.name]?.key) && (
                  <p className="text-sm text-text-secondary">{m.convertNeedsValue}</p>
                )}
                {symbol.fields.map((field) => {
                  const f = draft.fields[field.name];
                  if (!f || !f.key) return null;
                  return (
                    <fieldset key={field.name} className="space-y-2">
                      <legend className="mb-1 text-sm font-medium">{field.label}</legend>
                      <Input
                        id={`${uid}-script-${field.name}`}
                        label={m.convertInput(field.label)}
                        hideLabel
                        value={f.script}
                        onChange={(e) => setScript(field.name, e.target.value)}
                        placeholder={m.convertPlaceholder}
                        maxLength={MAX_SCRIPT_LENGTH}
                        readOnly={readOnly}
                        spellCheck={false}
                        autoComplete="off"
                        autoCapitalize="off"
                        className="[&_input]:font-mono"
                      />
                      <div className="flex flex-wrap gap-1">
                        {scriptTemplates().map((t) => (
                          <Button key={t.id} variant="outline" size="xs" disabled={readOnly} onClick={() => setScript(field.name, t.script)}>
                            {m.templates[t.id]}
                          </Button>
                        ))}
                      </div>
                      <ScriptPreview script={f.script} sample={keyByName.get(f.key)?.value} previewScript={props.previewScript} m={m} />
                    </fieldset>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-2 border-t border-border px-4 py-3">
        {props.error && <AlertBanner variant="error" message={props.error} />}
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button variant="primary" size="sm" className="flex-1" loading={saving} disabled={!dirty || busy} onClick={() => void save()}>
              {m.save}
            </Button>
          )}
          {props.onNext && (
            <Button variant="secondary" size="sm" className="flex-1" disabled={busy} onClick={() => void next()}>
              {m.next}
            </Button>
          )}
          {!readOnly && (
            <DropdownMenu
              align="right"
              placement="top"
              portal
              items={menuItems}
              trigger={
                <Button variant="ghost" size="sm" iconOnly aria-label={m.more} disabled={busy} iconLeft={<FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" />} />
              }
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'discard'}
        portalTarget={props.portalTarget}
        title={m.discardTitle}
        message={m.discardBody}
        tone="warning"
        confirmLabel={m.discardConfirm}
        cancelLabel={m.keepEditing}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          props.onClose();
        }}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        portalTarget={props.portalTarget}
        title={m.clearTitle}
        message={m.clearBody}
        tone="danger"
        confirmLabel={m.clearConfirm}
        cancelLabel={m.cancel}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void clear()}
      />
    </div>
  );
}

// ─── Parts ───────────────────────────────────────────────────────────────────

const labelOfKey = (k: DeviceKey | undefined): string => (k?.label && k.label !== k.key ? k.label : '');

/** The picker's choices: every key of the device, and the field's own key first when the device does not list it (still loading, or another device's). */
function fieldOptions(keys: readonly DeviceKey[], current: string) {
  const options = keys.map((k) => ({ value: k.key, label: k.label && k.label !== k.key ? `${k.label} (${k.key})` : k.key }));
  if (current && !options.some((o) => o.value === current)) options.unshift({ value: current, label: current });
  return options;
}

function valueLineOf(a: {
  f: FieldDraft;
  info: DeviceKey | undefined;
  other: boolean;
  ready: boolean;
  field: { live?: unknown; currentSource?: { key: string }; currentScript?: string };
  now: number;
  m: SymbolBindingMessages;
}): string {
  const { f, info, other, ready, field, now, m } = a;
  if (!f.key || other) return '';
  if (info) return m.valueAndAge(formatValue(info.value, info.unit), ageText(info.ts, now, m.age));
  if (!ready) {
    // While the values load: what the symbol shows now, when nothing converts it.
    const same = field.currentSource?.key === f.key && !(field.currentScript ?? '').trim() && field.live !== undefined;
    return same ? formatValue(field.live) : '';
  }
  return m.noValueYet;
}

/** The live "1 → true" line under a one-liner: debounced, through the host's sandbox, and never throws. */
function ScriptPreview(props: {
  script: string;
  sample: unknown;
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  m: SymbolBindingMessages;
}) {
  const { script, sample, previewScript, m } = props;
  const [settled, setSettled] = useState(script);
  useEffect(() => {
    if (settled === script) return undefined;
    const t = setTimeout(() => setSettled(script), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [script, settled]);

  const outcome = useMemo<ScriptOutcome | null>(() => {
    if (!previewScript || settled.trim() === '' || sample === undefined) return null;
    try {
      return previewScript(settled, sample);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [previewScript, settled, sample]);

  const line = previewScript ? previewLine(settled, sample, outcome) : { kind: 'none' as const };
  let text = '';
  let bad = false;
  if (line.kind === 'wait') text = m.previewWait;
  else if (line.kind === 'ok') text = m.previewResult(line.from, line.to);
  else if (line.kind === 'error') {
    text = m.previewErrors[line.error](line.detail);
    bad = true;
  }
  return (
    <p role="status" aria-live="polite" className={cn('min-h-4 text-xs', bad ? 'text-error' : 'text-text-secondary')}>
      {text}
    </p>
  );
}
