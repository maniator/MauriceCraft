/**
 * Wall torch variants use unused persistent block IDs. Unlike a transient mesh
 * direction, the supporting face survives save/reload and chunk streaming.
 *
 * These are block states, not backpack items: all four break back into Torch.
 */
export const WALL_TORCH_EAST = 57;
export const WALL_TORCH_WEST = 58;
export const WALL_TORCH_SOUTH = 59;
export const WALL_TORCH_NORTH = 60;

/** The solid block supporting this torch, relative to the torch position. */
export function wallTorchSupport(id: number): readonly [dx: number, dz: number] | null {
  switch (id) {
    case WALL_TORCH_EAST: return [1, 0];
    case WALL_TORCH_WEST: return [-1, 0];
    case WALL_TORCH_SOUTH: return [0, 1];
    case WALL_TORCH_NORTH: return [0, -1];
    default: return null;
  }
}

export function isWallTorch(id: number): boolean {
  return id >= WALL_TORCH_EAST && id <= WALL_TORCH_NORTH;
}

/** An ordinary floor torch is still id 17. Ceiling placement is unsupported. */
export function torchBlockForFace(nx: number, ny: number, nz: number, torchId = 17): number | null {
  if (ny > 0) return torchId;
  if (ny < 0) return null;
  if (nx > 0) return WALL_TORCH_WEST;
  if (nx < 0) return WALL_TORCH_EAST;
  if (nz > 0) return WALL_TORCH_NORTH;
  if (nz < 0) return WALL_TORCH_SOUTH;
  return null;
}

export function isTorchBlock(id: number, torchId = 17): boolean {
  return id === torchId || isWallTorch(id);
}
