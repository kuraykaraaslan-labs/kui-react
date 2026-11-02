# Phase 12 — Device settings (NB `iot_device_settings` phase 05)

Written 2026-11-02, English. NB plan: `$NEXT_BOILERPLATE_ROOT/docs/concepts/iot-device-settings/phases/05-ui.md` (decisions D60, D64, D103).

## What NB needs

Every setting of every Roltek model managed from the cloud: the device describes itself with a settings manifest (one JSON Schema per
section with `x-roltek` annotations: class, `remote`, `sensitive`, `connectivity`, `confirmS`, `restarts`), the platform keeps a desired and a
reported document per section, and baselines and jobs change many devices at once. The UI is generic from the manifest, with purpose-built
help for the firewall, Wi-Fi and LTE.

## Built (2026-11-02)

`modules/domains/iot/settings/` and `types/settings.ts`:

| Piece | What it does |
|---|---|
| `DeviceSettingsView` | The device page's Settings tab. Sections from the manifest (a new section shows with no code), state badges, unverified / read-only notices, the reason a device takes no settings, a History drawer, reads again while a change is on its way. |
| `SectionEditorDrawer` | One section in a drawer: notices (on its way, being tried, undone, refused, changed on the device with the differences and "Send ours again" / "Keep the device's", a firmware update to check with what it could not carry over), the editor, the impact of saving, client check → server dry run → the one ConfirmDialog (section name typed when the change can cut the device off), server field paths under the fields, History in place of the editor. |
| `SettingsForm` | The generic editor from the schema: SchemaForm for plain fields, `SecretField` (write-only), read-only values only the device can change, "Automatic or a number", lists as a DataTable (sort, filters, search) with a drawer per row and Remove through the ConfirmDialog, `oneOf` kinds, locked fields for a class the viewer may not change, baseline mode (Include per setting, no secrets). |
| `settings-presets` | Firewall: zone pickers, ordered rules and port forwards (Move up / down), the internet warning (a rule that accepts from a WAN zone, any port forward from the WAN) and the `exposesWan` flag kept in step. Wi-Fi: columns, the password only when the security needs one. LTE: columns, the profile in use picked from the APN profiles, bands as checkboxes. Applied only where the manifest has the property. |
| `settings-schema` | Pure: kinds, labels, defaults, the client-side check (the manifest subset, formats ipv4 / ipv6 / cidr / mac / hostname / port), secrets kept by position (a moved or copied row's secret must be typed again; "Change" with nothing typed is never sent), desired vs reported differences. |
| `SettingsStateBadge`, `SettingsDiffTable`, `SettingsHistoryTable` | State in words; differences in words; the change history (server-paged DataTable). |
| `BaselinesView`, `BaselineEditorDrawer` | Baselines: DataTable with search; the editor with the models, the sections of their newest manifests, Include per setting. |
| `JobsView`, `NewJobDrawer`, `JobDetailView` | Bulk jobs: list with status filters; a new job (baseline, devices by models / profile / picked, waves, checks, conflicts) with a dry-run plan and the confirmation (START typed for a dangerous job); a job's waves and devices, pause, resume past a failed wave (said and recorded), cancel. |

Data comes through the host's `DeviceSettingsAdapter` and `SettingsFleetAdapter` (`settings-adapter.ts`); texts are `SETTINGS_MESSAGES`
(`settingsMessagesFrom(translate)` for a host's dictionary, the manifest's titles first). Demo: `settings/demo-settings.ts` (not vendored),
the device page's Settings tab (`/theme/iot/devices/assembly-robot-gateway?tab=settings`) and `/theme/iot/device-settings` (jobs),
`/baselines`, `/job?id=`. Showcase: eight entries in `domain-iot-settings.showcase.tsx`.

## Not here

- Roltek support's failures by model and firmware (D77): the platform has no metrics for it yet.
- "Detached from template" and re-attach (D73): baselines are not assigned to devices yet (NB phase 04 open task).
