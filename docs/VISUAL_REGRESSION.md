# Seeded visual regression checks

MauriceCraft's screenshot suite renders the **built, running game** with Playwright.
It does not generate concept art or SVG mockups. Issue #40 is the canonical
owner; feature PRs (#28/#36/#41) should keep their functional tests but not
introduce duplicate screenshot workflows.

## Run

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:visual
```

The separate `build:visual` mode provides a typed test-only scene fixture. The
production `npm run build` omits that fixture and the `__mauriceVisual`
window property. The test runner opens `/MauriceCraft/` in the real preview
server using desktop Chrome and a Pixel 7 profile.

The six initial scenes are declared in `tests/e2e/visual-scenes.ts`. Each
records a seed64, terrain version, dimension, player coordinates, yaw/pitch,
mode, difficulty, selected item and time of day, plus the specific regression
it protects. The first version covers:

- v7 Overworld empty hand and held stone on desktop (seed 677);
- v7 and v6 Nether landscape on desktop (seed 677);
- v7 empty/held survival HUD on mobile (seed 6041988).

Every scene has an isolated browser context. A distinct test-only IndexedDB
record is created with the **correct generator version from the beginning**;
no real player save is reset, converted or overwritten. After loading, a
test-only controller verifies seed/version and pins the game state. Gameplay
simulation freezes while the real WebGL renderer continues to draw. Tests
assert the selected item, mode, position, dimension, game readiness, visible
meshes, and rendered triangle count **before capture**. Each scene is captured
twice and byte-compared so unstable frames cannot quietly enter baselines.

## How comparison and review work

GitHub CI runs the regular production game checks first, then `test:visual`
in the **same CI workflow**. It uploads `seeded-visual-captures` with both
renderings and, when present, Playwright's failed baseline comparisons
(`actual`, `expected`, `diff` PNGs). CI does not commit or approve images.

A scene without a committed baseline generates **candidate evidence only**.
This initial bootstrap mode intentionally does **not** claim a full
cross-commit pixel regression gate. Once a maintainer verifies that the image
actually shows the intended scene and passes repeatability, capture an
approved baseline in the same CI browser environment and commit it under
`tests/visual/visual.spec.ts-snapshots/`. The suite automatically invokes
Playwright `toHaveScreenshot` for approved images on later runs. Do **not**
automatically accept or update a baseline after a failing diff.

The normal `test:e2e` suite remains untouched: it exercises the real
production build, not the test-only fixture. Visual testing adds a separate
gate but no second standalone workflow and no write-scoped CI token.

## Next camera and outfit cases

When #28, #36 and #41 merge, extend the fixture with a typed, test-build-only
view-mode and animation-frame selector, and semantic checks for actual avatar
rendering (body bounds, both feet contacting the ground, front/side face
visibility and correct near-wall occlusion). A third-person button state
alone is **not** proof of a rendered avatar. Capture open space, near wall,
view-toggle recovery, front/three-quarter/rear, held items, first-person
empty hand and discrete swing phase at desktop and phone widths. Add wardrobe
parity between editor preview, in-world avatar and sleeve when available.

These cases must not be blessed if a player appears floating, flat,
clipped, unlit, giant, occluded incorrectly or if the held item disconnects
from the wrist. Add only scenarios with a named regression and stable fixture;
avoid an enormous snapshot matrix or timing-based screenshots. Do not bring
back the temporary image-committing workflows from the camera PRs.

## Review caveats

A passing pixel diff cannot replace a human checking camera composition,
legibility and correct game semantics. Confirm the screenshot is from the
actual game, not only that a PNG file exists. The first suite catches scene
absence and known HUD/canvas regressions but does **not yet** cover the
unmerged avatar and animation work. See issue #40 for remaining acceptance
criteria. The same Playwright version, OS/font environment and browser
profile should be used when reviewing baseline updates. CI is the source of
record for capture artifacts; workstation-local pictures should be treated
as previews only.
