/** Inventory grants also fill the first available hotbar slot, without changing selection. */
export function grantInventoryItem(
  inventory: Record<number, number>,
  hotbar: number[],
  itemId: number,
  amount: number,
): void {
  if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isFinite(amount) || amount <= 0) return;
  inventory[itemId] = Math.min(9999, Math.max(0, inventory[itemId] || 0) + Math.floor(amount));
  if (hotbar.includes(itemId)) return;

  // Truly empty slots win over depleted items the player may want to replenish later.
  let slot = hotbar.indexOf(0);
  if (slot === -1) slot = hotbar.findIndex(id => !(inventory[id] > 0));
  if (slot !== -1) hotbar[slot] = itemId;
}
