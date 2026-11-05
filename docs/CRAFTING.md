# Backpack and recipe book behavior

In **Survival**, the backpack lists only items whose inventory count is positive. Hotbar slots are still shown when empty so keyboard and touch selection remain stable. **Creative** inventory intentionally lists every block and item.

The recipe book reveals a recipe as soon as the player owns **at least one of its required ingredients**. This is intentional even when many materials are missing: e.g., a single stick unlocks the shovel recipe preview. Each entry lists its full requirements and the exact quantities still needed. Recipes that can already be crafted are available immediately. Recipes requiring a 3×3 grid indicate that a crafting table is needed.

A recipe successfully crafted at least once is **remembered in that world**, even if none of its ingredients remain. This discovery history is recorded in the existing world metadata as `craftedRecipes`, using a stable recipe fingerprint based on output, quantity, and ingredients/shape. Legacy worlds without this field start with an empty history. Switching to a different saved world or creating a new world resets the in-memory discovery history to that world's own saved history; no IndexedDB schema change is needed.

The **Fill** action is available when a recipe has all materials and fits the current grid. **Preview** can display a partially collected recipe in the grid without consuming items or permitting crafting without the required inventory. A recipe needing a crafting table cannot fill a 2×2 grid.

Regression coverage:
- `tests/unit/recipe-discovery.test.ts`: partial ingredient discovery, missing material counts, known recipes, alternative recipes with the same output, and crafting table requirements
- `tests/unit/world-restore.test.ts` and `tests/unit/world-persistence.test.ts`: learned recipe save/load and isolation across worlds
- `tests/e2e/gameplay.spec.ts`: survival backpack and partial recipe discovery in desktop and mobile browser builds
