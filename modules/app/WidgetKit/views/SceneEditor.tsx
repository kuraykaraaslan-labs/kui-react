'use client';
// The process diagram editor shell: toolbar on top, the palette on the left, the canvas in the middle and the inspector
// (properties, actions, problems, what-if) on the right; they stack on a narrow screen. It edits a COPY of the scene
// settings in an undo history and hands the result to the host with Apply; closing with unapplied edits asks first (a
// dialog inside the page). The pure rules are in `scene-edit-logic.ts`, what the pointer and keys mean in
// `scene-editor-state.ts`; the panels are `ScenePalette`, `SceneInspector`, `SceneProblems` and `SceneWhatIf`.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ClipboardEvent as ReactClipboardEvent, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronLeft, faChevronRight, faChevronUp, faEllipsis } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { SCADA_SYMBOL_DEFS } from './scada-logic';
import { Button } from '@/modules/ui/Button';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DropdownMenu } from '@/modules/ui/DropdownMenu';
import { sceneModel, type SceneSettings } from './scada-scene-logic';
import { elementIds, elementsOf } from './scene-edit-core';
import {
  addElement, align, apply as historyApply, canRedo, canUndo, captureAssembly, createHistory, deleteSelection, distribute, duplicate, insertAssembly,
  moveSelection, parseClipboard, problems as findProblems, redo as historyRedo, renameElement, reorder, resizeShape, serialize, setOwnSize, setShapeProps, snapPoint,
  undo as historyUndo, type AlignMode, type DistributeAxis, type EditResult, type ReorderMode, type Selection,
} from './scene-edit-logic';
import { elementBoxes, shapeBounds, shapesOf, type Pt } from './scene-edit-geometry';
import { fill, mergeEditorMessages, type SceneEditorMessages } from './scene-editor-messages-canvas';
import {
  addToLibrary, baseBox, browserStorage, centerOn, clientToScene, connectFacing, contentBox, fitContentViewport, fitViewport, isEmptySelection, isTextTarget, keyCommand, loadLibrary, loadRecent, only, overlayData,
  overlayParams, pruneSelection, pushRecent, removeFromLibrary, saveLibrary, saveRecent, selectAll, selectionCount, thingHits, viewBoxFor, withoutThings, withSessionHidden, zoomAt,
  DEFAULT_SIZE, type KeyCommand, type SavedAssembly, type Size, type Tool, type ViewBox, type Viewport,
} from './scene-editor-state';
import type { EditorCtx, InspectedThing, SceneEditorProps, WhatIfState } from './scene-editor-types';
import { patchId } from './scene-patch';
import { SceneEditorCanvas, type CanvasHandle, type Renaming } from './SceneEditorCanvas';
import { SceneEditorToolbar, type LayerItem } from './SceneEditorToolbar';
import { SceneInspector } from './SceneInspector';
import { SceneMinimap } from './SceneMinimap';
import { ScenePalette } from './ScenePalette';
import { SceneProblems } from './SceneProblems';
import { SceneWhatIf } from './SceneWhatIf';

export * from './scene-editor-types';
export { mergeEditorMessages, SCENE_EDITOR_MESSAGES, type SceneEditorMessages } from './scene-editor-messages-canvas';

const NO_WHAT_IF: WhatIfState = { rows: {}, params: {} };
const NO_SET: ReadonlySet<string> = new Set();
const ZOOM_STEP = 1.25;
const DEFAULT_KEY = 'kui.scada.editor';
/** Key presses within this window join one undo step (nudges, resizes). */
const BURST_MS = 800;

type TabId = 'properties' | 'rules' | 'actions' | 'problems' | 'whatif';

/** A burst is a run of presses less than `BURST_MS` apart: they share one key, so they are one undo step (a fixed clock bucket would split a burst that straddles its edge). */
const lastPress = new Map<string, { at: number; n: number }>();
const bucket = (kind: string) => {
  const now = Date.now();
  const last = lastPress.get(kind);
  const n = last && now - last.at < BURST_MS ? last.n : (last?.n ?? 0) + 1;
  lastPress.set(kind, { at: now, n });
  return `${kind}:${n}`;
};
const round2 = (v: number) => Math.round(v * 100) / 100;
const TOOL_LABEL = { select: 'toolSelect', connect: 'toolConnect', pan: 'toolPan', text: 'toolText', zone: 'toolZone', divider: 'toolDivider' } as const;

