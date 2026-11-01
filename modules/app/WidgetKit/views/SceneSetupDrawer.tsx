'use client';
// The scene setup drawer (next-boilerplate phase 42, D42-10): one scrolling form in a right-side drawer that binds a scene
// document to the devices that feed it. Sections, no tabs: (1) the type, (2) the document, (3) devices and roles,
// (4) matching scene keys to device elements, and the save through the kit's ConfirmDialog from the footer.
//
// A view is never named by its slot here (next-boilerplate phase 47): the host opens the drawer on ONE view (a saved one, whose slot the draft
// carries back unchanged, or a new one, `NEW_VIEW_SLOT`, which the host creates and its server names). Nothing in the drawer shows, asks for
// or switches a slot; the removal names the view by its drawing.
//
// The kit fetches nothing. The HOST passes the documents, devices, scene keys and elements (and says when each is loading),
// answers the callbacks (`onDocumentChange` to load a document's keys, `onPick` to highlight a key in its preview canvas,
// `onSave` to write), and may hand the canvas in as `preview`. Everything decided here (the matching, the payload, the
// unresolved count) is `scene-binding-logic.ts`, pure and tested on its own.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCrosshairs, faPlus, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { AlertBanner } from '@/modules/ui/AlertBanner';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { ButtonGroup } from '@/modules/ui/ButtonGroup';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableMessages } from '@/modules/ui/Table/types';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select, type SelectOption } from '@/modules/ui/Select';
import {
  MAIN_ROLE, MAX_BINDING_DEVICES, NEW_VIEW_SLOT, autoMatch, bindingDraft, devicesFromRoles, draftSignature,
  elementsForRole, fieldsOfMap, manualOfMap, proposeRoles, sameDraft, staleEntries, unresolved, validateDraft,
  type BindingDraft, type BindingIssue, type DeviceElement, type DeviceRef, type MapEntry, type MatchHow, type SceneKey,
} from './scene-binding-logic';
import { DEFAULT_SCENE_SETUP_MESSAGES, mergeMessages, type DeepPartial, type SceneSetupMessages } from './scene-setup-messages';
import { SceneSetupRules } from './SceneSetupRules';
import { DESIGN_RULE_COLUMNS } from './design-rules-logic';

/** A scene document the host offers (name, when it last changed, how many subjects show it). */
export interface SceneSetupDocument {
  id: string;
  name: string;
  /** An ISO date or date-time. */
  updatedAt?: string;
  usedBy?: number;
}

/** A device to bind. `role` is the host's own proposal; without it one is proposed from the code. */
export interface SceneSetupDevice {
  id: string;
  label: string;
  code?: string;
  role?: string;
}

export interface SceneSetupSave {
  /** The reason typed in the confirmation (`askReason`), '' otherwise. */
  reason: string;
}

/**
 * How much of the form a person sees (next-boilerplate D45-10, e2e round 2 E2E-2.1): `full` is every section; `choose` is "which drawing?"
 * alone (the document table, the host's preview and one line about kept connections), with the type, the devices and roles, the
 * matching table and the rules folded under Advanced, and a Save that asks nothing (the symbols are connected on the drawing afterwards).
 */
export type SceneSetupMode = 'full' | 'choose';

export interface SceneSetupDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Default `full`. See `SceneSetupMode`. */
  mode?: SceneSetupMode;
  /**
   * The saved binding when there is one, or what the host pre-sets (the slot it opens on, the kind). The slot is carried into the draft as it is
   * and never shown; without one (or `NEW_VIEW_SLOT`) the drawer is on a NEW view, which the host creates on save. Read when the drawer opens; a changed
   * `initial` after that restarts the form while it is untouched, and shows a "saved version changed" notice with Reload once it
   * has edits. Its `view` and `rules` are opaque to the drawer: they come back in the `onSave` draft unchanged (the server replaces
   * the whole binding on a save, so a draft without them would erase them). Its `map` entries for keys the document no longer has,
   * its `devices` roles whose device is not listed and its `hidden` keys are shown as stale entries and kept until removed.
   */
  initial?: Partial<BindingDraft>;

  /**
   * How the view the drawer is on is called where the host lists it (its kind and its drawing's name, with "(2)" when the subject has two such views
   * of one drawing): the removal's confirmation names it. Absent: the chosen document's name.
   */
  viewName?: string;
  /**
   * The drawing the saved setup names changed since the setup was made (the host compares the fingerprints, `documentChanged`): a notice at the top
   * asks for a review, and the setup can be saved as it is to confirm it, so the fingerprint is renewed. Ignored once another document is chosen.
   */
  documentChanged?: boolean;
  /**
   * `choose` mode: Advanced starts open, scrolled to the saved entries the drawing no longer has when there are any (the host opened the drawer to review
   * a drawing that changed; next-boilerplate phase 46 review R46-1). Read each time the drawer opens; the person may fold it again.
   */
  openAdvanced?: boolean;
  /** The kinds the host can bind, as values (`diagram`, `design`); labels come from `messages.kinds`. */
  kinds: readonly string[];
  /** The kind cannot be changed: the card menu opened the drawer for the kind its card draws (phase 42.5.4). */
  kindLocked?: boolean;
  /**
   * A kind was chosen. A binding is one row per (subject, slot, KIND), so the form starts over from that kind's saved setup: the host
   * reads it and passes it as `initial` with a new `resetKey` (the documents and keys are the new kind's). With edits in the form, the drawer asks first.
   */
  onKindChange?: (kind: string) => void;
  /**
   * Adds "Remove this setup" to the footer, offered while the form is on a SAVED setup (the one `initial` holds: it has a document, and the form's kind is
   * its own, so a kind chosen but not yet answered offers nothing). The drawer asks first through the kit's ConfirmDialog, which names the kind and the
   * view (`viewName`); on confirm the host removes THAT binding and answers (a promise is awaited; the host closes the drawer or reloads `initial`).
   */
  onRemove?: (target: { slot: string; kind: string }) => void | Promise<void>;
  /** A removal is running: the button waits. */
  removing?: boolean;

  documents: readonly SceneSetupDocument[];
  documentsLoading?: boolean;
  /** A document was chosen: load its keys into `sceneKeys`. */
  onDocumentChange?: (documentId: string) => void;
  /**
   * Adds the "New from this device" button. The host makes the document; when it answers with the new document's id (the document is then in
   * `documents`), the drawer chooses it, keeping the form's edits. An answer of nothing, or a failure (the host says why), chooses nothing.
   */
  onNewFromDevice?: () => void | string | undefined | Promise<void | string | undefined>;
  newFromDeviceBusy?: boolean;

  devices: readonly SceneSetupDevice[];
  /**
   * The names of devices the saved setup binds that `devices` does not list, by id (a device moved elsewhere since): a stale role is named by its
   * device, never by its role code (next-boilerplate e2e round 5, V2-B2); without a name it reads `unknownDevice`.
   */
  deviceNames?: Readonly<Record<string, string>>;
  devicesLoading?: boolean;
  /** The roles the scene's keys use as a prefix, when the document says; each needs a device. */
  roles?: readonly string[];

  sceneKeys: readonly SceneKey[];
  sceneKeysLoading?: boolean;
  /**
   * The document `sceneKeys` belong to. When given and it differs from the chosen document the keys have not loaded yet, and Save
   * stays off (together with `sceneKeysLoading`, `elementsLoading`, `devicesLoading` and `documentsLoading`).
   */
  sceneKeysDocumentId?: string;
  elements: readonly DeviceElement[];
  elementsLoading?: boolean;

  /**
   * The kinds that have a Rules step (default `['design', 'diagram']`: the rules of a 3D design, phase 42.6, and of a stored 2D diagram, phase 42.5.4; the
   * step's effects follow the kind). Another kind's rules stay in the payload untouched. The step needs the chosen document's `sceneKeys`.
   */
  rulesKinds?: readonly string[];
  /** The columns a rule's condition may read (suggestions; default the process scene's columns). */
  ruleColumns?: ReadonlyArray<{ key: string; label?: string }>;
  /** The board parameters a rule's condition may read (suggestions; any name may be typed). */
  ruleParams?: ReadonlyArray<{ key: string; label?: string }>;

  /** The host's preview canvas, drawn beside the matching table. */
  preview?: ReactNode;
  /** "Pick in the scene" was pressed for a key (null: the pick was turned off): the host highlights it in the preview. */
  onPick?: (key: string | null) => void;
  /** The key the host reports picked in the preview; the drawer shows it above the table to choose its element. */
  pickedKey?: string | null;

  /** Writes the binding. The drawer does not close itself: the host closes it, or sets `saveError` / `conflict`. */
  onSave: (draft: BindingDraft, meta: SceneSetupSave) => void;
  saving?: boolean;
  saveError?: string;
  /** The server refused the save as a 409: the saved binding is newer than the one this form started from. */
  conflict?: boolean;
  /** Reloads the saved binding: the host fetches it, passes it as `initial` and changes `resetKey` so the form starts over from it. */
  onReload?: () => void;
  /** A change always starts the form over from `initial` (the host reloaded on the user's request); the form is also fresh each time the drawer opens. */
  resetKey?: string | number;
  /** Asks for an optional reason in the confirmation (it reaches the audit log). */
  askReason?: boolean;

  messages?: DeepPartial<SceneSetupMessages>;
  /** The DataTables' texts. */
  tableMessages?: Partial<DataTableMessages>;
  /** Locale of the documents' dates. */
  locale?: string;
  portalTarget?: Element | string | null;
  className?: string;
}

