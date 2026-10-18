# Flow workspace

`RulesetEditor/workspace/FlowWorkspace.tsx` wraps `RulesetEditor` for a host that has many flows. It ports the multi-flow
parts of the OpenWrt automation flow editor (the draft half of `editornav.js`, `editorlinks.js`, `editormerge.js` and
`flowmerge.js`). The editor still shows one flow at a time; the workspace adds a browser draft per flow, jumps through link
blocks and a three-way merge for save conflicts. There is no tab strip: flows are created, renamed, duplicated, exported
and opened from the host's list page. Hosts use the workspace instead of the bare editor and pass the same props. Demo:
`/theme/iot/rulesets/workspace-demo` (several in-memory flows; the row of buttons stands for the host's list).

```tsx
<FlowWorkspace
  ref={wsRef} catalog={catalog} flows={flows} flow={{ id, kind: 'flow', name, graph }}
  onOpen={(flow, o) => router.push(...)}
  loadFlows={(ids) => api.blocks(ids)} loadFlow={(kind, id) => api.flow(kind, id)}
  conflict={conflict} onMerged={(theirs) => setRevision(theirs.rev)} onConflictClose={() => setConflict(null)}
/>
```

`flow` is loaded once: give another flow (a new `id`) to open another one; the workspace remounts the editor, the draft and
the dialogs per flow. After the host saved, call `ref.markSaved(graph)`: that graph is the new baseline and the draft goes.

## Browser draft

One entry per flow or subflow (`kui-ruleset-draft:f:<id>` / `:s:<id>`), written about 0.8 s after the last change. Opening a
flow that has a draft shows a banner with Restore and Discard; Restore is one undo step (`ref.replaceGraph`). The draft is not
written above 2 MB, goes when the host saves, and goes when you undo back to the saved state. Before leaving the flow (a link jump, or the host calling `ref.keepDraft()` before it navigates) the draft is written; if the browser cannot keep it the leave is refused with a message. Every storage
access is in try/catch, so a blocked or full storage only means no draft.

## Link jumps

A `link out` or `link call` goes to its `link in`; a `link in` lists the blocks that call it. The open flow is read live from
the editor; other flows come from `loadFlows(ids)`, kept for 30 s (without it only the open flow is searched). One hit shows
the block (same flow) or calls `onOpen(flow, { nodeId })` (another flow; give `nodeId` back as `focusNodeId`), several hits
open a list, none says so. The menu entry arrives through the editor's `nodeMenuItems`; the host's own `nodeMenuItems` are
added after it.

## Merge

Set `conflict` when saving found a newer version. The dialog has a Merge button (and `conflictActions` for the host's own,
such as overwrite). Merge loads their version with `loadFlow`, then three-way merges by node / group / subflow id and edge key
against the baseline the draft keeps: a change on one side wins, a change on both sides keeps mine and is listed, edges to
missing blocks are dropped. The result goes into the editor as one undo step and `onMerged(theirs, result)` tells the host to
take their revision. The merge itself is pure (`graph/merge.ts`).

## Files

`graph/merge.ts`, `graph/draft.ts` (key, size cap, safe storage adapter), `graph/links.ts` (name resolution, hit search, cache)
- all pure, with tests. `workspace/`: `FlowWorkspace.tsx`, `DraftBanner.tsx`,
`MergeDialog.tsx`, `LinkHitsDialog.tsx`, `useDraft.ts`, `useFlowLinks.ts`, `useMerge.ts`.

## Not ported

The workspace does not load flows itself (the host does). The `[slug]` page of the theme still uses the bare editor.
