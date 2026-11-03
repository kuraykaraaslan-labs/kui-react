import { ImportApiError, type ImportAdapter, type ImportJob, type ImportRowProblem, type ImportTarget } from './types';

/**
 * The in-memory adapter of the kui-react demo (`/theme/common/imports`): two targets (devices, with the one-time credentials download, and
 * contacts, which cannot be undone). A row is refused when a required column is empty or a device name repeats, in the target's words.
 */
export const DEMO_IMPORT_TARGETS: ImportTarget[] = [
  {
    key: 'iot_devices', label: 'IoT devices', undoable: true, columnPrefixes: ['attr:', 'shared:'],
    fields: [
      { name: 'name', label: 'Device name', type: 'string', required: true, example: 'pump-house-01' },
      { name: 'label', label: 'Label', type: 'string', example: 'Pump house, north' },
      { name: 'profile', label: 'Device profile name', type: 'string', example: 'Water pumps' },
      { name: 'serial', label: 'Serial', type: 'string', example: 'SN-000123' },
    ],
    followUps: [{ kind: 'download_once', key: 'credentials', label: 'Download the credentials', description: 'The new devices\' access tokens, in one file you can download once, within 15 minutes. Keep it safe: it is not shown again.' }],
  },
  {
    key: 'contact', label: 'Contacts', undoable: false,
    fields: [
      { name: 'email', label: 'Email', type: 'string', required: true, example: 'ayse@example.com' },
      { name: 'firstName', label: 'First name', type: 'string', example: 'Ayşe' },
      { name: 'lastName', label: 'Last name', type: 'string', example: 'Yılmaz' },
    ],
  },
];

export function createDemoImportAdapter(opts: { delayMs?: number; onDownload?: (jobId: string) => void } = {}): ImportAdapter {
  const wait = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), opts.delayMs ?? 150));
  const jobs = new Map<string, ImportJob>();
  const problems = new Map<string, ImportRowProblem[]>();
  const downloaded = new Set<string>();
  let seq = 0;
  return {
    targets: () => wait(DEMO_IMPORT_TARGETS),
    dryRun: (input) => {
      const target = DEMO_IMPORT_TARGETS.find((t) => t.key === input.targetKey);
      if (!target) return Promise.reject(new ImportApiError('Unknown target', 404));
      const sep = input.delimiter ?? ',';
      const lines = input.content.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
      const header = input.hasHeader ? lines[0]!.split(sep).map((c) => c.trim()) : lines[0]!.split(sep).map((_c, i) => `col${i + 1}`);
      const body = input.hasHeader ? lines.slice(1) : lines;
      const found: ImportRowProblem[] = [];
      const seen = new Set<string>();
      body.forEach((line, i) => {
        const cells = line.split(sep);
        const rowNumber = i + (input.hasHeader ? 2 : 1);
        const value = (field: string) => { const col = Object.entries(input.mapping).find(([, f]) => f === field)?.[0]; return col ? (cells[header.indexOf(col)] ?? '').trim() : ''; };
        for (const f of target.fields.filter((x) => x.required)) if (!value(f.name)) found.push({ rowNumber, field: f.name, code: 'required', message: `${f.label} is empty. Every row needs one.` });
        const key = value(target.fields[0]!.name);
        if (key && seen.has(key)) found.push({ rowNumber, field: target.fields[0]!.name, code: 'duplicate_in_file', message: `"${key}" appears earlier in this file. Each one may appear once.` });
        seen.add(key);
      });
      const failed = new Set(found.map((p) => p.rowNumber)).size;
      const job: ImportJob = {
        importJobId: `job-${++seq}`, name: input.fileName, targetKey: input.targetKey, fileName: input.fileName, status: 'AWAITING_REVIEW',
        totalRows: body.length, createdRows: 0, updatedRows: 0, skippedRows: 0, failedRows: failed, createdAt: new Date().toISOString(), warnings: null,
      };
      jobs.set(job.importJobId, job);
      problems.set(job.importJobId, found);
      return wait(job);
    },
    job: (id) => wait(jobs.get(id)!),
    problems: (id, q) => { const all = problems.get(id) ?? []; return wait({ rows: all.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize), total: all.length }); },
    apply: (id) => {
      const j = jobs.get(id)!;
      if (j.status !== 'AWAITING_REVIEW') return Promise.reject(new ImportApiError('Already applied', 409, { reason: 'already_applied' }));
      Object.assign(j, { status: 'COMPLETED', createdRows: j.totalRows - j.failedRows, finishedAt: new Date().toISOString() });
      return wait(j);
    },
    undo: (id) => {
      const j = jobs.get(id)!;
      Object.assign(j, { status: 'UNDONE', undoneAt: new Date().toISOString(), notUndoableRows: 0 });
      return wait(j);
    },
    followUp: (id) => {
      if (downloaded.has(id)) return Promise.reject(new ImportApiError('No credentials file is waiting for this import. It was downloaded already.', 404));
      downloaded.add(id);
      opts.onDownload?.(id);
      return wait(undefined);
    },
  };
}
