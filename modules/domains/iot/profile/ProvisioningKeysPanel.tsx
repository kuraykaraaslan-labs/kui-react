'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCheck, faCopy, faEye, faEyeSlash, faPlus, faRotate, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { errorMessage } from '../api/adapter';
import { fill, formatDateTime } from '../format';
import type { IotMessagesInput } from '../messages';
import type { IssuedProvisionKey, ProvisionKey, ProvisioningInfo } from '../types/profile';

/**
 * ProvisioningKeysPanel — the provisioning keys of a profile (02 §2.2, OD-1), for `ProvisioningSettingsCard`'s `keys` slot. The keys
 * in one DataTable (key id and key, state, created, until when an old key is accepted, last used when the host records it); "Create
 * key" / "Replace key" (a rotation: the old key keeps working for the grace the viewer picks, or for its own units on a factory
 * profile); "Revoke" on a row through the ConfirmDialog, with a reason and the key id typed again. A rotation's secret is shown once
 * in a notice (masked until "Show", copyable, "You will not see it again") and lives only in this component's state until "I have
 * copied it" or until the panel goes away: never in storage, a URL or a log. The actions act at once; they are not part of the
 * editor's Save. Reads `adapter.provisioning`; the host mounts it only for a viewer who may manage provisioning (`onInfo` hands the
 * host what it serves, e.g. for `availableStrategies`).
 */
export type ProvisioningKeysPanelProps = {
  profileId: string;
  /** Each read's answer (the keys, the strategies the host serves, the rotation grace). */
  onInfo?: (info: ProvisioningInfo) => void;
  messages?: IotMessagesInput;
  className?: string;
};

type Row = ProvisionKey & Record<string, unknown>;

const STATE_BADGE = { active: 'success', retired: 'warning', revoked: 'neutral' } as const;

