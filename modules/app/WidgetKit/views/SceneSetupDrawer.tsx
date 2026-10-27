'use client';
// The scene setup drawer (next-boilerplate phase 42, D42-10): one scrolling form in a right-side drawer that binds a scene
// document to the devices that feed it. Sections, no tabs: (1) slot and kind, (2) the document, (3) devices and roles,
// (4) matching scene keys to device elements, and the save through the kit's ConfirmDialog from the footer.
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
  MAIN_ROLE, autoMatch, bindingDraft, devicesFromRoles, elementsForRole, proposeRoles, sameDraft, unresolved, validateDraft,
  type BindingDraft, type BindingIssue, type DeviceElement, type DeviceRef, type MatchHow, type SceneKey,
} from './scene-binding-logic';
import { DEFAULT_SCENE_SETUP_MESSAGES, mergeMessages, type DeepPartial, type SceneSetupMessages } from './scene-setup-messages';

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

export interface SceneSetupDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The saved binding when there is one, or what the card menu pre-sets (slot, kind). Read when the drawer opens. */
  initial?: Partial<BindingDraft>;

  /** Slot choices; without them the slot is a text field. */
  slots?: readonly { value: string; label: string }[];
  /** The kinds the host can bind, as values (`diagram`, `design`); labels come from `messages.kinds`. */
  kinds: readonly string[];
  onSlotChange?: (slot: string) => void;
  onKindChange?: (kind: string) => void;

  documents: readonly SceneSetupDocument[];
  documentsLoading?: boolean;
  /** A document was chosen: load its keys into `sceneKeys`. */
  onDocumentChange?: (documentId: string) => void;
  /** Adds the "New from this device" button. */
  onNewFromDevice?: () => void;
  newFromDeviceBusy?: boolean;

  devices: readonly SceneSetupDevice[];
  devicesLoading?: boolean;
  /** The roles the scene's keys use as a prefix, when the document says; each needs a device. */
  roles?: readonly string[];

  sceneKeys: readonly SceneKey[];
  sceneKeysLoading?: boolean;
  elements: readonly DeviceElement[];
  elementsLoading?: boolean;

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
  /** A change starts the form over from `initial` (after a reload); the form is also fresh each time the drawer opens. */
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
type DeviceRow = { id: string; label: string; code: string; role: string; roleKind: 'main' | 'named' };

const HOW_VARIANT: Record<MatchHow, 'success' | 'info' | 'warning' | 'primary' | 'error'> = {
  key: 'success', label: 'info', type: 'warning', manual: 'primary', none: 'error',
};
const HOWS: MatchHow[] = ['key', 'label', 'type', 'manual', 'none'];


function formatDate(iso: string | undefined, locale?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString(locale, { dateStyle: 'medium', timeStyle: iso.length > 10 ? 'short' : undefined });
}

