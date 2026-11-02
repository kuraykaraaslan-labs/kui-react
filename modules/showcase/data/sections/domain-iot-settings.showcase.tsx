'use client';
// Showcase entries for a device's settings managed from the cloud (next-boilerplate docs/concepts/iot-device-settings 05): the Settings tab,
// the generic settings form with its write-only secrets, the state badge, the drift table, and the baselines and bulk jobs pages, over the
// in-memory settings demo (`modules/domains/iot/settings/demo-settings.ts`, the roltek-420 manifest with port forwards).

import { useState } from 'react';
import type { ShowcaseComponent } from '../showcase.types';
import { DeviceSettingsView } from '@/modules/domains/iot/settings/DeviceSettingsView';
import { SettingsForm } from '@/modules/domains/iot/settings/SettingsForm';
import { SecretField } from '@/modules/domains/iot/settings/SecretField';
import { SettingsStateBadge } from '@/modules/domains/iot/settings/SettingsStateBadge';
import { SettingsDiffTable } from '@/modules/domains/iot/settings/SettingsDiffTable';
import { BaselinesView } from '@/modules/domains/iot/settings/BaselinesView';
import { JobsView } from '@/modules/domains/iot/settings/JobsView';
import { JobDetailView } from '@/modules/domains/iot/settings/JobDetailView';
import { createDemoFleetAdapter, createDemoSettingsAdapter } from '@/modules/domains/iot/settings/demo-settings';
import { DEMO_SETTINGS_MANIFEST } from '@/modules/domains/iot/settings/demo-settings-manifest';
import { prepareForEdit } from '@/modules/domains/iot/settings/settings-schema';
import { SETTINGS_SECTION_STATES } from '@/modules/domains/iot/types/settings';

function entry(def: Omit<ShowcaseComponent, 'sourceCode' | 'category' | 'since'> & { usage: string }): ShowcaseComponent {
  const { usage, ...rest } = def;
  const out = { ...rest, category: 'Domain', since: '2026-11', status: 'beta' } as ShowcaseComponent;
  out.sourceCode = usage;
  return out;
}

const WIFI = DEMO_SETTINGS_MANIFEST.sections.wifi.schema;
const WIFI_DOC = {
  country: 'TR',
  radios: [{ band: '2g', channel: 'auto', width: 'HT20' }],
  ssids: [{ ssid: 'Office', band: '2g', security: 'wpa2-psk', key: { set: true }, hidden: false, isolate: false }],
};

function SettingsViewDemo({ device }: { device: string }) {
  const [adapter] = useState(() => createDemoSettingsAdapter({ devices: { router: 'r1', unsupported: 's1', unknown: 'u1' } }));
  return <DeviceSettingsView adapter={adapter} deviceId={device} pollMs={1500} />;
}

function FormDemo({ mode }: { mode: 'device' | 'baseline' }) {
  const [values, setValues] = useState(() => prepareForEdit(WIFI, WIFI_DOC));
  const [keys, setKeys] = useState<Set<string>>(() => new Set(['ssids']));
  return (
    <SettingsForm
      section="wifi"
      schema={WIFI}
      values={values}
      onChange={setValues}
      reported={WIFI_DOC}
      mode={mode}
      include={mode === 'baseline' ? { keys, onToggle: (k, on) => setKeys((s) => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n; }) } : undefined}
    />
  );
}

function SecretDemo({ set }: { set: boolean }) {
  const [v, setV] = useState<unknown>(set ? { $keep: true, $at: 'ssids.0.key' } : undefined);
  return <SecretField id={`secret-${set}`} label="Password" value={v} onChange={setV} minLength={8} maxLength={63} />;
}

function FleetDemo({ page, canManage = true }: { page: 'baselines' | 'jobs' | 'job'; canManage?: boolean }) {
  const [adapter] = useState(() => createDemoFleetAdapter({ canManage }));
  if (page === 'baselines') return <BaselinesView adapter={adapter} onOpenJobs={() => undefined} />;
  if (page === 'jobs') return <JobsView adapter={adapter} jobHref={(id) => `#job-${id}`} onOpenBaselines={() => undefined} />;
  return <JobDetailView adapter={adapter} jobId="job-1" pollMs={2000} />;
}

