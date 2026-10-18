# modules/app/RulesetEditor

The rule chain editor and everything around it: a visual editor for pipelines of blocks, the blocks it offers (a
catalog, given as data), forms for their params, undo, groups, subflows, validation, and import / export.

Everything outside `RulesetEditor/` and `forms/ParamForm.tsx` is plain TypeScript: no React, no DOM, unit tested.

## Try it

- Showcase entry `ruleset-editor` (App): a business flow with a catalog that has no device in it (`demo-neutral.ts`: schedule, webhook in, compare, notification, webhook out), read only, and the messages in another language.
- `/theme/iot/rulesets` — the list: import, export, versions, templates.
- `/theme/iot/rulesets/<slug>` — the editor on a saved chain.
- `/theme/iot/rulesets/catalog-demo` — the editor with a roltek-style catalog, a group, a subflow and one problem
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
  dialogs/            group, name, block picker, subflow settings
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
  builtin.ts          BUILTIN_CATALOG: the ten original node types
  palette.ts          paletteGroups
  summary.ts          the line under a node title
forms/              ParamForm (schema → form) and its pure helpers (field-utils.ts)
graph/              pure operations on a graph
  history.ts          undo / redo stack
  edit.ts             add, remove, move, place, connect, insert on a connection
  layout.ts           autoLayout (layered, deterministic)
  snap.ts             12 px grid and alignment guide lines while dragging
  boxselect.ts        selection frame against blocks
  groups.ts, subflows.ts, state.ts   groups; subflows (convert, nesting, settings); the state history steps over
  clipboard.ts        copy, paste, duplicate
  validate.ts         graph validation
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
  initialSubflows={chain.subflows}
  catalog={myCatalog}          // default: BUILTIN_CATALOG
  choices={{ brokers: [...] }} // lists for `source` fields
  active={chain.active}        // a missing required param is an error when active, else a warning
  onChange={(graph) => setDraft(graph)}
