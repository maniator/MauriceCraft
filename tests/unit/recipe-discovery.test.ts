import { describe, expect, it } from 'vitest';
import { describeRecipe, recipeFingerprint } from '../../src/game/crafting/recipe-discovery';
import type { Recipe } from '../../src/game/crafting/recipes';

const shovel: Recipe = { out: 142, n: 1, shape: ['m', 's', 's'], key: { m: 9, s: 115 } };
const torch: Recipe = { out: 17, n: 4, shape: ['c', 's'], key: { c: 116, s: 115 } };
const cookedBeef: Recipe = { out: 105, n: 1, shapeless: [101] };
const cookedPork: Recipe = { out: 105, n: 1, shapeless: [102] };

describe('recipe book discovery and missing materials', () => {
  it('shows a partially owned shovel and identifies the materials still needed', () => {
    const entry = describeRecipe(shovel, { 115: 1 }, new Set(), 2);
    expect(entry.visible).toBe(true);
    expect(entry.canCraft).toBe(false);
    expect(entry.needsCraftingTable).toBe(true);
    expect(entry.missing).toEqual([
      { itemId: 9, count: 1 },
      { itemId: 115, count: 1 },
    ]);
  });

  it('shows a craftable new recipe even when it has not been crafted before', () => {
    expect(describeRecipe(torch, { 116: 1, 115: 1 }, new Set(), 2))
      .toMatchObject({ visible: true, canCraft: true, missing: [] });
  });

  it('hides unrelated recipes when none of their ingredients is owned', () => {
    const result = describeRecipe(shovel, { 101: 40 }, new Set(), 3);
    expect(result.visible).toBe(false);
    expect(result.canCraft).toBe(false);
  });

  it('keeps previously crafted recipes visible even with an empty backpack', () => {
    const previouslyCrafted = new Set([recipeFingerprint(shovel)]);
    expect(describeRecipe(shovel, {}, previouslyCrafted, 3))
      .toMatchObject({ visible: true, canCraft: false, previouslyCrafted: true });
  });

  it('distinguishes recipes with the same product but different ingredients', () => {
    const previous = new Set([recipeFingerprint(cookedBeef)]);
    expect(recipeFingerprint(cookedBeef)).not.toBe(recipeFingerprint(cookedPork));
    expect(describeRecipe(cookedBeef, {}, previous, 2).visible).toBe(true);
    expect(describeRecipe(cookedPork, {}, previous, 2).visible).toBe(false);
  });

  it('recognizes table-only recipes even if all ingredients are available', () => {
    expect(describeRecipe(shovel, { 9: 1, 115: 2 }, new Set(), 2))
      .toMatchObject({ visible: true, canCraft: false, needsCraftingTable: true, missing: [] });
    expect(describeRecipe(shovel, { 9: 1, 115: 2 }, new Set(), 3))
      .toMatchObject({ visible: true, canCraft: true, needsCraftingTable: false, missing: [] });
  });

  it('uses stable fingerprints for shaped and shapeless equivalents', () => {
    const same: Recipe = { out: 105, n: 1, shapeless: [101] };
    expect(recipeFingerprint(cookedBeef)).toBe(recipeFingerprint(same));
    expect(recipeFingerprint({ out: 111, n: 1, shapeless: [12, 9] }))
      .toBe(recipeFingerprint({ out: 111, n: 1, shapeless: [9, 12] }));
  });
});
