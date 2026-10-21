'use client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { FlowWorkspace, type FlowWorkspaceRef } from '@/modules/app/RulesetEditor/RulesetEditor/workspace/FlowWorkspace';
import type { ConflictInfo, WorkspaceFlow } from '@/modules/app/RulesetEditor/RulesetEditor/workspace/types';
import type { RulesetGraph } from '@/modules/app/RulesetEditor/RulesetEditor';
import { catalogFromBlocks, FLOW_BLOCKS } from '@/modules/app/RulesetEditor/catalog';
import type { RuleNode } from '@/modules/domains/iot/types';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';

const CATALOG = catalogFromBlocks([[
  { type: 'trigger.link_in', group: 'input', icon: 'link', title: 'Link in', summary: '${name}', params: { name: { type: 'string', required: true } } },
  { type: 'action.link_out', group: 'output', icon: 'link', title: 'Link out', summary: '${targets}', outputs: [], params: { targets: { type: 'list', label: 'Link names' } } },
  { type: 'logic.link_call', group: 'function', icon: 'link', title: 'Link call', summary: '${target}', params: { target: { type: 'string', required: true } } },
  { type: 'logic.step', group: 'function', icon: 'gear', title: 'Step', summary: '${text}', params: { text: { type: 'string', default: 'Do something' } } },
], FLOW_BLOCKS]);

const node = (nodeId: string, type: string, label: string, x: number, y: number, config: Record<string, unknown> = {}): RuleNode => ({ nodeId, type, label, x, y, config });
const wire = (id: string, a: string, b: string) => ({ edgeId: id, sourceNodeId: a, sourcePort: 'out', targetNodeId: b, targetPort: 'in' });

type Stored = { id: string; name: string; rev: number; graph: RulesetGraph };

const SEED: Stored[] = [
  {
    id: 'morning', name: 'Morning routine', rev: 1,
    graph: {
      nodes: [node('a1', 'logic.step', 'Open the blinds', 40, 60), node('a2', 'action.link_out', 'To the alarm check', 300, 60, { targets: ['alarm-check'] }), node('a3', 'trigger.link_in', 'Back from the alarm', 40, 220, { name: 'morning-again' }), node('a4', 'action.flow_run', 'Run the helper', 300, 160, { flow: 'helper' })],
      edges: [wire('e1', 'a1', 'a2'), wire('e2', 'a1', 'a4')], groups: [],
    },
  },
  {
    id: 'alarm', name: 'Alarm', rev: 1,
    graph: {
      nodes: [node('b1', 'trigger.link_in', 'Alarm check', 40, 60, { name: 'alarm-check' }), node('b2', 'logic.step', 'Is anyone home?', 300, 60), node('b3', 'logic.link_call', 'Ask the morning flow', 560, 60, { target: 'morning-again' })],
      edges: [wire('e1', 'b1', 'b2'), wire('e2', 'b2', 'b3')], groups: [],
    },
  },
  {
    id: 'helper', name: 'Helper', rev: 1,
    graph: { nodes: [node('c0', 'trigger.flow_input', 'Flow input', 40, 60), node('c1', 'logic.step', 'Helper step', 300, 60), node('c2', 'action.link_out', 'To the alarm check', 560, 60, { targets: ['alarm-check'] })], edges: [wire('e0', 'c0', 'c1'), wire('e1', 'c1', 'c2')], groups: [] },
  },
];

const TRY: string[] = [
  'Change something, then open another flow from the list above: the change comes back as a draft banner when you return.',
  'Right-click “To the alarm check” and choose “Go to the link in”: the “Alarm” flow opens with that block selected. On “Alarm check”, “Show the blocks that call it” lists both callers.',
  'Right-click “Run the helper” and choose “Go to the Flow input of that flow”: the “Helper” flow opens. Open the block panel of a Run flow block: its flow list holds the flows that have a Flow input block (here only “Helper”).',
  'Edit “Morning routine”, press “Someone else saves”, then “Save”: the conflict dialog opens. “Merge” keeps both sides and is one undo step.',
];