export function ProvisioningKeysPanel({ profileId, onInfo, messages, className }: ProvisioningKeysPanelProps) {
  const api = useIotAdapter().provisioning;
  const notify = useIotNotify();
  const { m, locale } = useIotText(messages);
  const p = m.provisioning;
  const [info, setInfo] = useState<ProvisioningInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedProvisionKey | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [revoking, setRevoking] = useState<ProvisionKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const onInfoRef = useRef(onInfo);
  useEffect(() => { onInfoRef.current = onInfo; }, [onInfo]);

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    return api.get(profileId, signal).then(
      (i) => { if (signal?.aborted) return; setInfo(i); setLoadError(null); onInfoRef.current?.(i); },
      (e) => { if (!signal?.aborted) setLoadError(errorMessage(e, m.common.loadFailedDetail)); },
    );
  }, [api, profileId, m.common.loadFailedDetail]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  if (!api) return null;

  const keys = info?.keys ?? [];
  const active = keys.find((k) => k.state === 'active') ?? null;
  const grace = info?.rotationGrace ?? null;
  const date = (v: Date | string | null | undefined) => (v ? formatDateTime(v, { locale }) : '');

  async function rotate(graceDays?: number) {
    if (!api) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const out = await api.rotate(profileId, graceDays === undefined ? {} : { graceDays });
      setIssued(out);
      setRotateOpen(false);
      notify({ tone: 'success', message: fill(p.rotated, { id: out.key.provisionKeyId }) });
      await load();
    } catch (e) {
      const msg = fill(p.actionError, { message: errorMessage(e, m.common.loadFailedDetail) });
      if (rotateOpen) setActionError(msg); else notify({ tone: 'error', message: msg });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: ProvisionKey, reason: string) {
    if (!api) return;
    setBusy(true);
    setActionError(undefined);
    try {
      // the dialog confirms only once the typed key id matches, so the typed value is the key id
      await api.revoke(profileId, { provisionKeyId: key.provisionKeyId, confirmKeyId: key.provisionKeyId, reason });
      setRevoking(null);
      notify({ tone: 'success', message: fill(p.revoked, { id: key.provisionKeyId }) });
      await load();
    } catch (e) {
      setActionError(fill(p.actionError, { message: errorMessage(e, m.common.loadFailedDetail) }));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'provisionKeyId',
      header: p.keyId,
      render: (k) => (
        <div className="min-w-0">
          <code className="font-mono text-sm text-text-primary">{k.provisionKeyId}</code>
          <div className="flex items-center gap-1">
            <code className="truncate font-mono text-xs text-text-secondary" title={p.key}>{k.provisionKey}</code>
            <CopyButton value={k.provisionKey} label={fill(p.copyLabel, { what: k.provisionKeyId })} copiedLabel={m.common.copied} />
          </div>
        </div>
      ),
    },
    {
      key: 'state',
      header: p.state,
      render: (k) => (
        <div className="min-w-0">
          <Badge variant={STATE_BADGE[k.state]} size="sm">{p[`state_${k.state}`]}</Badge>
          {k.state === 'revoked' && k.revocationReason ? <p className="mt-1 text-xs text-text-secondary">{k.revocationReason}</p> : null}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: p.created,
      sortable: true,
      render: (k) => <span className="whitespace-nowrap text-sm">{date(k.createdAt)}</span>,
    },
    {
      key: 'graceUntil',
      header: p.acceptedUntil,
      render: (k) => (
        <span className="whitespace-nowrap text-sm">
          {k.state === 'active' ? p.untilRevoked
            : k.state === 'retired' ? (k.graceUntil ? date(k.graceUntil) : p.factoryOld)
              : fill(p.revokedOn, { when: date(k.revokedAt) })}
        </span>
      ),
    },
    ...(keys.some((k) => k.lastUsedAt !== undefined) ? [{
      key: 'lastUsedAt',
      header: p.lastUsed,
      render: (k: Row) => <span className="whitespace-nowrap text-sm">{k.lastUsedAt ? date(k.lastUsedAt) : p.neverUsed}</span>,
    }] : []),
    {
      key: 'actions',
      header: <span className="sr-only">{p.revoke}</span>,
      align: 'right',
      render: (k) => (k.state === 'revoked' ? null : (
        <Button variant="ghost" size="sm" aria-label={fill(p.revokeLabel, { id: k.provisionKeyId })} disabled={busy}
          onClick={() => { setActionError(undefined); setRevoking(k); }}
          iconLeft={<FontAwesomeIcon icon={faBan} className="h-3 w-3" aria-hidden="true" />}>
          {p.revoke}
        </Button>
      )),
    },
  ];

  return (
    <div className={cn('space-y-3', className)} data-testid="provisioning-keys">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-prose text-xs text-text-secondary">{p.keysHint}</p>
        {info && (active ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { setActionError(undefined); setRotateOpen(true); }}
            iconLeft={<FontAwesomeIcon icon={faRotate} className="h-3 w-3" aria-hidden="true" />}>
            {p.rotate}
          </Button>
        ) : (
          <Button variant="primary" size="sm" loading={busy} onClick={() => void rotate()}
            iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
            {p.create}
          </Button>
        ))}
      </div>

      {issued && <IssuedProvisionKeyNotice issued={issued} onDismiss={() => setIssued(null)} messages={messages} />}

      {loadError ? (
        <Callout variant="danger" title={m.common.loadFailed}>
          <p>{loadError}</p>
          <Button variant="outline" size="xs" className="mt-2" onClick={() => void load()}>{m.common.retry}</Button>
        </Callout>
      ) : info && !active ? (
        <Callout variant="warning" title={null}>{keys.length ? p.noActiveKey : p.noKeys}</Callout>
      ) : null}

      {!loadError && (info === null || keys.length > 0) && (
        <DataTable<Row>
          mode="paginated"
          variant="plain"
          caption={p.keysTitle}
          columns={columns}
          rows={keys as Row[]}
          rowId={(k) => k.provisionKeyId}
          rowClassName={(k) => (k.state === 'revoked' ? 'opacity-60' : undefined)}
          loading={info === null}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
          pageSizeOptions={[]}
          density="compact"
        />
      )}

      <ConfirmDialog
        open={rotateOpen}
        title={p.rotateTitle}
        message={grace ? p.rotateBody : p.rotateFactoryBody}
        tone="warning"
        confirmLabel={p.rotate}
        cancelLabel={m.common.cancel}
        input={grace ? {
          kind: 'number', label: p.graceDays, defaultValue: String(grace.default), min: String(grace.min), max: String(grace.max), required: true,
          hint: fill(p.graceHint, { min: grace.min, max: grace.max }),
        } : undefined}
        busy={busy}
        error={actionError}
        onConfirm={({ value }) => void rotate(grace ? Number(value) : undefined)}
        onCancel={() => setRotateOpen(false)}
      />

      <ConfirmDialog
        open={revoking !== null}
        title={fill(p.revokeTitle, { id: revoking?.provisionKeyId ?? '' })}
        message={grace ? p.revokeBody : p.revokeFactoryBody}
        tone="danger"
        confirmLabel={p.revoke}
        cancelLabel={m.common.cancel}
        input={{ kind: 'textarea', label: p.revokeReason, hint: p.revokeReasonHint, required: true, minLength: 3, maxLength: 255 }}
        phrase={revoking?.provisionKeyId ?? ''}
        phraseLabel={fill(p.revokePhrase, { id: revoking?.provisionKeyId ?? '' })}
        busy={busy}
        error={actionError}
        onConfirm={({ value }) => { if (revoking) void revoke(revoking, value); }}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}

