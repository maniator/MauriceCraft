import { liquidKind } from '../world/fluid-blocks';
import { netherBiomeAt, netherStructureAt, NETHER_STRUCTURE_REGION, type NetherBiome } from '../world/nether-biomes';
import type { MobSpawnDependencies } from './mob-spawning';

type NetherMob = 'piglin' | 'zombified_piglin' | 'hoglin' | 'ghast' | 'blaze'
  | 'magma_cube' | 'strider' | 'wither_skeleton';
type Stronghold = 'fortress' | 'bastion' | null;
const pick = (choices: readonly NetherMob[], roll: number) =>
  choices[Math.min(choices.length - 1, Math.floor(roll * choices.length))];

/** Habitat selection is shared by spawning and regression tests. */
export function chooseNetherMob(biome: NetherBiome, stronghold: Stronghold, roll: number): NetherMob {
  if (stronghold === 'fortress') return pick(['blaze', 'wither_skeleton', 'wither_skeleton', 'blaze'], roll);
  if (stronghold === 'bastion') return pick(['piglin', 'piglin', 'piglin', 'hoglin', 'magma_cube'], roll);
  if (biome === 'crimson-forest') return pick(['piglin', 'piglin', 'hoglin', 'hoglin', 'zombified_piglin'], roll);
  if (biome === 'warped-forest') return pick(['zombified_piglin', 'zombified_piglin', 'piglin', 'strider'], roll);
  if (biome === 'basalt-deltas') return pick(['magma_cube', 'magma_cube', 'ghast', 'blaze'], roll);
  if (biome === 'soul-sand-valley') return pick(['ghast', 'ghast', 'wither_skeleton', 'zombified_piglin'], roll);
  return pick(['piglin', 'zombified_piglin', 'magma_cube', 'ghast', 'strider'], roll);
}
export interface NetherSpawnerDeps extends Pick<MobSpawnDependencies,
  'player' | 'getSeed' | 'getChunk' | 'getBlock' | 'collides' | 'solid' | 'kinds' | 'addMob'> {
  lavaBlock: number;
  worldHeight: number;
  random?: () => number;
}

/** Only loaded chunks, dry walkable floors and genuine lava habitats are eligible. */
export function createNetherSpawner(deps: NetherSpawnerDeps) {
  const random = deps.random ?? Math.random, get = deps.getBlock;
  function nearestStructure(x: number, z: number): Stronghold {
    const rx = Math.floor(x / NETHER_STRUCTURE_REGION), rz = Math.floor(z / NETHER_STRUCTURE_REGION);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const plan = netherStructureAt(rx + dx, rz + dz, deps.getSeed());
      if (plan && Math.abs(x - plan.x) <= plan.radius && Math.abs(z - plan.z) <= plan.radius)
        return plan.type;
    }
    return null;
  }
  function validFloor(x: number, z: number, height: number): number {
    for (let y = Math.min(31, height - 5); y >= 4; y--) {
      if (!deps.solid(get(x, y, z))) continue;
      if (get(x, y + 1, z) !== 0 || get(x, y + 2, z) !== 0 ||
        get(x, y + 3, z) !== 0) continue;
      return y;
    }
    return -1;
  }
  function trySpawnNetherMob(passiveOnly = false): void {
    const p = deps.player;
    for (let attempt = 0; attempt < 14; attempt++) {
      const theta = random() * Math.PI * 2, distance = 14 + random() * 19;
      const x = Math.floor(p.x + Math.cos(theta) * distance);
      const z = Math.floor(p.z + Math.sin(theta) * distance);
      if (!deps.getChunk(x >> 4, z >> 4)) continue;
      const biome = netherBiomeAt(x, z, deps.getSeed());
      // Peaceful keeps benign lava-walking striders, but never creates monsters.
      const kind = passiveOnly ? 'strider' : chooseNetherMob(biome, nearestStructure(x, z), random());
      const rule = deps.kinds[kind];
      if (!rule) continue;
      let y: number;
      if (kind === 'strider') {
        const lavaY = 12;
        if (liquidKind(get(x, lavaY, z)) !== 'lava' || get(x, lavaY + 1, z) !== 0) continue;
        y = lavaY + 1.2;
      } else if (kind === 'ghast' || kind === 'blaze') {
        // Spawn in the central cavern, independent of roof-only topY queries.
        const airY = 26;
        if ([0, 1, 2, 3].some(offset => get(x, airY + offset, z) !== 0)) continue;
        y = airY + 0.1;
      } else {
        const floor = validFloor(x, z, deps.worldHeight);
        if (floor < 0) continue;
        y = floor + 1.01;
      }
      if (deps.collides(x + 0.5, y, z + 0.5, rule.r, rule.h)) continue;
      deps.addMob(kind, x + 0.5, y, z + 0.5);
      return;
    }
  }
  return { trySpawnNetherMob };
}
