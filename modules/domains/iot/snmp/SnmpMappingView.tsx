'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { fillSnmp, mergeSnmpMessages, type SnmpMessagesInput } from './messages';
import { SnmpMappingEditor, addScalar } from './SnmpMappingEditor';
import { SnmpTestPollPanel } from './SnmpTestPollPanel';
import {
  SNMP_DEFAULT_LIMITS, normaliseOid, snmpMappingIssues,
  type SnmpLimits, type SnmpMapping, type SnmpMappingIssue, type SnmpTestPollDevice, type SnmpTestPollResult, type SnmpTestPollVarbind,
} from './types';

/**
 * SnmpMappingView — the SNMP tab of a device profile (kui-react iot 11.3 + 11.4; NB iot_gateway 11): `SnmpMappingEditor` on a draft of the
 * saved block with one Save (only when something changed and nothing is wrong), and the test poll in a drawer opened from the header
 * ("Test poll"), whose "Add to mapping" puts rows in the draft. A refused save (`SnmpMappingRefused`) marks the rows the host named;
 * any other failure is said in the save bar. Without `onSave` the mapping is read-only; without `onPoll` the test poll cannot run.
 * Unsaved changes are guarded when the page is closed or reloaded (`beforeunload`), and `onDirtyChange` tells the host, which guards its
 * own navigation with it (NB 41-ui-fixes/28 G1.8).
 */
export type SnmpMappingViewProps = {
  /** The saved block (null while it loads). */
  value: SnmpMapping | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSave?: (next: SnmpMapping) => Promise<void>;
  devices?: readonly SnmpTestPollDevice[];
  devicesLoading?: boolean;
  onPoll?: (deviceId: string, oids: string[]) => Promise<SnmpTestPollResult>;
  template?: string | null;
  limits?: SnmpLimits;
  messages?: SnmpMessagesInput;
  /** Called whenever the mapping gains or loses unsaved changes (only while it can be saved). */
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
};

/** Thrown by `onSave` when the host refused the block: its issues (paths inside the block) and its message. */
export class SnmpMappingRefused extends Error {
  constructor(readonly issues: SnmpMappingIssue[], message = 'protocol_settings_invalid') {
    super(message);
    this.name = 'SnmpMappingRefused';
  }
}

export function SnmpMappingView({
  value, loading, error, onRetry, onSave, devices = [], devicesLoading, onPoll, template, limits = SNMP_DEFAULT_LIMITS, messages, onDirtyChange, className,
}: SnmpMappingViewProps) {
  const m = useMemo(() => mergeSnmpMessages(messages), [messages]);
  const [seen, setSeen] = useState<SnmpMapping | null>(value);
  const [draft, setDraft] = useState<SnmpMapping | null>(value);
  const [serverIssues, setServerIssues] = useState<SnmpMappingIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [samples, setSamples] = useState<Map<string, SnmpTestPollVarbind>>(new Map());
  // a new saved block from the host (first read, or after a save) replaces the draft
  if (value !== seen) { setSeen(value); setDraft(value); setServerIssues([]); }
  // unsaved edits are never dropped silently: the host hears of them, and closing or reloading the page asks first
  const guarded = !!onSave && !!draft && !!value && JSON.stringify(draft) !== JSON.stringify(value);
  const onDirtyRef = useRef(onDirtyChange);
  useEffect(() => { onDirtyRef.current = onDirtyChange; });
  useEffect(() => { onDirtyRef.current?.(guarded); }, [guarded]);
  useEffect(() => () => onDirtyRef.current?.(false), []);
  useEffect(() => {
    if (!guarded) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [guarded]);

  if (error && !value) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error">
        {error}
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{m.common.retry}</Button>}
      </div>
    );
  }
  if (loading || !draft || !value) return <SkeletonText lines={6} label={m.common.loading} className={className} />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const blocking = snmpMappingIssues(draft, limits).length > 0;
  const change = (next: SnmpMapping) => { setDraft(next); setSaveError(null); setSaved(false); };

  async function save() {
    if (!onSave || !draft || blocking) return;
    setSaving(true); setSaveError(null); setServerIssues([]);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (e) {
      if (e instanceof SnmpMappingRefused) { setServerIssues(e.issues); setSaveError(m.editor.refused); }
      else setSaveError(fillSnmp(m.editor.saveFailed, { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSaving(false);
    }
  }

  const keep = (r: SnmpTestPollResult) => setSamples(new Map(r.varbinds.map((vb) => [normaliseOid(vb.oid), vb])));

  return (
    <div className={cn('space-y-4', dirty && 'pb-20', className)}>
      <SnmpMappingEditor
        value={draft}
        onChange={onSave ? change : undefined}
        readOnly={!onSave}
        serverIssues={serverIssues}
        limits={limits}
        template={template}
        samples={samples}
        messages={messages}
        actions={<Button variant="outline" size="sm" onClick={() => setTesting(true)}>{m.editor.testPoll}</Button>}
      />
      {saved && !dirty && <p role="status" className="text-xs text-success">{m.editor.saved}</p>}
      {dirty && onSave && (
        <div role="region" aria-label={m.editor.unsaved}
          className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-surface-base p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-text-primary">{m.editor.unsaved}</p>
            {saveError ? <p role="alert" className="text-xs text-error">{saveError}</p> : blocking ? <p className="text-xs text-error">{m.editor.invalid}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setDraft(value); setServerIssues([]); setSaveError(null); }}>{m.common.discard}</Button>
            <Button variant="primary" size="sm" loading={saving} disabled={blocking} onClick={() => void save()}>{m.common.save}</Button>
          </div>
        </div>
      )}
      {saveError && !dirty && <Callout variant="danger" title={null}>{saveError}</Callout>}
      <Drawer open={testing} onClose={() => setTesting(false)} title={m.test.title} closeLabel={m.common.close} className="w-[48rem]">
        <SnmpTestPollPanel
          devices={devices}
          loading={devicesLoading}
          onPoll={onPoll}
          mapping={draft}
          onAdd={onSave ? (row) => change(addScalar(draft, row)) : undefined}
          onResult={keep}
          messages={messages}
        />
      </Drawer>
    </div>
  );
}
