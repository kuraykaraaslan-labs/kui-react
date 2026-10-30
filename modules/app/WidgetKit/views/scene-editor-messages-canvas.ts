// The words of the editor shell and canvas (English defaults). A host overrides any of them through the editor's
// `messages` prop; `{name}` style tokens are filled by `fill`. The panels (palette, inspector, problems, what-if) carry
// their own words.

export interface SceneEditorMessages {
  title: string;
  toolbar: string;
  tools: string;
  save: string;
  canvas: string;
  canvasHint: string;
  // Tools
  toolSelect: string; toolConnect: string; toolPan: string; toolText: string; toolZone: string; toolDivider: string;
  // Toolbar
  undo: string; redo: string; zoomIn: string; zoomOut: string; zoomFit: string; zoomLevel: string;
  grid: string; guides: string; align: string; distribute: string; order: string;
  alignLeft: string; alignCenter: string; alignRight: string; alignTop: string; alignMiddle: string; alignBottom: string;
  distributeH: string; distributeV: string;
  toFront: string; toBack: string; forward: string; backward: string;
  duplicate: string; delete: string; copy: string; paste: string; connectSelected: string;
  saveAssembly: string; insertAssembly: string; assemblyName: string; assemblyDefault: string; libraryEmpty: string; libraryRemove: string;
  linkKind: string; layers: string; layersFilter: string; lock: string; unlock: string; hide: string; show: string; unlockAll: string; showAll: string;
  problemsCount: string; problemsOne: string; noProblems: string;
  // Shell
  panelPalette: string; panelInspector: string; collapse: string; expand: string;
  actionsHint: string; tabProperties: string; tabRules: string; tabActions: string; tabProblems: string; tabWhatIf: string; tabs: string;
  apply: string; applying: string; close: string;
  dirtyTitle: string; dirtyBody: string; dirtyDiscard: string; dirtyKeep: string; applyFailed: string; applied: string;
  // Paste box
  pasteTitle: string; pasteBody: string; pasteInsert: string; pasteCancel: string; pasteLabel: string;
  // Canvas
  rename: string; renameLabel: string; minimap: string; actionDot: string; hiddenByRule: string; elementLabel: string; shapeLabel: string; linkLabel: string;
  /** The locked layer of things from data: the dimmed box's tooltip, and what is announced when one is clicked. */
  thingLayer: string; thingInspected: string;
  handleOwnSize: string; handleResize: string; handleReconnect: string; handleMid: string; port: string;
  // Announcements
  addedElement: string; addedShape: string; connected: string; movedOne: string; movedMany: string; deleted: string; deletedMany: string;
  renamed: string; refused: string; copied: string; pasted: string; duplicated: string; selectedOne: string; selectedMany: string; selectedNone: string;
  undone: string; redone: string; resized: string; reconnected: string; midMoved: string; alignedMsg: string; distributedMsg: string;
  assemblySaved: string; assemblyInserted: string; locked: string; unlocked: string; hidden: string; shown: string;
  notDiagramPiece: string; nothingToCopy: string; pasteRefused: string; tool: string;
  /** The connect tool, said when it is chosen (how to join two symbols: two clicks, or a drag between ports), after the first click, and when the second lands on nothing. */
  connectHint: string; connectFirst: string; connectCancelled: string;
}

