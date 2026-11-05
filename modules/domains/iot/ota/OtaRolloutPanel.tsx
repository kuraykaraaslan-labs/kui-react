'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill, formatRelative } from '../format';
import type { OtaMessages, OtaMessagesInput } from './messages';
import type { OtaAdapter } from './ota-adapter';
import { OtaStateBar } from './OtaStateBar';
import { otaErrorText, useOtaText } from './OtaText';
import type { OtaRollout, OtaRolloutAction, OtaRolloutStatus, OtaWavePhase, OtaWaveProgress } from './types';

type WaveRow = OtaWaveProgress & { updated: number; failed: number; minSuccessPct: number; maxFailurePct: number } & Record<string, unknown>;
type Variant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'primary';

const STATUS_VARIANT: Record<OtaRolloutStatus, Variant> = { RUNNING: 'info', PAUSED: 'warning', COMPLETED: 'success', ABORTED: 'neutral' };
const PHASE_VARIANT: Record<OtaWavePhase, Variant> = { waiting: 'neutral', open: 'info', soaking: 'primary', passed: 'success', paused: 'warning', stopped: 'neutral' };
const FAILED = ['FAILED', 'TIMEOUT', 'ROLLED_BACK'] as const;

/** The words of why a rollout paused or ended. */
export function otaRolloutReason(m: OtaMessages, r: Pick<OtaRollout, 'status' | 'pausedReason' | 'endedReason'>): string | null {
  if (r.status === 'PAUSED' && r.pausedReason) return fill(m.waves.pausedBecause, { reason: m.pauseReason[r.pausedReason] ?? r.pausedReason });
  if ((r.status === 'ABORTED' || r.status === 'COMPLETED') && r.endedReason) {
    return fill(m.waves.ended, { reason: (m.endReason as Record<string, string>)[r.endedReason] ?? r.endedReason });
  }
  return null;
}

export interface OtaRolloutPanelProps {
  adapter: OtaAdapter;
  rollout: OtaRollout;
  /** The package's title and version, for the confirmations. */
  title: string;
  version: string;
  /** May pause, resume and abort (the host's `iot_ota.assign`). */
  canAct?: boolean;
  /** After an action, with the rollout as it is now. */
  onChanged?: (rollout: OtaRollout) => void;
  messages?: OtaMessagesInput | OtaMessages;
  locale?: string;
  className?: string;
}

/**
 * OtaRolloutPanel — one rollout in waves: its status, the open wave ("Wave 2 of 4"), why it paused or ended, when the open wave closes or
 * the next one starts, the last gate reading, and its waves in a DataTable (planned devices, progress by state, phase, the gate limits).
 * Pause, Resume and Abort sit in its header, each asked through the ConfirmDialog in words that say what happens (resuming past a failed
 * gate says that the failures so far are accepted).
 */
