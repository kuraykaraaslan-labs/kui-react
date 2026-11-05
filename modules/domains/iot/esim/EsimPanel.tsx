'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faSimCard } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Spinner } from '@/modules/ui/Spinner';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableRowAction } from '@/modules/ui/Table/types';
import { fill, formatDateTime } from '../format';
import type { EsimAdapter } from './esim-adapter';
import { EsimAddProfileDrawer, EsimAddProfileForm } from './EsimAddProfileForm';
import { EsimOperationBadge, esimStateWord } from './EsimOperationBadge';
import type { EsimMessagesInput } from './messages';
import { esimErrorText, esimReasonText, useEsimText } from './EsimText';
import {
  ESIM_IN_FLIGHT, ESIM_OPERATION_KINDS, esimConfirmText, esimMayBeOnlyUplink,
  type EsimAbilities, type EsimDeviceView, type EsimOperation, type EsimProfile,
} from './types';

export interface EsimPanelProps {
  adapter: EsimAdapter;
  deviceId: string;
  can?: EsimAbilities;
  /** Inside the eSIM drawer the add form takes the panel's place; on a page it opens in its own drawer. */
  inDrawer?: boolean;
  /** How often to read again while an operation is on its way (ms). Default 5000; 0 never. */
  pollMs?: number;
  /** Called after every read, so a host button can follow the in-flight state. */
  onView?: (view: EsimDeviceView) => void;
  messages?: EsimMessagesInput;
  locale?: string;
  className?: string;
}

type ProfileRow = Record<string, unknown> & EsimProfile & { id: string; name: string };
type OpRow = Record<string, unknown> & EsimOperation & { id: string };
type Ask = { kind: 'enable' | 'disable' | 'delete' | 'nickname'; profile: EsimProfile } | null;

/**
 * EsimPanel — a router's eSIM chip and profiles (NB iot_esim 01; D60, D62, D66, D84): the chip (EID, modem, slots in use, online and over
 * which connection), the profiles (a DataTable: switch to, turn off, delete, rename, each through the one ConfirmDialog with the ICCID's
 * last six digits typed for the three that can cut the router off or cannot be undone; turning off the profile in use also asks the
 * person to confirm another connection is up), "Add profile" (the activation code, write-only) and "Read again", the operation in flight
 * and the operation history (a DataTable). Reads again every `pollMs` while an operation is on its way. A router without eSIM shows why.
 */