/**
 * IssuedProvisionKeyNotice — a rotation's answer, shown once: the key id and key (not secret) and the secret, masked until "Show",
 * each copyable, with "You will not see it again". "I have copied it" drops it for good (the host clears its state).
 */
export function IssuedProvisionKeyNotice({ issued, onDismiss, messages, className }: {
  issued: IssuedProvisionKey;
  onDismiss: () => void;
  messages?: IotMessagesInput;
  className?: string;
}) {
  const { m } = useIotText(messages);
  const p = m.provisioning;
  const [shown, setShown] = useState(false);
  const secret = issued.provisionSecret;
  return (
    <div role="status" className={cn('space-y-2 rounded-lg border border-warning bg-warning-subtle p-3', className)} data-testid="issued-provision-key">
      <p className="flex items-center gap-2 text-sm font-semibold text-warning-fg">
        <FontAwesomeIcon icon={faTriangleExclamation} className="h-3.5 w-3.5" aria-hidden="true" />
        {p.secretTitle}
      </p>
      <p className="text-sm text-warning-fg">{p.secretOnce}</p>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-xs text-warning-fg sm:self-center">{p.keyId}</dt>
        <dd className="min-w-0"><code className="font-mono text-xs text-text-primary">{issued.key.provisionKeyId}</code></dd>
        <dt className="text-xs text-warning-fg sm:self-center">{p.key}</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded border border-border bg-surface-base px-2 py-1 font-mono text-xs text-text-primary">{issued.key.provisionKey}</code>
          <CopyButton value={issued.key.provisionKey} label={fill(p.copyLabel, { what: p.key })} copiedLabel={m.common.copied} text={m.common.copy} />
        </dd>
        <dt className="text-xs text-warning-fg sm:self-center">{p.secret}</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-2">
          <code data-testid="issued-provision-secret" className="min-w-0 flex-1 break-all rounded border border-border bg-surface-base px-2 py-1 font-mono text-xs text-text-primary">
            {shown ? secret : '•'.repeat(Math.min(32, secret.length))}
          </code>
          <Button variant="ghost" size="xs" onClick={() => setShown((s) => !s)}
            iconLeft={<FontAwesomeIcon icon={shown ? faEyeSlash : faEye} className="h-3 w-3" aria-hidden="true" />}>
            {shown ? m.credential.hide : m.credential.show}
          </Button>
          <CopyButton value={secret} label={fill(p.copyLabel, { what: p.secret })} copiedLabel={m.common.copied} text={m.common.copy} onFail={() => setShown(true)} />
        </dd>
      </dl>
      <div className="flex justify-end">
        <Button variant="primary" size="xs" onClick={onDismiss}>{p.secretStored}</Button>
      </div>
    </div>
  );
}

function CopyButton({ value, label, copiedLabel, text, onFail }: { value: string; label: string; copiedLabel: string; text?: string; onFail?: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onFail?.(); // no clipboard: the value is shown so it can be copied by hand
    }
  }
  return (
    <Button variant={text ? 'outline' : 'ghost'} size="xs" aria-label={copied ? copiedLabel : label} onClick={() => void copy()}
      iconLeft={<FontAwesomeIcon icon={copied ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />}>
      {text ? (copied ? copiedLabel : text) : null}
    </Button>
  );
}