/** A host with in-memory flows, to try drafts, link jumps and the three-way merge. The flow list stands for the host's own list page. */
export default function WorkspaceDemoPage() {
  const wsRef = useRef<FlowWorkspaceRef>(null);
  const [server, setServer] = useState<Stored[]>(SEED);
  const [open, setOpen] = useState<{ id: string; nodeId?: string }>({ id: 'morning' });
  const [openedRev, setOpenedRev] = useState(1);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const seq = useRef(0);

  const current = server.find((f) => f.id === open.id) ?? server[0];
  const flows: WorkspaceFlow[] = useMemo(() => server.map(({ id, name }) => ({ id, name })), [server]);

  function show(id: string, nodeId?: string) {
    const f = server.find((s) => s.id === id);
    if (!f) return;
    setOpen({ id, nodeId });
    setOpenedRev(f.rev);
    setConflict(null);
    setMessage('');
  }

  function save() {
    const g = wsRef.current?.getGraph();
    if (!g) return;
    if (current.rev !== openedRev) { setConflict({ at: Math.floor(Date.now() / 1000), by: 'another user' }); return; }
    setServer((s) => s.map((f) => (f === current ? { ...f, graph: g, rev: f.rev + 1 } : f)));
    setOpenedRev(current.rev + 1);
    wsRef.current?.markSaved(g);
    setMessage('Saved.');
  }

  function someoneElseSaves() {
    const n = ++seq.current;
    const extra = node(`x${n}`, 'logic.step', `Added elsewhere ${n}`, 40 + n * 40, 380);
    setServer((s) => s.map((f) => (f === current ? { ...f, graph: { ...f.graph, nodes: [...f.graph.nodes, extra] }, rev: f.rev + 1 } : f)));
    setMessage('Another user saved this flow. Save yours to see the conflict.');
  }

  /** the host's list: keep the draft of what is open, then open the other flow */
  function openFromList(f: Stored) {
    if (!wsRef.current?.keepDraft()) { setMessage('Save or undo your changes first: this browser cannot keep a draft.'); return; }
    show(f.id);
  }

  return (
    <main className="mx-auto flex h-screen max-w-7xl flex-col p-4">
      <DocumentTitle text="Flow workspace demo — IoT Theme" />
      <Link href="/theme/iot/rulesets" className="mb-2 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" aria-hidden="true" /> Rulesets
      </Link>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold text-text-primary">Flow workspace</h1>
        <Button size="sm" onClick={save} data-testid="ws-demo-save">Save{dirty ? ' *' : ''}</Button>
        <Button size="sm" variant="outline" onClick={someoneElseSaves}>Someone else saves</Button>
        {message && <span className="text-xs text-text-secondary" role="status">{message}</span>}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2" aria-label="Flows">
        {server.map((f) => (
          <Button key={f.id} size="sm" variant={f === current ? 'primary' : 'outline'} onClick={() => openFromList(f)} data-testid={`ws-demo-open-${f.id}`}>{f.name}</Button>
        ))}
      </div>
      <ul className="mb-2 list-disc pl-5 text-xs text-text-secondary">{TRY.map((t) => <li key={t}>{t}</li>)}</ul>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        <FlowWorkspace
          ref={wsRef}
          catalog={CATALOG}
          flows={flows}
          flow={{ id: current.id, name: current.name, graph: current.graph }}
          focusNodeId={open.nodeId}
          onOpen={(t, o) => show(t.id, o?.nodeId)}
          loadFlows={async (ids) => server.filter((f) => ids.includes(f.id)).map((f) => ({ id: f.id, name: f.name, nodes: f.graph.nodes }))}
          loadFlow={async (id) => { const f = server.find((s) => s.id === id); return f ? { name: f.name, graph: f.graph } : null; }}
          conflict={conflict}
          conflictActions={<Button size="sm" variant="outline" onClick={() => { setOpenedRev(current.rev); setConflict(null); setMessage('Overwrite: the next Save replaces their version.'); }}>Overwrite</Button>}
          onConflictClose={() => setConflict(null)}
          onMerged={() => { setOpenedRev(current.rev); setMessage('Merged. Review the result, then Save.'); }}
          onDirtyChange={setDirty}
        />
      </div>
    </main>
  );
}
