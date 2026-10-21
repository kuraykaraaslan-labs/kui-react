'use client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faDownload, faCircleInfo, faFileCode } from '@fortawesome/free-solid-svg-icons';
import { Toggle } from '@/modules/ui/Toggle';
import { Button } from '@/modules/ui/Button';
import { RulesetEditor } from '@/modules/app/RulesetEditor/RulesetEditor';
import type { RulesetEditorRef, RulesetGraph } from '@/modules/app/RulesetEditor/RulesetEditor';
import { DEMO_CATALOG, DEMO_CHOICES, DEMO_FLOW } from '@/modules/app/RulesetEditor/demo';
import { buildExport, buildRoltekExport } from '@/modules/app/RulesetEditor/transfer';
import type { RuleChain } from '@/modules/domains/iot/types';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { downloadText } from '../_components/download';

const INITIAL: RulesetGraph = {
  nodes: DEMO_FLOW.nodes, edges: DEMO_FLOW.edges, groups: DEMO_FLOW.groups ?? [],
};

/** a fixed date, so the file shown while you edit does not change by itself */
const FILE_DATE = new Date('2026-10-04T09:00:00Z');

/** what to try, one line per feature */
const TRY: { title: string; text: string }[] = [
  { title: 'Typed blocks', text: 'The palette lists the blocks of a catalog, grouped. Search it, or right-click the canvas for “Add a block here…”.' },
  { title: 'Param forms', text: 'Click “Schedule” (add one first) or “Too hot?”. Fields come from the block schema; change “Mode” and others appear or go.' },
  { title: 'Validation', text: 'The orange badge on “Tell the operator” is a required param with no value. Switch “Chain is active” on: it becomes an error.' },
  { title: 'Undo / redo', text: 'Move a node, delete it, then Ctrl+Z, Ctrl+Y (or the buttons bottom right). A whole drag is one step.' },
  { title: 'Multi-select', text: 'Shift or Ctrl click nodes, or Ctrl+A. Drag moves them together; Delete, Ctrl+C, Ctrl+X, Ctrl+V work on all of them.' },
  { title: 'Arrange', text: 'Scatter the blocks, then press the diagram button in the zoom bar (or right-click the canvas, “Arrange the blocks”). It is one undo step.' },
  { title: 'Box select', text: 'Hold Shift or Ctrl and drag on the empty canvas to draw a frame around blocks. On touch, use the frame button in the zoom bar.' },
  { title: 'Snap and guides', text: 'Drag a block near another: it snaps to the grid and to the edges of its neighbours, with a guide line. Hold Alt to move freely.' },
  { title: 'Mini map', text: 'The binoculars button in the zoom bar shows an overview of 180 x 120. It also appears when blocks leave the view.' },
  { title: 'Groups', text: 'Select two nodes, right-click, “Group…”. Drag the name tab to move the members, double-click it to rename or recolour.' },
  { title: 'Flows that run each other', text: 'Click “Escalate” (a Run flow block at the end of a chain): its Flow param picks the flow to run. Every flow has one fixed Flow input block, so any flow can be run; it cannot be added, copied or deleted.' },
  { title: 'Error paths', text: 'The dashed line from the bottom of “Too hot?” is its error port; drag from that small ring to wire one.' },
  { title: 'The file', text: 'Open “Show file” to see roltek-automation-1 as you edit. Secrets are left out of downloads.' },
];

export default function CatalogDemoPage() {
  const editorRef = useRef<RulesetEditorRef>(null);
  const [graph, setGraph] = useState<RulesetGraph>(INITIAL);
  const [active, setActive] = useState(false);
  const [showFile, setShowFile] = useState(false);
  const [showTry, setShowTry] = useState(true);

  const chain: RuleChain = useMemo(
    () => ({ chainId: 'boiler-demo', name: 'Boiler demo', slug: 'boiler-demo', active, ...graph }),
    [graph, active],
  );
  const roltek = useMemo(() => (showFile ? buildRoltekExport([chain], { catalog: DEMO_CATALOG, now: FILE_DATE }) : null), [chain, showFile]);

  function download(format: 'roltek' | 'kui') {
    const r = format === 'roltek' ? buildRoltekExport([chain], { catalog: DEMO_CATALOG }) : buildExport([chain]);
    downloadText(r.fileName, r.json);
  }

  return (
    <>
      <DocumentTitle text="Block catalog demo — IoT Theme" />
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface-base px-4 py-2.5">
          <Link href="/theme/iot/rulesets"
            className="inline-flex items-center gap-1.5 rounded text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Rulesets</span>
            <span className="sr-only sm:hidden">Back to rulesets</span>
          </Link>
          <span className="text-border-strong" aria-hidden="true">·</span>
          <h1 className="min-w-0 truncate text-sm font-semibold text-text-primary">Block catalog demo</h1>
          <span className="hidden text-xs text-text-secondary md:block" role="status">
            {graph.nodes.length} nodes · {graph.edges.length} edges · {graph.groups.length} {graph.groups.length === 1 ? 'group' : 'groups'}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Toggle id="demo-active" label="Chain is active" size="sm" checked={active} onChange={setActive} />
            <Button variant="outline" size="sm" onClick={() => setShowFile((v) => !v)} aria-pressed={showFile}>
              <FontAwesomeIcon icon={faFileCode} className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{showFile ? 'Hide file' : 'Show file'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => download('kui')} title="Download kui-ruleset-1">
              <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">kui-ruleset-1</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => download('roltek')} title="Download roltek-automation-1">
              <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">roltek-automation-1</span>
            </Button>
          </div>
        </div>

        {showTry && (
          <div className="shrink-0 border-b border-border bg-surface-raised px-4 py-2">
            <div className="flex items-start gap-2">
              <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 h-3 w-3 shrink-0 text-text-secondary" aria-hidden="true" />
              <ul className="grid flex-1 gap-x-6 gap-y-1 text-[11px] text-text-secondary md:grid-cols-2 xl:grid-cols-3">
                {TRY.map((t) => (
                  <li key={t.title}><span className="font-semibold text-text-primary">{t.title}.</span> {t.text}</li>
                ))}
              </ul>
              <button type="button" onClick={() => setShowTry(false)}
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                Hide
              </button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <RulesetEditor
              ref={editorRef}
              initialNodes={INITIAL.nodes}
              initialEdges={INITIAL.edges}
              initialGroups={INITIAL.groups}
              flowId="boiler-demo"
              catalog={DEMO_CATALOG}
              choices={DEMO_CHOICES}
              active={active}
              chainName="Boiler demo"
              onChange={setGraph}
              className="h-full"
            />
          </div>
          {roltek && (
            <aside aria-label="roltek-automation-1 file" className="hidden w-96 shrink-0 flex-col border-l border-border bg-surface-raised lg:flex">
              <p className="border-b border-border px-3 py-2 text-xs font-semibold text-text-secondary">
                roltek-automation-1 · {roltek.json.length.toLocaleString('en-GB')} characters
                {roltek.omitted.length > 0 && ` · ${roltek.omitted.length} secret left out`}
              </p>
              <pre tabIndex={0} className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus">
                {roltek.json}
              </pre>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
