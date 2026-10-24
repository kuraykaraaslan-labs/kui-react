# WidgetKit view design

One look for all 25 widget types. Every view builds from `views/ui.tsx`; a view never invents its own
font size, colour, spacing or chip. Settings may override a part (a font, a colour), never the system.

## Roles

| Role | Primitive | Default look |
|---|---|---|
| Main number | `Metric size="xl"` | semibold, tabular, tight tracking, `--text-primary`; auto-scales to the card (`clamp(1.5rem, min(14cqi, 36cqb), 3rem)`) |
| Secondary number | `Metric size="lg" \| "md"` | 1.5rem / 1.125rem, same weight |
| Unit | inside `Metric` | 0.5em, medium, `--text-secondary`, 0.25em gap |
| Label (what the number is) | `MetricLabel` | 12px medium `--text-secondary`, one line, truncates |
| Meta (time, "of 100K", captions) | `Meta` | 11px `--text-secondary` at 80% |
| Change | `Delta` | 12px medium chip: ▲/▼ + text, good = `--success`, bad = `--error`, neutral = `--text-secondary`, tinted background 12% |
| Icon | `IconTile` | 36px rounded-lg tile, tint 14% of its colour, icon 18px |
| Status | `Pill` | 12px medium, dot or icon, tint 14% of its colour |
| List row | `Row` | 36px min, divider `--border`, label left (13px secondary), value right (13px primary, tabular) |
| Section gap | — | 8px inside a block, 12px between blocks |

## Layout rules

- Single-value widgets (stat, sparkline, progress, gauge, state): label top-left, icon top-right, number below,
  meta/change under the number. Same order everywhere; layouts only move these parts, never restyle them.
- Charts fill the body. Axis text 11px `--text-secondary`; grid lines `--border` dashed; no axis line except
  the baseline; legend 12px with 8px dots, below the plot by default; values on round ticks.
- Lists (table, feed, attributes, links) share `Row`; tables use 36px rows (compact 28px).
- Controls are 36px high, `--primary` by default, disabled at 50% with the reason in a tooltip.
- Colours from settings go through `cssColor`; tones are theme tokens so light and dark both work.
- Empty and unconfigured states are the card's job (`WidgetCard`), never a view's.
- Every text a view draws comes from `useKitMessages()` (the host's language), never a literal in the view.
- On a board the grid cell is placed from lg up only (`--wk-gc` / `--wk-gr`); below lg cells stack in y, x
  order, and a card's hide / order settings act on the cell (`cardCellResponsive`). In edit mode nothing
  is hidden (cell or card), so a hidden card keeps its edit buttons and the setting can be undone.
- A gesture the host wires (README "Host gestures") changes the look only while it is wired, and then the same way
  everywhere: a clickable mark is a button with a pointer cursor and the focus stroke (`--border-focus`); a
  selection band is the primary colour at 12% between two 1px primary edges; a focusable plot takes the 2px focus
  ring. Without the prop a chart stays one picture (`role="img"`).
- Things from data (a scene's `things` table) look exactly like authored symbols on a board; only the editor marks
  them, as a locked layer: a veil of `--surface-base` at 50% with a dotted `--text-secondary` outline over each, the
  focus stroke dashed around the one the inspector shows, never a handle or a keyboard stop. A drawing the diagram
  cannot draw (an unknown or locked symbol key) is the placeholder: a dashed `--text-secondary` box on
  `--surface-sunken` with a question mark, the size of a symbol box.