export function SceneEditor(props: SceneEditorProps): ReactNode {
  const { onApply, onClose, host = {}, locale, format } = props;
  const m = useMemo(() => mergeEditorMessages(props.messages), [props.messages]);
  const storageKey = props.storageKey ?? DEFAULT_KEY;

  // ─── The draft and its history ───────────────────────────────────────────
  const [history, setHistory] = useState(() => createHistory(props.settings));
  const historyRef = useRef(history);
  const [baseline, setBaseline] = useState(props.settings);
  const settings = history.present;
  // The host's own edits (the actions it keeps beside the diagram) count as unapplied changes too.
  const dirty = settings !== baseline || host.dirty === true;

  const commit = useCallback((next: typeof history) => { historyRef.current = next; setHistory(next); }, []);
  const apply = useCallback<EditorCtx['apply']>((op, group) => {
    const r = historyApply(historyRef.current, op, group);
    if (r.history !== historyRef.current) commit(r.history);
    return r.result;
  }, [commit]);

  // ─── What the user sees and does ─────────────────────────────────────────
  const [rawSelection, setSelection] = useState<Selection>({ elements: [], shapes: [], links: [] });
  const selection = useMemo(() => pruneSelection(rawSelection, settings), [rawSelection, settings]);
  const [tool, setTool] = useState<Tool>('select');
  const [grid, setGrid] = useState(true);
  const [guides, setGuides] = useState(true);
  const [linkKind, setLinkKind] = useState('pipe');
  const [whatIf, setWhatIf] = useState<WhatIfState>(NO_WHAT_IF);
  const [locked, setLocked] = useState<ReadonlySet<string>>(NO_SET);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(NO_SET);
  const [tab, setTab] = useState<TabId>('properties');
  const [open, setOpen] = useState({ palette: true, inspector: true });
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const [pasteBox, setPasteBox] = useState<{ text: string; error: string | null } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyFailed, setApplyFailed] = useState(false);
  const [live, setLive] = useState('');
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [library, setLibrary] = useState<SavedAssembly[]>(() => loadLibrary(browserStorage(), storageKey));
  const [recent, setRecent] = useState<string[]>(() => loadRecent(browserStorage(), storageKey));
  const [paletteDrag, setPaletteDrag] = useState<{ symbol: string } | null>(null);
  // The thing from data the author clicked (read-only in the inspector); a selection of authored parts replaces it.
  const [peek, setPeek] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);
  // The editor's own box: its "Discard your changes?" question opens inside it, so a host that shows the editor in a modal dialog
  // (a Radix dialog blocks clicks and focus outside itself) can still reach it.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const lastPointer = useRef<Pt | null>(null);
  const memory = useRef<string>('');
  const pastes = useRef(0);

  const say = useCallback((message: string) => setLive((cur) => (cur === message ? `${message}​` : message)), []);

  // ─── The models: what is drawn (with what-if), the hit boxes (no rules), what the canvas draws (session hides) ───
  const idColumn = settings.idColumn || 'id';
  const effData = useMemo(() => overlayData(props.data, whatIf, idColumn), [props.data, whatIf, idColumn]);
  const hostParams = useMemo(() => props.params ?? {}, [props.params]);
  const effParams = useMemo(() => overlayParams(hostParams, whatIf), [hostParams, whatIf]);
  const opts = useMemo(() => ({ animate: false, format, params: effParams }), [format, effParams]);
  const model = useMemo(() => sceneModel(settings, effData, opts), [settings, effData, opts]);
  const hasRules = Array.isArray(settings.rules) && settings.rules.length > 0;
  // Things from data are a locked layer: drawn (dimmed by the canvas) but never selected, moved, joined or aligned, so
  // every editing path reads the authored symbols only. Their boxes stay as read-only ends (`anchors`), so a connection
  // that ends on a thing can still be selected, re-routed and deleted from the canvas.
  const ruleFree = useMemo(() => (hasRules ? sceneModel({ ...settings, rules: undefined }, effData, opts) : model), [hasRules, settings, effData, opts, model]);
  const geo = useMemo(() => withoutThings(ruleFree), [ruleFree]);
  const anchors = useMemo(() => thingHits(ruleFree), [ruleFree]);
  const drawModel = useMemo(() => (hidden.size ? sceneModel(withSessionHidden(settings, hidden), effData, opts) : model), [hidden, settings, effData, opts, model]);
  const things = useMemo(() => thingHits(drawModel), [drawModel]);

  // ─── The viewport ────────────────────────────────────────────────────────
  const [base, setBase] = useState<ViewBox>(() => baseBox(props.settings, withoutThings(sceneModel(props.settings, props.data, { animate: false, format, params: props.params }))));
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const effective = viewport ?? fitViewport(base);
  const view = viewBoxFor(effective, base, size);
  const viewCenter: Pt = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  // The canvas was resized (the inspector changed its width or height): show it whole again.
  const sizeKey = `${settings.width}x${settings.height}`;
  const firstSize = useRef(sizeKey);
  useEffect(() => {
    if (firstSize.current === sizeKey) return;
    firstSize.current = sizeKey;
    setBase(baseBox(historyRef.current.present, geo));
    setViewport(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeKey]);

  // Fit to view frames the symbols (the whole canvas only while there are none): e2e round 2, tiny symbols at 100 %.
  const fit = useCallback(() => {
    const present = historyRef.current.present;
    const nextBase = baseBox(present, geo);
    setBase(nextBase);
    const content = contentBox(present, geo);
    setViewport(content ? fitContentViewport(nextBase, content, size) : null);
  }, [geo, size]);
  const zoomBy = (factor: number) => setViewport(zoomAt(effective, base, factor, viewCenter));
  const moveView = (p: Pt) => setViewport(centerOn(effective, base, p));

  // ─── Helpers over the selection ──────────────────────────────────────────
  const names = (id: string) => geo.hits.find((h) => h.id === id)?.name ?? id;
  const selectedElements = selection.elements ?? [];
  const skipped = useMemo(() => new Set([...locked, ...hidden]), [locked, hidden]);
  const problemList = useMemo(() => findProblems(settings, props.data, { extra: props.host?.problems }), [settings, props.data, props.host?.problems]);

  const refusal = (r: EditResult): boolean => { if (r.refused) say(fill(m.refused, { reason: r.refused })); return !!r.refused; };

  const snappedCentre = (): Pt => {
    const c = snapPoint(viewCenter, { grid: grid ? 10 : false, guides: false });
    // A symbol added where another one is drawn would land on top of it, and the one underneath could not be clicked again
    // (next-boilerplate E2E-1.15: a 20 px step left three symbols in one heap). The new one goes clear of the box it would hit:
    // to its right while the canvas has room, else below it; a free spot takes at most a few steps.
    const width = Math.min(4000, Math.max(200, Number(settings.width) || 1200));
    const gap = grid ? 20 : 16;
    let at: Pt = c;
    for (let i = 0; i < 12; i += 1) {
      const hit = geo.hits.find((h) => at.x >= h.x - gap && at.x <= h.x + h.w + gap && at.y >= h.y - gap && at.y <= h.y + h.h + gap);
      if (!hit) break;
      const right = { x: hit.x + hit.w + hit.w / 2 + gap, y: at.y };
      const below = { x: at.x, y: hit.y + hit.h + hit.h / 2 + gap };
      at = snapPoint(right.x + hit.w / 2 <= width ? right : below, { grid: grid ? 10 : false, guides: false });
    }
    return at;
  };

  const addSymbol = (symbol: string, at?: Pt) => {
    const where = at ?? snappedCentre();
    // named after its library tile, so the live picture shows a name under it (e2e round 2: "Show names" ticked, none shown)
    const label = (SCADA_SYMBOL_DEFS[symbol as keyof typeof SCADA_SYMBOL_DEFS] as { label?: string } | undefined)?.label;
    const r = apply((s) => addElement(s, symbol, where, label ? { label } : {}));
    if (refusal(r)) return;
    setSelection(only({ kind: 'element', id: r.id as string }));
    setTool('select');
    const next = pushRecent(recent, symbol);
    setRecent(next);
    saveRecent(browserStorage(), storageKey, next);
    // said by the symbol's name, never its catalogue code (next-boilerplate e2e round 4, M-R4-14: "Added pump1 (pump.motor)")
    say(fill(m.addedElement, { name: label ?? (r.id as string), x: Math.round(where.x), y: Math.round(where.y) }));
  };

  const select = (r: EditResult) => setSelection({ elements: r.ids ?? [], shapes: r.shapes ?? [], links: r.links ?? [] });

  const doDelete = () => {
    if (isEmptySelection(selection)) return;
    const count = selectionCount(selection);
    const label = selectedElements.length === 1 && count === 1 ? names(selectedElements[0]) : '';
    const r = apply((s) => deleteSelection(s, selection));
    if (refusal(r)) return;
    setSelection({ elements: [], shapes: [], links: [] });
    say(label ? fill(m.deleted, { name: label }) : fill(m.deletedMany, { count }));
  };

  const doDuplicate = () => {
    if (isEmptySelection(selection)) return;
    const r = apply((s) => duplicate(s, selection));
    if (refusal(r)) return;
    select(r);
    say(fill(m.duplicated, { count: (r.ids?.length ?? 0) + (r.shapes?.length ?? 0) }));
  };

  const doNudge = (dx: number, dy: number) => {
    const sel: Selection = { elements: selectedElements.filter((id) => !locked.has(id)), shapes: selection.shapes, links: [] };
    if (isEmptySelection(sel)) return;
    const r = apply((s) => moveSelection(s, sel, dx, dy), bucket('nudge'));
    if (refusal(r)) return;
    const firstId = sel.elements?.[0];
    const first = firstId ? (Array.isArray(r.settings.elements) ? r.settings.elements : []).find((e) => (e as { id?: string })?.id === firstId) as { x?: number; y?: number } | undefined : undefined;
    const count = (sel.elements?.length ?? 0) + (sel.shapes?.length ?? 0);
    say(count === 1 && first && firstId ? fill(m.movedOne, { name: firstId, x: Math.round(first.x ?? 0), y: Math.round(first.y ?? 0) }) : fill(m.movedMany, { count }));
  };

  /** Alt+arrow: a zone grows or shrinks, a divider gets longer or shorter. */
  const doResize = (dx: number, dy: number) => {
    if (selection.shapes?.length !== 1 || selectionCount(selection) !== 1) return;
    const index = selection.shapes[0];
    const shape = shapesOf(settings)[index] as { kind?: string; w?: number; h?: number } | undefined;
    if (!shape) return;
    const w = shape.w ?? 0; const h = shape.h ?? 0;
    const patch = shape.kind === 'zone' ? { w: (w || 200) + dx, h: (h || 120) + dy } : shape.kind === 'divider' ? (w <= 0 && h > 0 ? { h: h + dx + dy } : { w: w + dx + dy }) : null;
    if (!patch) return;
    const r = apply((s) => resizeShape(s, index, patch), bucket('resize'));
    if (!refusal(r)) say(fill(m.resized, { name: shape.kind === 'zone' ? m.toolZone : m.toolDivider }));
  };

  const doScale = (factor: number) => {
    const ids = selectedElements.filter((id) => !locked.has(id));
    if (!ids.length) return;
    const r = apply((s) => {
      let cur = s;
      for (const id of ids) {
        const e = (Array.isArray(cur.elements) ? cur.elements : []).find((q) => (q as { id?: string })?.id === id) as { scale?: number | null } | undefined;
        const was = typeof e?.scale === 'number' && e.scale > 0 ? e.scale : 1;
        cur = setOwnSize(cur, id, Math.min(4, Math.max(0.2, round2(was * factor)))).settings;
      }
      return { settings: cur };
    }, bucket('scale'));
    if (!refusal(r)) say(fill(m.resized, { name: ids.length === 1 ? ids[0] : String(ids.length) }));
  };

  const doConnectSelected = () => {
    if (selectedElements.length !== 2) return;
    const [a, b] = selectedElements;
    const r = apply((s) => connectFacing(s, geo, a, b, linkKind));
    if (refusal(r)) return;
    setSelection({ elements: [], shapes: [], links: [r.index as number] });
    say(fill(m.connected, { from: a, to: b }));
  };

  /**
   * An undo or a redo that swaps exactly one symbol id for another is a rename run backwards (or again): the host is told as it was
   * told of the rename itself, so what hangs off the id (its actions) follows and its problem count does not climb (next-boilerplate E2E-1.11).
   */
  const tellRenameAcross = (before: SceneSettings, after: SceneSettings) => {
    if (!host.onRename) return;
    const was = elementIds(before); const now = elementIds(after);
    const gone = [...was].filter((id) => !now.has(id)); const came = [...now].filter((id) => !was.has(id));
    if (gone.length === 1 && came.length === 1 && elementsOf(before).length === elementsOf(after).length) host.onRename(gone[0], came[0]);
  };
  const doUndo = () => { const before = historyRef.current.present; commit(historyUndo(historyRef.current)); tellRenameAcross(before, historyRef.current.present); say(m.undone); };
  const doRedo = () => { const before = historyRef.current.present; commit(historyRedo(historyRef.current)); tellRenameAcross(before, historyRef.current.present); say(m.redone); };
  /** Takes back the drag with this group key (Escape while dragging), if it is still the last step. */
  const cancelGroup = (group: string) => { if (historyRef.current.group === group) commit(historyUndo(historyRef.current)); };

  const doAlign = (mode: AlignMode) => {
    const sel: Selection = { elements: selectedElements.filter((id) => !locked.has(id)), shapes: selection.shapes };
    const r = apply((s) => align(s, geo, sel, mode));
    if (!refusal(r)) say(fill(m.alignedMsg, { count: selectionCount(sel) }));
  };
  const doDistribute = (axis: DistributeAxis) => {
    const sel: Selection = { elements: selectedElements.filter((id) => !locked.has(id)), shapes: selection.shapes };
    const r = apply((s) => distribute(s, geo, sel, axis));
    if (!refusal(r)) say(fill(m.distributedMsg, { count: selectionCount(sel) }));
  };
  const doOrder = (mode: ReorderMode) => { refusal(apply((s) => reorder(s, selection, mode))); };

  // ─── Clipboard and the library ───────────────────────────────────────────
  const copySelection = () => {
    const a = captureAssembly(settings, selection);
    if (!a) { say(m.nothingToCopy); return; }
    const text = serialize(a);
    memory.current = text;
    pastes.current = 0;
    try { void navigator.clipboard?.writeText(text).catch(() => undefined); } catch { /* the system clipboard refused: the in-editor copy stays */ }
    say(fill(m.copied, { count: a.elements.length + a.shapes.length }));
  };

  const insertText = (text: string): string | null => {
    const parsed = parseClipboard(text);
    if (!parsed.ok) { say(m.notDiagramPiece); return parsed.error; }
    pastes.current += 1;
    const centre = lastPointer.current ?? viewCenter;
    const at = snapPoint({ x: centre.x + 20 * (pastes.current - 1), y: centre.y + 20 * (pastes.current - 1) }, { grid: grid ? 10 : false, guides: false });
    const r = apply((s) => insertAssembly(s, parsed.assembly, at));
    if (r.refused) { say(fill(m.refused, { reason: r.refused })); return r.refused; }
    select(r);
    say(fill(m.pasted, { count: (r.ids?.length ?? 0) + (r.shapes?.length ?? 0) }));
    return null;
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const why = insertText(text);
      if (why) setPasteBox({ text, error: why });
    } catch {
      // The browser refused the read: ask for the text in the page (offering what was copied here).
      setPasteBox({ text: memory.current, error: null });
    }
  };

  const saveAssembly = (name: string) => {
    const a = captureAssembly(settings, selection, { name });
    if (!a) { say(m.nothingToCopy); return; }
    const next = addToLibrary(library, name, a);
    setLibrary(next);
    saveLibrary(browserStorage(), storageKey, next);
    say(fill(m.assemblySaved, { name }));
  };
  const insertSaved = (item: SavedAssembly) => {
    const at = snapPoint(viewCenter, { grid: grid ? 10 : false, guides: false });
    const r = apply((s) => insertAssembly(s, item.assembly, at));
    if (refusal(r)) return;
    select(r);
    say(fill(m.assemblyInserted, { name: item.name }));
  };
  const removeSaved = (name: string) => { const next = removeFromLibrary(library, name); setLibrary(next); saveLibrary(browserStorage(), storageKey, next); };

  // ─── Layers: session-only lock and hide ──────────────────────────────────
  const toggle = (set: ReadonlySet<string>, id: string): Set<string> => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const layers: LayerItem[] = useMemo(() => geo.hits.map((h) => ({ id: h.id, label: h.name === h.id ? h.id : `${h.name} (${h.id})`, locked: locked.has(h.id), hidden: hidden.has(h.id) })), [geo, locked, hidden]);
  const dropFromSelection = (id: string) => setSelection({ ...selection, elements: selectedElements.filter((e) => e !== id) });
  const toggleLock = (id: string) => { const next = toggle(locked, id); setLocked(next); if (next.has(id)) dropFromSelection(id); say(fill(next.has(id) ? m.locked : m.unlocked, { count: 1 })); };
  const toggleHide = (id: string) => { const next = toggle(hidden, id); setHidden(next); if (next.has(id)) dropFromSelection(id); say(fill(next.has(id) ? m.hidden : m.shown, { count: 1 })); };

  // ─── Rename in place (F2, double click) ──────────────────────────────────
  const startRename = () => {
    if (selectionCount(selection) !== 1) return;
    if (selectedElements.length === 1) setRenaming({ kind: 'element', id: selectedElements[0] });
    else if (selection.shapes?.length === 1) {
      const kind = (shapesOf(settings)[selection.shapes[0]] as { kind?: string } | undefined)?.kind;
      if (kind === 'text' || kind === 'zone') setRenaming({ kind: 'shape', index: selection.shapes[0] });
    }
  };
  const commitRename = (to: string): string | null => {
    if (!renaming) return null;
    if (renaming.kind === 'element') {
      const from = renaming.id;
      const next = to.trim();
      const r = apply((s) => renameElement(s, from, next));
      if (r.refused) return r.refused;
      setSelection(only({ kind: 'element', id: next }));
      if (next !== from) { say(fill(m.renamed, { from, to: next })); host.onRename?.(from, next); }
    } else {
      const index = renaming.index;
      const r = apply((s) => setShapeProps(s, index, { text: to }));
      if (r.refused) return r.refused;
    }
    setRenaming(null);
    canvasRef.current?.focus();
    return null;
  };

  // ─── The keyboard ────────────────────────────────────────────────────────
  const run = (cmd: KeyCommand) => {
    switch (cmd.type) {
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'copy': copySelection(); break;
      case 'paste': break; // the browser's paste event delivers the text
      case 'duplicate': doDuplicate(); break;
      case 'delete': doDelete(); break;
      case 'selectAll': { const s = selectAll(settings, geo, skipped); setSelection(s); say(fill(m.selectedMany, { count: selectionCount(s) })); break; }
      case 'escape':
        if (canvasRef.current?.cancelDrag()) break;
        if (renaming) setRenaming(null);
        else if (tool !== 'select') setTool('select');
        else if (!isEmptySelection(selection)) { setSelection({ elements: [], shapes: [], links: [] }); say(m.selectedNone); }
        break;
      case 'zoomIn': zoomBy(ZOOM_STEP); break;
      case 'zoomOut': zoomBy(1 / ZOOM_STEP); break;
      case 'fit': fit(); break;
      case 'rename': startRename(); break;
      case 'nudge': doNudge(cmd.dx, cmd.dy); break;
      case 'resize': doResize(cmd.dx, cmd.dy); break;
      case 'tool': setTool(cmd.tool); say(cmd.tool === 'connect' ? m.connectHint : fill(m.tool, { tool: m[TOOL_LABEL[cmd.tool]] })); break;
      case 'connectSelected': doConnectSelected(); break;
      case 'scale': doScale(cmd.factor); break;
      case 'front': doOrder('front'); break;
      case 'back': doOrder('back'); break;
      default: break;
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.defaultPrevented || isTextTarget(e.target as HTMLElement) || confirming || pasteBox) return;
    const inCanvas = !!canvasHost.current?.contains(e.target as Node);
    const cmd = keyCommand(e, { canvas: inCanvas });
    if (!cmd) return;
    if (cmd.type !== 'paste') e.preventDefault();
    run(cmd);
  };

  const onPaste = (e: ReactClipboardEvent) => {
    if (isTextTarget(e.target as HTMLElement) || confirming || pasteBox) return;
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || memory.current;
    if (!text) return;
    const why = insertText(text);
    if (why) setPasteBox({ text, error: why });
  };

  // ─── Palette drags that are not HTML5 drags (touch, pen) end here ─────────
  useEffect(() => {
    if (!paletteDrag) return undefined;
    const end = () => setPaletteDrag(null);
    const up = (e: PointerEvent) => {
      const r = canvasHost.current?.querySelector('svg')?.getBoundingClientRect();
      if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const pt = clientToScene({ x: e.clientX, y: e.clientY }, { left: r.left, top: r.top, width: r.width, height: r.height }, view);
        addSymbol(paletteDrag.symbol, snapPoint(pt, { grid: grid ? 10 : false, guides: false }));
      }
      end();
    };
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('dragend', end); window.removeEventListener('drop', end); window.removeEventListener('pointerup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteDrag, view.x, view.y, view.w, view.h, grid]);

  // ─── Apply and Close ─────────────────────────────────────────────────────
  const doApply = async () => {
    if (applying) return;
    setApplying(true); setApplyFailed(false);
    const now = historyRef.current.present;
    try {
      await onApply(now);
      setBaseline(now);
      say(m.applied);
      host.onApplied?.();
    } catch {
      setApplyFailed(true);
      say(m.applyFailed);
    } finally {
      setApplying(false);
    }
  };
  const requestClose = () => { if (dirty) setConfirming(true); else onClose(); };

  // ─── The panels ──────────────────────────────────────────────────────────
  const inspected = useMemo((): InspectedThing | null => {
    if (!peek || !isEmptySelection(selection)) return null;
    const box = things.find((h) => h.id === peek);
    if (!box) return null;
    const col = typeof settings.thingsIdColumn === 'string' && settings.thingsIdColumn ? settings.thingsIdColumn : 'id';
    const row = (effData.things?.rows ?? []).find((r) => patchId(r?.[col]) === peek) ?? {};
    const sample = (whatIf.things ?? []).includes(row);
    return { id: peek, name: box.name, row, ...(sample ? { sample } : {}) };
  }, [peek, selection, things, settings.thingsIdColumn, effData.things, whatIf.things]);
  const ctx: EditorCtx = { settings, model, data: props.data, params: hostParams, selection, setSelection, apply, host, locale, thing: inspected };
  const tabs: Array<{ id: TabId; label: string; badge?: number }> = [
    { id: 'properties', label: m.tabProperties },
    { id: 'rules', label: m.tabRules },
    ...(host.renderActions ? [{ id: 'actions' as const, label: m.tabActions }] : []),
    { id: 'problems', label: m.tabProblems, badge: problemList.length },
    { id: 'whatif', label: m.tabWhatIf },
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'properties';

  /** A problem names a symbol, `link:<n>` or `shape:<n>`: select it and bring it into view. */
  const focusProblem = (id: string) => {
    const link = /^link:(\d+)$/.exec(id); const shape = /^shape:(\d+)$/.exec(id);
    if (id === 'scene') setSelection({ elements: [], shapes: [], links: [] });
    else if (link) setSelection(only({ kind: 'link', index: Number(link[1]) }));
    else if (shape) {
      setSelection(only({ kind: 'shape', index: Number(shape[1]) }));
      const b = shapeBounds(shapesOf(settings)[Number(shape[1])] as never);
      if (b) moveView({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    } else {
      const b = elementBoxes(geo).get(id);
      if (b) { setSelection(only({ kind: 'element', id })); moveView({ x: b.x + b.w / 2, y: b.y + b.h / 2 }); }
    }
  };

  const onTabKey = (e: ReactKeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === activeTab);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    const t = tabs[(next + tabs.length) % tabs.length];
    setTab(t.id);
    requestAnimationFrame(() => document.getElementById(`scene-tab-${t.id}`)?.focus());
  };

  return (
    <div
      ref={setRoot}
      role="region"
      aria-label={props.title ?? m.title}
      data-testid="scene-editor"
      className={cn('relative flex h-full min-h-0 w-full flex-col bg-surface-base text-text-primary', props.className)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{props.title ?? m.title}</h2>
        {applyFailed && <p role="alert" className="text-xs text-error">{m.applyFailed}</p>}
        {/* the host's own actions (next-boilerplate phase 50: "Make a 3D view of this drawing"); told whether there are unsaved changes */}
        {props.menuItems && props.menuItems.length > 0 && (
          <DropdownMenu
            align="right"
            items={props.menuItems.map((item) => ({
              id: item.id, label: item.label, onClick: () => item.onSelect({ dirty }),
              ...(item.disabled ? { disabled: true } : {}), ...(item.disabledReason ? { disabledReason: item.disabledReason } : {}),
            }))}
            trigger={<Button variant="ghost" size="sm" iconOnly aria-label={m.more} title={m.more} data-testid="editor-more" iconLeft={<FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" />} />}
          />
        )}
        <Button variant="ghost" size="sm" onClick={requestClose} data-testid="editor-close">{m.close}</Button>
        <Button size="sm" onClick={() => { void doApply(); }} disabled={!dirty || applying} loading={applying} data-testid="editor-apply">{applying ? m.applying : m.apply}</Button>
      </div>

      <SceneEditorToolbar
        // the connect tool says how it is used (next-boilerplate e2e round 4, M-R4-04: "Connect tool" alone left a person guessing)
        m={m} tool={tool} onTool={(t) => { setTool(t); say(t === 'connect' ? m.connectHint : fill(m.tool, { tool: m[TOOL_LABEL[t]] })); }}
        canUndo={canUndo(history)} canRedo={canRedo(history)} onUndo={doUndo} onRedo={doRedo}
        zoomPercent={Math.round(effective.zoom * 100)} onZoomIn={() => zoomBy(ZOOM_STEP)} onZoomOut={() => zoomBy(1 / ZOOM_STEP)} onFit={fit}
        grid={grid} guides={guides} onGrid={() => setGrid((v) => !v)} onGuides={() => setGuides((v) => !v)}
        linkKind={linkKind} onLinkKind={setLinkKind}
        selected={selectionCount(selection)} selectedElements={selectedElements.length}
        onDuplicate={doDuplicate} onDelete={doDelete} onCopy={copySelection} onPaste={() => { void pasteFromClipboard(); }} onConnectSelected={doConnectSelected}
        onAlign={doAlign} onDistribute={doDistribute} onOrder={doOrder}
        library={library} onSaveAssembly={saveAssembly} onInsertAssembly={insertSaved} onRemoveAssembly={removeSaved}
        layers={layers} onToggleLock={toggleLock} onToggleHide={toggleHide}
        onUnlockAll={() => { say(fill(m.unlocked, { count: locked.size })); setLocked(NO_SET); }} onShowAll={() => { say(fill(m.shown, { count: hidden.size })); setHidden(NO_SET); }}
        problems={problemList.length} onProblems={() => { setTab('problems'); setOpen((o) => ({ ...o, inspector: true })); }}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <Panel title={m.panelPalette} side="left" open={open.palette} onToggle={() => setOpen((o) => ({ ...o, palette: !o.palette }))} m={m} className="order-2 lg:order-1" testId="panel-palette">
          <ScenePalette
            onAdd={(symbol) => addSymbol(symbol)}
            onDragStart={(symbol) => setPaletteDrag({ symbol })}
            recent={recent}
            locale={locale}
            messages={props.panelMessages?.palette}
            className="flex-1 p-3"
          />
        </Panel>

        <div ref={canvasHost} className="relative order-1 min-h-[20rem] min-w-0 flex-1 lg:order-2">
          <SceneEditorCanvas
            ref={canvasRef}
            settings={settings} model={drawModel} geo={geo}
            selection={selection} setSelection={setSelection} apply={apply}
            tool={tool} setTool={setTool}
            viewport={effective} base={base} size={size} onViewport={setViewport} onSize={setSize}
            grid={grid} guides={guides} linkKind={linkKind}
            locked={locked} hidden={hidden} actionIds={host.actionIds}
            m={m} announce={say}
            onDropSymbol={(symbol, at) => addSymbol(symbol, at)}
            onPointer={(p) => { lastPointer.current = p; }}
            paletteDrag={paletteDrag}
            renaming={renaming} onRename={commitRename} onRenameCancel={() => setRenaming(null)} onRequestRename={setRenaming}
            onCancelGroup={cancelGroup}
            things={things} anchors={anchors} inspectedThing={inspected?.id ?? null}
            onInspectThing={(id) => { setPeek(id); if (id) { setTab('properties'); say(fill(m.thingInspected, { name: things.find((h) => h.id === id)?.name ?? id })); } }}
          />
          <div className="pointer-events-none absolute bottom-3 right-3 hidden sm:block">
            <SceneMinimap className="pointer-events-auto" settings={settings} geo={geo} base={base} view={view} onCenter={moveView} label={m.minimap} />
          </div>
        </div>

        <Panel title={m.panelInspector} side="right" open={open.inspector} onToggle={() => setOpen((o) => ({ ...o, inspector: !o.inspector }))} m={m} className="order-3" testId="panel-inspector" wide>
          <div role="tablist" aria-label={m.tabs} className="flex overflow-x-auto border-b border-border px-3" onKeyDown={onTabKey}>
            {tabs.map((t) => (
              <button
                key={t.id}
                id={`scene-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                aria-controls={`scene-tabpanel-${t.id}`}
                tabIndex={activeTab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus', activeTab === t.id ? 'border-primary font-medium text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary')}
              >
                {t.label}
                {t.badge ? <span className="rounded-full bg-warning-subtle px-1.5 text-xs text-warning-fg">{t.badge}</span> : null}
              </button>
            ))}
          </div>
          <div id={`scene-tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`scene-tab-${activeTab}`} className="min-h-0 flex-1 overflow-auto p-3">
            {(activeTab === 'properties' || activeTab === 'rules') && <SceneInspector ctx={ctx} tab={activeTab} showTabs={false} messages={props.panelMessages?.inspector} rulesMessages={props.panelMessages?.rules} />}
            {activeTab === 'actions' && (selectedElements.length === 1 && selectionCount(selection) === 1 ? host.renderActions?.(selectedElements[0]) : <p className="text-sm text-text-secondary">{m.actionsHint}</p>)}
            {activeTab === 'problems' && <SceneProblems ctx={ctx} onSelect={focusProblem} onOpenRule={() => setTab('rules')} messages={props.panelMessages?.problems} />}
            {activeTab === 'whatif' && <SceneWhatIf ctx={ctx} value={whatIf} onChange={setWhatIf} messages={props.panelMessages?.whatIf} />}
          </div>
        </Panel>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="scene-live">{live}</div>

      {pasteBox && (
        <Overlay label={m.pasteTitle} onEscape={() => setPasteBox(null)}>
          <h3 className="text-sm font-semibold">{m.pasteTitle}</h3>
          <p className="mt-1 text-sm text-text-secondary">{m.pasteBody}</p>
          <textarea
            aria-label={m.pasteLabel}
            value={pasteBox.text}
            onChange={(e) => setPasteBox({ text: e.target.value, error: null })}
            rows={6}
            spellCheck={false}
            className="mt-3 w-full rounded-md border border-border bg-surface-base p-2 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          {pasteBox.error && <p role="alert" className="mt-1 text-xs text-error">{pasteBox.error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPasteBox(null)}>{m.pasteCancel}</Button>
            <Button size="sm" data-testid="paste-insert" onClick={() => { const why = insertText(pasteBox.text); if (why) setPasteBox({ text: pasteBox.text, error: why }); else setPasteBox(null); }}>{m.pasteInsert}</Button>
          </div>
        </Overlay>
      )}

      <ConfirmDialog
        open={confirming}
        portalTarget={root}
        title={m.dirtyTitle}
        message={m.dirtyBody}
        tone="danger"
        confirmLabel={m.dirtyDiscard}
        cancelLabel={m.dirtyKeep}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); onClose(); }}
      />
    </div>
  );
}

/** A collapsible side panel: a column at lg and above, a stacked section below. */
function Panel({ title, side, open, onToggle, m, className, children, testId, wide }: {
  title: string; side: 'left' | 'right'; open: boolean; onToggle: () => void; m: SceneEditorMessages; className?: string; children: ReactNode; testId: string; wide?: boolean;
}) {
  const Icon = open ? (side === 'left' ? faChevronLeft : faChevronRight) : (side === 'left' ? faChevronRight : faChevronLeft);
  return (
    <aside
      data-testid={testId}
      data-open={open}
      className={cn('flex min-h-0 flex-col border-t border-border bg-surface-raised transition-[width] motion-reduce:transition-none lg:border-t-0', side === 'left' ? 'lg:border-r' : 'lg:border-l', open ? cn('max-h-80 lg:max-h-none', wide ? 'lg:w-[26rem]' : 'lg:w-72') : 'lg:w-10', className)}
    >
      <div className={cn('flex items-center justify-between gap-2 border-b border-border px-2 py-1.5', !open && 'lg:flex-col lg:border-b-0')}>
        <h3 className={cn('text-xs font-semibold uppercase tracking-wide text-text-secondary', !open && 'lg:[writing-mode:vertical-rl]')}>{title}</h3>
        <Button variant="ghost" size="xs" iconOnly onClick={onToggle} aria-expanded={open} aria-label={fill(open ? m.collapse : m.expand, { panel: title })} data-testid={`${testId}-toggle`}>
          <FontAwesomeIcon icon={Icon} aria-hidden="true" className="hidden lg:inline" />
          <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} aria-hidden="true" className="lg:hidden" />
        </Button>
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-auto', !open && 'hidden')}>{children}</div>
    </aside>
  );
}

/** A dialog drawn inside the editor (no `window.confirm`, no portal): it covers the page, takes the focus and keeps it. */
function Overlay({ label, onEscape, children }: { label: string; onEscape: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('textarea, button')?.focus();
    return () => { prev?.focus?.(); };
  }, []);
  const key = (e: ReactKeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }
    if (e.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input, select')];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-text-primary/30 p-4" onKeyDown={key}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-4 shadow-xl">
        {children}
      </div>
    </div>
  );
}
