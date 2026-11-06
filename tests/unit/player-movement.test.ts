import { describe, expect, it } from 'vitest';
import {
  createPlayerMovement,
  type PlayerMovementBody,
} from '../../src/game/player/player-movement';
import type { GameMode } from '../../src/game/ui/game-menu';

function fixture() {
  const player: PlayerMovementBody = {
    x: 0,
    y: 1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    fly: false,
    onGround: true,
    fallStart: null,
  };
  const keys: Record<string, boolean> = {};
  let mode: GameMode = 'creative';
  let hunger = 20;
  let sleeping = false;
  let inWater = false;
  const damage: number[] = [];
  let collisions = 0;
  const stepCeilings: Array<number | undefined> = [];
  const movement = createPlayerMovement({
    player,
    keys,
    touchMovement: { x: 0, z: 0 },
    getMode: () => mode,
    getHunger: () => hunger,
    isJumpPressed: () => Boolean(keys.Space),
    isSleeping: () => sleeping,
    getSpectatorSpeed: () => 1,
    isInWater: () => inWater,
    worldHeight: 48,
    moveEntity: (axis, distance, maxStepY) => {
      collisions++;
      if (axis !== 1) stepCeilings.push(maxStepY);
      if (axis === 0) player.x += distance;
      if (axis === 2) player.z += distance;
      if (axis === 1) {
        player.y = Math.max(1, player.y + distance);
        if (player.y === 1) player.onGround = true;
      }
    },
    checkPortal: () => undefined,
    respawn: () => undefined,
    exert: () => undefined,
    refreshHunger: () => undefined,
    getSurfaceBlock: () => 3,
    playStep: () => undefined,
    playLanding: () => undefined,
    applyFallDamage: (amount) => {
      damage.push(amount);
    },
  });
  return {
    player,
    keys,
    damage,
    movement,
    stepCeilings,
    setMode: (next: GameMode) => {
      mode = next;
    },
    setHunger: (next: number) => {
      hunger = next;
    },
    setSleeping: (next: boolean) => {
      sleeping = next;
    },
    setWater: (next: boolean) => {
      inWater = next;
    },
    getCollisions: () => collisions,
  };
}
describe('player movement and physics', () => {
  it('moves forward without exceeding diagonal input speed', () => {
    const direct = fixture();
    direct.keys.KeyW = true;
    direct.movement.updateMovement(0.05);
    const forwardDistance = Math.hypot(direct.player.x, direct.player.z);
    expect(forwardDistance).toBeGreaterThan(0);

    const diagonal = fixture();
    diagonal.keys.KeyW = true;
    diagonal.keys.KeyD = true;
    diagonal.movement.updateMovement(0.05);
    expect(Math.hypot(diagonal.player.x, diagonal.player.z)).toBeCloseTo(forwardDistance, 8);
  });

  it('enables a one-block step only during grounded walking or sprinting', () => {
    const game = fixture();
    game.keys.KeyW = true;
    game.movement.updateMovement(0.05);
    expect(game.stepCeilings).toEqual([2.001, 2.001]);

    game.stepCeilings.length = 0;
    game.player.onGround = false;
    game.movement.updateMovement(0.05);
    expect(game.stepCeilings).toEqual([undefined, undefined]);

    game.stepCeilings.length = 0;
    game.player.onGround = true;
    game.player.fly = true;
    game.movement.updateMovement(0.05);
    expect(game.stepCeilings).toEqual([undefined, undefined]);

    game.stepCeilings.length = 0;
    game.player.fly = false;
    game.player.onGround = true;
    game.keys.Space = true;
    game.movement.updateMovement(0.05);
    expect(game.stepCeilings).toEqual([undefined, undefined]);
  });

  it('skips collisions for spectator mode and clamps vertical travel', () => {
    const game = fixture();
    game.setMode('spectator');
    game.keys.KeyW = true;
    game.keys.Space = true;
    game.movement.updateMovement(1);
    expect(game.getCollisions()).toBe(0);
    expect(game.player.onGround).toBe(false);
    expect(game.player.fallStart).toBeNull();
    game.player.y = 1.1;
    game.keys.KeyW = false;
    game.keys.Space = false;
    game.keys.ShiftLeft = true;
    game.movement.updateMovement(1);
    expect(game.player.y).toBeGreaterThanOrEqual(1);
  });

  it('prevents a hungry survival player from sprinting', () => {
    const sprinting = fixture();
    sprinting.setMode('survival');
    sprinting.keys.KeyW = true;
    sprinting.keys.ShiftLeft = true;
    sprinting.movement.updateMovement(0.05);

    const hungry = fixture();
    hungry.setMode('survival');
    hungry.setHunger(0);
    hungry.keys.KeyW = true;
    hungry.keys.ShiftLeft = true;
    hungry.movement.updateMovement(0.05);
    expect(Math.abs(sprinting.player.z)).toBeGreaterThan(Math.abs(hungry.player.z));
  });

  it('swims upward with Space and dives with Shift without fall damage', () => {
    const swimmer = fixture();
    swimmer.player.y = 3;
    swimmer.setWater(true);
    swimmer.keys.Space = true;
    swimmer.movement.updateMovement(0.05);
    expect(swimmer.player.vy).toBeGreaterThan(0);
    expect(swimmer.player.y).toBeGreaterThan(3);
    expect(swimmer.player.fallStart).toBeNull();

    const diver = fixture();
    diver.player.y = 3;
    diver.setWater(true);
    diver.keys.ShiftLeft = true;
    diver.movement.updateMovement(0.05);
    expect(diver.player.vy).toBeLessThan(0);
    expect(diver.player.y).toBeLessThan(3);
    expect(diver.player.fallStart).toBeNull();
  });

  it('does not move horizontally during the sleep animation', () => {
    const game = fixture();
    game.setSleeping(true);
    game.keys.KeyW = true;
    game.movement.updateMovement(0.05);
    expect(game.player.z).toBe(0);
  });

  it('preserves fall-damage thresholds when landing', () => {
    const game = fixture();
    game.player.fallStart = 7;
    game.player.vy = -4;
    game.movement.updateMovement(0.05);
    expect(game.damage).toEqual([3]);
    expect(game.player.fallStart).toBeNull();
  });
});
