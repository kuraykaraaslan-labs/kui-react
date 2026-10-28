# Changelog

All notable changes to this project will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- `MapView` / `MapCanvas`: the default basemap is OpenStreetMap's standard tiles (keyless, attributed), drawn darkened in
  the dark theme (Esri's Canvas maps were the default since CARTO started asking for a key). An installation sets its own
  tile source once with `MapTilesProvider` (`MapTileSource`: URL template, attribution, subdomains, deepest zoom, optional
  dark URL), checked by `safeTileSource`; a map's `tiles` prop still wins, and the map widget's "Follow the theme" style
  takes the source too. `MapTiles` gains `subdomains`, `maxZoom` and `dim`. OSM's tile policy fits light use: production
  traffic belongs on a keyed provider.
- Map markers: a dot or circle carries a short escaped `text` (a count); `clusterText` sets what a cluster bubble says; a
  mixed cluster takes the worst status variant among its markers instead of the primary colour.
- `AssetsMapDrawer`: sites are circles coloured by the worst active alarm with the alarm count inside, sized by devices;
  clusters add their sites' alarms up and split as the map zooms in.
- Map tiles send the page's origin only (`TILE_REFERRER_POLICY`, `strict-origin`) on every tile layer, so a keyed provider
  that checks the Referer also answers a page whose own policy is `no-referrer` (a display link).
- The event domain's `VenueLeafletMap` draws the installation's `MapTilesProvider` source, else OpenStreetMap's, darkened
  in the dark theme, instead of always requesting OpenStreetMap.

### Added

- **SchemaForm `hidden` field flag.** A field marked `hidden` is never drawn, in any mode, and its stored value is handed back unchanged on every edit: for a setting another screen owns (next-boilerplate's scene setup drawer writes the element map of a 3D card; a person should not edit it by hand).

- WidgetKit `SceneSetupDrawer`: "Remove this setup" (next-boilerplate phase 42, SP-10). With `onRemove` the footer offers it while the form is on a SAVED
  setup (a document in `initial`, under the slot and kind the form is on, so a kind or slot switch the host has not answered offers nothing). The drawer asks
  first through the kit's ConfirmDialog, which names the kind and the slot (`messages.removeBody(kind, slot)`), and on confirm calls
  `onRemove({ slot, kind })`; the host removes that binding. `removing` makes the button wait. New messages: `removeButton`, `removeTitle`, `removeBody`, `removeConfirm`.
- WidgetKit `SceneSetupDrawer` for kind `diagram` (next-boilerplate phase 42.5.4): `SceneSetupPreview2D` draws a stored 2D diagram read-only with the card's
  own `ScadaSceneView` (every symbol a button, Enter and Space too, the picked one outlined, no rules, a locked-out symbol still pickable) and answers
  a click with the symbol's id: the host passes it as `preview` and keeps `pickedKey`, so "Pick" works on a diagram as it does on a 3D design. The kind
  is now a real choice: switching it starts the form over from that kind's saved setup (`onKindChange`, the host answers with `initial` and a new
  `resetKey`; asked first through a ConfirmDialog when the form has edits; another kind's document, entries, view and rules never reach the draft),
  and `kindLocked` fixes it for a card's menu entry. The Rules step is on for `diagram` as well (`rulesKinds` defaults to `['design', 'diagram']`): the
  rows are scene rules of the process scene's own engine, with a state, a colour, hide, a blink and a label (`DIAGRAM_RULE_EFFECTS`, a `dialect`
  argument on `designRuleIssues`, `isDesignRule`, `addDesignRule`, `updateDesignRule`; `validateDraft` judges a diagram's rules with it).

- WidgetKit `SceneSetupDrawer` (next-boilerplate phase 42.2.3c, TK-6): the slot is a real field. `slots` lists the subject's slots and
  `allowNewSlot` adds "New slot…" with a name field that follows the server's slot grammar (lower-cased and dashed as it is typed,
  reported through `onSlotChange` on Enter or blur; the form starts over from the host's answer, after a ConfirmDialog when it has
  edits); `slotLocked` fixes it for a card that opened the drawer. `documentChanged` shows "The drawing changed since this was set up"
  with the number of saved entries the drawing no longer has, and lets an unchanged setup be saved to renew it. Pure helpers in
  `scene-binding-logic`: `slotChoices`, `normalizeSlotInput`, `slotIssue`, `documentChanged`.
  `onNewFromDevice` may answer with the new document's id (a promise is awaited): the drawer then chooses it, keeping the form's edits.
- WidgetKit `SceneSetupDrawer` gets a Rules step for a 3D design (next-boilerplate phase 42.6, D42-11): the fifth section lists the
  binding's rules as sentence cards ("For heater: When value of this item is above 80, colour it red and pulse") with a form each.
  A rule targets a scene key of the chosen document (or every item), reads up to two conditions (a column of the item's own row or
  another key's, or a board parameter) and sets colour, hide, label (with `{value}`, `{label}`, `{id}`, `{param:name}` tokens), pulse
  and outline. Rules are added, moved, duplicated, switched off and deleted in place; they go out in the draft's `rules`. A rule that
  names a key the document does not have is flagged and kept; a saved row the 3D card does not read is listed as it is and holds
  the save until it is deleted (`rule-invalid`). New props `rulesKinds` (default `['design']`), `ruleColumns`, `ruleParams`; texts
  under `messages.rules`. The pure part is `views/design-rules-logic.ts`: the shared rules engine with a design effect spec
  (`designRules` turns what the rules decided into kui-viewer 0.8.0's per-item `overrides`, the `hidden` keys and, for an older
  viewer, `status` words), the edits, `designRuleIssues` (what the host's server repeats) and `staleReferences`. The condition form
  and the colour control moved from `SceneRulesEditor` to `scene-rules-form.tsx` and are shared with the diagram editor (unchanged).
- WidgetKit `content.video` v2: the **Live** options (next-boilerplate iot-camera phase 05, OD-169). `presenceMinutes` (select `'5'` /
  `'10'` / `'15'` / `'off'`, default `'5'`, "Ask 'still watching?' every") and `stopWhenHidden` (boolean, default on, "Stop the stream when
  the card is out of view"); the migration from v1 adds both defaults. `autoPlay` keeps its place; its description says that for a live
  stream nothing is loaded until play is pressed when it is off. The kind gets a second optional bound slot, `sourceHigh` ("Higher
  quality address", scalar): when both addresses are valid the player is given `sources: [Standard, High]` with
  `preferAlternateInFullscreen`, otherwise nothing changes; stream quality is otherwise the player's own menu. The card knows nothing
  about cameras (OD-173): any HLS address, bound or typed.
  The model (`videoModel`) decides `presence` (`{ everyMs, graceMs: PRESENCE_GRACE_MS = 30 s }` or null; only a stream is ever asked, a
  video file is not), `stopWhenHidden`, `sources` and `preferAlternateInFullscreen`; `videoPresence` and `videoSourceHigh` are new.
  Messages: `content.videoQualityStandard` / `videoQualityHigh`.
- `content.video` holds an HLS stream back until play is pressed when "Start playing on its own" is off: the model's new `loadOnPlay`
  (true only for HLS with autoPlay off) goes to kui-player's `loadOnPlay`, so a camera's live link is not requested before. A video
  file is unaffected. Needs kui-player 648328e (`loadOnPlay`).
- `WidgetBoard` puts its video cards in one presence group (`VideoPresenceBoard`, `useVideoPresence`): a board of twelve streams asks
  "Still watching?" once, at the shortest interval among the cards that ask, and with no answer stops all of them; a card set to `off`
  never joins, a card outside a board asks inside its own player. kui-player's React subpath loads only when a card asks.
- Dependency: `@kuraykaraaslan/kui-player` is pinned to the git revision `648328efecc3286318d56966890f60f5e951a9b6` (branch
  `feat/iot-camera-live`: live mode, presence groups, alternate sources) until that release is published; switch to the released version then.

- IoT `AssetDrawer` takes `actions` (the host's own buttons in the header, after "Open dashboard", shown once the asset has loaded) and `AssetsView` takes `drawerActions(assetId)` to fill it: a host module can put a button that opens a drawer of its own beside the asset's own actions (next-boilerplate's "Scene" button, phase 42).

- WidgetKit `SceneSetupDrawer` (next-boilerplate phase 42.2.3): the scene setup as one right-side drawer, a scrolling form with no tabs.
  Slot (text or select) and kind (segmented, only the kinds the host passes); the document in a DataTable (name, updated, used by,
  with search, sort and a use filter) and an optional "New from this device" button; the devices in a DataTable with an editable
  role proposed from the device code; the matching table of scene keys with a status badge (matched by key, by label, proposed by
  type, set by hand, unmatched), an element select per row, "Match automatically", a "Pick in the scene" button per row (`onPick`;
  the key the host reports comes back as `pickedKey`, shown above the table; the host's canvas goes in the `preview` slot), Accept
  for a type proposal, and the unresolved count; the save goes through the kit's `ConfirmDialog` (an acknowledgement for what
  stays open, an optional reason) and is off while nothing changed. A 409 shows through `conflict` with a Reload action. Texts come
  from the `messages` prop. The pure part is `views/scene-binding-logic.ts`: `autoMatch`, `bindingDraft` (exceptions only: an
  identity match is never stored), `validateDraft` (key grammar `^[A-Za-z_][A-Za-z0-9_.-]{0,47}$`, 100 devices, 500 map entries),
  `unresolved`, `proposeRoles`. Demo at `/theme/iot/scene-setup`.
  Review fixes: the drawer no longer drops a saved thing silently. Saved `map` entries for keys the document no longer has, saved
  `devices` roles whose device is not listed and saved `hidden` keys with no key are listed as stale entries that stay in the payload,
  need the acknowledgement in the save confirmation while kept, and can be removed one by one (`staleEntries`); Save is off while the
  keys of the chosen document have not loaded (`sceneKeysLoading`, or `sceneKeysDocumentId` differing from the chosen document).
  `view` and `rules` of the saved binding travel through `initial` and `onSave` unchanged (a PUT no longer erases them).
  `validateDraft` applies the server grammars (slot, kind, uuids; `slot-invalid`, `kind-invalid`, `document-invalid`,
  `device-invalid`), the slot field is lower-cased and capped at 32 and starts as `main`. An empty `deviceId` is no device: no key
  match, pool entry or map entry for a role without a device. The label step counts a label over all keys and all elements of the role
  before the key step, so an ambiguous label never matches silently. A per-device "in the scene" toggle (count against the 100 cap,
  role proposals for included devices only) and a per-key "Don't bind" / "Bind again" (the key goes into `hidden`, round-tripped).
  The form and its baseline come from one snapshot of `initial`: a new `initial` restarts an untouched form, and shows a "saved version
  changed" notice with Reload when the form has edits. The document radio column's screen-reader header is "Choose".

### Fixed

- IoT kit list views (`DeviceListView`, `DeviceProfileListView`, `AlarmListView`, the asset's devices tab, `PlaceDevicesDialog`) on
  the DataTable's own toolbar: search, the Filters panel (the old labelled selects and the severity chips; the alarm status is a
  toolbar choice), sortable columns, rows per page and pagination, server-side through the adapter. The query types carry
  `sort` (`IotListSort`; `DEVICE_SORT_KEYS`, `PROFILE_SORT_KEYS`, `ALARM_SORT_KEYS`); `api/list-table.ts` maps the table's query and a
  host URL's `sort` / `size`. Bulk Activate, acknowledge and clear sit in the table's selection bar; `PlacedDeviceTable` takes
  `paging`. Before, a hand-made search box, selects and pagination sat beside the table: no sort arrows, no Filters panel, no rows
  per page.

- `ControlButton`: its status line takes room only while it has a status (its live region stays mounted, out of the
  flow), so the button centres in its card instead of sitting 22 px high; the `tile` layout, unframed, fills the height it
  is given (at least 96 px), so `control.button` can fill its card. New `ControlTile` props `fill` and `reserveStatus`
  (default `true`: the switch, the slider and the set-point keep the line's room, so a status never moves them).
- WidgetKit `WidgetCard`: from lg up the card buttons hidden until hover take no room (a short title keeps the whole row);
  hover or keyboard focus inside the card shows them, their focus rings unclipped. A screen that cannot hover (a touch
  tablet in landscape, a kiosk) always shows them.
- WidgetKit `data.table`: a row button draws its entry's icon before the label, or alone (named by the label) when the
  host marks it `iconOnly`; `TableRowActions.buttons` takes `icon` and `iconOnly`.
- `MapView` grouping: `ClusteredMarkers` reads the map's zoom when it subscribes as well as on every `zoomend`, so the
  first fit (which zoomed before it listened) regroups the markers; seven sites showed as one bubble.
- `Timeline`: a day heading is drawn in the timeline's `surface` (new prop, `base` by default, `raised` inside a card; the
  hollow marker of an upcoming step and the gap of the current step's ring follow it), opaque instead of a blurred band of
  the page colour, lines up with the events' text and keeps a gap above the first marker; the last event has no padding
  under it (Load more keeps its gap). `AlarmEventTimeline` sits on `raised`. Seen on an alarm's history in dark mode: a
  dark band flush with the card's edge, the first icon touching it, dead space after the last event.
- `NotificationMenu`: an item with `href` is a link whose plain click runs `onClick` (the host opens it inside the app and
  marks it read); before, items were buttons and a host had no target to give them.
- Package consumers: `@kuraykaraaslan/kui-react/styles` now carries Font Awesome's icon CSS in Tailwind's `base` layer
  (as the showcase's `app/globals.css` does since the icon size fix), so a host that turns Font Awesome's unlayered
  runtime CSS off still has icon styles and a size class on an icon applies. README "Styling setup" says how.

### Deprecated

- `AdvancedDataTable`: a thin wrapper over `DataTable` (`selectable`, `renderExpanded`, `stickyHeader`) and marked
  deprecated in the showcase; it is removed next. `onSelectionChange` still reports positions in `rows`.
- IoT (OD-9, the term is Alarm): `AlertSeverityBadge`, `AlertDetailHeader`, `AlertEventTimeline`, the types `AlertEvent`,
  `AlertEventKind`, `AlertSeverity`, `AlertStatus`, `Alert` and the schemas `AlertSeverityEnum`, `AlertStatusEnum`, `AlertSchema`
  are aliases of their `Alarm*` names (`modules/domains/iot/alarm/`, `types/alarm.ts`), and `/theme/iot/alerts/**` redirects to
  `/theme/iot/alarms/**`. The aliases and the redirects are removed in the next minor. `AlarmSeverityBadge` has five levels
  (CRITICAL, MAJOR, MINOR, WARNING, INFO); the old three values stay valid. `AlarmDetailHeader`'s `onResolve` is now `onClear`
  (the old name still works for one release). The demo seed `ALERTS` / `ALERT_EVENTS` / `alert-00n` is `ALARMS` / `ALARM_EVENTS` /
  `alarm-00n`.

### Removed

- WidgetKit: the process symbol library is reduced to four home symbols, drawn as before: `home.tv` (television),
  `home.router` (Wi-Fi router), `home.camera.security` (security camera) and `home.plug.smart` (smart plug), in
  `views/scada-symbols-home.ts`. `scada.symbol` defaults to `home.router`; `scada.scene`, its connections, the states
  layer and the diagram editor are unchanged and draw these four. The palette has one family (`home`) and five
  sectors. `SYMBOL_RENAMES` and `canonicalSymbol` are gone: a saved symbol that is not in the library falls back to the
  default in a symbol widget and is listed as a problem in a diagram. The scene's hose, cable and strip connections
  live in `views/scene-connections.ts`. The SCADA and sector sample boards are gone; the widget gallery and the IoT
  theme's diagram editor use one small diagram, `sample/scada-home.ts` ("Home network"), and the gallery's form edits
  its router settings. kui-ejs and KUInative vendor these files and follow on their next re-vendor.

### Added

- `TabGroup` `activeTab`: the host keeps the open tab (a page's `?tab=`); the group follows it whenever it changes and
  reports the reader's choice through `onTabChange`. A sidebar link to a page's tab opens that tab on a page already open.
- `AppSidebar`: an item whose own page is active shows its children too (a parent page such as Members shows Invitations
  under it while it is open), before only a branch holding an active descendant opened.
- `Card` `density`: `compact` pads header, body, footer and the loading skeleton 16 px at the sides instead of 24 px, for
  a 320-400 px side panel or an embedded view (an Autodesk Forma extension panel); `default` is unchanged. kui-ejs
  `Card.ejs` and KUInative `Card` take the same prop.
- `Stepper` `warning` state: a step that ran but needs attention (a check that passed with a caveat), drawn hollow
  (`warning-subtle` fill, `warning` ring, a `warning-fg` exclamation mark) so the mark keeps 3:1 in both themes, where white
  or near-white on the amber fill falls below it in one; its label is `warning-fg` and the line after it continues in
  `warning`. `StepState` is exported. Same in kui-ejs `Stepper.ejs` and KUInative `Stepper`.
- `NotificationMenu` one list: `sources` (`NotificationSource`: key, label, items, unread, action, viewAll, emptyLabel,
  summary) join the notifications newest first (`at`), with a filter All / <source> / Notifications, each source's action in
  the header (where it applies; it closes the menu and puts focus back on the bell before it runs, so a confirmation it
  opens is not left under the panel), its page in the footer, its `summary` line under its own filter, and its unread count
  in the badge. Header actions are keyed by whose they are, so one that goes away does not hand its focus to the next. Items take `at` (written relative in
  `locale` when there is no `timestamp`), `icon`, `meta`, `href` and an inline `action`; `labels` translate the menu.
- IoT bell: `useAlarmBellSource` / `AlarmBellSource` hand the alarms to a host's `NotificationMenu` as such a source
  (severity icon, title, device and site, opening time, inline Acknowledge for an OPEN alarm, a click that opens it; every
  OPEN alarm counts as unread; the summary says how many are open and acknowledged). "Acknowledge all (n)" asks first, with the alarm list's optional note (`confirmDialog`).
  `AlarmBellMenuProps.onNavigate` opens the bell's links inside a host app.
- IoT bell traffic (`alarm-bell-state.ts`, `AlarmBellSync`): each live alarm event updates the counts and the list
  without asking the host (created, acknowledged, updated with `severityChange`, cleared by `acknowledgedAt`), an event
  older than what the bell holds for that alarm (status, then occurrences) is ignored, and the host is asked only at the
  start (with the subscription's first snapshot, or after 3 s without one), on every later snapshot (the subscription is
  live on the server from then on, a reconnect included), when the list runs short or drifts, when an event about an alarm
  the last answer did not list arrives within 2 s of it (it may be counted already), after a failed answer (all at most
  once per 30 s), every 5 minutes, and every 60 s without a live source; a 429 waits its `Retry-After` and then asks again. An adapter without
  `alarms.parseLive` re-reads after an event, at most once per 30 s. `AlarmLiveEvent.severityChange` and `Alarm.siteName`
  are new (both optional).
- AppSidebar nested items: `AppSidebarNavItem.children` (any depth) render indented behind a disclosure toggle;
  a parent with an `href` keeps its link and gets a separate chevron button, a parent without one toggles from its
  whole row. `defaultExpanded` opens a branch; the branch holding the active item always starts open, a collapsible
  group counts a nested active item as its own, and search keeps the branch down to a match (a matching parent keeps
  its subtree). Icon-only mode shows top-level items only and gives the one holding the active page the active look.
- AppSidebar `renderLink(item, props)` renders linked items yourself, e.g. `<Link {...props} />` from next/link, as
  `Breadcrumb` and `DocPager` already allow. Because the sidebar then survives a page change, a new `activeId` opens
  its group and branch.
- AppSidebar `headerClassName` / `footerClassName` style the slots' bordered wrappers, e.g. `md:hidden` to drop the
  whole strip at a breakpoint. A `false` or `''` slot no longer draws an empty strip. Found while building
  @kuraykaraaslan/docs, whose phone-only navbar links in the sidebar header left a bordered strip on desktop.
  Same nesting and slot classes in kui-ejs's AppSidebar.ejs; KUInative has no AppSidebar.
- Overlays `closeOnRouteChange` works: `useRouteClose` (a no-op stub until now, "TODO M6") calls `onClose` when the
  Next.js pathname changes while a Drawer or Modal is open. Query-string changes do not count, so no static page needs a
  Suspense boundary for it. AppShell's mobile sidebar drawer opts in, so a client-side link inside it (AppSidebar
  `renderLink`) closes the drawer instead of leaving it over the new page. Server-rendered kui-ejs has no counterpart:
  its links reload the page.
- `DataTable`: row selection in every mode (`selectable`, `rowId`, `selectedRowIds`, `defaultSelectedRowIds`,
  `onSelectionChange`), keyed by row id so sorting, search and paging never select the wrong row; the header checkbox
  selects the rows shown and a "{count} selected" line offers Clear selection. Expandable detail rows (`renderExpanded`)
  and `stickyHeader`, both formerly only in `AdvancedDataTable`.
- `DataTable`: a filter panel (`filterFields`) behind a Filters toolbar button with an active-count badge: select,
  multiselect, checkboxes, radio, checkbox, text, number, date, daterange, range and custom fields, applied on Apply
  (or at once with `filtersLive`), controlled through `filterValues` / `onFilterValuesChange`. Server mode sends the set
  values to `fetchPage` as `filterValues` (JSON-safe); the other modes match rows. The field list can change at runtime.
- `ComboBox`: `messages` overrides its built-in English strings (`DEFAULT_COMBOBOX_MESSAGES`: placeholder, no results,
  the clear button's name `Clear selection`, `Loading more…`, and `loading`, a new screen-reader status while the
  skeleton rows of an async search show). The `placeholder` and `noResultsText` props still win.
- `Select` and `MultiSelect`: `messages` overrides the built-in English strings (`DEFAULT_SELECT_MESSAGES`:
  no results, search, placeholder, required; `DEFAULT_MULTI_SELECT_MESSAGES`: no results, search, `Remove {label}`,
  loading more) so a host can translate them. The search boxes take their text as an accessible name too.
- `RadioGroup`: an option can be disabled on its own (`disabled`), with an optional `disabledReason` shown under it
  and wired through `aria-describedby` (as `hint` now is).
- `Modal`: `size` takes `xl` (36rem) and `full` (the viewport width less the 1rem gutter, height following the
  content; `fullscreen` still fills the viewport).
- `EntityAliases`: the kit's messages carry the ComboBox, Select and MultiSelect texts (`comboBox`, `select`,
  `multiSelect`) and pass them to every one it draws, so a host translates the whole editor in one place.
- `EntityAliases` (`modules/app/EntityAliases/`, next-boilerplate dashboard phase 36.4): ThingsBoard-style entity aliases for
  dashboards. `EntityAliasesDialog` (the board's alias list; a used alias cannot be removed), `EntityAliasDialog` (one alias,
  key derived from the name, debounced preview, "no entity matched" blocks the save), `EntityFilterForm` (single entity,
  entity list, name prefix, entity type, the page's entity, entity subtype, relations query, entity search query),
  `entityFilterText`, `AliasEntitySelect` (toolbar entity select), `EntityAliasPicker` (a widget slot's alias picker),
  `validateAlias` / `slugKey` mirroring the server caps. All data comes through the host's `EntityAliasesAccess`.
- `EntityAliases` key filters (next-boilerplate dashboard phase 36.7, ThingsBoard's dashboard filters): `BoardFiltersDialog`
  (the board's filters; a used filter cannot be removed), `BoardFilterDialog` (one filter, key derived from the name, key
  filters joined by and / or, text preview), `KeyFilterEditor` (entity field / attribute / latest telemetry, key names
  suggested through the new `EntityAliasesAccess.entityKeys`, attribute scope, value type, and / or, up to 4 conditions
  with the operations of the value type, a dashboard parameter as a value), `boardFilterText`, `validateBoardFilter` /
  `validateBoardFilters` / `validateKeyFilter` mirroring the caps, `normalizeBoardFilter`; `EntityAliasPicker` gains a
  filter select (`filters`, `filterValue`, `onFilterChange`). `slugKey` takes an optional fallback base.
- `TypedConfirmDialog` (`modules/ui/`): a confirmation unlocked only by typing an exact phrase (a serial, a command word).
- IoT RPC console (docs/concepts/iot-platform phase 04): `RpcStatusBadge`, `RpcSendPanel`, `RpcRequestList`, `RpcRequestDetail`,
  `RpcConsoleView`, the adapter's `rpc` methods and the `iotTopics.rpc` live topic; the IoT demo's Commands tab and `/theme/iot/rpc`.
- `KeyedTable` (`modules/ui/`): a rows-in, events-out table for live data: stable row keys, keyboard row focus (Arrow keys,
  Home / End, Enter / Space), per-row state (`new` highlighted, `leaving` fading), optional selection, loading / error (retry) /
  empty states and columns that hide below a breakpoint.
- `TabGroup`: `onTabChange(tabId)`, called when the user activates another tab (to keep it in the URL).
- IoT platform screens (docs/concepts/iot-platform phases 00, 01, 03, 07): the adapter contract (`IotAdapter`,
  `IotAdapterProvider`, `IotLive`, `useLiveOrPoll`, `IOT_MESSAGES`), the alarm components (`AlarmSeverityBadge`,
  `AlarmStatusPill`, `AlarmDetailHeader` with async actions and notes, `AlarmEventTimeline` with a note box, `AlarmTable`,
  `AlarmListView`, `AlarmDetailView`, `AlarmBellMenu`) and the device components (`DeviceOnlineDot`, `DeviceConnectionBadge`,
  `DeviceDetailHeader`, `DeviceCredentialPanel` with `IssuedSecretNotice`, `DeviceAttributeTable`, `DesiredReportedBadge`,
  `DeviceConnectionTimeline`, `DeviceTable`, `DeviceListView`, `DeviceDetailView`, `NewDeviceDrawer`); `DeviceStatusBadge` gained
  `QUARANTINED` (OD-1). The IoT demo runs them on an in-memory adapter and live source.
- Page navigation building blocks (next-boilerplate phase 07-dashboard 29, the board title's page menu and
  drill-down path), all optional so current menus and trails render as before:
  - `DropdownMenu`: `{ type: 'heading', label }` entries (`DropdownHeading`, a muted uppercase label that is
    dropped when no visible entry follows it); `groupLabels` gives grouped items a heading per labelled group in
    place of its separator (`arrangeMenuItems(items, { groupLabels })`); items take `selected`
    (`aria-current="true"`, tinted, focused on open) and `trailing` (a badge or chip at the far end); `search`
    (`{ placeholder, emptyText, ariaLabel?, minItems? = 8 }`) puts a filter box over a long menu, focused on open,
    Enter picks the first enabled match and the query clears on close; `footer`, `menuClassName` and controlled
    `open` / `onOpenChange`. ArrowUp / ArrowDown (wrapping), Home and End move between enabled items. With a
    search box or a footer the entries sit in their own `role="menu"` list inside the panel (with a search box
    that list scrolls past `max-h-96`, so the box and the footer stay in view).
  - `Breadcrumb`: items take `icon`, `chip` (pill) and `tone` (status dot: success, warning, error, info,
    neutral); `leading` renders a node (the page-menu button) as the first crumb, never collapsed by `maxItems`;
    `renderLink` gets the crumb's content as a third argument.
  kui-ejs and KUInative have `DropdownMenu` and `Breadcrumb` counterparts without these props; they follow when
  a host there needs the page menu.
- Documentation building blocks for `@kuraykaraaslan/docs`: `Callout` (note / tip / info / warning / danger
  admonition, a labelled `<aside>` with rich children — not a live region, unlike `AlertBanner`),
  `TableOfContents` ("On this page" heading nav filtered by depth, scroll-spy through the new
  `libs/hooks/useScrollSpy` or a controlled `activeId`) and `DocPager` (previous / next page cards with a
  `renderLink` slot for a router Link). Showcase entries under Organisms. kui-ejs and KUInative have no
  docs layout components, so there is no parity change.
- WidgetKit layout thumbnails (next-boilerplate phase 07-dashboard 21, the open "layout thumbnails" item):
  `renderWidgetPreview(id)` and `WIDGET_PREVIEW_IDS` in `previews.tsx` draw every `preview` id the builtin
  and core templates name (stat, sparkline, attributes, gauge, progress, state, feed, button, switch,
  slider, setpoint, line shape, pie, links, markdown and card style variants) as a 48 x 32 inline SVG in
  `currentColor` and theme tokens, so it follows the picked state and the dark theme. SchemaForm takes
  `renderOptionPreview?: (id: string) => ReactNode` (also through `OptionPreviewProvider` /
  `useOptionPreview`, `OptionPreviewRenderer`) and a `display: 'cards'` select draws each option's
  thumbnail above its label; without it the cards stay labels only. `WidgetKitHost.renderPreview` lets a
  host draw its own ids or redraw a builtin one; the settings editor falls back to the kit's drawing.
  A segmented or cards choice group now has one tab stop and moves the pick with the arrow keys, Home
  and End (the WAI-ARIA radio pattern), and carries `aria-invalid` / `aria-describedby`. kui-ejs and
  KUInative have no settings engine, so there is no parity change.
- SchemaForm `FieldSchema.searchKey` and `lookupKey` for `remote-select` (next-boilerplate phase 07-dashboard
  22.2, built there as 17.1a): `searchKey` names the query parameter that carries the search text, so the
  host's picker asks for a page per keystroke instead of loading the whole list; `lookupKey` names the
  parameter that resolves one stored value to its row, so a reloaded or deep-linked value shows its label
  and a vanished one reads as not found. Descriptor only: kui-react still ships no remote-select renderer
  (the host plugs one in through `fieldOverrides`), because next-boilerplate's searchable picker is bound to
  its tenant API. kui-ejs and KUInative have no SchemaForm.
- WidgetBoard on 12 or 24 columns (next-boilerplate phase 21.10, owner-approved): `BoardDocument.board.gridCols`
  (absent = 12) sets the grid; the board settings drawer has a "Grid columns" field (`board.gridCols`,
  `gridColsOption`, `gridColsHint` messages) and a change rescales every card. New pure `settings/grid.ts`
  (`GRID_COL_OPTIONS`, `DEFAULT_GRID_COLS`, `MAX_GRID_COLS`, `normalizeGridCols`, `scaleWidth`, `fitRect`,
  `scaleLayout`, `resolveOverlaps`, `GridCols`, `GridRect`), the same rules as next-boilerplate's `grid-cols.ts`.
  `exportBoard` writes `version: 2` only for a 24-column board; `importBoard` accepts versions up to 2
  (`BOARD_DOCUMENT_VERSION` is now 2) and clamps geometry to the board's own columns. `GRID_COLUMNS` stays 12
  (the default). The IoT theme dashboard keeps the column count in its saved board.
- Breadcrumb `renderLink?: (item: BreadcrumbItem & { href: string }, className: string) => React.ReactNode`
  renders each linked item itself (a router `Link` for client-side navigation) and gets the link's classes;
  the plain anchor stays the default, so the markup is unchanged. `ariaLabel` (default `'Breadcrumb'`) names
  the nav landmark. The signature is next-boilerplate's (phase 07-dashboard 22.1), which can re-vendor the
  component without touching its callers. kui-ejs takes `ariaLabel` and per-item `attrs` instead of a
  render function (a host script takes the click); KUInative already has per-item `onPress`.
- Label props for texts the primitives drew in English only: `tooltipTotalLabel` on BarChart, LineChart and
  AreaChart (default `'Total'`, the stacked tooltip's total row), `closeLabel` on Modal and Drawer (defaults
  `'Close dialog'` and `'Close drawer'`). kui-ejs takes the same locals.
- WidgetKit: `charts.total` also names the stacked tooltip's total row, `card.closeFullscreen` and
  `board.closeDrawer` the close buttons of the full-screen Modal and the board's Drawers. Settings issues carry
  an optional `code` and `params` (`IssueCode`, `IssueParams`) next to the English `message`; the new `issues`
  message group words each code and `WidgetSettingsEditor` shows an issue through `issueText` (exported) with
  the field's label as shown.
- WidgetKit texts in the host's language (next-boilerplate owner decision 2026-10-17 #6):
  - `WidgetKitHost.messages`: every text the kit draws itself, by group (`card`, `board`, `editor`, `form`,
    `controls`, `table`, `feed`, `map`, `viewer`, `charts`, `content`, `stat`, `common`); the rest stays English.
    New exports: `DEFAULT_WIDGET_KIT_MESSAGES`, `mergeKitMessages`, `useKitMessages`, the group types and
    `WidgetKitMessagesInput`. `TableMessages` and `FeedMessages` now live in `messages.ts` (the views re-export them).
  - `WidgetKitHost.templateText` and `kindText`, with the pure `localizeTemplate` and `localizeKind`: template
    labels, descriptions, placeholders, options (by value), groups and repeater fields, and widget-type
    labels, descriptions, categories and slots, keyed by template id and type.
  - SchemaForm: a `messages` prop (`SchemaFormMessages`, `DEFAULT_SCHEMA_FORM_MESSAGES`, `useSchemaFormMessages`);
    `emptyMessage` still wins. `validateSchemaValues` takes an optional `messages.required`.
  - `importBoard` refusals add `code` and `detail` (the English `error` is unchanged) and it takes an
    optional `defaultTitle`. Pure helpers (`controlBlockReason`, `requestControl`, `controlMessages`,
    `forText`, `spanText`, `evaluateState`, `buildMarkers`, `buildSensors`, `cellText`, `attributeRows`,
    `rowsToScatterSeries`) take optional texts that default to English.
  - `cardCellResponsive` (exported): a card's small-screen settings for its grid cell.
- WidgetKit settings templates (next-boilerplate phase 21.8, decisions 7e and 7c):
  - a `filterList` migration op (`{ op: 'filterList', key, remove?, keep? }`) that drops removed options
    from a list value; a list that ends up empty removes the key. It works inside `each`.
  - `applyOp` is exhaustive: an unknown stored op leaves the values unchanged instead of crashing `migrate`.
  - `WidgetSettingsEditor` shows a deprecated field that still holds a value read-only, under "No longer
    used", with the version that removes it and its replacement.
- RulesetEditor live activity (next-boilerplate automation 09 §9.5): `activity` (`CanvasActivity`: counters per connection
  and per block, a `window` label). A connection whose count goes up lights up for 400 ms, at most twice a second
  (`graph/activity.ts` `pulseStep`, `useEdgePulse`); hovering a connection shows its count, hovering a block its in / out /
  errors (hover card), and the node panel's Messages tab repeats them. A connection the host does not list takes the count
  of its source port (`edgeActivityOf`). Messages `edgeCount`, `edgeActivityTitle`, `nodeCounters`.
- RulesetEditor node panel Messages tab (UI-33): `nodeMessages` (`{ [nodeId]: NodeMessage[] }`), `messageBodies` (bodies
  only when the host says the viewer may see them) and `onTestMessage` ("Test with this input"). The panel takes `tabs`,
  `bare`, `tab` / `onTabChange` for a host bar.
- RulesetEditor UI-31: drag an end of the selected connection onto another port or block (handles on both ends); the same
  rules as a new connection (`rewireEdge` in `graph/edit.ts`), one undo step, the id kept. `useEdgeRewire`; output ports
  carry `data-out-node` / `data-out-port`.
- RulesetEditor single-script test (next-boilerplate 06 §6.7): `onScriptTest(request) => Promise<ScriptTestResult>` and
  `scriptTestSample(nodeId)`. A block with an `automation-script` code param gets "Test the script": code, message type,
  originator, payload, metadata, optional context; outputs per port, log, status, context writes, CPU time; an error with
  line and column is marked in the code. Save writes the code back into the block (one undo step).
- RulesetEditor code fields: completion and hover from `SCRIPT_API_ITEMS` (`scriptSuggestions`, `scriptHover`), markers
  from `lintScript` (reads the text, never runs it: brackets, open strings / templates / comments / regular expressions,
  names the sandbox lacks, over 8 KiB), Format through `tidyScript`, and the CodeEditor toolbar. `messages.codeEditor`.
- InsightPanel (debug comparison items 4 and 6): `deployProblems` ("Problems that stop a deploy" first in Errors, counted,
  with block links); `slots` for Block, Help, Trace and Runs in the router's order; `extraTabs`; `header`; controlled
  `tab` / `onTabChange`. RulesetEditor `sideBar` (`RulesetSideBar`) renders it as the editor's one side bar with the node
  panel as Block and Help and the editor's validation errors in Errors.
- CodeEditor M2 (textarea engine): Tab / Shift+Tab indent (Esc then Tab leaves), Ctrl/Cmd+/ comment toggle, auto-indent
  on Enter, bracket and quote pairs, the toolbar (`showToolbar`: language, find, format, copy, full screen), find / replace
  (Ctrl/Cmd+F), `format` and `formatOnSave`, `tabSize`. Edits go through `insertText` so Ctrl+Z undoes them. Multi-cursor
  and bracket-match highlight are not in the textarea engine.
- CodeEditor M3: `markers` (gutter dot, tinted line, a list under the field that jumps to the spot, `aria-invalid`),
  `getSuggestions` (a listbox on typing or Ctrl+Space, filtered by the typed name, `prefix` in the context),
  `getHover` (the name under the pointer). `messages` for every word; `editing.ts` holds the pure text operations.

- RulesetEditor version compare: `graph/diff.ts` `diffFlows(a, b)`, the router's `flowlib.js` `diff` ported (per node
  added, removed, changed with field paths and short from/to texts, moved apart; connections and groups by key; flow
  meta), with `edgeKey`, `stableJson`, `shortText`; it imports nothing, so a server can copy it. `graph/diff-view.ts`:
  `diffGraphs`, `diffTints`, `edgeTintOf`, `graphDiffItem` and `diffView` (one graph with the removed blocks and
  connections added back, plus the tints). `RulesetEditor` / `FlowWorkspace` `diffTint` outlines added (green),
  changed (amber) and removed (dashed red) blocks with a badge and colours added and removed connections; messages
  `diffAdded`, `diffChanged`, `diffRemoved`. Showcase variant "Version compare". Asked by next-boilerplate (automation
  07 §7.8, 09 §9.4), which drew the change list only.
- RulesetEditor `catalog/fields.ts`: `fromBlocksField(key, spec, params?)`, `fromBlocksFields(params)` and
  `toParamSpec(field)` map a `blocks.d` param onto SchemaForm's `FieldSchema` and back (docs/phases/09 §9.10, OD-16),
  lossless round trip; `when` → `showIf` with `isVisible`'s loose matches and default fallback spelled out
  (`whenToShowIf`), and `isBlocksFieldVisible` for a `{ not }` condition, which FieldSchema cannot express. The field
  adds `secret`, `unit`, `pattern` and `override` (the types a host renders through `fieldOverrides`).
- RulesetEditor `format/roltek.ts` config nodes: `chainsToRoltek(chains, { configs })` and `buildRoltekExport` write the
  configs a host passes with every secret as a `{ "$secret": true }` marker (listed in `omitted`); `roltekConfigs(file,
  catalog?)` reads them back with secrets `null` (`secretsToEnter`) and skips bad ids, duplicates and unknown types;
  `parseImport` returns them as the roltek preview's `configs`. `roltekToChains` takes `{ noteConfigs: false }` to
  leave out its "config node(s) in the file not imported" note. `RoltekFile.configs` is typed `RoltekConfig[]`.

- RulesetEditor canvas: optional theme tokens `--canvas-bg` (background, default `--surface-base`) and `--canvas-dot`
  (grid dots, default `--border`), as next-boilerplate's vendored copy had by hand.
- `ParamForm` (RulesetEditor): `suggest({ key, spec, values, row? })` gives a text field its suggestions per field and per
  row of a `rules` field (`row` is `{ param, index, values }`), as strings or `{ value, label }`; a list replaces the
  spec's `suggest`, an empty list turns it off. A field's datalist now sits with the field, so a rules row field with its
  own `suggest` gets one too (it pointed at a list that was never rendered). Types `ParamSuggest`, `ParamSuggestField`,
  `ParamSuggestion` are exported.
- Extension surfaces (next-boilerplate phase 37, UI contributions and new extension surfaces):
  - `ContributionBoundary`: an exported error boundary for one contribution, with `fallback` (a node or
    `({ error, reset }) => node`, nothing by default), `onError(error, info)` and `resetKeys`. It replaces
    WidgetKit's private `ViewerBoundary` (same behaviour).
  - `UnavailableContribution`: the placeholder admins and editors see where a contribution cannot be shown.
    Reasons `disabled`, `unentitled`, `blocked`, `retired`, `banned`, `quarantined`, `failed`, `missing`,
    `no-access` (default icon, tone and English text each, exported as `UNAVAILABLE_REASONS`); sizes `inline`,
    `card`, `tab`, `node`; optional `title`, `label`, `detail`, `action` (label + `onClick` / `href`).
  - `WidgetCard`: state `unavailable` with an `unavailable` prop (reason, texts, action); the card keeps its
    title and drops its data buttons, stale badge and "Updated" footer.
  - `TabGroup`: `isolate` (group or per tab) wraps each panel in `ContributionBoundary` + `Suspense`, with
    `renderError`, `loadingFallback`, `onTabError`, `retryLabel`; tabs take `order` and a per-tab `lazy`.
  - `DropdownMenu` items: `id`, `href`, `order`, `group`, `hidden`, `disabledReason`; `portal` renders the open
    menu in `document.body`; helpers `arrangeMenuItems` and `mergeMenuItems`.
  - `UserMenu`: `extraItems` (and `items` + `mergeItems`) merge contributed items with Profile / Settings /
    Sign out, placed by group and order; `profileHref` / `settingsHref` / `signOutHref`, `onProfile` /
    `onSettings` / `onSignOut` and `labels` for the built-in items.
  - `AppTopBar`: `start` and `end` regions taking a node or ordered `{ id, node, order, hidden }` items.
  - `AppSidebar`: `header` slot above the nav groups (node or `({ collapsed }) => node`, as in
    next-boilerplate's fork); item `badge` takes any node besides a count (`AppDrawer` renders it too).
  - `DataTable`: `rowActions` (descriptors with `id`, `label`, `icon`, `onClick` / `href`, `hidden`,
    `disabled`, `disabledReason`, `destructive`, `group`, `order`; per-row fields may be functions of the row)
    in a trailing menu column, and `rowActionsLabel`; exported `DataTableRowAction`, `resolveRowActions`.
  - `CommandPalette`: commands take `group`, `order`, `hidden`; `registerCommands` (batch) and
    `commandGroupOf`; `CommandPalette`, the registry hooks and `DEMO_COMMANDS` are exported from the app barrel.
  - `libs/utils/orderItems`: `sortByOrder` / `groupByOrder`, the CSS-`order`-like ordering every surface uses.

- From next-boilerplate's `UserMenu` fork, which now uses this one (kui-ejs's `UserMenu` takes the same):
  - `UserMenu` `portal` renders the open menu in `document.body` (fixed under the trigger), so a sticky or
    clipping top bar cannot cut it off; `className` goes to the root.
  - `UserMenu` `user` takes a `SafeUser` or just what the menu shows (`UserMenuUser`: `email`, optional
    `userRole`, optional `userProfile` with `name` / `profilePicture`). Without a role the trigger shows the
    name alone, as kui-ejs already did.
  - The `UserMenu` chevron turns over while the menu is open (`group-aria-expanded:rotate-180` on the trigger
    `DropdownMenu` marks expanded).

- `RulesetEditor` / `FlowWorkspace`: `paramEditors`, the host's own param editor per block type, shown in the node
  panel in place of the generated form (`ParamEditorProps`: `params`, `onChange`, `disabled`, `node`, `decl`, `choices`).
- `WidgetKit` `PlacementCard`: `exportData`, an async source for the CSV export, so a host can
  write every page of a server-paged table's current filter instead of the page on screen.
- `Chart`: `GaugeChart` (half-donut, threshold bands, `role="meter"`), `HeatmapChart` (matrix), a
  continuous time axis with viewer-local drag-to-zoom on `LineChart` / `AreaChart`
  (`xAxis="time"`, alias `xScale`), and `stacked` on `BarChart` / `AreaChart` (phase 9 §9.1, §9.3, §9.4).
- `MapCanvas` (card-less map, `tiles` prop) and `tiles` / `loadingLabel` on `MapView`; the loading
  label is now English ("Loading map…").
- `TimeWindowPicker` (relative presets, absolute UTC range, interval, aggregation).
- Async controls (phase 9 §9.16): `useAsyncControl`, `ControlTile`, `ControlButton`, `ControlSwitch`,
  `ControlSlider`, `ControlSetpoint`; `Toggle` gains `pending` / `mismatch` / `describedBy`;
  `RangeSlider` (single) gains `onCommit` / `pending` / `commitIdleMs`.

### Changed

- `Button` `secondary` is neutral (`bg-surface-overlay text-text-primary hover:bg-border-strong`): the quiet alternative
  beside a primary (Cancel, Back) no longer takes the second brand colour. The new `accent` variant carries it
  (`bg-accent text-accent-fg hover:bg-accent-hover`) for an alternative that is meant to be coloured; `PageHeader` actions
  take the same two. New tokens `--accent`, `--accent-hover`, `--accent-fg` (light and dark, in `styles/index.css`; a host maps
  them to `--color-accent*` as it maps the others). Their defaults pass WCAG AA: light `#7c3aed` / hover `#6d28d9` with
  white text, dark `#a78bfa` / hover `#c4b5fd` with `#0f172a` text (the old secondary pairs read 4.2:1 light and 2.7:1
  dark, 1.85:1 on the dark hover). The theme pages' coloured calls to action use `accent`. kui-ejs and KUInative follow.
- `useFocusTrap` (Modal, Drawer, Popover): Tab with focus in another dialog layered over the overlay (one not on the trap's
  stack, such as a host's confirm portaled to `<body>`) is left to that dialog; Shift+Tab pulled focus back into the
  overlay before. Escape an inner control already handled (`defaultPrevented`) still leaves the overlay open.
- `BoardFilterDialog`: closing with an unsaved edit (X, Escape, Cancel) asks first, Discard or Keep editing, as
  `BoardFiltersDialog` does (new message `discardFilterBody`).
- `Select`: the native (non-searchable, icon-free) mode draws the chevron the custom Select and `MultiSelect` show
  (`faChevronDown`, `w-3 h-3 text-text-disabled`, `right-3`; the select is `pr-8`). `appearance-none` had removed the
  browser arrow, so a plain Select did not read as a dropdown.
- **Licence: Apache-2.0** in place of 0BSD (`LICENSE`), with a `NOTICE` file a copy keeps (section 4(d)); the License
  grants no right to the KUI names (section 6). `package.json` says `Apache-2.0` and publishes `NOTICE`; the showcase home
  panel says "Licensed under Apache-2.0", as kui-ejs and KUInative do.
- `ComboBox`: opening it lists every option until the user types. The selected label stays in the input, selected
  on click so the first keystroke replaces it; `onSearch` is called with an empty query on open.
- `TabGroup`: a row of tabs wider than its box (many tabs, a phone) scrolls sideways inside the tab list
  (`overflow-x-auto`, tabs `shrink-0 whitespace-nowrap`) instead of widening the page; the focus ring is drawn inset
  so the scroll box does not clip it. Keyboard and ARIA are unchanged. kui-ejs's `TabGroup` partial has the same
  change; KUInative's already scrolls (a horizontal `ScrollView`).
- `CommandPalette` no longer lists sample commands by default: pass `demo` (or your own `items`). Keyboard
  navigation now follows the on-screen group order. `CommandItem.category` is optional (alias of `group`).
- `AppSidebarNavItem.badge` widened from `number` to `number | ReactNode`; code that reads it as a number
  needs a `typeof` check.
- `package.json` gained `license`, `repository`, `homepage`, `bugs`, `engines`, `keywords`. The
  package has been resolvable from `package.json` alone since 1.0.0 but shipped without this
  metadata until now.
- `@types/leaflet` moved from `dependencies` to `devDependencies` — it was only ever needed to
  build this repo's own `MapView`/`VenueLeafletMap` components, not by consumers of the
  published package.

### Fixed

- Icons: size classes on `FontAwesomeIcon` (`w-3 h-3`, `w-4 h-4`, …) now take effect. Font Awesome injected its CSS
  unlayered at runtime, which beat Tailwind's layered utilities, so every icon rendered as a 1.25em × 1em box. Its
  stylesheet is now imported into the `base` layer and `config.autoAddCss` is off (`libs/config/fontawesome.ts`, a
  `sideEffects` entry). Icons render at their declared size across the library.
- Native checkboxes and radios follow the theme: `accent-color: var(--primary)`, `color-scheme` light / dark per theme,
  and an error outline plus error accent on `aria-invalid`. Their `border-*` / `text-*` classes never reached the
  native control, so they showed Chrome's light default in both themes and never turned red.
- Escape in an open `ComboBox`, `Select` or `MultiSelect` list inside a `Modal` (or `Drawer` / `Popover`) closed the
  overlay too. The open list now handles Escape (closes, `preventDefault` + `stopPropagation`, focus back on the
  trigger) and `useFocusTrap` / `useDismiss` ignore an Escape whose `defaultPrevented` is set. With the list closed,
  Escape still closes the overlay.
- `Modal`: the title and description ids are per instance (`useId`), so a dialog opened from a dialog is labelled
  by its own title instead of the first one.
- WidgetBoard: a cell's grid place applies from lg up only, so cards stack below lg instead of opening
  implicit columns, and a card's hide-on-small-screens and small-screen order act on its cell.
- StateView: a state's `unknownLabel` still at the template default ("Unknown") follows the host's text.
- WidgetKit settings migrations: `mapValue`, `rename` and `materializeDefault` look keys up as own keys only. A
  stored value such as `toString` or `__proto__` matched an inherited `Object.prototype` member through `in`, so
  `mapValue` replaced it with a function (or `Object.prototype`) instead of leaving it or applying `else`.
- RulesetEditor `tidyScript` (Format) no longer changes a string's value: a line that starts inside a template string is
  left exactly as it is and a line that ends inside one keeps its trailing spaces; `${}` nesting (a template inside an
  expression, an expression spanning lines) and regular expression literals (a backtick or quote inside `/.../`) are
  tracked, so they no longer flip the template state.
- RulesetEditor live flashes no longer re-render the whole canvas: `useEdgePulse` lights the connections that went up
  together as one batch (one state change and one timer per batch, one shared timer for the rises that wait their gap),
  `RuleEdge` and `RuleNode` are memoised (the canvas hands them stable callbacks; a connection's counter is compared by
  its numbers), and validation is keyed on the graph's lists, so it is not redone (with new issue arrays) on every render.
- `SchemaForm` repeater items: the Up / Down / Remove buttons sat inside the item's `<summary>`, an interactive
  element, which axe reports as a serious `nested-interactive` violation (the widget-kit showcase failed its a11y
  check). They now sit over the summary's right end instead of inside it; the header looks and works the same.
- `AppSidebar` (from next-boilerplate's fork): an active `href` item is marked `aria-current="page"`, as a
  button item already was; collapsed, the nav drops the scrollbar gutter that `.sidebar-scrollbar-hover`
  reserves, so the icon-only items sit centered. kui-ejs's AppSidebar meant to mark both but wrote the
  attribute through escaped output (`aria-current=&#34;page&#34;`); it is fixed there in the same change set,
  and its nav reserves no gutter.
- `usePresence` (Modal, Drawer, Popover): an overlay opened within 250 ms of mounting could stay unmounted
  while open, because the mount-time close timer's update landed after the open click's. The timer now only
  runs while closing and only moves `closing` on. (This was the flaky `CommandPalette` focus test.)
- Four components (`FileInput`, `EmptyErrorState`, `FileUploadSection`, `LoadingState`) were
  missing the `'use client'` directive required by every file in `modules/ui`/`modules/app`.

### Docs

- `AGENTS.md`: filled in the domain-vertical table (`nft`, `reviews` were shipped but
  undocumented), the theme table (`nft`, `promozone`), and the ui atoms/molecules tables (17
  components that existed but had no row).
- `docs/reference/feature-roadmap.md`: six rows (#11, #13, #14, #16, #17, #20) were marked "not implemented" for
  features that had already shipped (`useA11yCheck`, `announce()`, `useBreakpoint`,
  `modules/ui/index.ts`, `lazy.tsx`, `isBrowser`); coverage and the summary table are
  recomputed.
- Fixed stale absolute-path references (`/home/kuray/00_Config_and_AI_Rules`,
  `/home/kuray/02_EJS_Components`, a dead GitHub URL) across `AGENTS.md` and module READMEs.
- Added `docs/adr/` with the first four architecture decision records, and
  `docs/phases/` with a phased improvement plan (see `docs/phases/README.md`).
- Added standard repo hygiene files: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/CODEOWNERS`,
  issue templates, a PR template.

## [1.0.1] — 2026-06-11

### Added

- README theme-demo screenshot gallery, for the npm registry page.

## [1.0.0] — 2026-06-07

### Added

- **Library build.** `tsup` builds `index.ts`, `modules/ui/index.ts`, `modules/app/index.ts`,
  and `modules/domains/common/index.ts` to ESM + CJS with type declarations, published as
  `@kuraykaraaslan/kui-react`. `npm run build:lib`; `prepare` runs it on install.

- **`LanguageSwitcher` and `I18nTypes` no longer guess a country from a language code.** The
  old heuristic was `lang.toUpperCase()`, which is correct only where a language code happens
  to coincide with the country code of a place that speaks it — a mostly-European accident.
  Elsewhere it either produced a non-country (`ja`→`JA`, `ko`→`KO`, `zh`→`ZH`; the emoji is two
  meaningless letters and `flagcdn.com/w40/ja.png` is a 404) or, worse, a real but wrong
  country: `ky` (Kyrgyz) → `KY`, the **Cayman Islands**, when Kyrgyzstan is `KG`. That second
  class is silent — nothing throws, nothing 404s, and the wrong flag looks deliberate.
  `langToRegion()` is now an explicit map and returns `null` for languages it does not know, so
  an unmapped language renders with **no** flag rather than somebody else's.
- **`getOgLocale` no longer emits a wrong territory.** It returns the bare language (`ky`)
  instead of a fabricated pair (`ky_KY`) when the region is unknown.
- **`getLangFlagUrl` is now `string | null`** instead of returning a URL that either 404s or
  loads the wrong country's flag. **Breaking** for any caller that assumed a string.
- **`LanguageSwitcher` no longer keeps its own second copy of the mapping.** It had a private
  five-entry `langToCountry` (`en, tr, de, fr, ar`) and fell through to the heuristic for
  everything else; it now reads the one map in `I18nTypes`. The `icon: … as any` cast went with
  it — `DropdownItem.icon` is `React.ReactNode`, so the cast was never needed and its comment
  ("DropdownMenu string bekliyor") was wrong.

## 2026-05-17 — 10 new theme pages + 27 new domain components

### Added — Theme routes

- **10 new routes across 5 themes:**
  - Media: `studio`, `playlists/[slug]`
  - Forum: `users/[username]`, `topics/new`
  - Food: `orders/[orderId]`, `cuisines/[slug]`
  - IoT: `devices/[slug]/metrics`, `alerts/[id]`
  - Fintech: `portfolio`, `cards`

### Added — Domain components (27 total, all with ≥2 showcase variants)

- **Media (5):** `ChannelStatsCard`, `VideoPerformanceRow`, `WatchTimeChart`, `PlaylistHeaderCard`, `PlaylistVideoRow`
- **Forum (5):** `ForumUserCard`, `ReputationBar`, `BadgeShelf`, `UserActivityRow`, `PostComposer`
- **Food (6):** `OrderTrackingTimeline`, `CourierCard`, `EtaCountdownCard`, `CuisineHeroBanner`, `CuisineTagChip`, `FeaturedDishCard`
- **IoT (5):** `MetricSparklineCard`, `TelemetryTimeSeriesChart`, `LogStreamRow`, `AlertDetailHeader`, `AlertEventTimeline`
- **Fintech (6):** `PortfolioHoldingRow`, `AssetAllocationCard`, `PerformanceSparkline`, `PaymentCardTile`, `CardLimitMeter`, `CardActionMenu`

### Added — AI-discoverability layer

- **Machine-readable component registry** at `modules/registry/registry.ts`, exposed via:
  - `GET /api/registry` — full registry JSON (every component, theme, design token, convention).
  - `GET /api/registry?index=1` — index-only variant without source code (~5x smaller).
  - `GET /llms-full.txt` — long-form markdown dump of the entire catalog.
- **`public/llms.txt`** — concise [llms.txt convention](https://llmstxt.org/) overview pointing AI agents at the registry and conventions.
- **AGENTS.md upgrade** — top-of-file "AI agent quick reference" section with the registry URLs and search recipe; fixed outdated domain/theme tables (now reflects all 16 verticals + 16 themes).
- **Extended `ShowcaseComponent` schema** with optional AI-facing fields (`whenToUse`, `whenNotToUse`, `composes`, `relatedTo`, `a11y`, `designTokens`, `dependencies`) — backward compatible.

### Added — Modularity (barrel exports)

- `index.ts` barrel exports for all 16 domain verticals: `import { ProductCard } from '@/modules/domains/commerce'`.
- Top-level domain barrel at `modules/domains/index.ts` with namespaced re-exports: `import { Commerce, Blog } from '@/modules/domains'`.
- `modules/app/index.ts` barrel covering all 25 app patterns.

### Added — Showcase coverage

- `BrandLogo` showcase entry in atoms.
- `AppBreadcrumbs`, `AppFooter`, `ThemeSwitcher` showcase entries in app patterns (new `app-extras.showcase.tsx` builder).

### Fixed — Convention hygiene

- `modules/ui/BrandLogo.tsx` now starts with `'use client';` per AGENTS.md rule.
- Removed unnecessary `'use client'` from `app/theme/ai/page.tsx` and `app/theme/social/page.tsx` (server-default; layout already owns client state). Travel page kept as client (uses `useState`).
- Resolved sidebar abbreviation collisions: `Sl`, `Cb`, `Sc`/`SC` are now globally unique. `Slider` re-categorised from `Molecule` to `Organism`.

### Removed

- Empty placeholder theme directories: `app/theme/builder/`, `app/theme/gis/`, `app/theme/festival/`.

## [0.1.0] — 2025-09 onwards

Initial public version. See `git log` for history prior to this changelog.
