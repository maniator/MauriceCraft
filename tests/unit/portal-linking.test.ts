import { describe, expect, it } from 'vitest';
import type { PortalFrame } from '../../src/game/portals/frame';
import {
  conflictsWithPortalSite,
  findLinkedPortal,
  PORTAL_SEARCH_RADIUS,
} from '../../src/game/portals/linking';

const frame = (dimension: PortalFrame['dimension'], x: number, z: number, y = 13): PortalFrame => ({
  dimension,
  x,
  y,
  z,
  axis: 'x',
  width: 2,
  height: 3,
});

describe('Nether portal linking', () => {
  it('uses 1:8 travel radii and chooses the nearest frame, not insertion order', () => {
    expect(PORTAL_SEARCH_RADIUS.nether).toBe(16);
    expect(PORTAL_SEARCH_RADIUS.overworld).toBe(128);
    const portals = [frame('nether', 8.5, 4), frame('nether', 7.5, 12), frame('nether', 8.5, 19)];
    // Portal coordinates from a real v6 save: the first Nether entry should
    // not win merely because it was created earlier.
    expect(findLinkedPortal(portals, 'nether', 8, 15, 12)).toBe(portals[1]);
    expect(findLinkedPortal(portals, 'nether', 9, 15, 19)).toBe(portals[2]);
    expect(findLinkedPortal(portals, 'nether', 100, 15, 100)).toBeNull();
  });

  it('does not confuse the Nether radius with the Overworld radius', () => {
    const portals = [frame('overworld', 74.5, 33, 21)];
    expect(findLinkedPortal(portals, 'overworld', 150, 21, 33)).toBe(portals[0]);
    expect(findLinkedPortal(portals, 'overworld', 300, 21, 33)).toBeNull();
    expect(findLinkedPortal(portals, 'nether', 74.5, 15, 33)).toBeNull();
  });

  it('prevents newly carved portal pads from destroying nearby frames', () => {
    const portals = [frame('nether', 8.5, 4, 15)];
    expect(conflictsWithPortalSite(portals, 'nether', 9, 15, 10)).toBe(true);
    expect(conflictsWithPortalSite(portals, 'nether', 9, 15, 12)).toBe(false);
    expect(conflictsWithPortalSite(portals, 'overworld', 9, 15, 4)).toBe(false);
  });
});