export const SCENE_EDITOR_MESSAGES: SceneEditorMessages = {
  title: 'Diagram editor',
  toolbar: 'Diagram tools',
  tools: 'Tools',
  save: 'Save',
  canvas: 'Diagram canvas',
  canvasHint: 'Arrow keys move the selection, Delete removes it, F2 renames it.',
  toolSelect: 'Select', toolConnect: 'Connect', toolPan: 'Pan', toolText: 'Title', toolZone: 'Zone', toolDivider: 'Divider',
  undo: 'Undo', redo: 'Redo', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomFit: 'Fit to view', zoomLevel: 'Zoom {percent}%',
  grid: 'Grid', guides: 'Guides', align: 'Align', distribute: 'Distribute', order: 'Order',
  alignLeft: 'Align left', alignCenter: 'Align centres', alignRight: 'Align right', alignTop: 'Align top', alignMiddle: 'Align middles', alignBottom: 'Align bottom',
  distributeH: 'Distribute horizontally', distributeV: 'Distribute vertically',
  toFront: 'Bring to front', toBack: 'Send to back', forward: 'Bring forward', backward: 'Send backward',
  duplicate: 'Duplicate', delete: 'Delete', copy: 'Copy', paste: 'Paste', connectSelected: 'Connect the two selected symbols',
  saveAssembly: 'Save the selection as a reusable piece', insertAssembly: 'Insert a saved piece', assemblyName: 'Name of the piece',
  assemblyDefault: 'Piece {n}', libraryEmpty: 'No saved pieces yet.', libraryRemove: 'Remove {name} from the library',
  linkKind: 'Connection kind', layers: 'Layers', layersFilter: 'Find an item', lock: 'Lock', unlock: 'Unlock', hide: 'Hide', show: 'Show',
  unlockAll: 'Unlock all', showAll: 'Show all',
  problemsCount: '{count} problems', problemsOne: '1 problem', noProblems: 'No problems',
  panelPalette: 'Symbols', panelInspector: 'Inspector', collapse: 'Collapse {panel}', expand: 'Expand {panel}',
  actionsHint: 'Select one symbol to edit its actions.', tabProperties: 'Properties', tabRules: 'Rules', tabActions: 'Actions', tabProblems: 'Problems', tabWhatIf: 'What-if', tabs: 'Inspector sections',
  apply: 'Save', applying: 'Saving', close: 'Close',
  dirtyTitle: 'Discard your changes?', dirtyBody: 'The drawing has changes that are not saved.', dirtyDiscard: 'Discard changes', dirtyKeep: 'Keep editing',
  applyFailed: 'The diagram could not be applied.', applied: 'Applied',
  pasteTitle: 'Paste a diagram piece', pasteBody: 'This browser did not let the editor read the clipboard. Paste the copied text here.',
  pasteInsert: 'Insert', pasteCancel: 'Cancel', pasteLabel: 'Copied diagram piece',
  rename: 'Rename', renameLabel: 'New name', minimap: 'Overview', actionDot: 'Has actions', hiddenByRule: 'Hidden by a rule', elementLabel: '{name}, {symbol}, at {x}, {y}',
  thingLayer: '{name}: placed by data', thingInspected: '{name} is placed by data and moves with its row',
  shapeLabel: '{kind} {text}', linkLabel: 'Connection from {from} to {to}',
  handleOwnSize: 'Resize the symbol', handleResize: 'Resize', handleReconnect: 'Move the connection end', handleMid: 'Move the middle leg', port: 'Port {side} of {name}',
  addedElement: 'Added {name} at {x}, {y}', addedShape: 'Added a {kind} at {x}, {y}', connected: 'Connected {from} to {to}',
  movedOne: 'Moved {name} to {x}, {y}', movedMany: 'Moved {count} items', deleted: 'Deleted {name}', deletedMany: 'Deleted {count} items',
  renamed: 'Renamed {from} to {to}', refused: '{reason}', copied: 'Copied {count} items', pasted: 'Pasted {count} items', duplicated: 'Duplicated {count} items',
  selectedOne: 'Selected {name}', selectedMany: 'Selected {count} items', selectedNone: 'Selection cleared',
  undone: 'Undone', redone: 'Redone', resized: 'Resized {name}', reconnected: 'Moved the end of the connection to {name}', midMoved: 'Moved the middle leg',
  alignedMsg: 'Aligned {count} items', distributedMsg: 'Distributed {count} items',
  assemblySaved: 'Saved {name} to the library', assemblyInserted: 'Inserted {name}', locked: 'Locked {count} items', unlocked: 'Unlocked {count} items',
  hidden: 'Hid {count} items', shown: 'Showed {count} items',
  notDiagramPiece: 'This is not a diagram piece.', nothingToCopy: 'Select something to copy first.', pasteRefused: 'The clipboard could not be read.',
  tool: '{tool} tool',
  connectHint: 'Connect tool: click a symbol, then the symbol to join it to. Or drag from a port circle to another one.',
  connectFirst: 'Now click the symbol to join {name} to (Escape cancels)',
  connectCancelled: 'Nothing to join there: the connection was not drawn.',
};

export type SceneEditorMessagesOverride = Partial<SceneEditorMessages>;

/** The defaults with the host's words laid over them. */
export const mergeEditorMessages = (o?: SceneEditorMessagesOverride): SceneEditorMessages => (o ? { ...SCENE_EDITOR_MESSAGES, ...o } : SCENE_EDITOR_MESSAGES);

/** Fills `{token}` placeholders; a token with no value stays as written. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(vars, k) ? String(vars[k]) : m));
}
