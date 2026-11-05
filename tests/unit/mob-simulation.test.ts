import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SpatialIndex } from '../../src/game/entities/spatial-index';
import { createMobSimulation, type MobActor } from '../../src/game/entities/mob-simulation';

function makeActor(kind: string, hostile: boolean, x: number): MobActor {
  const group = new THREE.Group();
  group.userData.legs = [new THREE.Group(), new THREE.Group()];
  return {
    kind,
    hostile,
    golem: false,
    persist: false,
    r: 0.3,
    h: 1.8,
    x,
    y: 1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    hit: false,
    atk: 3,
    burn: -1,
    phase: 0,
    ai: 3,
    walk: false,
    dx: 0,
    dz: 1,
    panic: 0,
    face: 0,
    jumpCd: 0,
    fuse: -1,
    shoot: 4,
    snd: 4,
    hx: 0,
    hz: 0,
    group,
    village: null,
  };
}
function fixture(
  actors: MobActor[],
  options: {
    daylight?: boolean;
    water?: boolean;
    sheltered?: boolean;
    getBlock?: (x: number, y: number, z: number) => number;
    movement?: (mob: MobActor, axis: number, distance: number) => void;
  } = {},
) {
  const mobs = actors;
  const hostileActors = new SpatialIndex<MobActor>();
  const defenders = new SpatialIndex<MobActor>();
  const player = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, onGround: true };
  const pendingHits: Array<{ m: MobActor; d: number }> = [];
  const pendingBlasts: Array<{ x: number; y: number; z: number; r: number; p: number }> = [];
  const damagePlayer = vi.fn();
  for (const mob of mobs) {
    if (mob.hostile) hostileActors.upsert(mob);
    if (mob.kind === 'villager') defenders.upsert(mob);
  }
  const tick = createMobSimulation({
    mobs,
    player,
    kinds: {
      zombie: { speed: 2, melee: { d: 1.15, dmg: 3, cd: 1.1 } },
      villager: { speed: 1 },
      creeper: { speed: 2 },
      cow: { speed: 0.8 },
      skeleton: { speed: 2 },
      ghast: { speed: 2 },
      blaze: { speed: 2.1 },
    },
    raid: { st: null },
    hostileActors,
    defenders,
    getDifficulty: () => ({ cap: 8, dmg: 1, fuse: 1.5, speed: 1, aggro: 32, shoot: 1 }),
    isDaylight: () => Boolean(options.daylight),
    isNight: () => !options.daylight,
    getRainLevel: () => 0,
    isSunExposed: () => !options.sheltered,
    getBlock: options.getBlock ?? (() => (options.water ? 34 : 0)),
    canTakeDamage: () => true,
    removeMobAt: (index) => {
      mobs.splice(index, 1);
    },
    damagePlayer,
    showHint: () => undefined,
    playSoundAt: () => undefined,
    hasLineOfSight: () => true,
    shootArrow: () => undefined,
    moveEntity: (mob, axis, distance) => {
      if (options.movement) {
        options.movement(mob, axis, distance);
        return;
      }
      if (axis === 0) mob.x += distance;
      if (axis === 1) mob.y += distance;
      if (axis === 2) mob.z += distance;
    },
    pendingHits,
    pendingBlasts,
  });
  return { tick, mobs, player, damagePlayer, pendingHits, pendingBlasts };
}
describe('mob simulation', () => {
  it('keeps animals afloat when swimming', () => {
    const cow = makeActor('cow', false, 2);
    const { tick } = fixture([cow], { water: true });
    tick(0.1);
    expect(cow.vy).toBeGreaterThan(0);
  });
  it('swims partly submerged rather than walking on top of a source block', () => {
    const cow = makeActor('cow', false, 2);
    cow.y = 1.1;
    cow.h = 1.5;
    const { tick } = fixture([cow], { getBlock: (_x, y) => (y === 1 ? 34 : 0) });
    for (let i = 0; i < 100; i++) tick(0.05);
    // Water source top is Y = 1.94, and the cow's feet must be submerged.
    expect(cow.y).toBeGreaterThan(1.3);
    expect(cow.y).toBeLessThan(1.8);
    expect(Math.abs(cow.vy)).toBeLessThan(0.2);
    expect(cow.onGround).toBe(false);
    expect(cow.group.position.y).toBe(cow.y);
  });

  it('follows the lower surface of flowing water instead of floating at full-block height', () => {
    const cow = makeActor('cow', false, 2);
    cow.y = 1.1;
    cow.h = 1.5;
    const { tick } = fixture([cow], { getBlock: (_x, y) => (y === 1 ? 162 : 0) });
    for (let i = 0; i < 100; i++) tick(0.05);
    expect(cow.y).toBeGreaterThan(0.8);
    expect(cow.y).toBeLessThan(1.5);
  });

  it('resumes gravity after leaving water', () => {
    const cow = makeActor('cow', false, 2);
    cow.y = 1.5;
    let wet = true;
    const { tick } = fixture([cow], { getBlock: (_x, y) => (wet && y === 1 ? 34 : 0) });
    tick(0.05);
    wet = false;
    const before = cow.y;
    tick(0.05);
    expect(cow.y).toBeLessThan(before);
    expect(cow.vy).toBeLessThan(0);
  });

  it('does not burn sheltered zombies or daylight creepers', () => {
    const zombie = makeActor('zombie', true, 5);
    const creeper = makeActor('creeper', true, 7);
    const { tick } = fixture([zombie, creeper], { daylight: true, sheltered: true });
    tick(0.1);
    expect(zombie.burn).toBe(-1);
    expect(creeper.burn).toBe(-1);
  });
  it('moves a nearby zombie toward the player without full-crowd scans', () => {
    const actor = makeActor('zombie', true, 8);
    const { tick } = fixture([actor]);
    tick(0.1);
    expect(actor.x).toBeLessThan(8);
    expect(actor.group.position.x).toBe(actor.x);
  });
  it('despawns distant ordinary mobs but preserves nearby ones', () => {
    const far = makeActor('zombie', true, 100);
    const near = makeActor('zombie', true, 8);
    const { tick, mobs } = fixture([far, near]);
    tick(0.1);
    expect(mobs).toEqual([near]);
  });
  it('keeps creeper fuse state and requests explosion at zero', () => {
    const creeper = makeActor('creeper', true, 1);
    creeper.fuse = 0.01;
    const { tick, pendingBlasts } = fixture([creeper]);
    tick(0.1);
    expect(pendingBlasts).toHaveLength(1);
    expect(pendingBlasts[0].r).toBe(3.4);
  });
  it('keeps flying Nether mobs out of solid shelters via the collision resolver', () => {
    const ghast = makeActor('ghast', true, 20);
    const blaze = makeActor('blaze', true, 15);
    const calls: Array<{ kind: string; axis: number }> = [];
    const { tick } = fixture([ghast, blaze], {
      movement: (mob, axis) => {
        calls.push({ kind: mob.kind, axis });
        mob.hit = true; // A wall or ceiling blocks all attempted movement.
      },
    });
    tick(0.2);
    for (const mob of [ghast, blaze]) {
      expect(calls.filter((call) => call.kind === mob.kind).map((call) => call.axis)).toEqual([
        0, 2, 1,
      ]);
      expect(mob.x).toBe(mob.kind === 'ghast' ? 20 : 15);
      expect(mob.y).toBe(1);
      expect(mob.group.position.x).toBe(mob.x);
    }
  });
});
