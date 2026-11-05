import { describe, expect, it } from 'vitest';
import { grantInventoryItem } from '../../src/game/items/inventory-grants';

describe('automatic hotbar pickup', () => {
  it('adds a first pickup to an empty hotbar without changing selection', () => {
    const inventory: Record<number, number> = {};
    const hotbar = Array<number>(9).fill(0);
    grantInventoryItem(inventory, hotbar, 45, 2);
    expect(inventory[45]).toBe(2);
    expect(hotbar).toEqual([45, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('stacks existing items without creating duplicate hotbar entries', () => {
    const inventory: Record<number, number> = { 45: 1 };
    const hotbar = [0, 45, 0, 0, 0, 0, 0, 0, 0];
    grantInventoryItem(inventory, hotbar, 45, 3);
    expect(inventory[45]).toBe(4);
    expect(hotbar).toEqual([0, 45, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('prefers truly empty slots, then reuses depleted slots without replacing live items', () => {
    const inventory: Record<number, number> = { 7: 2, 8: 0, 9: 3 };
    const hotbar = [7, 8, 9, 0, 0, 0, 0, 0, 0];
    grantInventoryItem(inventory, hotbar, 10, 1);
    expect(hotbar).toEqual([7, 8, 9, 10, 0, 0, 0, 0, 0]);
    for (let i = 4; i < 9; i++) {
      grantInventoryItem(inventory, hotbar, 10 + i, 1);
    }
    expect(hotbar[1]).toBe(8);
    grantInventoryItem(inventory, hotbar, 99, 1);
    expect(hotbar[1]).toBe(99);
    expect(inventory[8]).toBe(0);
  });

  it('keeps a full occupied hotbar unchanged and still saves the item in the backpack', () => {
    const inventory: Record<number, number> = {};
    const hotbar = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    hotbar.forEach(id => { inventory[id] = 1; });
    grantInventoryItem(inventory, hotbar, 60, 4);
    expect(inventory[60]).toBe(4);
    expect(hotbar).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('never reduces a legacy inventory stack larger than the /give command limit', () => {
    const inventory: Record<number, number> = { 10: 15000 };
    const hotbar = Array<number>(9).fill(0);
    grantInventoryItem(inventory, hotbar, 10, 1);
    expect(inventory[10]).toBe(15001);
    expect(hotbar[0]).toBe(10);
  });

  it('ignores invalid grants without capping ordinary collected items', () => {
    const inventory: Record<number, number> = { 10: 9998 };
    const hotbar = Array<number>(9).fill(0);
    grantInventoryItem(inventory, hotbar, 0, 4);
    grantInventoryItem(inventory, hotbar, 10, -2);
    grantInventoryItem(inventory, hotbar, 10, 5);
    expect(inventory).toEqual({ 10: 10003 });
    expect(hotbar[0]).toBe(10);
  });
});