export function OtaRolloutPanel({ adapter, rollout: r, title, version, canAct, onChanged, messages, locale, className }: OtaRolloutPanelProps) {
  const { m, locale: lang } = useOtaText(messages as OtaMessagesInput, locale);
  const [ask, setAsk] = useState<OtaRolloutAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const live = r.status === 'RUNNING' || r.status === 'PAUSED';
  const total = r.waves.length;

  async function act(action: OtaRolloutAction) {
    if (!adapter.rollouts) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const next = await adapter.rollouts.act(r.rolloutId, action);
      setAsk(null);
      setNotice(action === 'pause' ? m.waves.pausedNotice : action === 'resume' ? m.waves.resumedNotice : m.waves.abortedNotice);
      onChanged?.(next);
    } catch (e) {
      setAsk(null);
      setError(otaErrorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  const rows: WaveRow[] = r.progress.map((p) => {
    const spec = r.waves[p.wave];
    return {
      ...p, updated: p.states.UPDATED ?? 0, failed: FAILED.reduce((a, s) => a + (p.states[s] ?? 0), 0),
      minSuccessPct: spec?.minSuccessPct ?? 0, maxFailurePct: spec?.maxFailurePct ?? 0,
    };
  });
  const columns: Column<WaveRow>[] = [
    { key: 'wave', header: m.waves.waveCol, sortable: true, sortValue: (w) => w.wave, searchValue: (w) => fill(m.waves.wave, { n: w.wave + 1 }), render: (w) => <span className="font-medium text-text-primary">{fill(m.waves.wave, { n: w.wave + 1 })}</span> },
    { key: 'planned', header: m.waves.planned, sortable: true, align: 'right', render: (w) => <span className="tabular-nums">{w.planned}</span> },
    {
      key: 'progress', header: m.waves.progress, sortable: true, sortValue: (w) => w.updated,
      render: (w) => (
        <div className="min-w-[10rem] space-y-1">
          <OtaStateBar counts={w.states} messages={m} compact />
          <span className="text-xs text-text-secondary">{fill(m.waves.updatedOf, { updated: w.updated, planned: w.planned, failed: w.failed })}</span>
        </div>
      ),
    },
    {
      key: 'phase', header: m.waves.phase, sortable: true, searchValue: (w) => m.wavePhase[w.phase],
      render: (w) => <Badge size="sm" variant={PHASE_VARIANT[w.phase]} dot={w.phase === 'open'} data-wave-phase={w.phase}>{m.wavePhase[w.phase]}</Badge>,
    },
    { key: 'gate', header: m.waves.gate, hideBelow: 'md', render: (w) => <span className="text-xs text-text-secondary">{fill(m.waves.gateLimits, { maxFailurePct: w.maxFailurePct, minSuccessPct: w.minSuccessPct })}</span> },
  ];
  const filters: DataTableFilterField<WaveRow>[] = [
    {
      id: 'phase', label: m.waves.phase, type: 'checkboxes',
      options: (['waiting', 'open', 'soaking', 'passed', 'paused', 'stopped'] as const).map((p) => ({ value: p, label: m.wavePhase[p] })),
      match: (w, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(w.phase),
    },
  ];
  const reason = otaRolloutReason(m, r);
  const target = r.targetType === 'GROUP' || !r.targetName ? null : fill(m.waves.to, { target: r.targetName });
  const names = { title, version };

  return (
    <section className={cn('space-y-3 rounded-lg border border-border bg-surface-raised p-4', className)} aria-label={m.waves.title} data-ota-rollout-id={r.rolloutId} data-rollout-status={r.status}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text-primary">{m.waves.title}</h3>
            <Badge size="sm" variant={STATUS_VARIANT[r.status]} dot={r.status === 'RUNNING'}>{m.rolloutStatus[r.status]}</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {[target, live ? fill(m.waves.of, { n: r.currentWave + 1, total }) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        {canAct && adapter.rollouts && live && (
          <div className="flex flex-wrap gap-2">
            {r.status === 'RUNNING' && <Button size="sm" variant="outline" onClick={() => setAsk('pause')} disabled={busy}>{m.waves.pause}</Button>}
            {r.status === 'PAUSED' && <Button size="sm" variant="primary" onClick={() => setAsk('resume')} disabled={busy}>{m.waves.resume}</Button>}
            <Button size="sm" variant="danger" onClick={() => setAsk('abort')} disabled={busy}>{m.waves.abort}</Button>
          </div>
        )}
      </header>
      {reason && <Callout variant={r.status === 'PAUSED' && r.pausedReason !== 'manual' ? 'warning' : 'info'}>{reason}</Callout>}
      {live && (r.closesAt || r.soakUntil || r.gate) && (
        <div className="space-y-0.5 text-xs text-text-secondary" aria-live="polite">
          {r.status === 'RUNNING' && r.closesAt && <p>{fill(m.waves.closesAt, { time: formatRelative(r.closesAt, { locale: lang }) })}</p>}
          {r.status === 'RUNNING' && r.soakUntil && <p>{fill(m.waves.soakUntil, { time: formatRelative(r.soakUntil, { locale: lang }) })}</p>}
          {r.gate && <p>{fill(m.waves.lastGate, { failures: r.gate.failures, failurePct: r.gate.failurePct, successPct: r.gate.successPct ?? m.common.none })}</p>}
        </div>
      )}
      {notice && <Callout variant="tip">{notice}</Callout>}
      {error && <Callout variant="danger" role="alert">{error}</Callout>}
      <DataTable<WaveRow>
        columns={columns}
        rows={rows}
        mode="static"
        variant="plain"
        caption={m.waves.caption}
        rowId={(w) => String(w.wave)}
        filterFields={filters}
        defaultSort={[{ key: 'wave', dir: 'asc' }]}
        pageSize={20}
      />
      <ConfirmDialog
        open={ask === 'pause'}
        tone="warning"
        title={fill(m.waves.pauseTitle, names)}
        message={m.waves.pauseMessage}
        confirmLabel={m.waves.pause}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void act('pause')}
      />
      <ConfirmDialog
        open={ask === 'resume'}
        tone={r.pausedReason && r.pausedReason !== 'manual' ? 'warning' : 'default'}
        title={fill(m.waves.resumeTitle, names)}
        message={fill(m.waves.resumeMessage, { n: r.currentWave + 1 })}
        details={r.pausedReason && r.pausedReason !== 'manual' ? <p className="text-sm">{fill(m.waves.resumeOverride, { reason: m.pauseReason[r.pausedReason] })}</p> : undefined}
        confirmLabel={m.waves.resume}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void act('resume')}
      />
      <ConfirmDialog
        open={ask === 'abort'}
        tone="danger"
        title={fill(m.waves.abortTitle, names)}
        message={m.waves.abortMessage}
        confirmLabel={m.waves.abort}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void act('abort')}
      />
    </section>
  );
}
