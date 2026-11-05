import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createPortalSystem, type WorldDimension } from '../../src/game/portals/portal-system';
import type { PortalFrame } from '../../src/game/portals/frame';

function fixture(netherFloor?: number) {
  const scene = new THREE.Scene();
  const portals: PortalFrame[] = [];
  const chunks = new Map<number, { cx: number; cz: number; edited: boolean; data: Uint8Array }>();
  const savedChunks = new Map<number, Uint8Array>();
  const player = { x: 0.5, y: 15, z: 0.5, vx: 1, vy: 0, vz: 0, fallStart: null };
  let dimension: WorldDimension = 'overworld';
  const blocks: Array<[number, number, number, number]> = [];
  const saveWorld = vi.fn();
  const portalSystem = createPortalSystem({
    scene, portals, chunks, savedChunks, obsidian: 12, worldHeight: 48,
    getDimension: () => dimension, setDimension: next => { dimension = next; },
    getPlayer: () => player, isPlaying: () => true,
    ensureAround: () => undefined, getOrGenerate: () => undefined,
    setBlock: (x, y, z, id) => { blocks.push([x, y, z, id]); },
    getBlock: (_x, y) => dimension === 'nether' && netherFloor !== undefined &&
      y <= netherFloor ? 50 : 0,
    topBlockY: () => 13, rebuildRegion: () => undefined,
    disposeMesh: () => undefined, resetChunkCache: () => undefined,
    clearStructures: () => undefined, clearMobs: () => undefined,
    collides: () => false, saveWorld, showHint: () => undefined,
  });
  return { scene, portals, chunks, savedChunks, player, blocks,
    saveWorld, portalSystem, getDimension: () => dimension };
}
describe('portal lifecycle and dimension transitions', () => {
  it('builds frame blocks, shows the purple plane and disposes visuals on unload', () => {
    const { scene, portals, blocks, portalSystem } = fixture();
    const portal = portalSystem.buildPortalFrame('overworld', 0, 12, 0);
    expect(blocks).toHaveLength(170);
    expect(blocks.filter(entry => entry[3] === 12)).toHaveLength(56);
    expect(blocks).toContainEqual([-1, 12, 2, 12]);
    expect(blocks).toContainEqual([-1, 13, 2, 0]);
    expect(portal.width).toBe(2);
    expect(portals).toHaveLength(1);
    expect(scene.children).toHaveLength(1);
    portalSystem.clearPortalVisuals();
    expect(scene.children).toHaveLength(0);
  });
  it('provides solid ground on both sides of a Nether arrival portal above lava', () => {
    const f = fixture();
    f.portalSystem.changeDimension('nether', -500, -500, 15);
    f.blocks.length = 0;
    const portal = f.portalSystem.buildPortalFrame('nether', -500, 13, -500);
    const exitX = Math.floor(portal.x);
    const exitZ = Math.floor(portal.z + 2.1);
    // These landing tiles are at y=13, above the Nether lava ocean (y<=12).
    expect(f.blocks).toContainEqual([exitX, 13, exitZ, 12]);
    expect(f.blocks).toContainEqual([exitX, 13, Math.floor(portal.z - 2.1), 12]);
    expect(f.blocks.some(([x, y, z, id]) =>
      x === exitX && y === 13 && z === exitZ && id === 0)).toBe(false);
  });

  it('places a high-floor Nether portal above rock with clear approaches', () => {
    const f = fixture(23);
    const origin = f.portalSystem.buildPortalFrame('overworld', 0, 12, 0);
    f.player.x = origin.x + 0.5;
    f.player.y = origin.y + 1;
    f.player.z = origin.z + 0.5;
    f.portalSystem.checkPortal(0.016);
    const destination = f.portals.find(p => p.dimension === 'nether');
    expect(destination?.y).toBe(23);
    expect(f.player.y).toBeCloseTo(24.05);
    // The player lands at z+2.1; this column is air above solid support.
    expect(f.blocks).toContainEqual([-1, 23, 2, 12]);
    for (const y of [24, 25, 26])
      expect(f.blocks).toContainEqual([-1, y, 2, 0]);
  });

  it('preserves edited Overworld chunks when moving to another dimension', () => {
    const { chunks, savedChunks, portalSystem, getDimension, player } = fixture();
    chunks.set(4, { cx: 4, cz: 0, edited: true, data: new Uint8Array([1, 2]) });
    portalSystem.changeDimension('nether', 8, 16);
    expect(savedChunks.size).toBe(1);
    expect([...savedChunks.values()][0]).toEqual(new Uint8Array([1, 2]));
    expect(chunks.size).toBe(0);
    expect(getDimension()).toBe('nether');
    expect(player.y).toBe(15);
    expect(player.vx).toBe(0);
  });
  it('travels through a portal and respects the return cooldown', () => {
    const { player, portalSystem, portals, getDimension, saveWorld } = fixture();
    const portal = portalSystem.buildPortalFrame('overworld', 0, 12, 0);
    player.x = portal.x + 0.5;
    player.y = portal.y + 1;
    player.z = portal.z + 0.5;
    portalSystem.checkPortal(0.016);
    expect(getDimension()).toBe('nether');
    expect(portals).toHaveLength(2);
    const saveCount = saveWorld.mock.calls.length;
    portalSystem.checkPortal(0.016);
    expect(saveWorld).toHaveBeenCalledTimes(saveCount);
  });
  it('links nearby Overworld command portals to one Nether frame instead of stacking them', () => {
    const f = fixture(23);
    const first = f.portalSystem.buildPortalFrame('overworld', 72, 21, 32);
    f.player.x = first.x + 0.5;
    f.player.y = first.y + 1;
    f.player.z = first.z + 0.5;
    f.portalSystem.checkPortal(0.016);
    const originalNether = f.portals.find(p => p.dimension === 'nether');
    expect(originalNether).toBeDefined();

    // These Overworld locations are separate but only about one Nether block apart.
    f.portalSystem.changeDimension('overworld', 64, 24, 15);
    const nearby = f.portalSystem.buildPortalFrame('overworld', 64, 24, 32);
    f.player.x = nearby.x + 0.5;
    f.player.y = nearby.y + 1;
    f.player.z = nearby.z + 0.5;
    f.portalSystem.checkPortal(3);
    expect(f.getDimension()).toBe('nether');
    expect(f.portals.filter(p => p.dimension === 'nether')).toEqual([originalNether]);

    f.portalSystem.changeDimension('overworld', 400, 24, 32);
    const distant = f.portalSystem.buildPortalFrame('overworld', 400, 24, 32);
    f.player.x = distant.x + 0.5;
    f.player.y = distant.y + 1;
    f.player.z = distant.z + 0.5;
    f.portalSystem.checkPortal(3);
    const netherPortals = f.portals.filter(p => p.dimension === 'nether');
    expect(netherPortals).toHaveLength(2);
    expect(Math.abs(netherPortals[1].x - netherPortals[0].x)).toBeGreaterThan(16);
  });

  it('does not carve a second generated portal through an existing frame', () => {
    const f = fixture();
    f.portalSystem.buildPortalFrame('nether', 9, 15, 4);
    const editedBlocks = f.blocks.length;
    expect(() => f.portalSystem.buildPortalFrame('nether', 9, 15, 10))
      .toThrow(/already too close/);
    expect(f.blocks).toHaveLength(editedBlocks);
    expect(f.portals).toHaveLength(1);
  });

});
