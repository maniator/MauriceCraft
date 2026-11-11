import * as THREE from 'three';
import { ckey } from '../world/chunk-key';
import { installVisualFixture, type VisualPlayer } from './visual-fixture';

/** Keep all visual-test wiring outside bootstrap's 500-line production limit. */
interface VisualBootstrapDependencies {
  gameState: {
    ready: boolean;
    mode: 'creative' | 'survival' | 'adventure' | 'spectator';
    difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
    selected: number;
    tod: number;
  };
  player: VisualPlayer;
  hotbar: number[];
  inv: Record<number, number>;
  chunks: Map<number, { cx: number; cz: number; meshed?: boolean }>;
  setMode: (mode: 'creative' | 'survival') => void;
  setDifficulty: (difficulty: 'peaceful' | 'normal') => void;
  setWeather: (weather: 'clear') => void;
  changeDimension: (dimension: 'overworld' | 'nether') => void;
  ensureAround: (x: number, z: number) => void;
  streamChunks: () => void;
  updateHotbar: (showName: boolean) => void;
  daylight: (seconds: number) => void;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  eyeHeight: number;
  getSeed: () => number;
  getVersion: () => number;
  getDimension: () => 'overworld' | 'nether' | 'end';
  getFrozen: () => boolean;
  setFrozen: (value: boolean) => void;
}

/** Only imported when Vite MODE is visual-test, never in production builds. */
export function attachVisualBootstrap(deps: VisualBootstrapDependencies): void {
  const { gameState, player, camera, scene, renderer } = deps;
  installVisualFixture({
    isReady: () => gameState.ready,
    getSeed: deps.getSeed,
    getGeneratorVersion: deps.getVersion,
    getDimension: deps.getDimension,
    getPlayer: () => player,
    getMode: () => gameState.mode,
    setMode: deps.setMode,
    getDifficulty: () => gameState.difficulty,
    setDifficulty: deps.setDifficulty,
    inventory: deps.inv,
    getSelected: () => gameState.selected,
    setSelected: (slot) => {
      gameState.selected = slot;
    },
    hotbar: deps.hotbar,
    getTimeOfDay: () => gameState.tod,
    setTimeOfDay: (value) => {
      gameState.tod = value;
      deps.daylight(0);
    },
    setWeatherClear: () => deps.setWeather('clear'),
    changeDimension: deps.changeDimension,
    ensureAround: deps.ensureAround,
    streamChunks: deps.streamChunks,
    positionCamera: (x, y, z, pitch, yaw) => {
      camera.position.set(x, y + deps.eyeHeight, z);
      camera.rotation.set(pitch, yaw, 0);
      camera.updateMatrixWorld(true);
    },
    setFrozen: deps.setFrozen,
    isFrozen: deps.getFrozen,
    isSceneSettled: () => {
      const cx = Math.floor(player.x / 16),
        cz = Math.floor(player.z / 16);
      // The chunk streamer meshes only two chunks per frame. Waiting for
      // the actual 11x11 visible region avoids capture timing races.
      for (let dz = -5; dz <= 5; dz++)
        for (let dx = -5; dx <= 5; dx++) {
          if (!deps.chunks.get(ckey(cx + dx, cz + dz))?.meshed) return false;
        }
      const hint = document.getElementById('hint');
      return !hint || getComputedStyle(hint).display === 'none';
    },
    updateHotbar: () => deps.updateHotbar(false),
    getSceneMetrics: () => {
      // Render and sample the actual framebuffer in the same JS task. The
      // drawing buffer can be discarded after compositing, so sampling it
      // later from the test page would falsely report an empty scene.
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      // Two 1-pixel rows cost two GPU readbacks rather than 25 individual
      // synchronous stalls, while sampling across the actual scene width.
      const width = gl.drawingBufferWidth;
      const pixels = new Uint8Array(width * 4),
        colors = new Set<string>();
      let brightness = 0,
        samples = 0;
      for (const v of [0.25, 0.75]) {
        gl.readPixels(
          0,
          Math.floor(gl.drawingBufferHeight * v),
          width,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 20))) {
          const i = x * 4;
          colors.add(pixels[i] + ',' + pixels[i + 1] + ',' + pixels[i + 2]);
          brightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          samples++;
        }
      }
      let meshes = 0;
      scene.traverse((object) => {
        if (object.visible && object instanceof THREE.Mesh) meshes++;
      });
      return {
        triangles: renderer.info.render.triangles,
        meshes,
        distinctPixels: colors.size,
        brightness: brightness / samples,
      };
    },
  });
}
