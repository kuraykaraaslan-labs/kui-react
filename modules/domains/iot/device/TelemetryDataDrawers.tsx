'use client';
import { useRef, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { type IotTelemetryApi, type TelemetryExportAggregate, type TelemetryExportResolution } from '../api/adapter';
import { useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';

/**
 * The Telemetry tab's two data drawers (NB iot-telemetry 03 §3.4), opened from header buttons beside the window:
 *
 *  - `TelemetryExportDrawer` — "Export CSV": some keys of the device over a window (local date and time), at a resolution (the host's
 *    choice by window, raw readings, or minute / hour / day aggregates) with an aggregate, downloaded as one CSV file (`exportSeries`).
 *    The host answers at most so many points per key (NB: 10 000) and so many buckets per window: a file it cut says so, and a longer
 *    history is several files (the host's caps stay caps, NB OPB-23).
 *  - `TelemetryDeleteDrawer` — "Delete data": some keys' readings over whole UTC days (`deleteKeys` with a range), behind a confirmation
 *    that names the keys and the days. Whole UTC days because the host's hour and day aggregates start on UTC midnights and cannot be
 *    cut inside a bucket (NB TQ-2). A key whose latest value lies in the range shows the newest reading before it afterwards.
 *
 * Each drawer cannot close while its request runs; closing it drops the draft. Nothing is sent before the primary button.
 */

/** The most keys one export names (the host's series cap, NB `/api/telemetry/series`). */
export const EXPORT_MAX_KEYS = 50;
/** The most keys one delete names (the host's delete route, NB). */
export const DELETE_MAX_KEYS = 20;
const DAY_MS = 86_400_000;

export type TelemetryKeyOption = { key: string; name: string; numeric: boolean };

/** `YYYY-MM-DDTHH:mm` of a local time, as a `datetime-local` input holds it. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A `datetime-local` value as epoch ms (local time), or NaN. */
export function fromLocalInput(v: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? new Date(v).getTime() : NaN;
}

/** `YYYY-MM-DD` of the UTC day holding `ms`. */
export function toUtcDay(ms: number): string {
  return new Date(Math.floor(ms / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
}

/** A `date` input value as the UTC midnight that starts that day, or NaN. */
export function fromUtcDay(v: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
}

/** The first and last UTC day (both included) as the range `[from, to)` the host takes, or null when it is not one. */
export function dayRangeOf(first: string, last: string): { from: number; to: number } | null {
  const from = fromUtcDay(first);
  const lastStart = fromUtcDay(last);
  if (!Number.isFinite(from) || !Number.isFinite(lastStart) || lastStart < from) return null;
  return { from, to: lastStart + DAY_MS };
}

/** Hands a file to the browser as a download (nothing where the page cannot: a test, a server render). */
export function saveFile(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function KeyPicker({ idPrefix, options, picked, onChange, error, legend }: {
  idPrefix: string; options: TelemetryKeyOption[]; picked: string[]; onChange: (keys: string[]) => void; error?: string; legend: string;
}) {
  return (
    <fieldset className="space-y-1" aria-describedby={error ? `${idPrefix}-keys-error` : undefined}>
      <legend className="mb-1 text-sm font-medium text-text-primary">{legend}</legend>
      <div className="max-h-56 space-y-1 overflow-auto rounded border border-border p-2">
        {options.map((o, i) => (
          <Checkbox
            key={o.key}
            id={`${idPrefix}-key-${i}`}
            label={o.name === o.key ? o.key : `${o.name} (${o.key})`}
            checked={picked.includes(o.key)}
            onChange={(e) => onChange(e.target.checked ? [...picked, o.key] : picked.filter((k) => k !== o.key))}
          />
        ))}
      </div>
      {error && <p id={`${idPrefix}-keys-error`} role="alert" className="text-xs text-error">{error}</p>}
    </fieldset>
  );
}

export type TelemetryExportDrawerProps = {
  open: boolean;
  deviceId: string;
  api: Pick<IotTelemetryApi, 'exportSeries'>;
  /** The device's keys (numeric ones can be aggregated; any key can be exported raw). */
  keys: TelemetryKeyOption[];
  /** The keys picked when the drawer opens (the charted ones). */
  initialKeys?: string[];
  onClose: () => void;
  /** "Now" for the default window (tests). */
  now?: number;
};

export function TelemetryExportDrawer({ open, deviceId, api, keys, initialKeys = [], onClose, now }: TelemetryExportDrawerProps) {
  const { m } = useIotText();
  const t = m.telemetry;
  const notify = useIotNotify();
  const defaults = () => {
    const to = now ?? Date.now();
    return { keys: initialKeys.filter((k) => keys.some((o) => o.key === k)), from: toLocalInput(to - DAY_MS), to: toLocalInput(to) };
  };
  const [picked, setPicked] = useState<string[]>(() => defaults().keys);
  const [from, setFrom] = useState(() => defaults().from);
  const [to, setTo] = useState(() => defaults().to);
  const [resolution, setResolution] = useState<TelemetryExportResolution>('auto');
  const [aggregate, setAggregate] = useState<TelemetryExportAggregate>('avg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);

  // every opening starts afresh (state adjusted while rendering, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const d = defaults();
      setPicked(d.keys); setFrom(d.from); setTo(d.to); setResolution('auto'); setAggregate('avg'); setError(null); setFieldErrors({});
    }
  }

  function close() {
    if (!busy) onClose();
  }

  async function submit() {
    if (!api.exportSeries || busy || submitting.current) return;
    const errs: Record<string, string> = {};
    if (!picked.length) errs.keys = t.pickKeys;
    else if (picked.length > EXPORT_MAX_KEYS) errs.keys = fill(t.tooManyKeys, { max: EXPORT_MAX_KEYS });
    const fromMs = fromLocalInput(from);
    const toMs = fromLocalInput(to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) errs.to = t.exportBadWindow;
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      // the keys in the table's order, so the file's columns read the same way
      const ordered = keys.map((o) => o.key).filter((k) => picked.includes(k));
      const file = await api.exportSeries(deviceId, { keys: ordered, from: fromMs, to: toMs, resolution, aggregate });
      saveFile(file.blob, file.fileName);
      notify({ tone: file.truncated ? 'info' : 'success', message: file.truncated ? t.exportTruncated : t.exportDone });
      setBusy(false);
      onClose();
    } catch {
      setError(t.exportError);
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Drawer open={open} onClose={close} title={t.exportTitle} closeLabel={m.common.close}>
      <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <p className="text-sm text-text-secondary">{t.exportHint}</p>
        <KeyPicker idPrefix="telemetry-export" legend={t.keys} options={keys} picked={picked} onChange={setPicked} error={fieldErrors.keys} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="telemetry-export-from" type="datetime-local" label={t.from} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input id="telemetry-export-to" type="datetime-local" label={t.to} value={to} error={fieldErrors.to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Select
          id="telemetry-export-resolution"
          label={t.resolution}
          hint={t.resolutionHint}
          value={resolution}
          onChange={(e) => setResolution(e.target.value as TelemetryExportResolution)}
          options={[
            { value: 'auto', label: t.resolutionAuto }, { value: 'raw', label: t.resolutionRaw }, { value: '1m', label: t.resolutionMinute },
            { value: '1h', label: t.resolutionHour }, { value: '1d', label: t.resolutionDay },
          ]}
        />
        <Select
          id="telemetry-export-aggregate"
          label={t.aggregate}
          value={aggregate}
          disabled={resolution === 'raw'}
          onChange={(e) => setAggregate(e.target.value as TelemetryExportAggregate)}
          options={[
            { value: 'avg', label: t.aggAvg }, { value: 'min', label: t.aggMin }, { value: 'max', label: t.aggMax },
            { value: 'last', label: t.aggLast }, { value: 'sum', label: t.aggSum }, { value: 'count', label: t.aggCount },
          ]}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>{m.common.cancel}</Button>
          <Button type="submit" variant="primary" size="sm" loading={busy} disabled={busy}>{t.exportDownload}</Button>
        </div>
      </form>
    </Drawer>
  );
}

export type TelemetryDeleteDrawerProps = {
  open: boolean;
  deviceId: string;
  api: Pick<IotTelemetryApi, 'deleteKeys'>;
  keys: TelemetryKeyOption[];
  onClose: () => void;
  /** After a delete: the host answered these keys (the view reads the table again). */
  onDeleted?: (deleted: string[]) => void;
  now?: number;
};

export function TelemetryDeleteDrawer({ open, deviceId, api, keys, onClose, onDeleted, now }: TelemetryDeleteDrawerProps) {
  const { m } = useIotText();
  const t = m.telemetry;
  const notify = useIotNotify();
  const today = () => toUtcDay(now ?? Date.now());
  const [picked, setPicked] = useState<string[]>([]);
  const [first, setFirst] = useState(today);
  const [last, setLast] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPicked([]); setFirst(today()); setLast(today()); setError(null); setFieldErrors({});
    }
  }

  function close() {
    if (!busy) onClose();
  }

  async function submit() {
    if (!api.deleteKeys || busy || submitting.current) return;
    const errs: Record<string, string> = {};
    if (!picked.length) errs.keys = t.pickKeys;
    else if (picked.length > DELETE_MAX_KEYS) errs.keys = fill(t.tooManyKeys, { max: DELETE_MAX_KEYS });
    const range = dayRangeOf(first, last);
    if (!range) errs.last = t.deleteRangeBadDays;
    setFieldErrors(errs);
    if (!range || Object.keys(errs).length) return;
    submitting.current = true;
    try {
      const names = keys.filter((o) => picked.includes(o.key)).map((o) => o.name);
      const del = api.deleteKeys;
      let deleted: string[] = [];
      const ok = await confirmDialog({
        title: fill(t.deleteRangeConfirm, { count: picked.length, first, last }),
        message: `${names.join(', ')}. ${t.deleteRangeBody}`,
        tone: 'danger',
        confirmLabel: t.delete,
        cancelLabel: m.common.cancel,
        action: async () => {
          setBusy(true);
          try {
            deleted = (await del(deviceId, picked, range)).deleted;
          } finally {
            setBusy(false);
          }
        },
        errorMessage: () => t.deleteRangeError,
      });
      if (!ok) return;
      notify({ tone: 'success', message: fill(t.deleteRangeDone, { count: deleted.length, first, last }) });
      onDeleted?.(deleted);
      onClose();
    } catch {
      setError(t.deleteRangeError);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Drawer open={open} onClose={close} title={t.deleteRangeTitle} closeLabel={m.common.close}>
      <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <p className="text-sm text-text-secondary">{t.deleteRangeHint}</p>
        <KeyPicker idPrefix="telemetry-delete" legend={t.keys} options={keys} picked={picked} onChange={setPicked} error={fieldErrors.keys} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="telemetry-delete-first" type="date" label={t.firstDay} value={first} onChange={(e) => setFirst(e.target.value)} />
          <Input id="telemetry-delete-last" type="date" label={t.lastDay} value={last} error={fieldErrors.last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>{m.common.cancel}</Button>
          <Button type="submit" variant="danger" size="sm" loading={busy} disabled={busy}>{t.deleteRangeSubmit}</Button>
        </div>
      </form>
    </Drawer>
  );
}