export function EsimPanel({ adapter, deviceId, can = {}, inDrawer = false, pollMs = 5000, onView, messages, locale, className }: EsimPanelProps) {
  const { m, locale: lang } = useEsimText(messages, locale);
  const [view, setView] = useState<EsimDeviceView | null>(null);
  const [ops, setOps] = useState<EsimOperation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [askError, setAskError] = useState<string | undefined>(undefined);
  const onViewRef = useRef(onView);
  useEffect(() => { onViewRef.current = onView; }, [onView]);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([adapter.device(deviceId, ac.signal), adapter.operations(deviceId, { limit: 100 }, ac.signal)]).then(([v, o]) => {
      setView(v); setOps(o); setError(null); onViewRef.current?.(v);
    }, (e) => { if (!ac.signal.aborted) setError(esimErrorText(m, e)); });
    return () => ac.abort();
  }, [adapter, deviceId, tick, m]);

  const live = !!view?.inFlight && ESIM_IN_FLIGHT.has(view.inFlight.state);
  useEffect(() => {
    if (!pollMs || !live) return;
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setTick((t) => t + 1); }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, live]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const nameOf = useCallback((p: Pick<EsimProfile, 'iccid' | 'nickname' | 'operator'>) => p.nickname || p.operator || `…${esimConfirmText(p.iccid)}`, []);

  async function start(input: Parameters<EsimAdapter['start']>[1], after?: string) {
    setBusy(true); setAskError(undefined); setNotice(null);
    try {
      await adapter.start(deviceId, input);
      setAsk(null);
      if (after) setNotice(after);
      reload();
    } catch (e) {
      const text = esimErrorText(m, e);
      if (ask) setAskError(text); else setError(text);
    } finally {
      setBusy(false);
    }
  }

  const rows: ProfileRow[] = useMemo(() => (view?.profiles ?? []).map((p) => ({ ...p, id: p.iccid, name: nameOf(p) })), [view, nameOf]);
  const opRows: OpRow[] = useMemo(() => ops.map((o) => ({ ...o, id: o.operationId })), [ops]);

  if (!view) {
    return error
      ? <Callout variant="danger" className={className}><p>{error}</p><Button className="mt-2" size="sm" variant="outline" onClick={reload}>{m.common.retry}</Button></Callout>
      : <div className={cn('flex justify-center p-6', className)} role="status" aria-label={m.common.loading}><Spinner /></div>;
  }
  if (!view.supported) {
    return (
      <EmptyState
        className={className}
        icon={<FontAwesomeIcon icon={faSimCard} aria-hidden="true" />}
        title={m.unsupported.title}
        description={m.unsupported[view.reason ?? 'unsupported']}
      />
    );
  }
  if (adding && inDrawer) {
    return (
      <div className={className}>
        <h3 className="mb-3 text-base font-semibold text-text-primary">{m.add.title}</h3>
        <EsimAddProfileForm
          adapter={adapter} deviceId={deviceId} messages={m} locale={lang}
          onCancel={() => setAdding(false)}
          onStarted={() => { setAdding(false); setNotice(m.add.started); reload(); }}
        />
      </div>
    );
  }

  const chip = view.capability ?? {};
  const busyOp = view.inFlight && ESIM_IN_FLIGHT.has(view.inFlight.state) ? view.inFlight : null;
  const full = chip.slots !== undefined && view.profiles.length >= chip.slots;
  const blocked = (manage: boolean): string | undefined => (manage && !can.manage ? m.common.viewOnly : !view.online ? m.profiles.offline : busyOp ? m.profiles.busy : undefined);
  const addBlocked = blocked(true) ?? (!view.canDownload ? m.profiles.noDownload : full ? m.profiles.noSlot : undefined);
  const refreshBlocked = blocked(false);
  const when = (iso: string | null) => (iso ? formatDateTime(iso, { locale: lang }) : m.common.none);

  const columns: Column<ProfileRow>[] = [
    {
      key: 'name', header: m.profiles.nickname, sortable: true,
      render: (r) => <span className="font-medium text-text-primary">{r.name}</span>,
    },
    { key: 'operator', header: m.profiles.operator, sortable: true, hideBelow: 'sm' },
    { key: 'iccid', header: m.profiles.iccid, sortable: true, hideBelow: 'md', render: (r) => <span className="font-mono text-xs">{r.iccid}</span> },
    {
      key: 'state', header: m.profiles.state, sortable: true,
      render: (r) => <Badge variant={r.state === 'enabled' ? 'success' : 'neutral'} size="sm" dot={r.state === 'enabled'}>{r.state === 'enabled' ? m.profiles.enabled : m.profiles.disabled}</Badge>,
    },
    { key: 'class', header: m.profiles.class, hideBelow: 'lg', render: (r) => (r.class ? m.profiles[r.class] : m.common.none) },
  ];
  const filters: DataTableFilterField<ProfileRow>[] = [{
    id: 'state', label: m.profiles.state, type: 'select',
    options: [{ value: 'enabled', label: m.profiles.enabled }, { value: 'disabled', label: m.profiles.disabled }],
  }];
  const actions: DataTableRowAction<ProfileRow>[] = [
    {
      id: 'enable', label: m.profiles.enable, onClick: (r) => setAsk({ kind: 'enable', profile: r }), hidden: (r) => r.state === 'enabled',
      disabled: () => !!blocked(true), disabledReason: () => blocked(true),
    },
    {
      id: 'disable', label: m.profiles.disable, onClick: (r) => setAsk({ kind: 'disable', profile: r }), hidden: (r) => r.state !== 'enabled',
      disabled: () => !!blocked(true), disabledReason: () => blocked(true),
    },
    {
      id: 'rename', label: m.profiles.rename, onClick: (r) => setAsk({ kind: 'nickname', profile: r }),
      disabled: () => !!blocked(true), disabledReason: () => blocked(true),
    },
    {
      id: 'delete', label: m.profiles.delete, destructive: true, order: 10, onClick: (r) => setAsk({ kind: 'delete', profile: r }),
      disabled: (r) => r.state === 'enabled' || !!blocked(true), disabledReason: (r) => (r.state === 'enabled' ? m.profiles.inUseDelete : blocked(true)),
    },
  ];

  const opColumns: Column<OpRow>[] = [
    { key: 'createdAt', header: m.op.when, sortable: true, render: (r) => when(r.createdAt) },
    { key: 'kind', header: m.op.kind, sortable: true, render: (r) => m.kind[r.kind] },
    {
      key: 'iccid', header: m.op.profile, hideBelow: 'sm', searchValue: (r) => `${r.iccid ?? ''} ${r.smdpHost ?? ''} ${r.nickname ?? ''}`,
      render: (r) => (r.iccid ? <span className="font-mono text-xs">{r.iccid}</span> : r.smdpHost ? <span className="text-xs">{fill(m.add.goesTo, { host: r.smdpHost })}</span> : m.common.none),
    },
    { key: 'state', header: m.op.state, sortable: true, render: (r) => <EsimOperationBadge kind={r.kind} state={r.state} messages={m} /> },
    { key: 'reason', header: m.op.reason, hideBelow: 'md', render: (r) => (r.reason ? <span title={r.detail ?? undefined}>{esimReasonText(m, r.reason)}</span> : m.common.none) },
    { key: 'finishedAt', header: m.op.finished, sortable: true, hideBelow: 'lg', render: (r) => when(r.finishedAt) },
  ];
  const opFilters: DataTableFilterField<OpRow>[] = [
    { id: 'kind', label: m.op.kind, type: 'select', options: ESIM_OPERATION_KINDS.map((k) => ({ value: k, label: m.kind[k] })) },
    {
      id: 'state', label: m.op.state, type: 'select',
      options: (['sent', 'running', 'succeeded', 'failed', 'reverted', 'unknown'] as const).map((s) => ({ value: s, label: m.state[s] })),
    },
  ];

  const p = ask?.profile;
  const name = p ? nameOf(p) : '';
  const digits = p ? esimConfirmText(p.iccid) : '';
  const needsSecond = ask?.kind === 'disable' && esimMayBeOnlyUplink(view.uplink);

  return (
    <div className={cn('space-y-5', className)} data-esim-panel={deviceId}>
      <section aria-label={m.chip.title} className="rounded-lg border border-border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{m.chip.title}</h3>
          <Badge variant={view.online ? 'success' : 'neutral'} size="sm" dot>{view.online ? m.chip.online : m.chip.offline}</Badge>
        </div>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-secondary" title={m.chip.eidHint}>{m.chip.eid}</dt>
            <dd className="break-all font-mono text-xs text-text-primary">{chip.eid ?? m.common.none}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{m.chip.modem}</dt>
            <dd className="text-text-primary">{chip.modem ?? m.common.none}{chip.apdu ? ` (${chip.apdu.toUpperCase()})` : ''}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{m.chip.slots}</dt>
            <dd className="text-text-primary">
              {chip.slots !== undefined ? fill(m.chip.slotsUsed, { used: view.profiles.length, slots: chip.slots }) : fill(m.chip.slotsUnknown, { used: view.profiles.length })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{m.chip.uplink}</dt>
            <dd className="text-text-primary">{view.uplink ? m.uplink[view.uplink] : m.uplink.unknown}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-text-secondary">{view.profilesAt ? fill(m.chip.reported, { when: when(view.profilesAt) }) : m.chip.neverReported}</p>
      </section>
      {busyOp && (
        <Callout variant="info" role="status">
          <span className="inline-flex flex-wrap items-center gap-2">
            <Spinner size="sm" />
            {fill(m.op.inFlight, { kind: m.kind[busyOp.kind], state: m.state[esimStateWord(busyOp.kind, busyOp.state)] })}
          </span>
          {(busyOp.kind === 'enable' || busyOp.kind === 'disable' || busyOp.enableAfter) && <p className="mt-1 text-xs">{m.op.switchHint}</p>}
        </Callout>
      )}
      {notice && <Callout variant="tip">{notice}</Callout>}
      {error && <Callout variant="danger" role="alert">{error}</Callout>}
      {!can.manage && <p className="text-xs text-text-secondary">{m.common.viewOnly}</p>}
      <DataTable<ProfileRow>
        columns={columns}
        rows={rows}
        mode="static"
        variant="plain"
        searchable={rows.length > 6}
        title={m.profiles.title}
        caption={m.profiles.caption}
        rowId={(r) => r.id}
        filterFields={filters}
        rowActions={actions}
        defaultSort={[{ key: 'state', dir: 'desc' }]}
        emptyMessage={m.profiles.empty}
        headerActions={(
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" variant="outline" disabled={!!refreshBlocked || busy} title={refreshBlocked}
              onClick={() => void start({ kind: 'refresh' }, m.profiles.refreshed)}
            >
              <FontAwesomeIcon icon={faRotate} className="mr-1.5" aria-hidden="true" />{m.profiles.refresh}
            </Button>
            {can.manage && (
              <Button size="sm" variant="primary" disabled={!!addBlocked} title={addBlocked} onClick={() => setAdding(true)}>{m.profiles.add}</Button>
            )}
          </div>
        )}
      />
      <DataTable<OpRow>
        columns={opColumns}
        rows={opRows}
        mode="static"
        variant="plain"
        searchable={opRows.length > 8}
        title={m.op.title}
        caption={m.op.caption}
        rowId={(r) => r.id}
        filterFields={opFilters}
        defaultSort={[{ key: 'createdAt', dir: 'desc' }]}
        emptyMessage={m.op.empty}
        pageSize={10}
      />
      {!inDrawer && (
        <EsimAddProfileDrawer
          open={adding} adapter={adapter} deviceId={deviceId} messages={m} locale={lang}
          onCancel={() => setAdding(false)}
          onStarted={() => { setAdding(false); setNotice(m.add.started); reload(); }}
        />
      )}
      <ConfirmDialog
        open={!!ask && ask.kind !== 'nickname'}
        tone={ask?.kind === 'enable' ? 'warning' : 'danger'}
        title={fill(ask?.kind === 'enable' ? m.confirm.enableTitle : ask?.kind === 'disable' ? m.confirm.disableTitle : m.confirm.deleteTitle, { name })}
        message={ask?.kind === 'enable' ? m.confirm.enableMessage : ask?.kind === 'disable' ? m.confirm.disableMessage : m.confirm.deleteMessage}
        acknowledgement={needsSecond ? m.confirm.secondUplink : undefined}
        phrase={digits}
        phraseLabel={fill(m.confirm.phrase, { digits })}
        confirmLabel={ask?.kind === 'enable' ? m.confirm.enableLabel : ask?.kind === 'disable' ? m.confirm.disableLabel : m.confirm.deleteLabel}
        cancelLabel={m.common.cancel}
        busy={busy}
        error={askError}
        onCancel={() => { setAsk(null); setAskError(undefined); }}
        onConfirm={() => {
          if (!ask || !p) return;
          void start({
            kind: ask.kind, iccid: p.iccid, confirm: true, confirmText: digits,
            ...(ask.kind === 'disable' && needsSecond ? { confirmSecondUplink: true } : {}),
          });
        }}
      />
      <ConfirmDialog
        open={ask?.kind === 'nickname'}
        title={fill(m.confirm.renameTitle, { name })}
        input={{ kind: 'text', label: m.confirm.renameLabel, hint: m.confirm.renameHint, defaultValue: p?.nickname ?? '', maxLength: 64 }}
        confirmLabel={m.confirm.renameConfirm}
        cancelLabel={m.common.cancel}
        busy={busy}
        error={askError}
        onCancel={() => { setAsk(null); setAskError(undefined); }}
        onConfirm={({ value }) => { if (p) void start({ kind: 'nickname', iccid: p.iccid, nickname: value }); }}
      />
    </div>
  );
}
