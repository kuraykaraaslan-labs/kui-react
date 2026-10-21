# modules/domains/iot

IoT platform domain — device fleet management, telemetry, rulesets, alerts, and workspace components.

## Subdirectories

```
alert/
device/
ruleset/
telemetry/
workspace/
index.ts
types.ts
```

## Rule chain editor

`ruleset/` holds the rule chain editor, its block catalog, param forms, undo, groups, flows that run each other, validation and the
import / export formats. See [ruleset/README.md](ruleset/README.md).

## Parity

NextJS-only, no EJS counterpart.

## Conventions

1. `'use client';` at top of every component file.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. Id/Status types reused from `@/modules/domains/common`.

See [/AGENTS.md](../../../AGENTS.md).
