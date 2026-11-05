import { describe, expect, it } from 'vitest';
import { prepareImportedWorld, worldArchiveFilename } from '../../src/game/session/world-transfer';
import type { WorldArchive } from '../../src/game/storage/world-archive';
import type { WorldRecord } from '../../src/game/storage/world-storage';

const original: WorldRecord = { id: 'w1', name: 'Portal World', seed: 123,
  generatorVersion: 2, created: 1, lastPlayed: 2, portals: [{ dimension: 'end' }] };
const archive: WorldArchive = {
  world: original,
  chunks: [
    { w: 'w1', k: '', cx: 0, cz: 0, data: Uint8Array.of(7) },
    { w: 'w1', k: '', cx: -2, cz: 3, dimension: 'nether', data: Uint8Array.of(42) },
    { w: 'w1', k: '', cx: 2, cz: -3, dimension: 'end', data: Uint8Array.of(99) },
  ],
};
describe('safe world imports', () => {
  it('remaps every dimension key and preserves historical terrain and save data', () => {
    const result = prepareImportedWorld(archive, [original], 'new-uuid', 99);
    expect(result.world).toMatchObject({
      id: 'new-uuid', name: 'Portal World (imported)', seed: 123,
      generatorVersion: 2, portals: [{ dimension: 'end' }], created: 99,
    });
    expect(result.chunks.map(chunk => chunk.k)).toEqual([
      'new-uuid:0,0', 'new-uuid:nether:-2,3', 'new-uuid:end:2,-3',
    ]);
    expect(result.chunks.map(chunk => Array.from(chunk.data))).toEqual([[7], [42], [99]]);
    expect(original.id).toBe('w1');
  });

  it('keeps original name when available and disambiguates repeated imports', () => {
    const same = [{ ...original, name: 'Portal World (imported)' }, original];
    expect(prepareImportedWorld(archive, [], 'new').world.name).toBe('Portal World');
    expect(prepareImportedWorld(archive, same, 'other').world.name).toBe('Portal World (imported 2)');
    expect(() => prepareImportedWorld(archive, [original], 'w1')).toThrow(/unique/);
  });

  it('sanitizes download filenames', () => {
    expect(worldArchiveFilename('World / ?.')).toBe('World _ _.mcraft');
    expect(worldArchiveFilename('...')).toBe('MauriceCraft-world.mcraft');
  });
});
