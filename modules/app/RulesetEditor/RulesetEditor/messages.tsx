'use client';
import { createContext, Fragment, useContext, useMemo, type ReactNode } from 'react';
import { paramIssueMessage } from '../catalog/params';
import { issueMessage, type IssueCode } from '../graph/validate';
import type { ShortcutGroup, ShortcutId } from './shortcuts';
import type { CodeEditorMessages } from '@/modules/ui/CodeEditor';

/**
 * The words of the editor chrome, so a host can translate them: pass `messages` (any part of it) to `RulesetEditor`,
 * `FlowWorkspace` or `InsightPanel`; what is not passed stays English (the kui convention of `DataTable`). A message
 * that needs a number or a name is a function. Block titles, descriptions and param labels come from the catalog, not
 * from here. Parts not yet moved here are listed in docs/phases/08-automation/99-progress.md of next-boilerplate.
 */
export type EditorMessages = {
  /* context menu */
  menuChangePort: string; portDialogTitle: string; portDialogLabel: string; portDialogSave: string;
  portDialogIntro: (blockLabel: string) => string;
  portAlreadyConnected: (portLabel: string) => string;
  menuAddComment: string; noteEmpty: string;
  noteAria: (text: string) => string;
  menuView: string; menuEdit: string; menuSelectNodes: string; menuEditGroup: string; menuUngroup: string;
  menuDebugNode: string; menuSkip: string; menuWakeUp: string; menuGroup: string;
  menuAddBlockBetween: string; menuDeleteConnection: string; menuAddBlockHere: string;
  menuPaste: string; menuUndo: string; menuRedo: string; menuSelectAll: string; menuArrange: string; menuFit: string;
  menuDebugChain: string;
  menuCopy: (count: number) => string;
  menuCut: (count: number) => string;
  menuDuplicate: (count: number) => string;
  menuDelete: (count: number) => string;
  menuAdd: (blockTitle: string) => string;
  /* dialogs opened by the editor */
  pickerTitle: string; groupNewTitle: string; groupEditTitle: string; groupConfirm: string; groupSave: string;
  /* canvas */
  addNodeSheet: string; nodesButton: string;
  /* palette */
  paletteLabel: string; paletteTitle: string; paletteClose: string; paletteSearchLabel: string; paletteSearchPlaceholder: string;
  paletteNoMatch: string; paletteDebugChain: string;
  paletteAdd: (blockTitle: string) => string;
  /* the find box (Ctrl+F) */
  findLabel: string; findPlaceholder: string; findNone: string; findPrev: string; findNext: string; findClose: string;
  findCount: (current: number, total: number) => string;
  /* keyboard shortcuts: the sheet and its words (the keys themselves are the table in `shortcuts.ts`) */
  shortcutsTitle: string; shortcutsIntro: string;
  shortcutText: (id: ShortcutId) => string;
  shortcutGroup: (group: ShortcutGroup) => string;
  /* canvas, its tool bar and its overlays */
  canvasLabel: string; canvasErrorPath: string; canvasEmpty: string; toolDeleteConnection: string;
  toolUndo: string; toolUndoTitle: string; toolRedo: string; toolRedoTitle: string; toolArrange: string;
  toolBox: string; toolBoxTitle: string; toolZoomOut: string; toolZoomIn: string; toolFit: string; toolMiniMap: string; toolFullscreen: string; toolExitFullscreen: string;
  issuesList: string;
  issuesSummary: (errors: number, warnings: number) => string;
  /* dialogs */
  dialogCancel: string; pickerSearchLabel: string; pickerSearchPlaceholder: string; pickerNoMatch: string;
  groupNameLabel: string; groupColourLegend: string; groupColourLabel: string;
  /* flow workspace: tabs, draft banner, merge and link dialogs, notices */
  wsLocale: string;
  wsDraftStale: string; wsRestore: string; wsDiscard: string; wsDismiss: string;
  wsConflictTitle: string; wsMerge: string; wsMerging: string; wsMergeExplain: string; wsMergeReadFail: string;
  wsMergedTitle: string; wsOk: string; wsBothSides: string; wsYouDeleted: string; wsNoBothSides: string; wsMergedHint: string;
  wsClose: string; wsLinkInTitle: string; wsLinkOutTitle: string; wsLinkShowCallers: string; wsLinkGoTo: string; wsNoCaller: string;
  wsFlowRunnersTitle: string; wsFlowTargetTitle: string; wsFlowShowRunners: string; wsFlowGoTo: string; wsNoRunner: string; wsNoFlowInput: string;
  wsLeaveConfirm: string; wsLeaveTitle: string; wsLeaveAction: string; wsLeaveStay: string; wsKeepDraftFail: string;
  wsDraftFound: (time: string) => string;
  wsConflictNewer: (whoWhen: string) => string;
  wsMergedSummary: (whoWhen: string, taken: number) => string;
  wsGroupName: (name: string) => string;
  wsNoLinkIn: (names: string) => string;
  /* param form (the fields of a block) */
  formUnit: string; formChoose: string; formUnchanged: string; formSecretStored: string; formOther: string; formOtherValue: string;
  formCommaNumbers: string; formComma: string; formValueType: string; formValue: string; formValueNow: string; formAddRule: string;
  formKindNum: string; formKindStr: string; formKindBool: string; formKindJson: string; formKindPath: string; formKindExpr: string;
  formKindEnv: string; formKindNow: string;
  /** Monday to Sunday, seven short names */
  formWeekdays: string[];
  formRule: (n: number) => string;
  formRemoveRule: (n: number) => string;
  formNotAvailable: (value: string) => string;
  formInvalidJson: (reason: string) => string;
  /* insight panel */
  insPanel: string; insTabDebug: string; insTabBusiest: string; insTabErrors: string; insTabData: string; insShowBlock: string;
  insSortBy: string; insSortIn: string; insSortMs: string; insSortErrors: string; insColBlock: string; insColIn: string; insColOut: string;
  insColErrors: string; insColMs: string; insNoBusiest: string;
  insScope: string; insStore: string; insScopeFlow: string; insScopeGlobal: string; insScopeSys: string; insStoreMemory: string; insStorePersist: string;
  insSysNoLimit: string; insNoSize: string; insFillLabel: string; insFillAria: string;
  insKindLabel: string; insKindAll: string; insKindProblem: string; insKindMsg: string; insSelectedBlock: string; insResume: string; insPause: string;
  insSave: string; insClear: string; insSelectBlock: string; insNoMessages: string;
  insCopyAll: string; insCopyOne: string; insSourceLabel: string; insScopeAllFlows: string; insTopic: string;
  insMore: (n: number) => string;
  insCut: (bytes: number) => string;
  insErrRunning: string; insErrLast: string; insErrBlock: string; insErrError: string; insErrCount: string; insNotCaught: string; insNoErrors: string;
  insCaughtRecent: string; insCaughtBy: string; insErrPort: string; insShowCatcher: string; insErrCounters: string;
  insFill: (label: string, bytes: string, limit: string, pct: number) => string;
  insSegEvents: string; insSegContext: string; insEventsHint: string; insNoEvents: string; insUseTrigger: string; insReload: string; insChange: string; insDeleteKey: string;
  insNothingStored: string; insLoading: string; insSaveFirst: string; insAdminOnly: string;
  insErrorsN: (n: number) => string;
  /* the words of the problems the pure layers find: the graph checks (the issues on the canvas, in the panel and the problems list),
     and the value checks of a field. Each is one function the host can replace (a switch over the code); the
     default is the English text the layer itself produces. */
  issueText: (code: IssueCode, arg?: string, param?: string) => string;
  paramIssueText: (code: 'required' | 'number' | 'min' | 'max' | 'int' | 'enum' | 'max_len' | 'pattern', label: string, limit?: number) => string;
  /* a block on the canvas */
  nodeNotAvailable: string; nodeSkipped: string;
  /** the badge of a block in a version compare (`diffTint`) */
  diffAdded: string; diffChanged: string; diffRemoved: string;
  nodeAriaLabel: (label: string, kindTitle: string, skipped: boolean, problems: number) => string;
  nodeAriaPlaceholder: (label: string, originalType: string) => string;
  /** the line of the hover card that names the kind of block: the type, then the block's title */
  nodeTipKind: (type: string, blockTitle: string) => string;
  /* texts with a marked part: `{name}` stands for a part the editor draws itself (a port dot, a block type); see `fillTemplate` */
  paletteHelpAdd: string; paletteHelpWire: string; paletteHelpEdit: string; canvasEmptyWire: string; panelPlaceholderBody: string;
  panelSourceKui: string; panelSourceNodeRed: string; panelSourceRoltek: string;
  /** the eight names of the group colours, in the order of the swatches */
  groupColours: string[];
  /* node panel */
  panelLabel: (nodeLabel: string) => string;
  scriptSignatureLabel: string; scriptApiTitle: string;
  panelTabsLabel: string; panelTabSettings: string; panelTabHelp: string; panelHelpNone: string; panelHelpPorts: string;
  panelDescriptionLabel: string; panelDescriptionHint: string; panelNotAvailable: string; panelDebugNode: string; panelDeleteNode: string; panelClose: string; panelNameLabel: string;
  panelProblems: string; panelAvailableInputs: string; panelIn: string; panelOut: string; panelResetScript: string;
  panelAppliesAsYouType: string; panelPlaceholderTitle: string; panelOriginalType: string; panelSource: string;
  panelOriginalSettings: string;
  /* live activity on the canvas (09 §9.5) and dragging a connection's end (UI-31) */
  edgeCount: (count: number) => string;
  edgeActivityTitle: (count: number, window?: string) => string;
  /** a block's counters, in its hover card and the Messages tab; null where the host counts nothing */
  nodeCounters: (inCount: number | null, outCount: number | null, errors: number | null, window?: string) => string;
  edgeHandleSource: string; edgeHandleTarget: string;
  /* the node panel's Messages tab (UI-33) and its script test (06 §6.7) */
  panelTabMessages: string; panelMessagesNone: string; panelMessagesHidden: string; panelMessageIn: string; panelMessageTest: string; panelTestScript: string;
  panelMessageOut: (port?: string) => string;
  panelMessageRun: (run: string) => string;
  /** the words of the kui CodeEditor in the code fields and the script test (toolbar, find bar, lists); English where not given */
  codeEditor: Partial<CodeEditorMessages>;
  /** who found a problem the code field lists: the browser's own check, or the test run */
  scriptCheckSource: string; scriptTestSource: string;
  scriptTestTitle: (blockLabel: string) => string;
  scriptTestIntro: string; scriptTestRun: string; scriptTestRunning: string; scriptTestSave: string; scriptTestCode: string;
  scriptTestMsgType: string; scriptTestOriginatorType: string; scriptTestOriginatorId: string; scriptTestPayload: string; scriptTestMetadata: string;
  scriptTestContext: string; scriptTestContextHint: string; scriptTestBadJson: string; scriptTestBadObject: string;
  scriptTestResult: string; scriptTestNoResult: string; scriptTestFailed: string; scriptTestNoOutput: string; scriptTestLog: string; scriptTestStatus: string;
  scriptTestContextWrites: string;
  scriptTestErrorAt: (line: number, column?: number) => string;
  scriptTestOutput: (port: string) => string;
  scriptTestCpu: (ms: number) => string;
  /* the side bar: deploy problems in Errors (item 4), the Block, Help, Trace and Runs tabs (item 6) */
  insDeployProblems: string; insProblemError: string; insProblemWarning: string;
  insTabBlock: string; insTabHelp: string; insTabTrace: string; insTabRuns: string; sideBarPickBlock: string;
  /* the side bar's tab strip and the tool bar button that shows and hides it */
  insMoreTabs: string; toolSidePanelShow: string; toolSidePanelHide: string;
  /* the outputs of a block with a count of outputs (the script block): the list in the panel and its dialog */
  outputsEdit: string; outputsTitle: string; outputsIntro: string; outputsName: string; outputsNamePlaceholder: string; outputsNote: string;
  outputsAdd: string; outputsSave: string; outputsUnnamed: string; outputsExampleTitle: string; outputsExampleEach: string;
  outputsNameChars: string; outputsNameDuplicate: string; outputsNameReserved: string;
  outputsNameLong: (max: number) => string;
  outputsTooLong: (max: number) => string;
  outputsRow: (n: number) => string;
  outputsRemove: (n: number) => string;
  outputsMove: (n: number) => string;
  outputsMoved: (n: number, to: number) => string;
  outputsExampleTo: (n: number, name?: string) => string;
};

