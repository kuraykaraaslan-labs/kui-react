'use client';
// The symbol binding panel (next-boilerplate phase 45.4, D45-10; slice 16: U1 suggestions, U2 mapping rows, U2b expressions, U5 keyboard):
// a click on a symbol of a drawing opens this for THAT symbol only. Pick the device, then ONE ROW PER THING THE SYMBOL DRAWS: each row
// says what the symbol shows now and reads either a device value (a searchable picker over the device's values, the best one preselected
// as "Suggested") or an expression (one line over the picked value and up to four other named values, with a live result). Save, and go
// to the next symbol. One column that fits a 380 px side panel. It is a plain section the HOST places in its side dock (no Drawer here),
// and it speaks of the symbol, the device and its values: no scene key, slot, kind, role or match is ever drawn.
//
// The kit fetches nothing. The HOST passes the symbol (its fields and what they read now), the device search, the values of a device
// (`loadKeys`, asked again every `refreshMs` so the list is live), the judge of an expression (`judgeScript`, the same one the server
// refuses with), the sandbox that previews it (`previewScript`, the phase 35 runner; in a test a stub) and answers `onSave` with the
// entry. Everything decided here (the ranking, the draft, the entry, the age, the templates, the input names) is `symbol-binding-logic.ts`,
// pure and tested on its own.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faEllipsis, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { AlertBanner } from '@/modules/ui/AlertBanner';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { CodeEditor } from '@/modules/ui/CodeEditor';
import type { Marker, Suggestion } from '@/modules/ui/CodeEditor/types';
import { ComboBox } from '@/modules/ui/ComboBox';
import type { ComboBoxOption } from '@/modules/ui/ComboBox';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DropdownMenu, type DropdownItem } from '@/modules/ui/DropdownMenu';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { Select } from '@/modules/ui/Select';
import { useNow } from '../useNow';
import {
  ageText, defaultInputName, draftFromSymbol, entryFromDraft, entryFromSymbol, expressionNames, formatSample, formatValue, hasOwnEntry, isDirty, mismatchOf,
  pickableKeys, previewLine, rankKeysForField, scriptErrorKind, scriptTemplates, templateFor, MAX_INPUTS_PER_FIELD, MAX_SCRIPT_LENGTH, MIN_PROPOSAL_SCORE,
  type BindingDraft, type BindingEntry, type DeviceKey, type DeviceOption, type FieldDraft, type InputDraft, type RankedKey, type ScriptOutcome, type SourceMode,
  type SymbolFieldSpec, type SymbolSpec,
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
  /** The tenant's devices matching `query` (the empty query: the ones to offer first, the page's own first). Called debounced, so a host may fetch. */
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
  /**
   * Runs a one-liner on a sample in the phase 35 sandbox. The sample is the field's live value, or `{ value, row, inputs }` when the expression
   * reads named inputs. Without it the preview line stays empty.
   */
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  /** Says at once, in plain words, why an expression over these names may not run (the server's own judge); null when it may. Without it the preview says. */
  judgeScript?: (script: string, names: string[]) => string | null;
  /** The host is writing: Save and Next symbol wait. */
  saving?: boolean;
  /** The text of the last failed save. */
  error?: string;
  /** Look, do not change: every control is off and there is no Save. */
  readOnly?: boolean;
  /** The host's own entries of the "…" menu, above Clear. */
  menuActions?: readonly SymbolBindingMenuAction[];
  /** One action drawn in the header ("Match everything"). */
  headerAction?: SymbolBindingMenuAction;
  /** How many symbols of the drawing are connected, for the header line. */
  progress?: { connected: number; total: number };
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
/** A search box over the values appears once the device has more keys than this. */
const VALUES_SEARCH_FROM = 8;
const PREVIEW_DEBOUNCE_MS = 250;

export function SymbolBindingPanel(props: SymbolBindingPanelProps) {
  // The device last saved is the proposal for the next symbol that reads nothing; it outlives one symbol's form.
  const [last, setLast] = useState<{ id: string; name: string } | null>(null);
  // One form per symbol: moving to the next symbol starts its draft over.
  return <SymbolForm key={props.symbol.id} {...props} last={last} onRemember={setLast} />;
}

/** One row of the values table. */
type ValueRow = {
  key: string;
  name: string;
  feeds?: string;
  value: string;
  ts: number;
  age: string;
};

type KeysState = { deviceId: string; status: 'ready' | 'error'; keys: DeviceKey[] };

const labelOfKey = (k: DeviceKey | undefined): string => (k?.label && k.label !== k.key ? k.label : '');
const nameOfKey = (k: DeviceKey | undefined, key: string): string => (k?.label && k.label.trim() ? k.label : key);
const EMPTY_FIELD: Omit<FieldDraft, 'mode' | 'inputs'> = { deviceId: '', deviceName: '', key: '', label: '', script: '' };

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
  // An empty row whose best candidate is not certain: offered as "Suggested: …" with one tap, never preselected.
  const [proposals, setProposals] = useState<Readonly<Record<string, RankedKey>>>({});
  // Automatic rows the person opened with "Change".
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
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
      // the host's order is kept (the page's own devices first); the place of a device is its description, so devices of one room read as a group
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
        fields[name] = oldOnes
          ? { ...f, deviceId: '', deviceName: '', key: '', label: '', automatic: false, inputs: f.inputs.filter((i) => i.deviceId !== '' && i.deviceId !== d.deviceId) }
          : f;
      }
      return { deviceId: id, deviceName: picked?.name ?? '', fields };
    });
    setSuggested(new Set());
    setProposals({});
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
    const empty = symbol.fields.filter((f) => draft.fields[f.name] && draft.fields[f.name].key === '' && draft.fields[f.name].mode === 'value');
    const taken = new Set(Object.values(draft.fields).filter((f) => f.key !== '' && (f.deviceId === '' || f.deviceId === draft.deviceId)).map((f) => f.key));
    const fields = { ...draft.fields };
    const sure = new Set<string>();
    const maybe: Record<string, RankedKey> = {};
    for (const f of empty) {
      const [top, second] = rankKeysForField(f, keys, symbol.id, [...taken], [symbol.label, symbol.kindLabel]);
      if (!top) continue;
      if (top.confident) {
        fields[f.name] = { ...fields[f.name], deviceId: draft.deviceId, deviceName: draft.deviceName, key: top.key, label: labelOfKey(keyByName.get(top.key)), automatic: false };
        taken.add(top.key);
        sure.add(f.name);
      } else if (top.score >= MIN_PROPOSAL_SCORE && (!second || top.score > second.score)) maybe[f.name] = top; // a tie, or a kind alone, is no suggestion: the row says what to do instead
    }
    if (sure.size > 0) setDraft({ ...draft, fields });
    setSuggested(sure);
    setProposals(maybe);
  }

  function setField(name: string, next: (f: FieldDraft) => FieldDraft) {
    setDraft((d) => (d.fields[name] ? { ...d, fields: { ...d.fields, [name]: next(d.fields[name]) } } : d));
  }
  const dropSuggested = (name: string) => setSuggested((s) => {
    if (!s.has(name)) return s;
    const next = new Set(s);
    next.delete(name);
    return next;
  });
  const dropProposal = (name: string) => setProposals((p) => {
    if (!(name in p)) return p;
    const { [name]: _gone, ...rest } = p;
    return rest;
  });

  function pickKey(name: string, key: string) {
    dropSuggested(name);
    if (key !== '') dropProposal(name);
    setField(name, (f) => {
      // "Not used" on a field the drawing fills automatically, still on that device, goes back to the automatic source: an entry
      // cannot switch the automatic match off, so the picker must not pretend it did.
      const auto = symbol.fields.find((sf) => sf.name === name)?.currentSource;
      const backToAuto = key === '' && auto?.automatic === true && auto.key !== '' && auto.deviceId === draft.deviceId;
      if (backToAuto) return { ...f, deviceId: auto.deviceId, deviceName: auto.deviceName, key: auto.key, label: labelOfKey(keyByName.get(auto.key)), automatic: true };
      if (key === '') return { ...f, ...EMPTY_FIELD, script: f.mode === 'expression' ? f.script : '' };
      return { ...f, deviceId: draft.deviceId, deviceName: draft.deviceName, key, label: labelOfKey(keyByName.get(key)), automatic: false };
    });
  }

  function setMode(name: string, mode: SourceMode) {
    setField(name, (f) => (mode === f.mode ? f : mode === 'value' ? { ...f, mode, script: '', inputs: [], automatic: f.automatic && f.key !== '' ? f.automatic : false } : { ...f, mode }));
  }

  function setScript(name: string, script: string) {
    // one line: a line break typed or pasted becomes a space
    setField(name, (f) => ({ ...f, script: script.replace(/[\r\n]+/g, ' ').slice(0, MAX_SCRIPT_LENGTH) }));
  }

  /** The expression written by a template chip (U2b): the row goes to expression mode and the one-liner is the chip's text over the picked value. */
  function writeTemplate(name: string, script: string) {
    setField(name, (f) => ({ ...f, mode: 'expression', script: templateFor({ id: 'invert', script }, f.inputs, f.key !== '') }));
  }

  function addInput(name: string, key: string) {
    const info = keyByName.get(key);
    setField(name, (f) => {
      if (f.inputs.length >= MAX_INPUTS_PER_FIELD || f.inputs.some((i) => i.key === key && i.deviceId === draft.deviceId)) return f;
      const taken = expressionNames(f.inputs);
      const input: InputDraft = { name: defaultInputName(info?.label || key, taken), deviceId: draft.deviceId, deviceName: draft.deviceName, key, label: labelOfKey(info) };
      return { ...f, mode: 'expression', inputs: [...f.inputs, input] };
    });
  }

  function removeInput(name: string, inputName: string) {
    setField(name, (f) => ({ ...f, inputs: f.inputs.filter((i) => i.name !== inputName) }));
  }

  function insertName(name: string, word: string) {
    setField(name, (f) => {
      const s = f.script;
      const glue = s === '' || /[\s(,+\-*/%<>=!&|?:^~[]$/.test(s) ? '' : ' ';
      return { ...f, script: `${s}${glue}${word}`.slice(0, MAX_SCRIPT_LENGTH) };
    });
  }

  function acceptProposal(name: string) {
    const p = proposals[name];
    if (!p) return;
    pickKey(name, p.key);
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
        const empty: FieldDraft = { ...f, ...EMPTY_FIELD, automatic: false, mode: 'value', inputs: [] };
        return [n, auto?.automatic === true && auto.key !== '' && auto.deviceId === d.deviceId
          ? { ...empty, deviceId: auto.deviceId, deviceName: auto.deviceName, key: auto.key, automatic: true }
          : empty];
      })),
    }));
    setSuggested(new Set());
    setProposals({});
    setOpened(new Set());
  }

  function close() {
    if (dirty && !readOnly) setConfirm('discard');
    else props.onClose();
  }

  // ─── Focus: the device search when there is no device yet, else the first row ───
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (readOnly) return;
    const root = rootRef.current;
    if (!root) return;
    const target = draft.deviceId ? root.querySelector<HTMLElement>('[data-row]') : root.querySelector<HTMLElement>('input[role="searchbox"]');
    target?.focus();
    // On open of this symbol only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Keyboard (U5): Esc closes, the arrows move between rows, Enter takes a row's suggestion ───
  function onRootKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (e.key === 'Escape') {
      // an open list, a menu or a dialog closes itself first (their own Escape); the panel closes on an Escape nothing else wanted, and leaves the
      // event's default alone so an overlay that reads `defaultPrevented` still sees it
      if (e.defaultPrevented || target.getAttribute('aria-expanded') === 'true' || target.closest('[role="menu"], [role="dialog"], [role="listbox"]')) return;
      close();
      return;
    }
    if (!target.hasAttribute('data-row')) return;
    const rows = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []);
    const at = rows.indexOf(target);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const to = rows[(at + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length];
      to?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const name = target.getAttribute('data-row') ?? '';
      if (proposals[name] && !readOnly) acceptProposal(name);
      else target.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    }
  }

  // ─── Rows ─────────────────────────────────────────────────────────────────
  const [valuesOpen, setValuesOpen] = useState(false);
  const valuesId = `${uid}-values`;

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
  const valueRows = useMemo<ValueRow[]>(
    () => keys.slice(0, KEY_ROWS).map((k) => ({
      key: k.key,
      name: nameOfKey(k, k.key),
      feeds: usedBy.get(k.key),
      value: formatValue(k.value, k.unit),
      ts: (typeof k.ts === 'number' ? k.ts : Date.parse(k.ts)) || 0,
      age: ageText(k.ts, now, m.age),
    })),
    [keys, usedBy, now, m],
  );
  const valueColumns = useMemo<Column<ValueRow>[]>(() => [
    {
      key: 'name', header: m.valuesName, sortable: true, tdClass: 'max-w-0 w-[45%]',
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate text-sm text-text-primary">{r.name}</span>
          {r.feeds !== undefined && <span className="block truncate text-xs text-primary">{m.feeds(r.feeds)}</span>}
        </span>
      ),
    },
    { key: 'value', header: m.valuesValue, searchable: false, tdClass: 'max-w-0 truncate text-text-secondary', render: (r) => r.value },
    { key: 'ts', header: m.valuesUpdated, sortable: true, align: 'right', searchable: false, tdClass: 'whitespace-nowrap text-text-secondary', render: (r) => r.age },
  ], [m]);

  const sourceOptions = useMemo(() => [{ value: 'value', label: m.sourceValue }, { value: 'expression', label: m.sourceExpression }], [m]);
  const hints = useMemo(() => [symbol.label, symbol.kindLabel], [symbol.label, symbol.kindLabel]);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={m.panel}
      data-symbol-id={symbol.id}
      onKeyDown={onRootKeyDown}
      className={cn('flex h-full min-h-0 w-full flex-col bg-surface-base text-text-primary', props.className)}
    >
      {/* Header: what this is, in the symbol's own words */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start gap-3">
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
        {(props.progress || props.headerAction) && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {props.progress && <p className="text-xs text-text-secondary" data-testid="symbol-progress">{m.progress(props.progress.connected, props.progress.total)}</p>}
            {props.headerAction && !readOnly && (
              <Button variant="outline" size="xs" disabled={props.headerAction.disabled || busy} onClick={props.headerAction.onClick}>{props.headerAction.label}</Button>
            )}
          </div>
        )}
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

        {/* 2. One row per thing the symbol draws */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">{m.rowsSection}</h3>
          {keysStatus === 'idle' && <p className="text-sm text-text-secondary">{m.valuesNeedDevice}</p>}
          {keysStatus === 'loading' && <p className="text-sm text-text-secondary" role="status">{m.valuesLoading}</p>}
          {keysStatus === 'error' && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="text-error" role="alert">{m.valuesError}</p>
              <Button variant="outline" size="xs" onClick={() => { setKeysState(null); setRetry((n) => n + 1); }}>{m.valuesRetry}</Button>
            </div>
          )}
          {draft.deviceId && symbol.fields.map((field) => {
            const f = draft.fields[field.name];
            if (!f) return null;
            return (
              <FieldRow
                key={field.name}
                uid={uid}
                field={field}
                f={f}
                draftDeviceId={draft.deviceId}
                keys={keys}
                keyByName={keyByName}
                hints={hints}
                ready={keysStatus === 'ready'}
                readOnly={readOnly}
                suggested={suggested.has(field.name)}
                proposal={proposals[field.name]}
                opened={opened.has(field.name)}
                onOpen={() => setOpened((s) => new Set(s).add(field.name))}
                onPickKey={(key) => pickKey(field.name, key)}
                onAccept={() => acceptProposal(field.name)}
                onMode={(mode) => setMode(field.name, mode)}
                onScript={(s) => setScript(field.name, s)}
                onTemplate={(s) => writeTemplate(field.name, s)}
                onAddInput={(key) => addInput(field.name, key)}
                onRemoveInput={(n) => removeInput(field.name, n)}
                onInsert={(w) => insertName(field.name, w)}
                sourceOptions={sourceOptions}
                previewScript={props.previewScript}
                judgeScript={props.judgeScript}
                now={now}
                m={m}
              />
            );
          })}
          {draft.deviceId && !readOnly && <p className="text-xs text-text-secondary">{m.keysHint}</p>}
        </div>

        {/* 3. All values of the device, folded away: the rows above carry the live values; this is the whole list for whoever wants it */}
        {keysStatus === 'ready' && keys.length === 0 && <p className="text-sm text-text-secondary">{m.valuesEmpty}</p>}
        {keysStatus === 'ready' && keys.length > 0 && (
          <div className="space-y-3">
            <button
              type="button"
              aria-expanded={valuesOpen}
              aria-controls={valuesId}
              onClick={() => setValuesOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-md text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <FontAwesomeIcon icon={valuesOpen ? faChevronDown : faChevronRight} className="h-3 w-3 text-text-secondary" aria-hidden="true" />
              {m.valuesToggle(keys.length)}
            </button>
            {valuesOpen && (
              <div id={valuesId}>
                {/* The kit's DataTable (static mode, compact, no paging): the host's values sorted by name or age, a search box
                    once the list is long, an internal scroll past ~8 rows. A row does nothing on click: the rows above choose. */}
                <DataTable<ValueRow>
                  id={`${uid}-values-table`}
                  mode="static"
                  density="compact"
                  caption={m.valuesSection}
                  columns={valueColumns}
                  rows={valueRows}
                  rowId={(r) => r.key}
                  searchable={valueRows.length > VALUES_SEARCH_FROM}
                  searchText={(r) => `${r.name} ${r.key}`}
                  searchPlaceholder={m.valuesSearch}
                  stickyHeader
                  defaultSort={[]}
                  multiSort={false}
                  scrollClassName="max-h-60 overflow-y-auto"
                  tableClassName="text-xs"
                  messages={{ tableLabel: m.valuesSection, search: m.valuesSearch }}
                />
                {keys.length > KEY_ROWS && <p className="text-xs text-text-secondary">{m.valuesMore(keys.length - KEY_ROWS)}</p>}
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

// ─── One row: a parameter of the drawing ──────────────────────────────────────

interface FieldRowProps {
  uid: string;
  field: SymbolFieldSpec;
  f: FieldDraft;
  draftDeviceId: string;
  keys: readonly DeviceKey[];
  keyByName: ReadonlyMap<string, DeviceKey>;
  hints: readonly string[];
  ready: boolean;
  readOnly: boolean;
  suggested: boolean;
  proposal: RankedKey | undefined;
  opened: boolean;
  onOpen: () => void;
  onPickKey: (key: string) => void;
  onAccept: () => void;
  onMode: (mode: SourceMode) => void;
  onScript: (script: string) => void;
  onTemplate: (script: string) => void;
  onAddInput: (key: string) => void;
  onRemoveInput: (name: string) => void;
  onInsert: (word: string) => void;
  sourceOptions: { value: string; label: string }[];
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  judgeScript?: (script: string, names: string[]) => string | null;
  now: number;
  m: SymbolBindingMessages;
}

function FieldRow(p: FieldRowProps) {
  const { uid, field, f, draftDeviceId, keys, keyByName, hints, ready, readOnly, suggested, proposal, opened, m, now } = p;
  const info = keyByName.get(f.key);
  const other = f.key !== '' && f.deviceId !== '' && f.deviceId !== draftDeviceId;
  const live = field.live !== undefined ? formatValue(field.live, field.unit) : '';
  const automaticClosed = !!f.automatic && !opened && f.mode === 'value';
  const mismatch = f.mode === 'value' && info ? mismatchOf(field, info) : null;

  // the picker's choices: every pickable key of the device, the ranked ones first (the best says "Suggested"), each with its live value and age
  const options = useMemo<ComboBoxOption[]>(() => {
    const ranked = rankKeysForField(field, keys, undefined, [], hints);
    const order = new Map(ranked.map((r, i) => [r.key, i]));
    const list = pickableKeys(keys).slice().sort((a, b) => (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity));
    const best = ranked[0]?.key;
    const out = list.map((k): ComboBoxOption => {
      const line = m.optionLine(formatValue(k.value, k.unit), ageText(k.ts, now, m.age));
      return { value: k.key, label: nameOfKey(k, k.key), description: k.key === best ? m.suggestedOption(line) : line };
    });
    if (f.key && !out.some((o) => o.value === f.key)) out.unshift({ value: f.key, label: f.key });
    return out;
  }, [field, keys, f.key, hints, m, now]);

  const valueLine = valueLineOf({ f, info, other, ready, field, now, m });
  const rowId = `${uid}-row-${field.name}`;

  return (
    <div data-row={field.name} role="group" aria-label={m.rowLabel(field.label)} tabIndex={0} className="space-y-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium" id={rowId}>{field.label}</span>
        {suggested && <Badge size="sm" variant="primary">{m.suggested}</Badge>}
        {f.automatic && <span className="text-xs text-text-secondary">{m.automatic}</span>}
        {other && <span className="truncate text-xs text-text-secondary">{m.fromOtherDevice(f.deviceName)}</span>}
        <span className="ml-auto text-xs text-text-secondary">{live ? m.showsNow(live) : m.showsNothing}</span>
      </div>

      {automaticClosed ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-secondary">
          <span>{m.automaticLine(nameOfKey(info, f.key), info ? m.valueAndAge(formatValue(info.value, info.unit), ageText(info.ts, now, m.age)) : '')}</span>
          {!readOnly && <Button variant="ghost" size="xs" onClick={p.onOpen}>{m.change}</Button>}
        </p>
      ) : (
        <>
          <Select
            id={`${uid}-source-${field.name}`}
            label={m.sourceLabel(field.label)}
            hideLabel
            options={p.sourceOptions}
            value={f.mode}
            disabled={readOnly}
            onChange={(e) => p.onMode(e.target.value as SourceMode)}
          />
          {f.mode === 'value' ? (
            <div className="space-y-1">
              <div className="[&_label]:sr-only">
                <ComboBox
                  id={`${uid}-field-${field.name}`}
                  label={m.fieldPicker(field.label)}
                  options={options}
                  value={f.key}
                  onChange={(v) => p.onPickKey(v)}
                  placeholder={m.pickerPlaceholder}
                  noResultsText={m.pickerNoResults}
                  clearable={!readOnly && f.key !== ''}
                  disabled={readOnly || (!ready && f.key === '')}
                  messages={{ clear: m.notUsed }}
                />
              </div>
              {valueLine && <p className="text-xs text-text-secondary">{valueLine}</p>}
              {f.key === '' && !proposal && ready && <p className="text-xs text-text-secondary">{m.unsetHint}</p>}
              {f.key === '' && proposal && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
                  <span>{m.suggestedCandidate(nameOfKey(keyByName.get(proposal.key), proposal.key))}</span>
                  {!readOnly && <Button variant="outline" size="xs" onClick={p.onAccept}>{m.useSuggestion}</Button>}
                </p>
              )}
              {mismatch && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-warning-fg" role="note">
                  <span>{m.mismatch[mismatch]}</span>
                  {!readOnly && <Button variant="ghost" size="xs" onClick={() => p.onMode('expression')}>{m.convertInstead}</Button>}
                </p>
              )}
            </div>
          ) : (
            <ExpressionBox
              uid={uid}
              field={field}
              f={f}
              info={info}
              keys={keys}
              keyByName={keyByName}
              readOnly={readOnly}
              onScript={p.onScript}
              onTemplate={p.onTemplate}
              onAddInput={p.onAddInput}
              onRemoveInput={p.onRemoveInput}
              onInsert={p.onInsert}
              onPickKey={p.onPickKey}
              options={options}
              previewScript={p.previewScript}
              judgeScript={p.judgeScript}
              m={m}
            />
          )}
        </>
      )}
    </div>
  );
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

// ─── The expression of a row (U2b) ─────────────────────────────────────────────

interface ExpressionBoxProps {
  uid: string;
  field: SymbolFieldSpec;
  f: FieldDraft;
  info: DeviceKey | undefined;
  keys: readonly DeviceKey[];
  keyByName: ReadonlyMap<string, DeviceKey>;
  readOnly: boolean;
  onScript: (script: string) => void;
  onTemplate: (script: string) => void;
  onAddInput: (key: string) => void;
  onRemoveInput: (name: string) => void;
  onInsert: (word: string) => void;
  onPickKey: (key: string) => void;
  options: ComboBoxOption[];
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  judgeScript?: (script: string, names: string[]) => string | null;
  m: SymbolBindingMessages;
}

/** The column the judge's "at position N" names, for the editor's marker. */
const columnOf = (problem: string): number | undefined => {
  const at = /position (\d+)/.exec(problem);
  return at ? Number(at[1]) : undefined;
};

function ExpressionBox(p: ExpressionBoxProps) {
  const { uid, field, f, info, keys, keyByName, readOnly, m } = p;
  const editorId = `${uid}-script-${field.name}`;
  const names = useMemo(() => expressionNames(f.inputs), [f.inputs]);
  const inputNames = useMemo(() => f.inputs.map((i) => i.name), [f.inputs]);

  // what the expression is tried on: the picked value and the inputs' live values
  const inputValues = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const i of f.inputs) out[i.name] = keyByName.get(i.key)?.value ?? null;
    return out;
  }, [f.inputs, keyByName]);
  const value = f.key ? info?.value : undefined;
  const wrapped = f.inputs.length > 0;
  const sample = useMemo(() => (wrapped ? { value: value ?? null, row: {}, inputs: inputValues } : value), [wrapped, value, inputValues]);
  const hasAnySample = wrapped ? Object.values(inputValues).some((v) => v !== null && v !== undefined) || value !== undefined : value !== undefined;

  // settled after a short pause while typing: the judge and the preview both read it
  const [settled, setSettled] = useState(f.script);
  useEffect(() => {
    if (settled === f.script) return undefined;
    const t = setTimeout(() => setSettled(f.script), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [f.script, settled]);

  const problem = useMemo(() => (p.judgeScript && settled.trim() !== '' ? p.judgeScript(settled, inputNames) : null), [p.judgeScript, settled, inputNames]);
  const markers = useMemo<Marker[]>(() => (problem ? [{ line: 1, column: columnOf(problem), severity: 'error', message: problem }] : []), [problem]);

  const getSuggestions = useCallback(async (ctx: { prefix?: string }): Promise<Suggestion[]> => {
    const prefix = (ctx.prefix ?? '').toLowerCase();
    return names.filter((n) => n.toLowerCase().startsWith(prefix)).map((n) => ({ label: n, detail: n === 'value' ? (f.key ? nameOfKey(info, f.key) : '') : keyByName.get(f.inputs.find((i) => i.name === n)?.key ?? '')?.label ?? '' }));
  }, [names, f.key, f.inputs, info, keyByName]);

  const addable = useMemo<ComboBoxOption[]>(
    () => p.options.filter((o) => o.value !== f.key && !f.inputs.some((i) => i.key === o.value)),
    [p.options, f.key, f.inputs],
  );
  const needsSomething = f.script.trim() === '' && !f.key && f.inputs.length === 0;

  return (
    <div className="space-y-2">
      <label htmlFor={editorId} className="sr-only">{m.expressionLabel(field.label)}</label>
      <CodeEditor
        id={editorId}
        value={f.script}
        onChange={readOnly ? undefined : p.onScript}
        language="js"
        readonly={readOnly}
        placeholder={m.expressionPlaceholder}
        minHeight={40}
        showLineNumbers={false}
        markers={markers}
        getSuggestions={readOnly ? undefined : getSuggestions}
        className="text-sm"
      />
      <p className="text-xs text-text-secondary">{m.expressionHint}</p>
      <div className="space-y-1">
        <p className="text-xs font-medium text-text-secondary">{m.namesTitle}</p>
        <div className="flex flex-wrap gap-1">
          <NameChip
            name="value"
            text={m.nameChip('value', f.key ? formatValue(info?.value, info?.unit) : '')}
            title={m.insertName('value')}
            disabled={readOnly || !f.key}
            onInsert={() => p.onInsert('value')}
          />
          {f.inputs.map((i) => (
            <NameChip
              key={i.name}
              name={i.name}
              text={m.nameChip(i.name, formatValue(keyByName.get(i.key)?.value, keyByName.get(i.key)?.unit))}
              title={m.insertName(i.name)}
              disabled={readOnly}
              onInsert={() => p.onInsert(i.name)}
              onRemove={readOnly ? undefined : () => p.onRemoveInput(i.name)}
              removeLabel={m.removeInput(i.name)}
            />
          ))}
        </div>
        {!f.key && (
          <div className="[&_label]:sr-only">
            <ComboBox
              id={`${uid}-field-${field.name}`}
              label={m.fieldPicker(field.label)}
              options={p.options}
              value={f.key}
              onChange={(v) => p.onPickKey(v)}
              placeholder={m.pickerPlaceholder}
              noResultsText={m.pickerNoResults}
              clearable={false}
              disabled={readOnly}
            />
          </div>
        )}
        {!readOnly && (f.inputs.length < MAX_INPUTS_PER_FIELD
          ? (
            <div className="[&_label]:sr-only">
              <ComboBox
                key={f.inputs.length}
                id={`${uid}-input-${field.name}`}
                label={m.addInput}
                options={addable}
                value=""
                onChange={(v) => { if (v) p.onAddInput(v); }}
                placeholder={m.addInputPlaceholder}
                noResultsText={m.pickerNoResults}
                clearable={false}
                disabled={keys.length === 0}
              />
            </div>
          )
          : <p className="text-xs text-text-secondary">{m.inputsFull(MAX_INPUTS_PER_FIELD)}</p>)}
      </div>
      <div className="flex flex-wrap gap-1">
        {scriptTemplates().map((t) => (
          <Button key={t.id} variant="outline" size="xs" disabled={readOnly} onClick={() => p.onTemplate(t.script)}>
            {m.templates[t.id]}
          </Button>
        ))}
      </div>
      {needsSomething
        ? <p className="text-xs text-text-secondary">{m.expressionNeedsSomething}</p>
        : <ScriptPreview script={settled} sample={sample} wrapped={wrapped} hasSample={hasAnySample} problem={problem} previewScript={p.previewScript} m={m} />}
    </div>
  );
}

function NameChip(p: { name: string; text: string; title: string; disabled: boolean; onInsert: () => void; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-full border border-border bg-surface-sunken text-xs">
      <button type="button" aria-label={p.title} disabled={p.disabled} onClick={p.onInsert} className="px-2 py-0.5 font-mono text-text-primary hover:bg-surface-raised disabled:opacity-50">
        {p.text}
      </button>
      {p.onRemove && (
        <button type="button" aria-label={p.removeLabel} onClick={p.onRemove} className="border-l border-border px-1.5 py-0.5 text-text-secondary hover:bg-surface-raised">
          <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** The live result under an expression: debounced, through the host's sandbox, and never throws. A judge's refusal shows at once instead. */
function ScriptPreview(props: {
  script: string;
  sample: unknown;
  wrapped: boolean;
  hasSample: boolean;
  problem: string | null;
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  m: SymbolBindingMessages;
}) {
  const { script, sample, wrapped, hasSample, problem, previewScript, m } = props;
  const outcome = useMemo<ScriptOutcome | null>(() => {
    if (problem || !previewScript || script.trim() === '' || !hasSample) return null;
    try {
      return previewScript(script, sample);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [problem, previewScript, script, sample, hasSample]);

  let text = '';
  let bad = false;
  if (problem && script.trim() !== '') {
    // the judge's sentence is written for a person: shown as it is
    text = m.previewErrors[scriptErrorKind(problem)](problem);
    bad = true;
  } else if (previewScript) {
    const line = previewLine(script, hasSample ? sample : undefined, outcome);
    if (line.kind === 'wait') text = m.previewWait;
    else if (line.kind === 'ok') text = wrapped ? m.resultNow(line.to) : m.previewResult(line.from, line.to);
    else if (line.kind === 'error') {
      // the sandbox's own text is not for a person (a stack, an engine's wording): only a failure of another kind carries it
      text = m.previewErrors[line.error](line.error === 'other' ? line.detail : '');
      bad = true;
    }
  }
  return (
    <p role="status" aria-live="polite" className={cn('min-h-4 text-xs', bad ? 'text-error' : 'text-text-secondary')}>
      {text}
    </p>
  );
}

export { formatSample };
