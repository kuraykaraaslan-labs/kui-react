'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDiagramProject,
  faPlus,
  faPenToSquare,
  faTrash,
  faPlay,
  faStop,
  faCircleInfo,
  faFileImport,
  faFileExport,
  faDownload,
  faFileCode,
  faClockRotateLeft,
  faTrashCanArrowUp,
  faTriangleExclamation,
  faCircleCheck,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { DataTable } from '@/modules/ui/DataTable';
import type { TableColumn } from '@/modules/ui/DataTable';
import { Modal } from '@/modules/ui/Modal';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { cn } from '@/libs/utils/cn';
import type { RuleChain } from '@/modules/domains/iot/types';
import {
  buildExport, buildRoltekExport, recentlyDeleted,
  type ConflictChoice, type DeletedRuleset, type ExportResult, type ImportPreview, type RulesetVersion,
} from '@/modules/app/RulesetEditor/transfer';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { useRulesetStore, rulesetStore } from './rulesets.store';
import { RULESET_TEMPLATES } from './rulesets.data';
import { ImportDialog } from './_components/ImportDialog';
import { VersionsDialog } from './_components/VersionsDialog';
import { DeletedDialog } from './_components/DeletedDialog';
import { NewRulesetDialog } from './_components/NewRulesetDialog';
import { downloadText } from './_components/download';

/* ─── Row type for DataTable ─────────────────────────────────────────────── */

type ChainRow = {
  chainId: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  nodes: number;
  edges: number;
  updatedAt: string;
  [key: string]: unknown; // satisfies Record<string, unknown>
};

