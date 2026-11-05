import type { Recipe } from './recipes';

/** Stable across sessions, unlike the position of a recipe in the catalog. */
export function recipeFingerprint(recipe: Recipe): string {
  if (recipe.shapeless) {
    return JSON.stringify([
      recipe.out,
      recipe.n,
      'shapeless',
      [...recipe.shapeless].sort((a, b) => a - b),
    ]);
  }
  const pattern = (recipe.shape ?? []).map((row) =>
    row.split('').map((ch) => (ch === '.' ? 0 : (recipe.key?.[ch] ?? 0))),
  );
  return JSON.stringify([recipe.out, recipe.n, 'shaped', pattern]);
}

export interface MissingIngredient {
  itemId: number;
  count: number;
}
export interface RecipeDiscovery {
  visible: boolean;
  canCraft: boolean;
  needsCraftingTable: boolean;
  previouslyCrafted: boolean;
  missing: MissingIngredient[];
}

/**
 * A recipe is discoverable when the player owns any required ingredient or has
 * successfully crafted that exact recipe before. Known recipes stay visible
 * even after ingredients run out; unknown, wholly unrelated recipes stay hidden.
 */
export function describeRecipe(
  recipe: Recipe,
  inventory: Readonly<Record<number, number>>,
  craftedRecipes: ReadonlySet<string>,
  gridSize: number,
): RecipeDiscovery {
  const required = new Map<number, number>();
  const ingredients =
    recipe.shapeless ??
    (recipe.shape ?? []).flatMap((row) =>
      row.split('').map((ch) => (ch === '.' ? 0 : (recipe.key?.[ch] ?? 0))),
    );
  for (const itemId of ingredients) {
    if (itemId) required.set(itemId, (required.get(itemId) ?? 0) + 1);
  }
  const missing: MissingIngredient[] = [];
  let hasIngredient = false;
  for (const [itemId, count] of required) {
    const owned = Math.max(0, inventory[itemId] ?? 0);
    if (owned > 0) hasIngredient = true;
    if (owned < count) missing.push({ itemId, count: count - owned });
  }
  const needsCraftingTable = recipe.shapeless
    ? recipe.shapeless.length > gridSize * gridSize
    : (recipe.shape ?? []).length > gridSize ||
      (recipe.shape ?? []).some((row) => row.length > gridSize);
  const previouslyCrafted = craftedRecipes.has(recipeFingerprint(recipe));
  return {
    visible: hasIngredient || previouslyCrafted,
    canCraft: missing.length === 0 && !needsCraftingTable,
    needsCraftingTable,
    previouslyCrafted,
    missing,
  };
}
