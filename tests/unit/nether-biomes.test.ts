import { describe, expect, it } from 'vitest';
import { netherBiomeAt, netherCeilingAt, netherFloorAt, netherStructureAt, NETHER_BIOME_LABELS } from '../../src/game/world/nether-biomes';

describe('seeded Nether regions', () => {
  it('creates broad reproducible climate zones with several biomes', () => {
    const found = new Set<string>();
    for (let x = -1800; x < 1800; x += 137) for (let z = -1800; z < 1800; z += 137) found.add(netherBiomeAt(x, z, 677));
    expect(found.size).toBeGreaterThanOrEqual(4);
    for (const label of found) expect(NETHER_BIOME_LABELS[label as keyof typeof NETHER_BIOME_LABELS]).toBeTruthy();
    expect(netherBiomeAt(-204, 812, 677)).toBe(netherBiomeAt(-204, 812, 677));
  });
  it('preserves a safe portal-island height and underground headroom', () => {
    expect(netherFloorAt(0, 0, 677)).toBe(13);
    for (let x = -420; x <= 420; x += 31) {
      const floor = netherFloorAt(x, 2 * x, 677), roof = netherCeilingAt(x, 2 * x, 677);
      expect(floor).toBeGreaterThanOrEqual(4);
      expect(roof).toBeLessThanOrEqual(45);
      expect(roof - floor).toBeGreaterThanOrEqual(4);
    }
  });
  it('plans infrequent but genuinely different fortress and bastion locations', () => {
    const plans = [];
    for (let rx = -10; rx <= 10; rx++) for (let rz = -10; rz <= 10; rz++) {
      const plan = netherStructureAt(rx, rz, 677);
      if (!plan) continue;
      plans.push(plan);
      expect(netherStructureAt(rx, rz, 677)).toEqual(plan);
      expect(Math.hypot(plan.x, plan.z)).toBeGreaterThanOrEqual(52);
      expect(['bastion', 'fortress']).toContain(plan.type);
    }
    expect(plans.length).toBeGreaterThan(10);
    expect(plans.length).toBeLessThan(130);
  });
});
