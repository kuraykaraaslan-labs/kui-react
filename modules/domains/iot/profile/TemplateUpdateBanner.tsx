'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import type { IotMessages } from '../messages';
import { fill, plural } from '../format';
import type { DeviceProfile, TemplateUpdate, TemplateUpdateField } from '../types/profile';

/**
 * TemplateUpdateBanner — a copy of a platform template learns that the template changed (NB iot_device_profile 00 §0.3, P0-E25: a newer
 * template version is never applied by itself). The banner names the versions; "Review changes" opens a drawer with one row per setting
 * the template now holds differently: this profile's value, the template's, and whether this profile's value was changed here since it
 * was copied ("Changed here", or "May be changed here" when the host cannot tell). The viewer picks what to take; a setting changed here
 * starts unpicked, so a change of the workspace is replaced only when someone picks it. Apply writes the picked settings and records the
 * version as seen (nothing picked: every value stays and the banner goes). A setting the viewer may not change (`locked`) cannot be
 * picked. Apply is offered only to a viewer who may edit the profile and while the form holds no unsaved change (its draft would be
 * dropped by the reload); `confirmApply` asks first when the picked settings change how devices connect.
 */
export type TemplateUpdateBannerProps = {
  profile: DeviceProfile;
  /** The viewer may edit the profile (else the drawer only shows the differences). */
  canApply: boolean;
  /** The form holds unsaved changes: Apply waits until they are saved or discarded. */
  dirty?: boolean;
  /** Asked before an apply that changes how devices connect (the editor's admission question); resolve false to stop. */
  confirmApply?: (fields: string[]) => Promise<boolean>;
  /** The profile as the apply saved it. */
  onApplied: (profile: DeviceProfile) => void;
  className?: string;
};

type Row = TemplateUpdateField & Record<string, unknown>;

const MAX_TEXT = 160;

/** A setting's name in the viewer's language (the editor's own label), else the field name a host added. */
export function templateFieldLabel(field: string, m: IotMessages): string {
  const t = m.templateUpdate as Record<string, string>;
  const labels: Record<string, string | undefined> = {
    description: m.profile.description,
    transportType: m.transport.type,
    allowedAuthModes: m.transport.authModes,
    mqttTransport: m.transport.mqttTransport,
    allowTokenInUrl: m.transport.tokenInUrl,
    allowedNetworks: m.transport.networks,
    plaintextRpcMethods: m.transport.plainCommands,
    plaintextAllCommands: m.transport.plainAll,
    topicSchemes: m.transport.schemes,
    anyTopicEnabled: m.transport.anyTopicEnabled,
    prefixKeysWithTopic: m.transport.prefixKeys,
    maxTopicDepth: m.transport.maxTopicDepth,
    maxTopicLength: m.transport.maxTopicLength,
    maxDistinctTopicsPerDevice: m.transport.maxDistinctTopicsPerDevice,
    rawMaxBytes: m.transport.rawMaxBytes,
    rateLimits: m.limits.rateLimits,
    replayMsgsPerS: m.limits.replayMsgsPerS,
    payloadMaxBytes: m.limits.payloadMaxBytes,
    downlinkMaxBytes: m.limits.downlinkMaxBytes,
    inactivityTimeoutSec: m.limits.inactivityTimeoutSec,
    maxGatewayChildren: m.limits.maxGatewayChildren,
    rpcTimeoutDefaultSec: m.limits.rpcTimeoutDefaultSec,
    maxInflightMessages: m.limits.maxInflightMessages,
    strictKeys: m.schema.strictKeys,
    telemetrySchema: m.schema.telemetryTitle,
    cfgSchema: m.schema.cfgTitle,
    cfgDriftPolicy: m.schema.drift,
    onlineRule: m.profile.onlineTab,
    expectedIntervalS: m.online.interval,
    onlineWindowFactor: m.online.factor,
    certLifetimeDays: m.provisioning.certLifetime,
    protocolSettings: t.f_protocolSettings,
    csrKeyPolicy: t.f_csrKeyPolicy,
    requirePresenceForClaim: t.f_requirePresenceForClaim,
    allowBasicClientIdOnly: t.f_allowBasicClientIdOnly,
  };
  return labels[field] ?? field;
}

