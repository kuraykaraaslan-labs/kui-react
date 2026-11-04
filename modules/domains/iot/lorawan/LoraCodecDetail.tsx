'use client';
import { useMemo } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { Textarea } from '@/modules/ui/Textarea';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableQuery } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import { LoraCodecBench } from './LoraCodecBench';
import type { LoraBenchFrame, LoraCodecDoc as Detail, LoraCodecRevisionRow } from './types';

/**
 * LoraCodecDetail — one codec (NB iot_lorawan_codecs 02 §2.5, 05; kui-react iot 10.7), one column of sections, no tabs: what it is (id,
 * revision, fingerprint, models, FPorts, makers, origin and source), the decoder-only line (OD-106) and where decoded keys go (OD-87), the
 * test bench (its first own vector filled in), the keys it decodes with their units, its revisions, and its table read-only. The actions sit
 * in one row on top and are the host's: "Save a copy" of a library codec, "Edit" / "Delete" of the tenant's own, "Withdraw" / "Restore" of a
 * library codec on the platform's view. Every destructive action is confirmed by the host (its ConfirmDialog).
 */
export type LoraCodecDetailProps = {
  codec: Detail;
  onTest: (fport: number, hex: string) => Promise<LoraBenchFrame>;
  /** The revisions: rows of one page; with `onRevisionsQuery` the host serves the pages (`total` in all). */
  revisions: readonly LoraCodecRevisionRow[];
  revisionsTotal?: number;
  onRevisionsQuery?: (q: DataTableQuery) => void;
  revisionsLoading?: boolean;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onWithdraw?: () => void;
  onRestore?: () => void;
  onBack?: () => void;
  locale?: string;
  messages?: LoraMessagesInput;
};

type KeyRow = { key: string; unit: string | null };

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const list = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : '');

