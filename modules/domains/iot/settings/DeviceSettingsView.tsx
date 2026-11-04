'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClockRotateLeft, faSliders } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Spinner } from '@/modules/ui/Spinner';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill } from '../format';
import { SETTINGS_SECTION_STATES, type DeviceSettings, type DeviceSettingsSchema, type SettingsSection } from '../types/settings';
import type { SettingsMessagesInput } from './messages';
import type { DeviceSettingsAdapter } from './settings-adapter';
import { errorText, SectionEditorDrawer } from './SectionEditorDrawer';
import { SettingsHistoryTable } from './SettingsHistoryTable';
import { SettingsStateBadge } from './SettingsStateBadge';
import { localized } from './settings-schema';
import { useSettingsText } from './SettingsText';

export interface DeviceSettingsViewProps {
  adapter: DeviceSettingsAdapter;
  deviceId: string;
  /** How often to read again while a change is on its way (ms). Default 5000; 0 never. */
  pollMs?: number;
  /** Open this section's drawer first (a deep link). */
  initialSection?: string;
  onSectionChange?: (section: string | null) => void;
  messages?: SettingsMessagesInput;
  locale?: string;
  className?: string;
}

type Row = Record<string, unknown> & { id: string; title: string; status: string; s: SettingsSection; editable: boolean };

const IN_FLIGHT = new Set(['pending', 'confirming']);

/**
 * DeviceSettingsView — the device page's Settings tab (docs/concepts/iot-device-settings 05): the sections the device's own manifest lists
 * (a model whose manifest gains a section shows it with no code change), each with where it stands; a section opens its editor in a drawer.
 * It says when the device does not take settings from the cloud and why, when its settings list is not from a released firmware
 * (unverified), and when its firmware is past the support window (read only). "History" in the header opens every change of the device in
 * a drawer. While a change is on its way the tab reads again every few seconds, so "Applied" shows up without a reload.
 */
