import { describe, expect, it } from 'vitest';
import { createBlockCatalog } from '../../src/game/world/block-catalog';
import { createBlockAccess } from '../../src/game/world/block-access';
import { ckey } from '../../src/game/world/chunk-key';
import {
  WALL_TORCH_EAST,
  WALL_TORCH_WEST,
  WALL_TORCH_SOUTH,
  WALL_TORCH_NORTH,
  isTorchBlock,
  wallTorchSupport,
  torchBlockForFace,
} from '../../src/game/world/torch-attachments';

describe('persistent torch attachments', () => {
  it.each([
    [1, 0, 0, WALL_TORCH_WEST, -1, 0],
    [-1, 0, 0, WALL_TORCH_EAST, 1, 0],
    [0, 0, 1, WALL_TORCH_NORTH, 0, -1],
    [0, 0, -1, WALL_TORCH_SOUTH, 0, 1],
  ])('records the supporting wall for horizontal face (%i, %i, %i)', (nx, ny, nz, id, dx, dz) => {
    expect(torchBlockForFace(nx, ny, nz)).toBe(id);
    expect(wallTorchSupport(id)).toEqual([dx, dz]);
    expect(isTorchBlock(id)).toBe(true);
  });

  it('keeps floor torch ID 17 and disallows ceilings', () => {
    expect(torchBlockForFace(0, 1, 0)).toBe(17);
    expect(torchBlockForFace(0, -1, 0)).toBeNull();
    expect(wallTorchSupport(17)).toBeNull();
    expect(isTorchBlock(17)).toBe(true);
    expect(isTorchBlock(3)).toBe(false);
  });

  it('does not consume extra block IDs in the player inventory', () => {
    const c = createBlockCatalog();
    for (const blockId of [WALL_TORCH_EAST, WALL_TORCH_WEST, WALL_TORCH_SOUTH, WALL_TORCH_NORTH]) {
      expect(c.solid(blockId)).toBe(false);
      expect(c.opq(blockId)).toBe(false);
      expect(c.DROPS[blockId]).toBe(c.TORCH);
      expect(c.BREAK_TIME[blockId]).toBe(c.BREAK_TIME[c.TORCH]);
      expect(c.NAMES[blockId]).toBe('Torch');
      expect(c.ALL_BLOCKS).not.toContain(blockId);
    }
  });

  it('stores orientation in the same byte-based chunk save format', () => {
    const bytes = new Uint8Array(16 * 16 * 48);
    const chunk = {
      cx: 0,
      cz: 0,
      data: bytes,
      meshed: false,
      dirty: false,
      edited: false,
    };
    const chunks = new Map([[ckey(0, 0), chunk]]);
    const world = createBlockAccess(chunks, 48);
    for (let i = 0; i < 4; i++) {
      world.setBlock(i + 1, 12, 1, WALL_TORCH_EAST + i);
    }
    expect(chunk.dirty).toBe(true);
    const reloaded = new Map([
      [
        ckey(0, 0),
        {
          ...chunk,
          data: chunk.data.slice(),
          dirty: false,
          edited: true,
        },
      ],
    ]);
    const restore = createBlockAccess(reloaded, 48);
    for (let i = 0; i < 4; i++) {
      expect(restore.getBlock(i + 1, 12, 1)).toBe(WALL_TORCH_EAST + i);
    }
  });
});
