import { fbm, hash2 } from './noise';
import { decorateNetherChunk } from './nether-decorations';
import { netherBiomeAt, netherFloorAt, netherCeilingAt, netherStructureAt,
  NETHER_STRUCTURE_REGION, type NetherStructure } from './nether-biomes';
import type { ChunkGeneratorDependencies } from './chunk-generator';

/** Cave-filled Nether v5. Only world-coordinate decisions: no chunk-edge seams. */
export function createNetherGenerator(deps: ChunkGeneratorDependencies) {
  const { blocks, maxHeight: H, getSeed } = deps;
  const { LAVA, BRICK, STONEBRICK, GOLD, TORCH } = blocks;
  const NETHERRACK = blocks.NETHERRACK ?? BRICK;
  const BASALT = blocks.BASALT ?? STONEBRICK;
  const SOUL_SOIL = blocks.SOUL_SOIL ?? blocks.SAND;
  const CRIMSON_NYLIUM = blocks.CRIMSON_NYLIUM ?? blocks.RED_SAND ?? BRICK;
  const WARPED_NYLIUM = blocks.WARPED_NYLIUM ?? blocks.GRASS;
  const BLACKSTONE = blocks.BLACKSTONE ?? STONEBRICK;
  const GLOWSTONE = blocks.GLOWSTONE ?? GOLD;
  const lavaLevel = 12;

  function makeChunk(cx: number, cz: number): Uint8Array {
    const seed = getSeed(), x0 = cx * 16, z0 = cz * 16;
    const data = new Uint8Array(16 * 16 * H);
    const put = (x: number, y: number, z: number, block: number) => {
      if (x < x0 || x >= x0 + 16 || z < z0 || z >= z0 + 16 || y < 0 || y >= H) return;
      data[(y * 16 + z - z0) * 16 + x - x0] = block;
    };
    const get = (x: number, y: number, z: number) => data[(y * 16 + z - z0) * 16 + x - x0];

    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = x0 + lx, z = z0 + lz;
      const biome = netherBiomeAt(x, z, seed);
      const floor = netherFloorAt(x, z, seed);
      const ceiling = netherCeilingAt(x, z, seed, H);
      const surface = biome === 'crimson-forest' ? CRIMSON_NYLIUM
        : biome === 'warped-forest' ? WARPED_NYLIUM
          : biome === 'basalt-deltas' ? BASALT
            : biome === 'soul-sand-valley' ? SOUL_SOIL : NETHERRACK;
      for (let y = 0; y <= floor; y++) {
        put(x, y, z, y === floor ? surface : y < 2 ? BLACKSTONE :
          biome === 'basalt-deltas' && y > floor - 5 ? BASALT : NETHERRACK);
      }
      for (let y = ceiling; y < H; y++) {
        const glow = y === ceiling && hash2(x, z, seed + 4520) > 0.986;
        put(x, y, z, glow ? GLOWSTONE : y === ceiling ? surface : NETHERRACK);
      }
      if (floor < lavaLevel) {
        for (let y = floor + 1; y <= lavaLevel; y++) put(x, y, z, LAVA);
      }
      // Varied hanging basalt pillars connect some cave roofs to the floor.
      const column = fbm(x / 18, z / 18, seed + 4522);
      if (biome === 'basalt-deltas' && column > 0.715 && Math.hypot(x, z) > 24) {
        for (let y = floor + 1; y < ceiling; y++) put(x, y, z, BASALT);
      }
    }
    // A few flowing roof-sourced lavafalls. Region anchoring prevents chunk seams.
    const cell = 52;
    for (let gz = Math.floor((z0 - 3) / cell); gz <= Math.floor((z0 + 18) / cell); gz++)
      for (let gx = Math.floor((x0 - 3) / cell); gx <= Math.floor((x0 + 18) / cell); gx++) {
        if (hash2(gx, gz, seed + 4540) >= 0.15) continue;
        const x = gx * cell + 8 + Math.floor(hash2(gx, gz, seed + 4541) * 34);
        const z = gz * cell + 8 + Math.floor(hash2(gx, gz, seed + 4542) * 34);
        if (Math.hypot(x, z) < 35) continue;
        const floor = netherFloorAt(x, z, seed), ceiling = netherCeilingAt(x, z, seed, H);
        for (let y = floor + 1; y <= ceiling; y++) put(x, y, z, LAVA);
        // Basalt rims stop a cascade looking disconnected from its source.
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dz) !== 1) continue;
          put(x + dx, ceiling - 1, z + dz, BASALT);
        }
      }
    // Keep v6 saves byte-for-byte consistent in unexplored terrain. New
    // decoration is enabled only for worlds created with generator v7+.
    if ((deps.getGeneratorVersion?.() ?? 6) >= 7)
      decorateNetherChunk(cx, cz, seed, H, {
        basalt: BASALT, blackstone: BLACKSTONE, crimson: CRIMSON_NYLIUM,
        warped: WARPED_NYLIUM, soul: SOUL_SOIL,
        glowstone: GLOWSTONE,
      }, put);
    const rx0 = Math.floor((x0 - 20) / NETHER_STRUCTURE_REGION);
    const rz0 = Math.floor((z0 - 20) / NETHER_STRUCTURE_REGION);
    const rx1 = Math.floor((x0 + 35) / NETHER_STRUCTURE_REGION);
    const rz1 = Math.floor((z0 + 35) / NETHER_STRUCTURE_REGION);
    for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
      const structure = netherStructureAt(rx, rz, seed);
      if (structure) buildStructure(structure, seed, put, get);
    }
    return data;
  }

  function buildStructure(st: NetherStructure, seed: number,
    put: (x: number, y: number, z: number, b: number) => void,
    get: (x: number, y: number, z: number) => number): void {
    const { x, y, z, type } = st;
    const ruined = type === 'bastion';
    const material = ruined ? BLACKSTONE : BRICK;
    const halfX = ruined ? 10 : 14;
    const halfZ = ruined ? 12 : 9;
    const side = hash2(st.rx, st.rz, seed + 4580) > 0.5 ? 1 : -1;
    for (let dz = -halfZ; dz <= halfZ; dz++) for (let dx = -halfX; dx <= halfX; dx++) {
      const wx = x + dx, wz = z + dz;
      put(wx, y, wz, material);
      // Bridge supports descend to surrounding terrain or lava.
      if ((Math.abs(dx) === halfX - 1 && Math.abs(dz) === halfZ - 1) ||
        (Math.abs(dx) % 6 === 0 && Math.abs(dz) === halfZ))
        for (let h = Math.max(2, y - 9); h < y; h++) put(wx, h, wz, material);
      const edge = Math.abs(dx) === halfX || Math.abs(dz) === halfZ;
      if (!edge) continue;
      const gap = ruined && hash2(wx, wz, seed + 4581) > 0.65;
      if (gap) continue;
      const wallHeight = ruined ? 1 + Math.floor(hash2(wx, wz, seed + 4582) * 4) : 4;
      for (let h = 1; h <= wallHeight; h++) {
        // Hall entrances and a central accessible courtyard.
        if (Math.abs(dx) < 2 && dz === -halfZ && h < 4) continue;
        if (Math.abs(dz) < 2 && dx === halfX * side && h < 4) continue;
        put(wx, y + h, wz, material);
      }
      if (!ruined && (Math.abs(dx) + Math.abs(dz)) % 3 === 0)
        put(wx, y + 5, wz, STONEBRICK);
    }
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      if (ruined && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) put(x + dx, y + 1, z + dz, GOLD);
    }
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (ruined) continue;
      // Clear the interior around the fortress stairs and elevated watch post.
      for (let h = 1; h <= 3; h++) {
        if (get(x + dx, y + h, z + dz) !== 0) put(x + dx, y + h, z + dz, 0);
      }
    }
    if (!ruined) {
      for (let h = 1; h <= 5; h++) put(x + side * 7, y + h, z, BRICK);
      put(x + side * 7, y + 6, z, TORCH);
    }
  }
  return makeChunk;
}