export function buildIoTSettingsEntries(): ShowcaseComponent[] {
  return [
    entry({
      id: 'iot-device-settings-view',
      title: 'DeviceSettingsView',
      abbr: 'SG',
      description: 'The device page\'s Settings tab: the sections of the device\'s own settings manifest with where each stands; a section opens its editor in a drawer (generic, or the firewall, Wi-Fi and LTE hints), with a dry run, the one ConfirmDialog (the section name typed for a change that can cut the device off), drift and history.',
      filePath: 'modules/domains/iot/settings/DeviceSettingsView.tsx',
      usage: `import { DeviceSettingsView } from '@/modules/domains/iot';\n<DeviceSettingsView adapter={settingsAdapter} deviceId={id} />`,
      variants: [
        { title: 'A Roltek router (Wi-Fi, LTE, firewall, port forwards; firewall rules changed on the device)', layout: 'stack', preview: <SettingsViewDemo device="r1" />, code: '<DeviceSettingsView adapter={adapter} deviceId="r1" />' },
        { title: 'A device that takes no settings from the cloud', layout: 'stack', preview: <SettingsViewDemo device="s1" />, code: '<DeviceSettingsView adapter={adapter} deviceId="s1" />' },
        { title: 'A model not described yet', layout: 'stack', preview: <SettingsViewDemo device="u1" />, code: '<DeviceSettingsView adapter={adapter} deviceId="u1" />' },
      ],
    }),
    entry({
      id: 'iot-settings-form',
      title: 'SettingsForm',
      abbr: 'SJ',
      description: 'The generic editor of one settings section from its JSON Schema and annotations: plain fields through SchemaForm, write-only secrets, values only the device can change shown read-only, "Automatic or a number" choices, lists of objects as a DataTable with a drawer per row. Baseline mode: an Include switch per setting, no secrets.',
      filePath: 'modules/domains/iot/settings/SettingsForm.tsx',
      usage: `<SettingsForm section="wifi" schema={manifest.sections.wifi.schema} values={values} onChange={setValues} reported={section.reported} />`,
      variants: [
        { title: 'A device\'s Wi-Fi', layout: 'stack', preview: <FormDemo mode="device" />, code: '<SettingsForm section="wifi" schema={schema} values={values} onChange={setValues} />' },
        { title: 'Part of a baseline', layout: 'stack', preview: <FormDemo mode="baseline" />, code: '<SettingsForm mode="baseline" include={{ keys, onToggle }} … />' },
      ],
    }),
    entry({
      id: 'iot-secret-field',
      title: 'SecretField',
      abbr: 'SK',
      description: 'A write-only setting (a Wi-Fi or APN password): says whether one is set, "Change" types a new one with Show / Hide, "Keep the current one" goes back. The value is never shown.',
      filePath: 'modules/domains/iot/settings/SecretField.tsx',
      usage: `<SecretField id="key" label="Password" value={value} onChange={setValue} />`,
      variants: [
        { title: 'Set', layout: 'side', preview: <SecretDemo set />, code: '<SecretField label="Password" value={{ $keep: true }} … />' },
        { title: 'Not set', layout: 'side', preview: <SecretDemo set={false} />, code: '<SecretField label="Password" value={undefined} … />' },
      ],
    }),
    entry({
      id: 'iot-settings-state-badge',
      title: 'SettingsStateBadge',
      abbr: 'SH',
      description: 'Where a settings section stands in words: applied, on its way, the device trying it, undone or refused by the device, withdrawn while offline, to check after an update; "Changed on the device" beside it for drift.',
      filePath: 'modules/domains/iot/settings/SettingsStateBadge.tsx',
      usage: `<SettingsStateBadge state="applied" drift />`,
      variants: [
        { title: 'Every state', layout: 'side', preview: <div className="flex flex-wrap gap-2">{SETTINGS_SECTION_STATES.map((s) => <SettingsStateBadge key={s} state={s} />)}<SettingsStateBadge state={null} /></div>, code: '<SettingsStateBadge state="pending" />' },
        { title: 'Drift', layout: 'side', preview: <SettingsStateBadge state="applied" drift />, code: '<SettingsStateBadge state="applied" drift />' },
      ],
    }),
    entry({
      id: 'iot-settings-diff-table',
      title: 'SettingsDiffTable',
      abbr: 'SL',
      description: 'Where a device runs something else than was asked: one row per setting, what was asked and what the device has, in words; a secret only says whether each side holds one.',
      filePath: 'modules/domains/iot/settings/SettingsDiffTable.tsx',
      usage: `<SettingsDiffTable section="wifi" schema={schema} desired={section.desired} reported={section.reported} />`,
      variants: [
        { title: 'Changed on the device', layout: 'stack', preview: <SettingsDiffTable section="wifi" schema={WIFI} desired={WIFI_DOC} reported={{ ...WIFI_DOC, ssids: [{ ...WIFI_DOC.ssids[0], ssid: 'Office-old', hidden: true }] }} />, code: '<SettingsDiffTable … />' },
        { title: 'The same', layout: 'stack', preview: <SettingsDiffTable section="wifi" schema={WIFI} desired={WIFI_DOC} reported={WIFI_DOC} />, code: '<SettingsDiffTable … />' },
      ],
    }),
    entry({
      id: 'iot-settings-baselines-view',
      title: 'BaselinesView',
      abbr: 'BV',
      description: 'The tenant\'s settings baselines (named partial settings for some models): a DataTable with search, the editor in a drawer with the sections of the chosen models and an Include switch per setting, delete through the ConfirmDialog.',
      filePath: 'modules/domains/iot/settings/BaselinesView.tsx',
      usage: `<BaselinesView adapter={fleetAdapter} jobsHref="/jobs" />`,
      variants: [
        { title: 'Manage', layout: 'stack', preview: <FleetDemo page="baselines" />, code: '<BaselinesView adapter={adapter} />' },
        { title: 'Read only', layout: 'stack', preview: <FleetDemo page="baselines" canManage={false} />, code: '<BaselinesView adapter={adapter} />' },
      ],
    }),
    entry({
      id: 'iot-settings-jobs-view',
      title: 'JobsView',
      abbr: 'JV',
      description: 'The bulk settings jobs: a DataTable with status filters and how far each job\'s waves have gone; "New job" opens a drawer (baseline, devices by models, profile or picked, waves and their checks) with a dry-run plan and the confirmation.',
      filePath: 'modules/domains/iot/settings/JobsView.tsx',
      usage: `<JobsView adapter={fleetAdapter} jobHref={(id) => \`/jobs/\${id}\`} baselinesHref="/baselines" />`,
      variants: [
        { title: 'Manage', layout: 'stack', preview: <FleetDemo page="jobs" />, code: '<JobsView adapter={adapter} jobHref={href} />' },
        { title: 'Read only', layout: 'stack', preview: <FleetDemo page="jobs" canManage={false} />, code: '<JobsView adapter={adapter} jobHref={href} />' },
      ],
    }),
    entry({
      id: 'iot-settings-job-detail-view',
      title: 'JobDetailView',
      abbr: 'JD',
      description: 'One bulk settings job: status and why it paused, Pause / Resume (past a failed wave: said and recorded) / Cancel, the waves with their counters and results, and every device with what happened per section.',
      filePath: 'modules/domains/iot/settings/JobDetailView.tsx',
      usage: `<JobDetailView adapter={fleetAdapter} jobId={id} />`,
      variants: [
        { title: 'Running', layout: 'stack', preview: <FleetDemo page="job" />, code: '<JobDetailView adapter={adapter} jobId="job-1" />' },
        { title: 'Read only', layout: 'stack', preview: <FleetDemo page="job" canManage={false} />, code: '<JobDetailView adapter={adapter} jobId="job-1" />' },
      ],
    }),
  ];
}
