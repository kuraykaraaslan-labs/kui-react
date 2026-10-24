# IoT 03: Alarms

**Goal:** alarms an operator can actually work: acknowledge and clear with a note, filter and bulk-handle the list, see new alarms arrive live, and follow a runbook. Today `AlertDetailHeader` renders the buttons but the demo passes no-op handlers, and the list is a static client-side table.
**Effort:** M.
**Depends on:** 00 (the minimal acknowledge/resolve wiring lands there), 01 (alarm rules live in the profile); 9.6 (presets), 9.7 (`TimeRangePicker`), 9.11, 9.12.
**Demo routes:** ~~`/theme/iot/alerts` · `/theme/iot/alerts/[id]`~~ `/theme/iot/alarms` · `/theme/iot/alarms/[id]` (OD-9; `/alerts/**` redirects for one release) · `/theme/iot/devices/[slug]?tab=alarms` · the topbar bell on every IoT page · the alarm settings block in `/theme/iot/settings` (OD-10).
**NB consumer:** `docs/new-iot-platform/iot_alarm/` (entity, state machine, rule evaluation); `docs/new-iot-platform/notification/` (what the bell links to).

## Decisions this phase applies

- D1 (README): rename **Alert → Alarm** in types and components (`AlarmSeverityBadge`, `AlarmDetailHeader`, `AlarmEventTimeline`, …) with deprecated `Alert*` re-exports for one release; ~~`/theme/iot/alerts/**` stays as the demo URL or redirects to `/alarms/**` (owner's call).~~
  > **→ DECISION OD-9 (owner, 2026-10-04):** the term is **Alarm**; the kui-react IoT `Alert*` components are renamed `Alarm*` (§3.0). The demo URL becomes `/theme/iot/alarms/**`; `/theme/iot/alerts/**` redirects to it for one release.
- D2 (README): ~~the severity set follows NB `iot_alarm` phase 0.~~ One mapping table (`alarm-severity.ts`) feeds badge tone, sort order and icon; nothing else hard-codes severities.
  > **→ DECISION OD-9 (owner, 2026-10-04):** five severities `CRITICAL` / `MAJOR` / `MINOR` / `WARNING` / `INFO` (sort order in that sequence, CRITICAL first). Proposed tones for `alarm-severity.ts` (the table is the only place to change them): CRITICAL `error` solid, MAJOR `error` subtle, MINOR `warning` solid, WARNING `warning` subtle, INFO `info`; each level also has its own icon so the five are distinguishable without colour.
- **→ DECISION OD-10 (owner, 2026-10-04):** CRITICAL alarms bypass users' notification preferences by default; a tenant setting can turn the bypass off. The UI for that setting is §3.4.
- Status set follows NB: `OPEN` → `ACKNOWLEDGED` → `RESOLVED` (plus re-open when the rule fires again, shown in the timeline).
- ~~**→ DECISION OD-29 (owner, 2026-10-04):** MVP alarms are profile threshold rules with no canvas (NB P6 confirmed); the cloud flow editor and executor come after the 8 weeks (`roltek-automation-1`).~~ Rules are edited as rule cards in 01 §1.4; this phase shows their alarms.
  > **→ DECISION OD-79 / OD-88 (owner, 2026-10-04):** supersedes OD-29 / P6. The cloud rule engine (RulesetEditor + NB `iot_automation` executor, `roltek-automation-1`) is **in the MVP** with the full cloud-runnable block set. Alarms come from two places, both shown by this phase the same way: the **"alarm evaluation" step of the tenant's default root flow** (which evaluates the profile rule cards of 01 §1.4) and **alarm blocks in any other flow** the tenant builds. There are no hard-coded automatic actions outside flows. See README §Cloud rule engine in the MVP.
- **→ DECISION OD-25 (owner, 2026-10-04):** messages carry `metadata.topic`, and a rule condition may filter on it. The `AlarmRuleCard` (01 §1.4) gets an optional "Only from topic" field (exact topic or MQTT-style `+`/`#` pattern; empty = any topic) beside key/condition; the alarm detail "Related" panel and the timeline's "opened" event show the topic that triggered the alarm when the payload carries it.
- **→ DECISION OD-34 (owner, 2026-10-04):** the topic is `metadata.topic` of NB's `{ data, metadata }` message envelope and is **not stored** with telemetry. So the rule card's "test against the last hour" (01 §1.4) cannot apply an "Only from topic" filter to history: for such a rule the test button is disabled with the hint "topic filters apply to live messages only". The alarm keeps the triggering topic in its details, so the detail/timeline display above is unaffected.
- **→ DECISION OD-40 (owner, 2026-10-04):** Roltek routers' local automation alarms move to the same five levels, so no severity mapping is needed in the UI for router-originated alarm counts.
- **→ DECISION OD-31 / OD-32 (owner, 2026-10-04):** in NB the alarm list, counts and the bell read the `iot_open_alarms` view (open alarms with device and asset context) for the default "not resolved" filter; resolved/historical queries page server-side over a bounded time range (default last 7 days). Dashboard query target p95 < 300 ms.

## 3.0 Alert → Alarm rename (OD-9)

Inventory checked on 2026-10-04 (`grep` over `modules/`, `app/theme/iot/`, `public/`). Everything below is IoT-only; the generic `modules/ui/AlertBanner.tsx` (and its showcase/registry entries) is a feedback banner, not an alarm, and is **not** renamed.

| Today (kui-react) | Becomes | Kind |
|---|---|---|
| `modules/domains/iot/alert/` (folder) | `modules/domains/iot/alarm/` | folder |
| `AlertSeverityBadge` (`alert/AlertSeverityBadge.tsx`) | `AlarmSeverityBadge` | component |
| `AlertDetailHeader` (`alert/AlertDetailHeader.tsx`) | `AlarmDetailHeader` | component |
| `AlertEventTimeline` (`alert/AlertEventTimeline.tsx`) | `AlarmEventTimeline` | component |
| `AlertEvent`, `AlertEventKind` (exported from `AlertEventTimeline.tsx`) | `AlarmEvent`, `AlarmEventKind` | types |
| `AlertSeverityEnum`, `AlertStatusEnum`, `AlertSchema` (`types.ts`) | `AlarmSeverityEnum` (five levels), `AlarmStatusEnum`, `AlarmSchema` | Zod schemas |
| `AlertSeverity`, `AlertStatus`, `Alert` (`types.ts`) | `AlarmSeverity`, `AlarmStatus`, `Alarm` | types |
| `Alert.alertId` field | `Alarm.alarmId` | field |
| `ALERTS`, `ALERT_EVENTS`, seed ids `alert-001…` (`app/theme/iot/iot.data.ts`) | `ALARMS`, `ALARM_EVENTS`, `alarm-001…` | demo seed |
| `AlertsPage`, `AlertDetailPage` (`app/theme/iot/alerts/**`) | `app/theme/iot/alarms/**` (thin pages over `AlarmListView` / `AlarmDetailView`) | demo routes |
| Showcase entry `AlertSeverityBadge` (`domain-iot.showcase.tsx`) + `showcase.menu.ts` line | `AlarmSeverityBadge` (plus the new entries below) | showcase |
| `public/components/iot-alert-severity-badge.md`, `iot-alert-detail-header.md`, `iot-alert-event-timeline.md`; `public/registry/components.json` entries | `iot-alarm-*.md` and renamed registry entries (`npm run registry:snapshot`) | registry |
| UI strings: "Alert opened", `aria-label="Alert event history"`, `` aria-label={`Alert: ${title}`} ``, sidebar label "Alerts", `modules/domains/iot/README.md` "alerts" | "Alarm opened", "Alarm event history", `Alarm: …`, "Alarms" | copy |

Tasks:

- [x] Move the three components into `modules/domains/iot/alarm/` under their `Alarm*` names; `modules/domains/iot/index.ts` exports the `Alarm*` names and keeps **deprecated aliases for one release**: `/** @deprecated use AlarmSeverityBadge; removed in the next minor */ export { AlarmSeverityBadge as AlertSeverityBadge }`, the same for `AlertDetailHeader`, `AlertEventTimeline` and the types `AlertEvent`, `AlertEventKind`.
- [x] Types: add the `Alarm*` schemas/types (in `types/alarm.ts`, phase 00 §0.1) and keep `AlertSeverityEnum`, `AlertStatusEnum`, `AlertSchema`, `AlertSeverity`, `AlertStatus`, `Alert` as `@deprecated` aliases for one release. `AlarmSeverityEnum` has the five OD-9 levels, so the alias widens the old three-level type (existing `INFO`/`WARNING`/`CRITICAL` values stay valid). ⚠️ Same guard as phase 00 §0.1: do not edit `types.ts` while the RulesetEditor session has uncommitted work there; the rule-engine `ACTION` node text "send alert" belongs to that session and is not renamed here.
- [x] `AlarmSeverityBadge` reads tone, icon and label from `alarm-severity.ts` (five levels); `MAJOR` and `MINOR` get seeded demo alarms.
- [x] Demo: rename `ALERTS`/`ALERT_EVENTS` and the seed ids; move `app/theme/iot/alerts/**` to `app/theme/iot/alarms/**`; `/theme/iot/alerts` and `/theme/iot/alerts/[id]` become redirect pages (`redirect()` from `next/navigation`) for one release; the `NAV_GROUPS` item (`id: 'alerts'`, label "Alerts", `href: '/theme/iot/alerts'`) becomes `alarms` / "Alarms" / `/theme/iot/alarms`; every internal link (`hrefs.alarm(id)`, dashboard "open alarms" block, device detail Alarms tab) points to `/alarms`.
- [x] Showcase and registry: rename the entry and docs pages listed above, add a "Renamed from `Alert*` (OD-9)" note to each, run `npm run registry:snapshot`, update the phase 2 route smoke list (`/alarms`, `/alarms/[id]`, plus the two redirects).
- [x] `CHANGELOG.md`: a "Deprecated" entry naming every alias and the release that removes it; a follow-up task in the next minor removes the aliases and the redirects.
- [x] Parity: kui-ejs and KUInative were checked on 2026-10-04 and have **no** IoT `Alert*` component (only the generic `AlertBanner`, kui-ejs `modules/domain/modem/AlertItem.ejs` and `modules/app/InlineAlert.ejs`, none IoT). Nothing is renamed or created there.
- [x] NB note: NB vendors the `Alarm*` names; its `iot_alarm` and `notification` docs already use "Alarm". The kui-viewer alarm feed (phase 28) maps the five levels onto its `warn | alarm` levels on the host side (phase 09).

## Adapter methods added

`alarms.list(query)`, `alarms.get(id)`, `alarms.events(id)`, `alarms.acknowledge(ids, note?)`, `alarms.clear(ids, note?)`, `alarms.assign(id, userId)` (Should), `alarms.comment(id, text)`, `alarms.counts(scope)`. Live topic: `alarms(scope)`.

## 3.1 Detail actions

- [x] `AlarmDetailHeader` gets real async actions: `onAcknowledge(note?)` and `onClear(note?)` return promises; buttons show a pending state, are disabled while pending and announce the result. An optional note dialog ("what did you do?") opens from a split button.
- [~] Optimistic update through `useResource.mutate` with rollback and an error toast on failure (testable with the demo failure switch).
- [x] Runbook: a `Drawer` with the runbook text from the matching alarm rule (profile, phase 01); falls back to the generic steps the demo shows today.
- [~] Timeline (`AlarmEventTimeline`) appends acknowledge/clear/comment/re-open events live; a comment box at the bottom.
- [~] "Related" panel: device, its telemetry window around the alarm start (phase 02 chart, ±30 min), the rule that raised it.
- [~] (OD-79/OD-88) "Raised by" in the "Related" panel and the timeline's "opened" event: either "Profile rule <name> (default flow, alarm evaluation)" linking to the rule card in 01 §1.4, or "Flow <name> → block <name>" linking to that node in the RulesetEditor (vendored in NB, README §Cloud rule engine in the MVP). `Alarm` gains `origin: { kind: 'profileRule', profileId, ruleId } | { kind: 'flow', flowId, nodeId, flowName, nodeName }` (NB `iot_automation` fills it); the runbook drawer falls back to the generic steps for flow-raised alarms without runbook text.
- [x] Actions respect `canAcknowledge`.

## 3.2 Alarm list

- [~] `AlarmListView` on `ServerDataTable`: severity, status, title/message, device, profile, rule, started, acknowledged, cleared, duration. (OD-79: the "rule" column shows the profile rule or "flow / block" from `origin`, and the filter bar gains an origin filter: profile rules / a chosen flow.)
- [~] `FilterBar`: status (default "not resolved"), severity, device, profile, time range (`TimeRangePicker` or `DateRangePicker` with the 9.6 presets); filters in the URL. (OD-31) Resolved/all-status views always send a time range (default last 7 days); the UI never asks for an unbounded alarm history.
- [ ] (OD-25) Rule-card topic filter in `AlarmRuleCard` (01 §1.4) and a Topic column (hidden by default) in `AlarmListView` when the alarm carries one; the demo seeds one rule limited to `sensors/hall-2/#`.
- [x] Status count chips above the table (`alarms.counts`), clickable as filters.
- [x] Bulk acknowledge / clear with one note for all selected rows.
- [x] Live: new matching alarms appear at the top with a highlight; a "N new alarms" pill when the user has scrolled or paged away instead of jumping the table.
- [x] The same view, filtered, is the device detail Alarms tab.

## 3.3 Shell integration

- [~] Sidebar badge and topbar bell from `alarms.counts` + the live topic (wired in 00, styled here): the bell opens a short dropdown of the latest open alarms with "acknowledge" inline and "view all".
- [ ] Optional sound/toast for new CRITICAL alarms, off by default, toggled in `/theme/iot/settings`.

## 3.4 Alarm notification settings (OD-10)

- [ ] `AlarmNotificationSettings` (tenant-level block, `canManageAlarmSettings`): a `Toggle` "CRITICAL alarms bypass users' notification preferences", **on by default**, with the explanation "Users receive CRITICAL alarms even if they muted alarm notifications or the channel". Turning it off asks for confirmation. Adapter: `alarms.settings.get()` / `alarms.settings.update({ criticalBypassesPreferences })`.
- [ ] Where a user's own notification preferences are shown (NB `notification` owns that screen), the kui-react preference row for alarms carries a read-only hint "CRITICAL alarms still reach you (tenant setting)" while the bypass is on. kui-react ships the hint as a prop of the row, not the screen.
- [ ] Demo: the block lives in `/theme/iot/settings`; toggling it changes the hint in the demo's preference preview.

## Showcase

Renamed and new Domain entries: `AlarmSeverityBadge` (all five severities, OD-9), `AlarmDetailHeader` (pending and error variants), `AlarmEventTimeline`, `AlarmListView`, `AlarmBellMenu`, `AlarmNotificationSettings` (bypass on/off, OD-10). The old `AlertSeverityBadge` entry is replaced, not duplicated (§3.0).

## Definition of done

- In the demo: a mock alarm arrives live, the bell and sidebar badge increase, acknowledge it from the bell with a note, see it ACKNOWLEDGED in the list and the timeline, clear it from the detail page; with failure injection on, the action rolls back and shows an error.
- Every seeded alarm has a working detail page.
- No `() => undefined` handlers remain in IoT pages.
- (OD-9) `grep -rn "Alert" modules/domains/iot app/theme/iot` finds only the `@deprecated` aliases, the redirect pages and the RulesetEditor-owned strings; the list, badge and filters show five severities; `/theme/iot/alerts/[id]` redirects to `/theme/iot/alarms/[id]`.
- (OD-10) The CRITICAL-bypass setting is on in a fresh demo session and can be turned off with confirmation.
- (OD-25) A rule limited to one topic raises an alarm only for values from that topic in the demo; the alarm detail names the topic.
- (OD-31) The default alarm list loads with one list query and one counts query; switching to "all statuses" sends a bounded time range.
- (OD-79/OD-88) The demo seeds one alarm raised by a profile rule through the default flow and one raised by an alarm block of another flow; each detail page names its origin and links to the rule card or the flow node, and the list's origin filter separates them.

## 2026-10-24 — as built

> Built on branch `feat/iot-p2-screens` (with 00 and 01), the alarm half of NB IoT P2 slice 6a (`iot-alarm/03`). **ED** = engineering
> decision under the owner's delegation (owner may veto).

**Built.** §3.0 rename: `modules/domains/iot/alarm/` (`AlarmSeverityBadge`, `AlarmDetailHeader`, `AlarmEventTimeline`) with
deprecated `Alert*` aliases in `index.ts` and `types.ts`, `alarm-severity.ts` (the one table: tone, icon, label, rank, row
border), the seed renamed (`ALARMS`, `ALARM_EVENTS`, `alarm-001…`, every severity, every alarm with a timeline, a profile-rule and a
flow origin), `/theme/iot/alarms` and `/alarms/[id]`, `/alerts/**` redirects, the showcase entries replaced (not duplicated) and the
registry regenerated, the CHANGELOG "Deprecated" entry. New: `AlarmStatusPill`, `AlarmTable` (07 body), `AlarmListView`,
`AlarmDetailView` (runbook `Drawer`, Related panel with "Raised by"), `AlarmBellMenu`. Tests: `alarm.test.tsx`, `views.test.tsx`.

**Decisions (ED).**
- **ED-K11 Tones.** OD-9 proposed solid amber for MINOR; no text token reads on solid amber in both themes, so MINOR is the subtle
  warning badge with a warning ring (MAJOR likewise with an error ring); each level keeps its own icon.
- **ED-K12 Flat header props kept.** `AlarmDetailHeader` keeps the old flat props (and `onResolve` as a deprecated name of
  `onClear`), so the `AlertDetailHeader` alias keeps working for one release.
- **ED-K13 Optimistic updates in the views** (no 9.11 `useResource.mutate`): the row or header changes at once, the ids the server
  skipped roll back with a toast; the per-id results drive "N done, M skipped".
- **ED-K14 Live list.** A new matching alarm goes to the top of the first page (highlighted 4 s); on another page or while
  searching a "N new alarms" pill brings the viewer back; a later snapshot (reconnect) re-reads the list.

**Left.** The telemetry window and the rule-card link in the Related panel (phases 01 / 02), the origin filter and the Topic
column, `TimeRangePicker` presets (OD-31's bounded range is sent as "last 7 days"), the sidebar badge, the CRITICAL sound / toast,
`AlarmNotificationSettings` (§3.4), `/theme/iot/settings`.
