'use client';
import { useState } from 'react';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { Toggle } from '@/modules/ui/Toggle';
import { fillSnmp, issueText, type SnmpMessages } from './messages';
import {
  SNMP_KINDS, SNMP_VALUE_TYPES, enumMapText, mappedPreview, parseEnumMap,
  type SnmpKind, type SnmpScalarRow, type SnmpTestPollVarbind, type SnmpValueType,
} from './types';

/**
 * SnmpValueFields — the fields of one SNMP value (a scalar row, `kind` shown, or a table column): OID, key, kind, type, scale, unit, rate
 * (only for counters) and the enum map (only for `enum`, `1=up` lines). With `sample` (the row's OID in the last test poll) it previews
 * "raw 235 → 23.5". `errors` are issue codes by field (the client's and the server's). Controlled.
 */
export type SnmpValueFieldsProps = {
  idPrefix: string;
  value: SnmpScalarRow;
  onChange: (next: SnmpScalarRow) => void;
  m: SnmpMessages;
  /** Draws the kind field (scalar rows); a table column is always telemetry. */
  withKind?: boolean;
  /** A table column: the OID is the column, without the row index. */
  column?: boolean;
  errors?: Record<string, string | undefined>;
  sample?: SnmpTestPollVarbind;
  disabled?: boolean;
};

const COUNTERS: readonly SnmpValueType[] = ['counter32', 'counter64', 'auto'];

export function SnmpValueFields({ idPrefix, value, onChange, m, withKind, column, errors = {}, sample, disabled }: SnmpValueFieldsProps) {
  const [enumText, setEnumText] = useState(enumMapText(value.enumMap));
  const [scaleText, setScaleText] = useState(value.scale === undefined ? '' : String(value.scale));
  const type = value.type ?? 'auto';
  const kind = value.kind ?? 'telemetry';
  const err = (f: string) => (errors[f] ? issueText(m, errors[f]!) : undefined);
  const set = (patch: Partial<SnmpScalarRow>) => {
    const next = { ...value, ...patch };
    for (const k of Object.keys(patch) as Array<keyof SnmpScalarRow>) if (patch[k] === undefined) delete next[k];
    onChange(next);
  };
  const badEnum = parseEnumMap(enumText).bad;
  const preview = sample ? mappedPreview(value, sample) : null;
  return (
    <div className="space-y-4">
      <Input id={`${idPrefix}-oid`} label={column ? m.row.columnOid : m.row.oid} hint={column ? m.row.columnOidHint : m.row.oidHint} required
        value={value.oid} disabled={disabled} error={err('oid')} inputMode="decimal" className="font-mono"
        onChange={(e) => set({ oid: e.target.value.trim() })} />
      <Input id={`${idPrefix}-key`} label={m.row.key} hint={m.row.keyHint} required maxLength={96} value={value.key} disabled={disabled} error={err('key')}
        onChange={(e) => set({ key: e.target.value.trim() })} />
      {withKind && (
        <Select id={`${idPrefix}-kind`} label={m.row.kind} value={kind} disabled={disabled}
          onChange={(e) => set({ kind: e.target.value as SnmpKind, ...(e.target.value === 'attribute' ? { rate: undefined } : {}) })}
          options={SNMP_KINDS.map((k) => ({ value: k, label: m.row[k] }))} />
      )}
      <Select id={`${idPrefix}-type`} label={m.row.type} value={type} disabled={disabled}
        onChange={(e) => {
          const t = e.target.value as SnmpValueType;
          set({ type: t, ...(COUNTERS.includes(t) ? {} : { rate: undefined }), ...(t === 'enum' ? {} : { enumMap: undefined }) });
          if (t !== 'enum') setEnumText('');
        }}
        options={SNMP_VALUE_TYPES.map((t) => ({ value: t, label: m.type[t] }))} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id={`${idPrefix}-scale`} label={m.row.scale} hint={m.row.scaleHint} value={scaleText} disabled={disabled} inputMode="decimal"
          error={err('scale') ?? (scaleText.trim() && !Number.isFinite(Number(scaleText)) ? issueText(m, 'scale_zero') : undefined)}
          onChange={(e) => {
            setScaleText(e.target.value);
            const n = Number(e.target.value);
            set({ scale: e.target.value.trim() === '' ? undefined : Number.isFinite(n) ? n : value.scale });
          }} />
        <Input id={`${idPrefix}-unit`} label={m.row.unit} maxLength={16} value={value.unit ?? ''} disabled={disabled} error={err('unit')}
          onChange={(e) => set({ unit: e.target.value === '' ? undefined : e.target.value })} />
      </div>
      {COUNTERS.includes(type) && kind === 'telemetry' && (
        <Toggle id={`${idPrefix}-rate`} label={m.row.rate} description={m.row.rateHint} checked={!!value.rate} disabled={disabled}
          onChange={(v) => set({ rate: v ? true : undefined })} />
      )}
      {err('rate') && <p role="alert" className="text-xs text-error">{err('rate')}</p>}
      {type === 'enum' && (
        <Textarea id={`${idPrefix}-enum`} label={m.row.enumMap} hint={m.row.enumMapHint} rows={4} value={enumText} disabled={disabled}
          error={badEnum.length ? fillSnmp(m.row.enumMapBad, { lines: badEnum.join(', ') }) : err('enumMap')} className="font-mono"
          onChange={(e) => {
            setEnumText(e.target.value);
            const { map } = parseEnumMap(e.target.value);
            set({ enumMap: Object.keys(map).length ? map : undefined });
          }} />
      )}
      {sample && preview && (
        <p className="rounded-lg border border-border bg-surface-sunken px-3 py-2 font-mono text-xs text-text-secondary" data-testid="snmp-preview">
          {preview.rate
            ? fillSnmp(m.row.previewRate, { raw: String(sample.value ?? m.common.none) })
            : fillSnmp(m.row.preview, { raw: String(sample.value ?? m.common.none), value: preview.value === null ? m.common.none : String(preview.value) })}
        </p>
      )}
    </div>
  );
}
