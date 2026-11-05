import { describe, expect, it } from 'vitest';
import { createBlockCatalog } from '../../src/game/world/block-catalog';
import { createRecipeCatalog } from '../../src/game/crafting/recipe-catalog';
import { createRecipeMatcher } from '../../src/game/crafting/recipes';
import { describeRecipe } from '../../src/game/crafting/recipe-discovery';

describe('crafting catalog compatibility', () => {
  const blocks = createBlockCatalog();
  const recipes = createRecipeCatalog({
    items: blocks,
    toolTiers: blocks.TOOL_TIERS,
    toolId: blocks.toolId,
  });
  it('preserves classic utility recipes and starter tools', () => {
    expect(recipes.find((recipe) => recipe.out === blocks.PLANKS)).toMatchObject({
      n: 4,
      shapeless: [blocks.WOOD],
    });
    expect(recipes.find((recipe) => recipe.out === blocks.CTABLE)).toMatchObject({
      shape: ['pp', 'pp'],
    });
    expect(recipes.some((recipe) => recipe.out === blocks.toolId(0, 0))).toBe(true);
  });
  it('crafts planks and sticks directly from every tree log type', () => {
    const variants = [
      blocks.WOOD,
      blocks.DARK_WOOD,
      blocks.BIRCH_WOOD,
      blocks.ACACIA_WOOD,
      blocks.WILLOW_WOOD,
    ];
    for (const log of variants) {
      expect(recipes).toContainEqual({ out: blocks.PLANKS, n: 4, shapeless: [log] });
      expect(recipes).toContainEqual({ out: blocks.STICK, n: 4, shapeless: [log] });
    }
    // Traditional two-plank recipe still works in the 2x2 crafting grid.
    expect(recipes).toContainEqual({
      out: blocks.STICK,
      n: 4,
      shape: ['p', 'p'],
      key: { p: blocks.PLANKS },
    });
  });

  it('lets recipe-book choices resolve the log-to-planks / log-to-sticks conflict', () => {
    const { matchRecipe, recipeCounts } = createRecipeMatcher(recipes);
    const log = blocks.BIRCH_WOOD;
    const normal = matchRecipe([log, 0, 0, 0], 2);
    const stickChoice = recipes.find(
      (recipe) =>
        recipe.out === blocks.STICK &&
        recipe.shapeless?.length === 1 &&
        recipe.shapeless[0] === log,
    );
    expect(normal?.out).toBe(blocks.PLANKS);
    expect(stickChoice).toBeDefined();
    const selected = matchRecipe([log, 0, 0, 0], 2, stickChoice);
    expect(selected?.out).toBe(blocks.STICK);
    expect(selected?.n).toBe(4);
    expect(recipeCounts(selected!)).toEqual({ [log]: 1 });
    expect(matchRecipe([blocks.WOOD, 0, 0, 0], 2, stickChoice)?.out).toBe(blocks.PLANKS);
  });

  it('requires a 3x3 table for pickaxes and lets smaller recipes use the personal grid', () => {
    const pickaxe = recipes.find((recipe) => recipe.out === blocks.toolId(0, 0));
    const stick = recipes.find(
      (recipe) => recipe.out === blocks.STICK && recipe.shape?.length === 2,
    );
    expect(pickaxe).toBeDefined();
    expect(stick).toBeDefined();
    expect(
      describeRecipe(pickaxe!, { [blocks.PLANKS]: 10, [blocks.STICK]: 5 }, new Set(), 2)
        .needsCraftingTable,
    ).toBe(true);
    expect(
      describeRecipe(pickaxe!, { [blocks.PLANKS]: 10, [blocks.STICK]: 5 }, new Set(), 3).canCraft,
    ).toBe(true);
    expect(describeRecipe(stick!, { [blocks.PLANKS]: 10 }, new Set(), 2).canCraft).toBe(true);
  });
  it('preserves ore smelting and multi-ingredient recipes', () => {
    expect(
      recipes.some(
        (recipe) => recipe.out === blocks.IRON_INGOT && recipe.shapeless?.includes(blocks.RAW_IRON),
      ),
    ).toBe(true);
    expect(recipes.filter((recipe) => recipe.out === blocks.TORCH).length).toBeGreaterThan(0);
  });
});
