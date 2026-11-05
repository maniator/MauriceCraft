import { describe, expect, it } from 'vitest';
import { decodeWorldArchive, encodeWorldArchive } from '../../src/game/storage/world-archive';
import type { ChunkRecord, WorldRecord } from '../../src/game/storage/world-storage';
import { deriveWorldSeed32 } from '../../src/game/world/seed64';

const world: WorldRecord = {
  id: 'existing-world', name: 'My Nether Base', seed: 4294967295,
  seedText: 'a seed phrase', generatorVersion: 4, created: 100, lastPlayed: 200,
  portals: [{ x: 3, y: 12, z: 8, dimension: 'nether' }], inventory: { 7: 12 },
};
const blockChunk = (values: readonly number[]): Uint8Array => {
  const bytes = new Uint8Array(16 * 16 * 48);
  values.forEach((value, i) => { bytes[i] = value; });
  return bytes;
};
const chunks: ChunkRecord[] = [
  { k: 'existing-world:0,0', w: 'existing-world', cx: 0, cz: 0,
    data: blockChunk([2, 0, 255, 1]) },
  { k: 'existing-world:nether:0,0', w: 'existing-world', cx: 0, cz: 0,
    dimension: 'nether', data: blockChunk([255, 24, 1]) },
  { k: 'existing-world:end:-2,10', w: 'existing-world', cx: -2, cz: 10,
    dimension: 'end', data: blockChunk([7, 8]) },
];

describe('versioned binary world files', () => {
  it('round-trips metadata, arbitrary raw chunk bytes, and every dimension', () => {
    const encoded = encodeWorldArchive(world, chunks);
    expect(new TextDecoder().decode(encoded.subarray(0, 8))).toBe('MCWORLD1');
    const decoded = decodeWorldArchive(encoded);
    expect(decoded.world).toEqual(world);
    const comparable = (entries: readonly ChunkRecord[]) =>
      entries.map(chunk => ({
        w: chunk.w, cx: chunk.cx, cz: chunk.cz,
        dimension: chunk.dimension, data: Array.from(chunk.data),
      }));
    expect(comparable(decoded.chunks)).toEqual(comparable(chunks));
  });

  it('preserves legacy negative signed 32-bit seeds without changing their terrain', () => {
    const legacy = { ...world, seed: -123456, generatorVersion: undefined };
    expect(decodeWorldArchive(encodeWorldArchive(legacy, chunks)).world.seed).toBe(-123456);
  });

  it('preserves full 64-bit seeds and rejects mismatched derived terrain streams', () => {
    const seed64 = '18446744073709551615';
    const v5 = { ...world, generatorVersion: 5, seed64, seed: deriveWorldSeed32(seed64, 'terrain') };
    expect(decodeWorldArchive(encodeWorldArchive(v5, chunks)).world).toEqual(v5);
    expect(() => encodeWorldArchive({ ...v5, seed: v5.seed ^ 1 }, chunks))
      .toThrow(/seed metadata/);
    expect(() => encodeWorldArchive({ ...v5, seed64: '18446744073709551616' }, chunks))
      .toThrow(/seed metadata/);
    expect(() => encodeWorldArchive({ ...v5, seed64: undefined }, chunks))
      .toThrow(/64-bit seed/);
  });

  it('can move empty worlds without losing generation settings', () => {
    expect(decodeWorldArchive(encodeWorldArchive(world, [])).world).toEqual(world);
  });

  it('rejects corruption, truncation, wrong versions and unrelated files', () => {
    const valid = encodeWorldArchive(world, chunks);
    const damaged = valid.slice(); damaged[40] ^= 0xff;
    expect(() => decodeWorldArchive(damaged)).toThrow(/checksum/);
    expect(() => decodeWorldArchive(valid.slice(0, -10))).toThrow();
    const version = valid.slice(); version[8] = 2;
    expect(() => decodeWorldArchive(version)).toThrow(/version/);
    expect(() => decodeWorldArchive(new TextEncoder().encode('not a game save')))
      .toThrow();
  });

  it('rejects malformed restoration fields rather than importing an unloadable world', () => {
    for (const invalid of [
      { relics: {} },
      { relics: [{ x: 1, y: 2, z: 3, got: 'yes' }] },
      { golems: {} },
      { player: { x: 0, y: 10, z: 0 } },
      { inv: ['not a numeric record'] },
      { hotbar: [1, 2] },
      { weather: { w: 'clear', t: {}, r: 0 } },
    ]) {
      expect(() => encodeWorldArchive({ ...world, ...invalid }, chunks))
        .toThrow(/gameplay metadata/);
    }
  });

  it('rejects undersized saved chunks before they can corrupt gameplay', () => {
    expect(() => encodeWorldArchive(world, [
      { ...chunks[0], data: Uint8Array.of(1) },
    ])).toThrow(/invalid chunk/);
    const valid = encodeWorldArchive(world, chunks);
    const corruptedSize = valid.slice();
    const offset = 20 + new TextEncoder().encode(JSON.stringify(world)).length;
    new DataView(corruptedSize.buffer).setUint32(offset + 9, 1, true);
    // Checksum validation happens first, then fixed-size chunk validation.
    expect(() => decodeWorldArchive(corruptedSize)).toThrow(/checksum/);
  });

  it('preserves populated gameplay state while validating typed restoration data', () => {
    const populated: WorldRecord = {
      ...world, dimension: 'nether', mode: 'survival', difficulty: 'hard',
      enderDragonDefeated: false, omen: false,
      player: { x: 1, y: 64, z: 2, yaw: 0.5, pitch: -0.25, fly: false },
      spawn: { x: 1, y: 70, z: 2 },
      inv: { '3': 24 }, toolWear: { '14': 2 },
      hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      craftedRecipes: ['wooden_pickaxe'], selected: 2,
      tod: 13000, hp: 18, hunger: 17, sat: 3,
      weather: { w: 'rain', t: 20, r: 1 },
      relics: [{ x: 2, y: 20, z: 3, got: false }],
      golems: [{ x: 3, y: 50, z: 4, kind: 'iron', hp: 100, hx: 0, hz: 0 }],
      itemDrops: [{ x: 1, y: 50, z: 1, id: 3, count: 2, dimension: 'nether', age: 5 }],
    };
    expect(decodeWorldArchive(encodeWorldArchive(populated, chunks)).world).toEqual(populated);
    for (const invalid of [
      { relics: [{ x: 2, y: 20, z: 3, got: 1 }] },
      { golems: [{ x: 3, y: 50, z: 4, kind: 'iron', hp: 'full', hx: 0, hz: 0 }] },
      { itemDrops: [{ x: 1, y: 50, z: 1, id: 3, count: -1, dimension: 'nether', age: 5 }] },
      { dimension: 'not-a-dimension' },
      { selected: 12 },
      { craftedRecipes: [42] },
      { spawn: { x: 1, y: 'invalid', z: 2 } },
    ]) {
      expect(() => encodeWorldArchive({ ...populated, ...invalid }, chunks))
        .toThrow(/gameplay metadata/);
    }
  });

  it('does not accept duplicate chunk coordinates or invalid metadata', () => {
    expect(() => encodeWorldArchive(world, [...chunks, chunks[0]])).toThrow(/Duplicate/);
    expect(() => encodeWorldArchive({ ...world, seed: -2147483649 }, chunks)).toThrow(/metadata/);
    expect(() => encodeWorldArchive({ ...world, id: '' }, chunks)).toThrow(/metadata/);
  });
});
