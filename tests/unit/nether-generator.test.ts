import { describe, expect, it } from 'vitest';
import { createNetherGenerator } from '../../src/game/world/nether-generator';
import { createChunkGenerator, type ChunkGeneratorDependencies, type TerrainBlockIds } from '../../src/game/world/chunk-generator';

const blocks: TerrainBlockIds = {
  BRICK: 8, COAL_ORE: 27, COPPER_ORE: 28, DIAMOND_ORE: 30, DIRT: 2,
  GOLD: 14, GRASS: 1, IRON_ORE: 29, LAVA: 35, LEAVES: 6, SAND: 4,
  SANDSTONE: 11, STONE: 3, STONEBRICK: 10, TORCH: 17, WATER: 34, WOOD: 5,
  NETHERRACK: 50, BASALT: 51, SOUL_SOIL: 52, CRIMSON_NYLIUM: 53,
  WARPED_NYLIUM: 54, BLACKSTONE: 55, GLOWSTONE: 56,
};
function deps(seed: number, version = 5): ChunkGeneratorDependencies {
  return {
    getSeed: () => seed, getDimension: () => 'nether',
    getGeneratorVersion: () => version, maxHeight: 48, seaLevel: 14, regionSize: 80,
    groundH: () => 18, heightAt: () => 18,
    forceSand: () => false, inStructZone: () => false,
    structureFor: () => null, buildStructure: () => undefined, blocks,
  };
}
const block = (data: Uint8Array, x: number, y: number, z: number) =>
  data[(y * 16 + z) * 16 + x];

describe('versioned Nether terrain', () => {
  it('leaves pre-v6 Nether layouts completely unchanged', () => {
    const old = createChunkGenerator(deps(677, 5))(0, 0);
    const unversioned = createChunkGenerator({
      ...deps(677, 5), getGeneratorVersion: undefined,
    })(0, 0);
    expect(old).toEqual(unversioned);
    expect(createChunkGenerator(deps(677, 6))(0, 0)).not.toEqual(old);
  });
  it('generates a habitable lava-free arrival island and enclosed Nether ceiling', () => {
    const data = createNetherGenerator(deps(677))(0, 0);
    expect(data).toHaveLength(16 * 16 * 48);
    expect(block(data, 0, 13, 0)).toBeGreaterThan(0);
    expect(block(data, 0, 15, 0)).toBe(0);
    expect(block(data, 0, 47, 0)).not.toBe(0);
    expect(data.slice(0, 256).every(value => value !== 0)).toBe(true);
  });
  it('creates persistent lava seas and five genuinely distinct biome surface blocks', () => {
    const generate = createNetherGenerator(deps(677));
    let lava = 0;
    const surfaces = new Set<number>();
    for (let cz = -5; cz <= 5; cz += 2)
      for (let cx = -5; cx <= 5; cx += 2) {
        const data = generate(cx, cz);
        lava += data.filter(value => value === 35).length;
        for (const id of [50, 51, 52, 53, 54]) if (data.includes(id)) surfaces.add(id);
      }
    expect(lava).toBeGreaterThan(100);
    expect(surfaces.size).toBeGreaterThanOrEqual(3);
  });
  it('recreates distant chunks regardless of generation order and seed', () => {
    const a = createNetherGenerator(deps(141));
    const b = createNetherGenerator(deps(141));
    const first = a(-16, 9);
    a(12, -4);
    expect(b(-16, 9)).toEqual(first);
    expect(createNetherGenerator(deps(142))(-16, 9)).not.toEqual(first);
  });
});
