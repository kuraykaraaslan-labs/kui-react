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
  ageText, applyPair, applyTemplate, clearBest, declaredRange, defaultInputName, draftFromSymbol, entryFromDraft, entryFromSymbol, expressionNames, formatSample, formatValue, hasOwnEntry,
  isDirty, mismatchOf, ownPartKeys, pairOperands, partsOf, pickableKeys, previewLine, rankKeysForField, rawRangeOf, scaleOver, scriptErrorKind, scriptTemplates, MAX_INPUTS_PER_FIELD,
  MAX_SCRIPT_LENGTH, MIN_PROPOSAL_SCORE,
  type BindingDraft, type BindingEntry, type DeviceKey, type DeviceOption, type FieldDraft, type InputDraft, type PairTemplateId, type RankedKey, type RawRange, type ScriptOutcome,
  type ScriptTemplate, type SourceMode, type StateWords, type SymbolFieldSpec, type SymbolSpec } from './symbol-binding-logic';
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
  progress?: { connected: number; total: number; automatic?: number };
  /**
   * The device a symbol with none of its own starts on, when it is the symbol's by the drawing (a device page's device, the binding's main or only
   * device). Never a guess: a symbol whose device is not known starts on none, and the guess is `suggestedDevice` (next-boilerplate e2e round 5, E5:
   * the previous symbol's device was carried silently and its values pre-picked on the next symbol).
   */
  defaultDevice?: { id: string; name: string } | null;
  /**
   * The device proposed for a symbol that starts on none, shown under the device picker with a one-click Use and never picked by itself: the device
   * whose name or place matches the symbol (`why` 'name' / 'place'), else the device the person picked last ('last'; the host keeps it, so it survives
   * the panel's reloads). Absent: the panel proposes the device of its own last save; null: nothing.
   */
  suggestedDevice?: { id: string; name: string; why?: 'name' | 'place' | 'last' } | null;
  /** How often the values are asked again, in ms; 0 asks once. Default 5000. */
  refreshMs?: number;
  /** The time the ages are counted from (ms); default the clock. */
  now?: number;
  messages?: DeepPartial<SymbolBindingMessages>;
  /**
   * Whether the symbol's form holds changes the person made and has not saved (the ones closing the panel asks about). The panel draws one symbol at a
   * time and starts the next symbol's form over, so a host that picks another symbol while this is true should ask first (run 3 notes 45 and 121: a missed
   * Save click lost the link silently when the next symbol was picked).
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Where the confirmations mount (a fullscreen element); default the kit's. */
  portalTarget?: Element | string | null;
  /**
   * The workspace's language (`tr`, `en-GB`): the numbers the panel shows follow it ("Şu an 46,222 gösteriyor"; next-boilerplate phase 52.2.4, test 3
   * #28). Without it a number is written as JavaScript writes it.
   */
  locale?: string;
  /**
   * The name of the symbol "Next symbol" goes to, when the host knows it: the button says it ("Save and next: K6"; next-boilerplate phase 52.2.4, D594,
   * test 3 #183: typing meant for K6 linked the reservoir the button went to).
   */
  nextLabel?: string;
  className?: string;
}

/** The panel's words for an on/off value (`formatValue`), one object per messages object. */
const stateWordsCache = new WeakMap<SymbolBindingMessages, StateWords>();
function stateWordsOf(m: SymbolBindingMessages): StateWords {
  let words = stateWordsCache.get(m);
  if (!words) { words = { on: m.stateOn, off: m.stateOff }; stateWordsCache.set(m, words); }
  return words;
}

/** The chips over two values, after the five over one (D589). */
const PAIR_TEMPLATES: readonly PairTemplateId[] = ['difference', 'ratio'];

const SEARCH_ROWS = 100;
const KEY_ROWS = 100;
/** A search box over the values appears once the device has more keys than this. */
const VALUES_SEARCH_FROM = 8;
const PREVIEW_DEBOUNCE_MS = 250;

