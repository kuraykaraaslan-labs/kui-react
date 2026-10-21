// A stand-in for the editor shell the panel tests render in (not a test file): it keeps the scene in a real undo history,
// builds the drawn model like the shell does and hands the panel the context the contract describes.
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SlotData } from '../kind';
import { sceneModel, type SceneSettings } from '../views/scada-scene-logic';
import { apply as applyHistory, canRedo, canUndo, createHistory, redo, undo, type History } from '../views/scene-edit-history';
import type { EditResult, Selection } from '../views/scene-edit-core';
import type { EditorCtx, EditorHost } from '../views/scene-editor-types';

export interface Probe {
  ctx: EditorCtx;
  history: History;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Harness({
  initial, selection: initialSelection = {}, data = {}, params = {}, host = {}, probe, children,
}: {
  initial: SceneSettings;
  selection?: Selection;
  data?: Record<string, SlotData | undefined>;
  params?: Record<string, unknown>;
  host?: EditorHost;
  probe?: { current: Probe | null };
  children: (ctx: EditorCtx) => ReactNode;
}) {
  const [history, setHistory] = useState<History>(() => createHistory(initial));
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const ref = useRef(history);
  ref.current = history;
  const run = (op: (s: SceneSettings) => EditResult, group?: string): EditResult => {
    const { history: next, result } = applyHistory(ref.current, op, group);
    ref.current = next;
    setHistory(next);
    return result;
  };
  const ctx: EditorCtx = {
    settings: history.present, model: sceneModel(history.present, data, { params }), data, params, selection, setSelection, apply: run, host,
  };
  if (probe) {
    probe.current = {
      ctx, history,
      undo: () => { ref.current = undo(ref.current); setHistory(ref.current); },
      redo: () => { ref.current = redo(ref.current); setHistory(ref.current); },
      canUndo: canUndo(history), canRedo: canRedo(history),
    };
  }
  return <>{children(ctx)}</>;
}

export const newProbe = (): { current: Probe | null } => ({ current: null });
