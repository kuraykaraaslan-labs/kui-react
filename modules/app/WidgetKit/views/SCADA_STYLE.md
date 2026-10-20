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
