'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { Modal } from '@/modules/ui/Modal';
import { Input } from '@/modules/ui/Input';
import { Textarea } from '@/modules/ui/Textarea';
import { CodeEditor, type Marker } from '@/modules/ui/CodeEditor';
import { cn } from '@/libs/utils/cn';
import { PrimaryButton, SecondaryButton } from './buttons';
import { useMessages } from '../messages';
import { JsonTree } from '../insight/JsonTree';
import { portColor } from '../node-meta';
import { scriptHover, scriptSuggestions } from '../script/api';
import { lintScript, tidyScript } from '../script/lint';

/** The message a single-script test runs on (next-boilerplate 06 §6.7). */
export type ScriptTestMessage = {
  msgType: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
  originator: { type: string; id: string };
};

/** What the host is asked to run: the edited code of one block on one message, with an optional context. */
export type ScriptTestRequest = {
  nodeId: string;
  code: string;
  msg: ScriptTestMessage;
  context?: { node?: Record<string, unknown>; flow?: Record<string, unknown>; global?: Record<string, unknown> };
};

/** What came back: one message per output port, the block's log, its status, what it wrote to context, the CPU time, or an error in place. */
export type ScriptTestResult = {
  outputs: { port: string; label?: string; msg: unknown }[];
  warn?: string[];
  log?: string[];
  nodeStatus?: { fill?: string; shape?: string; text?: string };
  contextWrites?: { path: string; value?: unknown; op?: string }[];
  cpuMs?: number;
  error?: { code?: string; message: string; line?: number; col?: number };
};

/** a sample to start from; every part is optional */
export type ScriptTestSample = Partial<ScriptTestMessage> & { context?: ScriptTestRequest['context'] };

const SCRIPT_COMPLETIONS = scriptSuggestions();

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  if (!text.trim()) return { ok: true, value: undefined };
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false }; }
}

const pretty = (v: unknown) => (v === undefined ? '' : JSON.stringify(v, null, 2));

/**
 * The single-script test pane (06 §6.7, SC-54): the block's code, a message (type, originator, payload, metadata) and an
 * optional context; Run asks the host (`onRun`, which runs it on the real script host), the outputs show one per port,
 * the log, status, context writes and CPU time below, and an error with a line and column is marked in the code. Save
 * writes the edited code back into the block (one undo step, the draft saves it); nothing is deployed.
 */
