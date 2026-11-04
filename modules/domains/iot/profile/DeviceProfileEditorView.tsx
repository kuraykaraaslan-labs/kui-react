'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClone, faCopy, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Input } from '@/modules/ui/Input';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Select } from '@/modules/ui/Select';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { TabGroup, type Tab } from '@/modules/ui/TabGroup';
import { Textarea } from '@/modules/ui/Textarea';
import { Toggle } from '@/modules/ui/Toggle';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { fill, formatDateTime } from '../format';
import {
  CFG_DRIFT_POLICIES, KEY_USAGE_MAX_KEYS, RATE_LIMIT_FAMILIES, draftOf, isTelemetryKey, nextKeyOrigins, profileDraftIssues, profilePatch,
  telemetryKeyChanges, transportLabel, transportLogsIn,
  type CfgDriftPolicy, type DeviceProfile, type DeviceProfileDraft, type DeviceProfileUsage, type ProfileKeyUsage, type ProfileTransport, type ProvisionStrategy,
} from '../types/profile';
import { AuthModeSelector } from './AuthModeSelector';
import { CfgSchemaTable } from './CfgSchemaTable';
import { usageList } from './DeviceProfileListView';
import { OnlineRuleField } from './OnlineRuleField';
import { ProtocolMappingCard } from './ProtocolMappingCard';
import { ProvisioningSettingsCard } from './ProvisioningSettingsCard';
import { RateLimitEditor } from './RateLimitEditor';
import { TelemetryKeySchemaTable } from './TelemetryKeySchemaTable';
import { TransportPolicyCard } from './TransportPolicyCard';
import { ProfileSection, RangeNumberField } from './profile-fields';
import { useProfileTransports } from './profile-transports';
import { announceProfileKeyRenames } from './profile-key-events';

/**
 * DeviceProfileEditorView — one device profile (phase 01 §1.4; NB iot_device_profile 03 §3.2–3.3), read and written through the
 * adapter. Own tabs: General, Transport & auth (transport, plain MQTT or TLS, URL tokens, networks, auth modes, topic schemes and
 * custom topics), Online status (OD-57 / OD-63), Limits (rate limits, payload and session caps), Telemetry keys, Configuration keys and
 * Provisioning (strategy; the keys are the host's `provisioningKeys`, e.g. `ProvisioningKeysPanel`, else a disabled placeholder; with
 * `adapter.provisioning.setStrategy` Save sends a changed strategy there, apart from the profile patch). Every own tab edits ONE draft with one Save:
 * only the changed fields are sent, the form blocks what the host would refuse (a transport that forbids the chosen online rule
 * included) and shows the host's own refusal when it still comes. The host's `extraTabs` (Alarm rules, Commands, … contributed by other
 * modules) follow, each saving on its own. Without `canManageProfiles` everything is read-only. The device count follows every 30 s.
 *
 * A save that removed telemetry keys asks the host who still reads them (`profiles.keyUsage`: alarm rules, …). Keys renamed in place
 * are offered for a rewrite ("Update them to the new names", `profiles.renameKeys`) or kept as they are; a removed key with no new name,
 * or a viewer who may not rewrite, gets a notice naming what still reads it. The profile is saved either way: the question comes after.
 * A rename is taken only from a row of the saved table whose key was changed in place (the rows are followed through additions and
 * removals, never paired by position), and a mounted Alarm rules tab is told about it. When the question cannot be asked (more keys
 * removed than the host takes in one question, or the host fails) a warning says so.
 *
 * Save can always be pressed: with something to fix it marks every field (new key rows nobody has typed in yet included) and sends nothing.
 */