const cut = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

/** A value as a short line: yes / no, a known choice by its label, a list joined, key tables by their keys, anything else as JSON. */
export function describeTemplateValue(field: string, v: unknown, m: IotMessages, locale?: string): string {
  if (v === null || v === undefined || v === '') return m.templateUpdate.empty;
  if (typeof v === 'boolean') return v ? m.common.yes : m.common.no;
  if (typeof v === 'string') {
    const named = field === 'onlineRule' ? (m.online as Record<string, string>)[v]
      : field === 'transportType' ? (m.transport as Record<string, string>)[v]
        : field === 'cfgDriftPolicy' ? (m.schema as Record<string, string>)[v] : undefined;
    return cut(named ?? v);
  }
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (!v.length) return m.templateUpdate.empty;
    if (v.every((x) => typeof x === 'object' && x !== null && typeof (x as { key?: unknown }).key === 'string')) {
      const keys = v.map((x) => (x as { key: string }).key);
      return cut(`${plural(keys.length, { one: m.templateUpdate.keys_one, other: m.templateUpdate.keys_other }, locale)}: ${keys.join(', ')}`);
    }
    return cut(v.map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : JSON.stringify(x))).join(', '));
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (!entries.length) return m.templateUpdate.empty;
    return cut(entries.map(([k, x]) => `${k}: ${typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean' ? String(x) : JSON.stringify(x)}`).join('; '));
  }
  return cut(String(v));
}

/** The settings picked when the drawer opens: those not changed here (a change of the workspace is never picked for it). */
export function defaultPicks(fields: readonly TemplateUpdateField[]): string[] {
  return fields.filter((f) => f.edited === false && !f.locked).map((f) => f.field);
}

