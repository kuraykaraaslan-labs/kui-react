'use client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { use, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faFloppyDisk,
  faPlay,
  faStop,
  faCircleInfo,
  faBug,
  faPuzzlePiece,
} from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { RulesetEditor } from '@/modules/app/RulesetEditor/RulesetEditor';
import type { RulesetEditorRef, RulesetGraph } from '@/modules/app/RulesetEditor/RulesetEditor';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { useRulesetStore, rulesetStore } from '../rulesets.store';

export default function RulesetEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { chains, versions } = useRulesetStore();
  const chain = chains.find((c) => c.slug === slug);
  const editorRef = useRef<RulesetEditorRef>(null);
  const [saved, setSaved] = useState('');
  /** the graph as the editor last reported it; null while nothing changed since the last save */
  const [unsaved, setUnsaved] = useState<RulesetGraph | null>(null);
  if (!chain) notFound();

  const placeholders = chain.nodes.filter((n) => n.type === 'PLACEHOLDER').length;
  const lastVersion = (versions[chain.chainId] ?? []).reduce((m, v) => Math.max(m, v.version), 0);

  function save() {
    const graph = editorRef.current?.getGraph();
    if (!graph || !chain) return;
    rulesetStore.save({ ...chain, nodes: graph.nodes, edges: graph.edges, groups: graph.groups });
    setSaved(`Saved as version ${lastVersion + 1}.`);
    setUnsaved(null);
  }

  return (
    <>
      <DocumentTitle text={`${chain.name} — IoT Theme`} />
      <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border bg-surface-base px-4 py-2.5">
        <Link
          href="/theme/iot/rulesets"
          className="inline-flex items-center gap-1.5 rounded text-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Rulesets</span>
          <span className="sr-only sm:hidden">Back to rulesets</span>
        </Link>

        <span className="text-border-strong" aria-hidden="true">·</span>

        <h1 className="min-w-0 truncate text-sm font-semibold text-text-primary">{chain.name}</h1>

        <Badge variant={chain.active ? 'success' : 'neutral'} size="sm" dot className="hidden sm:inline-flex">
          {chain.active ? 'Active' : 'Inactive'}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <span role="status" className={unsaved ? 'hidden md:block text-xs text-warning' : 'hidden md:block text-xs text-success-fg'}>{unsaved ? 'Unsaved changes' : saved}</span>
          <span className="hidden md:block text-xs text-text-secondary">
            {(unsaved ?? chain).nodes.length} nodes · {(unsaved ?? chain).edges.length} edges
          </span>

          {/* Debug chain */}
          <button
            type="button"
            onClick={() => editorRef.current?.openRulesetDebug()}
            aria-label="Debug chain" title="Debug chain"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <FontAwesomeIcon icon={faBug} className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:inline">Debug</span>
          </button>

          {/* Toggle active */}
          <button type="button" onClick={() => rulesetStore.toggleActive(chain.chainId)}
            aria-label={chain.active ? 'Deactivate' : 'Activate'} title={chain.active ? 'Deactivate' : 'Activate'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <FontAwesomeIcon icon={chain.active ? faStop : faPlay} className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:inline">{chain.active ? 'Deactivate' : 'Activate'}</span>
          </button>

          {/* Save */}
          <button type="button" onClick={save} aria-label="Save" title="Save a new version"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <FontAwesomeIcon icon={faFloppyDisk} className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* ── Placeholder notice ── */}
      {placeholders > 0 && (
        <div className="shrink-0 flex items-center gap-2 border-b border-border bg-warning-subtle px-4 py-1.5">
          <FontAwesomeIcon icon={faPuzzlePiece} className="w-3 h-3 text-warning shrink-0" aria-hidden="true" />
          <p className="text-xs text-text-primary">
            {placeholders} {placeholders === 1 ? 'node is' : 'nodes are'} not available here (dashed). Open one to see its original settings.
          </p>
        </div>
      )}

      {/* ── Hint bar ── */}
      <div className="shrink-0 hidden md:flex items-center gap-2 border-b border-border bg-surface-raised px-4 py-1.5">
        <FontAwesomeIcon icon={faCircleInfo} className="w-3 h-3 text-text-secondary shrink-0" aria-hidden="true" />
        <p className="text-[11px] text-text-secondary">
          Drag nodes from the palette · Click <span className="font-semibold text-primary">●</span> output → <span className="font-semibold">○</span> input to connect · Click a node to edit it · Shift or Ctrl click to select several · Ctrl+Z undoes · Right-click to group or skip · Click <span className="font-semibold">Debug</span> to trace execution
        </p>
      </div>

      {/* ── Editor canvas ── */}
      <div className="flex-1 min-h-0">
        <RulesetEditor
          key={chain.chainId}
          ref={editorRef}
          initialNodes={chain.nodes}
          initialEdges={chain.edges}
          initialGroups={chain.groups}
          flowId={chain.chainId}
          active={chain.active}
          onChange={setUnsaved}
          chainName={chain.name}
          className="h-full"
        />
      </div>
      </div>
    </>
  );
}