export type DeviceProfileEditorViewProps = {
  profileId: string;
  extraTabs?: Tab[];
  tab?: string;
  onTabChange?: (tab: string) => void;
  onDeleted?: () => void;
  /** After a duplicate, with the copy (the host opens it). Without it the button is still offered when the adapter can duplicate. */
  onDuplicated?: (profile: DeviceProfile) => void;
  /** The built-in transports the host offers (default: the adapter's, else MQTT, HTTP, ANY); the adapter's `transportOptions` follow. */
  transports?: readonly ProfileTransport[];
  /** The provisioning strategies the host can serve (default `DISABLED` only). */
  availableStrategies?: readonly ProvisionStrategy[];
  /** The provisioning key management, when the host has it and the viewer may use it (`ProvisioningKeysPanel`; absent: the disabled placeholder). */
  provisioningKeys?: React.ReactNode;
  className?: string;
};

/** Which own tab shows the field an issue is about (for the tab's error badge). */
const TAB_OF: Array<[RegExp, string]> = [
  [/^(name|description)$/, 'general'],
  [/^(transportType|mqttTransport|allowTokenInUrl|allowedNetworks|plaintextRpcMethods|allowedAuthModes|topicSchemes|anyTopicEnabled|prefixKeysWithTopic|maxTopicDepth|maxTopicLength|maxDistinctTopicsPerDevice|rawMaxBytes)$/, 'transport'],
  [/^(onlineRule|expectedIntervalS|onlineWindowFactor)$/, 'online'],
  [/^(rateLimits\..*|replayMsgsPerS|payloadMaxBytes|downlinkMaxBytes|maxInflightMessages|inactivityTimeoutSec|maxGatewayChildren|rpcTimeoutDefaultSec)$/, 'limits'],
  [/^(telemetrySchema|strictKeys)$/, 'telemetry'],
  [/^(cfgSchema|cfgDriftPolicy)$/, 'config'],
  [/^provisionStrategy$/, 'provisioning'],
];
const tabOf = (field: string) => TAB_OF.find(([re]) => re.test(field))?.[1] ?? 'general';

