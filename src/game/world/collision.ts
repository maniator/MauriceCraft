/** Shared player and creature collision rules, independent of rendering. */
export interface MovableEntity {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  r?: number; h?: number;
  onGround?: boolean; hit?: boolean;
}
export interface CollisionDependencies {
  getBlock: (x: number, y: number, z: number) => number;
  solid: (block: number) => boolean;
  defaultRadius: number;
  defaultHeight: number;
  bedHeight: number;
}

export function createCollisionEngine(deps: CollisionDependencies) {
  const { getBlock, solid, defaultRadius: PR, defaultHeight: PH, bedHeight: BED_H } = deps;
  function collides(px: number, py: number, pz: number, r = PR, h = PH): boolean {
    const x0 = Math.floor(px - r), x1 = Math.floor(px + r);
    const y0 = Math.floor(py), y1 = Math.floor(py + h - 0.0001);
    const z0 = Math.floor(pz - r), z1 = Math.floor(pz + r);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const bb = getBlock(x, y, z);
      if (solid(bb)) {
        if (bb >= 19 && bb <= 26) {
          if (py < y + BED_H && py + h > y) return true;
        } else return true;
      }
    }
    return false;
  }
  /**
   * Step up onto a supported ledge when the player has opted in.
   * The target must have room for the whole body, including its head.
   */
  function tryStep(e: MovableEntity, axis: number, distance: number, maxStepY: number): boolean {
    const nx = e.x + (axis === 0 ? distance : 0);
    const nz = e.z + (axis === 2 ? distance : 0);
    const radius = e.r || PR, height = e.h || PH;
    const maxRise = Math.min(1.001, maxStepY - e.y);
    for (let increment = 1; increment <= 16; increment++) {
      const rise = increment / 16 + 0.001;
      if (rise > maxRise + 0.000001) break;
      const raisedY = e.y + rise;
      if (collides(e.x, raisedY, e.z, radius, height) ||
          collides(nx, raisedY, nz, radius, height)) continue;
      // The destination must actually be supported by the block we step onto.
      if (!collides(nx, raisedY - 0.02, nz, radius, height)) continue;
      e.x = nx; e.y = raisedY; e.z = nz;
      e.onGround = true;
      return true;
    }
    return false;
  }

  /** Move in small substeps, sliding right up to walls without tunnelling.
   * maxStepY is a per-frame ceiling, preventing two diagonal step-ups in one frame.
   */
  function moveEnt(e: MovableEntity, axis: number, d: number, maxStepY?: number): void {
    if (!d) return;
    const steps = Math.max(1, Math.ceil(Math.abs(d) / 0.25));
    const sd = d / steps;
    for (let i = 0; i < steps; i++) {
      const nx = e.x + (axis === 0 ? sd : 0), ny = e.y + (axis === 1 ? sd : 0), nz = e.z + (axis === 2 ? sd : 0);
      if (collides(nx, ny, nz, e.r || PR, e.h || PH)) {
        if (axis !== 1 && maxStepY !== undefined && maxStepY > e.y &&
            tryStep(e, axis, sd, maxStepY)) continue;
        let lo = 0, hi = 1;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          if (collides(e.x + (axis === 0 ? sd * mid : 0), e.y + (axis === 1 ? sd * mid : 0), e.z + (axis === 2 ? sd * mid : 0), e.r || PR, e.h || PH)) hi = mid; else lo = mid;
        }
        if (lo > 0) {
          if (axis === 0) e.x += sd * lo; else if (axis === 1) e.y += sd * lo; else e.z += sd * lo;
        }
        if (axis === 1) { if (sd < 0) e.onGround = true; e.vy = 0; }
        else { e.hit = true; if (axis === 0) e.vx = 0; else e.vz = 0; }
        return;
      }
      e.x = nx; e.y = ny; e.z = nz;
    }
  }
  return { collides, moveEnt };
}
