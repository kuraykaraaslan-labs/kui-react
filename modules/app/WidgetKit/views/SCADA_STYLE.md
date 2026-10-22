# One pen: the style of the process symbols

Every symbol in `scada.symbol` and `scada.scene` is drawn by these rules, so the symbols of a diagram and the
connections between them look like one hand drew them. The library has four home symbols (`scada-symbols-home.ts`,
family `home`): `home.tv` (television), `home.router` (Wi-Fi router), `home.camera.security` (security camera) and
`home.plug.smart` (smart plug). `tests/scada-style.test.ts` fails on a symbol that strays; `harmonize` in
`scada-draw.ts` snaps what a drawing asks for.

1. **A box 100 units high.** A symbol's connections sit on the centre lines (`y = 50` left and right, `x = 50` top and
   bottom), so symbols and connections of the same height join without a gap. Pipes are 28 units across (24 inside).
2. **Flat elevation.** Everything is a side or front view. No elliptical caps, no plan views, no perspective, no
   gradients, no shadows. Depth is one pale vertical shine (`shine()`) on round bodies.
3. **Three line weights.** `W.hair` 1 (ticks), `W.detail` 1.5 (inner lines), `W.out` 2.5 (every silhouette, a data
   port), `W.active` 3.5 (the one strong line of a part), `W.bold` 5 (a cable jacket, a power port). Pipe walls, flows
   and hoses are wider and free.
4. **Three corner radii.** `R.sm` 3 (small parts), `R.md` 6 (housings), `R.lg` 10 (big housings). A pill keeps its
   half-side radius.
5. **Colour has one job.** Housings are neutral: `SURFACE` (body), `METAL` (parts), `METAL_OUT` (outline), `STEEL`
   (hard steel). The state colour (`accent(p)`) goes only on the part that is active: an LED, a lit screen, the ring of
   a socket, signal arcs, a recording dot. A liquid is `p.fill` at `LIQUID` opacity. Never colour a whole housing or its
   outline with the state.
6. **Tokens only.** Colours are the theme's `var(--…)` tokens (or a colour the settings give). No hex, no `url(#…)`, no
   ids, no inline style: two symbols on one page must never depend on each other.
7. **Standing devices stand on a floor bar** (a `METAL_OUT` bar 6 high): the television on its legs. A device on a wall
   or a socket does not.
8. **Readouts live in a lens**: a `SUNKEN` rectangle with a `W.detail` outline and 600-weight text in `INK`.
9. **Motion only for what moves**, only while it runs, only when the viewer allows motion (`p.animate`): signal arcs
   that pulse, a recording dot that blinks, and on the connections flow dashes and strip marks. The still picture must
   read on its own.
10. **Ports are honest.** A symbol with a connection draws a stub to the box edge at the right thickness: a thin data
    stub (2.5) where a `line` or `wire` joins, a cable jacket (5) where a `cable` joins, a pipe with a coupling ring
    five units in where a `pipe` joins.

Adding a symbol: draw it in a symbol file of its family (`views/scada-symbols-<family>.ts`) with the `scada-draw`
helpers, export its entries as `const X_DEFS = { 'family.name': { family, label, draw, … } } as const satisfies
Record<string, SymbolDef>`, spread them into `SCADA_SYMBOL_DEFS` in `scada-logic.ts`, give it a row of search words in
`scada-aliases.ts`, and look at it next to the others before you commit. Rules on top of the pen above:

- Keys are `family.kind` or `family.kind.variant` (`home.plug.smart`), lower case, unique across the registry; labels
  are English, sentence case.
- Every port sits on a centre line of the 100-unit-high box. A symbol with no port to the outside needs none.
- State goes on the active part only (`accent(p)`); housings stay neutral; a reading is printed by the host
  (`valueUnder`) unless it belongs inside the drawing (a display).
- Motion only through `animate` / `animateTransform` children, only while `p.running && p.animate`.

## The diagram and its connections

`scada.scene` places symbols by coordinates and joins their ports with connections that route themselves
(`scada-scene-logic.ts`): horizontal and vertical legs with rounded corners, drawn at the thickness of a symbol port
at the scene's scale. A pipe and a signal wire come from `scada-draw.ts` (`pipes`, `wire`); a hose, a cable and a strip
from `scene-connections.ts`; a single line and a plain line are drawn by the scene itself. The connections follow the
same pen: tokens only, the state colour on what flows, motion only while running.

The diagram editor (`SceneEditor.tsx`) edits a copy of the scene in an undo history: the palette (searched by name,
other names and sector, `scada-aliases.ts`), the canvas (snapping, alignment, connecting ports by dragging), the
inspector, the data-driven rules, the problems list, the what-if values and the minimap. Its pure rules are in
`scene-edit-*.ts` and `scene-editor-state.ts`.

## Symbol states (`scada-states.ts`)

Besides idle, running, warning and critical, every symbol can be shown in a mode, with doubtful data, at another
speed, in reverse, with an alarm nobody has acknowledged, part way open, or with a command in flight. None of this is
drawn per symbol: `drawScada` calls `applyStates` after the symbol is drawn and turned, and a connection calls it from
`linkNodes`. A symbol only has to animate through `animate` / `animateTransform` so that the speed and direction can
change its pace.

| Column or effect | Values | Look |
| --- | --- | --- |
| `mode` | auto, manual, local, maintenance, lockout, simulation | badge top right (M, L, S, wrench, padlock); a lockout also stops actions run from the symbol |
| `quality` | good, stale, bad, offline | dashed frame, dimmed (0.7, 0.55, 0.35), badge top left (clock, ?, cross) |
| `speed` | percent of nominal; 0 = stalled; negative = reversed | animation durations scaled; 0 removes the animation and keeps the colour |
| `direction` | forward, reverse | rotation and flow run the other way; a pulse or a blink has no direction |
| `ack` | false = an alarm nobody has acknowledged | a pulsing frame in the alarm colour and a bell badge (steady where motion is off); true = nothing extra |
| `position` | 0 to 100 | a bar along the bottom of the box |
| `pending`, `failed` | flags | spinner or red mark bottom right |

A single symbol widget has no room for more columns (six slots), so its `status` slot also takes a mode or a quality
word (`maintenance`, `stale`, `offline`). In a scene every one of these is a column of the row and an effect of a rule.
Badges are 24 units across and stay inside the box; they never turn or mirror with the symbol. Every colour is a theme
token, every weight is on the scale above, and `tests/scada-style.test.ts` renders every symbol in these states too.