export function DeviceProfileEditorView({
  profileId, extraTabs = [], tab, onTabChange, onDeleted, onDuplicated, transports, availableStrategies, provisioningKeys, className,
}: DeviceProfileEditorViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.profiles;
  const provisioning = adapter.provisioning;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const offered = useProfileTransports(transports);

  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [draft, setDraftState] = useState<DeviceProfileDraft | null>(null);
  // where each row of the draft's key table came from in the saved one (-1: added), for renames in place (`telemetryKeyChanges`)
  const [keyOrigins, setKeyOrigins] = useState<number[]>([]);
  // Save was pressed while something was wrong: every field is marked, new key rows included
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [usage, setUsage] = useState<DeviceProfileUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const base = useMemo(() => (profile ? draftOf(profile) : null), [profile]);
  /** A draft read from the host or put back to it: its key rows are the saved rows. */
  const setDraft = useCallback((d: DeviceProfileDraft | null) => {
    setDraftState(d);
    setKeyOrigins(d ? d.telemetrySchema.map((_, i) => i) : []);
    setShowAllIssues(false);
  }, []);
  const dirty = !!(base && draft && JSON.stringify(base) !== JSON.stringify(draft));

  const readUsage = useCallback((signal?: AbortSignal) => {
    if (!api?.usage) return Promise.resolve();
    return api.usage([profileId], signal).then((u) => { if (!signal?.aborted) setUsage(u[profileId] ?? null); }, () => undefined);
  }, [api, profileId]);

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api?.get) return Promise.resolve();
    return api.get(profileId, signal).then(
      (p) => {
        if (signal?.aborted) return;
        setProfile(p);
        setDraft(draftOf(p));
        setLoadError(null);
      },
      (e) => { if (!signal?.aborted) setLoadError(errorMessage(e, m.profile.loadError)); },
    );
  }, [api, profileId, m.profile.loadError, setDraft]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    readUsage(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, readUsage]);

  useLiveOrPoll({ key: profileId, poll: () => { void readUsage(); } });

  const readOnly = !caps.canManageProfiles || !api?.update;
  const issues = draft ? profileDraftIssues(draft) : {};
  const blocking = Object.keys(issues).length > 0;
  // the only thing wrong is a new key row nobody has typed in yet: nothing is marked before Save is pressed, so nothing is said either
  const unmarkedOnly = !showAllIssues && Object.keys(issues).length === 1 && 'telemetrySchema' in issues && !!draft
    && draft.telemetrySchema.some((k) => k.key === '')
    && draft.telemetrySchema.every((k, i, all) => k.key === '' || (isTelemetryKey(k.key) && all.findIndex((x) => x.key === k.key) === i));
  const err = (field: string): string | undefined => {
    const issue = issues[field];
    return issue ? m.issue[issue] : serverErrors[field];
  };
  const set = (patch: Partial<DeviceProfileDraft>) => {
    setDraftState((d) => (d ? { ...d, ...patch } : d));
    setSaveError(null);
  };
  const setKeys = (next: DeviceProfileDraft['telemetrySchema']) => {
    if (draft) setKeyOrigins((o) => nextKeyOrigins(draft.telemetrySchema, next, o));
    set({ telemetrySchema: next });
  };
  function pressSave() {
    if (blocking) { setShowAllIssues(true); return; }
    void save();
  }

  async function save() {
    if (!api?.update || !base || !draft || blocking) return;
    const patch = profilePatch(base, draft);
    if (!Object.keys(patch).length) return;
    const keyChanges = telemetryKeyChanges(base.telemetrySchema, draft.telemetrySchema, keyOrigins);
    setSaving(true);
    setSaveError(null);
    setServerErrors({});
    try {
      // a host with a provisioning API takes the strategy there (it guards it with its own permission), the rest in the profile patch
      const { provisionStrategy, ...rest } = patch;
      const strategyApart = provisionStrategy !== undefined && !!provisioning?.setStrategy;
      const general = strategyApart ? rest : patch;
      let saved = Object.keys(general).length ? await api.update(profileId, general) : profile!;
      if (strategyApart) {
        try {
          saved = { ...saved, provisionStrategy: await provisioning!.setStrategy!(profileId, provisionStrategy!) };
        } catch (e) {
          // the rest is saved: keep it, and keep the strategy change in the draft so Save can try it again
          setProfile(saved);
          setDraft({ ...draftOf(saved), provisionStrategy: provisionStrategy! });
          throw e instanceof IotApiError && !e.fieldErrors ? new IotApiError(e.code, e.message, { fieldErrors: { provisionStrategy: e.message } }) : e;
        }
      }
      setProfile(saved);
      setDraft(draftOf(saved));
      notify({ tone: 'success', message: m.profile.saved });
      if (keyChanges.removed.length) void followKeyChanges(keyChanges);
    } catch (e) {
      if (e instanceof IotApiError && e.fieldErrors) setServerErrors(e.fieldErrors);
      setSaveError(fill(m.profile.saveError, { message: errorMessage(e, m.profile.loadError) }));
    } finally {
      setSaving(false);
    }
  }

  /** After a save that removed keys: what still reads them, and (for keys renamed in place) the offer to rewrite it. */
  async function followKeyChanges({ removed, renames }: { removed: string[]; renames: Record<string, string> }) {
    if (!api?.keyUsage) return;
    const unchecked = () => notify({ tone: 'info', message: fill(m.profile.keyUsageUnchecked, { n: removed.length }) });
    if (removed.length > KEY_USAGE_MAX_KEYS) { unchecked(); return; }
    let usage: ProfileKeyUsage[];
    try { usage = (await api.keyUsage(profileId, removed)).filter((u) => u.count > 0); } catch { unchecked(); return; }
    if (!usage.length) return;
    const used = new Set(usage.flatMap((u) => u.keys));
    const mapped = Object.fromEntries(Object.entries(renames).filter(([from]) => used.has(from)));
    const lines = usage.map((u) => fill(m.profile.keyUsageLine, { count: u.count, label: u.label, keys: u.keys.join(', ') }));
    const rename = api.renameKeys;
    if (rename && Object.keys(mapped).length && usage.some((u) => u.canRename && u.keys.some((k) => k in mapped))) {
      const done = await confirmDialog({
        title: m.profile.keyUsageTitle,
        message: lines.join(' '),
        details: (
          <ul className="list-inside list-disc text-sm">
            {Object.entries(mapped).map(([from, to]) => <li key={from}><code className="font-mono">{from}</code> → <code className="font-mono">{to}</code></li>)}
          </ul>
        ),
        tone: 'warning',
        confirmLabel: m.profile.keyUsageRename,
        cancelLabel: m.profile.keyUsageKeep,
        action: () => rename(profileId, mapped),
        errorMessage: (e) => errorMessage(e, m.profile.loadError),
      });
      if (done) {
        announceProfileKeyRenames({ profileId, renames: mapped });
        notify({ tone: 'success', message: m.profile.keyUsageRenamed });
        return;
      }
    }
    notify({ tone: 'info', message: fill(m.profile.keyUsageOrphaned, { list: lines.join(' ') }) });
  }

  async function makeDefault() {
    if (!api?.setDefault || !profile) return;
    setBusy(true);
    try {
      const p = await api.setDefault(profileId);
      setProfile((cur) => (cur ? { ...cur, isDefault: p.isDefault } : cur));
      notify({ tone: 'success', message: fill(m.profiles.madeDefault, { name: profile.name }) });
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.profile.loadError) });
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    if (!api?.duplicate) return;
    setBusy(true);
    try {
      const copy = await api.duplicate(profileId);
      notify({ tone: 'success', message: fill(m.profiles.duplicated, { name: copy.name }) });
      onDuplicated?.(copy);
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.profile.loadError) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!api?.remove) return;
    setBusy(true);
    try {
      await api.remove(profileId);
      notify({ tone: 'success', message: m.profiles.deleted });
      onDeleted?.();
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.profile.loadError) });
    } finally {
      setBusy(false);
    }
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(profileId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* nothing to copy into */ }
  }

  if (!api?.get) return null;
  if (loadError && !profile) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error">
        {loadError}
        <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
      </div>
    );
  }
  if (!profile || !draft || !base) return <SkeletonText lines={8} label={m.common.loading} className={className} />;

  const issueTabs = new Set([...(unmarkedOnly ? [] : Object.keys(issues)), ...Object.keys(serverErrors)].map(tabOf));
  const badge = (id: string) => (issueTabs.has(id) ? <span className="ml-1 inline-block h-2 w-2 rounded-full bg-error" aria-label={m.profile.invalid} /> : undefined);
  const inUse = usageList(usage ?? undefined);
  const fromTemplate = !!profile.template && draft.onlineRule === base.onlineRule;

  const tabs: Tab[] = [
    {
      id: 'general', label: m.profile.general, order: 0, badge: badge('general'),
      content: (
        <div className="space-y-4">
          <ProfileSection title={m.profile.general}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input id="profile-name" label={m.profile.name} required maxLength={128} disabled={readOnly} value={draft.name} error={err('name')} onChange={(e) => set({ name: e.target.value })} />
              <div className="md:col-span-2">
                <Textarea id="profile-description" label={m.profile.description} rows={3} disabled={readOnly} value={draft.description ?? ''}
                  onChange={(e) => set({ description: e.target.value || null })} />
              </div>
            </div>
          </ProfileSection>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-raised p-4 text-sm sm:grid-cols-2 sm:p-5">
            <div className="min-w-0"><dt className="text-xs text-text-secondary">{m.profile.profileId}</dt><dd className="break-all font-mono text-xs text-text-primary">{profile.profileId}</dd></div>
            <div className="min-w-0">
              <dt className="text-xs text-text-secondary">{m.profile.usage}</dt>
              <dd className="text-text-primary">
                {usage ? (inUse || m.profile.usageNone) : '—'}
                {usage?.unverifiable?.length ? <span className="block text-xs text-warning">{fill(m.profile.usageUnknown, { modules: usage.unverifiable.join(', ') })}</span> : null}
              </dd>
            </div>
            <div className="min-w-0"><dt className="text-xs text-text-secondary">{m.profile.created}</dt><dd className="text-text-primary">{formatDateTime(profile.createdAt, { locale })}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-text-secondary">{m.profile.updatedAt}</dt><dd className="text-text-primary">{formatDateTime(profile.updatedAt, { locale })}</dd></div>
          </dl>
        </div>
      ),
    },
    {
      id: 'transport', label: m.profile.transportTab, order: 10, badge: badge('transport'),
      content: (
        <div className="space-y-4">
          <TransportPolicyCard value={draft} transports={offered} disabled={readOnly} transportLocked={!!profile.builtinKey} onChange={set}
            errors={{ allowedNetworks: err('allowedNetworks'), plaintextRpcMethods: err('plaintextRpcMethods'), transportType: err('transportType') }} />
          {/* a polled profile's devices, or devices that reach the platform another way, never log in or publish: no auth modes, no topics (the card says so) */}
          {transportLogsIn(draft.transportType, offered) && (<>
            <ProfileSection title={m.transport.authModes}>
              <AuthModeSelector value={draft.allowedAuthModes} disabled={readOnly} error={err('allowedAuthModes')} onChange={(v) => set({ allowedAuthModes: v })} />
            </ProfileSection>
            <ProtocolMappingCard value={draft} disabled={readOnly} onChange={set}
              errors={{ topicSchemes: err('topicSchemes'), maxTopicDepth: err('maxTopicDepth'), maxTopicLength: err('maxTopicLength'), maxDistinctTopicsPerDevice: err('maxDistinctTopicsPerDevice'), rawMaxBytes: err('rawMaxBytes') }} />
          </>)}
        </div>
      ),
    },
    {
      id: 'online', label: m.profile.onlineTab, order: 20, badge: badge('online'),
      content: (
        <ProfileSection title={m.profile.onlineTab}>
          <OnlineRuleField
            value={{ onlineRule: draft.onlineRule, expectedIntervalS: draft.expectedIntervalS, onlineWindowFactor: draft.onlineWindowFactor }}
            transport={draft.transportType}
            fromTemplate={fromTemplate}
            disabled={readOnly}
            onChange={set}
            errors={{ onlineRule: err('onlineRule'), expectedIntervalS: err('expectedIntervalS'), onlineWindowFactor: err('onlineWindowFactor') }}
          />
        </ProfileSection>
      ),
    },
    {
      id: 'limits', label: m.profile.limitsTab, order: 30, badge: badge('limits'),
      content: (
        <div className="space-y-4">
          <ProfileSection title={m.limits.rateLimits} hint={m.limits.rateLimitsHint}>
            <RateLimitEditor value={draft.rateLimits} disabled={readOnly} onChange={(v) => set({ rateLimits: v })}
              errors={Object.fromEntries(RATE_LIMIT_FAMILIES.map((f) => [f, err(`rateLimits.${f}`)]).filter(([, v]) => v))} />
          </ProfileSection>
          <ProfileSection title={m.limits.traffic}>
            <div className="grid gap-3 md:grid-cols-2">
              <RangeNumberField id="profile-replay" label={m.limits.replayMsgsPerS} range="replayMsgsPerS" nullable hint={m.limits.replayHint} value={draft.replayMsgsPerS}
                disabled={readOnly} error={err('replayMsgsPerS')} onChange={(v) => set({ replayMsgsPerS: v })} />
              <RangeNumberField id="profile-payload" label={m.limits.payloadMaxBytes} range="payloadMaxBytes" value={draft.payloadMaxBytes}
                disabled={readOnly} error={err('payloadMaxBytes')} onChange={(v) => set({ payloadMaxBytes: v ?? Number.NaN })} />
              <RangeNumberField id="profile-downlink" label={m.limits.downlinkMaxBytes} range="downlinkMaxBytes" value={draft.downlinkMaxBytes}
                disabled={readOnly} error={err('downlinkMaxBytes')} onChange={(v) => set({ downlinkMaxBytes: v ?? Number.NaN })} />
              <RangeNumberField id="profile-inflight" label={m.limits.maxInflightMessages} range="maxInflightMessages" value={draft.maxInflightMessages}
                disabled={readOnly} error={err('maxInflightMessages')} onChange={(v) => set({ maxInflightMessages: v ?? Number.NaN })} />
            </div>
          </ProfileSection>
          <ProfileSection title={m.limits.session}>
            <div className="grid gap-3 md:grid-cols-2">
              <RangeNumberField id="profile-inactivity" label={m.limits.inactivityTimeoutSec} range="inactivityTimeoutSec" hint={m.limits.inactivityHint} value={draft.inactivityTimeoutSec}
                disabled={readOnly} error={err('inactivityTimeoutSec')} onChange={(v) => set({ inactivityTimeoutSec: v ?? Number.NaN })} />
              <RangeNumberField id="profile-children" label={m.limits.maxGatewayChildren} range="maxGatewayChildren" value={draft.maxGatewayChildren}
                disabled={readOnly} error={err('maxGatewayChildren')} onChange={(v) => set({ maxGatewayChildren: v ?? Number.NaN })} />
              <RangeNumberField id="profile-rpc-timeout" label={m.limits.rpcTimeoutDefaultSec} range="rpcTimeoutDefaultSec" value={draft.rpcTimeoutDefaultSec}
                disabled={readOnly} error={err('rpcTimeoutDefaultSec')} onChange={(v) => set({ rpcTimeoutDefaultSec: v ?? Number.NaN })} />
            </div>
          </ProfileSection>
        </div>
      ),
    },
    {
      id: 'telemetry', label: m.profile.telemetryTab, order: 40, badge: badge('telemetry'),
      content: (
        <ProfileSection title={m.schema.telemetryTitle} hint={m.schema.telemetryHint}>
          <TelemetryKeySchemaTable value={draft.telemetrySchema} readOnly={readOnly} fromFirmware={profile.schemaSource?.label ?? null}
            error={err('telemetrySchema')} showAll={showAllIssues} onChange={setKeys} />
          <Toggle id="profile-strict-keys" label={m.schema.strictKeys} description={m.schema.strictKeysHint} checked={draft.strictKeys} disabled={readOnly}
            onChange={(v) => set({ strictKeys: v })} />
        </ProfileSection>
      ),
    },
    {
      id: 'config', label: m.profile.configTab, order: 50, badge: badge('config'),
      content: (
        <ProfileSection title={m.schema.cfgTitle} hint={m.schema.cfgHint}>
          <CfgSchemaTable value={draft.cfgSchema} readOnly={readOnly} fromFirmware={profile.schemaSource?.label ?? null}
            error={err('cfgSchema')} onChange={(v) => set({ cfgSchema: v })} />
          <Select id="profile-drift" label={m.schema.drift} value={draft.cfgDriftPolicy} disabled={readOnly}
            onChange={(e) => set({ cfgDriftPolicy: e.target.value as CfgDriftPolicy })}
            options={CFG_DRIFT_POLICIES.map((p) => ({ value: p, label: m.schema[p] }))} />
        </ProfileSection>
      ),
    },
    {
      id: 'provisioning', label: m.profile.provisioningTab, order: 60, badge: badge('provisioning'),
      content: (
        <ProvisioningSettingsCard strategy={draft.provisionStrategy} availableStrategies={availableStrategies} keys={provisioningKeys} disabled={readOnly}
          onChange={(s) => set({ provisionStrategy: s })} />
      ),
    },
    ...extraTabs.map((t, i) => ({ ...t, order: t.order ?? 100 + i })),
  ];

  return (
    <div className={cn('space-y-4', dirty && 'pb-20', className)}>
      <header className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-text-primary">
            {profile.isDefault && <FontAwesomeIcon icon={faStar} className="h-4 w-4 text-warning" aria-hidden="true" />}
            <span className="truncate">{profile.name}</span>
            {profile.isDefault && <Badge variant="primary" size="sm">{m.profile.defaultBadge}</Badge>}
            {profile.builtinKey && <Badge variant="neutral" size="sm">{m.profile.builtinBadge}</Badge>}
            {profile.template && <Badge variant="info" size="sm">{fill(m.profile.template, { key: profile.template.key, version: profile.template.version })}</Badge>}
          </h1>
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-text-secondary">
            <Badge variant="neutral" size="sm">{transportLabel(profile.transportType, (t) => m.transport[t], offered)}</Badge>
            <Badge variant="neutral" size="sm">{m.online[profile.onlineRule]}</Badge>
            {usage && usage.devices !== null && <Badge variant="neutral" size="sm">{`${usage.devices} ${m.profiles.devices.toLowerCase()}`}</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void copyId()} iconLeft={<FontAwesomeIcon icon={copied ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />}>
            {copied ? m.common.copied : m.profile.copyId}
          </Button>
          {caps.canManageProfiles && !profile.isDefault && api.setDefault && (
            <Button variant="outline" size="sm" loading={busy} onClick={() => void makeDefault()}
              iconLeft={<FontAwesomeIcon icon={faStar} className="h-3 w-3" aria-hidden="true" />}>{m.profile.setDefault}</Button>
          )}
          {caps.canManageProfiles && api.duplicate && (
            <Button variant="outline" size="sm" loading={busy} onClick={() => void duplicate()} title={m.profile.duplicateHint}
              iconLeft={<FontAwesomeIcon icon={faClone} className="h-3 w-3" aria-hidden="true" />}>{m.profile.duplicate}</Button>
          )}
          {caps.canManageProfiles && api.remove && (profile.isDefault || profile.builtinKey ? (
            <span title={profile.isDefault ? m.profiles.deleteDefault : m.profiles.deleteBuiltin}>
              <Button variant="ghost" size="sm" disabled iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>{m.profile.delete}</Button>
            </span>
          ) : (
            <Button onClick={() => { void confirmDialog({ title: fill(m.profiles.deleteConfirm, { name: profile.name }), message: inUse ? fill(m.profiles.deleteInUse, { list: inUse }) : m.profiles.deleteHint, tone: 'danger', confirmLabel: m.profiles.delete, cancelLabel: m.common.cancel }).then((ok) => { if (ok) void remove(); }); }} variant="ghost" size="sm" iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}>{m.profile.delete}</Button>
          ))}
        </div>
      </header>

      {readOnly && <Callout variant="info" title={null}>{m.profile.readOnly}</Callout>}

      <TabGroup tabs={tabs} defaultTab={tab} onTabChange={onTabChange} label={m.profile.tabs} isolate retryLabel={m.common.retry} errorLabel={m.common.loadFailed} errorDetail={m.common.loadFailedDetail} />

      {dirty && !readOnly && (
        <div role="region" aria-label={m.profile.unsaved}
          className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-surface-base p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-text-primary">{m.profile.unsaved}</p>
            {saveError ? <p role="alert" className="text-xs text-error">{saveError}</p>
              : blocking && !unmarkedOnly ? <p className="text-xs text-error">{m.profile.invalid}</p>
                : <p className="text-xs text-text-secondary">{m.profile.leaveTab}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setDraft(base); setSaveError(null); setServerErrors({}); }}>{m.profile.discard}</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={pressSave}>{m.profile.save}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
