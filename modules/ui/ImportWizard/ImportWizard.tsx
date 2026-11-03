'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Checkbox } from '@/modules/ui/Checkbox';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { FileInput } from '@/modules/ui/FileInput';
import { Select } from '@/modules/ui/Select';
import { Spinner } from '@/modules/ui/Spinner';
import { Stepper, type StepItem } from '@/modules/ui/Stepper';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { detectDelimiter, guessMapping, parseCsvPreview, templateCsv } from './csv';
import { fillText, mergeImportWizardMessages, type ImportWizardMessages, type ImportWizardMessagesInput } from './messages';
import { IMPORT_STRATEGIES, ImportApiError, type ImportAdapter, type ImportFollowUp, type ImportJob, type ImportRowProblem, type ImportStrategy, type ImportTarget } from './types';

type Step = 'file' | 'columns' | 'check' | 'result';
type ProblemRow = ImportRowProblem & { id: string; fieldLabel: string } & Record<string, unknown>;
type PreviewRow = Record<string, unknown> & { id: string };

const MAX_PROBLEMS = 500;
const LEAVE_OUT = '';

export interface ImportWizardProps {
  adapter: ImportAdapter;
  /** Open on this target (a page that imports one kind of record). */
  initialTargetKey?: string;
  /** Open an existing import where it stands: a checked one at its review, a finished one at its result. */
  job?: ImportJob | null;
  /** After an import was checked, imported or undone (a host's history list reads again). */
  onChanged?: (job: ImportJob) => void;
  /** The largest file taken, in bytes (the host's API limit). Default 20 MB. */
  maxBytes?: number;
  messages?: ImportWizardMessagesInput;
  className?: string;
}

function errorText(m: ImportWizardMessages, e: unknown): string {
  if (e instanceof ImportApiError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ImportApiError')) {
    const err = e as ImportApiError;
    return (err.reason && (m.errors as Record<string, string>)[err.reason]) || err.message;
  }
  return fillText(m.common.unknownError, { message: e instanceof Error ? e.message : String(e) });
}

function saveText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * ImportWizard — records from a CSV file in four steps: File (what to import, the file, a template to fill in), Columns (which column goes
 * into which field, guessed from the names; what to do with records that exist; the first rows as they will be read), Check (every row is
 * checked by the target and nothing is written: counts, and each problem row with the target's own words; "Import n rows" asks through the
 * ConfirmDialog) and Result (the counts, the target's extra steps such as downloading new credentials once, and Undo behind the
 * ConfirmDialog when the target can take an import back). Reads and writes only through `ImportAdapter`.
 */