export const DEFAULT_MESSAGES: EditorMessages = {
  menuChangePort: 'Change port…', portDialogTitle: 'Change the output', portDialogLabel: 'Output', portDialogSave: 'Change',
  portDialogIntro: (label) => `Choose the output of "${label}" this connection leaves from.`,
  portAlreadyConnected: (label) => `${label} (already connected there)`,
  menuAddComment: 'Add a comment here', noteEmpty: 'Empty comment',
  noteAria: (text) => `Comment: ${text.length > 60 ? `${text.slice(0, 60)}…` : text}`,
  menuView: 'View', menuEdit: 'Edit', menuSelectNodes: 'Select the nodes', menuEditGroup: 'Edit the group…', menuUngroup: 'Ungroup',
  menuDebugNode: 'Debug node', menuSkip: 'Skip', menuWakeUp: 'Wake up', menuGroup: 'Group…',
  menuAddBlockBetween: 'Add a block in between…', menuDeleteConnection: 'Delete connection',
  menuAddBlockHere: 'Add a block here…', menuPaste: 'Paste', menuUndo: 'Undo', menuRedo: 'Redo', menuSelectAll: 'Select all',
  menuArrange: 'Arrange the blocks', menuFit: 'Fit to screen', menuDebugChain: 'Debug chain',
  menuCopy: (n) => (n > 1 ? `Copy ${n} nodes` : 'Copy'),
  menuCut: (n) => (n > 1 ? `Cut ${n} nodes` : 'Cut'),
  menuDuplicate: (n) => (n > 1 ? `Duplicate ${n} nodes` : 'Duplicate'),
  menuDelete: (n) => (n > 1 ? `Delete ${n} nodes` : 'Delete'),
  menuAdd: (title) => `Add ${title}`,
  pickerTitle: 'Add a block', groupNewTitle: 'Group the selected nodes', groupEditTitle: 'Edit the group', groupConfirm: 'Group', groupSave: 'Save',
  addNodeSheet: 'Add a node', nodesButton: 'Nodes',
  paletteLabel: 'Node palette', paletteTitle: 'Node Types', paletteClose: 'Close palette', paletteSearchLabel: 'Search node types',
  paletteSearchPlaceholder: 'Search…', paletteNoMatch: 'No node type matches.', paletteDebugChain: 'Debug Chain',
  paletteAdd: (title) => `Add ${title} node`,
  findLabel: 'Find a block', findPlaceholder: 'Name, type, description or id', findNone: 'No match', findPrev: 'Previous match', findNext: 'Next match', findClose: 'Close the find box',
  findCount: (current, total) => `${current} of ${total}`,
  shortcutsTitle: 'Keyboard shortcuts', shortcutsIntro: 'Click the canvas first, so the keys go to the editor.',
  shortcutText: (id) => ({
    undo: 'Undo', redo: 'Redo', selectAll: 'Select all blocks', copy: 'Copy the selection', cut: 'Cut the selection', paste: 'Paste', duplicate: 'Duplicate the selection',
    delete: 'Delete the selection or the connection', edit: 'Open the selected block', menu: 'Open the menu of the selection', cancel: 'Cancel a connection',
    note: 'Add a comment', save: 'Save', help: 'Show this list', find: 'Find a block',
  } as Record<ShortcutId, string>)[id],
  shortcutGroup: (group) => ({ edit: 'Edit', select: 'Select and open', view: 'View' } as Record<ShortcutGroup, string>)[group],
  canvasLabel: 'Rule chain canvas', canvasErrorPath: 'Error path: where errors of this node go', canvasEmpty: 'Drag nodes from the palette to start',
  toolDeleteConnection: 'Delete connection', toolUndo: 'Undo', toolUndoTitle: 'Undo (Ctrl+Z)', toolRedo: 'Redo', toolRedoTitle: 'Redo (Ctrl+Y)',
  toolArrange: 'Arrange the blocks', toolBox: 'Select blocks with a frame', toolBoxTitle: 'Select blocks with a frame (or hold Shift and drag)',
  toolZoomOut: 'Zoom out', toolZoomIn: 'Zoom in', toolFit: 'Fit to screen', toolMiniMap: 'Mini map', toolFullscreen: 'Fullscreen', toolExitFullscreen: 'Exit fullscreen',
  issuesList: 'Problems',
  issuesSummary: (errors, warnings) => `Problems: ${errors} errors, ${warnings} warnings`,
  dialogCancel: 'Cancel', pickerSearchLabel: 'Search blocks', pickerSearchPlaceholder: 'Name, description or type', pickerNoMatch: 'No block matches.',
  groupNameLabel: 'Name', groupColourLegend: 'Colour', groupColourLabel: 'Group colour',
  wsLocale: 'en-GB',
  wsDraftStale: 'The flow changed on the server since: restoring replaces what is open now.', wsRestore: 'Restore', wsDiscard: 'Discard', wsDismiss: 'Dismiss',
  wsConflictTitle: 'This flow was saved by someone else', wsMerge: 'Merge', wsMerging: 'Merging…',
  wsMergeExplain: 'Merge keeps what only one side changed. Nothing is saved yet: look through the flow, then save.',
  wsMergeReadFail: 'Could not read the version on the server.',
  wsMergedTitle: 'Merged', wsOk: 'OK', wsBothSides: 'Changed on both sides; your version was kept:', wsYouDeleted: ' (you deleted it)',
  wsNoBothSides: 'Nothing was changed on both sides.', wsMergedHint: 'Look through the flow, then save. Undo goes back to your version before the merge.',
  wsClose: 'Close', wsLinkInTitle: 'Blocks that call this link in', wsLinkOutTitle: 'Where this link goes', wsLinkShowCallers: 'Show the blocks that call it',
  wsLinkGoTo: 'Go to the link in', wsNoCaller: 'No block calls this link in.',
  wsFlowRunnersTitle: 'Blocks that run this flow', wsFlowTargetTitle: 'The flow this block runs', wsFlowShowRunners: 'Show the blocks that run this flow',
  wsFlowGoTo: 'Go to the Flow input of that flow', wsNoRunner: 'No Run flow block runs this flow.', wsNoFlowInput: 'The flow this block runs has no Flow input block.',
  wsLeaveConfirm: 'You have changes that are not saved. Leave without saving them?',
  wsLeaveTitle: 'Leave without saving', wsLeaveAction: 'Leave', wsLeaveStay: 'Stay',
  wsKeepDraftFail: 'Save or undo your changes first: this browser cannot keep a draft.',
  wsDraftFound: (time) => `Unsaved changes from ${time} were kept in this browser.`,
  wsConflictNewer: (who) => `The version of ${who} is newer than the one you started from.`,
  wsMergedSummary: (who, taken) => `The version of ${who} was merged into your changes: ${taken} ${taken === 1 ? 'change' : 'changes'} taken from it.`,
  wsGroupName: (name) => `group ${name}`,
  wsNoLinkIn: (names) => `No link in is called ${names}.`,
  formUnit: 'Unit', formChoose: 'Choose…', formUnchanged: '(unchanged)', formSecretStored: 'A value is stored. Leave empty to keep it.',
  formOther: 'Other…', formOtherValue: 'Other value', formCommaNumbers: 'Comma separated numbers', formComma: 'Comma separated',
  formValueType: 'Type', formValue: 'Value', formValueNow: 'The time the message arrives.', formAddRule: 'Add rule',
  formKindNum: 'Number', formKindStr: 'Text', formKindBool: 'Yes / no', formKindJson: 'JSON', formKindPath: 'Variable', formKindExpr: 'Expression',
  formKindEnv: 'Environment variable', formKindNow: 'Current time',
  formWeekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  formRule: (n) => `Rule ${n}`,
  formRemoveRule: (n) => `Remove rule ${n}`,
  formNotAvailable: (value) => `${value} (not available now)`,
  formInvalidJson: (reason) => `Invalid JSON: ${reason}`,
  insPanel: 'Runtime insight', insTabDebug: 'Debug', insTabBusiest: 'Busiest', insTabErrors: 'Errors', insTabData: 'Data', insShowBlock: 'Show this block',
  insSortBy: 'Sort by', insSortIn: 'Messages in', insSortMs: 'Mean time', insSortErrors: 'Errors', insColBlock: 'Block', insColIn: 'In', insColOut: 'Out',
  insColErrors: 'Errors', insColMs: 'ms', insNoBusiest: 'No block has handled a message yet.',
  insScope: 'Scope', insStore: 'Store', insScopeFlow: 'This flow', insScopeGlobal: 'Global', insScopeSys: 'System (read only)', insStoreMemory: 'Memory',
  insStorePersist: 'Kept across restarts', insSysNoLimit: 'The system scope has no limit.', insNoSize: 'No size numbers from the host.',
  insFillLabel: 'The store of all flows', insFillAria: 'Context store used',
  insKindLabel: 'Kind of messages', insKindAll: 'All kinds', insKindProblem: 'Errors and warnings', insKindMsg: 'Messages only', insSelectedBlock: 'Selected block',
  insResume: 'Resume the messages', insPause: 'Pause the messages', insSave: 'Save the messages as a file', insClear: 'Clear the messages',
  insSelectBlock: 'Select a block on the canvas.', insNoMessages: 'No messages yet. Add a Debug block, connect it, save and switch the flow on.',
  insCopyAll: 'Copy all messages', insCopyOne: 'Copy this message', insSourceLabel: 'Show messages of', insScopeAllFlows: 'All flows', insTopic: 'topic',
  insMore: (n) => `… ${n} more`,
  insCut: (bytes) => `text (cut, ${bytes} bytes)`,
  insErrRunning: 'Errors while running', insErrLast: 'Last', insErrBlock: 'Block', insErrError: 'Error', insErrCount: 'Count', insNotCaught: 'not caught',
  insNoErrors: 'No errors in the messages read so far.', insCaughtRecent: 'Caught in recent runs', insCaughtBy: 'Caught by', insErrPort: 'its error port',
  insShowCatcher: 'Show the block that caught it', insErrCounters: 'Error counters of the blocks',
  insFill: (label, bytes, limit, pct) => `${label}: ${bytes} of ${limit} used (${pct}%).`,
  insSegEvents: 'Events', insSegContext: 'Context', insEventsHint: 'What happened lately. Use one to build a trigger block.', insNoEvents: 'No events yet.',
  insUseTrigger: 'Use as trigger', insReload: 'Reload', insChange: 'Change…', insDeleteKey: 'Delete',
  insNothingStored: 'Nothing is stored here.', insLoading: 'Loading…', insSaveFirst: 'Save the flow first.', insAdminOnly: 'Only the administrator can change the context.',
  insErrorsN: (n) => `${n} errors`,
  issueText: issueMessage,
  paramIssueText: paramIssueMessage,
  nodeNotAvailable: 'Not available', nodeSkipped: 'Skipped',
  diffAdded: 'Added', diffChanged: 'Changed', diffRemoved: 'Removed',
  nodeAriaLabel: (label, kind, skipped, problems) => `${label} (${kind})${skipped ? ', skipped' : ''}${problems ? `, ${problems} ${problems === 1 ? 'problem' : 'problems'}` : ''}`,
  nodeAriaPlaceholder: (label, type) => `${label} (Not available: ${type})`,
  nodeTipKind: (type, title) => `${type} – ${title}`,
  paletteHelpAdd: 'Drag or click a node type to add it.', paletteHelpWire: 'Drag from {out} output to {in} input to wire.',
  paletteHelpEdit: 'Click a node to edit it. Shift or Ctrl click adds to the selection. Select and press Delete to remove.',
  canvasEmptyWire: 'Connect {out} output ports to {in} input ports',
  panelPlaceholderBody: 'This node came from {source} and its type {type} does not exist on this system. It keeps its connections so the flow stays readable, but it does nothing: messages that reach it stop here. Replace it with an available node, or delete it.',
  panelSourceKui: 'another ruleset file', panelSourceNodeRed: 'a Node-RED flow', panelSourceRoltek: 'a roltek-automation-1 file',
  groupColours: ['primary', 'success', 'warning', 'error', 'info', 'secondary', 'text secondary', 'border strong'],
  panelLabel: (label) => `${label} settings`,
  panelDescriptionLabel: 'Description', panelDescriptionHint: 'A note for the people who work on this flow. It is not sent to the router.',
  scriptSignatureLabel: 'What the script gets and may return', scriptApiTitle: 'Script API',
  panelTabsLabel: 'Block panel', panelTabSettings: 'Settings', panelTabHelp: 'Help', panelHelpNone: 'No help for this block yet.', panelHelpPorts: 'Ports',
  panelNotAvailable: 'Not available', panelDebugNode: 'Debug node', panelDeleteNode: 'Delete node', panelClose: 'Close panel', panelNameLabel: 'Label',
  panelProblems: 'Problems with this node', panelAvailableInputs: 'Available inputs', panelIn: 'In', panelOut: 'Out', panelResetScript: 'Reset script',
  panelAppliesAsYouType: 'Changes apply as you type. Undo with Ctrl+Z.', panelPlaceholderTitle: 'Not available here',
  panelOriginalType: 'Original type', panelSource: 'Source', panelOriginalSettings: 'Original settings (read-only)',
  edgeCount: (n) => (n === 1 ? '1 message' : `${n} messages`),
  edgeActivityTitle: (n, window) => `${n === 1 ? '1 message' : `${n} messages`} on this connection${window ? ` (${window})` : ''}`,
  nodeCounters: (inN, outN, errors, window) => [
    inN !== null ? `In ${inN}` : '', outN !== null ? `Out ${outN}` : '', errors !== null ? `Errors ${errors}` : '',
  ].filter(Boolean).join(' · ') + (window ? ` (${window})` : ''),
  edgeHandleSource: 'Drag to another output', edgeHandleTarget: 'Drag to another input',
  panelTabMessages: 'Messages', panelMessagesNone: 'No messages through this block yet.',
  panelMessagesHidden: 'Message bodies are shown only to people who may debug.', panelMessageIn: 'In', panelMessageTest: 'Test with this input',
  panelTestScript: 'Test the script',
  panelMessageOut: (port) => (port ? `Out → ${port}` : 'Out'),
  panelMessageRun: (run) => `run ${run}`,
  codeEditor: {},
  scriptCheckSource: 'check', scriptTestSource: 'test run',
  scriptTestTitle: (label) => `Test the script of "${label}"`,
  scriptTestIntro: 'Runs this code once on the message below, on the real script host. Nothing is deployed; Save puts the code into the block.',
  scriptTestRun: 'Run', scriptTestRunning: 'Running…', scriptTestSave: 'Save into the block', scriptTestCode: 'Code',
  scriptTestMsgType: 'Message type', scriptTestOriginatorType: 'Originator type', scriptTestOriginatorId: 'Originator id',
  scriptTestPayload: 'Payload (JSON)', scriptTestMetadata: 'Metadata (JSON object)',
  scriptTestContext: 'Context (optional JSON)', scriptTestContextHint: '{ "node": {…}, "flow": {…}, "global": {…} }',
  scriptTestBadJson: 'This is not valid JSON.', scriptTestBadObject: 'This must be a JSON object.',
  scriptTestResult: 'Result', scriptTestNoResult: 'Run the script to see what it sends.', scriptTestFailed: 'The test could not run.',
  scriptTestNoOutput: 'The script sent nothing.', scriptTestLog: 'Log', scriptTestStatus: 'Status:', scriptTestContextWrites: 'Context written',
  scriptTestErrorAt: (line, column) => `Line ${line}${column ? `, column ${column}` : ''}: `,
  scriptTestOutput: (port) => `Output ${port}`,
  scriptTestCpu: (ms) => `${ms} ms CPU`,
  insDeployProblems: 'Problems that stop a deploy', insProblemError: 'Error', insProblemWarning: 'Warning',
  insTabBlock: 'Block', insTabHelp: 'Help', insTabTrace: 'Trace', insTabRuns: 'Runs', sideBarPickBlock: 'Click a block on the canvas to edit it.',
  insMoreTabs: 'More tabs', toolSidePanelShow: 'Show the side panel', toolSidePanelHide: 'Hide the side panel',
  outputsEdit: 'Edit outputs', outputsTitle: 'Outputs',
  outputsIntro: 'One row per output, in the order of the ports on the block. Drag a row by its handle, or focus the handle and use the arrow keys, to move it; its connections move with it.',
  outputsName: 'Name', outputsNamePlaceholder: 'optional', outputsNote: 'Description', outputsAdd: 'Add output', outputsSave: 'Save',
  outputsUnnamed: 'no name', outputsExampleTitle: 'In the code', outputsExampleEach: 'or one message per output, null for none',
  outputsNameChars: 'Use letters, digits, _ and -, starting with a letter or _.', outputsNameDuplicate: 'Another output has this name.',
  outputsNameReserved: 'The editor uses this name for a port of its own; choose another.',
  outputsNameLong: (max) => `At most ${max} characters.`,
  outputsTooLong: (max) => `The names together are too long: at most ${max} characters with the commas.`,
  outputsRow: (n) => `Output ${n}`,
  outputsRemove: (n) => `Remove output ${n}`,
  outputsMove: (n) => `Move output ${n}`,
  outputsMoved: (n, to) => `Output ${n} is now output ${to}.`,
  outputsExampleTo: (n, name) => (name ? `output ${n} (${name})` : `output ${n}`),
};

const MessagesContext = createContext<EditorMessages>(DEFAULT_MESSAGES);

/** the messages in force: the defaults, with what the nearest `messages` prop above changed */
export function useMessages(): EditorMessages {
  return useContext(MessagesContext);
}

/** the defaults, then the messages of the parent editor, then these; stable while `messages` is */
export function useMergedMessages(messages?: Partial<EditorMessages>): EditorMessages {
  const parent = useContext(MessagesContext);
  return useMemo(() => (messages ? { ...parent, ...messages } : parent), [parent, messages]);
}

export const MessagesProvider = MessagesContext.Provider;

/** A message with `{name}` marks, with the marks replaced by nodes: `fillTemplate('Drag from {out} to {in}', { out: <b>●</b>, in: <b>○</b> })`. A mark with no part stays as written. */
export function fillTemplate(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return name !== undefined && name in parts ? <Fragment key={i}>{parts[name]}</Fragment> : piece;
  });
}
