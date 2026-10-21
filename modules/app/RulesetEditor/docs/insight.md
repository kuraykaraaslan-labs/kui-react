# Runtime insight panel

`RulesetEditor/insight/` holds a standalone side panel the host places next to the editor. It ports the debug and
runtime-insight tools of the OpenWrt automation flow editor. It is driven by props: the host supplies every number
(messages, counters, run history, context sizes); nothing talks to an engine. Demo: `/theme/iot/rulesets/insight-demo`.

```tsx
<InsightPanel
  chainId="boiler" messages={ring} nodeStats={counters} nodeNames={names} runs={history}
  selectedNodeId={selected} context={{ memory: { bytes, limit } }}
  onReveal={(id) => { /* select the block and bring it into view */ }}
  onNotice={(kind, count) => toast(kind)}
/>
```

## Tabs

- **Debug**: pause (stops reading new messages; the host ring keeps them and resuming reads what came meanwhile), a kind
  filter (all / errors and warnings / messages only), an optional "selected block" filter, clear, and download of what the
  filters show as `debug-<chain>.txt`. Where the browser blocks the download the text is copied instead (`onNotice` gets
  `'saved'`, `'copied'` or `'empty'`). Keeps the last 300 messages and follows the newest while scrolled to the bottom.
- **Busiest**: blocks by messages in, mean time and errors from `nodeStats`, a bar for the sort key, the top 30, a sort
  toggle. A click selects and reveals the block (`onReveal`). An id with a path (`s1/x`) is one row named after
  its first segment `s1`.
- **Errors**: errors while running (not caught), the errors caught in recent runs (one row per block, text and catcher, with
  counts), and the error counters. "Caught by" reveals the catch block; "its error port" marks an error the block's own
  error port took.
- **Data**: scope and store pickers and the context fill bar: bytes against the class limit, yellow from 80 percent, red at
  100, hidden for the system scope or when no numbers are given.

## Files

`types.ts`, `stats.ts` (busiest rows, caught rows, fill ratio and tone; pure), `debug-log.ts` (ring, kind filter, pause,
text export; pure), `InsightPanel.tsx` with `BusiestTab`, `DebugTab`, `ErrorsTab`, `DataTab`, `FillBar`.

## Not ported

The context key viewer and editor, the event list, hold points, trace and run history tabs (they need the router).
The `ref.select` / `ref.reveal` of the editor is not wired here: the host maps `onReveal` to whatever it has.
