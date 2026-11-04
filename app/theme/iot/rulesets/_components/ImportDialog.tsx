'use client';
import { useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faCircleExclamation, faCircleInfo, faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';
import { Modal } from '@/modules/ui/Modal';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { Textarea } from '@/modules/ui/Textarea';
import { cn } from '@/libs/utils/cn';
import type { RuleChain } from '@/modules/domains/iot/types';
import {
  CONFLICT_LABELS, IMPORT_MAX_BYTES, parseImport,
  type ConflictChoice, type ImportError, type ImportPreview,
} from '@/modules/app/RulesetEditor/transfer';

const CHOICES: ConflictChoice[] = ['copy', 'replace', 'skip'];

const selectCls = cn(
  'w-full min-w-36 rounded-lg border border-border bg-surface-base px-2 py-1.5 text-xs text-text-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
);

type ImportRow = ImportPreview['items'][number] & { name: string; exists: 'existing' | 'new' } & Record<string, unknown>;

export function ImportDialog({ open, chains, onClose, onImport }: {
  open: boolean;
  chains: RuleChain[];
  onClose: () => void;
  /** apply the checked import */
  onImport: (preview: ImportPreview, choices: Record<string, ConflictChoice>) => void;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<ImportError | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});

  function reset() {
    setText(''); setFileName(''); setError(null); setPreview(null); setChoices({});
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() { reset(); onClose(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setPreview(null);
    setError(null);
    if (!f) return;
    setFileName(f.name);
    if (f.size > IMPORT_MAX_BYTES) {
      setText('');
      setError({ ok: false, code: 'too-big', message: `The file is too big (over ${IMPORT_MAX_BYTES / 1024 / 1024} MB).` });
      return;
    }
    setText(await f.text());
  }

  function check() {
    const r = parseImport(text, chains);
    if (!r.ok) { setError(r); setPreview(null); return; }
    setError(null);
    setPreview(r);
    setChoices(Object.fromEntries(r.items.filter((i) => i.existing).map((i) => [i.key, 'copy' as ConflictChoice])));
  }

  const count = preview ? preview.items.filter((i) => !i.existing || choices[i.key] !== 'skip').length : 0;

  const importColumns: Column<ImportRow>[] = [
    {
      key: 'name', header: 'Ruleset', sortable: true, searchValue: (item) => `${item.chain.name} ${item.chain.chainId}`,
      render: (item) => (
        <>
          <p className="font-medium text-text-primary">{item.chain.name}</p>
          <p className="font-mono text-[11px] text-text-secondary">{item.chain.chainId}</p>
        </>
      ),
    },
    {
      key: 'nodes', header: 'Nodes', align: 'center', sortable: true, searchable: false,
      render: (item) => (
        <span className="tabular-nums text-text-secondary">
          {item.nodes}
          {item.placeholders > 0 && (
            <Badge variant="warning" size="sm" className="mt-1 flex w-max items-center gap-1">
              <FontAwesomeIcon icon={faPuzzlePiece} className="h-2.5 w-2.5" aria-hidden="true" />
              {item.placeholders} not available here
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'notes', header: 'Notes', searchValue: (item) => item.notes.join(' '),
      render: (item) => (
        <span className="text-xs text-text-secondary">
          {item.notes.length ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {item.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          ) : 'Ready'}
        </span>
      ),
    },
    {
      key: 'exists', header: 'Already exists', sortable: true, searchable: false,
      render: (item) => (item.existing ? (
        <>
          <label htmlFor={`${id}-c-${item.key}`} className="sr-only">
            {`"${item.existing.name}" already exists: what to do`}
          </label>
          <select
            id={`${id}-c-${item.key}`}
            value={choices[item.key] ?? 'copy'}
            onChange={(e) => setChoices((c) => ({ ...c, [item.key]: e.target.value as ConflictChoice }))}
            className={selectCls}
          >
            {CHOICES.map((c) => <option key={c} value={c}>{CONFLICT_LABELS[c]}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-text-secondary">Same id as “{item.existing.name}”</p>
        </>
      ) : <span className="text-xs text-text-secondary">New</span>),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import rulesets"
      description="A file exported from rulesets (kui-ruleset-1 or roltek-automation-1), or a Node-RED flow export."
      size="lg"
      scrollable
      className="max-h-[90vh] sm:max-w-3xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {preview && (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={() => setPreview(null)}>Back</Button>
          )}
          <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
          {preview ? (
            <Button variant="primary" size="sm" disabled={!count} onClick={() => { onImport(preview, choices); reset(); }}>
              <FontAwesomeIcon icon={faFileImport} className="h-3.5 w-3.5" aria-hidden="true" />
              Import {count} {count === 1 ? 'ruleset' : 'rulesets'}
            </Button>
          ) : (
            <Button variant="primary" size="sm" disabled={!text.trim()} onClick={check}>Check</Button>
          )}
        </div>
      }
    >
      {!preview ? (
        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-file`} className="mb-1.5 block text-sm font-medium text-text-primary">File</label>
            <input
              ref={fileRef} id={`${id}-file`} type="file" accept=".json,application/json"
              onChange={onFile}
              aria-describedby={`${id}-file-hint`}
              className={cn(
                'block w-full text-sm text-text-secondary',
                'file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-base file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface-overlay',
                'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            />
            <p id={`${id}-file-hint`} className="mt-1 text-xs text-text-secondary">
              {fileName ? `Loaded ${fileName}.` : 'JSON, up to 2 MB.'}
            </p>
          </div>
          <Textarea
            id={`${id}-paste`}
            label="Or paste JSON"
            rows={8}
            value={text}
            spellCheck={false}
            className="font-mono text-xs"
            onChange={(e) => { setText(e.target.value); setFileName(''); setError(null); }}
            placeholder={'{ "format": "kui-ruleset-1", "rulesets": [ … ] }  or  { "format": "roltek-automation-1", "flows": [ … ] }'}
          />
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-error/40 bg-error-subtle px-3 py-2 text-sm text-text-primary">
              <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
              <p>{error.message}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div role="status" className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary-subtle px-3 py-2 text-sm text-text-primary">
            <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              {preview.source === 'node-red' && preview.report && (
                <p>
                  <strong>Node-RED flow.</strong> {preview.report.exact} exact, {preview.report.changed} changed,{' '}
                  {preview.report.placeholders} {preview.report.placeholders === 1 ? 'placeholder' : 'placeholders'}
                  {preview.report.skipped > 0 && <> ({preview.report.skipped} config nodes and comments skipped)</>}.
                </p>
              )}
              <p>Imported rulesets arrive inactive. Nodes that are not available here are kept as placeholders with their connections.</p>
            </div>
          </div>

          {/* the rulesets of the import: the kit's DataTable (search, sort, a filter for the ones that exist, paging) */}
          <DataTable<ImportRow>
            mode="paginated"
            caption="Rulesets in this import"
            columns={importColumns}
            rows={preview.items.map((item) => ({ ...item, name: item.chain.name, exists: item.existing ? 'existing' : 'new' })) as ImportRow[]}
            rowId={(item) => item.key}
            filterFields={[{ id: 'exists', label: 'Already exists', type: 'select', options: [{ value: 'existing', label: 'Already exists' }, { value: 'new', label: 'New' }] }]}
            pageSize={10}
            pageSizeOptions={[10, 25, 50]}
            tableClassName="min-w-[36rem]"
          />
        </div>
      )}
    </Modal>
  );
}
