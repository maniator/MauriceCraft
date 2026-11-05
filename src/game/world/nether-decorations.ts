import { hash2 } from './noise';
import { netherBiomeAt, netherCeilingAt, netherFloorAt } from './nether-biomes';

export interface NetherDecorationBlocks {
  basalt: number;
  blackstone: number;
  crimson: number;
  warped: number;
  soul: number;
  glowstone: number;
}
export type NetherBlockWriter = (x: number, y: number, z: number, block: number) => void;

/**
 * Version 7-only terrain details. Every location uses world coordinates,
 * including features crossing chunk edges, so results do not depend on load order.
 * Writing outside the current chunk is clipped by the generator's put().
 */
export function decorateNetherChunk(
  cx: number,
  cz: number,
  seed: number,
  worldHeight: number,
  blocks: NetherDecorationBlocks,
  put: NetherBlockWriter,
): void {
  const x0 = cx * 16,
    z0 = cz * 16;
  const centers = (size: number, reach: number, visit: (gx: number, gz: number) => void) => {
    const minX = Math.floor((x0 - reach) / size);
    const maxX = Math.floor((x0 + 15 + reach) / size);
    const minZ = Math.floor((z0 - reach) / size);
    const maxZ = Math.floor((z0 + 15 + reach) / size);
    for (let gz = minZ; gz <= maxZ; gz++) for (let gx = minX; gx <= maxX; gx++) visit(gx, gz);
  };
  const safeColumn = (x: number, z: number) => Math.hypot(x, z) >= 18;

  // Hanging glowstone and luminous crystal clusters.
  centers(12, 3, (gx, gz) => {
    if (hash2(gx, gz, seed + 4610) > 0.34) return;
    const x = gx * 12 + 3 + Math.floor(hash2(gx, gz, seed + 4611) * 6);
    const z = gz * 12 + 3 + Math.floor(hash2(gx, gz, seed + 4612) * 6);
    if (!safeColumn(x, z)) return;
    const roof = netherCeilingAt(x, z, seed, worldHeight);
    const length = 1 + Math.floor(hash2(gx, gz, seed + 4613) * 4);
    for (let dy = 1; dy <= length; dy++) {
      put(x, roof - dy, z, blocks.glowstone);
      if (dy === 1 || dy === 2) {
        put(x + 1, roof - dy, z, blocks.glowstone);
        put(x, roof - dy, z - 1, blocks.glowstone);
      }
    }
  });

  // Large crimson and warped fungi, with matching caps and occasional lights.
  centers(10, 3, (gx, gz) => {
    if (hash2(gx, gz, seed + 4620) > 0.52) return;
    const x = gx * 10 + 2 + Math.floor(hash2(gx, gz, seed + 4621) * 6);
    const z = gz * 10 + 2 + Math.floor(hash2(gx, gz, seed + 4622) * 6);
    if (!safeColumn(x, z)) return;
    const biome = netherBiomeAt(x, z, seed);
    if (biome !== 'crimson-forest' && biome !== 'warped-forest') return;
    const floor = netherFloorAt(x, z, seed);
    const roof = netherCeilingAt(x, z, seed, worldHeight);
    const height = 3 + Math.floor(hash2(gx, gz, seed + 4623) * 3);
    if (floor < 12 || roof - floor < height + 4) return;
    const material = biome === 'crimson-forest' ? blocks.crimson : blocks.warped;
    for (let dy = 1; dy <= height; dy++) put(x, floor + dy, z, material);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > 3) continue;
        put(x + dx, floor + height, z + dz, material);
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)
          put(x + dx, floor + height + 1, z + dz, material);
      }
    if (hash2(gx, gz, seed + 4624) < 0.45) put(x + 1, floor + height - 1, z, blocks.glowstone);
  });

  // Basalt needles, blackstone outcrops and soul-sand-valley markers.
  centers(13, 2, (gx, gz) => {
    if (hash2(gx, gz, seed + 4630) > 0.5) return;
    const x = gx * 13 + 3 + Math.floor(hash2(gx, gz, seed + 4631) * 6);
    const z = gz * 13 + 3 + Math.floor(hash2(gx, gz, seed + 4632) * 6);
    if (!safeColumn(x, z)) return;
    const biome = netherBiomeAt(x, z, seed);
    if (biome === 'crimson-forest' || biome === 'warped-forest') return;
    const floor = netherFloorAt(x, z, seed);
    const roof = netherCeilingAt(x, z, seed, worldHeight);
    if (floor <= 12 || roof - floor < 7) return;
    const tall = biome === 'basalt-deltas' ? 4 : 2;
    const height = 1 + Math.floor(hash2(gx, gz, seed + 4633) * tall);
    const material =
      biome === 'basalt-deltas'
        ? blocks.basalt
        : biome === 'soul-sand-valley'
          ? blocks.soul
          : blocks.blackstone;
    for (let dy = 1; dy <= height; dy++) put(x, floor + dy, z, material);
    if (height > 2) {
      put(x + 1, floor + 1, z, material);
      put(x, floor + 1, z + 1, material);
    }
    // Tiny glowstone nodes make dark wasteland features worth exploring.
    if (biome === 'wastes' && hash2(gx, gz, seed + 4634) < 0.22)
      put(x, floor + height + 1, z, blocks.glowstone);
  });
}
