import { fbm, hash2 } from './noise';

/** Coherent climate regions, shared by terrain, inhabitants and the exploration HUD. */
export type NetherBiome =
  'wastes' | 'crimson-forest' | 'warped-forest' | 'basalt-deltas' | 'soul-sand-valley';
export const NETHER_BIOME_LABELS: Record<NetherBiome, string> = {
  wastes: 'Nether Wastes',
  'crimson-forest': 'Crimson Forest',
  'warped-forest': 'Warped Forest',
  'basalt-deltas': 'Basalt Deltas',
  'soul-sand-valley': 'Soul Sand Valley',
};
export function netherBiomeAt(x: number, z: number, seed: number): NetherBiome {
  const heat = fbm(x / 240, z / 240, seed + 4200);
  const warped = fbm(x / 220, z / 220, seed + 4201);
  if (heat > 0.65) return warped < 0.5 ? 'basalt-deltas' : 'crimson-forest';
  if (heat < 0.36) return warped > 0.5 ? 'soul-sand-valley' : 'warped-forest';
  if (warped > 0.66) return 'warped-forest';
  if (warped < 0.36) return 'crimson-forest';
  return 'wastes';
}
export function netherFloorAt(x: number, z: number, seed: number): number {
  const hills = fbm(x / 39, z / 39, seed + 4301);
  const continents = fbm(x / 115, z / 115, seed + 4302);
  const biome = netherBiomeAt(x, z, seed);
  const delta = biome === 'basalt-deltas' ? 4 : biome === 'soul-sand-valley' ? -3 : 0;
  // A dependable portal arrival island surrounds the dimension's default origin.
  const portalZone = Math.max(0, 1 - Math.hypot(x, z) / 28);
  const height = 4 + Math.floor(hills * 12 + continents * 6) + delta;
  return Math.max(4, Math.min(27, Math.round(height * (1 - portalZone) + 13 * portalZone)));
}
export function netherCeilingAt(x: number, z: number, seed: number, maxHeight = 48): number {
  const height = 35 + Math.floor(fbm(x / 31, z / 31, seed + 4303) * 9);
  return Math.max(31, Math.min(maxHeight - 3, height));
}
export interface NetherStructure {
  type: 'fortress' | 'bastion';
  x: number;
  z: number;
  y: number;
  radius: number;
  rx: number;
  rz: number;
}
export const NETHER_STRUCTURE_REGION = 160;
/** Rare region-anchored structure plans do not depend on chunk load order. */
export function netherStructureAt(rx: number, rz: number, seed: number): NetherStructure | null {
  const roll = hash2(rx, rz, seed + 4400);
  if (roll > 0.19) return null;
  const x = rx * NETHER_STRUCTURE_REGION + 47 + Math.floor(hash2(rx, rz, seed + 4401) * 66);
  const z = rz * NETHER_STRUCTURE_REGION + 47 + Math.floor(hash2(rx, rz, seed + 4402) * 66);
  if (Math.hypot(x, z) < 52) return null;
  const biome = netherBiomeAt(x, z, seed);
  const type = roll < 0.085 || biome === 'soul-sand-valley' ? 'fortress' : 'bastion';
  return {
    type,
    x,
    z,
    y: Math.min(30, Math.max(16, netherFloorAt(x, z, seed) + 3)),
    radius: 19,
    rx,
    rz,
  };
}
