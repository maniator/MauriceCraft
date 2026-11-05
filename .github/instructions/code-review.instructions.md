---
applyTo: "**"
---

# MauriceCraft code review focus

Use these checks when reviewing pull requests:

## Save compatibility (highest priority)

- Treat IndexedDB compatibility as critical: keep database name `blockcraft-worlds` unchanged.
- Do not accept block ID renumbering, chunk key changes, or schema resets without an explicit backward-compatible migration path and tests.
- Flag any code path that could silently discard, overwrite, or reset existing worlds.

## Gameplay and input safety

- Preserve all current game modes (Creative, Survival, Adventure, Spectator).
- Preserve desktop and mobile playability (keyboard, mouse, touch controls, pause menu, inventory, crafting, portal travel).
- Flag changes that break parity between desktop and mobile controls or interaction timing.

## Architecture and typing rules

- Prefer focused, typed modules for new logic.
- Keep `src/game/bootstrap.ts` as integration/composition glue; flag large new gameplay logic added directly there.
- Reject `@ts-nocheck`, broad `any`, disabled tests, and unrelated refactors mixed into feature/bugfix PRs.

## Validation expectations

- For gameplay/UI behavior changes, expect `npm run check`.
- For control, HUD, menu, startup, save, or other browser behavior changes, also expect `npm run test:e2e` (or a clear reason it was not run).
- Prefer actionable review comments with clear file/line reasoning and concrete fixes.
