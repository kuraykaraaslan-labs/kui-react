'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faRotateLeft, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { Modal } from '@/modules/ui/Modal';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import type { RuleChain } from '@/modules/domains/iot/types';
import type { RulesetVersion } from '@/modules/app/RulesetEditor/transfer';
import { formatDateTime } from './download';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';

type VersionRow = RulesetVersion & Record<string, unknown>;

export function VersionsDialog({ chain, versions, onClose, onRestore, onDownload }: {
  /** the ruleset whose versions are shown; null closes the dialog */
  chain: RuleChain | null;
  versions: RulesetVersion[];
  onClose: () => void;
  onRestore: (version: number) => void;
  /** export one version (same secret handling as any export) */
  onDownload: (version: RulesetVersion) => void;
}) {
  const [status, setStatus] = useState('');
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const columns: Column<VersionRow>[] = [
    {
      key: 'version', header: 'Version', sortable: true, searchValue: (v) => `v${v.version}`,
      render: (v) => (
        <span className="whitespace-nowrap font-medium text-text-primary">
          v{v.version}
          {v.version === current && <Badge variant="success" size="sm" className="ml-2">current</Badge>}
        </span>
      ),
    },
    { key: 'savedAt', header: 'Saved at', sortable: true, searchable: false, render: (v) => <span className="whitespace-nowrap text-text-secondary">{formatDateTime(v.savedAt)}</span> },
    { key: 'by', header: 'By', sortable: true },
    { key: 'summary', header: 'Changes' },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', searchable: false,
      render: (v) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="xs" onClick={() => download(v)} aria-label={`Download version ${v.version}`}>
            <FontAwesomeIcon icon={faDownload} className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          {v.version !== current && (
            <Button variant="outline" size="xs" onClick={() => restore(v)} aria-label={`Restore version ${v.version}`}>
              <FontAwesomeIcon icon={faRotateLeft} className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Restore</span>
            </Button>
          )}
        </div>
      ),
    },
  ];
  const current = sorted[0]?.version;

  function download(v: RulesetVersion) {
    onDownload(v);
    setStatus('');
  }

  function restore(v: RulesetVersion) {
    onRestore(v.version);
    setStatus(`Version ${v.version} restored and saved as version ${(current ?? 0) + 1}.`);
  }

  return (
    <Modal
      open={!!chain}
      onClose={() => { setStatus(''); onClose(); }}
      title={chain ? `Versions — ${chain.name}` : 'Versions'}
      description="Every save keeps a version. Restoring saves the old version as a new one, so nothing is lost."
      size="lg"
      scrollable
      className="max-h-[90vh] sm:max-w-3xl"
    >
      <div className="space-y-3">
        <p role="status" className="min-h-5 text-sm text-success-fg">
          {status && <><FontAwesomeIcon icon={faCircleCheck} className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />{status}</>}
        </p>
        {sorted.length === 0 ? (
          <p className="text-sm text-text-secondary">No versions saved yet.</p>
        ) : (
          // the saved versions: the kit's DataTable (newest first; search, sort and paging in the browser)
          <DataTable<VersionRow>
            mode="paginated"
            caption="Saved versions"
            columns={columns}
            rows={sorted as VersionRow[]}
            rowId={(v) => v.version}
            pageSize={10}
            pageSizeOptions={[10, 25, 50]}
            tableClassName="min-w-[36rem]"
          />
        )}
      </div>
    </Modal>
  );
}
