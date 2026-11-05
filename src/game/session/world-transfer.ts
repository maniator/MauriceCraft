import type { WorldArchive } from '../storage/world-archive';
import type { ChunkRecord, WorldRecord } from '../storage/world-storage';
import { chunkDimension, savedChunkKey } from './dimension-chunk-records';

export interface PreparedImport {
  world: WorldRecord;
  chunks: ChunkRecord[];
}

/** Import always creates a new stable identity and never replaces local worlds. */
export function prepareImportedWorld(
  archive: WorldArchive, existing: readonly WorldRecord[], newId: string, now = Date.now(),
): PreparedImport {
  if (!newId || newId.includes(':') || existing.some(world => world.id === newId)) {
    throw new Error('Unable to create a unique imported world ID.');
  }
  const names = new Set(existing.map(world => world.name));
  const base = archive.world.name;
  let name = base;
  if (names.has(name)) {
    name = base + ' (imported)';
    for (let number = 2; names.has(name); number++) name = base + ' (imported ' + number + ')';
  }
  const world: WorldRecord = {
    ...archive.world, id: newId, name, created: now, lastPlayed: now,
  };
  const chunks = archive.chunks.map(chunk => {
    const dimension = chunkDimension({ ...chunk, w: archive.world.id,
      k: savedChunkKey(archive.world.id, chunk.dimension ?? 'overworld', chunk.cx, chunk.cz) });
    return {
      ...chunk, w: newId,
      k: savedChunkKey(newId, dimension, chunk.cx, chunk.cz),
      data: chunk.data.slice(),
    };
  });
  return { world, chunks };
}

/** Avoid exporting unsafe filenames supplied from imported world metadata. */
export function worldArchiveFilename(name: string): string {
  const safe = name.replace(/[^\p{L}\p{N} _.-]/gu, '_').trim().replace(/^\.+/, '').replace(/[. ]+$/, '').slice(0, 90);
  return (safe || 'MauriceCraft-world') + '.mcraft';
}
