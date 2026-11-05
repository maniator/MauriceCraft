import { describe, expect, it } from 'vitest';
import { resolveManualChunk } from '../../src/build/manual-chunks';

describe('manual vendor chunking', () => {
  it('keeps Three.js in its own chunk', () => {
    const chunkName = resolveManualChunk('/repo/node_modules/three/build/three.module.js');
    expect(chunkName).toBe('vendor-three');
  });

  it('keeps Dexie in its own chunk', () => {
    const chunkName = resolveManualChunk('/repo/node_modules/dexie/dist/dexie.mjs');
    expect(chunkName).toBe('vendor-storage');
  });

  it('puts other dependencies in the shared vendor chunk', () => {
    const chunkName = resolveManualChunk('/repo/node_modules/some-lib/index.js');
    expect(chunkName).toBe('vendor');
  });

  it('leaves app code and virtual modules untouched', () => {
    expect(resolveManualChunk('/repo/src/game/bootstrap.ts')).toBeUndefined();
    expect(resolveManualChunk('\0vite/preload-helper.js')).toBeUndefined();
  });
});
