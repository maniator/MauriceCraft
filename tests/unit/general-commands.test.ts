import { describe, expect, it, vi } from 'vitest';
import { registerGeneralCommands, type GeneralCommandsDependencies } from '../../src/game/commands/general-commands';
import type { SpawnMob } from '../../src/game/entities/mob-spawning';

function fixture() {
  const commands = new Map<string, (args: string[]) => string | void>();
  const metadata: Record<string, { name: string; usage: string; desc: string }> = {};
  const mobs: SpawnMob[] = [];
  let dimension: 'overworld' | 'nether' | 'end' = 'overworld';
  let health = 20;
  const saveWorld = vi.fn(async () => undefined);
  const changeDimension = vi.fn((next: 'overworld' | 'nether' | 'end') => { dimension = next; });
  const buildPortalFrame = vi.fn((where: 'overworld' | 'nether', x: number, y: number, z: number) => ({
    x: where === 'nether' ? x + 1 : x, y, z,
  }));
  const addMob = vi.fn((kind: string, x: number, y: number, z: number): SpawnMob => {
    const mob = { kind, x, y, z, hostile: kind === 'zombie', golem: false, persist: false, hx: 0, hz: 0 } as SpawnMob;
    mobs.push(mob);
    return mob;
  });
  const removeMobAt = vi.fn((i: number) => { mobs.splice(i, 1); });
  const damagePlayer = vi.fn();
  const deps: GeneralCommandsDependencies = {
    register: (aliases, usage, desc, handler) => {
      for (const alias of aliases) {
        commands.set(alias, handler);
        metadata[alias] = { name: aliases[0], usage, desc };
      }
    },
    commands: metadata,
    player: { x: 0, y: 10, z: 0, yaw: 0 }, maxHeight: 48,
    getDimension: () => dimension, buildPortalFrame, changeDimension,
    saveWorld, refreshWorlds: vi.fn(), isStorageAvailable: () => true,
    slug: name => name.toLowerCase().replace(/[^a-z]/g, ''),
    mobs, kinds: {
      zombie: { r: 0.3, h: 1.8, hostile: true },
      villager: { r: 0.3, h: 1.95 },
      magma_cube: { r: 0.46, h: 0.85, hostile: true },
      zombified_piglin: { r: 0.32, h: 2.1 },
      wither_skeleton: { r: 0.3, h: 2.25, hostile: true },
    },
    jobs: ['farmer'], getDifficultyCap: () => 8, hasHealth: () => true,
    setHealth: value => { health = value; }, damagePlayer,
    spawnSpot: () => [2, 3, 4],
    getOrGenerateChunk: vi.fn(), topY: () => 2, collides: () => false,
    addMob, removeMobAt,
  };
  registerGeneralCommands(deps);
  const run = (name: string, args: string[] = []) => {
    const cmd = commands.get(name);
    if (!cmd) throw new Error('Missing command: ' + name);
    return cmd(args);
  };
  return { run, metadata, mobs, saveWorld, buildPortalFrame, changeDimension,
    addMob, damagePlayer, removeMobAt,
    setDimension: (value: typeof dimension) => { dimension = value; },
    getHealth: () => health };
}

describe('general game commands', () => {
  it('preserves help aliases and lists registered commands without duplicate aliases', () => {
    const f = fixture();
    expect(f.run('?')).toContain('/portal');
    expect(f.run('help', ['portal'])).toContain('/portal [build]');
    expect(f.metadata.dim.name).toBe('dimension');
    expect(f.metadata.summon.name).toBe('spawn');
  });

  it('builds an obsidian frame and blocks portals in the End', () => {
    const f = fixture();
    expect(f.run('portal', ['build'])).toContain('Built an obsidian Nether portal frame');
    expect(f.buildPortalFrame).toHaveBeenCalledWith('overworld', 0, 9, -3);
    expect(f.saveWorld).toHaveBeenCalled();
    f.setDimension('end');
    expect(() => f.run('portal', ['build'])).toThrow(/do not work in the End/);
  });

  it('preserves dimension aliases, validation and already-there handling', () => {
    const f = fixture();
    expect(f.run('dim', ['overworld'])).toBe('You are already in the overworld.');
    expect(f.run('dimension', ['nether'])).toBe('Entered the nether.');
    expect(f.changeDimension).toHaveBeenCalledWith('nether');
    expect(() => f.run('dim', ['moon'])).toThrow(/Usage: \/dimension/);
  });

  it('spawns and removes creatures with the same aliases and filters', () => {
    const f = fixture();
    expect(f.run('summon', ['zombie'])).toBe('Spawned 1 zombie');
    expect(f.addMob).toHaveBeenCalledOnce();
    expect(f.run('kill', ['hostile'])).toBe('Removed 1 creature');
    expect(f.mobs).toHaveLength(0);
    expect(f.removeMobAt).toHaveBeenCalledWith(0);
  });

  it('resolves underscored Nether creature commands to canonical mob IDs', () => {
    const f = fixture();
    expect(f.run('spawn', ['magma_cube'])).toBe('Spawned 1 magma_cube');
    expect(f.run('summon', ['zombified_piglin'])).toBe('Spawned 1 zombified_piglin');
    expect(f.run('spawn', ['wither_skeleton'])).toBe('Spawned 1 wither_skeleton');
    expect(f.addMob.mock.calls.map(call => call[0]))
      .toEqual(['magma_cube', 'zombified_piglin', 'wither_skeleton']);

    // Short and alternate spelling still resolve without dropping underscores.
    expect(f.run('spawn', ['magma-cube'])).toBe('Spawned 1 magma_cube');
    expect(f.run('spawn', ['wither_skel'])).toBe('Spawned 1 wither_skeleton');
    expect(f.run('spawn', ['zom'])).toBe('Spawned 1 zombie');
    expect(f.addMob.mock.calls.slice(-3).map(call => call[0]))
      .toEqual(['magma_cube', 'wither_skeleton', 'zombie']);
  });

  it('handles kill self, save and chat without changing commands', () => {
    const f = fixture();
    expect(f.run('kill', ['me'])).toBe('Ouch.');
    expect(f.getHealth()).toBe(1);
    expect(f.damagePlayer).toHaveBeenCalledWith(1);
    expect(f.run('save')).toBe('Saving the world...');
    expect(f.saveWorld).toHaveBeenCalledOnce();
    expect(f.run('say', ['hello', 'there'])).toBe('[You] hello there');
  });
});