// The drawer is one session: a fresh form each time it opens (the Drawer unmounts its content, this state would not).
export function SceneSetupDrawer(props: SceneSetupDrawerProps) {
  const [epoch, setEpoch] = useState(0);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setEpoch((e) => e + 1);
  }
  return <SceneSetupSession key={`${epoch}:${props.resetKey ?? ''}`} {...props} />;
}

type KeyRow = {
  key: string;
  label: string;
  kind: string;
  role: string;
  deviceId: string | null;
  element: string | null;
  how: MatchHow;
  /** The text the table's search matches. */
  find: string;
};

type DocRow = { id: string; name: string; updatedAt: string; usedBy: number; use: 'used' | 'unused' };
type DeviceRow = { id: string; label: string; code: string; role: string; roleKind: 'main' | 'named'; included: boolean };

const HOW_VARIANT: Record<MatchHow, 'success' | 'info' | 'warning' | 'primary' | 'error' | 'neutral'> = {
  key: 'success', label: 'info', type: 'warning', manual: 'primary', hidden: 'neutral', none: 'error',
};
const HOWS: MatchHow[] = ['key', 'label', 'type', 'manual', 'hidden', 'none'];


function formatDate(iso: string | undefined, locale?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString(locale, { dateStyle: 'medium', timeStyle: iso.length > 10 ? 'short' : undefined });
}

/** What the form starts from, read once from `initial` (and the host's kinds) so the baseline and the form share it. */
interface Seed {
  slot: string;
  kind: string;
  documentId: string;
  devices: Record<string, string>;
  /** The saved entries as they are: element picks and, since phase 45, field maps (which this drawer carries through untouched). */
  map: Record<string, MapEntry>;
  hidden: string[];
  view: BindingDraft['view'];
  rules: BindingDraft['rules'];
  /** A stable text of all of it: two seeds with the same text are the same saved binding. */
  sig: string;
}

function seedFrom(initial: Partial<BindingDraft> | undefined, kinds: readonly string[]): Seed {
  // the slot is the host's, carried as it is; none is a new view (its host creates it and its server names the slot)
  const seed: Omit<Seed, 'sig'> = {
    slot: initial?.slot || NEW_VIEW_SLOT,
    kind: initial?.kind || kinds[0] || '',
    documentId: initial?.documentId ?? '',
    devices: { ...(initial?.devices ?? {}) },
    map: { ...(initial?.map ?? {}) },
    hidden: [...(initial?.hidden ?? [])],
    view: initial?.view,
    rules: initial?.rules,
  };
  return { ...seed, sig: draftSignature(seed) };
}

/** Everything the user edits. A new seed starts it over. */
interface Form {
  slot: string;
  kind: string;
  documentId: string;
  roleEdits: Record<string, string>;
  /** Device id -> in the scene or not; a device with no entry follows the default (all of them, or the saved ones). */
  include: Record<string, boolean>;
  manual: Record<string, DeviceRef | null>;
  /** The keys left out of the scene (stale ones included until removed). */
  hidden: string[];
  /** Ids of the stale entries the user removed. */
  removedStale: Record<string, true>;
  /** The rules as edited; undefined until the Rules step is used (the saved ones then pass through unchanged). */
  rules?: unknown[];
  autoOn: boolean;
  note: string;
}

// the hand picks are the saved entries' ELEMENT parts; a saved field map is no pick (it is carried through the payload as it is, phase 45)
const freshForm = (seed: Seed): Form => ({
  slot: seed.slot, kind: seed.kind, documentId: seed.documentId, roleEdits: {}, include: {}, manual: manualOfMap(seed.map), hidden: [...seed.hidden],
  removedStale: {}, autoOn: false, note: '',
});

/** `ref` is the saved entry's own key (a scene key, a role): internal; `name` is what is shown (a role by its device's name, never its code). */
type StaleRow = { id: string; type: 'exception' | 'role' | 'hidden'; typeLabel: string; ref: string; name: string; detail: string; state: 'kept' | 'removed' };

const owns = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const DEFAULT_RULES_KINDS: readonly string[] = ['design', 'diagram'];

