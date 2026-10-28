# Symbol binding panel (`SymbolBindingPanel`)

next-boilerplate phase 45.4, decision D45-10: in edit mode a click on a symbol of a drawing (2D or 3D) opens a panel for that
symbol only. The owner's words are the acceptance test: *"Open the drawing, click a symbol, pick the device and which of its
values feeds that symbol, and if the value needs flipping or scaling type a one-liner, see it live right there, then the next
symbol. A SCADA editor must not be this hard. No scene key, slot, kind, role, Matched/Unmatched on screen."*

The panel is a plain section the host places in its side drawer (about 360 px wide, one column). It is props-driven and
fetches nothing; the host supplies the data, so next-boilerplate and the other kits can use it as it is.

Files: `views/SymbolBindingPanel.tsx` (the component), `views/symbol-binding-logic.ts` (pure, tested on its own),
`views/symbol-binding-messages.ts` (the English texts, `messages` prop in the host's language).

## Props

```ts
interface SymbolBindingPanelProps {
  symbol: {
    id: string;            // internal: never drawn, only data-symbol-id and the <element>.<field> key match
    label: string;         // "Boiler"
    kindLabel: string;     // "Combi boiler"
    icon?: ReactNode;
    fields: Array<{
      name: string;        // 'running' | 'value' | 'status' | the symbol's own field (map v2 symbol field grammar)
      label: string;       // "Running"
      currentSource?: { deviceId: string; deviceName: string; key: string; automatic?: boolean };
      currentScript?: string;
      live?: unknown;
    }>;
  };
  searchDevices(query: string): Promise<Array<{ id: string; name: string; code?: string; hint?: string }>>;
  loadKeys(deviceId: string): Promise<Array<{ key: string; label?: string; unit?: string; value: unknown; ts: number | string }>>;
  onSave(entry: BindingEntry): void | boolean | Promise<void | boolean>;
  onNext?(): void;
  onClose(): void;
  onClear?(): void | boolean | Promise<void | boolean>;
  previewScript?(script: string, sample: unknown): { ok: true; result: unknown } | { ok: false; error: string };
  saving?: boolean;
  error?: string;
  readOnly?: boolean;
  menuActions?: Array<{ id: string; label: string; onClick(): void; disabled?: boolean }>;
  defaultDevice?: { id: string; name: string } | null;
  refreshMs?: number;     // default 5000, 0 = once
  now?: number;
  messages?: DeepPartial<SymbolBindingMessages>;
  portalTarget?: Element | string | null;
  className?: string;
}

// What onSave receives: the map v2 entry's `fields` (scene-binding-logic.ts: FieldRead) plus an additive one-liner per field.
interface BindingEntry {
  fields: Record<string /* symbol field */, { deviceId?: string; key: string; label?: string; script?: string }>;
}
```

## Decisions (owner delegated: engineering grounds; SP2-n)

| # | Decision |
|---|----------|
| SP2-1 | **Section, not drawer; host-agnostic.** The panel is a section that fills its parent (`h-full`, one column). The host places it in its side drawer, a 3D card's side area or a modal. It never fetches, never reads a store, and never names a route. |
| SP2-2 | **The entry is the map v2 field map plus `script`.** `BindingEntry.fields[name]` is `FieldRead` (`deviceId?`, `key`, `label?`, from `scene-binding-logic.ts`) with an additive `script?`. The grammars and caps are not redefined: `isSymbolField` (field name, prototype names and reserved row columns refused), `isTelemetryKey` (key, max 64), `UUID_GRAMMAR` (device id), `MAX_FIELD_LABEL` (60), `MAX_FIELDS_PER_KEY` (16). A value the grammar refuses drops its field; it is never cut (a cut key is another key). A label is cut at 60 and a script at 200 characters (`MAX_SCRIPT_LENGTH`). An entry with no fields means "this symbol reads nothing": the host removes the symbol's map entry. |
| SP2-3 | **One device at a time, per-field device on the wire.** The panel works on one device (the device of the first field that reads one). Every saved field carries its `deviceId`. A field that reads another device (D45-3 allows it) is kept, shown with "from <device>", and saved as it is until the person picks a key for it, which moves it to the panel's device. Picking another device clears the keys of the fields that read the old one and proposes again; scripts of cleared fields are dropped with them. |
| SP2-4 | **Suggestions are conservative and happen once per device.** `suggestKeyForField(field, keys, element?)`: (1) `<element>.<field>` when the symbol's id is the element, (2) a key named like the field (any `<prefix>.<field>`), (3) key name or key label equal to, then containing, the field's name or label (3 letters or more), (4) the field's type (a state for `running`, a word for `status`, a measure or a key with a unit for `value`), (5) the only key. A step with several answers stops the search: a wrong pick is worse than an empty one. `suggestKeysForFields` never gives one key to two fields. Suggested fields carry a "Suggested" badge until touched. Suggestions are made once when a device's values first load, never over a pick, and not again after a field is cleared. |
| SP2-5 | **Live means polled.** `loadKeys` is called when a device is picked and again every `refreshMs` (default 5 s; paused while the tab is hidden). The first failure shows "could not be loaded" with a retry; a later failure keeps the last list. The age ("4 s ago") re-counts every 5 s from `now`. The list shows at most 100 keys; every key is in the pickers. |
| SP2-6 | **Focus.** On open focus goes to the device search when the symbol has no device. When a device is already pre-selected focus goes to the first value picker instead: opening the device list over the values would hide what the person came to look at. Nothing takes focus in `readOnly`. |
| SP2-7 | **Convert.** Collapsed, opens by itself when a field already has a one-liner. One single-line monospace input per field that has a key; `value` is the only variable, 200 characters at most; five chips (Invert `!value`, Scale 0–100 `value / 4095 * 100`, Round, Threshold `value > 80`, Words `value === "on"`) fill an editable template. The preview line (`aria-live="polite"`) is debounced (250 ms), runs the host's `previewScript` on the key's live value, shows `1 → true` (text is quoted, `"on" → true`), waits when the key has no value yet, and words an error by kind (incomplete expression, unknown name, too slow, other with the detail). It never throws: a throwing sandbox is an error line. Without `previewScript` the line stays empty. |
| SP2-8 | **Save contract.** `onSave` resolving (or returning nothing) is saved; rejecting or resolving `false` is not (the host shows `error`, the panel keeps the changes and Save stays on). After a save the entry is the new baseline, and a host that redraws with the new `currentSource` values resets the baseline to them. Save is off until the entry differs from the baseline; whitespace, the device alone and fields with no key are not changes. |
| SP2-9 | **Next symbol.** Saves first when there are changes, and moves only when the save succeeded. A symbol that reads nothing starts on the device the last saved symbol used (or `defaultDevice`), so a run of symbols on one device is a run of one pick each. `nextUnbound(symbols, currentId)` is the helper a host uses to choose the symbol: the first unbound one after the current, wrapping, never the current, null when none. |
| SP2-10 | **Clear and the bulk shortcuts live behind "…".** "Clear what this symbol reads" asks through the kit's ConfirmDialog and then calls `onClear`, or saves an entry with no fields. The host's own entries (`menuActions`: "bind every symbol of this drawing to this device", "apply to every device of this profile") sit above it (D45-10: the Scene drawer wizard is reached from here). Close on unsaved changes asks through ConfirmDialog (Discard / Keep editing); a clean panel closes at once. |
| SP2-11 | **No internal word on screen.** The symbol's id appears only in `data-symbol-id` (no `title`). Scene key, slot, kind, role, match and unmatched are not in the messages. The device's own telemetry keys are shown: they are the device's vocabulary, which is what a person picks from. |
| SP2-12 | **Tokens and primitives only.** Select (native), ComboBox (async, debounced by the kit), Input, Button, Badge, AlertBanner, DropdownMenu and ConfirmDialog of the kit; no new colour. The device search is the kit's ComboBox (not clearable: a symbol's device is changed, and "Clear" removes the binding). |
| SP2-13 | **No demo page.** The scene setup drawer has none in this repo, so none is added; the tests are the usage examples. |
| SP2-14 | **The "…" menu opens upward.** The footer sits at the bottom of the side dock, so the menu is `DropdownMenu` with `placement="top"` and `portal`: it hangs above the trigger, is capped to the space above it (it scrolls inside that) and is kept inside the width of the viewport, a 360 x 640 phone sheet included. Enter opens it, the arrows move, Escape closes it and focus returns to the trigger. |
| SP2-15 | **Automatic fields.** A field whose source the host found by the drawing's own naming (a `currentSource` with `automatic: true`, no entry of its own) is drawn as any other: its picker is pre-filled, the device is the one of the match, and a small grey "automatic" stands beside the label, so a symbol that draws live data never reads "Not used". Saving writes only what the person changed or filled: an untouched automatic field is left out of the entry (`entryFromDraft`), one the person picked is written (even the same key as the match), and a one-liner on an automatic field writes the field with its key. "Not used" on an automatic field goes back to the automatic source (an entry cannot switch the match off); picking another device, or Clear, leaves the automatic source of the old device behind. An automatic source is bound (`isBound`) but is not an entry of its own (`hasOwnEntry`: Clear has nothing to clear on a symbol with only automatic fields). When the host answers with a changed symbol and nothing is unsaved, the fields follow it (a saved field stops being automatic). |

## What the host does (next-boilerplate 45.4.4)

- `searchDevices('')`: the page subject's devices and the bound ones first; `searchDevices(q)`: the tenant's devices.
- `loadKeys(id)`: the device's latest telemetry (the device-elements read); `previewScript`: the phase 35 sandbox runner.
- `onSave(entry)`: the binding routes (field map plus script, revision / 409 flow); reject on a 409 and set `error`.
- `onNext`: `nextUnbound` over the drawing's keys; 2D: a symbol click while editing opens the panel and the outline marks the
  symbol; 3D: `onItemClick` opens the same panel and `selected` marks the item.
