'use client';
import { useMemo } from 'react';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { CertificateStatusBadge, certificateDaysLeft } from './CertificateStatusBadge';
import { mergePkiMessages, type PkiMessagesInput } from './messages';
import type { DeviceCertificate } from './types';

/** The columns the certificate list sorts by, as NB's API names them (`CERTIFICATE_SORTABLE`). */
export const CERTIFICATE_SORT_KEYS = ['deviceSerial', 'status', 'notAfter', 'issuedVia'] as const;
const STATUSES = ['ACTIVE', 'SUPERSEDED', 'REVOKED', 'EXPIRED'] as const;
const ISSUED_VIA = ['BOOTSTRAP', 'RENEWAL', 'RECOVERY', 'SERVER_KEYGEN', 'UPLOAD', 'ENROLL'] as const;
const KEY_ALGS = ['EC-P256', 'EC-P384', 'RSA-2048', 'RSA-3072', 'RSA-4096'] as const;

export type CertificateTableProps = {
  rows: readonly DeviceCertificate[];
  onOpen?: (c: DeviceCertificate) => void;
  /** With `onQueryChange`: the rows across every page. */
  total?: number;
  /** The host serves the pages: every change of page, rows per page, sort, search or filters, and the first query on mount. */
  onQueryChange?: (query: DataTableQuery) => void;
  defaultQuery?: Partial<DataTableQuery>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  now?: number;
  locale?: string;
  messages?: PkiMessagesInput;
  className?: string;
};

/**
 * CertificateTable — device certificates (NB iot_pki 03 §3.5, the operations page): the device serial, the state with the days left when
 * fewer than 30 remain, the expiry date, how it was issued, the key type and the start of the fingerprint. A row opens the certificate.
 *
 * A full list on the DataTable's own toolbar: search (serial, fingerprint), the Filters panel (status, several; issued by; key type;
 * expires within 7 / 30 / 90 days), sortable columns (`CERTIFICATE_SORT_KEYS`, one at a time), rows per page and paging. With
 * `onQueryChange` the host serves every page (`mode="manual"`): the filter ids `status` (a list), `issuedVia`, `keyAlg` and
 * `expiresWithinDays` are NB's list parameters. Without it the table pages, sorts, searches and filters `rows` in the browser.
 */
export function CertificateTable({ rows, onOpen, total, onQueryChange, defaultQuery, loading = false, error, onRetry, now, locale, messages, className }: CertificateTableProps) {
  const all = mergePkiMessages(messages);
  const m = all.certificates;
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);
  const columns: Column<DeviceCertificate>[] = [
    { key: 'deviceSerial', header: m.serial, sortable: true, render: (c) => <span className="font-mono text-xs font-medium">{c.deviceSerial ?? c.subjectCn}</span> },
    { key: 'status', header: m.status, sortable: true, searchable: false, render: (c) => <CertificateStatusBadge certificate={c} now={now} messages={messages} /> },
    { key: 'notAfter', header: m.expires, sortable: true, searchable: false, render: (c) => <span className="tabular-nums text-xs">{date.format(new Date(c.notAfter))}</span> },
    { key: 'issuedVia', header: m.issuedVia, sortable: true, searchable: false, hideBelow: 'md', render: (c) => <span className="text-xs">{(all.issuedVia as Record<string, string>)[c.issuedVia] ?? c.issuedVia}</span> },
    { key: 'keyAlg', header: m.keyAlg, searchable: false, hideBelow: 'lg', render: (c) => <span className="text-xs">{c.keyAlg}</span> },
    { key: 'fingerprintSha256', header: m.fingerprint, hideBelow: 'lg', render: (c) => <code className="font-mono text-xs text-text-secondary" title={c.fingerprintSha256}>{c.fingerprintSha256.slice(0, 16)}…</code> },
  ];
  const filterFields = useMemo((): DataTableFilterField<DeviceCertificate>[] => [
    { id: 'status', label: m.status, type: 'multiselect', options: STATUSES.map((s) => ({ value: s, label: all.status[s] })) },
    { id: 'issuedVia', label: m.issuedVia, type: 'select', options: ISSUED_VIA.map((v) => ({ value: v, label: all.issuedVia[v] })) },
    { id: 'keyAlg', label: m.keyAlg, type: 'select', options: KEY_ALGS.map((k) => ({ value: k, label: k })) },
    {
      id: 'expiresWithinDays', label: m.expiresWithin, type: 'select',
      options: [{ value: '7', label: m.within7 }, { value: '30', label: m.within30 }, { value: '90', label: m.within90 }],
      match: (c, v) => { const left = certificateDaysLeft(c, now); return c.status === 'ACTIVE' && left >= 0 && left < Number(v); },
    },
  ], [m, all, now]);
  return (
    <div className={className}>
      <DataTable<DeviceCertificate>
        {...(onQueryChange
          ? { mode: 'manual' as const, total: total ?? rows.length, onQueryChange, loading, error: error || undefined }
          : { mode: 'paginated' as const, state: error ? 'error' as const : loading && !rows.length ? 'loading' as const : undefined, errorMessage: error || undefined })}
        variant="plain"
        caption={m.caption}
        columns={columns}
        rows={rows as DeviceCertificate[]}
        rowId={(c) => c.certificateId}
        onRowClick={onOpen ? (c) => onOpen(c) : undefined}
        onRetry={onRetry}
        defaultQuery={defaultQuery}
        multiSort={false}
        searchPlaceholder={m.search}
        filterFields={filterFields}
        pageSize={defaultQuery?.pageSize ?? 20}
        pageSizeOptions={LIST_PAGE_SIZES}
        emptyMessage={m.empty}
        messages={{ loading: all.common.loading, retry: all.common.retry }}
        density="compact"
        keyboardNavigation
      />
    </div>
  );
}
