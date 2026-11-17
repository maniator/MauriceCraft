import { describe, expect, it } from 'vitest';
import {
  thirdPersonBoomDirection,
  unobstructedBoomDistance,
} from '../../src/game/rendering/third-person-view';

describe('third-person camera collision', () => {
  const eye = { x: 0.5, y: 2.5, z: 0.5 };
  const backwards = { x: 0, y: 0, z: 1 };
  const solid = (block: number) => block === 1;

  it('uses the full requested distance when the path is clear', () => {
    expect(unobstructedBoomDistance(eye, backwards, 4, () => 0, solid, 48)).toBe(4);
  });

  it('stops on the player side of a solid wall', () => {
    const get = (_x: number, _y: number, z: number) => (z === 3 ? 1 : 0);
    expect(unobstructedBoomDistance(eye, backwards, 4, get, solid, 48)).toBeCloseTo(2.35);
  });

  it('shortens to zero rather than clipping through a very close wall', () => {
    const get = (_x: number, _y: number, z: number) => (z === 1 ? 1 : 0);
    expect(unobstructedBoomDistance(eye, backwards, 4, get, solid, 48)).toBeCloseTo(0.35);
  });

  it('can shorten below 0.35 blocks when the wall is extremely close', () => {
    const closeEye = { ...eye, z: 0.95 };
    const get = (_x: number, _y: number, z: number) => (z === 1 ? 1 : 0);
    expect(unobstructedBoomDistance(closeEye, backwards, 4, get, solid, 48)).toBe(0);
  });

  it('does not treat water, torches, or other non-solid blocks as walls', () => {
    const get = (_x: number, _y: number, z: number) => (z === 1 || z === 2 ? 17 : 0);
    expect(unobstructedBoomDistance(eye, backwards, 4, get, solid, 48)).toBe(4);
  });
});

describe('third-person follow direction', () => {
  it('follows behind yaw zero with a stable upward offset', () => {
    const result = thirdPersonBoomDirection(0);
    expect(result.x).toBeCloseTo(0);
    expect(result.z).toBeGreaterThan(0.9);
    expect(result.y).toBeGreaterThan(0);
  });

  it('turns horizontally with the player while preserving vertical elevation', () => {
    const back = thirdPersonBoomDirection(0);
    const right = thirdPersonBoomDirection(Math.PI / 2);
    expect(right.x).toBeGreaterThan(0.9);
    expect(right.z).toBeCloseTo(0);
    expect(right.y).toBeCloseTo(back.y);
  });
});
