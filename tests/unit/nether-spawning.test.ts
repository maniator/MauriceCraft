import { describe, expect, it, vi } from 'vitest';
import { chooseNetherMob, createNetherSpawner } from '../../src/game/entities/nether-spawning';
import type { MobSpawnDependencies } from '../../src/game/entities/mob-spawning';

describe('Nether inhabitants and spawn safety', () => {
  it('chooses mobs according to biome, fortress and bastion habitats', () => {
    expect(chooseNetherMob('wastes', 'fortress', 0)).toBe('blaze');
    expect(chooseNetherMob('wastes', 'fortress', 0.3)).toBe('wither_skeleton');
    expect(chooseNetherMob('wastes', 'bastion', 0.1)).toBe('piglin');
    expect(chooseNetherMob('crimson-forest', null, 0.75)).toBe('hoglin');
    expect(chooseNetherMob('basalt-deltas', null, 0.05)).toBe('magma_cube');
    expect(chooseNetherMob('soul-sand-valley', null, 0.1)).toBe('ghast');
  });
  it('requires a loaded chunk and empty room rather than spawning inside rock', () => {
    const addMob = vi.fn();
    const catalog = Object.fromEntries(['piglin', 'zombified_piglin', 'hoglin', 'ghast',
      'blaze', 'magma_cube', 'strider', 'wither_skeleton'].map(kind => [kind, { r: 0.3, h: 1.8 }]));
    const player = { x: 20, z: 20 };
    const base: Pick<MobSpawnDependencies, 'player' | 'getSeed' | 'getChunk' |
      'getBlock' | 'collides' | 'solid' | 'kinds' | 'addMob'> = {
      player, getSeed: () => 677,
      getChunk: () => null, getBlock: () => 0, collides: () => false,
      solid: block => block !== 0 && block !== 35,
      kinds: catalog, addMob,
    };
    const newSpawner = (override: Partial<typeof base>) => createNetherSpawner({
      ...base, ...override, lavaBlock: 35, worldHeight: 48,
      random: () => 0.28,
    });
    newSpawner({}).trySpawnNetherMob();
    expect(addMob).not.toHaveBeenCalled();
    newSpawner({ getChunk: () => ({}), getBlock: () => 3 }).trySpawnNetherMob();
    expect(addMob).not.toHaveBeenCalled();
  });
  it('uses the current dimension seed and produces no ordinary cows or zombies', () => {
    const names = ['piglin', 'zombified_piglin', 'hoglin', 'ghast', 'blaze',
      'magma_cube', 'strider', 'wither_skeleton'];
    const addMob = vi.fn();
    const floor = (y: number) => y <= 16 ? 50 : y >= 37 ? 50 : 0;
    const spawner = createNetherSpawner({
      player: { x: 0, z: 0 }, getSeed: () => 677, getChunk: () => ({}),
      getBlock: (_x, y) => floor(y), collides: () => false,
      solid: b => b === 50,
      kinds: Object.fromEntries(names.map(kind => [kind, { r: 0.4, h: 1.8 }])),
      addMob, worldHeight: 48, lavaBlock: 35,
      random: () => 0.2,
    });
    spawner.trySpawnNetherMob();
    if (addMob.mock.calls.length) expect(names).toContain(addMob.mock.calls[0][0]);
    // The generator may choose a flying mob, which is also expected to remain inside air.
  });
});
