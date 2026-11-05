---
name: review-game-regressions
description: Review MauriceCraft changes for saved-world compatibility, deterministic generation, gameplay behavior, mobile controls, PWA safety, and real browser regressions. Use on game or web-app PRs.
---

# MauriceCraft-specific regression review

Use this checklist **selectively** on touched code and its downstream dependencies. A valid issue must identify a real path to a player-visible regression, not merely an untested possibility. Start with `docs/ARCHITECTURE.md` and `docs/TESTING.md`.

## Highest risk: preserving player worlds

- Keep the Dexie/IndexedDB name `blockcraft-worlds`, existing stores/keys, chunk coordinate keys, and numeric block IDs stable.
- Schema or serialized-format changes require an explicit backward-compatible migration and tests with old saves. Never silently clear, reset, overwrite, or regenerate a player's world on load failure.
- Preserve old `generatorVersion` behavior and seed determinism. In particular, earlier Overworld versions and Nether v5 must not silently change when adding v6+ features.
- Validate import/export atomicity, corrupt/truncated `.mcraft` rejection, world-ID remapping, dirty chunk persistence, retry/reload behavior, and dimension transfers when relevant.

## Gameplay and interactions

- Inspect input-to-action routing: keyboard/mouse vs touch, single tap/click vs long-press, placing/using vs attacking/mining, tool requirements and cooldowns.
- Check inventory/HUD slot synchronization, zero-count items, picked-up drops, recipe availability and crafting table actions.
- Check collision and step-up, water/lava flow, mobs crossing terrain or fluids, damage/friendly-vs-hostile AI, portal orientation and realm return.
- Check pause/menu/resume and survival restrictions as well as Creative, Adventure and Spectator differences.

## Browser, render and runtime

- For visuals, request **actual game captures** from desktop and narrow mobile/touch layouts. Watch HUD clipping, crosshair position, held-item pose, 3D depth, z-index, accessibility of controls and pointer targeting.
- Check frame-loop and chunk-streaming budgets, world/chunk allocations, Three.js resources and cleanup. Avoid extra DOM or GPU work on every tick.
- Ensure offline PWA assets and dynamically imported chunks remain available after install. Updates must not force a reload over unsaved progress.
- Verify the GitHub Pages base path `/MauriceCraft/` when changing Vite, PWA, routes or deployment.

## Evidence to ask for

| Change                                         | Minimum meaningful evidence                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Block ID, save schema, seeds, world generation | Vitest old/new seed and saved-world round trip; migration test if needed                                 |
| Mining, placement, mobs, crafting, movement    | Deterministic unit/regression test of behavior; browser test when input/UI wiring changes                |
| Input, HUD, menus, portals, startup            | Desktop **and** mobile Playwright flow against compiled game; actual screenshots for visual changes      |
| Dexie import/export, restore, autosave         | Browser reload with existing fixture world, error-path assertions, and no data loss                      |
| Chunk/render/PWA updates                       | Relevant unit/browser regression, build validation, and profiling/bundle evidence for performance claims |

Run or verify `npm run check` and `npm run test:e2e` as applicable. Treat CI results and assertions as evidence, never a substitute for reading the changed logic. If a test cannot be run, state that limitation clearly. Suggest one focused regression test per genuine gap; do not add tests that only parse YAML or search for source text.