export function LoraCodecDetail({
  codec, onTest, revisions, revisionsTotal, onRevisionsQuery, revisionsLoading, onCopy, onEdit, onDelete, onWithdraw, onRestore, onBack, locale, messages,
}: LoraCodecDetailProps) {
  const all = mergeLoraMessages(messages);
  const m = all.codec;
  const d = codec.document;
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);
  const keys = useMemo((): KeyRow[] => Object.entries(codec.outputSet ?? {}).map(([key, unit]) => ({ key, unit })), [codec.outputSet]);
  const first = Array.isArray(d.tests) ? (d.tests[0] as { fport?: number; hex?: string } | undefined) : undefined;
  const keyColumns: Column<KeyRow>[] = [
    { key: 'key', header: m.key, sortable: true, render: (r) => <code className="font-mono text-xs">{r.key}</code> },
    { key: 'unit', header: m.unit, sortable: true, render: (r) => <span className="text-xs">{r.unit ?? m.noUnit}</span> },
  ];
  const revColumns: Column<LoraCodecRevisionRow>[] = [
    { key: 'rev', header: m.revision, sortable: true, align: 'right', render: (r) => <span className="tabular-nums">{r.rev}</span> },
    { key: 'publishedAt', header: m.published, sortable: true, render: (r) => <span className="text-xs">{date.format(new Date(r.publishedAt))}</span> },
    { key: 'size', header: m.size, sortable: true, align: 'right', hideBelow: 'sm', render: (r) => <span className="tabular-nums text-xs">{fillText(m.bytes, { n: r.size })}</span> },
    { key: 'keys', header: m.keys, align: 'right', hideBelow: 'sm', render: (r) => <span className="tabular-nums text-xs">{r.keys}</span> },
    { key: 'sha256', header: m.sha256, hideBelow: 'md', render: (r) => <code className="font-mono text-xs">{r.sha256.slice(0, 16)}…</code> },
  ];
  const withdrawn = codec.status === 'WITHDRAWN';
  const actions = [
    onBack && <Button key="back" variant="ghost" size="sm" onClick={onBack}>{m.back}</Button>,
    onCopy && <Button key="copy" variant="primary" size="sm" onClick={onCopy}>{m.copy}</Button>,
    onEdit && <Button key="edit" variant="primary" size="sm" onClick={onEdit}>{m.edit}</Button>,
    onDelete && <Button key="delete" variant="danger" size="sm" onClick={onDelete}>{m.delete}</Button>,
    onWithdraw && !withdrawn && <Button key="withdraw" variant="danger" size="sm" onClick={onWithdraw}>{m.withdraw}</Button>,
    onRestore && withdrawn && <Button key="restore" variant="outline" size="sm" onClick={onRestore}>{m.restore}</Button>,
  ].filter(Boolean);
  return (
    <div className="space-y-6">
      {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}
      {withdrawn && <Callout variant="warning">{m.withdrawnNote}{codec.withdrawnReason ? ` (${codec.withdrawnReason})` : ''}</Callout>}
      <section className="space-y-2">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
          {str(d.title) ?? codec.id}
          <Badge variant={codec.scope === 'tenant' ? 'primary' : 'neutral'} size="sm">{codec.scope === 'tenant' ? all.codecs.scopeTenant : all.codecs.scopePublic}</Badge>
          {d.verified === true && <Badge variant="success" size="sm">{all.codecs.verifiedYes}</Badge>}
        </h3>
        <DescriptionList
          dense
          messages={{ copy: all.common.copy, copied: all.common.copied }}
          items={[
            { label: m.id, value: codec.id, mono: true, copyValue: codec.id },
            { label: m.rev, value: String(codec.rev) },
            { label: m.sha256, value: `${codec.sha256.slice(0, 16)}…`, mono: true, copyValue: codec.sha256 },
            { label: all.codecs.vendor, value: str(d.vendor) },
            { label: m.models, value: list(d.models) },
            { label: m.fports, value: list(d.fports) },
            { label: m.oui, value: list(d.oui), mono: true },
            { label: all.codecs.kind, value: str(d.kind) ?? (str(d.extends) ? `${str(d.extends)} (extends)` : undefined), mono: true },
            { label: m.origin, value: str(d.origin) },
            { label: m.source, value: str(d.source), wide: true },
          ]}
        />
        <p className="text-xs text-text-secondary">{m.downlinks} {m.flows}</p>
      </section>
      <LoraCodecBench key={codec.id} onRun={onTest} initial={first && typeof first.fport === 'number' && typeof first.hex === 'string' ? { fport: first.fport, hex: first.hex } : undefined} messages={messages} idPrefix={`lora-bench-${codec.id}`} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">{m.outputSet}</h3>
        <DataTable<KeyRow>
          mode="paginated" variant="plain" density="compact" caption={m.outputSet} columns={keyColumns} rows={keys} rowId={(r) => r.key}
          pageSize={20} pageSizeOptions={LIST_PAGE_SIZES} searchPlaceholder={m.key} emptyMessage={m.outputEmpty}
          messages={{ loading: all.common.loading, retry: all.common.retry }}
        />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">{m.revisions}</h3>
        <DataTable<LoraCodecRevisionRow>
          {...(onRevisionsQuery
            ? { mode: 'manual' as const, total: revisionsTotal ?? revisions.length, onQueryChange: onRevisionsQuery, loading: revisionsLoading }
            : { mode: 'paginated' as const })}
          variant="plain" density="compact" caption={m.revisions} columns={revColumns} rows={revisions as LoraCodecRevisionRow[]} rowId={(r) => String(r.rev)}
          pageSize={10} pageSizeOptions={LIST_PAGE_SIZES} searchable={false} multiSort={false} defaultQuery={{ sort: [{ key: 'rev', dir: 'desc' }] }}
          emptyMessage={m.revisionsEmpty} messages={{ loading: all.common.loading, retry: all.common.retry }}
        />
      </section>
      <section className="space-y-2">
        <Textarea id={`lora-codec-doc-${codec.id}`} label={m.document} hint={codec.scope === 'public' ? m.documentReadOnly : undefined} value={JSON.stringify(d, null, 2)} readOnly rows={14} className="font-mono text-xs" />
      </section>
    </div>
  );
}
