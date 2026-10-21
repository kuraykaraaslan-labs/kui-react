# One pen: the style of the process symbols

Every symbol in `scada.symbol` and `scada.scene` is drawn by these rules, so a diagram that mixes a tank from the water
set, a turbine from the energy set and a reel from the strip line still looks like one hand drew it.
`tests/scada-style.test.ts` fails on a symbol that strays; `harmonize` in `scada-draw.ts` snaps what a drawing asks for.

1. **A box 100 units high.** A symbol's connections sit on the centre lines (`y = 50` left and right, `x = 50` top and
   bottom), so symbols and connections of the same height join without a gap. Pipes are 28 units across (24 inside).
2. **Flat elevation.** Everything is a side view (instruments: a front view). No cylinders with elliptical caps, no
   plan views, no perspective, no gradients, no shadows. Depth is one pale vertical shine (`shine()`) on round bodies.
3. **Three line weights.** `W.hair` 1 (ticks), `W.detail` 1.5 (inner lines), `W.out` 2.5 (every silhouette),
   `W.active` 3.5 (the one strong line: an eye ring, a vane, an arm), `W.bold` 5 (a cable jacket). Pipe walls, flows and
   hoses are wider and free.
4. **Three corner radii.** `R.sm` 3 (small parts), `R.md` 6 (housings), `R.lg` 10 (big vessels and cabinets). A pill
   keeps its half-side radius.
5. **Colour has one job.** Housings are neutral: `SURFACE` (body), `METAL` (parts), `METAL_OUT` (outline), `STEEL`
   (hard steel: rams, coils, solenoid bodies). The state colour (`accent(p)`) goes only on the part that is active:
   an impeller, a fan, a needle, a lever, an "eye" ring, a lamp, the glyph, a valve disc. A liquid is `p.fill` at
   `LIQUID` opacity. Never colour a whole housing or its outline with the state.
6. **Tokens only.** Colours are the theme's `var(--…)` tokens (or a colour the settings give). No hex, no `url(#…)`, no
   ids, no inline style: two symbols on one page must never depend on each other.
7. **Floor-standing machines stand on a base** (a `METAL_OUT` bar 6 high): pumps, filters, drives, transformers,
   generators, cabinets. Vessels and instruments do not.
8. **Readouts live in a lens**: a `SUNKEN` rectangle with a `W.detail` outline and 600-weight text in `INK`.
9. **Motion only for what moves**, only while it runs, only when the viewer allows motion (`p.animate`): flow dashes,
   an impeller, a fan, a rotor, strip marks. The still picture must read on its own.
10. **Ports are honest.** A symbol with a connection draws a stub to the box edge at the right thickness and a coupling
    ring five units in.

Adding a symbol: draw it in a `scada-*.ts` file with `scada-draw` helpers, register it in `SCADA_SYMBOL_DEFS`, and look
at it on the contact sheet next to the others before you commit.

## Sector packs

Symbols outside the first five families live in one file per pack, `views/scada-pack-<name>.ts`, each exporting a
`const X_DEFS = { 'family.name': { family, label, draw, … } } as const satisfies Record<string, SymbolDef>` that
`scada-logic.ts` spreads into the registry. A pack file imports only from `scada-draw.ts`, `svg-node.ts` and its
sibling helpers, never from another pack. Rules on top of the pen above:

- Keys are `kind` or `kind.variant` (`exchanger.plate`), lower case, unique across the whole registry; labels are English, sentence case.
- Every symbol has ports on the centre lines of its 100-unit-high box (left and right at y = 50, top and bottom at x = 50) so it joins a pipe, hose, cable, wire or single line of the same size without a gap. A symbol with no port to the outside (a lamp, a cabinet) needs none.
- State goes on the active part only (`accent(p)`); housings stay neutral; a reading is printed by the host (`valueUnder`) unless it belongs inside the drawing (a dial).
- Motion only through `turning` and the `animate` helpers of `scada-draw.ts`, only while `p.running && p.animate`.
- A pack's sample is one scene and one board in `sample/scada-sector-<name>.ts`.

## Symbol states (`scada-states.ts`)

Besides idle, running, warning and critical, every symbol, drawn by any pack, can be shown in a mode, with doubtful
data, at another speed, in reverse, with an alarm nobody has acknowledged, part way open, or with a command in
flight. None of this is drawn per symbol: `drawScada` calls `applyStates` after the symbol is drawn and turned, and
a connection calls it from `linkNodes`. A pack only has to animate through the shared helpers (`turning`, `blades`,
the flow helpers) so that the speed and direction can change its pace.

| Column or effect | Values | Look |
| --- | --- | --- |
| `mode` | auto, manual, local, maintenance, lockout, simulation | badge top right (M, L, S, wrench, padlock); a lockout also stops actions run from the symbol |
| `quality` | good, stale, bad, offline | dashed frame, dimmed (0.7, 0.55, 0.35), badge top left (clock, ?, cross) |
| `speed` | percent of nominal; 0 = stalled; negative = reversed | animation durations scaled; 0 removes the animation and keeps the colour |
| `direction` | forward, reverse | rotation and flow run the other way; a piston or a flicker has no direction |
| `ack` | false = an alarm nobody has acknowledged | a pulsing frame in the alarm colour and a bell badge (steady where motion is off); true = nothing extra |
| `position` | 0 to 100 | a bar along the bottom of the box |
| `pending`, `failed` | flags | spinner or red mark bottom right |

A single symbol widget has no room for more columns (six slots), so its `status` slot also takes a mode or a quality
word (`maintenance`, `stale`, `offline`). In a scene every one of these is a column of the row and an effect of a rule.
Badges are 24 units across and stay inside the box; they never turn or mirror with the symbol. Every colour is a theme
token, every weight is on the scale above, and `tests/scada-style.test.ts` renders every symbol in these states too.
