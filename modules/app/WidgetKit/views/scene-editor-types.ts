// The contract between the pieces of the process diagram editor (types only, no code): the canvas and shell
// (`SceneEditor.tsx`) and the panels it hosts (`ScenePalette`, `SceneInspector`, `SceneProblems`, `SceneWhatIf`). Each
// piece is a controlled component that reads the context and edits through `apply`; the pure edit operations are in
// `scene-edit-logic.ts`, the rules in `scene-rules-logic.ts`.

import type { ReactNode } from 'react';
import type { SlotData } from '../kind';
import type { EditResult, Selection } from './scene-edit-logic';
import type { SceneModel, SceneSettings } from './scada-scene-logic';
import type { SceneEditorMessagesOverride } from './scene-editor-messages-canvas';

/** What the host (next-boilerplate, a showcase) gives the editor beyond the diagram itself. */
export interface EditorHost {
  /** The host's action editor for one symbol (click, double click, right click, commands); shown in the Actions tab. Absent: no tab. */
  renderActions?: (elementId: string) => ReactNode;
  /** Ids of symbols that have actions: drawn with a small dot on the canvas. */
  actionIds?: ReadonlySet<string>;
  /** The board's parameters rules can read (key, a label, example values for pickers). */
  params?: Array<{ key: string; label?: string; values?: string[] }>;
  /** The bound table's columns with their labels (for the rule form's pickers). */
  columns?: Array<{ key: string; label?: string }>;
  /** Called after a successful Apply, so the host can close its surface. */
  onApplied?: () => void;
}

/** Values the what-if panel puts over the real data while the editor is open (never stored). */
export interface WhatIfState {
  /** Row id -> column -> value, laid over the bound table's rows. */
  rows: Record<string, Record<string, unknown>>;
  /** Board parameter overrides. */
  params: Record<string, unknown>;
}

/** What every panel receives. `settings` and `model` are the CURRENT draft (with what-if values applied to the model). */
export interface EditorCtx {
  settings: SceneSettings;
  model: SceneModel;
  /** The real data (without what-if overrides) and the effective board parameters. */
  data: Record<string, SlotData | undefined>;
  params: Record<string, unknown>;
  selection: Selection;
  setSelection: (next: Selection) => void;
  /** Run one edit operation on the draft; `group` coalesces a drag into one undo step. */
  apply: (op: (s: SceneSettings) => EditResult, group?: string) => EditResult;
  host: EditorHost;
  locale?: string;
}

/** The props of the editor shell. */
export interface SceneEditorProps {
  settings: SceneSettings;
  data: Record<string, SlotData | undefined>;
  params?: Record<string, unknown>;
  host?: EditorHost;
  locale?: string;
  title?: string;
  /** Apply: the host saves the settings. Resolve to close, reject to stay (the host shows its own message). */
  onApply: (settings: SceneSettings) => void | Promise<void>;
  onClose: () => void;
  /** The host's number words (unit included), as `sceneModel` takes them. */
  format?: (n: number, own?: { unit?: string; decimals?: number }) => string;
  /** The host's words for the shell and canvas (any subset of the English defaults). */
  messages?: SceneEditorMessagesOverride;
  /** The localStorage key of the saved pieces and recent symbols (default `kui.scada.editor`); the editor works without storage. */
  storageKey?: string;
  className?: string;
}
