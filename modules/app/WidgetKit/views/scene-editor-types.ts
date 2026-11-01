// The contract between the pieces of the process diagram editor (types only, no code): the canvas and shell
// (`SceneEditor.tsx`) and the panels it hosts (`ScenePalette`, `SceneInspector`, `SceneProblems`, `SceneWhatIf`). Each
// piece is a controlled component that reads the context and edits through `apply`; the pure edit operations are in
// `scene-edit-logic.ts`, the rules in `scene-rules-logic.ts`.

import type { ReactNode } from 'react';
import type { SlotData } from '../kind';
import type { EditResult, Selection } from './scene-edit-logic';
import type { SceneModel, SceneSettings } from './scada-scene-logic';
import type { ProblemCheck } from './scene-edit-problems';
import type { SceneInspectorProps } from './SceneInspector';
import type { SceneProblemsProps } from './SceneProblems';
import type { ScenePaletteProps } from './ScenePalette';
import type { SceneRulesEditorProps } from './SceneRulesEditor';
import type { SceneWhatIfProps } from './SceneWhatIf';
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
  /**
   * The values a symbol of the drawing draws (its `symbol` is the library key it is drawn with), with the names a person knows them by (`value` is
   * "Reading"): what a rule's "Which value" offers for that symbol (next-boilerplate e2e round 5, E14). Absent, or undefined for a symbol: the
   * columns are offered.
   */
  symbolValues?: (element: { id: string; symbol: string }) => ReadonlyArray<{ key: string; label?: string }> | undefined;
  /** Called after a successful Apply, so the host can close its surface. */
  onApplied?: () => void;
  /** True while the host holds edits of its own that Apply would save (for example symbol actions): enables Apply and guards Close. */
  dirty?: boolean;
  /** Called when the author renames a symbol (in the inspector or in place), so the host can carry what hangs off the id (its actions). */
  onRename?: (from: string, to: string) => void;
  /** The host's own checks, added to the problems list and its count (for example symbol actions that would be dropped). */
  problems?: ProblemCheck;
}

/** Values the what-if panel puts over the real data while the editor is open (never stored). */
export interface WhatIfState {
  /** Row id -> column -> value, laid over the bound table's rows. */
  rows: Record<string, Record<string, unknown>>;
  /** Board parameter overrides. */
  params: Record<string, unknown>;
  /** Sample rows added to the things table (in its own columns), to preview things and their rules. */
  things?: Array<Record<string, unknown>>;
}

/** A thing from data the author clicked on the canvas: shown read-only in the inspector (it is placed by its row). */
export interface InspectedThing {
  id: string;
  /** Its name on the diagram (a rule's label, its row's, or its id). */
  name: string;
  /** The row that placed it (a what-if sample row included). */
  row: Record<string, unknown>;
  /** True for a what-if sample row (never stored). */
  sample?: boolean;
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
  /** A thing from data the author clicked: the inspector shows it read-only ("placed by data"). */
  thing?: InspectedThing | null;
}

/** The words of the panels, for a host that translates them (each is a partial: what is missing stays English). */
export interface EditorPanelMessages {
  palette?: ScenePaletteProps['messages'];
  inspector?: SceneInspectorProps['messages'];
  rules?: SceneRulesEditorProps['messages'];
  problems?: SceneProblemsProps['messages'];
  whatIf?: SceneWhatIfProps['messages'];
}

/** The props of the editor shell. */
/**
 * One action of the host in the editor's header menu ("More actions"): next-boilerplate phase 50 puts "Make a 3D view of this drawing" there. `onSelect`
 * is told whether the drawing has changes that are not saved yet, so a host that works on the saved drawing can ask to save first.
 */
export interface SceneEditorMenuItem {
  id: string;
  label: string;
  onSelect: (state: { dirty: boolean }) => void;
  disabled?: boolean;
  /** Why the item is disabled, shown under it while it is. */
  disabledReason?: string;
}

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
  /** The words of the palette, inspector, rules, problems and what-if panels. */
  panelMessages?: EditorPanelMessages;
  /** The localStorage key of the saved pieces and recent symbols (default `kui.scada.editor`); the editor works without storage. */
  storageKey?: string;
  /** The host's actions, in a "More actions" menu of the header (none: no menu). */
  menuItems?: readonly SceneEditorMenuItem[];
  className?: string;
}
