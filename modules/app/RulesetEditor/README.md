# modules/app/RulesetEditor

The rule chain editor and everything around it: a visual editor for pipelines of blocks, the blocks it offers (a
catalog, given as data), forms for their params, undo, groups, flows that run each other, validation, and import / export.

Everything outside `RulesetEditor/` and `forms/ParamForm.tsx` is plain TypeScript: no React, no DOM, unit tested.

## Try it

- Showcase entry `ruleset-editor` (App): a business flow with a catalog that has no device in it (`demo-neutral.ts`: schedule, webhook in, compare, notification, webhook out), read only, and the messages in another language.
- `/theme/iot/rulesets` — the list: import, export, versions, templates.
- `/theme/iot/rulesets/<slug>` — the editor on a saved chain.
- `/theme/iot/rulesets/catalog-demo` — the editor with a roltek-style catalog, a group, a Run flow block and one problem
  to find. A checklist at the top says what to try. “Show file” prints `roltek-automation-1` as you edit.
- Showcase → Domain → RulesetEditor.

## Folder map

```
RulesetEditor/      the React editor
  index.tsx           state, pointer and keyboard handling, menus; props and ref
  canvas/             Canvas, RuleNode, RuleEdge, GroupFrame, Palette, ContextMenu, overlays,
                      MiniMap, GuideLines, SelectionFrame
  panels/             NodeEditorPanel (a ParamForm), result and trace panels
  insight/            InsightPanel (Debug, Errors, Data, Busiest) and RunsPanel (the run history and a step-by-step player; `runs.ts` is its pure part)
  dialogs/            group, block picker, port, shortcuts, script test
  hooks/              useGraphEditor (state + history), useNodeDrag, useEdgeConnect, usePaletteDrop,
                      useSnapDrag, useBoxSelect, useMiniMap
  geometry.ts         node layout, port anchors, curves
  block-visual.ts     icons and colours of a block
  runtime/            the browser demo runner (built-in nodes only)
catalog/            the block vocabulary as data
  types.ts            BlockDecl, ParamSpec, Catalog
  params.ts           isVisible, defaultParams, validateParams, missingRequired
  ports.ts            resolvePorts, nodePortsOf
  fromBlocks.ts       catalogFromBlocks: load blocks.d files of roltek-automation-1
  flow.ts             FLOW_BLOCKS: `trigger.flow_input` and `action.flow_run`, and the `flows` choice list name
  builtin.ts          BUILTIN_CATALOG: the ten original node types
  palette.ts          paletteGroups
  summary.ts          the line under a node title
  fields.ts           fromBlocksField / toParamSpec: a param ⇄ a SchemaForm FieldSchema, `when` → `showIf`
forms/              ParamForm (schema → form) and its pure helpers (field-utils.ts)
graph/              pure operations on a graph
  history.ts          undo / redo stack
  edit.ts             add, remove, move, place, connect, insert on a connection
  layout.ts           autoLayout (layered, deterministic)
  snap.ts             12 px grid and alignment guide lines while dragging
  boxselect.ts        selection frame against blocks
  groups.ts, state.ts   groups; the state history steps over
  links.ts            link blocks and flow blocks: where a block leads, who calls it
  clipboard.ts        copy, paste, duplicate
  validate.ts         graph validation
  diff.ts             diffFlows: what a deploy changes (the router's flowlib diff; imports nothing)
  diff-view.ts        diffGraphs, diffTints, diffView: a diff drawn on the canvas
format/roltek.ts    roltek-automation-1 ⇄ chains
transfer.ts         kui-ruleset-1, roltek-automation-1 and Node-RED import / export, versions, templates
demo.ts             sample catalog and flow for the showcase and the demo page
```

## Using the editor

```tsx
<RulesetEditor
  ref={editorRef}
  initialNodes={chain.nodes}
  initialEdges={chain.edges}
  initialGroups={chain.groups}
  flowId={chain.chainId}       // a Run flow block that runs this flow is a problem
  catalog={myCatalog}          // default: BUILTIN_CATALOG
  choices={{ brokers: [...] }} // lists for `source` fields
  active={chain.active}        // a missing required param is an error when active, else a warning
  onChange={(graph) => setDraft(graph)}
/>
```

