# MauriceCraft

A browser-based block-building adventure inspired by Minecraft, built to run on school Chromebooks, computers, and phones. Play Creative, Survival, Adventure, or Spectator mode, explore generated terrain and structures, craft items, and visit the Nether and End.

## Quick start

Requires **Node.js 22+** and npm.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. For a production build, run `npm run build` and `npm run preview` (preview the build under `/MauriceCraft/`).

## Controls

Desktop: **WASD** to move, **Space** to jump, mouse to look, left/right click to break/place, **1–9** or wheel to select, **I** for inventory, **C** for crafting, **T** or **/** for commands, and **Esc** to pause. Creative mode supports flight with **F** or double-tap Space. The in-game menu documents additional shortcuts.

Mobile: use the on-screen movement area, drag to look, and tap the on-screen Jump/Place/Bag/Cmd controls. Inventory, crafting, and the pause menu are touch-friendly.

## Exploring generated worlds

New worlds use generator v3: 11 climate-driven biomes (plains, forest, flower meadow, savanna, desert, badlands, marsh, snowy taiga, tundra, highlands and volcanic highlands), distinct tree silhouettes and densities, lakes and lava pools, cliffside cascades, volcanoes with lava craters, cave tunnels and ravines, and less repetitive villages. New trees have separate birch, acacia, willow, pine and autumn palettes. Water and lava use gradual flow levels and sloped faces. The HUD names the current biome and nearby natural features. Weather can now shift between clear, cloudy, rain, and thunderstorms. Worlds use 32-bit seeded generation; the same seed and generator version reproduce the same starting terrain.

**Existing saves are preserved:** pre-biome worlds stay on generator v1; earlier biome saves stay on v2, including in unexplored chunks. Create a **New World** to see the new biomes and natural features. Do not rewrite an old world's generator version unless you deliberately accept terrain discontinuities.

## Save, export, and import worlds

Worlds autosave every **15 seconds**, when you pause, and when the app is hidden or closed. The menu now has a **Save World** button for a confirmed manual save. During gameplay tap/click **Menu** to return safely to the world menu on desktop or mobile. Every saved world has an **Export** button for a versioned binary `.mcraft` file; **Import World** accepts those files on any device. Imported worlds always receive unique IDs and cannot overwrite your existing saves. See the [world file format and transfer guide](docs/WORLD_FILES.md).

## Install for offline play

MauriceCraft can be installed on phones, Chromebooks and desktop browsers as a Progressive Web App. The game assets work offline after an initial online visit. New versions download automatically, but no tab reloads until the current world's latest saved changes are safe, including settings edited on the menu. See the [PWA guide](docs/PWA.md).

## Saved worlds

Saves live **only in your current browser** in IndexedDB. They are not stored in this GitHub repository or synchronized across devices. Clearing site storage, switching browser profiles/devices, or changing the website origin can make saves inaccessible. The database name and saved data format are intentionally unchanged in this refactor.

## Project scripts

- `npm run dev`: development server
- `npm run format`: format TypeScript, JavaScript, CSS, SCSS, and Markdown files with Prettier
- `npm run format:check`: verify code and documentation formatting without modifying files
- `npm run typecheck`: TypeScript check
- `npm run check:style`: Prettier and ESLint checks (separate CI workflow)
- `npm run check:tests`: unit coverage, TypeScript and production build (separate CI workflow)
- `npm run check`: combined formatting, lint, coverage, TypeScript and production build
- `npm run test:e2e`: browser regression tests on desktop and mobile
- `npm run build`: check types and build to `dist/`
- `npm run preview`: serve the production build
- `npm test`: run unit and regression tests

New here? Start with [**Build your game: first steps**](docs/START_HERE.md), [**copy-and-edit agent prompts**](docs/AGENT_PROMPTS.md), and [**coding-agent rules**](AGENTS.md).

For help making a Nether portal, see [the Nether portal guide](docs/PORTALS.md). The full Nether ecosystem and piglin expansion are tracked in [Nether roadmap](docs/NETHER_ROADMAP.md), to be implemented after the Overworld v3 reliability checks.

See [architecture](docs/ARCHITECTURE.md), [development guide](docs/DEVELOPMENT.md), [deployment](docs/DEPLOYMENT.md), and [contributing](CONTRIBUTING.md).