function toRow(c: RuleChain): ChainRow {
  return {
    chainId: c.chainId,
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    active: c.active,
    nodes: c.nodes.length,
    edges: c.edges.length,
    updatedAt: c.updatedAt
      ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(c.updatedAt))
      : '—',
  };
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function RulesetsPage() {
  const router = useRouter();
  const { chains, versions, deleted } = useRulesetStore();
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [deletedNow, setDeletedNow] = useState(0);
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  /** an export waiting for "download anyway" because some text looks like a password */
  const [pendingExport, setPendingExport] = useState<Pick<ExportResult, 'fileName' | 'json' | 'omitted' | 'suspicious'> | null>(null);
  const [notice, setNotice] = useState('');

  const rows: ChainRow[] = chains.map(toRow);
  const recent = deletedOpen ? recentlyDeleted(deleted, new Date(deletedNow)) : [];

  /* ─── Actions ── */

  function finishExport(r: Pick<ExportResult, 'fileName' | 'json' | 'omitted'>) {
    downloadText(r.fileName, r.json);
    setPendingExport(null);
    setNotice(`Downloaded ${r.fileName}${r.omitted.length ? ` — ${r.omitted.length} secret ${r.omitted.length === 1 ? 'field' : 'fields'} left out` : ''}.`);
  }

  function startExport(list: RuleChain[], opts: { all?: boolean; suffix?: string; format?: 'kui' | 'roltek' } = {}) {
    if (!list.length) return;
    const r = opts.format === 'roltek' ? buildRoltekExport(list, opts) : buildExport(list, opts);
    if (r.suspicious.length) setPendingExport(r);
    else finishExport(r);
  }

  function downloadVersion(v: RulesetVersion) {
    const r = buildExport([v.snapshot], { suffix: `v${v.version}` });
    if (r.suspicious.length) { setVersionsFor(null); setPendingExport(r); }
    else finishExport(r);
  }

  function handleCreate(chain: RuleChain, fromTemplate: boolean) {
    rulesetStore.create(chain, fromTemplate ? 'Created from a template' : 'Created');
    setNewOpen(false);
    if (fromTemplate) router.push(`/theme/iot/rulesets/${chain.slug}`);
    else setNotice(`Created “${chain.name}”.`);
  }

  function handleImport(preview: ImportPreview, choices: Record<string, ConflictChoice>) {
    const r = rulesetStore.import(preview.items, choices);
    setImportOpen(false);
    const parts = [
      r.added && `${r.added} added`,
      r.replaced && `${r.replaced} replaced`,
      r.skipped && `${r.skipped} skipped`,
    ].filter(Boolean);
    setNotice(`Import done: ${parts.join(', ') || 'nothing imported'}. Imported rulesets are inactive.`);
  }

  function handleRestoreDeleted(entry: DeletedRuleset) {
    const c = rulesetStore.restoreDeleted(entry);
    setNotice(`Restored “${c.name}” (inactive).`);
  }

  function handleDelete(chainId: string) {
    const c = chains.find((x) => x.chainId === chainId);
    rulesetStore.remove(chainId);
    setDeleteTarget(null);
    if (c) setNotice(`Deleted “${c.name}”. You can restore it from Recently deleted for 7 days.`);
  }

  /* ─── Columns ── */

  const columns: TableColumn<ChainRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <Link
          href={`/theme/iot/rulesets/${row.slug}`}
          className="inline-flex items-center gap-2 rounded font-medium text-text-primary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <FontAwesomeIcon icon={faDiagramProject} className="w-3.5 h-3.5 text-text-secondary shrink-0" aria-hidden="true" />
          {row.name}
        </Link>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-text-secondary max-w-xs line-clamp-1 block">
          {row.description || <span className="italic opacity-50">—</span>}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      align: 'center',
      sortable: true,
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'neutral'} size="sm" dot>
          {row.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'nodes',
      header: 'Nodes',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className="tabular-nums text-text-secondary">{row.nodes}</span>
      ),
    },
    {
      key: 'edges',
      header: 'Edges',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className="tabular-nums text-text-secondary">{row.edges}</span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (row) => (
        <span className="text-text-secondary whitespace-nowrap">{row.updatedAt}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            as="a"
            href={`/theme/iot/rulesets/${row.slug}`}
            variant="ghost"
            size="xs"
            iconOnly
            aria-label={`Edit ${row.name}`}
            title="Open editor"
          >
            <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            aria-label={`${row.active ? 'Deactivate' : 'Activate'} ${row.name}`}
            title={row.active ? 'Deactivate' : 'Activate'}
            onClick={() => rulesetStore.toggleActive(row.chainId)}
          >
            <FontAwesomeIcon
              icon={row.active ? faStop : faPlay}
              className={cn('w-3.5 h-3.5', row.active ? 'text-warning' : 'text-success-fg')}
              aria-hidden="true"
            />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            aria-label={`Export ${row.name}`}
            title="Export (download JSON)"
            onClick={() => {
              const c = chains.find((x) => x.chainId === row.chainId);
              if (c) startExport([c]);
            }}
          >
            <FontAwesomeIcon icon={faDownload} className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            aria-label={`Export ${row.name} as roltek-automation-1`}
            title="Export as roltek-automation-1"
            onClick={() => {
              const c = chains.find((x) => x.chainId === row.chainId);
              if (c) startExport([c], { format: 'roltek' });
            }}
          >
            <FontAwesomeIcon icon={faFileCode} className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            aria-label={`Versions of ${row.name}`}
            title="Versions"
            onClick={() => setVersionsFor(row.chainId)}
          >
            <FontAwesomeIcon icon={faClockRotateLeft} className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            aria-label={`Delete ${row.name}`}
            title="Delete"
            onClick={() => setDeleteTarget(row.chainId)}
            className="hover:text-error"
          >
            <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  /* ─── Render ── */

  const deleteChain = chains.find((c) => c.chainId === deleteTarget);
  const versionsChain = chains.find((c) => c.chainId === versionsFor) ?? null;

  return (
    <>
      <DocumentTitle text="Rulesets — IoT Theme" />
      <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Rulesets</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {chains.length} rule {chains.length === 1 ? 'chain' : 'chains'} ·{' '}
              {chains.filter((c) => c.active).length} active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} aria-label="Import" title="Import">
              <FontAwesomeIcon icon={faFileImport} className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => startExport(chains, { all: true })}
              disabled={!chains.length} aria-label="Export all" title="Export all">
              <FontAwesomeIcon icon={faFileExport} className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Export all</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => startExport(chains, { all: true, format: 'roltek' })}
              disabled={!chains.length} aria-label="Export all as roltek-automation-1" title="Export all as roltek-automation-1">
              <FontAwesomeIcon icon={faFileCode} className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">roltek-automation-1</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setNewOpen(true)} aria-label="New ruleset" title="New ruleset">
              <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">New ruleset</span>
            </Button>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-subtle px-4 py-3">
          <FontAwesomeIcon icon={faCircleInfo} className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-text-primary">
            Rule chains process device telemetry in real time through a visual pipeline of{' '}
            <strong>Triggers</strong>, <strong>Filters</strong>, <strong>Transforms</strong>, and{' '}
            <strong>Actions</strong>. Click a name to open the drag-and-drop editor, or{' '}
            <Link href="/theme/iot/rulesets/catalog-demo" className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              try the block catalog demo
            </Link>{' '}
            (typed blocks, param forms, groups, flows that run each other, undo).
          </p>
        </div>

        {/* Last action */}
        <div role="status" aria-live="polite">
          {notice && (
            <div className="flex items-start gap-2 rounded-xl border border-success/40 bg-success-subtle px-4 py-2.5 text-sm text-text-primary">
              <FontAwesomeIcon icon={faCircleCheck} className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" aria-hidden="true" />
              <p className="flex-1">{notice}</p>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss"
                className="shrink-0 rounded p-0.5 text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Table tools + DataTable */}
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setDeletedNow(Date.now()); setDeletedOpen(true); }}>
              <FontAwesomeIcon icon={faTrashCanArrowUp} className="w-3.5 h-3.5" aria-hidden="true" />
              Recently deleted
            </Button>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            searchPlaceholder="Search rulesets…"
            pageSize={10}
            emptyMessage="No rulesets yet. Create one to get started."
            caption="Rule chains"
          />
        </div>
      </div>

      <NewRulesetDialog
        open={newOpen}
        chains={chains}
        templates={RULESET_TEMPLATES}
        onClose={() => setNewOpen(false)}
        onCreate={handleCreate}
      />

      <ImportDialog
        open={importOpen}
        chains={chains}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      <VersionsDialog
        chain={versionsChain}
        versions={versionsFor ? versions[versionsFor] ?? [] : []}
        onClose={() => setVersionsFor(null)}
        onRestore={(v) => { if (versionsFor) rulesetStore.restoreVersion(versionsFor, v); }}
        onDownload={downloadVersion}
      />

      <DeletedDialog
        open={deletedOpen}
        items={recent}
        now={deletedNow}
        onClose={() => setDeletedOpen(false)}
        onRestore={handleRestoreDeleted}
      />

      {/* ── Export: text that looks like a password ── */}
      <Modal
        open={!!pendingExport}
        onClose={() => setPendingExport(null)}
        title="Possible passwords in the export"
        description="Secret fields are already left out, but this free text looks like it contains a password or token."
        size="md"
        scrollable
        className="max-h-[90vh]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingExport(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => pendingExport && finishExport(pendingExport)}>
              <FontAwesomeIcon icon={faDownload} className="w-3.5 h-3.5" aria-hidden="true" />
              Download anyway
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-text-primary">
          <p className="flex items-start gap-2">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>Check these before you share the file:</span>
          </p>
          <ul className="list-disc space-y-1 pl-6 font-mono text-xs text-text-secondary">
            {pendingExport?.suspicious.map((p) => <li key={p}>{p}</li>)}
          </ul>
          {!!pendingExport?.omitted.length && (
            <p className="text-xs text-text-secondary">
              Left out (set to null): {pendingExport.omitted.length} secret {pendingExport.omitted.length === 1 ? 'field' : 'fields'}.
            </p>
          )}
        </div>
      </Modal>

      {/* ── Delete confirm modal ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Ruleset"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" aria-hidden="true" />
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-primary">
          Delete <strong>{deleteChain?.name}</strong> with its{' '}
          {deleteChain?.nodes.length ?? 0} nodes and {deleteChain?.edges.length ?? 0} connections?
          You can restore it from <strong>Recently deleted</strong> for 7 days.
        </p>
      </Modal>
      </div>
    </>
  );
}
