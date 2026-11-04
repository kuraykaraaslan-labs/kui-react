'use client';
import { useMemo, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Input } from '@/modules/ui/Input';
import { Textarea } from '@/modules/ui/Textarea';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { fillText, mergeLoraMessages, type LoraMessages, type LoraMessagesInput } from './messages';
import { LoraCodecBench } from './LoraCodecBench';
import type { LoraBenchFrame, LoraCodecCheck, LoraCodecRefusal } from './types';

/**
 * LoraCodecEditor — a tenant's own codec, new or changed (NB iot_lorawan_codecs 05; kui-react iot 10.7): the id (`t.<slug>`, only for a new
 * one: it never changes, D33), the table as JSON in the roltek-lns format (no JavaScript decoder, OD-83), "Check" (the host's unsaved
 * test: the publish verdict, every own test vector with pass / fail and what differs, one frame on the bench) and "Publish". A refusal of
 * the host is shown in plain words (`loraRefusalText`), the keys or models it names included. The id inside the table follows the id
 * field, so a person never has to keep the two in step.
 */
export type LoraCodecEditorProps = {
  /** The id of the codec changed; absent: a new codec. */
  codecId?: string;
  /** The table to start from (a copy, the codec's current table, or the outline). */
  initial: Record<string, unknown>;
  onCheck: (document: Record<string, unknown> | string, frame?: { fport: number; hex: string }) => Promise<LoraCodecCheck>;
  onSave: (document: Record<string, unknown> | string) => Promise<void>;
  onCancel?: () => void;
  /** A refusal of the last save (shown under the buttons). */
  refusal?: LoraCodecRefusal | null;
  error?: string | null;
  busy?: boolean;
  messages?: LoraMessagesInput;
};

export const TENANT_CODEC_ID = /^t\.[a-z0-9][a-z0-9-]{1,61}$/;

/** A new codec's outline: a tlv table with one field and one vector, ready to change. */
export const CODEC_OUTLINE = {
  id: 't.my-sensor', title: 'My sensor', vendor: 'My company', models: [], fports: [85], kind: 'tlv',
  types: { '75': { field: 'battery', fmt: 'u8', unit: '%' } },
  tests: [{ name: 'battery 92 %', fport: 85, hex: '01755C', expect: { battery: 92 } }],
};

/** A refusal in the person's words. */
export function loraRefusalText(m: LoraMessages['editor'], r: LoraCodecRefusal): string {
  const d = r.detail ?? {};
  const key = `refusal_${r.code}` as keyof LoraMessages['editor'];
  const text = (m as Record<string, string>)[key] ?? m.refusal_other;
  const reason = fillText(text, {
    reason: r.code, issues: (d.issues ?? []).join('; '), tables: d.tables ?? '', max: d.max ?? '',
    keys: [...(d.removed ?? []), ...(d.unitChanged ?? [])].join(', '), models: (d.claims ?? []).map((c) => `${c.model} (${c.codec})`).join(', '),
  });
  return fillText(m.refused, { reason });
}

type VectorRow = LoraCodecCheck['vectors'][number];

export function LoraCodecEditor({ codecId, initial, onCheck, onSave, onCancel, refusal, error, busy = false, messages }: LoraCodecEditorProps) {
  const m = mergeLoraMessages(messages).editor;
  const [id, setId] = useState(codecId ?? String(initial.id ?? ''));
  const [text, setText] = useState(() => JSON.stringify({ ...initial, ...(codecId ? {} : { id: initial.id }) }, null, 2));
  const [check, setCheck] = useState<LoraCodecCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const idOk = TENANT_CODEC_ID.test(id);
  /** The text with the id field's value as its `id` (when it parses; a text that does not is sent as it is and refused as JSON). */
  const documentOf = (): Record<string, unknown> | string => {
    try {
      const v = JSON.parse(text) as unknown;
      return v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>), id: codecId ?? id } : text;
    } catch { return text; }
  };
  const runCheck = async (frame?: { fport: number; hex: string }): Promise<LoraCodecCheck | null> => {
    setChecking(true); setCheckError(null);
    try { const r = await onCheck(documentOf(), frame); setCheck(r); return r; } catch (e) { setCheckError(e instanceof Error ? e.message : String(e)); return null; } finally { setChecking(false); }
  };
  const vectorColumns: Column<VectorRow>[] = useMemo(() => [
    { key: 'index', header: m.vector, sortable: true, render: (r) => <span className="text-xs">{r.name ?? `#${r.index + 1}`}</span> },
    { key: 'ok', header: '', render: (r) => <Badge variant={r.ok ? 'success' : 'error'} size="sm">{r.ok ? m.vectorPass : m.vectorFail}</Badge> },
    { key: 'problems', header: m.problems, render: (r) => <span className="font-mono text-xs">{r.problems.join('; ')}</span> },
  ], [m]);
  const shownRefusal = refusal ?? (check && !check.verdict.ok ? check.verdict.refusal : null);
  return (
    <div className="flex flex-col gap-4">
    <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (codecId || idOk) void onSave(documentOf()); }}>
      {!codecId && <Callout variant="note">{m.template}</Callout>}
      <Input id="lora-codec-id" label={m.id} hint={m.idHint} value={codecId ?? id} disabled={!!codecId} onChange={(e) => setId(e.target.value.trim())}
        error={tried && !codecId && !idOk ? m.idInvalid : undefined} className="font-mono" required />
      <Textarea id="lora-codec-doc" label={m.document} hint={m.documentHint} value={text} onChange={(e) => setText(e.target.value)} rows={18} className="font-mono text-xs" spellCheck={false} />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{m.cancel}</Button>}
        <Button type="button" variant="outline" loading={checking} onClick={() => void runCheck()}>{m.check}</Button>
        <Button type="submit" loading={busy}>{m.save}</Button>
      </div>
    </form>
      {error && <Callout variant="danger">{error}</Callout>}
      {checkError && <Callout variant="danger">{checkError}</Callout>}
      {shownRefusal && <Callout variant="danger">{loraRefusalText(m, shownRefusal)}</Callout>}
      {check?.verdict.ok && !refusal && <Callout variant="tip">{m.checkedOk}</Callout>}
      {check && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{m.vectors}</h3>
          <DataTable<VectorRow>
            mode="paginated" variant="plain" density="compact" caption={m.vectors} columns={vectorColumns} rows={check.vectors} rowId={(r) => String(r.index)}
            pageSize={20} searchPlaceholder={m.problems} emptyMessage={m.vectorsEmpty}
          />
        </section>
      )}
      <LoraCodecBench
        messages={messages}
        idPrefix="lora-codec-editor-bench"
        onRun={async (fport, hex): Promise<LoraBenchFrame> => {
          const r = await runCheck({ fport, hex });
          if (!r?.frame) throw new Error(r && !r.verdict.ok ? loraRefusalText(m, r.verdict.refusal) : mergeLoraMessages(messages).bench.nothing);
          return r.frame;
        }}
      />
    </div>
  );
}