export function DeviceSettingsView({ adapter, deviceId, pollMs = 5000, initialSection, onSectionChange, messages, locale, className }: DeviceSettingsViewProps) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const [data, setData] = useState<{ settings: DeviceSettings; schema: DeviceSettingsSchema | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(initialSection ?? null);
  const [history, setHistory] = useState(false);
  const [tick, setTick] = useState(0);
  const schemaRef = useRef<DeviceSettingsSchema | null>(null);

  // the manifest is the firmware's: read again only when its hash moved
  const load = useCallback((signal?: AbortSignal) => adapter.read(deviceId, signal)
    .then(async (settings) => {
      let schema: DeviceSettingsSchema | null = null;
      if (settings.supported) {
        schema = schemaRef.current && schemaRef.current.hash === settings.manifest?.hash ? schemaRef.current : await adapter.schema(deviceId, signal);
        schemaRef.current = schema;
      }
      if (!signal?.aborted) { setData({ settings, schema }); setError(null); }
    })
    .catch((e) => { if (!signal?.aborted) setError(errorText(m, e)); }), [adapter, deviceId, m]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load, tick]);

  const inFlight = !!data?.settings.sections.some((s) => s.state && IN_FLIGHT.has(s.state));
  useEffect(() => {
    if (!pollMs || !inFlight) return;
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setTick((t) => t + 1); }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, inFlight]);

  const titleOf = useCallback((s: Pick<SettingsSection, 'section' | 'title'>) => localized(s.title ?? data?.schema?.sections[s.section]?.title, lang) ?? s.section, [data?.schema, lang]);
  const rows: Row[] = useMemo(() => (data?.settings.sections ?? []).map((s) => ({
    id: s.section,
    title: titleOf(s),
    status: s.drift ? 'drift' : (s.state ?? 'never'),
    applied: s.appliedAt ?? '',
    s,
    editable: !!data?.schema?.sections[s.section],
  })), [data, titleOf]);

  const choose = (id: string | null) => { setOpen(id); onSectionChange?.(id); };

  if (error && !data) {
    return (
      <Callout variant="danger" className={className}>
        <p>{error}</p>
        <Button className="mt-2" size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>{m.common.retry}</Button>
      </Callout>
    );
  }
  if (!data) return <div className={cn('flex justify-center p-6', className)} role="status" aria-label={m.common.loading}><Spinner /></div>;
  const { settings, schema } = data;
  if (!settings.supported) {
    const unknown = settings.reason === 'manifest_unknown';
    return (
      <EmptyState
        className={className}
        icon={<FontAwesomeIcon icon={faSliders} aria-hidden="true" />}
        title={unknown ? m.tab.manifestUnknown : m.tab.unsupported}
        description={unknown ? fill(m.tab.manifestUnknownHint, { model: settings.model ?? m.common.none, fw: settings.fw ?? m.common.none }) : m.tab.unsupportedHint}
      />
    );
  }

  const when = (iso: unknown) => {
    if (typeof iso !== 'string' || !iso) return m.common.none;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang);
  };
  const columns: Column<Row>[] = [
    { key: 'title', header: m.tab.section, sortable: true, render: (r) => <span className="font-medium text-text-primary">{r.title}</span> },
    { key: 'status', header: m.tab.status, sortable: true, render: (r) => <SettingsStateBadge state={r.s.state} drift={r.s.drift} size="sm" messages={m} /> },
    { key: 'applied', header: m.tab.lastApplied, sortable: true, hideBelow: 'sm', render: (r) => when(r.s.appliedAt) },
    {
      key: 'origin', header: m.tab.whoChanged, hideBelow: 'md',
      render: (r) => (r.s.origin === 'local' ? m.tab.changedOnDevice : r.s.origin === 'cloud' ? m.tab.changedHere : m.common.none),
    },
  ];
  const filterFields: DataTableFilterField<Row>[] = [{
    id: 'status', label: m.tab.status, type: 'select',
    options: [...SETTINGS_SECTION_STATES, 'drift', 'never'].map((s) => ({ value: s, label: (m.state as Record<string, string>)[s] ?? s })),
  }];
  const current = open ? settings.sections.find((s) => s.section === open) : undefined;
  const manifest = open && schema ? schema.sections[open] : undefined;

  return (
    <div className={cn('space-y-4', className)} data-device-settings="">
      <h2 className="sr-only">{m.tab.title}</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        <span>{fill(m.tab.model, { model: settings.model ?? m.common.none, fw: settings.fw ?? m.common.none })}</span>
        {settings.manifest && !settings.manifest.verified && <Badge variant="warning" size="sm" title={m.tab.unverifiedHint}>{m.tab.unverified}</Badge>}
      </div>
      {settings.manifest && !settings.manifest.verified && <p className="text-xs text-text-secondary">{m.tab.unverifiedHint}</p>}
      {!settings.writable && <Callout variant="warning" title={m.tab.readOnly}>{m.tab.readOnlyHint}</Callout>}
      {settings.writable && settings.viewer && settings.viewer.classes.length === 0 && <Callout variant="info">{m.tab.viewOnly}</Callout>}
      {error && <Callout variant="danger">{error}</Callout>}
      <DataTable<Row>
        columns={columns}
        rows={rows}
        mode="paginated"
        variant="plain"
        title={m.tab.title}
        subtitle={m.tab.intro}
        caption={m.tab.sectionsTable}
        rowId={(r) => r.id}
        filterFields={filterFields}
        searchable={rows.length > 8}
        onRowClick={(r) => { if (r.editable) choose(r.id); }}
        rowActions={[{ id: 'open', label: m.tab.open, onClick: (r) => choose(r.id), disabled: (r) => !r.editable, disabledReason: m.tab.oldManifest }]}
        emptyMessage={m.list.empty}
        defaultSort={[{ key: 'title', dir: 'asc' }]}
        headerActions={(
          <Button size="sm" variant="outline" onClick={() => setHistory(true)}>
            <FontAwesomeIcon icon={faClockRotateLeft} className="mr-1.5" aria-hidden="true" />{m.editor.history}
          </Button>
        )}
      />
      {current && manifest && (
        <SectionEditorDrawer
          key={current.section}
          open
          onClose={() => choose(null)}
          adapter={adapter}
          deviceId={deviceId}
          settings={settings}
          section={current}
          manifest={manifest}
          onReload={() => setTick((t) => t + 1)}
          messages={m}
          locale={lang}
        />
      )}
      <Drawer open={history} onClose={() => setHistory(false)} title={m.history.title} closeLabel={m.common.close} className="w-full sm:max-w-3xl">
        {history && (
          <SettingsHistoryTable
            adapter={adapter}
            deviceId={deviceId}
            sectionTitle={(id) => titleOf({ section: id, title: settings.sections.find((s) => s.section === id)?.title ?? null })}
            reasonText={(c) => (m.errors as Record<string, string>)[c] ?? c}
            reloadKey={tick}
            messages={m}
            locale={lang}
          />
        )}
      </Drawer>
    </div>
  );
}