function SceneSetupSession(props: SceneSetupDrawerProps) {
  const {
    open, onClose, initial, kinds, documents, devices, sceneKeys, elements, preview, pickedKey, saving, conflict, saveError,
  } = props;
  const m = useMemo(() => mergeMessages<SceneSetupMessages>(DEFAULT_SCENE_SETUP_MESSAGES, props.messages), [props.messages]);
  const uid = useId();

  // One snapshot of the saved binding feeds the form AND the baseline. A new `initial` while the form is untouched starts the form
  // over from it; while it has edits, the form keeps them and says the saved version changed (Reload takes the new one).
  const latest = seedFrom(initial, kinds);
  const [seed, setSeed] = useState<Seed>(latest);
  const [form, setForm] = useState<Form>(() => freshForm(latest));
  const [touched, setTouched] = useState(false);
  const newerSaved = latest.sig !== seed.sig;
  if (newerSaved && !touched) {
    setSeed(latest);
    setForm(freshForm(latest));
  }
  const edit = (fn: (f: Form) => Form): void => {
    setTouched(true);
    setForm(fn);
  };
  const reloadFromSaved = (): void => {
    setSeed(latest);
    setForm(freshForm(latest));
    setTouched(false);
  };
  const { slot, kind, documentId, manual, autoOn, note } = form;
  // What the saved setup holds for the kind the form is on: another kind's document, entries, view and rules are not this one's (a kind switch the host has not
  // answered yet, or a host that never answers, starts from nothing, not from the other kind's matching).
  const ks: Seed = useMemo(
    () => (kind === seed.kind ? seed : { ...seed, kind, documentId: '', map: {}, hidden: [], view: undefined, rules: undefined }),
    [kind, seed],
  );
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingKind, setPendingKind] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // closing with the person's own edits in the form asks first (Escape, the backdrop and Cancel alike; next-boilerplate E2E-1.10)
  const [confirmingClose, setConfirmingClose] = useState(false);
  const requestClose = (): void => {
    if (touched) setConfirmingClose(true);
    else onClose();
  };

  // ── Devices in the scene and their roles ──
  const savedDeviceIds = useMemo(() => new Set(Object.values(seed.devices)), [seed.devices]);
  const included = (id: string): boolean => form.include[id] ?? (savedDeviceIds.size === 0 || savedDeviceIds.has(id));
  const includedDevices = useMemo(
    () => devices.filter((d) => form.include[d.id] ?? (savedDeviceIds.size === 0 || savedDeviceIds.has(d.id))),
    [devices, form.include, savedDeviceIds],
  );
  const initialRoleOf = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [role, deviceId] of Object.entries(seed.devices)) out[deviceId] = role;
    return out;
  }, [seed.devices]);
  const proposed = useMemo(() => proposeRoles(includedDevices, props.roles), [includedDevices, props.roles]);
  const roleMap = useMemo(
    () => Object.fromEntries(devices.map((d) => [d.id, form.roleEdits[d.id] ?? initialRoleOf[d.id] ?? d.role ?? proposed[d.id] ?? MAIN_ROLE])),
    [devices, form.roleEdits, initialRoleOf, proposed],
  );
  const roleTable = useMemo(
    () => devicesFromRoles(includedDevices.map((d) => ({ deviceId: d.id, role: roleMap[d.id] }))),
    [includedDevices, roleMap],
  );
  const devMap = roleTable.devices;
  const roleIssues = roleTable.issues;

  // ── Loading: the keys of the CHOSEN document must be in before anything is saved ──
  const keysForOther = props.sceneKeysDocumentId !== undefined && !!documentId && props.sceneKeysDocumentId !== documentId;
  const loading = !!(props.documentsLoading || props.devicesLoading || props.sceneKeysLoading || props.elementsLoading || keysForOther);

  // ── Saved entries the scene has no row for ──
  const stale = useMemo(
    () => staleEntries({ sceneKeys, deviceIds: devices.map((d) => d.id), map: ks.map, devices: seed.devices, hidden: ks.hidden }),
    [sceneKeys, devices, seed.devices, ks],
  );
  const staleRows: StaleRow[] = useMemo(() => {
    if (loading) return [];
    const rows: StaleRow[] = [];
    const state = (id: string): 'kept' | 'removed' => (form.removedStale[id] ? 'removed' : 'kept');
    // a device by its NAME when the host lists it (never a bare id on screen, E2E-2.18); the subject's one device when the entry names none
    const nameOf = (deviceId: string | undefined): string => {
      const id = deviceId ?? (devices.length === 1 ? devices[0].id : '');
      return devices.find((d) => d.id === id)?.label ?? m.unknownDevice;
    };
    for (const k of stale.exceptions) {
      const ref = ks.map[k];
      // a stale entry with a field map and no element names its fields where the element would be (the drawer of phase 45.4 shows them properly)
      rows.push({ id: `exception:${k}`, type: 'exception', typeLabel: m.staleKind.exception, ref: k, name: k, detail: m.staleExceptionDetail(nameOf(ref.deviceId), ref.element ?? Object.keys(ref.fields ?? {}).join(', ')), state: state(`exception:${k}`) });
    }
    for (const r of stale.roles) {
      // a role is a code nobody chose: the row names its device ("Fryer 1"), never "d1" (next-boilerplate e2e round 5, V2-B2)
      const device = devices.find((d) => d.id === seed.devices[r])?.label ?? props.deviceNames?.[seed.devices[r] ?? ''] ?? m.unknownDevice;
      rows.push({ id: `role:${r}`, type: 'role', typeLabel: m.staleKind.role, ref: r, name: device, detail: m.staleRoleDetail(device), state: state(`role:${r}`) });
    }
    for (const k of stale.hidden) {
      rows.push({ id: `hidden:${k}`, type: 'hidden', typeLabel: m.staleKind.hidden, ref: k, name: k, detail: m.staleHiddenDetail, state: state(`hidden:${k}`) });
    }
    return rows;
  }, [loading, stale, seed.devices, ks, form.removedStale, m, devices, props.deviceNames]);
  const staleKept = staleRows.filter((r) => r.state === 'kept');
  const carryMap = useMemo(
    () => Object.fromEntries(staleKept.filter((r) => r.type === 'exception').map((r) => [r.ref, ks.map[r.ref]])),
    [staleKept, ks.map],
  );
  const carryDevices = useMemo(
    () => Object.fromEntries(staleKept.filter((r) => r.type === 'role').map((r) => [r.ref, seed.devices[r.ref]])),
    [staleKept, seed.devices],
  );
  // A removed stale hidden key leaves `hidden`; the others stay (a live key's hide is the user's own choice).
  const hiddenKeys = useMemo(() => form.hidden.filter((k) => !form.removedStale[`hidden:${k}`]), [form.hidden, form.removedStale]);
  const hiddenSet = useMemo(() => new Set(hiddenKeys), [hiddenKeys]);
  // The field maps of the LIVE keys (phase 45, D45-3): not edited here, written out as they are on top of each key's match; a stale key's goes with its whole entry (`carryMap`).
  const liveFields = useMemo(() => {
    const live = new Set(sceneKeys.map((k) => k.key));
    return Object.fromEntries(Object.entries(fieldsOfMap(ks.map)).filter(([k]) => live.has(k)));
  }, [sceneKeys, ks.map]);

  // ── Matching ──
  const sceneRoles = props.roles;
  const base = useMemo(
    () => autoMatch(sceneKeys, elements, { devices: devMap, roles: sceneRoles, steps: ['key'], skip: hiddenSet }),
    [sceneKeys, elements, devMap, sceneRoles, hiddenSet],
  );
  /** The elements hand picks hold (a pick of a key the scene no longer has, or of a key left out, holds none). */
  const claimedRefs = (): DeviceRef[] => {
    const live = new Set(sceneKeys.map((k) => k.key));
    return Object.entries(manual).filter(([k, r]) => !!r && live.has(k) && !hiddenSet.has(k)).map(([, r]) => r as DeviceRef);
  };
  const auto = useMemo(() => {
    if (!autoOn) return null;
    const settled = new Set([...Object.keys(manual), ...hiddenSet]);
    const live = new Set(sceneKeys.map((k) => k.key));
    const claimed = Object.entries(manual).filter(([k, r]) => !!r && live.has(k) && !hiddenSet.has(k)).map(([, r]) => r as DeviceRef);
    return autoMatch(sceneKeys, elements, { devices: devMap, roles: sceneRoles, skip: settled, claimed });
  }, [autoOn, manual, hiddenSet, sceneKeys, elements, devMap, sceneRoles]);

  const baseOf = useMemo(() => new Map(base.map((b) => [b.key, b] as const)), [base]);
  const rows: KeyRow[] = useMemo(
    () =>
      sceneKeys.map((k, i) => {
        const m0 = owns(manual, k.key) ? manual[k.key] : undefined;
        let how: MatchHow = 'none';
        let ref: DeviceRef | null = null;
        if (hiddenSet.has(k.key)) {
          how = 'hidden';
        } else if (m0) {
          how = 'manual';
          ref = m0;
        } else if (base[i].element !== null) {
          how = 'key';
          ref = { deviceId: base[i].deviceId ?? '', element: base[i].element! };
        } else if (m0 === undefined && auto && auto[i].element !== null) {
          how = auto[i].how;
          ref = { deviceId: auto[i].deviceId ?? '', element: auto[i].element };
        }
        const label = k.label ?? '';
        return {
          key: k.key, label, kind: k.kind, role: base[i].role, deviceId: ref?.deviceId ?? null, element: ref?.element ?? null, how,
          find: `${k.key} ${label} ${ref?.element ?? ''}`,
        };
      }),
    [sceneKeys, manual, base, auto, hiddenSet],
  );
  const pending = rows.filter((r) => r.how === 'type');

  // ── Rules (phase 42.6): edited only for a kind that has the step; otherwise, and until the step is used, the saved ones pass through ──
  const rulesKinds = props.rulesKinds ?? DEFAULT_RULES_KINDS;
  const rulesStep = rulesKinds.includes(kind);
  const draftRules: BindingDraft['rules'] = rulesStep && form.rules !== undefined ? (form.rules.length > 0 ? (form.rules as Array<Record<string, unknown>>) : null) : ks.rules;
  const ruleList: readonly unknown[] = form.rules ?? (Array.isArray(ks.rules) ? ks.rules : []);
  const ruleDialect = kind === 'diagram' ? 'diagram' : 'design';

  // ── The payload, what is open, what may be saved ──
  const accepted = useMemo(
    () => rows.filter((r) => r.element !== null && r.how !== 'type').map((r) => ({ key: r.key, element: r.element, deviceId: r.deviceId })),
    [rows],
  );
  const draft = useMemo(
    () => bindingDraft({
      documentId, slot, kind, devices: devMap, matches: accepted, hidden: hiddenKeys, view: ks.view, rules: draftRules, carryMap, carryDevices, fields: liveFields,
    }),
    [documentId, slot, kind, devMap, accepted, hiddenKeys, ks.view, draftRules, carryMap, carryDevices, liveFields],
  );
  const baseline = useMemo<BindingDraft>(
    () => ({
      documentId: seed.documentId, slot: seed.slot, kind: seed.kind, devices: seed.devices, map: seed.map, hidden: seed.hidden,
      view: seed.view, rules: seed.rules,
    }),
    [seed],
  );
  const changed = !sameDraft(draft, baseline);
  // a changed drawing is a reason to save an otherwise unchanged setup (the fingerprint is renewed), until another document is chosen
  const reviewDrawing = !!props.documentChanged && documentId === ks.documentId && !!documentId;
  const left = useMemo(
    () => unresolved({ sceneKeys, elements, devices: devMap, roles: sceneRoles, hidden: hiddenKeys, matches: accepted, fields: liveFields }),
    [sceneKeys, elements, devMap, sceneRoles, hiddenKeys, accepted, liveFields],
  );
  const issues = useMemo(() => {
    const all: BindingIssue[] = [...roleIssues, ...validateDraft(draft)];
    // A kept stale role must not take the name of a role a listed device now has.
    for (const r of staleKept) if (r.type === 'role' && owns(devMap, r.ref)) all.push({ code: 'role-duplicate', subject: r.ref });
    const seen = new Set<string>();
    return all.filter((i) => {
      const id = `${i.code}\u0000${i.subject ?? ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [draft, roleIssues, staleKept, devMap]);
  const canSave = (changed || reviewDrawing) && issues.length === 0 && !loading && !saving;
  const stuck = loading ? m.waitForData : issues.length ? m.issue[issues[0].code](issues[0].subject) : !changed && !reviewDrawing ? m.nothingChanged : '';
  const unmatchedStaying = left.keys.length - pending.length;
  // a saved setup is what the form is on: the one `initial` holds (a document), under the kind it names (the slot is always the host's)
  const removable = !!props.onRemove && !!seed.documentId && slot === seed.slot && kind === seed.kind;
  // the view by its drawing, never by its slot (phase 47): the host's name for it, else the saved document's, else the kind's word
  const viewTitle = props.viewName || documents.find((d) => d.id === seed.documentId)?.name || (m.kinds[seed.kind] ?? seed.kind);

  // ── Handlers ──
  // A kind is a choice of which setup this is: the form starts over from the saved setup of that kind (the host answers with `initial` and a new
  // `resetKey`; without an answer the form shows an empty one). With edits in the form that is asked first.
  const applyKind = (k: string) => {
    setForm((f) => ({
      ...f, kind: k, documentId: k === seed.kind ? seed.documentId : '', manual: k === seed.kind ? manualOfMap(seed.map) : {}, hidden: k === seed.kind ? [...seed.hidden] : [],
      removedStale: {}, rules: undefined, autoOn: false, note: '',
    }));
    setPickingKey(null);
    props.onKindChange?.(k);
  };
  const requestKind = (k: string) => {
    if (k === kind || props.kindLocked) return;
    if (touched) { setPendingKind(k); return; }
    applyKind(k);
  };
  const selectDocument = (id: string) => {
    if (id === documentId) return;
    edit((f) => ({ ...f, documentId: id }));
    props.onDocumentChange?.(id);
  };
  const newFromDevice = async (): Promise<void> => {
    try {
      const id = await props.onNewFromDevice?.();
      if (typeof id === 'string' && id) selectDocument(id);
    } catch {
      // the host reports its own failure; nothing is chosen
    }
  };
  const refsFor = (r: KeyRow): DeviceRef[] =>
    elementsForRole(r.role, elements, devMap).flatMap((e) => {
      const deviceId = e.deviceId || (owns(devMap, r.role) ? devMap[r.role] : undefined);
      return deviceId ? [{ deviceId, element: e.element }] : [];
    });
  const choose = (r: KeyRow, ref: DeviceRef | null) => {
    edit((f) => {
      const next = { ...f.manual };
      const b = baseOf.get(r.key);
      const identity = !!b && b.element !== null && !!ref && ref.element === b.element && ref.deviceId === b.deviceId;
      if (identity) delete next[r.key];
      else next[r.key] = ref;
      return { ...f, manual: next };
    });
  };
  const accept = (r: KeyRow) => {
    if (r.element !== null) choose(r, { deviceId: r.deviceId ?? '', element: r.element });
  };
  const acceptAll = () => {
    edit((f) => {
      const next = { ...f.manual };
      for (const r of pending) next[r.key] = { deviceId: r.deviceId ?? '', element: r.element! };
      return { ...f, manual: next };
    });
  };
  const leaveOut = (key: string) => edit((f) => ({ ...f, hidden: f.hidden.includes(key) ? f.hidden : [...f.hidden, key] }));
  const bindAgain = (key: string) => edit((f) => ({ ...f, hidden: f.hidden.filter((k) => k !== key) }));
  const toggleStale = (id: string) => edit((f) => {
    const removedStale = { ...f.removedStale };
    if (removedStale[id]) delete removedStale[id];
    else removedStale[id] = true;
    return { ...f, removedStale };
  });
  const runAuto = () => {
    const settled = new Set([...Object.entries(manual).filter(([, v]) => v).map(([k]) => k), ...hiddenSet]);
    const result = autoMatch(sceneKeys, elements, { devices: devMap, roles: sceneRoles, skip: settled, claimed: claimedRefs() });
    // What this press found: the identity matches were there already.
    const found = result.filter((r) => r.element !== null && r.how !== 'key');
    // A key cleared by hand is matched again; a key picked by hand stays.
    edit((f) => ({
      ...f, manual: Object.fromEntries(Object.entries(f.manual).filter(([, v]) => v !== null)), autoOn: true,
      note: m.matchedAuto(found.length, found.filter((r) => r.how === 'type').length),
    }));
  };
  const pick = (key: string) => {
    const next = pickingKey === key ? null : key;
    setPickingKey(next);
    props.onPick?.(next);
  };

  // The key the host reports picked ends a pick in progress, and its element field takes focus.
  const [seenPicked, setSeenPicked] = useState(pickedKey);
  if (pickedKey !== seenPicked) {
    setSeenPicked(pickedKey);
    if (pickedKey) setPickingKey(null);
  }
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickedKey) return;
    const t = window.setTimeout(() => strip.current?.querySelector<HTMLElement>('select, [role="combobox"]')?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [pickedKey]);
  const pickedRow = pickedKey ? rows.find((r) => r.key === pickedKey) : undefined;

  // ── Tables ──
  const docRows: DocRow[] = documents.map((d) => ({
    id: d.id, name: d.name, updatedAt: d.updatedAt ?? '', usedBy: d.usedBy ?? 0, use: (d.usedBy ?? 0) > 0 ? 'used' : 'unused',
  }));
  const docColumns: Column<DocRow>[] = [
    {
      key: 'pick', header: <span className="sr-only">{m.documentPick}</span>, width: '2.5rem', hideable: false,
      render: (r) => (
        <input
          type="radio" name={`${uid}-doc`} checked={documentId === r.id} onChange={() => selectDocument(r.id)}
          aria-label={m.documentUse(r.name)}
          className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
      ),
    },
    { key: 'name', header: m.documentName, sortable: true },
    { key: 'updatedAt', header: m.documentUpdated, sortable: true, hideBelow: 'sm', render: (r) => formatDate(r.updatedAt, props.locale), searchable: false },
    { key: 'usedBy', header: m.documentUsedBy, sortable: true, align: 'right', render: (r) => m.usedBy(r.usedBy), searchable: false },
  ];
  const docFilters: DataTableFilterField<DocRow>[] = [{
    id: 'use', label: m.documentFilterUse, type: 'radio', anyLabel: m.documentFilterAny, placement: 'toolbar',
    options: [{ value: 'used', label: m.documentFilterUsed }, { value: 'unused', label: m.documentFilterUnused }],
  }];

  const deviceRows: DeviceRow[] = devices.map((d) => {
    const role = roleMap[d.id];
    return { id: d.id, label: d.label, code: d.code ?? '', role, roleKind: role === MAIN_ROLE ? 'main' : 'named', included: included(d.id) };
  });
  const roleInvalid = new Set(roleIssues.filter((i) => i.code === 'role-invalid' || i.code === 'role-duplicate').map((i) => i.subject));
  const deviceColumns: Column<DeviceRow>[] = [
    { key: 'label', header: m.deviceName, sortable: true },
    { key: 'code', header: m.deviceCode, sortable: true, hideBelow: 'sm' },
    {
      key: 'included', header: m.deviceInclude, width: '6rem', searchable: false, hideable: false,
      render: (r) => (
        <input
          type="checkbox" checked={r.included} aria-label={m.includeOf(r.label)}
          onChange={(e) => { const on = e.target.checked; edit((f) => ({ ...f, include: { ...f.include, [r.id]: on } })); }}
          className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
      ),
    },
    {
      key: 'role', header: m.deviceRole, width: '12rem', searchable: false, hideable: false,
      render: (r) => (
        <Input
          id={`${uid}-role-${r.id}`} label={m.roleOf(r.label)} hideLabel value={r.role} placeholder={m.mainRole}
          maxLength={48} spellCheck={false} autoComplete="off" disabled={!r.included}
          aria-invalid={r.included && roleInvalid.has(r.role)}
          onChange={(e) => { const v = e.target.value; edit((f) => ({ ...f, roleEdits: { ...f.roleEdits, [r.id]: v } })); }}
        />
      ),
    },
  ];
  const deviceFilters: DataTableFilterField<DeviceRow>[] = [{
    id: 'roleKind', label: m.roleFilter, type: 'radio', anyLabel: m.roleFilterAny, placement: 'toolbar',
    options: [{ value: 'main', label: m.roleFilterMain }, { value: 'named', label: m.roleFilterNamed }],
  }];

  const elementField = (r: KeyRow, id: string, hideLabel = true, label = m.elementOf(r.key)): ReactNode => {
    const refs = refsFor(r);
    const options: SelectOption[] = refs.map((ref, i) => {
      const e = elements.find((x) => x.element === ref.element && (x.deviceId || ref.deviceId) === ref.deviceId);
      return { value: String(i), label: e?.label && e.label !== e.element ? `${e.label} (${e.element})` : ref.element };
    });
    let current = r.element === null ? -1 : refs.findIndex((x) => x.deviceId === r.deviceId && x.element === r.element);
    if (r.element !== null && current < 0) {
      options.push({ value: String(options.length), label: m.elementMissing(r.element) });
      refs.push({ deviceId: r.deviceId ?? '', element: r.element });
      current = refs.length - 1;
    }
    const identity = baseOf.get(r.key)?.element != null;
    const leftOut = r.how === 'hidden';
    // An element with no device belongs to the main role only when the main role has one; a role with no device offers nothing.
    const noDevice = !owns(devMap, r.role);
    return (
      <Select
        id={id} label={label} hideLabel={hideLabel} options={options}
        placeholder={identity && !leftOut ? undefined : m.elementNone}
        disabled={noDevice || leftOut || options.length === 0}
        hint={noDevice && !leftOut ? m.noDeviceForRole(r.role) : undefined}
        value={current < 0 ? '' : String(current)}
        onChange={(e) => {
          const v = e.target.value;
          choose(r, v === '' ? null : refs[Number(v)] ?? null);
        }}
      />
    );
  };

  const keyColumns: Column<KeyRow>[] = [
    {
      key: 'key', header: m.keyColumn, sortable: true,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block font-mono text-xs text-text-primary break-all">{r.key}</span>
          {r.label && r.label !== r.key && <span className="block text-xs text-text-secondary">{r.label}</span>}
        </span>
      ),
    },
    { key: 'kind', header: m.kindColumn, sortable: true, hideBelow: 'md', searchable: false },
    {
      key: 'how', header: m.statusColumn, sortable: true, searchable: false,
      render: (r) => <Badge variant={HOW_VARIANT[r.how]} size="sm">{m.status[r.how]}</Badge>,
    },
    { key: 'element', header: m.elementColumn, width: '14rem', searchable: false, hideable: false, render: (r) => elementField(r, `${uid}-el-${r.key}`) },
    {
      key: 'actions', header: <span className="sr-only">{m.actionsColumn}</span>, searchable: false, hideable: false, align: 'right',
      render: (r) => (
        <span className="inline-flex flex-wrap justify-end gap-1">
          {r.how === 'type' && (
            <Button size="xs" variant="primary" aria-label={m.acceptOf(r.key)} iconLeft={<FontAwesomeIcon icon={faCheck} aria-hidden="true" />} onClick={() => accept(r)}>
              {m.accept}
            </Button>
          )}
          <Button
            size="xs" variant="outline" aria-label={r.how === 'hidden' ? m.bindAgainOf(r.key) : m.dontBindOf(r.key)}
            onClick={() => (r.how === 'hidden' ? bindAgain(r.key) : leaveOut(r.key))}
          >
            {r.how === 'hidden' ? m.bindAgain : m.dontBind}
          </Button>
          {props.onPick && elements.length > 0 && (
            <Button
              size="xs" variant="outline" aria-label={m.pickOf(r.key)} aria-pressed={pickingKey === r.key}
              iconLeft={<FontAwesomeIcon icon={faCrosshairs} aria-hidden="true" />} onClick={() => pick(r.key)}
            >
              {m.pick}
            </Button>
          )}
        </span>
      ),
    },
  ];
  const staleColumns: Column<StaleRow>[] = [
    { key: 'typeLabel', header: m.staleTypeColumn, sortable: true },
    { key: 'name', header: m.staleNameColumn, sortable: true, render: (r) => <span className={cn('text-xs break-all', r.type !== 'role' && 'font-mono')}>{r.name}</span> },
    { key: 'detail', header: m.staleDetailColumn, hideBelow: 'md', render: (r) => <span className="text-xs break-all">{r.detail}</span> },
    {
      key: 'state', header: m.staleStateColumn, sortable: true, searchable: false,
      render: (r) => <Badge variant={r.state === 'kept' ? 'warning' : 'neutral'} size="sm">{r.state === 'kept' ? m.staleKept : m.staleRemoved}</Badge>,
    },
    {
      key: 'actions', header: <span className="sr-only">{m.actionsColumn}</span>, searchable: false, hideable: false, align: 'right',
      render: (r) => (
        <Button
          size="xs" variant="outline" onClick={() => toggleStale(r.id)}
          aria-label={r.state === 'kept' ? m.staleRemoveOf(r.typeLabel, r.name) : m.staleKeepOf(r.typeLabel, r.name)}
        >
          {r.state === 'kept' ? m.staleRemove : m.staleKeep}
        </Button>
      ),
    },
  ];
  const keyFilters: DataTableFilterField<KeyRow>[] = [{
    id: 'how', label: m.statusFilter, type: 'select', placeholder: m.statusAny, placement: 'toolbar',
    options: HOWS.map((h) => ({ value: h, label: m.status[h] })),
  }];

  const needsAck = left.keys.length > 0 || staleKept.length > 0;
  const confirmText = m.confirmMessage(kind, Object.keys(draft.map).length, left.keys.length);
  // the devices offer nothing this table matches (flat keys, or nothing sent yet): say where the symbols are connected instead of a greyed table
  const noElements = !loading && !!documentId && sceneKeys.length > 0 && includedDevices.length > 0 && elements.length === 0;
  // `choose` mode (E2E-2.1): the form is "which drawing?"; Save writes at once (nothing to acknowledge: the symbols are connected on the drawing),
  // unless the saved setup is newer than the one the form started from, which still asks
  const chooseMode = (props.mode ?? 'full') === 'choose';
  // in choose mode the sections sit under Advanced without the document's: their numbers would read 1, 3, 4 (next-boilerplate e2e round 3, m-R3-08)
  const sectionTitle = (text: string): string => (chooseMode ? text.replace(/^\d+\.\s*/, '') : text);
  const [advancedOpen, setAdvancedOpen] = useState(!!props.openAdvanced);
  // opened to review a changed drawing: the list of what no longer matches is brought into view once, when it is first drawn
  const staleBox = useRef<HTMLDivElement>(null);
  const staleShown = useRef(false);
  const staleDrawn = chooseMode && advancedOpen && staleRows.length > 0;
  useEffect(() => {
    if (!props.openAdvanced || !staleDrawn || staleShown.current || !staleBox.current) return;
    staleShown.current = true;
    // jsdom and older engines have no scrollIntoView
    if (typeof staleBox.current.scrollIntoView === 'function') staleBox.current.scrollIntoView({ block: 'start' });
  }, [props.openAdvanced, staleDrawn]);
  const saveNow = (): void => {
    if (chooseMode && !conflict) props.onSave(draft, { reason: '' });
    else setConfirming(true);
  };

  // the type of the view (a 2D drawing or a 3D view); in `choose` mode a type the host locked is the host's choice and the section is not drawn at all
  const kindSection = chooseMode && props.kindLocked ? null : (
    <section aria-labelledby={`${uid}-h1`} className="space-y-3">
      <h3 id={`${uid}-h1`} className="text-sm font-semibold text-text-primary">{sectionTitle(m.kindSection)}</h3>
      <div role="group" aria-labelledby={`${uid}-kind`} className="space-y-1">
        <span id={`${uid}-kind`} className="block text-sm font-medium text-text-primary">{m.kindLabel}</span>
        <ButtonGroup
          size="sm" variant="outline" value={kind} onChange={requestKind}
          items={(props.kindLocked ? kinds.filter((k) => k === kind) : kinds).map((k) => ({ value: k, label: m.kinds[k] ?? k }))}
        />
        {props.kindLocked && <p className="text-xs text-text-secondary">{m.kindLockedHint}</p>}
      </div>
    </section>
  );

  const documentSection = (
    <section aria-labelledby={`${uid}-h2`} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${uid}-h2`} className="text-sm font-semibold text-text-primary">{chooseMode ? m.chooseSection : m.documentSection}</h3>
          <p className="text-xs text-text-secondary">{chooseMode ? m.chooseHint : m.documentHint}</p>
        </div>
        {props.onNewFromDevice && (
          <Button size="sm" variant="outline" loading={props.newFromDeviceBusy} iconLeft={<FontAwesomeIcon icon={faPlus} aria-hidden="true" />} onClick={() => void newFromDevice()}>
            {m.newFromDevice}
          </Button>
        )}
      </div>
      <DataTable<DocRow>
        id={`${uid}-docs`} mode="paginated" caption={chooseMode ? m.chooseSection : m.documentSection} columns={docColumns} rows={docRows} rowId={(r) => r.id}
        searchable searchPlaceholder={m.documentSearch} filterFields={docFilters} filtersLive
        pageSize={5} pageSizeOptions={[5, 10, 25]} initialSort={[{ key: 'updatedAt', dir: 'desc' }]} multiSort={false}
        density="compact" state={props.documentsLoading ? 'loading' : undefined} emptyMessage={chooseMode ? m.chooseEmpty : m.documentsEmpty}
        messages={{ loading: m.loading, ...props.tableMessages, search: m.documentSearch }} onRowClick={(r) => selectDocument(r.id)}
        rowClassName={(r) => (r.id === documentId ? 'bg-primary-subtle' : undefined)}
      />
      <p className="text-xs text-text-secondary">
        {documentId ? m.documentChosen(documents.find((d) => d.id === documentId)?.name ?? documentId) : m.noDocumentChosen}
      </p>
      {chooseMode && staleKept.length > 0 && <p className="text-xs text-text-secondary" data-testid="stale-choose-line">{m.staleChooseLine(staleKept.length)}</p>}
      {chooseMode && preview && (
        <div role="region" aria-label={m.previewLabel} className="min-w-0 rounded-lg border border-border bg-surface-base p-2">
          {preview}
        </div>
      )}
    </section>
  );

  const devicesSection = (
    <section aria-labelledby={`${uid}-h3`} className="space-y-3">
      <div>
        <h3 id={`${uid}-h3`} className="text-sm font-semibold text-text-primary">{sectionTitle(m.devicesSection)}</h3>
        <p className="text-xs text-text-secondary">{m.devicesHint}</p>
      </div>
      <DataTable<DeviceRow>
        id={`${uid}-devices`} mode="paginated" caption={sectionTitle(m.devicesSection)} columns={deviceColumns} rows={deviceRows} rowId={(r) => r.id}
        searchable searchPlaceholder={m.deviceSearch} filterFields={deviceFilters} filtersLive
        pageSize={10} pageSizeOptions={[10, 25, 100]} density="compact"
        state={props.devicesLoading ? 'loading' : undefined} emptyMessage={m.devicesEmpty}
        messages={{ loading: m.loading, ...props.tableMessages, search: m.deviceSearch }}
      />
      <p className="text-xs text-text-secondary">{m.roleHint}</p>
      <p role="status" className="text-xs text-text-secondary">{m.devicesIncluded(Object.keys(draft.devices).length, MAX_BINDING_DEVICES)}</p>
    </section>
  );

  const matchSection = (
    <section aria-labelledby={`${uid}-h4`} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${uid}-h4`} className="text-sm font-semibold text-text-primary">{sectionTitle(m.matchSection)}</h3>
          <p className="text-xs text-text-secondary">{m.matchHint}</p>
        </div>
        <Button
          size="sm" variant="outline" disabled={sceneKeys.length === 0 || elements.length === 0}
          iconLeft={<FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />} onClick={runAuto}
        >
          {m.matchAuto}
        </Button>
      </div>

      {noElements && (
        <div data-testid="match-no-elements">
          <AlertBanner variant="info" message={m.matchNoElements} />
        </div>
      )}

      <div className={cn('grid gap-4', preview && !chooseMode ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]' : undefined)}>
        <div className="min-w-0 space-y-3">
          {pickedRow && (
            <div ref={strip} className="rounded-lg border border-primary bg-primary-subtle p-3 space-y-2" data-testid="picked-strip">
              <p className="text-xs text-text-secondary">{m.pickedHint}</p>
              {elementField(pickedRow, `${uid}-picked`, false, m.picked(pickedRow.key))}
            </div>
          )}
          <DataTable<KeyRow>
            id={`${uid}-keys`} mode="paginated" caption={sectionTitle(m.matchSection)} columns={keyColumns} rows={rows} rowId={(r) => r.key}
            searchable searchText={(r) => r.find} searchPlaceholder={m.keySearch} filterFields={keyFilters} filtersLive
            pageSize={10} pageSizeOptions={[10, 25, 50]} density="compact"
            state={props.sceneKeysLoading ? 'loading' : undefined} emptyMessage={m.keysEmpty}
            messages={{ loading: m.loading, ...props.tableMessages, search: m.keySearch }}
            rowClassName={(r) => (r.key === pickedKey ? 'bg-primary-subtle' : undefined)}
          />
        </div>
        {preview && !chooseMode && (
          <div role="region" aria-label={m.previewLabel} className="min-w-0 rounded-lg border border-border bg-surface-base p-2">
            {preview}
          </div>
        )}
      </div>

      {staleRows.length > 0 && (
        <div ref={staleBox} className="space-y-2" data-testid="stale-entries">
          <div>
            <h4 className="text-sm font-medium text-text-primary">{m.staleSection}</h4>
            <p className="text-xs text-text-secondary">{m.staleHint}</p>
          </div>
          <DataTable<StaleRow>
            id={`${uid}-stale`} mode="paginated" caption={m.staleSection} columns={staleColumns} rows={staleRows} rowId={(r) => r.id}
            searchable searchPlaceholder={m.staleSearch} pageSize={10} pageSizeOptions={[10, 25, 50]} density="compact"
            emptyMessage={m.staleEmpty} messages={{ loading: m.loading, ...props.tableMessages, search: m.staleSearch }}
          />
        </div>
      )}

      <div className="space-y-1" role="status" aria-live="polite">
        <p className={cn('text-sm font-medium', left.keys.length ? 'text-warning-fg' : 'text-success-fg')}>
          {left.keys.length ? m.unresolvedKeys(left.keys.length) : sceneKeys.length ? m.allResolved : ''}
        </p>
        <ul className="space-y-0.5 text-xs text-text-secondary">
          {left.elements.length > 0 && <li>{m.unresolvedElements(left.elements.length)}</li>}
          {left.devices.length > 0 && <li>{m.unresolvedDevices(left.devices.length)}</li>}
          {left.roles.length > 0 && <li>{m.unresolvedRoles(left.roles)}</li>}
          {pending.length > 0 && <li>{m.pendingProposals(pending.length)}</li>}
          {staleKept.length > 0 && <li>{m.unresolvedStale(staleKept.length)}</li>}
          {note && <li>{note}</li>}
        </ul>
        {pending.length > 0 && (
          <Button size="xs" variant="outline" onClick={acceptAll}>{m.acceptAll(pending.length)}</Button>
        )}
      </div>
    </section>
  );

  const rulesSection = rulesStep ? (
    <section aria-labelledby={`${uid}-h5`} className="space-y-3">
      <div>
        <h3 id={`${uid}-h5`} className="text-sm font-semibold text-text-primary">{sectionTitle(m.rules.section)}</h3>
        <p className="text-xs text-text-secondary">{ruleDialect === 'diagram' ? m.rules.hint2d : m.rules.hint}</p>
      </div>
      <SceneSetupRules
        rules={ruleList} onChange={(next) => edit((f) => ({ ...f, rules: next }))} keys={sceneKeys} keysLoading={!!(props.sceneKeysLoading || keysForOther)}
        columns={props.ruleColumns ?? DESIGN_RULE_COLUMNS} params={props.ruleParams} messages={m.rules} dialect={ruleDialect}
      />
    </section>
  ) : null;

  return (
    <>
      <Drawer
        open={open}
        onClose={requestClose}
        title={chooseMode ? m.chooseTitle : m.title}
        closeLabel={m.close}
        portalTarget={props.portalTarget}
        // Full width on a phone, a wide panel from sm: the matching table needs the room.
        className={cn('w-full sm:w-[min(100vw,60rem)]', props.className)}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="min-w-0 flex-1 text-xs text-text-secondary">{stuck}</p>
            <div className="flex shrink-0 gap-2">
              {removable && (
                <Button variant="ghost" disabled={saving || props.removing} loading={props.removing} onClick={() => setConfirmingRemove(true)}>{m.removeButton}</Button>
              )}
              <Button variant="ghost" onClick={requestClose}>{m.cancel}</Button>
              <Button disabled={!canSave} loading={saving} onClick={saveNow}>{saving ? m.saving : m.save}</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-8">
          {newerSaved && (
            <AlertBanner
              variant="warning" title={m.savedChangedTitle} message={m.savedChangedBody}
              action={{ label: m.reload, onClick: reloadFromSaved }}
            />
          )}
          {conflict && (
            <AlertBanner
              variant="warning" title={m.conflictTitle} message={m.conflictBody}
              action={props.onReload ? { label: m.reload, onClick: props.onReload } : undefined}
            />
          )}
          {saveError && !conflict && <AlertBanner variant="error" title={m.saveFailed} message={saveError} />}
          {reviewDrawing && (
            <div data-testid="drawing-changed">
              <AlertBanner variant="warning" title={m.documentChangedTitle} message={m.documentChangedBody(loading ? 0 : staleKept.length)} />
            </div>
          )}

          {chooseMode ? (
            <>
              {documentSection}
              <details
                className="rounded-lg border border-border bg-surface-raised p-3" data-testid="scene-advanced" open={advancedOpen}
                onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer text-sm font-semibold text-text-primary">{m.advanced}</summary>
                <p className="mt-1 text-xs text-text-secondary">{m.advancedHint}</p>
                {advancedOpen && (
                  <div className="mt-4 space-y-8">
                    {kindSection}
                    {devicesSection}
                    {matchSection}
                    {rulesSection}
                  </div>
                )}
              </details>
            </>
          ) : (
            <>
              {kindSection}
              {documentSection}
              {devicesSection}
              {matchSection}
              {rulesSection}
            </>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={pendingKind !== null && open}
        portalTarget={props.portalTarget}
        title={m.kindSwitchTitle}
        message={m.kindSwitchBody(m.kinds[pendingKind ?? ''] ?? pendingKind ?? '')}
        tone="warning"
        confirmLabel={m.kindSwitchConfirm}
        cancelLabel={m.cancel}
        onCancel={() => setPendingKind(null)}
        onConfirm={() => {
          const next = pendingKind;
          setPendingKind(null);
          if (next !== null) applyKind(next);
        }}
      />

      <ConfirmDialog
        open={confirmingClose && open}
        portalTarget={props.portalTarget}
        title={m.discardTitle}
        message={m.discardBody}
        tone="warning"
        confirmLabel={m.discardConfirm}
        cancelLabel={m.discardKeep}
        onCancel={() => setConfirmingClose(false)}
        onConfirm={() => {
          setConfirmingClose(false);
          onClose();
        }}
      />

      <ConfirmDialog
        open={confirmingRemove && open}
        portalTarget={props.portalTarget}
        title={m.removeTitle}
        message={m.removeBody(m.kinds[seed.kind] ?? seed.kind, viewTitle)}
        tone="danger"
        confirmLabel={m.removeConfirm}
        cancelLabel={m.cancel}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() => {
          setConfirmingRemove(false);
          void props.onRemove?.({ slot: seed.slot, kind: seed.kind });
        }}
      />

      <ConfirmDialog
        open={confirming && open}
        portalTarget={props.portalTarget}
        title={m.confirmTitle}
        message={conflict ? `${m.conflictBody} ${confirmText}` : confirmText}
        tone={conflict ? 'warning' : 'default'}
        confirmLabel={m.confirmButton}
        cancelLabel={m.cancel}
        input={props.askReason ? { kind: 'text', label: m.reasonLabel, placeholder: m.reasonPlaceholder, maxLength: 200 } : undefined}
        acknowledgement={needsAck || pending.length > 0 ? m.acknowledge(unmatchedStaying, pending.length, staleKept.length) : undefined}
        onCancel={() => setConfirming(false)}
        onConfirm={(result) => {
          setConfirming(false);
          props.onSave(draft, { reason: result.value });
        }}
      />
    </>
  );
}
