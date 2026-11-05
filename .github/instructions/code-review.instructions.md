---
applyTo: '**'
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

## Reusable review workflow

- Start with [.agents/skills/code-review/SKILL.md](../../.agents/skills/code-review/SKILL.md) for PRs, branches, and go/no-go reviews. For deeper implementation checks load [code-review-and-quality](../../.agents/skills/code-review-and-quality/SKILL.md); for gameplay, saves, input, rendering, or PWA changes load [review-game-regressions](../../.agents/skills/review-game-regressions/SKILL.md).
- Keep **spec compliance** and **repository standards** findings separate. Flag actual regressions with a precise changed-line location, consequence, and suggested test or repair; drop speculative or duplicate comments.
- For a GO / NO-GO decision, inspect the latest head commit's CI, merge state, and unresolved actionable review threads. Distinguish existing problems from PR-introduced ones and say when verification was unavailable. Never pretend a check or a real-game visual review was performed.
