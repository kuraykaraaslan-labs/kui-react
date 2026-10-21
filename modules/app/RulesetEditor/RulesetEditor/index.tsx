'use client';
import { lazy, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPenToSquare, faBug, faClone, faCopy, faPaste, faTrash, faExpand, faPlus, faScissors, faObjectGroup, faObjectUngroup,
  faKeyboard, faNoteSticky, faRightLeft, faLayerGroup, faRotateLeft, faRotateRight, faSquareCheck, faEyeSlash, faDiagramProject, faMagnifyingGlassPlus,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { RuleNode, RuleEdge, RuleGroup, RuleSubflow } from '../types';
import { BUILTIN_CATALOG } from '../catalog/builtin';
import { paletteGroups } from '../catalog/palette';
import type { Catalog, ParamChoices } from '../catalog/types';
import { addGroup, groupOf, ungroup, updateGroup } from '../graph/groups';
import { changeEdgePort, edgeSourcePorts, insertOnEdge, newNode, placeNodes, pruneEdges, removeEdge, removeNodes, toggleDisabled, updateNode, type Point } from '../graph/edit';
import { autoLayout } from '../graph/layout';
import { mergeSelection } from '../graph/boxselect';
import { copySelection, duplicateNodes, parseClip, pasteClip, serializeClip, type ClipPayload } from '../graph/clipboard';
import { stable } from '../graph/history';
import { nodeName } from '../graph/names';
import { MessagesProvider, useMergedMessages, type EditorMessages } from './messages';
import { secretTestOf } from '../graph/scrub';
import { newId } from '../graph/ids';
import { applySubflowSettings, deleteSubflow, newSubflow, scopeExists, subflowUsers, withCurrentGraph } from '../graph/state';
import { catalogWithSubflows, DEFAULT_SUBFLOW_DEPTH, fromSelection, nestProblem, placementProblem, subflowMap } from '../graph/subflows';
import { subflowIdOf } from '../graph/types';
import { issuesByNode, validateGraph, type ValidationResult } from '../graph/validate';
import { defaultScriptOf, formValues, setField, splitFormValues } from '../forms/field-utils';
import { Palette } from './canvas/Palette';
import { Canvas } from './canvas/Canvas';
import { IssuesPanel, ScopeBar } from './canvas/Overlays';
import type { RuleNodeStatus } from './canvas/RuleNode';
import type { CanvasDiffTint } from '../graph/diff-view';
import { ContextMenu, type ContextMenuItem } from './canvas/ContextMenu';
import { MiniMap } from './canvas/MiniMap';
import { SelectionFrame } from './canvas/SelectionFrame';
import { lookOf } from './block-visual';
import { NodeEditorPanel, type ParamEditorProps } from './panels/NodeEditorPanel';
import type { NodeMessage } from './panels/NodeMessages';
import { ScriptTestDialog, type ScriptTestRequest, type ScriptTestResult, type ScriptTestSample } from './dialogs/ScriptTestDialog';
import { SCRIPT_API } from './script/api';
import { InsightPanel, type InsightPanelProps, type InsightSlot } from './insight/InsightPanel';
import type { DeployProblem } from './insight/ErrorsTab';

/* the debug modals run the stored scripts of the chain in the browser (`new Function`): loaded only when the editor offers them */
const NodeDebugModal = lazy(() => import('./modals/NodeDebugModal').then((m) => ({ default: m.NodeDebugModal })));
const RulesetDebugModal = lazy(() => import('./modals/RulesetDebugModal').then((m) => ({ default: m.RulesetDebugModal })));
import { BlockPickerDialog } from './dialogs/BlockPickerDialog';
import { GroupDialog } from './dialogs/GroupDialog';
import { NameDialog } from './dialogs/NameDialog';
import { SubflowSettingsDialog } from './dialogs/SubflowSettingsDialog';
import { useGraphEditor, type RulesetGraph } from './hooks/useGraphEditor';
import { useNodeDrag } from './hooks/useNodeDrag';
import { useEdgeConnect } from './hooks/useEdgeConnect';
import { useEdgeRewire } from './hooks/useEdgeRewire';
import { useEdgePulse } from './hooks/useEdgePulse';
import { edgeActivityOf, type CanvasActivity } from '../graph/activity';
import { usePaletteDrop } from './hooks/usePaletteDrop';
import { useSnapDrag } from './hooks/useSnapDrag';
import { useBoxSelect } from './hooks/useBoxSelect';
import { useMiniMap } from './hooks/useMiniMap';
import { FULLSCREEN_CLASSES, useFullscreen } from './hooks/useFullscreen';
import { hintOf, isMac, shortcutOf, type ShortcutId } from './shortcuts';
import { ShortcutsDialog } from './dialogs/ShortcutsDialog';
import { PortDialog } from './dialogs/PortDialog';
import { NOTE_TYPE, withNoteBlock } from '../catalog/note';
import { FindBar } from './canvas/FindBar';
import { findNodes } from '../graph/search';
import { NODE_HEADER_H, NODE_W, ZOOM_MIN, ZOOM_MAX, inputAnchor, layoutOf, outputAnchor, revealView, type NodeLayout, type View, type Point as ViewPoint } from './geometry';

export type { RuleNodeStatus, RulesetGraph, ContextMenuItem, ParamEditorProps };

/**
 * The editor's single side bar (the router's, debug comparison item 6): the InsightPanel with the node panel as its Block
 * tab (Settings and Messages) and Help tab, the host's Trace and Runs, and the Debug, Errors, Data and Busiest tabs fed
 * by these props. Opening a block shows the bar on Block. The Errors tab lists the editor's own validation errors first,
 * then the host's `deployProblems` (a pre-flight).
 */
export type RulesetSideBar = Omit<InsightPanelProps, 'slots' | 'onReveal' | 'selectedNodeId' | 'tab' | 'onTabChange' | 'uiMessages' | 'className' | 'onClose' | 'nodeNames'> & {
  /** names of the blocks for the panel; default: what the canvas shows */
  nodeNames?: Record<string, string>;
  /** the Trace tab (the host's trace player); no tab without it */
  traceTab?: InsightSlot;
  /** the Runs tab (e.g. kui `RunsPanel` over the host's run records); no tab without it */
  runsTab?: InsightSlot;
  /** is the bar shown (default true); the editor shows it anyway while a block is open */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tab?: string;
  onTabChange?: (tab: string) => void;
  /** a block was picked in the bar (a link in Debug, Errors, Busiest): the editor selects and shows it; this is told too */
  onReveal?: (nodeId: string) => void;
};

/** what the panel edits of a node, as one comparable text */
const nodeSnap = (n: RuleNode) => stable([n.label, n.description ?? null, n.config ?? null, n.script ?? null]);

/* ─── Public ref API ──────────────────────────────────────────────────────── */

export type RulesetEditorRef = {
  openRulesetDebug: () => void;
  fit: () => void;
  /** the current graph, e.g. to save it: nodes and edges of the chain, its groups and the subflows */
  getGraph: () => RulesetGraph;
  undo: () => void;
  redo: () => void;
  /** the problems found in the graph on the canvas (the chain, or the subflow being edited) */
  validate: () => ValidationResult;
  /** auto layout of the blocks on the canvas, one undo step; false when nothing moved (or read only) */
  arrange: () => boolean;
  /** select these blocks (ids that are not on the canvas are ignored) */
  select: (ids: string[]) => void;
  /** pan (and zoom out if needed) until these blocks are in view; nothing happens when they already are */
  reveal: (ids: string | string[]) => void;
  /** replace the whole graph as ONE undo step (a merge, a restored draft); leaves a subflow that is gone */
  replaceGraph: (graph: RulesetGraph, options?: { key?: string; fit?: boolean }) => void;
  /** ids of the selected blocks, the last one picked last */
  getSelection: () => string[];
};

/** what `nodeMenuItems` is asked */
export type NodeMenuContext = { nodeIds: string[]; readOnly: boolean };

export type RulesetEditorProps = {
  initialNodes?: RuleNode[];
  initialEdges?: RuleEdge[];
  initialGroups?: RuleGroup[];
  initialSubflows?: RuleSubflow[];
  /** the blocks the editor offers; the ten built-in node types by default */
  catalog?: Catalog;
  /** the lists a `source` or `list` field offers (devices, brokers …) */
  choices?: ParamChoices;
  /**
   * The host's own param editors, by block type: the node panel shows the editor of the edited block's type in place of the
   * generated form (a block type without one keeps the form). An editor replaces the params as a whole through `onChange`.
   */
  paramEditors?: Record<string, React.ComponentType<ParamEditorProps>>;
  /**
   * Blocks of the catalog the host cannot run right now (a missing module, a feature the plan does not have), by type,
   * with the reason. The palette, the block picker and the canvas menu show them greyed out with the reason as their
   * hint and do not add them. Blocks already on the canvas stay as they are.
   */
  unavailable?: Record<string, string>;
  /** the words of the editor chrome, to translate it; what is not given stays English (see `messages.tsx`) */
  messages?: Partial<EditorMessages>;
  /**
   * Ctrl+S (⌘+S) anywhere in the editor, its panel included (not in a dialog), calls this and keeps the browser from
   * saving the page. `valid` is false while the graph has errors, so the host can show them instead of deploying.
   * Without it the keys are left to the browser; a read-only editor never calls it.
   */
  onSave?: (state: { valid: boolean }) => void;
  /** the chain is switched on: a missing required param is then an error, otherwise a warning */
  active?: boolean;
  /** how deep subflows may be nested (default `DEFAULT_SUBFLOW_DEPTH`, 4) */
  subflowDepthLimit?: number;
  /** called after every change that is a step of the undo history, and after undo and redo */
  onChange?: (graph: RulesetGraph) => void;
  readOnly?: boolean;
  /**
   * Offer "Debug node" and "Debug chain", which run the scripts of the chain in this browser (`new Function`). On by
   * default; never offered when `readOnly` (a viewer's browser does not run stored scripts). A host with a real
   * engine passes `false`: the runner is then not even loaded.
   */
  browserDebug?: boolean;
  className?: string;
  chainName?: string;
  /** live state per node id, shown under the node (e.g. from a running chain) */
  nodeStatus?: Record<string, RuleNodeStatus>;
  /**
   * Live traffic from the host (a socket, a poll): counters per connection and per block. A connection whose counter goes
   * up lights up (at most twice a second); hovering a connection shows its count, hovering a block its in / out / errors,
   * and the node panel shows them too. A connection the host does not list takes the count of its source port.
   */
  activity?: CanvasActivity;
  /**
   * The recent messages through each block, by block id (UI-33): the node panel gets a Messages tab with them, newest first,
   * and the block's counters from `activity`. Without it there is no Messages tab.
   */
  nodeMessages?: Record<string, NodeMessage[]>;
  /** the viewer may see message bodies (the host's permission); otherwise the Messages tab shows times, ports and runs only */
  messageBodies?: boolean;
  /** "Test with this input" on a message a block received (only offered with `messageBodies`) */
  onTestMessage?: (nodeId: string, message: NodeMessage) => void;
  /**
   * Runs the code of a block with an automation script on one message (06 §6.7): the node panel offers "Test script", a pane
   * with the code, the message and the result; its Save writes the edited code back into the block (one undo step).
   */
  onScriptTest?: (request: ScriptTestRequest) => Promise<ScriptTestResult>;
  /** what the script test pane starts with for a block (the block sample, its last input) */
  scriptTestSample?: (nodeId: string) => ScriptTestSample | undefined;
  /** one side bar for the node panel and the runtime insight (see `RulesetSideBar`); without it the node panel stands alone */
  sideBar?: RulesetSideBar;
  /**
   * A version compare: blocks and connections tinted as added, changed or removed (`diffTints(diffGraphs(a, b))`, or
   * `diffView(a, b).tint` with its graph, which also shows what was removed). Usually with `readOnly`.
   */
  diffTint?: CanvasDiffTint;
  /** called when the selection of blocks changes, with their ids */
  onSelectionChange?: (ids: string[]) => void;
  /** more entries for the menu of a block (right click, long press); `label`s must be unique in the menu */
  nodeMenuItems?: (context: NodeMenuContext) => ContextMenuItem[];
  /** extra controls at the start of the zoom bar (bottom right of the canvas) */
  toolbarExtra?: React.ReactNode;
  /** a bar above the canvas (e.g. "a draft was kept"), full width of the canvas column */
  bannerSlot?: React.ReactNode;
  ref?: React.Ref<RulesetEditorRef>;
};

const CLIP_KEY = 'kui-ruleset-clipboard';
/** with this many blocks or fewer the canvas menu lists them all; with more it opens a picker */
const INLINE_ADD_LIMIT = 12;

function storeClip(clip: ClipPayload) {
  const text = serializeClip(clip);
  try { window.localStorage.setItem(CLIP_KEY, text); } catch { /* storage may be blocked */ }
  try { void navigator.clipboard?.writeText(text).catch(() => undefined); } catch { /* no clipboard access */ }
}

function loadClip(): ClipPayload | null {
  try { return parseClip(window.localStorage.getItem(CLIP_KEY)); } catch { return null; }
}

type Picker = { title: string; onPick: (type: string) => void };
type GroupEdit = { kind: 'new'; ids: string[] } | { kind: 'edit'; groupId: string };

export function RulesetEditor({
  initialNodes = [], initialEdges = [], initialGroups, initialSubflows,
  catalog: catalogProp, choices, paramEditors, unavailable, messages, onSave, active = false, subflowDepthLimit = DEFAULT_SUBFLOW_DEPTH, onChange,
  readOnly = false, browserDebug = true, className, chainName = 'Rule Chain', nodeStatus, activity, nodeMessages, messageBodies = false, onTestMessage, onScriptTest, scriptTestSample, sideBar, diffTint, onSelectionChange, nodeMenuItems, toolbarExtra, bannerSlot, ref,
}: RulesetEditorProps) {
  const m = useMergedMessages(messages);
  const ed = useGraphEditor({ nodes: initialNodes, edges: initialEdges, groups: initialGroups ?? [], subflows: initialSubflows ?? [] }, onChange);
  const { nodes, edges, groups } = ed.graph;
  const canDebug = browserDebug && !readOnly;

  /* the catalog: the base one, the subflows as blocks, and inside a subflow its own ports */
  const baseCatalog = useMemo(() => withNoteBlock(catalogProp ?? BUILTIN_CATALOG), [catalogProp]);
  const scopeSubflow = ed.scope ? ed.state.subflows.find((s) => s.subflowId === ed.scope) : undefined;
  const catalog = useMemo(
    () => catalogWithSubflows(baseCatalog, ed.state.subflows, scopeSubflow ? { subflowId: scopeSubflow.subflowId, outputs: scopeSubflow.outputs } : undefined),
    [baseCatalog, ed.state.subflows, scopeSubflow],
  );
  const layouts = useMemo(() => new Map<string, NodeLayout>(nodes.map((n) => [n.nodeId, layoutOf(n, catalog)])), [nodes, catalog]);

  /* what is wrong with the graph on the canvas (keyed on its lists: `ed.graph` is a new object on every render) */
  const validation = useMemo(() => {
    const subs = subflowMap(ed.state.subflows);
    return validateGraph({ nodes, edges }, catalog, {
      active,
      message: m.issueText,
      subflow: scopeSubflow ? { inputs: scopeSubflow.inputs, outputs: scopeSubflow.outputs } : undefined,
      nest: (id) => (scopeSubflow ? nestProblem(subs, scopeSubflow.subflowId, id, subflowDepthLimit) : placementProblem(subs, id, subflowDepthLimit)),
    });
  }, [nodes, edges, ed.state.subflows, catalog, active, scopeSubflow, subflowDepthLimit, m.issueText]);
  const issues = useMemo(() => issuesByNode(validation), [validation]);

  const [find, setFind] = useState<{ query: string; index: number } | null>(null);
  const [findTick, setFindTick] = useState(0);
  /* the find box: the blocks that match, in the order of the graph */
  const found = useMemo(() => (find ? findNodes(nodes, find.query, catalog) : []), [find, nodes, catalog]);
  const foundIndex = found.length ? Math.min(find?.index ?? 0, found.length - 1) : 0;
  const searchState = useMemo(() => (find?.query.trim() ? { matches: new Set(found), current: found[foundIndex] ?? null } : null), [find, found, foundIndex]);

  /* selection: nodes in the order they were picked (the last one is the primary), and one connection */
  const [selectedList, setSelectedList] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.nodeId)), [nodes]);
  const selection = useMemo(() => selectedList.filter((id) => nodeIds.has(id)), [selectedList, nodeIds]);
  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const primaryId = selection.at(-1) ?? null;
  const onSelectionRef = useRef(onSelectionChange);
  useEffect(() => { onSelectionRef.current = onSelectionChange; });
  const lastSelection = useRef('');
  useEffect(() => {
    const key = selection.join(' ');
    if (key === lastSelection.current) return;
    lastSelection.current = key;
    onSelectionRef.current?.(selection);
  }, [selection]);

  const [view, setView]           = useState<View>({ x: 0, y: 0, k: 1 });
  const [mouse, setMouse]         = useState({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel]       = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftValues, setDraftValues]     = useState<Record<string, unknown>>({});
  const [showRequired, setShowRequired]   = useState(false);
  const [shortcutsOpen, setShortcutsOpen]   = useState(false);
  const [portEditEdge, setPortEditEdge]     = useState<string | null>(null);
  const hint = (id: ShortcutId) => hintOf(id, isMac());
  const panelSnap = useRef<string | null>(null);
  const panelDraft = useRef<{ label: string; description: string; values: Record<string, unknown> }>({ label: '', description: '', values: {} });
  const [debugNodeId, setDebugNodeId]     = useState<string | null>(null);
  const [rulesetDebugOpen, setRulesetDebugOpen] = useState(false);
  const [dbgMsg,     setDbgMsg]     = useState('{\n  "temperature": 92,\n  "humidity": 65\n}');
  const [dbgMeta,    setDbgMeta]    = useState('{\n  "deviceId": "dev-001",\n  "zone": "A"\n}');
  const [dbgMsgType, setDbgMsgType] = useState('POST_TELEMETRY_REQUEST');
  const [picker, setPicker]         = useState<Picker | null>(null);
  const [groupEdit, setGroupEdit]   = useState<GroupEdit | null>(null);
  const [convertIds, setConvertIds] = useState<string[] | null>(null);
  const [newSubflowOpen, setNewSubflowOpen] = useState(false);
  const [scriptTest, setScriptTest] = useState<{ nodeId: string; key: string; code: string } | null>(null);
  const [sideShownOwn, setSideShown] = useState(true);
  const sideShown = sideBar?.open ?? sideShownOwn;
  const [sideTabOwn, setSideTabOwn] = useState<string>(sideBar?.defaultTab ?? 'block');
  const sideTab = sideBar?.tab ?? sideTabOwn;
  const setSideTab = (t: string) => { setSideTabOwn(t); sideBar?.onTabChange?.(t); };
  const [settingsOpen, setSettingsOpen]     = useState(false);

  const containerRef  = useRef<HTMLDivElement>(null);
  const rootRef        = useRef<HTMLDivElement>(null);
  /* the whole workspace goes fullscreen when the editor sits in one (tabs and banners with it) */
  const fullscreen = useFullscreen(() => rootRef.current?.closest<HTMLElement>('[data-ruleset-workspace]') ?? rootRef.current);
  const pan           = useRef<{ cx: number; cy: number; vx: number; vy: number; moved: boolean } | null>(null);
  /* context menu (right click, long press), clipboard, phone palette sheet, pinch */
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const clipRef = useRef<ClipPayload | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const longPress     = useRef<{ timer: number; x: number; y: number } | null>(null);
  const pointers      = useRef(new Map<number, ViewPoint>());
  const pinch         = useRef<{ d0: number; k0: number; vx: number; vy: number; cx: number; cy: number } | null>(null);

  /* screen → world (pan and zoom) */
  function toWorld(clientX: number, clientY: number): Point {
    const r = containerRef.current?.getBoundingClientRect();
    return r ? { x: (clientX - r.left - view.x) / view.k, y: (clientY - r.top - view.y) / view.k } : { x: 0, y: 0 };
  }

  function centerWorld(): Point {
    const r = containerRef.current?.getBoundingClientRect();
    return r ? toWorld(r.left + r.width / 2, r.top + r.height / 2) : { x: 0, y: 0 };
  }

  function zoomAt(factor: number, cx?: number, cy?: number) {
    const r = containerRef.current?.getBoundingClientRect();
    const px = cx ?? (r ? r.width / 2 : 0), py = cy ?? (r ? r.height / 2 : 0);
    setView((v) => {
      const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * factor));
      return { k, x: px - (px - v.x) * k / v.k, y: py - (py - v.y) * k / v.k };
    });
  }

  function fit() {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r || !nodes.length) { setView({ x: 0, y: 0, k: 1 }); return; }
    const x0 = Math.min(...nodes.map((n) => n.x)), y0 = Math.min(...nodes.map((n) => n.y));
    const x1 = Math.max(...nodes.map((n) => n.x + NODE_W)), y1 = Math.max(...nodes.map((n) => n.y + (layouts.get(n.nodeId)?.height ?? 0)));
    const k = Math.min(1.2, Math.max(ZOOM_MIN, Math.min((r.width - 80) / (x1 - x0), (r.height - 80) / (y1 - y0))));
    setView({ k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k });
  }

  /* entering or leaving a subflow shows another graph: bring it into view */
  const fitRef = useRef(fit);
  useEffect(() => { fitRef.current = fit; });
  /* after an auto layout or a replaced graph the new positions are rendered first, then the view fits them */
  const [fitTick, setFitTick] = useState(0);
  useEffect(() => { if (fitTick) fitRef.current(); }, [fitTick]);
  const lastScope = useRef(ed.scope);
  useEffect(() => {
    if (lastScope.current === ed.scope) return;
    lastScope.current = ed.scope;
    fitRef.current();
  }, [ed.scope]);

  /* auto layout (one undo step); the view then fits the result */
  function arrange(): boolean {
    if (readOnly || !nodes.length) return false;
    const pos = autoLayout(nodes, edges, { w: NODE_W, h: (n) => layouts.get(n.nodeId)?.height ?? 0, gx: 72, gy: 28 });
    if (!nodes.some((n) => pos[n.nodeId] && (pos[n.nodeId].x !== n.x || pos[n.nodeId].y !== n.y))) return false;
    ed.apply((g) => placeNodes(g, pos));
    setFitTick((t) => t + 1);
    return true;
  }

  function reveal(ids: string | string[]) {
    const r = containerRef.current?.getBoundingClientRect();
    const list = Array.isArray(ids) ? ids : [ids];
    const boxes = nodes.filter((n) => list.includes(n.nodeId)).map((n) => ({ x: n.x, y: n.y, w: NODE_W, h: layouts.get(n.nodeId)?.height ?? 0 }));
    if (!r || !boxes.length) return;
    const next = revealView(boxes, view, { w: r.width, h: r.height });
    if (next) setView(next);
  }

  /** the mini map: put this world point in the middle of the canvas */
  function goTo(x: number, y: number) {
    const r = containerRef.current?.getBoundingClientRect();
    if (r) setView((v) => ({ ...v, x: r.width / 2 - x * v.k, y: r.height / 2 - y * v.k }));
  }

  function replaceGraph(graph: RulesetGraph, options?: { key?: string; fit?: boolean }) {
    ed.applyState(() => graph, options?.key);
    if (!scopeExists(graph, ed.scope)) ed.enter(null);
    if (options?.fit) setFitTick((t) => t + 1);
  }

  useImperativeHandle(ref, () => ({
    openRulesetDebug: () => { if (canDebug) setRulesetDebugOpen(true); },
    fit,
    getGraph: ed.getState,
    undo: ed.undo,
    redo: ed.redo,
    validate: () => validation,
    arrange,
    select: (ids) => { setSelectedList(ids.filter((id) => nodeIds.has(id))); setSelectedEdgeId(null); },
    reveal,
    replaceGraph,
    getSelection: () => selection,
  }));

  const heightOf = (nodeId: string) => layouts.get(nodeId)?.height ?? 0;
  const snap = useSnapDrag({ getNodes: () => ed.getGraph().nodes, heightOf, nodeWidth: NODE_W, getZoom: () => view.k });
  const box = useBoxSelect({
    containerRef, getNodes: () => ed.getGraph().nodes, heightOf, nodeWidth: NODE_W, getView: () => view,
    onSelect: (ids, add) => { setSelectedList((list) => mergeSelection(list, ids, add)); setSelectedEdgeId(null); },
  });
  const miniBoxes = useMemo(() => nodes.map((n) => ({ x: n.x, y: n.y, w: NODE_W, h: layouts.get(n.nodeId)?.height ?? 0 })), [nodes, layouts]);
  const mini = useMiniMap({ containerRef, boxes: miniBoxes, view });

  const edgeConnect  = useEdgeConnect({ getGraph: ed.getGraph, apply: ed.apply, catalog, readOnly, setMouse });
  const rewire       = useEdgeRewire({ getGraph: ed.getGraph, apply: ed.apply, catalog, readOnly, setMouse });
  const edgeAct      = useMemo(() => edgeActivityOf(edges, activity), [edges, activity]);
  const litEdges     = useEdgePulse(edgeAct);
  const nodeDrag     = useNodeDrag({ getGraph: ed.getGraph, setGraph: ed.setGraph, toWorld, readOnly, connecting: edgeConnect.connecting, resolve: snap.resolve, onEnd: snap.clear });
  const paletteDrop  = usePaletteDrop({ getGraph: ed.getGraph, apply: ed.apply, catalog, toWorld });

  /* ── selection ─────────────────────────────────────────────────────────── */

  function selectOnly(id: string | null) {
    setSelectedList(id ? [id] : []);
    setSelectedEdgeId(null);
  }

  function toggleSelect(id: string) {
    setSelectedList((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    setSelectedEdgeId(null);
  }

  function selectAll() {
    setSelectedList(nodes.map((n) => n.nodeId));
    setSelectedEdgeId(null);
  }

  /* ── the panel ─────────────────────────────────────────────────────────── */

  /* The panel writes through: every change of a field is a step of the undo history (typing in one field within a
     second is one step), there is no Apply. `panelSnap` is what the panel last wrote or loaded; when the node no
     longer matches it, undo, redo or another edit changed the node and the panel loads it again. */
  function openEditor(nodeId: string) {
    const node = nodes.find((n) => n.nodeId === nodeId);
    if (!node) return;
    if (sideBar) {
      // the router's bar: a picked block shows on the Block tab, and the bar comes up when it was closed
      if (sideTab !== 'block' && sideTab !== 'help') setSideTab('block');
      if (!sideShown) { setSideShown(true); sideBar.onOpenChange?.(true); }
    }
    setEditingNodeId(nodeId);
    loadPanel(node);
    setShowRequired(false);
  }

  function loadPanel(node: RuleNode) {
    const values = formValues(catalog.blocks[node.type]?.params, node.config, node.script);
    panelSnap.current = nodeSnap(node);
    panelDraft.current = { label: node.label, description: node.description ?? '', values };
    setDraftLabel(node.label);
    setDraftDescription(node.description ?? '');
    setDraftValues(values);
  }

  function writePanel(change: { label?: string; description?: string; values?: Record<string, unknown> }) {
    const { label, description, values } = { ...panelDraft.current, ...change };
    panelDraft.current = { label, description, values };
    setDraftLabel(label);
    setDraftDescription(description);
    setDraftValues(values);
    if (!editingNodeId || readOnly) return;
    const node = nodes.find((n) => n.nodeId === editingNodeId);
    if (!node) return;
    const { config, script } = splitFormValues(catalog.blocks[node.type]?.params, values);
    const patch: Partial<RuleNode> = {
      label: label.trim(),
      description: description.trim() ? description : undefined,
      ...(catalog.blocks[node.type] ? { config } : {}),
      ...(script !== undefined ? { script } : {}),
    };
    panelSnap.current = nodeSnap({ ...node, ...patch });
    setShowRequired(true);
    ed.apply((g) => pruneEdges(updateNode(g, node.nodeId, patch), catalog), `edit:${node.nodeId}`);
  }

  /* ── pointer handling ──────────────────────────────────────────────────── */

  function onNodePointerDown(e: React.PointerEvent, nodeId: string) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleSelect(nodeId);
      return;
    }
    setSelectedEdgeId(null);
    const inSelection = selectionSet.has(nodeId);
    if (!inSelection) setSelectedList([nodeId]);
    nodeDrag.start(e, inSelection ? selection : [nodeId], nodeId);
  }

  function onGroupTabPointerDown(e: React.PointerEvent, groupId: string) {
    const group = groups.find((g) => g.groupId === groupId);
    if (!group) return;
    e.stopPropagation();
    setSelectedEdgeId(null);
    setSelectedList(group.nodeIds);
    nodeDrag.start(e, group.nodeIds, null);
  }

  /* empty canvas: start panning (a click without moving clears the selection) */
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    containerRef.current?.focus({ preventScroll: true });
    // Shift / Ctrl / ⌘ (or the frame mode) on the empty canvas draws a selection frame instead of panning
    if (box.wants(e)) { box.start(e); return; }
    pan.current = { cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const lp = longPress.current;
    if (lp && Math.abs(e.clientX - lp.x) + Math.abs(e.clientY - lp.y) > 8) cancelLongPress();
    const pz = pinch.current;
    if (pz) {
      const [a, b] = Array.from(pointers.current.values());
      if (!a || !b) return;
      const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pz.k0 * Math.hypot(a.x - b.x, a.y - b.y) / pz.d0));
      setView({ k, x: pz.cx - (pz.cx - pz.vx) * k / pz.k0, y: pz.cy - (pz.cy - pz.vy) * k / pz.k0 });
      return;
    }
    if (box.move(e)) return;
    if (edgeConnect.connecting || rewire.rewiring) setMouse(toWorld(e.clientX, e.clientY));
    const p = pan.current;
    if (p && !nodeDrag.dragging && !edgeConnect.connecting && !rewire.rewiring) {
      p.moved ||= Math.abs(e.clientX - p.cx) + Math.abs(e.clientY - p.cy) > 3;
      setView((v) => ({ ...v, x: p.vx + e.clientX - p.cx, y: p.vy + e.clientY - p.cy }));
      return;
    }
    nodeDrag.applyPointerMove(e);
  }

  function onPointerUp(e: React.PointerEvent) {
    cancelLongPress();
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (!pointers.current.size) pinch.current = null;
      return;
    }
    if (box.end()) { pan.current = null; return; }
    const pressed = nodeDrag.dragNodeId;
    if (rewire.rewiring) rewire.finishAt(e.clientX, e.clientY);
    else if (edgeConnect.connecting) edgeConnect.finishAt(e.clientX, e.clientY);
    else if (pressed && !nodeDrag.dragMoved.current) {
      // a click on a node of a larger selection narrows the selection to it
      if (selection.length > 1) selectOnly(pressed);
      openEditor(pressed);
    }
    else if (!nodeDrag.dragging && pan.current && !pan.current.moved) selectOnly(null);
    // one history step for a whole drag
    if (nodeDrag.endDrag()) ed.commit('move');
    pan.current = null;
  }

  function onPointerCancel(e: React.PointerEvent) {
    box.cancel();
    onPointerUp(e);
  }

  function cancelLongPress() {
    if (longPress.current) { window.clearTimeout(longPress.current.timer); longPress.current = null; }
  }

  /* every pointer (nodes and ports too): two fingers pinch, a touch held still opens the menu */
  function onPointerDownCapture(e: React.PointerEvent) {
    // a press inside the menu is a click on one of its items: the menu must still be there for it
    if ((e.target as Element).closest('[role="menu"]')) return;
    setMenu(null);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      cancelLongPress();
      box.cancel();
      nodeDrag.endDrag();
      edgeConnect.clearConnecting();
      rewire.cancel();
      pan.current = null;
      const [a, b] = Array.from(pointers.current.values());
      const r = containerRef.current?.getBoundingClientRect();
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: view.k, vx: view.x, vy: view.y,
        cx: (a.x + b.x) / 2 - (r?.left ?? 0), cy: (a.y + b.y) / 2 - (r?.top ?? 0) };
      return;
    }
    if (e.pointerType === 'touch') {
      const x = e.clientX, y = e.clientY, target = e.target as Element;
      cancelLongPress();
      longPress.current = { x, y, timer: window.setTimeout(() => {
        longPress.current = null;
        nodeDrag.endDrag();
        edgeConnect.clearConnecting();
        pan.current = null;
        openMenu(x, y, target);
      }, 550) };
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    openMenu(e.clientX, e.clientY, e.target as Element);
  }

  /* ── editing ───────────────────────────────────────────────────────────── */

  function addProblem(type: string): string | null {
    if (unavailable?.[type]) return unavailable[type];
    if (type === 'port.in') {
      if (scopeSubflow?.inputs === 0) return m.problemSubflowNoInput;
      if (nodes.some((n) => n.type === 'port.in')) return m.problemSubflowOneInput;
    }
    const id = subflowIdOf(type);
    if (!id) return null;
    const subs = subflowMap(ed.state.subflows);
    const problem = scopeSubflow ? nestProblem(subs, scopeSubflow.subflowId, id, subflowDepthLimit) : placementProblem(subs, id, subflowDepthLimit);
    if (problem === 'cycle') return m.problemSubflowCycle;
    if (problem === 'depth') return m.problemSubflowTooDeep(subflowDepthLimit);
    return null;
  }

  function addAtCenter(type: string) {
    if (readOnly || addProblem(type)) return;
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const off = (nodes.length % 5) * 16;
    selectOnly(paletteDrop.addAt(type, toWorld(r.left + r.width / 2 + off, r.top + r.height / 2 + off)));
  }

  function deleteNodes(ids: string[]) {
    if (readOnly || !ids.length) return;
    ed.apply((g) => removeNodes(g, ids), 'delete');
    selectOnly(null);
    if (editingNodeId && ids.includes(editingNodeId)) setEditingNodeId(null);
    if (debugNodeId && ids.includes(debugNodeId)) setDebugNodeId(null);
  }

  function deleteEdge(edgeId: string) {
    ed.apply((g) => removeEdge(g, edgeId), 'delete-edge');
    setSelectedEdgeId(null);
  }

  function copyNodes(ids: string[]) {
    const clip = copySelection(ed.getGraph(), ids, secretTestOf(catalog));
    if (!clip) return;
    clipRef.current = clip;
    storeClip(clip);
  }

  function cutNodes(ids: string[]) {
    copyNodes(ids);
    deleteNodes(ids);
  }

  function paste(at: Point) {
    const clip = clipRef.current ?? loadClip();
    if (!clip || readOnly) return;
    const out = pasteClip(ed.getGraph(), clip, at, NODE_W);
    ed.apply(() => out.graph, 'paste');
    setSelectedList(out.ids);
    setSelectedEdgeId(null);
  }

  function duplicate(ids: string[]) {
    const out = duplicateNodes(ed.getGraph(), ids, undefined, secretTestOf(catalog));
    if (!out.ids.length) return;
    ed.apply(() => out.graph, 'duplicate');
    setSelectedList(out.ids);
  }

  function submitGroup(name: string, color: number) {
    const edit = groupEdit;
    setGroupEdit(null);
    if (!edit) return;
    if (edit.kind === 'new') ed.apply((g) => ({ ...g, groups: addGroup(g.groups, edit.ids, name, color).groups }), 'group');
    else ed.apply((g) => ({ ...g, groups: updateGroup(g.groups, edit.groupId, { name, color }) }), 'group');
  }

  function convertToSubflow(name: string) {
    const ids = convertIds;
    setConvertIds(null);
    if (!ids) return;
    const subflowId = newId(ed.state.subflows.map((s) => s.subflowId), name, 'subflow');
    const result = fromSelection(ed.getGraph(), ids, { subflowId, name, nodeWidth: NODE_W });
    if (!result) return;
    ed.applyState((s) => withCurrentGraph(
      { ...s, subflows: [...s.subflows, result.subflow] }, ed.scope, { nodes: result.nodes, edges: result.edges, groups: result.groups },
    ), 'to-subflow');
    selectOnly(result.instance);
    setEditingNodeId(null);
  }

  function createSubflow(name: string) {
    setNewSubflowOpen(false);
    const sf = newSubflow(ed.getState(), [], name);
    ed.applyState((s) => ({ ...s, subflows: [...s.subflows, sf] }), 'new-subflow');
    enterSubflow(sf.subflowId);
  }

  function enterSubflow(id: string | null) {
    ed.enter(id);
    selectOnly(null);
    setEditingNodeId(null);
    setDebugNodeId(null);
    setMenu(null);
  }

  /** put a node of a picked block in the middle of a connection */
  function insertOnConnection(edgeId: string) {
    const edge = edges.find((e) => e.edgeId === edgeId);
    const src = edge && nodes.find((n) => n.nodeId === edge.sourceNodeId);
    const tgt = edge && nodes.find((n) => n.nodeId === edge.targetNodeId);
    const sl = src && layouts.get(src.nodeId);
    const tl = tgt && layouts.get(tgt.nodeId);
    if (!edge || !src || !tgt || !sl || !tl) return;
    const from = outputAnchor(src, sl, edge.sourcePort);
    const to = inputAnchor(tgt, tl, Math.max(0, tl.inputs.findIndex((p) => p.id === edge.targetPort)));
    const mid = from ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } : { x: to.x - 100, y: to.y };
    setPicker({
      title: 'Add a block in between',
      onPick: (type) => {
        const node = newNode(catalog, type, mid, ed.getGraph().nodes, { width: NODE_W, headerHeight: NODE_HEADER_H });
        ed.apply((g) => insertOnEdge(g, catalog, edgeId, node) ?? g, 'insert');
        selectOnly(node.nodeId);
      },
    });
  }

  /* ── menus ─────────────────────────────────────────────────────────────── */

  function addableTypes(): string[] {
    return paletteGroups(catalog).flatMap((g) => g.blocks.map((b) => b.type)).filter((t) => !addProblem(t));
  }

  function hasClip(): boolean {
    return !!(clipRef.current ?? loadClip());
  }

  function openMenu(clientX: number, clientY: number, target: Element) {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const at = toWorld(clientX, clientY);
    const tabId = target.closest<HTMLElement>('[data-group-tab]')?.dataset.groupTab;
    const nodeId = target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
    const edgeId = target.closest<SVGElement>('[data-edge-id]')?.dataset.edgeId;
    let items: ContextMenuItem[];
    if (tabId) {
      const group = groups.find((g) => g.groupId === tabId);
      if (!group) return;
      setSelectedList(group.nodeIds);
      items = [
        { kind: 'item', label: m.menuSelectNodes, icon: faSquareCheck, onSelect: () => setSelectedList(group.nodeIds) },
        ...(readOnly ? [] : [
          { kind: 'item', label: m.menuEditGroup, icon: faPenToSquare, onSelect: () => setGroupEdit({ kind: 'edit', groupId: tabId }) },
          { kind: 'item', label: m.menuUngroup, icon: faObjectUngroup, onSelect: () => ed.apply((g) => ({ ...g, groups: ungroup(g.groups, tabId) }), 'ungroup') },
        ] as ContextMenuItem[]),
      ];
    }
    else if (nodeId) {
      const n = nodes.find((x) => x.nodeId === nodeId);
      if (!n) return;
      const ids = selectionSet.has(nodeId) ? selection : [nodeId];
      if (!selectionSet.has(nodeId)) selectOnly(nodeId);
      else setSelectedEdgeId(null);
      const subId = subflowIdOf(n.type);
      const hasPorts = ids.some((id) => nodes.find((x) => x.nodeId === id)?.type.startsWith('port.'));
      const member = groupOf(groups, nodeId);
      const extra = nodeMenuItems?.({ nodeIds: ids, readOnly }) ?? [];
      items = [
        { kind: 'item', label: readOnly ? m.menuView : m.menuEdit, hint: hint('edit'), icon: faPenToSquare, onSelect: () => openEditor(nodeId) },
        ...(subId && ed.state.subflows.some((s) => s.subflowId === subId)
          ? [{ kind: 'item', label: m.menuEditSubflow, icon: faDiagramProject, onSelect: () => enterSubflow(subId) } as ContextMenuItem] : []),
        ...(canDebug ? [{ kind: 'item', label: m.menuDebugNode, icon: faBug, onSelect: () => setDebugNodeId(nodeId) } as ContextMenuItem] : []),
        { kind: 'separator' },
        { kind: 'item', label: m.menuCopy(ids.length), hint: hint('copy'), icon: faCopy, onSelect: () => copyNodes(ids) },
        ...(readOnly ? [] : [
          { kind: 'item', label: m.menuCut(ids.length), hint: hint('cut'), icon: faScissors, onSelect: () => cutNodes(ids) },
          { kind: 'item', label: m.menuDuplicate(ids.length), hint: hint('duplicate'), icon: faClone, onSelect: () => duplicate(ids) },
          { kind: 'item', label: ids.every((id) => nodes.find((x) => x.nodeId === id)?.disabled) ? m.menuWakeUp : m.menuSkip, icon: faEyeSlash, onSelect: () => ed.apply((g) => toggleDisabled(g, ids), 'skip') },
          { kind: 'separator' },
          { kind: 'item', label: m.menuGroup, icon: faObjectGroup, onSelect: () => setGroupEdit({ kind: 'new', ids }) },
          ...(member ? [{ kind: 'item', label: m.menuUngroup, icon: faObjectUngroup, onSelect: () => ed.apply((g) => ({ ...g, groups: ungroup(g.groups, member.groupId) }), 'ungroup') } as ContextMenuItem] : []),
          ...(hasPorts ? [] : [{ kind: 'item', label: m.menuConvertToSubflow, icon: faLayerGroup, onSelect: () => setConvertIds(ids) } as ContextMenuItem]),
          ...(extra.length ? [{ kind: 'separator' } as ContextMenuItem, ...extra] : []),
          { kind: 'separator' },
          { kind: 'item', label: m.menuDelete(ids.length), hint: hint('delete'), icon: faTrash, danger: true, onSelect: () => deleteNodes(ids) },
        ] as ContextMenuItem[]),
        ...(readOnly && extra.length ? [{ kind: 'separator' } as ContextMenuItem, ...extra] : []),
      ];
    }
    else if (edgeId) {
      setSelectedEdgeId(edgeId);
      setSelectedList([]);
      if (readOnly) return;
      items = [
        { kind: 'item', label: m.menuAddBlockBetween, icon: faPlus, onSelect: () => insertOnConnection(edgeId) },
        ...(edgeSourcePorts(ed.getGraph(), catalog, edgeId).length > 1
          ? [{ kind: 'item', label: m.menuChangePort, icon: faRightLeft, onSelect: () => setPortEditEdge(edgeId) } as ContextMenuItem] : []),
        { kind: 'item', label: m.menuDeleteConnection, hint: hint('delete'), icon: faTrash, danger: true, onSelect: () => deleteEdge(edgeId) },
      ];
    }
    else {
      const types = readOnly ? [] : addableTypes();
      items = [
        ...(readOnly ? [] : [
          ...(types.length <= INLINE_ADD_LIMIT
            ? types.map((t): ContextMenuItem => ({ kind: 'item', label: m.menuAdd(catalog.blocks[t].title), icon: undefined, onSelect: () => selectOnly(paletteDrop.addAt(t, at)) }))
            : [{ kind: 'item', label: m.menuAddBlockHere, icon: faMagnifyingGlassPlus, onSelect: () => setPicker({ title: m.pickerTitle, onPick: (t) => selectOnly(paletteDrop.addAt(t, at)) }) } as ContextMenuItem]),
          { kind: 'item', label: m.menuAddComment, hint: hint('note'), icon: faNoteSticky, onSelect: () => addNote(at) },
          { kind: 'separator' },
          { kind: 'item', label: m.menuPaste, hint: hint('paste'), icon: faPaste, disabled: !hasClip(), onSelect: () => paste({ x: at.x, y: at.y }) },
          { kind: 'item', label: m.menuUndo, hint: hint('undo'), icon: faRotateLeft, disabled: !ed.canUndo, onSelect: ed.undo },
          { kind: 'item', label: m.menuRedo, hint: hint('redo'), icon: faRotateRight, disabled: !ed.canRedo, onSelect: ed.redo },
        ] as ContextMenuItem[]),
        { kind: 'item', label: m.menuSelectAll, hint: hint('selectAll'), icon: faSquareCheck, onSelect: selectAll },
        ...(readOnly ? [] : [{ kind: 'item', label: m.menuArrange, icon: faDiagramProject, disabled: !nodes.length, onSelect: () => { arrange(); } } as ContextMenuItem]),
        { kind: 'item', label: m.menuFit, icon: faExpand, onSelect: fit },
        { kind: 'item', label: m.shortcutsTitle, icon: faKeyboard, hint: hint('help'), onSelect: () => setShortcutsOpen(true) },
        ...(canDebug ? [{ kind: 'item', label: m.menuDebugChain, icon: faBug, onSelect: () => setRulesetDebugOpen(true) } as ContextMenuItem] : []),
      ];
    }
    setMenu({ x: clientX - r.left, y: clientY - r.top, items });
  }

  /* wheel pans; with Ctrl / ⌘ it zooms around the pointer */
  function onWheel(e: React.WheelEvent) {
    const r = containerRef.current?.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, r ? e.clientX - r.left : undefined, r ? e.clientY - r.top : undefined);
    else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  }

  /* a comment card at a world point, its panel open to type the text in */
  function addNote(at: Point) {
    const node = newNode(catalog, NOTE_TYPE, at, ed.getGraph().nodes, { width: NODE_W, headerHeight: NODE_HEADER_H });
    ed.apply((g) => ({ ...g, nodes: [...g.nodes, node] }), 'add');
    setSelectedList([node.nodeId]);
    setSelectedEdgeId(null);
    setEditingNodeId(node.nodeId);
    loadPanel(node);
    setShowRequired(false);
    if (sideBar && sideTab !== 'block') setSideTab('block');
  }

  function openFind() { setFind((f) => f ?? { query: '', index: 0 }); setFindTick((t) => t + 1); }
  function closeFind() { setFind(null); containerRef.current?.focus(); }
  function findQuery(query: string) {
    setFind({ query, index: 0 });
    const first = findNodes(nodes, query, catalog)[0];
    if (first) reveal(first);
  }
  function findStep(delta: 1 | -1) {
    if (!found.length) return;
    const next = (foundIndex + delta + found.length) % found.length;
    setFind((f) => (f ? { ...f, index: next } : f));
    reveal(found[next]);
  }

  /* what each binding of `shortcuts.ts` does; false when there was nothing to act on (the key is then left alone) */
  function runShortcut(id: ShortcutId): boolean {
    switch (id) {
      case 'undo': ed.undo(); return true;
      case 'redo': ed.redo(); return true;
      case 'selectAll': selectAll(); return true;
      case 'delete':
        if (selectedEdgeId) { deleteEdge(selectedEdgeId); return true; }
        if (selection.length) { deleteNodes(selection); return true; }
        return false;
      case 'edit': if (primaryId) { openEditor(primaryId); return true; } return false;
      case 'copy': if (selection.length) { copyNodes(selection); return true; } return false;
      case 'cut': if (selection.length) { cutNodes(selection); return true; } return false;
      case 'paste': paste(centerWorld()); return true;
      case 'duplicate': if (selection.length) { duplicate(selection); return true; } return false;
      case 'menu': {
        const el = primaryId ? containerRef.current?.querySelector(`[data-node-id="${primaryId}"]`) : null;
        const r = (el ?? containerRef.current)?.getBoundingClientRect();
        if (r) openMenu(r.left + 24, r.top + 24, el ?? containerRef.current!);
        return true;
      }
      case 'cancel': edgeConnect.clearConnecting(); rewire.cancel(); setSelectedEdgeId(null); return true;
      case 'note': addNote(centerWorld()); return true;
      case 'help': setShortcutsOpen(true); return true;
      case 'find': openFind(); return true;
      default: return false; // save: the root handler
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input,textarea,select')) return;
    const s = shortcutOf(e);
    if (!s || s.id === 'save' || (readOnly && s.writes)) return;
    if (runShortcut(s.id) && s.prevent) e.preventDefault();
  }

  const editingNode = editingNodeId ? nodes.find((n) => n.nodeId === editingNodeId) ?? null : null;
  const editingLayout = editingNode ? layouts.get(editingNode.nodeId) : undefined;
  const editingDecl = editingNode ? catalog.blocks[editingNode.type] : undefined;
  useEffect(() => {
    if (editingNode && nodeSnap(editingNode) !== panelSnap.current) loadPanel(editingNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPanel only reads the catalog of this render
  }, [editingNode]);
  const debugNode   = debugNodeId   ? nodes.find((n) => n.nodeId === debugNodeId)   ?? null : null;
  /* the automation script param of the open block, for "Test script" */
  const scriptKey = editingDecl ? Object.entries(editingDecl.params ?? {}).find(([, spec]) => spec.type === 'code' && spec.api === SCRIPT_API)?.[0] : undefined;
  const openScriptTest = onScriptTest && editingNode && scriptKey
    ? () => { const v = panelDraft.current.values[scriptKey]; setScriptTest({ nodeId: editingNode.nodeId, key: scriptKey, code: typeof v === 'string' ? v : '' }); }
    : undefined;
  if (scriptTest && scriptTest.nodeId !== editingNodeId) setScriptTest(null);
  const panelProps = editingNode && editingLayout ? {
    node: editingNode, decl: editingDecl, layout: editingLayout, readOnly,
    draftLabel, draftDescription, draftValues, choices, showRequired,
    issues: issues.get(editingNode.nodeId),
    onLabelChange: (label: string) => writePanel({ label }),
    onDescriptionChange: (description: string) => writePanel({ description }),
    onValueChange: (key: string, value: unknown) => writePanel({ values: setField(panelDraft.current.values, key, value) }),
    onValuesChange: (values: Record<string, unknown>) => writePanel({ values }),
    paramEditor: paramEditors?.[editingNode.type],
    onClose: () => setEditingNodeId(null),
    onDelete: () => deleteNodes([editingNode.nodeId]),
    onResetScript: defaultScriptOf(editingDecl?.params) !== undefined
      ? () => writePanel({ values: formValues(editingDecl?.params, { ...splitFormValues(editingDecl?.params, panelDraft.current.values).config }, undefined) })
      : null,
    onDebug: canDebug ? () => setDebugNodeId(editingNode.nodeId) : undefined,
    nodeMessages: nodeMessages ? nodeMessages[editingNode.nodeId] ?? [] : undefined,
    messageBodies,
    activity: activity?.nodes?.[editingNode.nodeId],
    activityWindow: activity?.window,
    onTestMessage: onTestMessage ? (msg: NodeMessage) => onTestMessage(editingNode.nodeId, msg) : undefined,
    onTestScript: openScriptTest,
  } : null;
  /* the side bar: the editor's validation errors first in Errors, then the host's pre-flight */
  const sideProblems = useMemo<DeployProblem[]>(() => [
    ...validation.errors.map((i) => ({ message: i.message, nodeId: i.nodeId, code: i.code, severity: 'error' as const })),
    ...(sideBar?.deployProblems ?? []),
  ], [validation, sideBar?.deployProblems]);
  const sideNames = useMemo(() => sideBar?.nodeNames ?? Object.fromEntries(nodes.map((n) => [n.nodeId, nodeName(n, catalog.blocks[n.type])])), [sideBar?.nodeNames, nodes, catalog]);
  const sideVisible = !!sideBar && (sideShown || !!editingNode);
  const settingsUsers = scopeSubflow ? subflowUsers(ed.state, scopeSubflow.subflowId).map((id) => id || chainName) : [];

  return (
    <MessagesProvider value={m}>
    <div ref={rootRef} className={cn('relative flex h-full min-h-0 overflow-hidden', FULLSCREEN_CLASSES, className)}
      onKeyDown={onSave ? (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 's' || (e.target as Element).closest?.('[role="dialog"]')) return;
        e.preventDefault();
        if (!readOnly) onSave({ valid: validation.errors.length === 0 });
      } : undefined}>
      {!readOnly && (
        <Palette
          catalog={catalog}
          onDragStart={paletteDrop.onPaletteDragStart}
          onDragEnd={paletteDrop.onPaletteDragEnd}
          onAdd={(t) => { addAtCenter(t); setSheetOpen(false); }}
          onDebugChain={canDebug ? () => setRulesetDebugOpen(true) : undefined}
          onNewSubflow={() => setNewSubflowOpen(true)}
          addProblem={addProblem}
          sheetOpen={sheetOpen}
          onCloseSheet={() => setSheetOpen(false)}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {bannerSlot}
      <Canvas
        containerRef={containerRef}
        nodes={nodes}
        edges={edges}
        groups={groups}
        catalog={catalog}
        layouts={layouts}
        view={view}
        selectedIds={selectionSet}
        selectedEdgeId={selectedEdgeId}
        editingNodeId={editingNodeId}
        dragNodeId={nodeDrag.dragNodeId}
        connecting={edgeConnect.connecting}
        mouse={mouse}
        readOnly={readOnly}
        nodeStatus={nodeStatus}
        diffTint={diffTint}
        issues={issues}
        onPointerDown={onPointerDown}
        onPointerDownCapture={onPointerDownCapture}
        onContextMenu={onContextMenu}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onDrop={paletteDrop.onDrop}
        onDragOver={(e) => e.preventDefault()}
        onNodePointerDown={onNodePointerDown}
        onOutputPortDown={edgeConnect.onOutputPortDown}
        onInputPortUp={(e, nodeId, portId) => {
          if (!rewire.rewiring) return edgeConnect.onInputPortUp(e, nodeId, portId);
          e.stopPropagation();
          rewire.dropOn(nodeId, rewire.rewiring.end === 'target' ? portId : undefined);
        }}
        onOutputPortUp={(e, nodeId, portId) => {
          if (!rewire.rewiring) return;
          e.stopPropagation();
          rewire.dropOn(nodeId, rewire.rewiring.end === 'source' ? portId : undefined);
        }}
        rewiring={rewire.rewiring}
        onEdgeEndDown={readOnly ? undefined : rewire.start}
        edgeActivity={activity ? edgeAct : undefined}
        litEdges={litEdges}
        nodeActivity={activity?.nodes}
        activityWindow={activity?.window}
        onSelectEdge={(id) => { setSelectedEdgeId(id); setSelectedList([]); }}
        onDeleteSelectedEdge={() => selectedEdgeId && deleteEdge(selectedEdgeId)}
        onGroupTabPointerDown={onGroupTabPointerDown}
        onGroupTabDoubleClick={(id) => setGroupEdit({ kind: 'edit', groupId: id })}
        onZoomIn={() => zoomAt(1.2)}
        onZoomOut={() => zoomAt(1 / 1.2)}
        onFit={fit}
        canUndo={ed.canUndo}
        canRedo={ed.canRedo}
        onUndo={ed.undo}
        onRedo={ed.redo}
        guides={snap.guides}
        onPointerCancel={onPointerCancel}
        onArrange={arrange}
        canArrange={nodes.length > 0}
        boxMode={box.boxMode}
        onToggleBoxMode={box.toggleBoxMode}
        miniOn={mini.visible}
        onToggleMini={mini.toggle}
        fullscreen={fullscreen.active}
        onToggleFullscreen={fullscreen.toggle}
        onShowShortcuts={() => setShortcutsOpen(true)}
        search={searchState}
        toolbarExtra={toolbarExtra}
      >
        {scopeSubflow && <ScopeBar chainName={chainName} subflowName={scopeSubflow.name} readOnly={readOnly} onBack={() => enterSubflow(null)} onSettings={() => setSettingsOpen(true)} />}
        <IssuesPanel
          result={validation}
          nodeLabel={(id) => { const n = nodes.find((x) => x.nodeId === id); return n ? nodeName(n, catalog.blocks[n.type]) : id; }}
          onSelect={(id) => selectOnly(id)}
        />
        {find && <FindBar query={find.query} count={found.length} current={foundIndex} focusTick={findTick} onQuery={findQuery} onStep={findStep} onClose={closeFind} />}
        <SelectionFrame frame={box.frame} />
        {mini.visible && mini.mapping && (
          <MiniMap mapping={mini.mapping} view={view} size={mini.size} onGo={goTo}
            items={nodes.map((n) => ({
              id: n.nodeId, x: n.x, y: n.y, w: NODE_W, h: layouts.get(n.nodeId)?.height ?? 0,
              error: nodeStatus?.[n.nodeId]?.tone === 'error' || !!issues.get(n.nodeId)?.some((i) => i.severity === 'error'),
              colorClass: lookOf(catalog.blocks[n.type]).iconColor,
            }))} />
        )}
        {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
        {!readOnly && (
          <button type="button" onClick={() => setSheetOpen((o) => !o)} aria-label={m.addNodeSheet}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg shadow-lg transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus md:hidden">
            <FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" /> {m.nodesButton}
          </button>
        )}
      </Canvas>
      </div>

      {!sideBar && panelProps && <NodeEditorPanel key={panelProps.node.nodeId} {...panelProps} />}

      {sideBar && sideVisible && (() => {
        const { traceTab, runsTab, open: _open, onOpenChange, tab: _tab, onTabChange: _onTab, onReveal: hostReveal, nodeNames: _names, deployProblems: _dp, ...insight } = sideBar;
        const pick = <p className="p-4 text-xs text-text-secondary">{m.sideBarPickBlock}</p>;
        return (
          <InsightPanel
            {...insight}
            className="w-[22rem] shrink-0 max-md:absolute max-md:inset-0 max-md:z-50 max-md:w-auto"
            uiMessages={messages}
            nodeNames={sideNames}
            selectedNodeId={primaryId}
            deployProblems={sideProblems}
            tab={sideTab}
            onTabChange={setSideTab}
            onReveal={(id) => { selectOnly(id); reveal(id); hostReveal?.(id); }}
            onClose={() => { setEditingNodeId(null); setSideShown(false); onOpenChange?.(false); }}
            slots={{
              block: { content: panelProps ? <NodeEditorPanel key={panelProps.node.nodeId} {...panelProps} bare tabs={['settings', 'messages']} /> : pick },
              help: { content: panelProps ? <NodeEditorPanel key={`help-${panelProps.node.nodeId}`} {...panelProps} bare tabs={['help']} /> : pick },
              ...(traceTab && { trace: traceTab }),
              ...(runsTab && { runs: runsTab }),
            }}
          />
        );
      })()}

      {scriptTest && onScriptTest && editingNode && (
        <ScriptTestDialog
          nodeId={scriptTest.nodeId} blockLabel={nodeName(editingNode, editingDecl)} code={scriptTest.code} readOnly={readOnly}
          sample={scriptTestSample?.(scriptTest.nodeId)}
          onRun={onScriptTest}
          onSave={(code) => { const key = scriptTest.key; setScriptTest(null); writePanel({ values: setField(panelDraft.current.values, key, code) }); }}
          onClose={() => setScriptTest(null)} />
      )}

      {canDebug && debugNode && (
        <Suspense fallback={null}>
        <NodeDebugModal node={debugNode}
          msg={dbgMsg} onMsgChange={setDbgMsg}
          metadata={dbgMeta} onMetadataChange={setDbgMeta}
          messageType={dbgMsgType} onMessageTypeChange={setDbgMsgType}
          onClose={() => setDebugNodeId(null)} />
        </Suspense>
      )}

      {canDebug && rulesetDebugOpen && (
        <Suspense fallback={null}>
        <RulesetDebugModal nodes={ed.state.nodes} edges={ed.state.edges} chainName={chainName}
          msg={dbgMsg} onMsgChange={setDbgMsg}
          metadata={dbgMeta} onMetadataChange={setDbgMeta}
          messageType={dbgMsgType} onMessageTypeChange={setDbgMsgType}
          onClose={() => setRulesetDebugOpen(false)} />
        </Suspense>
      )}

      {portEditEdge && (() => {
        const edge = edges.find((e) => e.edgeId === portEditEdge);
        const src = edge && nodes.find((n) => n.nodeId === edge.sourceNodeId);
        return edge && src ? (
          <PortDialog blockLabel={src.label} ports={edgeSourcePorts(ed.getGraph(), catalog, portEditEdge)}
            onSubmit={(port) => { const id = portEditEdge; setPortEditEdge(null); ed.apply((g) => changeEdgePort(g, catalog, id, port) ?? g, 'edge-port'); }}
            onClose={() => setPortEditEdge(null)} />
        ) : null;
      })()}

      {shortcutsOpen && <ShortcutsDialog readOnly={readOnly} canSave={!!onSave} mac={isMac()} onClose={() => setShortcutsOpen(false)} />}

      {picker && (
        <BlockPickerDialog title={picker.title} catalog={catalog} addProblem={addProblem}
          onPick={(type) => { const p = picker; setPicker(null); p.onPick(type); }} onClose={() => setPicker(null)} />
      )}

      {groupEdit && (
        <GroupDialog
          title={groupEdit.kind === 'new' ? m.groupNewTitle : m.groupEditTitle}
          confirmLabel={groupEdit.kind === 'new' ? m.groupConfirm : m.groupSave}
          initial={groupEdit.kind === 'edit'
            ? (() => { const g = groups.find((x) => x.groupId === groupEdit.groupId); return { name: g?.name ?? '', color: g?.color ?? 0 }; })()
            : { name: '', color: groups.length % 8 }}
          onSubmit={submitGroup} onClose={() => setGroupEdit(null)} />
      )}

      {convertIds && (
        <NameDialog title={m.convertTitle} description={m.convertDescription}
          label={m.subflowNameLabel} confirmLabel={m.convertConfirm} onSubmit={convertToSubflow} onClose={() => setConvertIds(null)} />
      )}

      {newSubflowOpen && (
        <NameDialog title={m.newSubflowTitle} label={m.subflowNameLabel} confirmLabel={m.newSubflowCreate} onSubmit={createSubflow} onClose={() => setNewSubflowOpen(false)} />
      )}

      {settingsOpen && scopeSubflow && (
        <SubflowSettingsDialog
          subflow={scopeSubflow} usedBy={settingsUsers}
          onSave={(settings) => { setSettingsOpen(false); ed.applyState((s) => applySubflowSettings(s, scopeSubflow.subflowId, settings), 'subflow-settings'); }}
          onDelete={() => { setSettingsOpen(false); const id = scopeSubflow.subflowId; enterSubflow(null); ed.applyState((s) => deleteSubflow(s, id), 'delete-subflow'); }}
          onClose={() => setSettingsOpen(false)} />
      )}
    </div>
    </MessagesProvider>
  );
}
