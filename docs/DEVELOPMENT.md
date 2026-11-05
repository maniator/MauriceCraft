# Development

1. Install Node.js 22 or newer (`.nvmrc` specifies 22) and npm.
2. Run `npm ci` to install exactly the locked dependencies, then `npm run dev`.
3. Run `npm run format` after editing TypeScript, CSS, SCSS or Markdown, then `npm run check` before calling a change complete; this covers Prettier formatting, ESLint, strict TypeScript, unit coverage thresholds, and a production Vite build.
4. Run `npx playwright install chromium` once, then `npm run test:e2e` for desktop/mobile startup, gameplay and persistence regressions. `npm run check:full` runs both stages.

## Design principles

Keep browser APIs, WebGL, audio, and IndexedDB at integration boundaries. Put deterministic math, parsing, crafting, and rules into typed modules that can run in Node without WebGL. Prefer direct, named imports over global helpers. Avoid new dependencies unless they replace meaningful hand-written infrastructure.

Refactor in small steps, and confirm Creative, Survival, Adventure, Spectator, portal travel, saves, and phone controls still work. Never delete browser storage to “fix” a migration issue. The HTML file is not a place for JavaScript or CSS implementations.

## Formatting

Use the repository's pinned Prettier version and `.prettierrc.json` for TypeScript, CSS, SCSS and Markdown (including agent skills). Run `npm run format` to update existing files or `npm run format:check` to check without changing them. Formatting is checked by `npm run check` and in the CI workflow. Do not add competing formatting rules in ESLint.

Until the legacy modules in [issue #42](https://github.com/maniator/MauriceCraft/issues/42) are split, seven files have fixed, non-growing line limits in `eslint.config.mjs` to accommodate Prettier's expansion of compressed source. All other TypeScript files still have the 500-effective-line limit. Do not raise these exceptions; remove each one when the module is split.

## Code quality

Use strict TypeScript, explicit dependency interfaces, two-space indentation, single-purpose modules, no unexplained magic numbers, and clear ownership of persistent data. The bootstrap only wires modules together. Do not use `@ts-nocheck` or bypass the 500-effective-line lint limit. Make small meaningful commits, and keep the architecture and testing docs current. Treat generation versions, inventory/block IDs, save data, and mobile input as high risk.

## Copilot setup and MCP tooling

- Repository-wide Copilot coding rules live in `.github/copilot-instructions.md`.
- Copilot code review also uses `.github/instructions/code-review.instructions.md` for review-focused checks.
- Cloud-agent environment bootstrap runs from `.github/workflows/copilot-setup-steps.yml` and preinstalls Node 22 dependencies plus Playwright Chromium.
- Local VS Code MCP servers are defined in `.vscode/mcp.json`:
  - `github` via `@modelcontextprotocol/server-github` (uses a prompted token)
  - `playwright` via `@playwright/mcp`
- For cloud-agent secrets/variables, use the repository `copilot` environment in GitHub settings.
