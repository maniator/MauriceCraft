import { describe, expect, it } from 'vitest';
import { createCollisionEngine } from '../../src/game/world/collision';

const blocks = new Map<string, number>();
const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const engine = createCollisionEngine({
  getBlock: (x, y, z) => blocks.get(key(x, y, z)) ?? 0,
  solid: b => b !== 0,
  defaultRadius: 0.3,
  defaultHeight: 1.8,
  bedHeight: 0.5625,
});
describe('player and mob collision rules', () => {
  it('treats solid blocks as obstacles but lets players stand above a low bed', () => {
    blocks.clear();
    blocks.set(key(2, 2, 0), 3);
    expect(engine.collides(2.5, 2.01, 0.5)).toBe(true);
    blocks.clear();
    blocks.set(key(2, 2, 0), 19);
    expect(engine.collides(2.5, 2.57, 0.5)).toBe(false);
    expect(engine.collides(2.5, 2.1, 0.5)).toBe(true);
  });
  it('prevents fast horizontal movement from tunnelling through a wall', () => {
    blocks.clear();
    blocks.set(key(2, 2, 0), 3);
    const entity = { x: 0.5, y: 2.01, z: 0.5, vx: 10, vy: 0, vz: 0, hit: false };
    engine.moveEnt(entity, 0, 5);
    expect(entity.x).toBeLessThan(2 - 0.3 + 0.01);
    expect(entity.vx).toBe(0);
    expect(entity.hit).toBe(true);
  });
  it('lands a falling entity and clears vertical velocity', () => {
    blocks.clear();
    blocks.set(key(0, 0, 0), 3);
    const entity = { x: 0.5, y: 2, z: 0.5, vx: 0, vy: -8, vz: 0, onGround: false };
    engine.moveEnt(entity, 1, -4);
    expect(entity.y).toBeGreaterThanOrEqual(1);
    expect(entity.onGround).toBe(true);
    expect(entity.vy).toBe(0);
  });
  it('automatically steps onto a one-block ledge with space above it', () => {
    blocks.clear();
    blocks.set(key(1, 1, 0), 3);
    const player = { x: 0.5, y: 1, z: 0.5, vx: 4, vy: -1, vz: 0, onGround: false };
    engine.moveEnt(player, 0, 1, 2.001);
    expect(player.x).toBeCloseTo(1.5);
    expect(player.y).toBeCloseTo(2.001);
    expect(player.onGround).toBe(true);
    expect(player.vx).toBe(4);
  });

  it('still blocks walls when no step was authorized or the wall is two blocks tall', () => {
    blocks.clear();
    blocks.set(key(1, 1, 0), 3);
    const blocked = { x: 0.5, y: 1, z: 0.5, vx: 4, vy: 0, vz: 0 };
    engine.moveEnt(blocked, 0, 1);
    expect(blocked.x).toBeLessThan(0.71);
    expect(blocked.y).toBe(1);
    blocks.set(key(1, 2, 0), 3);
    const tooTall = { x: 0.5, y: 1, z: 0.5, vx: 4, vy: 0, vz: 0 };
    engine.moveEnt(tooTall, 0, 1, 2.001);
    expect(tooTall.x).toBeLessThan(0.71);
    expect(tooTall.y).toBe(1);
  });

  it('does not step into a low ceiling or through a wall while rising', () => {
    blocks.clear();
    blocks.set(key(1, 1, 0), 3);
    blocks.set(key(1, 3, 0), 3);
    const player = { x: 0.5, y: 1, z: 0.5, vx: 4, vy: 0, vz: 0 };
    engine.moveEnt(player, 0, 1, 2.001);
    expect(player.x).toBeLessThan(0.71);
    expect(player.y).toBe(1);
  });

  it('steps onto a bed at its actual height, rather than jumping a full block', () => {
    blocks.clear();
    blocks.set(key(1, 1, 0), 19);
    const player = { x: 0.5, y: 1, z: 0.5, vx: 4, vy: 0, vz: 0 };
    engine.moveEnt(player, 0, 0.75, 2.001);
    expect(player.x).toBeCloseTo(1.25);
    expect(player.y).toBeGreaterThan(1.5625);
    expect(player.y).toBeLessThan(1.6);
  });

  it('cannot combine X and Z movement to climb two blocks in one frame', () => {
    blocks.clear();
    blocks.set(key(1, 1, 0), 3);
    blocks.set(key(1, 2, 1), 3);
    const player = { x: 0.5, y: 1, z: 0.5, vx: 4, vy: 0, vz: 4 };
    engine.moveEnt(player, 0, 1, 2.001);
    engine.moveEnt(player, 2, 1, 2.001);
    expect(player.x).toBeCloseTo(1.5);
    expect(player.y).toBeCloseTo(2.001);
    expect(player.z).toBeLessThan(0.71);
  });

});