export function TemplateUpdateBanner({ profile, canApply, dirty, confirmApply, onApplied, className }: TemplateUpdateBannerProps) {
  const api = useIotAdapter().profiles?.templateUpdate;
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const [update, setUpdate] = useState<TemplateUpdate | null>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileId = profile.profileId;
  const copyOf = profile.template ? `${profile.template.key}@${profile.template.version}` : null;

  const read = useCallback((signal?: AbortSignal): Promise<void> => {
    // not a copy (or no API): nothing is read, and the banner draws nothing for a profile without `template`
    if (!api || !copyOf) return Promise.resolve();
    // a read that fails shows nothing: the banner only ever offers, it never blocks the page
    return api.get(profileId, signal).then((u) => { if (!signal?.aborted) setUpdate(u); }, () => { if (!signal?.aborted) setUpdate(null); });
  }, [api, profileId, copyOf]);

  useEffect(() => {
    const ctl = new AbortController();
    void read(ctl.signal);
    return () => ctl.abort();
  }, [read]);

  const columns = useMemo((): Column<Row>[] => [
    {
      key: 'field', header: m.templateUpdate.setting,
      render: (r) => (
        <span className="flex flex-col gap-1">
          <span className="font-medium text-text-primary">{templateFieldLabel(r.field, m)}</span>
          {r.edited === true && <span title={m.templateUpdate.editedHint}><Badge variant="warning" size="sm">{m.templateUpdate.edited}</Badge></span>}
          {r.edited === null && <span title={m.templateUpdate.editedUnknownHint}><Badge variant="neutral" size="sm">{m.templateUpdate.editedUnknown}</Badge></span>}
          {r.locked && <span className="text-xs text-text-secondary">{m.templateUpdate.locked}</span>}
        </span>
      ),
    },
    { key: 'mine', header: m.templateUpdate.mine, render: (r) => <span className="break-words text-sm">{describeTemplateValue(r.field, r.mine, m, locale)}</span> },
    {
      key: 'theirs', header: fill(m.templateUpdate.theirs, { version: update?.toVersion ?? '' }),
      render: (r) => <span className="break-words text-sm">{describeTemplateValue(r.field, r.theirs, m, locale)}</span>,
    },
  ], [m, locale, update?.toVersion]);

  if (!update || !profile.template) return null;

  function review() {
    setPicked(defaultPicks(update!.fields));
    setError(null);
    setOpen(true);
  }

  async function apply() {
    if (!api || !update) return;
    const fields = update.fields.filter((f) => picked.includes(f.field) && !f.locked).map((f) => f.field);
    if (fields.length && confirmApply && !(await confirmApply(fields))) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.apply(profileId, {
        toVersion: update.toVersion, fields, ...(typeof profile.version === 'number' ? { expectedVersion: profile.version } : {}),
      });
      notify({ tone: 'success', message: fill(fields.length ? m.templateUpdate.applied : m.templateUpdate.kept, { version: update.toVersion }) });
      setOpen(false);
      setUpdate(null);
      onApplied(saved);
      void read();
    } catch (e) {
      const moved = e instanceof IotApiError && e.details?.reason === 'template_moved';
      setError(moved ? m.templateUpdate.moved : e instanceof IotApiError && e.code === 'stale' ? m.profile.stale
        : fill(m.templateUpdate.failed, { message: errorMessage(e, m.common.loadFailed) }));
      if (moved) void read();
    } finally {
      setBusy(false);
    }
  }

  const count = update.fields.filter((f) => picked.includes(f.field) && !f.locked).length;
  const applyLabel = count ? plural(count, { one: m.templateUpdate.applyCount_one, other: m.templateUpdate.applyCount_other }, locale) : m.templateUpdate.keepAll;
  return (
    <>
      <Callout variant="info" title={null} className={className}>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="font-medium">{fill(m.templateUpdate.available, { key: update.templateKey, version: update.toVersion, current: update.fromVersion })}</span>
            {' '}<span className="text-text-secondary">{m.templateUpdate.availableHint}</span>
          </span>
          <Button variant="outline" size="xs" onClick={review}>{m.templateUpdate.review}</Button>
        </span>
      </Callout>
      <Drawer
        open={open}
        onClose={() => { if (!busy) setOpen(false); }}
        title={fill(m.templateUpdate.title, { key: update.templateKey, version: update.toVersion })}
        closeLabel={m.common.close}
        className="w-[44rem]"
        footer={canApply ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {dirty && <p className="text-xs text-text-secondary sm:mr-auto">{m.templateUpdate.unsaved}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>{m.common.cancel}</Button>
              <Button variant="primary" size="sm" loading={busy} disabled={dirty} onClick={() => void apply()}>{applyLabel}</Button>
            </div>
          </div>
        ) : undefined}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">{fill(m.templateUpdate.intro, { version: update.toVersion })}</p>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          {update.fields.length ? (
            <DataTable<Row>
              variant="plain"
              caption={fill(m.templateUpdate.title, { key: update.templateKey, version: update.toVersion })}
              columns={columns}
              rows={update.fields as Row[]}
              searchable={false}
              pageSize={50}
              rowId={(r) => r.field}
              selectable={canApply}
              selectedRowIds={picked}
              onSelectionChange={(ids) => setPicked(ids.map(String))}
              isRowSelectable={(r) => (r.locked ? m.templateUpdate.locked : true)}
              rowSelectLabel={(r) => fill(m.templateUpdate.take, { setting: templateFieldLabel(r.field, m) })}
              messages={{ loading: m.common.loading, retry: m.common.retry }}
            />
          ) : <p className="text-sm text-text-secondary">{m.templateUpdate.none}</p>}
        </div>
      </Drawer>
    </>
  );
}