function SceneSetupSession(props: SceneSetupDrawerProps) {
  const {
    open, onClose, initial, slots, kinds, documents, devices, sceneKeys, elements, preview, pickedKey, saving, conflict, saveError,
  } = props;
  const m = useMemo(() => mergeMessages<SceneSetupMessages>(DEFAULT_SCENE_SETUP_MESSAGES, props.messages), [props.messages]);
  const uid = useId();

  const [slot, setSlot] = useState(initial?.slot ?? '');
  const [kind, setKind] = useState(initial?.kind ?? kinds[0] ?? '');
  const [documentId, setDocumentId] = useState(initial?.documentId ?? '');
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<Record<string, DeviceRef | null>>(() => ({ ...(initial?.map ?? {}) }));
  const [autoOn, setAutoOn] = useState(false);
  const [note, setNote] = useState('');
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // ── Roles ──
  const initialRoleOf = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [role, deviceId] of Object.entries(initial?.devices ?? {})) out[deviceId] = role;
    return out;
  }, [initial?.devices]);
  const proposed = useMemo(() => proposeRoles(props.devices, props.roles), [props.devices, props.roles]);
  const roleMap = useMemo(
    () => Object.fromEntries(devices.map((d) => [d.id, roleEdits[d.id] ?? initialRoleOf[d.id] ?? d.role ?? proposed[d.id] ?? MAIN_ROLE])),
    [devices, roleEdits, initialRoleOf, proposed],
  );
  const roleTable = useMemo(() => devicesFromRoles(devices.map((d) => ({ deviceId: d.id, role: roleMap[d.id] }))), [devices, roleMap]);
  const devMap = roleTable.devices;
  const roleIssues = roleTable.issues;

  // ── Matching ──
  const sceneRoles = props.roles;
  const base = useMemo(
    () => autoMatch(sceneKeys, elements, { devices: devMap, roles: sceneRoles, steps: ['key'] }),
    [sceneKeys, elements, devMap, sceneRoles],
  );
  const auto = useMemo(() => {
    if (!autoOn) return null;
    const settled = new Set(Object.keys(manual));
    const claimed = Object.values(manual).filter((r): r is DeviceRef => !!r);
    return autoMatch(sceneKeys, elements, { devices: devMap, roles: sceneRoles, skip: settled, claimed });
  }, [autoOn, manual, sceneKeys, elements, devMap, sceneRoles]);

  const baseOf = useMemo(() => new Map(base.map((b) => [b.key, b] as const)), [base]);
  const rows: KeyRow[] = useMemo(
    () =>
      sceneKeys.map((k, i) => {
        const m0 = Object.prototype.hasOwnProperty.call(manual, k.key) ? manual[k.key] : undefined;
        let how: MatchHow = 'none';
        let ref: DeviceRef | null = null;
        if (m0) {
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
    [sceneKeys, manual, base, auto],
  );
  const pending = rows.filter((r) => r.how === 'type');

  // ── The payload, what is open, what may be saved ──
  const accepted = useMemo(
    () => rows.filter((r) => r.element !== null && r.how !== 'type').map((r) => ({ key: r.key, element: r.element, deviceId: r.deviceId })),
    [rows],
  );
  const draft = useMemo(
    () => bindingDraft({ documentId, slot, kind, devices: devMap, matches: accepted, hidden: initial?.hidden }),
    [documentId, slot, kind, devMap, accepted, initial?.hidden],
  );
  const baseline = useMemo<BindingDraft>(
    () => ({
      documentId: initial?.documentId ?? '', slot: initial?.slot ?? '', kind: initial?.kind ?? '',
      devices: initial?.devices ?? {}, map: initial?.map ?? {}, hidden: initial?.hidden ?? [],
    }),
    [initial],
  );
  const changed = !sameDraft(draft, baseline);
  const left = useMemo(
    () => unresolved({ sceneKeys, elements, devices: devMap, roles: sceneRoles, hidden: initial?.hidden, matches: accepted }),
    [sceneKeys, elements, devMap, sceneRoles, initial?.hidden, accepted],
  );
  const issues = useMemo(() => {
    const all: BindingIssue[] = [...roleIssues, ...validateDraft(draft)];
    const seen = new Set<string>();
    return all.filter((i) => {
      const id = `${i.code}\u0000${i.subject ?? ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [draft, roleIssues]);
  const loading = !!(props.documentsLoading || props.devicesLoading || props.sceneKeysLoading || props.elementsLoading);
  const canSave = changed && issues.length === 0 && !loading && !saving;
  const stuck = loading ? m.waitForData : issues.length ? m.issue[issues[0].code](issues[0].subject) : !changed ? m.nothingChanged : '';
  const unmatchedStaying = left.keys.length - pending.length;

  // ── Handlers ──
  const setKindTo = (k: string) => { setKind(k); props.onKindChange?.(k); };
  const setSlotTo = (s: string) => { setSlot(s); props.onSlotChange?.(s); };
  const selectDocument = (id: string) => {
    if (id === documentId) return;
    setDocumentId(id);
    props.onDocumentChange?.(id);
  };
  const refsFor = (r: KeyRow): DeviceRef[] =>
    elementsForRole(r.role, elements, devMap).flatMap((e) => {
      const deviceId = e.deviceId ?? (Object.prototype.hasOwnProperty.call(devMap, r.role) ? devMap[r.role] : undefined);
      return deviceId === undefined ? [] : [{ deviceId, element: e.element }];
    });
  const choose = (r: KeyRow, ref: DeviceRef | null) => {
    setManual((cur) => {
      const next = { ...cur };
      const b = baseOf.get(r.key);
      const identity = !!b && b.element !== null && !!ref && ref.element === b.element && ref.deviceId === b.deviceId;
      if (identity) delete next[r.key];
      else next[r.key] = ref;
      return next;
    });
  };
  const accept = (r: KeyRow) => {
    if (r.element !== null) choose(r, { deviceId: r.deviceId ?? '', element: r.element });
  };
  const acceptAll = () => {
    setManual((cur) => {
      const next = { ...cur };
      for (const r of pending) next[r.key] = { deviceId: r.deviceId ?? '', element: r.element! };
      return next;
    });
  };
  const runAuto = () => {
    // A key cleared by hand is matched again; a key picked by hand stays.
    setManual((cur) => Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== null)));
    setAutoOn(true);
    const claimed = Object.values(manual).filter((r): r is DeviceRef => !!r);
    const settled = new Set(Object.entries(manual).filter(([, v]) => v).map(([k]) => k));
    const result = autoMatch(sceneKeys, elements, { devices: devMap, roles: sceneRoles, skip: settled, claimed });
    // What this press found: the identity matches were there already.
    const found = result.filter((r) => r.element !== null && r.how !== 'key');
    setNote(m.matchedAuto(found.length, found.filter((r) => r.how === 'type').length));
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
      key: 'pick', header: <span className="sr-only">{m.documentChosen('')}</span>, width: '2.5rem', hideable: false,
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
    return { id: d.id, label: d.label, code: d.code ?? '', role, roleKind: role === MAIN_ROLE ? 'main' : 'named' };
  });
  const roleInvalid = new Set(roleIssues.filter((i) => i.code === 'role-invalid' || i.code === 'role-duplicate').map((i) => i.subject));
  const deviceColumns: Column<DeviceRow>[] = [
    { key: 'label', header: m.deviceName, sortable: true },
    { key: 'code', header: m.deviceCode, sortable: true, hideBelow: 'sm' },
    {
      key: 'role', header: m.deviceRole, width: '12rem', searchable: false, hideable: false,
      render: (r) => (
        <Input
          id={`${uid}-role-${r.id}`} label={m.roleOf(r.label)} hideLabel value={r.role} placeholder={m.mainRole}
          maxLength={48} spellCheck={false} autoComplete="off"
          aria-invalid={roleInvalid.has(r.role)}
          onChange={(e) => setRoleEdits((cur) => ({ ...cur, [r.id]: e.target.value }))}
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
      const e = elements.find((x) => x.element === ref.element && (x.deviceId ?? ref.deviceId) === ref.deviceId);
      return { value: String(i), label: e?.label && e.label !== e.element ? `${e.label} (${e.element})` : ref.element };
    });
    let current = r.element === null ? -1 : refs.findIndex((x) => x.deviceId === r.deviceId && x.element === r.element);
    if (r.element !== null && current < 0) {
      options.push({ value: String(options.length), label: m.elementMissing(r.element) });
      refs.push({ deviceId: r.deviceId ?? '', element: r.element });
      current = refs.length - 1;
    }
    const identity = baseOf.get(r.key)?.element != null;
    const noDevice = !Object.prototype.hasOwnProperty.call(devMap, r.role) && !(r.role === MAIN_ROLE && elements.some((e) => e.deviceId === undefined));
    return (
      <Select
        id={id} label={label} hideLabel={hideLabel} options={options}
        placeholder={identity ? undefined : m.elementNone}
        disabled={noDevice || options.length === 0}
        hint={noDevice ? m.noDeviceForRole(r.role) : undefined}
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
          {props.onPick && (
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
  const keyFilters: DataTableFilterField<KeyRow>[] = [{
    id: 'how', label: m.statusFilter, type: 'select', placeholder: m.statusAny, placement: 'toolbar',
    options: HOWS.map((h) => ({ value: h, label: m.status[h] })),
  }];

  const needsAck = left.keys.length > 0;
  const confirmText = m.confirmMessage(kind, Object.keys(draft.map).length, left.keys.length);

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={m.title}
        closeLabel={m.close}
        portalTarget={props.portalTarget}
        // Full width on a phone, a wide panel from sm: the matching table needs the room.
        className={cn('w-full sm:w-[min(100vw,60rem)]', props.className)}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="min-w-0 flex-1 text-xs text-text-secondary">{stuck}</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onClick={onClose}>{m.cancel}</Button>
              <Button disabled={!canSave} loading={saving} onClick={() => setConfirming(true)}>{saving ? m.saving : m.save}</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-8">
          {conflict && (
            <AlertBanner
              variant="warning" title={m.conflictTitle} message={m.conflictBody}
              action={props.onReload ? { label: m.reload, onClick: props.onReload } : undefined}
            />
          )}
          {saveError && !conflict && <AlertBanner variant="error" title={m.saveFailed} message={saveError} />}

          {/* 1. Slot and kind */}
          <section aria-labelledby={`${uid}-h1`} className="space-y-3">
            <h3 id={`${uid}-h1`} className="text-sm font-semibold text-text-primary">{m.slotSection}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {slots ? (
                <Select id={`${uid}-slot`} label={m.slotLabel} hint={m.slotHint} options={[...slots]} value={slot} onChange={(e) => setSlotTo(e.target.value)} />
              ) : (
                <Input id={`${uid}-slot`} label={m.slotLabel} hint={m.slotHint} value={slot} maxLength={64} onChange={(e) => setSlotTo(e.target.value)} />
              )}
              <div role="group" aria-labelledby={`${uid}-kind`} className="space-y-1">
                <span id={`${uid}-kind`} className="block text-sm font-medium text-text-primary">{m.kindLabel}</span>
                <ButtonGroup
                  size="sm" variant="outline" value={kind} onChange={setKindTo}
                  items={kinds.map((k) => ({ value: k, label: m.kinds[k] ?? k }))}
                />
              </div>
            </div>
          </section>

          {/* 2. Document */}
          <section aria-labelledby={`${uid}-h2`} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 id={`${uid}-h2`} className="text-sm font-semibold text-text-primary">{m.documentSection}</h3>
                <p className="text-xs text-text-secondary">{m.documentHint}</p>
              </div>
              {props.onNewFromDevice && (
                <Button size="sm" variant="outline" loading={props.newFromDeviceBusy} iconLeft={<FontAwesomeIcon icon={faPlus} aria-hidden="true" />} onClick={props.onNewFromDevice}>
                  {m.newFromDevice}
                </Button>
              )}
            </div>
            <DataTable<DocRow>
              id={`${uid}-docs`} mode="paginated" caption={m.documentSection} columns={docColumns} rows={docRows} rowId={(r) => r.id}
              searchable searchPlaceholder={m.documentSearch} filterFields={docFilters} filtersLive
              pageSize={5} pageSizeOptions={[5, 10, 25]} initialSort={[{ key: 'updatedAt', dir: 'desc' }]} multiSort={false}
              density="compact" state={props.documentsLoading ? 'loading' : undefined} emptyMessage={m.documentsEmpty}
              messages={{ loading: m.loading, ...props.tableMessages, search: m.documentSearch }} onRowClick={(r) => selectDocument(r.id)}
              rowClassName={(r) => (r.id === documentId ? 'bg-primary-subtle' : undefined)}
            />
            <p className="text-xs text-text-secondary">
              {documentId ? m.documentChosen(documents.find((d) => d.id === documentId)?.name ?? documentId) : m.noDocumentChosen}
            </p>
          </section>

          {/* 3. Devices and roles */}
          <section aria-labelledby={`${uid}-h3`} className="space-y-3">
            <div>
              <h3 id={`${uid}-h3`} className="text-sm font-semibold text-text-primary">{m.devicesSection}</h3>
              <p className="text-xs text-text-secondary">{m.devicesHint}</p>
            </div>
            <DataTable<DeviceRow>
              id={`${uid}-devices`} mode="paginated" caption={m.devicesSection} columns={deviceColumns} rows={deviceRows} rowId={(r) => r.id}
              searchable searchPlaceholder={m.deviceSearch} filterFields={deviceFilters} filtersLive
              pageSize={10} pageSizeOptions={[10, 25, 100]} density="compact"
              state={props.devicesLoading ? 'loading' : undefined} emptyMessage={m.devicesEmpty}
              messages={{ loading: m.loading, ...props.tableMessages, search: m.deviceSearch }}
            />
            <p className="text-xs text-text-secondary">{m.roleHint}</p>
          </section>

          {/* 4. Matching */}
          <section aria-labelledby={`${uid}-h4`} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 id={`${uid}-h4`} className="text-sm font-semibold text-text-primary">{m.matchSection}</h3>
                <p className="text-xs text-text-secondary">{m.matchHint}</p>
              </div>
              <Button
                size="sm" variant="outline" disabled={sceneKeys.length === 0 || elements.length === 0}
                iconLeft={<FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />} onClick={runAuto}
              >
                {m.matchAuto}
              </Button>
            </div>

            <div className={cn('grid gap-4', preview ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]' : undefined)}>
              <div className="min-w-0 space-y-3">
                {pickedRow && (
                  <div ref={strip} className="rounded-lg border border-primary bg-primary-subtle p-3 space-y-2" data-testid="picked-strip">
                    <p className="text-xs text-text-secondary">{m.pickedHint}</p>
                    {elementField(pickedRow, `${uid}-picked`, false, m.picked(pickedRow.key))}
                  </div>
                )}
                <DataTable<KeyRow>
                  id={`${uid}-keys`} mode="paginated" caption={m.matchSection} columns={keyColumns} rows={rows} rowId={(r) => r.key}
                  searchable searchText={(r) => r.find} searchPlaceholder={m.keySearch} filterFields={keyFilters} filtersLive
                  pageSize={10} pageSizeOptions={[10, 25, 50]} density="compact"
                  state={props.sceneKeysLoading ? 'loading' : undefined} emptyMessage={m.keysEmpty}
                  messages={{ loading: m.loading, ...props.tableMessages, search: m.keySearch }}
                  rowClassName={(r) => (r.key === pickedKey ? 'bg-primary-subtle' : undefined)}
                />
              </div>
              {preview && (
                <div role="region" aria-label={m.previewLabel} className="min-w-0 rounded-lg border border-border bg-surface-base p-2">
                  {preview}
                </div>
              )}
            </div>

            <div className="space-y-1" role="status" aria-live="polite">
              <p className={cn('text-sm font-medium', left.keys.length ? 'text-warning-fg' : 'text-success-fg')}>
                {left.keys.length ? m.unresolvedKeys(left.keys.length) : sceneKeys.length ? m.allResolved : ''}
              </p>
              <ul className="space-y-0.5 text-xs text-text-secondary">
                {left.elements.length > 0 && <li>{m.unresolvedElements(left.elements.length)}</li>}
                {left.devices.length > 0 && <li>{m.unresolvedDevices(left.devices.length)}</li>}
                {left.roles.length > 0 && <li>{m.unresolvedRoles(left.roles)}</li>}
                {pending.length > 0 && <li>{m.pendingProposals(pending.length)}</li>}
                {note && <li>{note}</li>}
              </ul>
              {pending.length > 0 && (
                <Button size="xs" variant="outline" onClick={acceptAll}>{m.acceptAll(pending.length)}</Button>
              )}
            </div>
          </section>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirming && open}
        portalTarget={props.portalTarget}
        title={m.confirmTitle}
        message={conflict ? `${m.conflictBody} ${confirmText}` : confirmText}
        tone={conflict ? 'warning' : 'default'}
        confirmLabel={m.confirmButton}
        cancelLabel={m.cancel}
        input={props.askReason ? { kind: 'text', label: m.reasonLabel, placeholder: m.reasonPlaceholder, maxLength: 200 } : undefined}
        acknowledgement={needsAck || pending.length > 0 ? m.acknowledge(unmatchedStaying, pending.length) : undefined}
        onCancel={() => setConfirming(false)}
        onConfirm={(result) => {
          setConfirming(false);
          props.onSave(draft, { reason: result.value });
        }}
      />
    </>
  );
}