/>
```

| Prop | |
| --- | --- |
| `initialNodes`, `initialEdges`, `initialGroups`, `initialSubflows` | Read once. Give the editor a new `key` to load another chain. |
| `catalog` | The blocks on offer. |
| `choices` | `{ [sourceName]: { value, label }[] }` for `source` and `list` fields. Without a list the field is plain text. |
| `paramEditors` | `{ [blockType]: ComponentType<ParamEditorProps> }`: the host's own param editor for a block type, shown in the node panel in place of the generated form. It gets `{ params, onChange(params), disabled, node, decl, choices }` and replaces the params as a whole; validation, the issues list and saving work as for the form. A type without an editor keeps the form. |
| `unavailable` | `{ [blockType]: reason }`: blocks the host cannot run now (a missing module, a plan without the feature). The palette, the block picker and the canvas menu grey them out with the reason as the hint and do not add them; blocks already on the canvas stay. |
| `messages` | `Partial<EditorMessages>`: the words of the editor chrome (context menu, palette, node panel, the dialogs the editor opens, why a block cannot be added), so a host can translate them. What is not given stays English; a message that needs a number or a name is a function. Block titles and param labels come from the catalog. The remaining parts (canvas toolbar, issues panel, dialogs' inner texts, merge dialog, insight panel, debug modals, param form) are still English and move over one by one. |
| `onSave` | `({ valid }) => void`: Ctrl+S (⌘+S) in the editor, its panel included and not a dialog, calls it and keeps the browser from saving the page; `valid` is false while the graph has errors. Without it the keys are left to the browser. `FlowWorkspace` passes `{ valid, dirty }`. |
| `active` | Severity of “required param is empty”. |
| `subflowDepthLimit` | How deep subflows may be nested. Default 4 (a host with a smaller engine passes its own limit). |
| `onChange` | Called after every step of the undo history (a whole drag is one step) and after undo and redo. Not on mount. |
| `readOnly`, `chainName`, `nodeStatus`, `className` | As before. |
| `onSelectionChange` | `(ids: string[]) => void`, called when the selection of blocks changes (not on mount). |
| `nodeMenuItems` | `({ nodeIds, readOnly }) => ContextMenuItem[]`: more entries in the menu of a block, between the built-in ones and Delete. Labels must be unique in the menu. |
| `toolbarExtra` | A node at the start of the zoom bar (bottom right of the canvas). |
| `bannerSlot` | A node above the canvas, full width of the canvas column (a “draft kept” bar, a conflict notice). |

The ref has `getGraph()` (nodes, edges, groups and subflows; always the latest), `undo()`, `redo()`, `validate()`,
`fit()` and `openRulesetDebug()`. `getGraph()` used to return only `{ nodes, edges }`; callers that read those two
keep working. For hosts that add to the editor:

| Ref method | |
| --- | --- |
| `arrange()` | Auto layout, one undo step, then the view fits. Returns false when nothing moved (or read only). |
| `select(ids)` / `getSelection()` | Set and read the selected blocks (ids that are not on the canvas are ignored). |
| `reveal(ids)` | Pan, and zoom out only if they do not fit, until the blocks are in view; no-op when they already are. |
| `replaceGraph(graph, { key?, fit? })` | Replace the whole graph (nodes, edges, groups, subflows) as ONE undo step, e.g. a merge or a restored draft. Leaves a subflow that is gone. |

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

Adding a field type: add it to `ParamType`, a case to `Field` in `forms/ParamForm.tsx`, and a test.

## Nodes, ports and ids

A node is `{ nodeId, type, label, x, y, config?, script?, disabled?, original? }`. `type` is any string: a block of
the catalog, `subflow.<id>` for an instance of a subflow, or `PLACEHOLDER` for something the catalog does not have
(it keeps its wires and does nothing). Positions are rounded to 4 px when a block is added or moved by code; while
dragging, blocks snap to a 12 px grid (see Canvas below).

Ids of new nodes, edges and groups are the next free `n1`, `e1`, `g1`, also around ids that came from an import.

## History

`useGraphEditor` keeps the nodes, edges, groups and subflows. Each change is a step; steps with the same key within a
second join (typing in the panel); a drag is one step on release. Selection, view and open panels are not part of it.
100 steps, 16 MB. Ctrl/⌘+Z undoes; Ctrl/⌘+Y or Ctrl+Shift+Z redoes. A subflow made after a step is left when you undo
past it.

## Selection and clipboard

Shift, Ctrl or ⌘ click toggles a node; Ctrl+A selects all; the name tab of a group selects its members. Dragging,
Delete, copy, cut and duplicate work on the whole selection. Paste remaps ids and keeps relative positions; groups are
not copied. The clip is kept in `localStorage` (`kui-ruleset-clipboard`) and offered to the system clipboard.

## Canvas: arrange, mini map, box select, snap

Ported from the OpenWrt editor; the pure parts are `graph/layout.ts`, `graph/snap.ts`, `graph/boxselect.ts` and
`useMiniMap.ts` (`miniVisible`, `miniMapping`).

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

## Subflows

`{ subflowId, name, description?, inputs (0 | 1), outputs[], params{}, nodes, edges, groups }`, used as the block
`subflow.<id>`. Instance ports are the outputs plus `error`. Inside, the blocks `port.in`, `port.out` (names one of the
outputs) and `port.status` are offered, and params are read as `env.<name>`.

- Select nodes, “Convert to a subflow…”: connections into the selection become the input, each distinct (node, port)
  leaving it becomes an output, one instance takes its place, groups inside go with it. It is one undo step.
- “Edit the subflow” (menu on an instance) shows the inside; the bar on top goes back and opens the settings.
- Settings: name, input or not, outputs, params. Renaming an output keeps what is wired to it; removing one removes its
  `port.out` blocks and the connections that left it, everywhere. A subflow in use cannot be deleted.
- Nesting is limited (`subflowDepthLimit`) and a subflow cannot hold itself, not even through others. The palette
  greys out what would break this, with the reason.

## Validation

`validateGraph(graph, catalog, ctx)` returns `{ errors, warnings }`: `unsupported`, `unknown`, `required`, `port`,
`cycle`, `depth`, `edge`, `edge_port`, `no_input`, `one_input`, `missing_in`, `port_in`, `out_name`, `unconnected`,
`no_feed`. `required` is an error when the chain is active and a warning otherwise. The editor marks nodes, lists the
problems (top right) and repeats them in the node panel. It does not block anything: the host decides what to do
(`ref.validate()`). Range, pattern and enum checks (`validateParams`) show next to the field.

## Formats

`transfer.ts` reads and writes three formats and keeps the first two apart from the editor.

| Format | Write | Read |
| --- | --- | --- |
| `kui-ruleset-1` | `buildExport` | `parseImport` (now with groups and subflows) |
| `roltek-automation-1` | `buildRoltekExport` | `parseImport` (detects it; pass `{ catalog }`) |
| Node-RED flow | — | `parseImport` |

How a chain maps to a roltek flow: `nodeId` → `id`, `label` → `name` (written only when it differs from the block
title), `config` → `params`, a param stored in `script` goes back under its own key, `sourceNodeId` / `sourcePort` /
`targetNodeId` → `from` / `from_port` / `to`, `active` → `enabled`, groups and subflows as in the file. Ids that do not
fit (`^[A-Za-z0-9_]{1,16}$` for nodes) are renumbered `n1`, `n2` …

- Secret keys are left out and listed (`omitted`); `{ "$secret": true }` markers stay.
- A block the catalog lacks becomes a placeholder, and a placeholder leaves as an `unsupported` block, so a round trip
  through this editor loses nothing.
- The file has no edge ids; they are numbered again. A flow carries only the subflows it uses (and those they use).
- Config nodes of a file (`configs`) are not imported, and none are written.
- Imported chains are inactive. A connection to a missing block or port is dropped and counted in the preview.

## Not ported from the OpenWrt editor

Debug, trace, hold points, run history and live status (they need the router engine; kui keeps its browser demo
runner for the built-in nodes), deploy with revision conflicts and the approval exchange, roles, `risk` / `tier`
gating, router device lists (the host passes `choices`), server-side validation, and the LuCI pieces. `risk` stays as
catalog data: a risky block has a red header.

## Runtime insight

`RulesetEditor/insight/` is a standalone side panel (Debug with pause, kind filter and download; Busiest; Errors with the
caught link; Data with the context fill bar), driven by host-supplied props. See [docs/insight.md](docs/insight.md).

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
panel, groups, subflows, menus, problems); `RulesetEditor/canvas/canvas-interaction.test.tsx` drives arrange, box
select, snap and guides, the mini map and the extension API; `RulesetEditor/layout.test.ts` covers geometry, visuals
and the runner.