| Prop | |
| --- | --- |
| `initialNodes`, `initialEdges`, `initialGroups` | Read once. Give the editor a new `key` to load another chain. |
| `catalog` | The blocks on offer. |
| `choices` | `{ [sourceName]: { value, label }[] }` for `source` and `list` fields. Without a list the field is plain text. |
| `paramEditors` | `{ [blockType]: ComponentType<ParamEditorProps> }`: the host's own param editor for a block type, shown in the node panel in place of the generated form. It gets `{ params, onChange(params), disabled, node, decl, choices }` and replaces the params as a whole; validation, the issues list and saving work as for the form. A type without an editor keeps the form. |
| `unavailable` | `{ [blockType]: reason }`: blocks the host cannot run now (a missing module, a plan without the feature). The palette, the block picker and the canvas menu grey them out with the reason as the hint and do not add them; blocks already on the canvas stay. |
| `messages` | `Partial<EditorMessages>`: the words of the editor chrome (context menu, palette, node panel, the dialogs the editor opens, why a block cannot be added), so a host can translate them. What is not given stays English; a message that needs a number or a name is a function. Block titles and param labels come from the catalog. The remaining parts (canvas toolbar, issues panel, dialogs' inner texts, merge dialog, insight panel, debug modals, param form) are still English and move over one by one. |
| `onSave` | `({ valid }) => void`: Ctrl+S (⌘+S) in the editor, its panel included and not a dialog, calls it and keeps the browser from saving the page; `valid` is false while the graph has errors. Without it the keys are left to the browser. `FlowWorkspace` passes `{ valid, dirty }`. |
| `active` | Severity of “required param is empty”. |
| `flowId` | The id of the flow in the editor (`null` while it is not saved). A Run flow block whose `flow` is this id is an error (`run_self`). `FlowWorkspace` passes it. |
| `onChange` | Called after every step of the undo history (a whole drag is one step) and after undo and redo. Not on mount. |
| `readOnly`, `chainName`, `nodeStatus`, `className` | As before. |
| `onSelectionChange` | `(ids: string[]) => void`, called when the selection of blocks changes (not on mount). |
| `nodeMenuItems` | `({ nodeIds, readOnly }) => ContextMenuItem[]`: more entries in the menu of a block, between the built-in ones and Delete. Labels must be unique in the menu. |
| `toolbarExtra` | A node at the start of the zoom bar (bottom right of the canvas). |
| `bannerSlot` | A node above the canvas, full width of the canvas column (a “draft kept” bar, a conflict notice). |
| `activity` | `{ edges?, nodes?, window? }` (`CanvasActivity`): live counters from the host. A connection whose count (or `at`) goes up lights up for 400 ms, at most twice a second (`pulseStep`); its count shows on hover (`edgeCount`), a block's in / out / errors in its hover card and the node panel's Messages tab. A connection the host does not list takes its source port's count (`edgeActivityOf`). |
| `nodeMessages`, `messageBodies`, `onTestMessage` | `{ [nodeId]: NodeMessage[] }`: the recent messages through each block (UI-33). The node panel gets a Messages tab (newest first, with a count). Bodies (`msg`) show only with `messageBodies` (the host's permission); `onTestMessage(nodeId, message)` adds "Test with this input" to a received message with a body. |
| `onScriptTest`, `scriptTestSample` | `(request) => Promise<ScriptTestResult>`: a block whose code param has `api: 'automation-script'` gets "Test the script" in the node panel: a pane with the code (completion, hover, checks), the message (type, originator, payload, metadata) and an optional context. Run calls the host; the outputs (one per port), log, status, context writes and CPU time show, and an error with a line and column is marked in the code. Save writes the edited code back into the block (one undo step); nothing is deployed. `scriptTestSample(nodeId)` prefills it. |
| `sideBar` | `RulesetSideBar`: one side bar as on the router (debug comparison item 6): the InsightPanel with the node panel as its Block tab (Settings, Messages) and Help tab, the host's `traceTab` and `runsTab`, and Debug, Errors, Data, Busiest fed by the same props as `InsightPanel`. Picking a block opens it on Block; the Errors tab lists the editor's validation errors, then the host's `deployProblems`. Without it the node panel stands alone. |

The ref has `getGraph()` (nodes, edges and groups; always the latest), `undo()`, `redo()`, `validate()`,
`fit()` and `openRulesetDebug()`. `getGraph()` used to return only `{ nodes, edges }`; callers that read those two
keep working. For hosts that add to the editor:

| Ref method | |
| --- | --- |
| `arrange()` | Auto layout, one undo step, then the view fits. Returns false when nothing moved (or read only). |
| `select(ids)` / `getSelection()` | Set and read the selected blocks (ids that are not on the canvas are ignored). |
| `reveal(ids)` | Pan, and zoom out only if they do not fit, until the blocks are in view; no-op when they already are. |
| `replaceGraph(graph, { key?, fit? })` | Replace the whole graph (nodes, edges, groups) as ONE undo step, e.g. a merge or a restored draft. The fixed Flow input is added when the graph lacks it (catalog with the block). |

Dragging a connection's end (UI-31): select a connection and two handles appear on its ends. Drag the target end onto
another input (or a block: its first input), or the source end onto another output (or a block: the same port when it has
one, else its first output). The rules of a new connection apply (`rewireEdge` in `graph/edit.ts`); a refused drop or one
on the empty canvas leaves it as it was. One undo step; the connection keeps its id. "Change port…" in its menu stays.

## Code fields

A `code` param is the kui `CodeEditor` with its toolbar (find / replace, copy, full screen). One with `api:
'automation-script'` also gets completion and hover from `SCRIPT_API_ITEMS` (the same list as the Help tab), the
format button (`tidyScript`: indent by brackets, never inside a template string) and markers from `lintScript`, which
only reads the text (brackets, open strings, templates, comments and regular expressions, names the sandbox lacks, a
script over 8 KiB); the sidecar's compile at test and deploy is the real check. `messages.codeEditor` translates the
CodeEditor's own words.

## The catalog

A catalog is `{ blocks, groups, errorPort? }`. A block (`BlockDecl`) has the shape of an entry of a `blocks.d` file
of roltek-automation-1, so `catalogFromBlocks(files)` takes those files as they are.

A param (`ParamSpec`) has a `type` and, as needed: `label`, `hint`, `default`, `required`, `when`, `options`,
`option_labels`, `empty_label`, `min`, `max`, `int`, `step`, `max_len`, `pattern`, `source`, `free`, `multiple`,
`items`, `lang`, `pins`, `unit`, `suggest`, `scopes`, and `store`.

- `when` is `{ param, value }` (one value or a list) or `{ param, not: [...] }`. The compared value falls back to the
  default of the other param. Hidden fields are not shown, not required and not validated.
- `outputs` is a list of port ids, `{ dynamic: '<listParam>', prefix, max, extra }` (one port per item of a list
  param, plus the extra ports) or `{ count: '<numberParam>', prefix, max }` (a fixed number of ports).
- `errorPort: true` gives every block with an input an `error` output. It sits at the bottom of the node and its
  connections are dashed.
- `store: 'script'` keeps the value in `node.script` instead of `node.config`. The ten built-in types use it for
  their JavaScript, which is why old chains keep working.

Field types, and how the form shows them: `string`, `path`, `topic`, `cron`, `hex`, `mac`, `ip` (text; `suggest` makes
a datalist), `text`, `template`, `expr` (textarea), `json` (textarea that parses as you type), `number`, `bool`
(switch), `enum` (select; the stored value is the option itself, so numbers stay numbers), `duration` (amount and
unit, stored in ms), `time`, `weekdays`, `secret` (password; empty keeps a stored value), `code` (the kui
`CodeEditor`), `source` and `ref` (select from `choices`; `multiple` is checkboxes; `free` adds “Other…”; a saved
value no longer offered shows as “not available now”), `list` (checkboxes for an enum or source, else comma text),
`value` (`{ kind, v }` with a kind menu), `rules` (rows of a sub-schema, up to `max`, default 16).

A text field that suggests gets its own `<datalist>`, in a row of a `rules` field too. A host that knows more than the
schema (a member list for the row whose kind is `user`, the roles for a `role` row) passes `ParamForm` a `suggest`
function: it gets `{ key, spec, values, row? }` (`row` is `{ param, index, values }` for a field of a rules row) and
returns the suggestions (`string` or `{ value, label? }`) for that field; an empty list turns the field's own `suggest`
off and `undefined` keeps it. The host never needs the form's element ids.

Adding a field type: add it to `ParamType`, a case to `Field` in `forms/ParamForm.tsx`, a row in `catalog/fields.ts`,
and a test.

### Params as SchemaForm fields

`fromBlocksField(key, spec, params?)` maps a param onto the `FieldSchema` vocabulary of `SchemaForm` (OD-16; the table
is in `catalog/fields.ts`), `fromBlocksFields(params)` a whole block. The result is assignable to `FieldSchema` and
adds what FieldSchema has no word for yet: `secret`, `unit`, `pattern`, and `override` (the `blocks.d` type a host
renders itself through `fieldOverrides`: `time`, `cron`, `template`, `expr`, `code`, `path`, `value`, `rules`,
`source`, `ref`). `param` keeps the declaration keys a field cannot carry, so `toParamSpec(fromBlocksField(k, spec))`
gives `spec` back; the keys a field carries exactly (`description`, `value`, `required`, `min`, `max`, `maxLength`,
`multiple`, a rules row's `fields`) are read from the field.

`when` becomes `showIf`: `{ param, value }` lists the values the loose match of `isVisible` accepts (`1` and `"1"`, and
`undefined` / `null` when the other param's default matches), so `shouldShow` and `isVisible` agree. `{ param, not }`
has no `showIf` form; such a field keeps its `when`, and `isBlocksFieldVisible(field, values, params)` answers for
both. A secret never gets a `value`.

## Nodes, ports and ids

A node is `{ nodeId, type, label, x, y, config?, script?, disabled?, original? }`. `type` is any string: a block of
the catalog, or `PLACEHOLDER` for something the catalog does not have
(it keeps its wires and does nothing). Positions are rounded to 4 px when a block is added or moved by code; while
dragging, blocks snap to a 12 px grid (see Canvas below).

Ids of new nodes, edges and groups are the next free `n1`, `e1`, `g1`, also around ids that came from an import.

## History

`useGraphEditor` keeps the nodes, edges and groups. Each change is a step; steps with the same key within a
second join (typing in the panel); a drag is one step on release. Selection, view and open panels are not part of it.
100 steps, 16 MB. Ctrl/⌘+Z undoes; Ctrl/⌘+Y or Ctrl+Shift+Z redoes.

## Selection and clipboard

Shift, Ctrl or ⌘ click toggles a node; Ctrl+A selects all; the name tab of a group selects its members. Dragging,
Delete, copy, cut and duplicate work on the whole selection. Paste remaps ids and keeps relative positions; groups are
not copied. The Flow input block of a flow is left out of every one of these (see “Flows that call each other”). The clip is kept in `localStorage` (`kui-ruleset-clipboard`) and offered to the system clipboard.

## Canvas: arrange, mini map, box select, snap

Ported from the OpenWrt editor; the pure parts are `graph/layout.ts`, `graph/snap.ts`, `graph/boxselect.ts` and
`useMiniMap.ts` (`miniVisible`, `miniMapping`).

The canvas background takes two optional theme tokens: `--canvas-bg` (default `--surface-base`) and `--canvas-dot` for
the grid dots (default `--border`), the same `--canvas-bg` the WidgetKit board reads.

- **Arrange** (the diagram button in the zoom bar, “Arrange the blocks” in the canvas menu, `ref.arrange()`): layered
  and deterministic. A block's column is the longest path from the entries; back wires of a loop are ignored. Inside a
  column blocks are ordered by the mean place of their neighbours (two sweeps down, two up). Separate parts of the
  flow are stacked. The top left of the old boxes is kept; group frames follow their members. One undo step.
- **Mini map** (180 x 120, bottom right): a box per block (red when it has errors), a frame for the visible part;
  click or drag to move the view. It shows by itself above 30 blocks or when blocks leave the view; the button next to
  Fit decides otherwise and is kept in `localStorage` (`kui-ruleset-minimap`: `on` / `off`). Hidden on a phone.
- **Box select**: Shift, Ctrl or ⌘ and drag on the empty canvas draws a frame; the blocks it touches are added to the
  selection (no undo step). A plain drag still pans. On a touch screen the frame button (frame mode) makes a one-finger
  drag draw the frame and switches itself off after a touch selection. Pinch and long press are unchanged.
- **Snap and guides**: a dragged block (or group) snaps to a 12 px grid. Within 6 screen pixels of another block's left,
  middle or right (and top, middle or bottom) it jumps onto that line and the line is drawn. Alt moves freely.

## Groups

`{ groupId, name, color (0–7), nodeIds }`. A node is in one group. The frame is drawn from the members; dragging the
name tab moves them; double click edits. Groups do nothing at run time.

## Flows that call each other

Like ThingsBoard rule chains, flows run each other; there are no subflows (they were replaced by `flow_input` and
`flow_run`). Two blocks, declared in `catalog/flow.ts` (`FLOW_BLOCKS`; the router serves the same ones from its own
`blocks.d` JSON), group `flow`, palette label “Flows”:

- `trigger.flow_input` (“Flow input”): the fixed entry of every flow. No input, one output `out`, no params. A flow always
  has exactly one, wired or not, so every flow is callable (only an explicit `callable: false` of the host hides a flow
  from the Run flow lists). The editor adds it when the catalog has the block and the graph has none (initial graph,
  `replaceGraph`, a restored draft, a merge, an import; `ensureFlowInput` in `graph/flowInput.ts`) and the addition is part
  of the baseline: no history step, not dirty. It is not in the palette or any add menu. It cannot be deleted (Delete,
  context menu, toolbar, cut, panel), copied, cut, duplicated or pasted (a pasted one is dropped); undo and redo never remove
  it. Moving it, renaming its label and wiring it stay allowed. A second one in an imported graph is still the error
  `one_flow_input` (the first is the fixed one; the others can be deleted). A host whose catalog lacks the block is
  unaffected.
- `action.flow_run` (“Run flow”): a terminal block. One input, no output port (`error` stays the implicit engine port), one
  required param `flow`: the id of the flow to run. It forwards the message to that flow's `flow_input` and never returns,
  so put it at the end of a chain. Running its own flow is the error `run_self` (give the editor `flowId`).

Data travels in the message only: no output node, no params passing, no return value, no nesting rule.

The `flow` param is a `source` field named `flows` (`FLOWS_SOURCE`): a host that uses the bare editor passes
`choices.flows`; `FlowWorkspace` fills it from its `flows` prop with the flows that are not marked `callable: false`, the open one left out (see
[docs/workspace.md](docs/workspace.md)). In `FlowWorkspace` the menu of a Run flow block has “Go to the Flow input of that
flow”, and the menu of a Flow input “Show the blocks that run this flow”.

An older `roltek-automation-1` or `kui-ruleset-1` file that still has a `subflows` list is read without it: each flow notes
how many subflows were not imported, and nodes of type `subflow.*` become placeholders like any block the catalog lacks.

## Validation

`validateGraph(graph, catalog, ctx)` returns `{ errors, warnings }`: `unsupported`, `unknown`, `required`, `cycle_sync`,
`edge`, `edge_port`, `no_input`, `one_flow_input`, `run_self` (needs `ctx.flowId`), `unconnected`, `no_feed`. `required` is an error when the chain is active and a warning otherwise. The editor marks nodes, lists the
problems (top right) and repeats them in the node panel. It does not block anything: the host decides what to do
(`ref.validate()`). Range, pattern and enum checks (`validateParams`) show next to the field.

## Formats

`transfer.ts` reads and writes three formats and keeps the first two apart from the editor.

| Format | Write | Read |
| --- | --- | --- |
| `kui-ruleset-1` | `buildExport` | `parseImport` (with groups) |
| `roltek-automation-1` | `buildRoltekExport` | `parseImport` (detects it; pass `{ catalog }`) |
| Node-RED flow | — | `parseImport` |

How a chain maps to a roltek flow: `nodeId` → `id`, `label` → `name` (written only when it differs from the block
title), `config` → `params`, a param stored in `script` goes back under its own key, `sourceNodeId` / `sourcePort` /
`targetNodeId` → `from` / `from_port` / `to`, `active` → `enabled`, groups as in the file. Ids that do not
fit (`^[A-Za-z0-9_]{1,16}$` for nodes) are renumbered `n1`, `n2` …

- Secret keys are left out and listed (`omitted`); `{ "$secret": true }` markers stay.
- A block the catalog lacks becomes a placeholder, and a placeholder leaves as an `unsupported` block, so a round trip
  through this editor loses nothing.
- The file has no edge ids; they are numbered again.
- Config nodes (`configs`, `{ id, type, name?, params }`) are not part of a chain. `chainsToRoltek(chains, { configs })`
  (and `buildRoltekExport`) writes the ones the host passes, each secret param (declared `secret` by its block, or a
  key that reads like one) as `{ "$secret": true }` and listed in `omitted`. `roltekConfigs(file, catalog?)` reads them
  back with every secret `null` (`secretsToEnter`), and skips a bad id, a second one with the same id, or (with a
  catalog) a type the catalog lacks. `parseImport` puts them in the preview's `configs`; the host stores them.
- Imported chains are inactive. A connection to a missing block or port is dropped and counted in the preview.

## Diff and version compare

`diffFlows(a, b)` is the router's `flowlib.js` `diff`: two flows in the roltek shape (`a` null for a new
one) give `{ isNew, meta, nodes: { added, removed, changed, moved }, edges: { added, removed }, groups, total }`. A
changed node lists its fields by path (`type`, `name`, `disabled`, `v`, `params.<key>`) with short `from` / `to`
texts; a moved node is listed apart, as layout is not a change. Lists are sorted by id. `graph/diff.ts` imports nothing,
so a server can copy it alone.

On the canvas: `diffGraphs(a, b)` diffs editor graphs, `diffTints(diff)` gives `{ nodes, edges }` tints (`added`,
`changed`, `removed`; edges keyed by `edgeKey(from, port, to)`), and `diffView(a, b)` returns one graph with the blocks
and connections only `a` had added back at their old places, plus the tints. `RulesetEditor` (and `FlowWorkspace`)
`diffTint` outlines a tinted block (green, amber, dashed red) with a badge (`diffAdded`, `diffChanged`,
`diffRemoved` in `messages`) and colours a tinted connection (a removed one dashed). Show a compare read-only:

```tsx
const view = diffView(deployedGraph, draftGraph);
<RulesetEditor readOnly catalog={catalog} initialNodes={view.nodes} initialEdges={view.edges} diffTint={view.tint} />
```

## Not ported from the OpenWrt editor

Debug, trace, hold points, run history and live status (they need the router engine; kui keeps its browser demo
runner for the built-in nodes), deploy with revision conflicts and the approval exchange, roles, `risk` / `tier`
gating, router device lists (the host passes `choices`), server-side validation, and the LuCI pieces. `risk` stays as
catalog data: a risky block has a red header.

## Runtime insight

`RulesetEditor/insight/` is a standalone side panel (Debug with pause, kind filter and download; Busiest; Errors with the
caught link; Data with the context fill bar), driven by host-supplied props. See [docs/insight.md](docs/insight.md).
`deployProblems` puts "Problems that stop a deploy" first in Errors (counted on its tab, each with a link to its block);
`slots` adds the Block, Help, Trace and Runs tabs in the router's order (Block, Debug, Help, Trace, Errors, Runs, Data,
Busiest), `extraTabs` tabs of the host's own after Busiest, `header` a bar above every tab but Block and Help, and
`tab` / `onTabChange` keep the open tab in the host.

## Flow workspace

`RulesetEditor/workspace/FlowWorkspace.tsx` wraps the editor for a host with many flows: a browser draft per flow, link-block jumps across flows and a three-way merge for save conflicts. See
[docs/workspace.md](docs/workspace.md). Demo: `/theme/iot/rulesets/workspace-demo`. `leaveGuard` (`true`, or a function of `dirty`) turns on a guard against losing a change: a reload or a closed tab asks the browser to confirm and a link jump that leaves the flow asks first (`hooks/useLeaveGuard`, which a host can also use for its own links through `confirmLeave()`); off by default.

## Tests

```
npx vitest run modules/domains/iot
npx tsc --noEmit
```

`catalog/*.test.ts`, `graph/*.test.ts`, `format/roltek.test.ts`, `transfer*.test.ts`, `forms/*.test.ts(x)`,
`demo.test.ts` cover the pure functions (`graph/layout`, `snap` and `boxselect` included); `RulesetEditor/*.test.tsx` drive the editor (undo, selection, clipboard,
panel, groups, menus, problems, flow blocks); `RulesetEditor/canvas/canvas-interaction.test.tsx` drives arrange, box
select, snap and guides, the mini map and the extension API; `RulesetEditor/layout.test.ts` covers geometry, visuals
and the runner.
