'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { fill } from '../format';
import type { SettingsModelOutcome } from '../types/settings';
import type { SettingsMessagesInput } from './messages';
import type { SettingsFleetAdapter } from './settings-adapter';
import { errorText } from './SectionEditorDrawer';
import { useSettingsText } from './SettingsText';

export interface SupportByModelDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Must carry `supportModels`; the drawer shows nothing without it. */
  adapter: SettingsFleetAdapter;
  messages?: SettingsMessagesInput;
  locale?: string;
}

type Row = SettingsModelOutcome & Record<string, unknown>;
type Days = 1 | 7 | 30 | 90;
const WINDOWS: Days[] = [1, 7, 30, 90];

const controlCls = 'block rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

/**
 * SupportByModelDrawer — the platform's support view of device settings: for each model and firmware, over every workspace, how many changes
 * the devices applied, undid, refused or let expire, how many sections wait for a check after a firmware update, the share undone and in how
 * many workspaces (never which). The worst share undone comes first; a window of 1, 7, 30 or 90 days. Read only.
 */
export function SupportByModelDrawer({ open, onClose, adapter, messages, locale }: SupportByModelDrawerProps) {
  const { m } = useSettingsText(messages, locale);
  const [days, setDays] = useState<Days>(7);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !adapter.supportModels) return;
    const ac = new AbortController();
    setRows(null);
    setError(null);
    adapter.supportModels(days, ac.signal).then((r) => setRows(r.data as Row[]), (e) => { if (!ac.signal.aborted) setError(errorText(m, e)); });
    return () => ac.abort();
  }, [open, adapter, days, m]);

  const pct = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString(locale)} %`;
  const columns: Column<Row>[] = [
    { key: 'model', header: m.support.model, sortable: true },
    { key: 'fw', header: m.support.fw, sortable: true },
    { key: 'applied', header: m.support.applied, sortable: true, align: 'right' },
    { key: 'reverted', header: m.support.reverted, sortable: true, align: 'right' },
    { key: 'revertShare', header: m.support.share, sortable: true, align: 'right', render: (r) => pct(r.revertShare) },
    { key: 'rejected', header: m.support.rejected, sortable: true, align: 'right' },
    { key: 'expired', header: m.support.expired, sortable: true, align: 'right' },
    { key: 'needsReview', header: m.support.needsReview, sortable: true, align: 'right' },
    { key: 'workspaces', header: m.support.workspaces, sortable: true, align: 'right' },
  ];

  return (
    <Drawer open={open} onClose={onClose} title={m.support.title} closeLabel={m.common.close} className="w-full sm:max-w-4xl"
      footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>{m.common.close}</Button></div>}>
      <div className="space-y-4" data-settings-support="">
        <p className="text-sm text-text-secondary">{m.support.subtitle}</p>
        <label className="flex items-center gap-2 text-sm text-text-primary">
          {m.support.window}
          <select className={controlCls} value={days} onChange={(e) => setDays(Number(e.target.value) as Days)}>
            {WINDOWS.map((d) => <option key={d} value={d}>{fill(m.support.days, { n: d })}</option>)}
          </select>
        </label>
        {error && <Callout variant="danger">{error}</Callout>}
        {rows && rows.length === 0 && <Callout variant="info">{m.support.empty}</Callout>}
        {rows && rows.length > 0 && (
          <DataTable<Row> columns={columns} rows={rows} caption={m.support.title} rowId={(r) => `${r.model}\u0000${r.fw}`} />
        )}
      </div>
    </Drawer>
  );
}