export function ImportWizard({ adapter, initialTargetKey, job: resume, onChanged, maxBytes = 20 * 1024 * 1024, messages, className }: ImportWizardProps) {
  const m = useMemo(() => mergeImportWizardMessages(messages), [messages]);
  const [targets, setTargets] = useState<ImportTarget[] | null>(null);
  const [targetKey, setTargetKey] = useState(resume?.targetKey ?? initialTargetKey ?? '');
  const [step, setStep] = useState<Step>(resume ? (resume.status === 'AWAITING_REVIEW' ? 'check' : 'result') : 'file');
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [strategy, setStrategy] = useState<ImportStrategy>('CREATE_ONLY');
  const [job, setJob] = useState<ImportJob | null>(resume ?? null);
  const [problems, setProblems] = useState<ImportRowProblem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<'apply' | 'undo' | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const ac = new AbortController();
    adapter.targets(ac.signal).then(setTargets, (e) => { if (!ac.signal.aborted) { setTargets([]); setError(errorText(m, e)); } });
    return () => ac.abort();
  }, [adapter, m]);

  const loadProblems = useCallback((jobId: string, signal?: AbortSignal) => {
    adapter.problems(jobId, { page: 0, pageSize: MAX_PROBLEMS }, signal).then((r) => setProblems(r.rows), (e) => { if (!signal?.aborted) setError(errorText(m, e)); });
  }, [adapter, m]);
  useEffect(() => {
    if (!resume || resume.status !== 'AWAITING_REVIEW') return;
    const ac = new AbortController();
    loadProblems(resume.importJobId, ac.signal);
    return () => ac.abort();
  }, [resume, loadProblems]);

  const target = targets?.find((t) => t.key === targetKey) ?? null;
  const delimiter = useMemo(() => (content ? detectDelimiter(content) : ','), [content]);
  const preview = useMemo(() => (content ? parseCsvPreview(content, delimiter, 6) : []), [content, delimiter]);
  const columns = useMemo(() => {
    const first = preview[0] ?? [];
    return hasHeader ? first.map((c) => c.trim()) : first.map((_c, i) => `col${i + 1}`);
  }, [preview, hasHeader]);
  const sample = useMemo(() => (hasHeader ? preview.slice(1) : preview).slice(0, 5), [preview, hasHeader]);

  function pickFile(f: File | null) {
    setError(null);
    setContent(null);
    setFileName(f?.name ?? '');
    if (!f) return;
    if (f.size > maxBytes) { setError(fillText(m.file.tooLarge, { mb: Math.round(maxBytes / 1024 / 1024) })); return; }
    f.text().then((text) => {
      if (!text.trim()) { setError(m.file.empty); return; }
      setContent(text);
    }, (e) => setError(errorText(m, e)));
  }

  function toColumns() {
    if (!target) return;
    setMapping(guessMapping(columns, target.fields, target.columnPrefixes));
    setStep('columns');
  }

  const fieldColumn = (field: string) => Object.entries(mapping).find(([, f]) => f === field)?.[0] ?? LEAVE_OUT;
  const setFieldColumn = (field: string, column: string) => setMapping((cur) => {
    const next: Record<string, string> = {};
    for (const [c, f] of Object.entries(cur)) if (f !== field && c !== column) next[c] = f;
    if (column !== LEAVE_OUT) next[column] = field;
    return next;
  });
  const missing = target ? target.fields.filter((f) => f.required && fieldColumn(f.name) === LEAVE_OUT) : [];
  const prefixed = target ? columns.filter((c) => (target.columnPrefixes ?? []).some((p) => c.startsWith(p))) : [];
  const unused = columns.filter((c) => !(c in mapping));

  async function check() {
    if (!target || content === null) return;
    setBusy(true); setError(null); setProblems(null);
    try {
      const j = await adapter.dryRun({ targetKey: target.key, fileName, content, mapping, strategy, delimiter, hasHeader });
      setJob(j);
      setStep('check');
      onChanged?.(j);
      if (j.failedRows > 0) loadProblems(j.importJobId); else setProblems([]);
    } catch (e) {
      setError(errorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  async function run(kind: 'apply' | 'undo') {
    if (!job) return;
    setBusy(true); setError(null);
    try {
      const j = kind === 'apply' ? await adapter.apply(job.importJobId) : await adapter.undo(job.importJobId);
      setJob(j);
      setStep('result');
      setAsk(null);
      onChanged?.(j);
    } catch (e) {
      setAsk(null);
      setError(errorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  async function follow(f: ImportFollowUp) {
    if (!job) return;
    setBusy(true); setError(null);
    try {
      await adapter.followUp(job.importJobId, f);
      setFollowed((s) => ({ ...s, [f.key]: true }));
    } catch (e) {
      setError(errorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStep('file'); setJob(null); setProblems(null); setContent(null); setFileName(''); setMapping({}); setError(null); setFollowed({});
  }

  const order: Step[] = ['file', 'columns', 'check', 'result'];
  const at = order.indexOf(step);
  const steps: StepItem[] = order.map((s, i) => ({ label: m.steps[s], state: i < at ? 'complete' : i === at ? 'active' : 'pending' }));
  const ready = job ? Math.max(0, job.totalRows - job.failedRows - job.skippedRows) : 0;
  const labelOf = (name?: string | null) => (name ? target?.fields.find((f) => f.name === name)?.label ?? name : m.common.none);

  const problemRows: ProblemRow[] = (problems ?? []).map((p, i) => ({ ...p, id: `${p.rowNumber}-${i}`, fieldLabel: labelOf(p.field) }) as ProblemRow);
  const problemColumns: Column<ProblemRow>[] = [
    { key: 'rowNumber', header: m.check.row, sortable: true, align: 'right', render: (r) => <span className="tabular-nums">{r.rowNumber}</span> },
    { key: 'fieldLabel', header: m.check.field, sortable: true },
    { key: 'message', header: m.check.problem, render: (r) => <span className="text-sm">{r.message}</span> },
  ];
  const fieldsWithProblems = [...new Set(problemRows.map((p) => p.fieldLabel))];
  const problemFilters: DataTableFilterField<ProblemRow>[] = [
    { id: 'field', label: m.check.field, type: 'select', options: fieldsWithProblems.map((f) => ({ value: f, label: f })), match: (r, v) => !v || r.fieldLabel === v },
  ];
  const previewRows: PreviewRow[] = sample.map((cells, i) => {
    const row: PreviewRow = { id: String(i) };
    columns.forEach((c, ci) => { const f = mapping[c]; if (f) row[f] = cells[ci] ?? ''; });
    return row;
  });
  const mappedFields = target ? [...target.fields.filter((f) => fieldColumn(f.name) !== LEAVE_OUT).map((f) => ({ name: f.name, label: f.label })), ...prefixed.map((c) => ({ name: c, label: c }))] : [];

  return (
    <div className={cn('space-y-5', className)} data-import-wizard={step}>
      <Stepper steps={steps} />
      {error && <Callout variant="danger" role="alert">{error}</Callout>}

      {step === 'file' && (
        <section className="space-y-4" aria-label={m.steps.file}>
          <p className="text-sm text-text-secondary">{m.file.intro}</p>
          {targets === null ? <div className="flex justify-center p-4" role="status" aria-label={m.common.loading}><Spinner /></div> : targets.length === 0 ? (
            <Callout variant="note">{m.file.noTargets}</Callout>
          ) : (
            <>
              <Select
                id="import-target" label={m.file.target} value={targetKey} placeholder={m.file.targetPlaceholder} onChange={(e) => setTargetKey(e.target.value)}
                options={targets.map((t) => ({ value: t.key, label: t.label }))} disabled={!!initialTargetKey && targets.some((t) => t.key === initialTargetKey)}
              />
              {target && (
                <div className="space-y-2 rounded-md border border-border bg-surface-sunken p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-text-primary">{m.file.columnsTitle}</h3>
                    <Button size="sm" variant="outline" iconLeft={<FontAwesomeIcon icon={faDownload} />} onClick={() => saveText(`${target.key}-template.csv`, templateCsv(target.fields))}>{m.file.template}</Button>
                  </div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {target.fields.map((f) => (
                      <li key={f.name}><span className="font-mono text-xs">{f.name}</span> <span className="text-text-secondary">({f.required ? m.file.required : m.file.optional})</span></li>
                    ))}
                  </ul>
                  {!!target.columnPrefixes?.length && <p className="text-text-secondary">{fillText(m.file.prefixes, { prefixes: target.columnPrefixes.join(', ') })}</p>}
                  <p className="text-xs text-text-secondary">{m.file.templateHint}</p>
                </div>
              )}
              <FileInput id="import-file" label={m.file.file} hint={m.file.fileHint} accept=".csv,.tsv,.txt,text/csv" onFiles={(fs) => pickFile(fs[0] ?? null)} />
              <Checkbox id="import-has-header" label={m.file.hasHeader} checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              {content !== null && <p className="text-sm text-text-secondary">{fillText(m.file.rows, { n: Math.max(0, content.split(/\r?\n/).filter((l) => l.trim()).length - (hasHeader ? 1 : 0)) })}</p>}
              <div className="flex justify-end">
                <Button variant="primary" onClick={toColumns} disabled={!target || content === null || !columns.length}>{m.common.next}</Button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 'columns' && target && (
        <section className="space-y-4" aria-label={m.steps.columns}>
          <p className="text-sm text-text-secondary">{m.columns.intro}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {target.fields.map((f) => (
              <Select
                key={f.name} id={`import-map-${f.name}`} label={f.label} value={fieldColumn(f.name)} required={f.required}
                onChange={(e) => setFieldColumn(f.name, e.target.value)}
                options={[{ value: LEAVE_OUT, label: m.columns.leaveOut }, ...columns.filter((c) => !prefixed.includes(c)).map((c) => ({ value: c, label: c }))]}
              />
            ))}
          </div>
          {prefixed.length > 0 && <p className="text-sm text-text-secondary">{m.columns.asIs}: <span className="font-mono text-xs">{prefixed.join(', ')}</span></p>}
          {unused.length > 0 && <p className="text-sm text-text-secondary">{fillText(m.columns.extra, { columns: unused.join(', ') })}</p>}
          {missing.length > 0 && <Callout variant="warning">{fillText(m.columns.missing, { fields: missing.map((f) => f.label).join(', ') })}</Callout>}
          <Select
            id="import-strategy" label={m.columns.strategy} value={strategy} onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
            options={IMPORT_STRATEGIES.map((s) => ({ value: s, label: m.columns.strategies[s] }))}
          />
          {mappedFields.length > 0 && previewRows.length > 0 && (
            <DataTable<PreviewRow>
              columns={mappedFields.map((f) => ({ key: f.name, header: f.label, render: (r) => <span className="text-xs">{String(r[f.name] ?? '')}</span> }))}
              rows={previewRows}
              mode="static"
              variant="plain"
              searchable={false}
              title={m.columns.preview}
              caption={m.columns.previewCaption}
              rowId={(r) => r.id}
            />
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep('file')} disabled={busy}>{m.common.back}</Button>
            <Button variant="primary" onClick={() => void check()} loading={busy} disabled={busy || missing.length > 0}>{busy ? m.columns.checking : m.columns.check}</Button>
          </div>
        </section>
      )}

      {step === 'check' && job && (
        <section className="space-y-4" aria-label={m.steps.check}>
          <p className="text-sm text-text-secondary">{m.check.intro}</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-import-counts>
            {([[m.check.total, job.totalRows], [m.check.ready, ready], [m.check.skipped, job.skippedRows], [m.check.failed, job.failedRows]] as const).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border p-3">
                <dt className="text-xs text-text-secondary">{k}</dt>
                <dd className="text-xl font-semibold tabular-nums text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          {job.warnings?.includes('DUPLICATE_FILE') && <Callout variant="warning">{m.check.duplicate}</Callout>}
          {job.failedRows > 0 && (ready > 0 ? <Callout variant="info">{m.check.failedNote}</Callout> : <Callout variant="warning">{m.check.nothing}</Callout>)}
          {job.failedRows > 0 && (
            <DataTable<ProblemRow>
              columns={problemColumns}
              rows={problemRows}
              mode="static"
              loading={problems === null}
              title={m.check.problems}
              caption={m.check.problemsCaption}
              rowId={(r) => r.id}
              filterFields={problemFilters}
              defaultSort={[{ key: 'rowNumber', dir: 'asc' }]}
              emptyMessage={m.check.noProblems}
            />
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={restart} disabled={busy}>{m.check.another}</Button>
            <Button variant="primary" onClick={() => setAsk('apply')} disabled={busy || ready === 0 || job.status !== 'AWAITING_REVIEW'}>{fillText(m.check.import, { n: ready })}</Button>
          </div>
        </section>
      )}

      {step === 'result' && job && (
        <section className="space-y-4" aria-label={m.steps.result}>
          <Callout variant={job.status === 'COMPLETED' ? 'tip' : job.status === 'UNDONE' ? 'note' : 'warning'}>
            {job.status === 'COMPLETED' ? m.result.done : job.status === 'UNDONE' ? m.result.undone : job.status === 'FAILED' ? m.result.failed : m.status[job.status]}
          </Callout>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-import-result>
            {([[m.result.created, job.createdRows], [m.result.updated, job.updatedRows], [m.result.skipped, job.skippedRows], [m.result.failedRows, job.failedRows]] as const).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border p-3">
                <dt className="text-xs text-text-secondary">{k}</dt>
                <dd className="text-xl font-semibold tabular-nums text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          {!!job.notUndoableRows && job.status === 'UNDONE' && <Callout variant="warning">{fillText(m.result.notUndoable, { n: job.notUndoableRows })}</Callout>}
          {job.status === 'COMPLETED' && !!target?.followUps?.length && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <h3 className="text-sm font-semibold text-text-primary">{m.result.nextSteps}</h3>
              {target.followUps.map((f) => (
                <div key={f.key} className="space-y-2" data-import-follow-up={f.key}>
                  {f.description && <p className="text-sm text-text-secondary">{f.description}</p>}
                  {followed[f.key]
                    ? <p className="text-sm text-text-primary">{m.result.followUpDone}</p>
                    : <Button variant="primary" iconLeft={<FontAwesomeIcon icon={faFileArrowDown} />} onClick={() => void follow(f)} loading={busy} disabled={busy}>{f.label}</Button>}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={restart} disabled={busy}>{m.result.start}</Button>
            {target?.undoable && (job.status === 'COMPLETED' || job.status === 'FAILED') && (
              <Button variant="danger" onClick={() => setAsk('undo')} disabled={busy}>{m.result.undo}</Button>
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={ask === 'apply'}
        tone="warning"
        title={fillText(m.check.confirmTitle, { n: ready })}
        message={fillText(m.check.confirmMessage, { undo: target?.undoable ? m.check.confirmUndo : m.check.confirmNoUndo })}
        confirmLabel={fillText(m.check.import, { n: ready })}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void run('apply')}
      />
      <ConfirmDialog
        open={ask === 'undo'}
        tone="danger"
        title={m.result.undoTitle}
        message={m.result.undoMessage}
        confirmLabel={m.result.undo}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => void run('undo')}
      />
    </div>
  );
}
