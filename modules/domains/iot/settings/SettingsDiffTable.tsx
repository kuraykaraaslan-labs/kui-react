'use client';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import type { SettingsSchemaNode } from '../types/settings';
import type { SettingsMessages, SettingsMessagesInput } from './messages';
import { pathLabel } from './SettingsForm';
import { valueLabel } from './settings-presets';
import { differences, schemaKey, pathOf } from './settings-schema';
import { useSettingsText } from './SettingsText';

type Row = { path: string; label: string; desired: string; reported: string };

/** A leaf value in words: yes / no, a choice's word, a secret as set / not set, a list joined. */
export function leafText(m: SettingsMessages, section: string, path: string, v: unknown, sensitive = false): string {
  if (sensitive) return v ? m.secret.set : m.secret.notSet;
  if (v === undefined || v === null || v === '') return m.common.none;
  if (typeof v === 'boolean') return v ? m.common.yes : m.common.no;
  if (Array.isArray(v)) return v.length ? v.map((x) => valueLabel(m, section, schemaKey(pathOf(path)), x)).join(', ') : m.common.none;
  if (typeof v === 'object') return JSON.stringify(v);
  return valueLabel(m, section, schemaKey(pathOf(path)), v);
}

/**
 * SettingsDiffTable — where the device runs something else than was asked from here (drift, or a change it has not applied yet): one
 * row per setting that differs, what was asked and what the device has, in words. A secret only says whether each side holds one.
 */
export function SettingsDiffTable({ section, schema, desired, reported, messages, locale, className }: {
  section: string;
  schema: SettingsSchemaNode;
  desired: Record<string, unknown> | null;
  reported: Record<string, unknown> | null;
  messages?: SettingsMessagesInput;
  locale?: string;
  className?: string;
}) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const rows: Row[] = differences(schema, desired, reported).map((d) => ({
    path: d.path,
    label: pathLabel(m, section, schema, d.path, lang),
    desired: leafText(m, section, d.path, d.desired, d.sensitive),
    reported: leafText(m, section, d.path, d.reported, d.sensitive),
  }));
  const columns: Column<Row>[] = [
    { key: 'label', header: m.diff.setting, sortable: true },
    { key: 'desired', header: m.diff.desired },
    { key: 'reported', header: m.diff.reported },
  ];
  return (
    <DataTable<Row>
      className={className}
      columns={columns}
      rows={rows}
      mode="paginated"
      variant="plain"
      caption={m.diff.table}
      rowId={(r) => r.path}
      searchable={rows.length > 8}
      emptyMessage={m.diff.empty}
      pageSize={25}
    />
  );
}
