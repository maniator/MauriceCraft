import { describe, expect, it } from 'vitest';
import { createInputControls, type InputControlState } from '../../src/game/input/game-controls';

describe('mobile world interactions', () => {
  it('routes a tap to use/place rather than the mining/attack action', () => {
    const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const windowBefore = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const canvasListeners = new Map<string, (event: unknown) => void>();
    const windowListeners = new Map<string, (event: unknown) => void>();
    const canvas = {
      addEventListener: (name: string, listener: (event: unknown) => void) => {
        canvasListeners.set(name, listener);
      },
    } as unknown as HTMLCanvasElement;
    const button = { addEventListener: () => undefined };
    Object.defineProperty(globalThis, 'document', {
      configurable: true, value: { getElementById: () => button },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true, value: { innerWidth: 800,
        addEventListener: (name: string, listener: (event: unknown) => void) => windowListeners.set(name, listener) },
    });

    const state: InputControlState = {
      playing: true, locked: false, fallback: false, selected: 0, specSpeed: 1,
      mining: false, placing: false, pulseMine: false, pulsePlace: false,
      mineCd: 0, placeCd: 0, drag: null, stick: null, lookT: null, touchJump: false,
    };
    const touch = { identifier: 3, clientX: 600, clientY: 180 };
    const event = { changedTouches: [touch], preventDefault: () => undefined };
    try {
      createInputControls({
        canvas, keys: {}, touchMove: { x: 0, z: 0 },
        player: { yaw: 0, pitch: 0, fly: false, vy: 0 },
        state, isTouch: true, getMode: () => 'survival', canInteract: () => true,
        updateHotbar: () => undefined, showHint: () => undefined,
        openInventory: () => undefined, openCommand: () => undefined,
        pause: () => undefined,
      });
      const start = canvasListeners.get('touchstart');
      const end = canvasListeners.get('touchend');
      expect(start).toBeDefined();
      expect(end).toBeDefined();
      start!(event);
      end!(event);
      expect(state.pulsePlace).toBe(true);
      expect(state.pulseMine).toBe(false);

      state.pulsePlace = false;
      start!(event);
      if (!state.lookT) throw new Error('Expected an active look gesture');
      state.lookT.t0 = performance.now() - 500;
      end!(event);
      expect(state.pulsePlace).toBe(false);
      expect(state.pulseMine).toBe(false);

      const mouseDown = canvasListeners.get('mousedown');
      const mouseUp = windowListeners.get('mouseup');
      expect(mouseDown).toBeDefined();
      expect(mouseUp).toBeDefined();
      mouseDown!({ button: 1, ctrlKey: false, metaKey: false, altKey: false });
      mouseUp!({});
      expect(state.drag).toBeNull();
      expect(state.pulseMine).toBe(false);
      expect(state.pulsePlace).toBe(false);

      mouseDown!({ button: 2, ctrlKey: false, metaKey: false, altKey: false });
      mouseUp!({});
      expect(state.pulsePlace).toBe(true);
      expect(state.pulseMine).toBe(false);
    } finally {
      if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore);
      else delete (globalThis as { document?: Document }).document;
      if (windowBefore) Object.defineProperty(globalThis, 'window', windowBefore);
      else delete (globalThis as { window?: Window }).window;
    }
  });
});