export function ScriptTestDialog({ nodeId, blockLabel, code: initialCode, sample, readOnly, onRun, onSave, onClose }: {
  nodeId: string;
  blockLabel: string;
  code: string;
  sample?: ScriptTestSample;
  readOnly: boolean;
  onRun: (request: ScriptTestRequest) => Promise<ScriptTestResult>;
  onSave: (code: string) => void;
  onClose: () => void;
}) {
  const m = useMessages();
  const [code, setCode] = useState(initialCode);
  const [msgType, setMsgType] = useState(sample?.msgType ?? 'POST_TELEMETRY_REQUEST');
  const [origType, setOrigType] = useState(sample?.originator?.type ?? 'DEVICE');
  const [origId, setOrigId] = useState(sample?.originator?.id ?? 'test-device');
  const [payload, setPayload] = useState(pretty(sample?.payload ?? { temperature: 21.5 }));
  const [metadata, setMetadata] = useState(pretty(sample?.metadata ?? {}));
  const [context, setContext] = useState(pretty(sample?.context));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScriptTestResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const p = parseJson(payload), md = parseJson(metadata), cx = parseJson(context);
  const mdOk = md.ok && (md.value === undefined || (typeof md.value === 'object' && md.value !== null && !Array.isArray(md.value)));
  const cxOk = cx.ok && (cx.value === undefined || (typeof cx.value === 'object' && cx.value !== null && !Array.isArray(cx.value)));
  const valid = p.ok && mdOk && cxOk && msgType.trim() !== '' && origType.trim() !== '' && origId.trim() !== '';

  const markers = useMemo<Marker[]>(() => {
    const own: Marker[] = lintScript(code).map((x) => ({ ...x, source: m.scriptCheckSource }));
    const e = result?.error;
    if (e && e.line) own.push({ line: e.line, column: e.col, severity: 'error', message: e.message, code: e.code, source: m.scriptTestSource });
    return own;
  }, [code, result, m.scriptCheckSource, m.scriptTestSource]);

  async function run() {
    if (!valid || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const msg: ScriptTestMessage = {
        msgType: msgType.trim(), originator: { type: origType.trim(), id: origId.trim() },
        ...(p.ok && p.value !== undefined && { payload: p.value }),
        ...(md.ok && md.value !== undefined && { metadata: md.value as Record<string, unknown> }),
      };
      const r = await onRun({ nodeId, code, msg, ...(cx.ok && cx.value !== undefined && { context: cx.value as ScriptTestRequest['context'] }) });
      setResult(r);
    } catch (e) {
      setResult(null);
      setFailure(e instanceof Error && e.message ? e.message : m.scriptTestFailed);
    } finally {
      setBusy(false);
    }
  }

  const changed = code !== initialCode;
  return (
    <Modal open onClose={onClose} size="lg" scrollable className="max-h-[90vh] lg:max-w-5xl" title={m.scriptTestTitle(blockLabel)} description={m.scriptTestIntro}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <PrimaryButton onClick={() => void run()} disabled={!valid || busy} data-testid="script-test-run">
            <FontAwesomeIcon icon={faPlay} className="h-3 w-3" aria-hidden="true" /> {busy ? m.scriptTestRunning : m.scriptTestRun}
          </PrimaryButton>
          {!readOnly && (
            <SecondaryButton onClick={() => onSave(code)} disabled={!changed} data-testid="script-test-save">{m.scriptTestSave}</SecondaryButton>
          )}
          <span className="flex-1" />
          <SecondaryButton onClick={onClose}>{m.dialogCancel}</SecondaryButton>
        </div>
      }>
      <div data-testid="script-test" className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <CodeEditor id={`script-test-${nodeId}`} label={m.scriptTestCode} value={code} onChange={setCode} language="js" minHeight={220} readonly={readOnly}
            showToolbar messages={m.codeEditor} markers={markers} format={(v) => tidyScript(v)}
            getSuggestions={() => SCRIPT_COMPLETIONS} getHover={({ word }) => { const d = scriptHover(word); return d ? { contents: d } : null; }} />
          <div className="grid grid-cols-3 gap-2">
            <Input id="script-test-type" label={m.scriptTestMsgType} value={msgType} onChange={(e) => setMsgType(e.target.value)} />
            <Input id="script-test-otype" label={m.scriptTestOriginatorType} value={origType} onChange={(e) => setOrigType(e.target.value)} />
            <Input id="script-test-oid" label={m.scriptTestOriginatorId} value={origId} onChange={(e) => setOrigId(e.target.value)} />
          </div>
          <Textarea id="script-test-payload" label={m.scriptTestPayload} rows={4} className="font-mono" value={payload}
            error={p.ok ? undefined : m.scriptTestBadJson} onChange={(e) => setPayload(e.target.value)} />
          <Textarea id="script-test-metadata" label={m.scriptTestMetadata} rows={3} className="font-mono" value={metadata}
            error={mdOk ? undefined : m.scriptTestBadObject} onChange={(e) => setMetadata(e.target.value)} />
          <Textarea id="script-test-context" label={m.scriptTestContext} hint={m.scriptTestContextHint} rows={3} className="font-mono" value={context}
            error={cxOk ? undefined : m.scriptTestBadObject} onChange={(e) => setContext(e.target.value)} />
        </div>
        <section aria-label={m.scriptTestResult} aria-live="polite" className="min-w-0 space-y-3 text-xs" data-testid="script-test-result">
          <h3 className="text-sm font-semibold text-text-primary">{m.scriptTestResult}</h3>
          {!result && !failure && <p className="text-text-secondary">{m.scriptTestNoResult}</p>}
          {failure && <p role="alert" className="rounded-md border border-error bg-error-subtle px-2.5 py-1.5 text-error">{failure}</p>}
          {result?.error && (
            <p role="alert" data-testid="script-test-error" className="rounded-md border border-error bg-error-subtle px-2.5 py-1.5 text-error">
              {result.error.line ? m.scriptTestErrorAt(result.error.line, result.error.col) : ''}{result.error.code ? `${result.error.code}: ` : ''}{result.error.message}
            </p>
          )}
          {result && (
            <>
              {result.outputs.length === 0 && !result.error && <p className="text-text-secondary">{m.scriptTestNoOutput}</p>}
              <ul className="space-y-2">
                {result.outputs.map((o, i) => (
                  <li key={`${o.port}-${i}`} data-testid="script-test-output" className="rounded-md border border-l-[3px] border-border bg-surface-base px-2 py-1.5" style={{ borderLeftColor: portColor(o.port) }}>
                    <p className="mb-1 font-semibold text-text-primary">{m.scriptTestOutput(o.label || o.port)}</p>
                    <div className="overflow-x-auto font-mono text-[11px] leading-[1.45]"><JsonTree value={o.msg} name="msg" /></div>
                  </li>
                ))}
              </ul>
              {[...(result.warn ?? []).map((t) => ['warn', t] as const), ...(result.log ?? []).map((t) => ['log', t] as const)].length > 0 && (
                <div>
                  <h4 className="mb-1 font-semibold text-text-secondary">{m.scriptTestLog}</h4>
                  <ul className="space-y-0.5 font-mono text-[11px]">
                    {(result.warn ?? []).map((t, i) => <li key={`w${i}`} className="text-warning-fg">{t}</li>)}
                    {(result.log ?? []).map((t, i) => <li key={`l${i}`} className="text-text-primary">{t}</li>)}
                  </ul>
                </div>
              )}
              {result.nodeStatus?.text && <p><span className="font-semibold text-text-secondary">{m.scriptTestStatus}</span> {result.nodeStatus.text}</p>}
              {(result.contextWrites ?? []).length > 0 && (
                <div>
                  <h4 className="mb-1 font-semibold text-text-secondary">{m.scriptTestContextWrites}</h4>
                  <ul className="space-y-0.5 font-mono text-[11px]">
                    {result.contextWrites!.map((w, i) => <li key={i}>{w.op ? `${w.op} ` : ''}{w.path}{w.value !== undefined ? ` = ${JSON.stringify(w.value)}` : ''}</li>)}
                  </ul>
                </div>
              )}
              {typeof result.cpuMs === 'number' && <p className={cn('tabular-nums text-text-secondary')}>{m.scriptTestCpu(result.cpuMs)}</p>}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
