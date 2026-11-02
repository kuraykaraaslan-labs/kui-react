'use client';
import { useCallback } from 'react';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFetchArgs, DataTableFetchResult } from '@/modules/ui/Table/types';
import { fill } from '../format';
import type { SettingsHistoryEntry } from '../types/settings';
import type { SettingsMessages, SettingsMessagesInput } from './messages';
import type { DeviceSettingsAdapter } from './settings-adapter';
import { useSettingsText } from './SettingsText';

type Row = SettingsHistoryEntry & Record<string, unknown>;

export function historyKind(m: SettingsMessages, e: Pick<SettingsHistoryEntry, 'kind' | 'detail'>): string {
  if (e.kind === 'desired' && e.detail?.reapply) return m.history.reapply;
  return (m.history as Record<string, string>)[e.kind] ?? e.kind;
}

export function historyActor(m: SettingsMessages, actor: string | null): string {
  if (!actor) return m.history.byDevice;
  if (actor.startsWith('user:')) return m.history.byPerson;
  if (actor.startsWith('api:')) return m.history.byKey;
  if (actor.startsWith('baseline:') || actor.startsWith('job:')) return m.history.byJob;
  return actor;
}

function detailText(m: SettingsMessages, e: SettingsHistoryEntry, reasonText: (code: string) => string): string {
  const d = e.detail ?? {};
  const changes = Array.isArray(d.changes) ? d.changes.length : Array.isArray(d.paths) ? d.paths.length : 0;
  const error = d.error && typeof d.error === 'object' ? String((d.error as { code?: unknown }).code ?? '') : '';
  const reason = typeof d.reason === 'string' ? d.reason : '';
  return [changes ? fill(m.history.paths, { n: changes }) : '', error ? reasonText(error) : '', reason ? reasonText(reason) : ''].filter(Boolean).join(' · ');
}

/**
 * SettingsHistoryTable — the change history of a device's settings (one section, or all): every change asked from here and every answer of
 * the device (applied, undone, refused, changed on the device, withdrawn while offline, to check after an update), newest first, with who
 * asked in words. Paged by the host's list API (DataTable, server mode). Never a value of a secret.
 */
export function SettingsHistoryTable({ adapter, deviceId, section, sectionTitle, reloadKey, reasonText, messages, locale, className }: {
  adapter: DeviceSettingsAdapter;
  deviceId: string;
  section?: string;
  /** The section column's words (all sections). */
  sectionTitle?: (section: string) => string;
  reloadKey?: unknown;
  /** A device's error code or a platform reason in words. */
  reasonText?: (code: string) => string;
  messages?: SettingsMessagesInput;
  locale?: string;
  className?: string;
}) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const words = reasonText ?? ((c: string) => c);
  const fetchPage = useCallback(async (args: DataTableFetchArgs): Promise<DataTableFetchResult<Row>> => {
    const dir = args.sort[0]?.dir ?? 'desc';
    const r = await adapter.history(deviceId, { section, page: Math.max(0, args.page - 1), pageSize: args.pageSize, dir }, args.signal);
    return { rows: r.data as Row[], total: r.total };
  }, [adapter, deviceId, section]);
  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang);
  };
  const columns: Column<Row>[] = [
    { key: 'at', header: m.history.when, sortable: true, render: (r) => <time dateTime={r.at}>{when(r.at)}</time> },
    ...(!section && sectionTitle ? [{ key: 'section', header: m.tab.section, render: (r: Row) => sectionTitle(r.section) } as Column<Row>] : []),
    { key: 'kind', header: m.history.what, render: (r) => historyKind(m, r) },
    { key: 'actor', header: m.history.who, render: (r) => (r.kind === 'desired' ? historyActor(m, r.actor) : m.history.byDevice) },
    { key: 'rev', header: m.history.rev, hideBelow: 'sm', render: (r) => String(r.rev) },
    { key: 'detail', header: m.history.details, hideBelow: 'md', render: (r) => detailText(m, r, words) || m.common.none },
  ];
  return (
    <DataTable<Row>
      className={className}
      columns={columns}
      mode="server"
      fetchPage={fetchPage}
      reloadKey={reloadKey}
      variant="plain"
      caption={m.history.table}
      searchable={false}
      rowId={(r) => r.id}
      defaultSort={[{ key: 'at', dir: 'desc' }]}
      emptyMessage={m.history.empty}
      pageSize={10}
    />
  );
}