export function SymbolBindingPanel(props: SymbolBindingPanelProps) {
  // The device last saved is offered (never picked) to the next symbol that reads nothing, when the host proposes none; it outlives one symbol's form.
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
  const { symbol, readOnly = false, saving = false, refreshMs = 5000, last, onRemember, locale } = props;
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
  // a symbol starts on its own device only; a guess is shown as a suggestion, never picked silently (E5)
  const [draft, setDraft] = useState<BindingDraft>(() => draftFromSymbol(symbol, props.defaultDevice ?? null));
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
  // an expression the judge refuses, by row: Save and Save-and-next wait until it is right (next-boilerplate e2e round 4, m-R4-01: Save stayed enabled)
  const [problems, setProblems] = useState<Readonly<Record<string, string | null>>>({});
  const onProblem = useCallback((field: string, problem: string | null) => {
    setProblems((cur) => ((cur[field] ?? null) === problem ? cur : { ...cur, [field]: problem }));
  }, []);
  const blocked = Object.entries(problems).some(([field, problem]) => problem !== null && draft.fields[field]?.mode === 'expression');
  // The person changed something themselves (a pick, a device, a text): a preselected suggestion alone is not theirs to lose, so closing an untouched
  // panel never asks, and "Next symbol" says "Save and next" whenever a press would write (the suggestions, or their edits).
  const [touched, setTouched] = useState(false);
  const unsaved = dirty && touched && !readOnly;
  const { onDirtyChange } = props;
  useEffect(() => { onDirtyChange?.(unsaved); }, [unsaved, onDirtyChange]);
  // a form that goes away (another symbol, the panel closed) holds nothing unsaved any more
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  // Clear has something to clear when the symbol has settings of its own (an automatic source is not a setting).
  const bound = hasOwnEntry(symbol) || Object.keys(baseline.fields).length > 0;

  // ─── The device ────────────────────────────────────────────────────────────
  const known = useRef(new Map<string, DeviceOption>());
  const deviceOptions = useMemo<ComboBoxOption[]>(
    () => (draft.deviceId ? [{ value: draft.deviceId, label: draft.deviceName || draft.deviceId }] : []),
    [draft.deviceId, draft.deviceName],
  );
  // the suggested device and the words, read by the search below without restarting it
  const suggestedIdRef = useRef('');
  const wordsRef = useRef(m);
  const searchDevices = useCallback(async (query: string): Promise<ComboBoxOption[]> => {
    try {
      const found = (await searchRef.current(query)).slice(0, SEARCH_ROWS);
      for (const d of found) known.current.set(d.id, d);
      // the host's order is kept (the page's own devices first); the place of a device is its description, so devices of one room read as a group. The
      // suggested device comes first and says so (next-boilerplate phase 53.2.7, re-run 4 #11: it was last in the list, unmarked)
      const suggestedId = suggestedIdRef.current;
      const ordered = suggestedId ? [...found.filter((d) => d.id === suggestedId), ...found.filter((d) => d.id !== suggestedId)] : found;
      return ordered.map((d) => {
        const line = [d.code, d.hint].filter((s): s is string => !!s).join(' · ');
        return {
          value: d.id,
          label: d.name,
          description: d.id === suggestedId ? (line ? wordsRef.current.suggestedOption(line) : wordsRef.current.suggested) : line || undefined,
        };
      });
    } catch {
      return [];
    }
  }, []);

  function pickDevice(id: string) {
    if (!id || id === draft.deviceId) return;
    const picked = known.current.get(id);
    setTouched(true);
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

  // the device proposed for a symbol with none: the host's, else the panel's own last save; taken with one click, never by itself
  const deviceSuggestion = props.suggestedDevice !== undefined ? props.suggestedDevice : last ? { ...last, why: 'last' as const } : null;
  const suggestedId = !draft.deviceId && deviceSuggestion ? deviceSuggestion.id : '';
  useEffect(() => {
    suggestedIdRef.current = suggestedId;
    wordsRef.current = m;
  });
  function takeSuggestedDevice() {
    if (!deviceSuggestion) return;
    known.current.set(deviceSuggestion.id, { id: deviceSuggestion.id, name: deviceSuggestion.name });
    pickDevice(deviceSuggestion.id);
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

  // the picked device's name, for a code the symbol's name writes (`rankKeysForField`'s `device`)
  const deviceText = draft.deviceId ? draft.deviceName : '';
  // the keys the symbol's rows read on that device: their parts are the symbol's own
  const readKeysSig = Object.values(draft.fields).filter((f) => f.key !== '' && (f.deviceId === '' || f.deviceId === draft.deviceId)).map((f) => f.key).join('\n');
  const readKeys = useMemo(() => (readKeysSig ? readKeysSig.split('\n') : []), [readKeysSig]);

  // ─── Proposing a key for each empty field, once per device (adjusted while rendering, not in an effect) ───
  const [suggestedFor, setSuggestedFor] = useState('');
  if (!readOnly && keysStatus === 'ready' && suggestedFor !== draft.deviceId) {
    setSuggestedFor(draft.deviceId);
    // a row the drawing offers but never fills by itself (`suggest: false`: a measuring symbol's Running) is left for the person; a row proposed only from
    // the symbol's own part (`'own'`: its Status) comes last, from the part the others read (next-boilerplate phase 52.2.6)
    const open = (f: SymbolFieldSpec) => f.suggest !== false && draft.fields[f.name] && draft.fields[f.name].key === '' && draft.fields[f.name].mode === 'value';
    const empty = [...symbol.fields.filter((f) => open(f) && f.suggest !== 'own'), ...symbol.fields.filter((f) => open(f) && f.suggest === 'own')];
    const taken = new Set(Object.values(draft.fields).filter((f) => f.key !== '' && (f.deviceId === '' || f.deviceId === draft.deviceId)).map((f) => f.key));
    // the parts the symbol reads already are its own; the parts proposed here are its own only for a row proposed from its own part
    const stored = partsOf(taken);
    const fields = { ...draft.fields };
    const sure = new Set<string>();
    const maybe: Record<string, RankedKey> = {};
    for (const f of empty) {
      const own = f.suggest === 'own';
      const read = [...taken, ...Object.values(maybe).map((r) => r.key)];
      const pool = own ? ownPartKeys(keys, read, { element: symbol.id, label: symbol.label }) : keys;
      const [top, second] = rankKeysForField(f, pool, symbol.id, [...taken], [symbol.label, symbol.kindLabel], { device: deviceText, parts: own ? partsOf(read) : stored });
      if (!top) continue;
      if (top.confident) {
        fields[f.name] = { ...fields[f.name], deviceId: draft.deviceId, deviceName: draft.deviceName, key: top.key, label: labelOfKey(keyByName.get(top.key)), automatic: false };
        taken.add(top.key);
        sure.add(f.name);
      } else if (top.score >= MIN_PROPOSAL_SCORE && !top.mismatch && (!second || top.score > second.score)) maybe[f.name] = top; // a tie, a kind alone or a value of the wrong kind is no suggestion (E2E-2.11): the row says what to do instead
    }
    if (sure.size > 0) setDraft({ ...draft, fields });
    setSuggested(sure);
    setProposals(maybe);
  }

  /** Every change of a row is the person's own: the draft is marked touched with it. */
  function setField(name: string, next: (f: FieldDraft) => FieldDraft) {
    setTouched(true);
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
    // back to a device value: the expression, its inputs AND the value it was built on go; the row says "Not connected" until a value is picked
    // (next-boilerplate e2e round 3, M-R3-06: the expression's first value stayed and a flow meter showed a temperature)
    setField(name, (f) => (mode === f.mode ? f : mode === 'value' ? { ...f, ...EMPTY_FIELD, mode, inputs: [], automatic: false } : { ...f, mode }));
    if (mode === 'value') { dropSuggested(name); dropProposal(name); }
  }

  function setScript(name: string, script: string) {
    // one line: a line break typed or pasted becomes a space
    setField(name, (f) => ({ ...f, script: script.replace(/[\r\n]+/g, ' ').slice(0, MAX_SCRIPT_LENGTH) }));
  }

  /**
   * The expression written by a template chip (U2b): the row goes to expression mode; an empty box gets the chip's text over the picked value, a typed
   * expression is wrapped or extended by it (`applyTemplate`, next-boilerplate AD-15: typed work is never overwritten). A result over the length cap
   * changes nothing.
   */
  function writeTemplate(name: string, template: ScriptTemplate) {
    setField(name, (f) => {
      const script = applyTemplate(template, f.script, f.inputs, f.key !== '');
      return script === null ? f : { ...f, mode: 'expression', script };
    });
  }

  /** "Scale 0–100" writes its expression over the RAW value, in place of what was typed (next-boilerplate phase 52.2.4, test 3 #27: its form says so). */
  function writeScale(name: string, range: RawRange) {
    setField(name, (f) => ({ ...f, mode: 'expression', script: scaleOver(range, f.inputs, f.key !== '') }));
  }

  /**
   * "Difference" and "Ratio (%)" over the two values the row reads (D589): what their tooltip says, in place of what the box held (next-boilerplate phase
   * 53.2.5, re-run 4 #6: a typed formula took A's place and the ratio meant nothing).
   */
  function writePair(name: string, id: PairTemplateId) {
    setField(name, (f) => {
      const pair = pairOperands(f.key !== '', f.inputs);
      const script = pair ? applyPair(id, pair) : null;
      return script === null ? f : { ...f, mode: 'expression', script };
    });
  }

  function addInput(name: string, key: string) {
    const info = keyByName.get(key);
    setField(name, (f) => {
      if (f.inputs.length >= MAX_INPUTS_PER_FIELD || f.inputs.some((i) => i.key === key && i.deviceId === draft.deviceId)) return f;
      const taken = expressionNames(f.inputs);
      // the name is the KEY's (`temp_24h`), never a cut of the label (E2E-2.12)
      const input: InputDraft = { name: defaultInputName(key, taken), deviceId: draft.deviceId, deviceName: draft.deviceName, key, label: labelOfKey(info) };
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
    if (alive.current) {
      setBaseline(entry);
      setTouched(false);
    }
    return true;
  }

  // the host's save error belongs to the draft that failed: once the person changes something it is gone (next-boilerplate e2e round 3, m-R3-09:
  // the old refusal stayed beside Save after the expression was corrected)
  const draftSig = JSON.stringify(entryFromDraft(draft));
  const [errorFor, setErrorFor] = useState<{ error: string; sig: string } | null>(null);
  if (props.error && errorFor?.error !== props.error) setErrorFor({ error: props.error, sig: draftSig });
  if (!props.error && errorFor) setErrorFor(null);
  const shownError = props.error && errorFor && errorFor.sig === draftSig ? props.error : undefined;

  // "Next symbol" writes first when something is filled in that is not saved yet; its label says so then ("Save and next"), and names the symbol it goes to
  // when the host knows it ("Save and next: K6", D594)
  const nextWrites = dirty && !readOnly;
  const nextText = props.nextLabel
    ? (nextWrites ? m.saveAndNextTo(props.nextLabel) : m.nextTo(props.nextLabel))
    : (nextWrites ? m.saveAndNext : m.next);
  const canWrite = !blocked;
  async function next() {
    if (nextWrites && !(await save())) return;
    // saved (or nothing to save): the next symbol is picked with nothing unsaved
    props.onDirtyChange?.(false);
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
    setTouched(false);
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
    // only what the person changed themselves is worth a question: a panel that holds no more than its own suggestions closes at once
    if (unsaved) setConfirm('discard');
    else props.onClose();
  }

  // ─── Focus: the suggested device's "Use" when there is one, else the device search when there is no device yet, else the first row ───
  // (next-boilerplate phase 53.2.7, re-run 4 #11: the search opens its list on focus, and the list covered the "Suggested" line under it)
  const rootRef = useRef<HTMLDivElement>(null);
  const openFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (readOnly) return;
    const root = rootRef.current;
    if (!root) return;
    const target = draft.deviceId
      ? root.querySelector<HTMLElement>('[data-row]')
      : root.querySelector<HTMLElement>('[data-use-suggestion]') ?? root.querySelector<HTMLElement>('input[role="searchbox"]');
    target?.focus();
    openFocus.current = target;
    // On open of this symbol only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a suggestion the host finds after the panel opened takes the focus from the search the panel gave it, while nothing is typed there yet
  const suggestionShown = !draft.deviceId && !readOnly && !!deviceSuggestion;
  useEffect(() => {
    const search = openFocus.current;
    if (!suggestionShown || !search || search !== document.activeElement || !(search instanceof HTMLInputElement) || search.value !== '') return;
    const use = rootRef.current?.querySelector<HTMLElement>('[data-use-suggestion]') ?? null;
    use?.focus();
    openFocus.current = use;
  }, [suggestionShown]);

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
      value: formatValue(k.value, k.unit, stateWordsOf(m), locale),
      ts: (typeof k.ts === 'number' ? k.ts : Date.parse(k.ts)) || 0,
      age: ageText(k.ts, now, m.age),
    })),
    [keys, usedBy, now, m, locale],
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
            {props.progress && <p className="text-xs text-text-secondary" data-testid="symbol-progress">{m.progress(props.progress.connected, props.progress.total, props.progress.automatic)}</p>}
            {props.headerAction && !readOnly && (
              <Button variant="outline" size="xs" disabled={props.headerAction.disabled || busy} onClick={props.headerAction.onClick}>{props.headerAction.label}</Button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {readOnly && <p className="text-xs text-text-secondary">{m.readOnlyNote}</p>}

        {/* 1. Device (the section's heading is the name a person sees; the picker's own label stays for assistive technology only) */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{m.deviceSection}</h3>
          <div className="[&_label]:sr-only">
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
          {!draft.deviceId && !readOnly && deviceSuggestion && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary" data-testid="device-suggestion">
              <span>{m.suggestedDevice(deviceSuggestion.name, deviceSuggestion.why ?? 'last')}</span>
              <Button data-use-suggestion="" variant="outline" size="xs" onClick={takeSuggestedDevice}>{m.useSuggestion}</Button>
            </p>
          )}
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
                onTemplate={(tpl) => writeTemplate(field.name, tpl)}
                onScale={(range) => writeScale(field.name, range)}
                onPair={(id) => writePair(field.name, id)}
                onAddInput={(key) => addInput(field.name, key)}
                onRemoveInput={(n) => removeInput(field.name, n)}
                onInsert={(w) => insertName(field.name, w)}
                onProblem={(problem) => onProblem(field.name, problem)}
                sourceOptions={sourceOptions}
                previewScript={props.previewScript}
                judgeScript={props.judgeScript}
                now={now}
                m={m}
                locale={locale}
                deviceText={deviceText}
                readKeys={readKeys}
                symbolId={symbol.id}
                symbolLabel={symbol.label}
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
        {shownError && <AlertBanner variant="error" message={shownError} />}
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button variant="primary" size="sm" className="flex-1" loading={saving} disabled={!dirty || busy || !canWrite} onClick={() => void save()}>
              {m.save}
            </Button>
          )}
          {props.onNext && (
            <Button variant="secondary" size="sm" className="min-w-0 flex-1" disabled={busy || (nextWrites && !canWrite)} onClick={() => void next()} title={nextText}>
              <span className="truncate">{nextText}</span>
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
          // discarded here: the host must not ask again
          props.onDirtyChange?.(false);
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
  onTemplate: (template: ScriptTemplate) => void;
  /** "Scale 0–100" with the raw range the person gave: written over the raw value. */
  onScale: (range: RawRange) => void;
  /** "Difference" or "Ratio (%)" over the row's two values. */
  onPair: (id: PairTemplateId) => void;
  onAddInput: (key: string) => void;
  onRemoveInput: (name: string) => void;
  onInsert: (word: string) => void;
  /** The judge's problem with the row's expression, or null when it may run (the panel's Save waits while one stands). */
  onProblem?: (problem: string | null) => void;
  sourceOptions: { value: string; label: string }[];
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  judgeScript?: (script: string, names: string[]) => string | null;
  now: number;
  m: SymbolBindingMessages;
  locale?: string;
  /** The picked device's name: a symbol's code the device writes is the symbol's (`rankKeysForField`'s `device`). */
  deviceText?: string;
  /** The keys the symbol's rows read on this device: their parts are its own (`rankKeysForField`'s `parts`; `ownPartKeys` for a row proposed from its own part). */
  readKeys?: readonly string[];
  symbolId?: string;
  symbolLabel?: string;
}

function FieldRow(p: FieldRowProps) {
  const { uid, field, f, draftDeviceId, keys, keyByName, hints, ready, readOnly, suggested, proposal, opened, m, now, locale, deviceText, readKeys } = p;
  const info = keyByName.get(f.key);
  const other = f.key !== '' && f.deviceId !== '' && f.deviceId !== draftDeviceId;
  // what the symbol shows now: the card's row, or the fresher list value when the saved source is the picked key and nothing converts it (next-boilerplate
  // e2e round 4, m-R4-05: "Shows 59 now" beside a list that said 75.9)
  const savedIsPicked = f.mode === 'value' && f.key !== '' && f.key === field.currentSource?.key && !(field.currentScript ?? '').trim();
  // in the FIELD's unit (what the symbol draws), not the list's: the picker line already carries the device's unit
  const live = savedIsPicked && info?.ts ? formatValue(info.value, field.unit, stateWordsOf(m), locale) : field.live !== undefined ? formatValue(field.live, field.unit, stateWordsOf(m), locale) : '';
  // a value picked but not saved yet: the label says what the symbol will show once it is, instead of "Shows nothing yet" (m-R4-05)
  const pickedUnsaved = f.mode === 'value' && f.key !== '' && f.key !== (field.currentSource?.key ?? '') && !other && info?.ts ? formatValue(info.value, field.unit, stateWordsOf(m), locale) : '';
  const automaticClosed = !!f.automatic && !opened && f.mode === 'value';
  const mismatch = f.mode === 'value' && info ? mismatchOf(field, info) : null;

  // the picker's choices: every key of the device, the ranked ones first (the best says "Suggested"), each with its live value and age; a key the host
  // marked internal (a connection of the drawing) is never ranked and comes last, but is never out of reach
  const options = useMemo<ComboBoxOption[]>(() => {
    const others = (readKeys ?? []).filter((k) => k !== f.key);
    const ranked = rankKeysForField(field, keys, undefined, [], hints, { device: deviceText, parts: partsOf(others) });
    const order = new Map(ranked.map((r, i) => [r.key, i]));
    const list = [...pickableKeys(keys).sort((a, b) => (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity)), ...keys.filter((k) => k.internal)];
    // a row nothing is proposed for (`suggest: false`) lists the best first all the same, but calls none of them "Suggested"; nor is a tie at the top, a
    // weak best or one of the wrong kind "Suggested" (next-boilerplate phase 52.2.4, test 3 #157: every belt was "Suggested: Conveyor 1")
    const ownKeys = field.suggest === 'own' ? new Set(ownPartKeys(keys, others, { element: p.symbolId, label: p.symbolLabel ?? '' }).map((k) => k.key)) : null;
    const best = field.suggest === false ? undefined : clearBest(ownKeys ? ranked.filter((r) => ownKeys.has(r.key)) : ranked)?.key;
    const out = list.map((k): ComboBoxOption => {
      // a key the device's profile declares but the device has not sent yet (no reading, no time) is offered with "No value yet", not "–" (E2E-1.4)
      const value = k.ts ? m.optionLine(formatValue(k.value, k.unit, stateWordsOf(m), locale), ageText(k.ts, now, m.age)) : m.noValueYet;
      // a key the device sent that its profile does not declare says so (next-boilerplate e2e round 4, M-R4-09: nothing told an old name from a real value)
      const line = k.declared === false ? m.notDeclaredOption(value) : value;
      return { value: k.key, label: nameOfKey(k, k.key), description: k.key === best ? m.suggestedOption(line) : line };
    });
    if (f.key && !out.some((o) => o.value === f.key)) out.unshift({ value: f.key, label: f.key });
    return out;
  }, [field, keys, f.key, hints, m, now, locale, deviceText, readKeys, p.symbolId, p.symbolLabel]);

  const valueLine = valueLineOf({ f, info, other, ready, field, now, m, locale });
  const rowId = `${uid}-row-${field.name}`;

  return (
    <div data-row={field.name} role="group" aria-label={m.rowLabel(field.label)} tabIndex={0} className="space-y-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium" id={rowId}>{field.label}</span>
        {suggested && <Badge size="sm" variant="primary">{m.suggested}</Badge>}
        {f.automatic && <span className="text-xs text-text-secondary">{m.automatic}</span>}
        {other && <span className="truncate text-xs text-text-secondary">{m.fromOtherDevice(f.deviceName)}</span>}
        <span className="ml-auto text-xs text-text-secondary">{pickedUnsaved ? m.willShow(pickedUnsaved) : live ? m.showsNow(live) : m.showsNothing}</span>
      </div>

      {automaticClosed ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-secondary">
          <span>{m.automaticLine(nameOfKey(info, f.key), info ? m.valueAndAge(formatValue(info.value, info.unit, stateWordsOf(m), locale), ageText(info.ts, now, m.age)) : '')}</span>
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
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 [&_label]:sr-only">
                  <ComboBox
                    id={`${uid}-field-${field.name}`}
                    label={m.fieldPicker(field.label)}
                    options={options}
                    value={f.key}
                    onChange={(v) => p.onPickKey(v)}
                    placeholder={m.pickerPlaceholder}
                    noResultsText={keys.length === 0 ? m.valuesEmpty : `${m.pickerNoResults} ${m.typedNoMatch}`}
                    clearable={!readOnly && f.key !== ''}
                    disabled={readOnly || (!ready && f.key === '')}
                    messages={{ clear: m.notUsed }}
                  />
                </div>
                {/* a connection is taken away by a button that says so, not only by the picker's x (M-R3-06) */}
                {!readOnly && f.key !== '' && !f.automatic && (
                  <Button variant="ghost" size="xs" className="shrink-0" onClick={() => p.onPickKey('')} data-testid={`disconnect-${field.name}`}>{m.disconnect}</Button>
                )}
              </div>
              {valueLine && <p className="text-xs text-text-secondary">{valueLine}</p>}
              {f.key === '' && !proposal && ready && <p className="text-xs text-text-secondary">{m.unsetHint}</p>}
              {f.key === '' && proposal && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
                  <span>{m.suggestedCandidate(nameOfKey(keyByName.get(proposal.key), proposal.key))}</span>
                  {!readOnly && <Button variant="outline" size="xs" onClick={p.onAccept}>{m.useSuggestion}</Button>}
                  {/* a proposal that does not fit the kind says so before it is taken, not after */}
                  {proposal.mismatch && <span className="text-warning-fg">{m.mismatch[proposal.mismatch]}</span>}
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
              onScale={p.onScale}
              onPair={p.onPair}
              onAddInput={p.onAddInput}
              onRemoveInput={p.onRemoveInput}
              onInsert={p.onInsert}
              onPickKey={p.onPickKey}
              onProblem={p.onProblem}
              options={options}
              previewScript={p.previewScript}
              judgeScript={p.judgeScript}
              m={m}
              locale={locale}
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
  locale?: string;
}): string {
  const { f, info, other, ready, field, now, m, locale } = a;
  if (!f.key || other) return '';
  if (info) return info.ts ? m.valueAndAge(formatValue(info.value, info.unit, stateWordsOf(m), locale), ageText(info.ts, now, m.age)) : m.noValueYet;
  if (!ready) {
    // While the values load: what the symbol shows now, when nothing converts it.
    const same = field.currentSource?.key === f.key && !(field.currentScript ?? '').trim() && field.live !== undefined;
    return same ? formatValue(field.live, undefined, stateWordsOf(m), locale) : '';
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
  onTemplate: (template: ScriptTemplate) => void;
  /** "Scale 0–100" with the raw range the person gave: written over the raw value. */
  onScale: (range: RawRange) => void;
  /** "Difference" or "Ratio (%)" over the row's two values. */
  onPair: (id: PairTemplateId) => void;
  onAddInput: (key: string) => void;
  onRemoveInput: (name: string) => void;
  onInsert: (word: string) => void;
  onPickKey: (key: string) => void;
  options: ComboBoxOption[];
  onProblem?: (problem: string | null) => void;
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  judgeScript?: (script: string, names: string[]) => string | null;
  m: SymbolBindingMessages;
  locale?: string;
}

/** The column the judge's "at position N" names, for the editor's marker. */
const columnOf = (problem: string): number | undefined => {
  const at = /position (\d+)/.exec(problem);
  return at ? Number(at[1]) : undefined;
};

function ExpressionBox(p: ExpressionBoxProps) {
  const { uid, field, f, info, keys, keyByName, readOnly, m, locale } = p;
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

  const { judgeScript } = p;
  const problem = useMemo(() => (judgeScript && settled.trim() !== '' ? judgeScript(settled, inputNames) : null), [judgeScript, settled, inputNames]);
  // the row's problem reaches the panel (its Save waits); a row whose expression is empty has none. The callback is read through a ref: the panel hands
  // a fresh arrow every render, and an effect keyed on it re-ran its cleanup (null) and itself (the problem) on every render, a loop that never settled.
  const onProblemRef = useRef(p.onProblem);
  useEffect(() => { onProblemRef.current = p.onProblem; });
  useEffect(() => { onProblemRef.current?.(problem); }, [problem]);
  useEffect(() => () => onProblemRef.current?.(null), []);
  // the problem is said ONCE: the box marks and names it (the judge's sentence), and the line under it then says the kind of problem alone, whatever the kind
  // (next-boilerplate e2e round 4, m-R4-01: an unknown name was said twice)
  const markers = useMemo<Marker[]>(() => (problem ? [{ line: 1, column: columnOf(problem), severity: 'error', message: problem }] : []), [problem]);
  const marked = problem !== null;

  const getSuggestions = useCallback(async (ctx: { prefix?: string }): Promise<Suggestion[]> => {
    const prefix = (ctx.prefix ?? '').toLowerCase();
    return names.filter((n) => n.toLowerCase().startsWith(prefix)).map((n) => ({ label: n, detail: n === 'value' ? (f.key ? nameOfKey(info, f.key) : '') : keyByName.get(f.inputs.find((i) => i.name === n)?.key ?? '')?.label ?? '' }));
  }, [names, f.key, f.inputs, info, keyByName]);

  const addable = useMemo<ComboBoxOption[]>(
    () => p.options.filter((o) => o.value !== f.key && !f.inputs.some((i) => i.key === o.value)),
    [p.options, f.key, f.inputs],
  );
  const needsSomething = f.script.trim() === '' && !f.key && f.inputs.length === 0;
  // "Scale 0–100" asks for the raw range first (E15): the form under the chips
  const [scaling, setScaling] = useState(false);
  // the two values a pair chip reads, once there are two (D589)
  const pair = pairOperands(f.key !== '', f.inputs);

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
            text={m.nameChip('value', f.key ? formatValue(info?.value, info?.unit, stateWordsOf(m), locale) : '')}
            title={m.insertName('value')}
            disabled={readOnly || !f.key}
            onInsert={() => p.onInsert('value')}
          />
          {f.inputs.map((i) => (
            <NameChip
              key={i.name}
              name={i.name}
              text={m.nameChip(i.name, formatValue(keyByName.get(i.key)?.value, keyByName.get(i.key)?.unit, stateWordsOf(m), locale))}
              title={m.insertName(i.name)}
              disabled={readOnly}
              onInsert={() => p.onInsert(i.name)}
              onRemove={readOnly ? undefined : () => p.onRemoveInput(i.name)}
              removeLabel={m.removeInput(i.name)}
            />
          ))}
        </div>
        {/* the picker of `value` stays once a value is picked, showing it, so the boxes under it never move up (run 3 note 140: the next click hit "Scale 0-100") */}
        {(
          <div className="[&_label]:sr-only">
            <ComboBox
              id={`${uid}-field-${field.name}`}
              label={m.fieldPicker(field.label)}
              options={p.options}
              value={f.key}
              onChange={(v) => p.onPickKey(v)}
              placeholder={m.pickerPlaceholder}
              noResultsText={keys.length === 0 ? m.valuesEmpty : m.pickerNoResults}
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
                noResultsText={keys.length === 0 ? m.valuesEmpty : m.pickerNoResults}
                clearable={false}
                disabled={keys.length === 0}
              />
            </div>
          )
          : <p className="text-xs text-text-secondary">{m.inputsFull(MAX_INPUTS_PER_FIELD)}</p>)}
      </div>
      <div className="flex flex-wrap gap-1">
        {scriptTemplates().map((t) => (
          <Button
            key={t.id} variant="outline" size="xs" disabled={readOnly}
            aria-expanded={t.id === 'scale' ? scaling : undefined}
            onClick={() => (t.id === 'scale' ? setScaling((v) => !v) : p.onTemplate(t))}
          >
            {m.templates[t.id]}
          </Button>
        ))}
        {/* two values: their difference and the first as a percent of the second (D589); they wait for a second value, and say so */}
        {PAIR_TEMPLATES.map((id) => (
          <Button
            key={id} variant="outline" size="xs" disabled={readOnly || !pair}
            title={pair ? m.pairTitle[id](pair.a, pair.b) : m.pairNeedsTwo}
            onClick={() => p.onPair(id)}
          >
            {m.templates[id]}
          </Button>
        ))}
      </div>
      {scaling && !readOnly && (
        <ScaleForm
          uid={editorId}
          start={declaredRange(info) ?? declaredRange(keyByName.get(f.inputs[0]?.key ?? ''))}
          m={m}
          onCancel={() => setScaling(false)}
          onApply={(range) => { setScaling(false); p.onScale(range); }}
        />
      )}
      {needsSomething
        ? <p className="text-xs text-text-secondary">{m.expressionNeedsSomething}</p>
        : <ScriptPreview script={settled} sample={sample} wrapped={wrapped} hasSample={hasAnySample} problem={problem} marked={marked} previewScript={p.previewScript} m={m} locale={locale} />}
    </div>
  );
}

/**
 * The raw range "Scale 0–100" writes its expression over (next-boilerplate e2e round 5, E15): what the value reads at 0 % and at 100 %, started from the
 * scale the key's profile declares when it does, else empty; "Use these numbers" waits for two different numbers.
 */
function ScaleForm(p: { uid: string; start: { from: number; to: number } | null; m: SymbolBindingMessages; onApply: (range: { from: number; to: number }) => void; onCancel: () => void }) {
  const { m } = p;
  const [from, setFrom] = useState(p.start ? String(p.start.from) : '');
  const [to, setTo] = useState(p.start ? String(p.start.to) : '');
  const range = rawRangeOf(from, to);
  const typed = from.trim() !== '' && to.trim() !== '';
  const id = `${p.uid}-scale`;
  return (
    <div role="group" aria-labelledby={`${id}-title`} className="space-y-2 rounded-md border border-border p-2" data-testid="scale-form">
      <p id={`${id}-title`} className="text-xs font-medium text-text-primary">{m.scaleTitle}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-text-secondary">
          <span className="block">{m.scaleFrom}</span>
          <input
            type="text" inputMode="decimal" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={typed && !range ? true : undefined}
            className="h-8 w-full rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
        </label>
        <label className="space-y-1 text-xs text-text-secondary">
          <span className="block">{m.scaleTo}</span>
          <input
            type="text" inputMode="decimal" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={typed && !range ? true : undefined}
            className="h-8 w-full rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
        </label>
      </div>
      <p className={cn('text-xs', typed && !range ? 'text-error' : 'text-text-secondary')}>{typed && !range ? m.scaleInvalid : m.scaleHint}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={p.onCancel}>{m.cancel}</Button>
        <Button variant="primary" size="xs" disabled={!range} onClick={() => { if (range) p.onApply(range); }}>{m.scaleApply}</Button>
      </div>
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
  /** The problem's place is marked in the editor: the line below names the kind of problem without repeating the engine's words. */
  marked?: boolean;
  previewScript?: (script: string, sample: unknown) => ScriptOutcome;
  m: SymbolBindingMessages;
  locale?: string;
}) {
  const { script, sample, wrapped, hasSample, problem, marked = false, previewScript, m, locale } = props;
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
    // the judge's sentence is written for a person: shown as it is, unless the box already marks the place (then the kind of problem alone)
    const kind = scriptErrorKind(problem);
    text = m.previewErrors[kind](marked ? '' : problem);
    bad = true;
  } else if (previewScript) {
    const line = previewLine(script, hasSample ? sample : undefined, outcome, locale);
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
