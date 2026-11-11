/**
 * Test-build-only gameplay fixture. The normal production build tree-shakes
 * this module away; never expose this handle in deployed MauriceCraft.
 */
export interface VisualPlayer {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
  fly: boolean;
  fallStart: number | null;
}
export interface VisualSceneInput {
  seed: number;
  generatorVersion: number;
  dimension: 'overworld' | 'nether';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  mode: 'creative' | 'survival';
  difficulty: 'peaceful' | 'normal';
  selected: number;
  heldItem: number;
  timeOfDay: number;
}
export interface VisualSceneState extends VisualSceneInput {
  ready: boolean;
  frozen: boolean;
  renderedTriangles: number;
  visibleWorldMeshes: number;
  distinctPixelSamples: number;
  averageBrightness: number;
}
interface VisualFixtureDeps {
  isReady: () => boolean;
  getSeed: () => number;
  getGeneratorVersion: () => number;
  getDimension: () => string;
  getPlayer: () => VisualPlayer;
  getMode: () => 'creative' | 'survival' | 'adventure' | 'spectator';
  setMode: (mode: 'creative' | 'survival') => void;
  getDifficulty: () => 'peaceful' | 'easy' | 'normal' | 'hard';
  setDifficulty: (difficulty: 'peaceful' | 'normal') => void;
  inventory: Record<number, number>;
  getSelected: () => number;
  setSelected: (slot: number) => void;
  hotbar: number[];
  getTimeOfDay: () => number;
  setTimeOfDay: (time: number) => void;
  setWeatherClear: () => void;
  changeDimension: (dimension: 'overworld' | 'nether') => void;
  ensureAround: (x: number, z: number) => void;
  streamChunks: () => void;
  positionCamera: (x: number, y: number, z: number, pitch: number, yaw: number) => void;
  setFrozen: (frozen: boolean) => void;
  isFrozen: () => boolean;
  updateHotbar: () => void;
  getSceneMetrics: () => {
    triangles: number;
    meshes: number;
    distinctPixels: number;
    brightness: number;
  };
  isSceneSettled: () => boolean;
}
export interface VisualFixture {
  configure: (scene: VisualSceneInput) => VisualSceneState;
  snapshot: () => VisualSceneState;
  isSceneSettled: () => boolean;
}

/** Called only behind import.meta.env.MODE === 'visual-test' in bootstrap. */
export function installVisualFixture(deps: VisualFixtureDeps): void {
  let expected: VisualSceneInput | null = null;
  const snapshot = (): VisualSceneState => {
    if (!expected) throw new Error('Configure a seeded visual scene before capture');
    const player = deps.getPlayer();
    const metrics = deps.getSceneMetrics();
    return {
      seed: deps.getSeed(),
      generatorVersion: deps.getGeneratorVersion(),
      dimension: deps.getDimension() as VisualSceneInput['dimension'],
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: player.yaw,
      pitch: player.pitch,
      mode: deps.getMode() as VisualSceneInput['mode'],
      difficulty: deps.getDifficulty() as VisualSceneInput['difficulty'],
      selected: deps.getSelected(),
      heldItem: deps.hotbar[deps.getSelected()] ?? 0,
      timeOfDay: deps.getTimeOfDay(),
      ready: deps.isReady(),
      frozen: deps.isFrozen(),
      renderedTriangles: metrics.triangles,
      visibleWorldMeshes: metrics.meshes,
      distinctPixelSamples: metrics.distinctPixels,
      averageBrightness: metrics.brightness,
    };
  };
  const configure = (input: VisualSceneInput): VisualSceneState => {
    if (!deps.isReady()) throw new Error('World not fully loaded');
    if (input.generatorVersion !== deps.getGeneratorVersion() || input.seed !== deps.getSeed()) {
      throw new Error('Seed or terrain generator mismatch: refusing to capture wrong world');
    }
    if (
      !Number.isInteger(input.selected) ||
      input.selected < 0 ||
      input.selected > 8 ||
      !Number.isInteger(input.heldItem) ||
      input.heldItem < 0 ||
      ![input.x, input.y, input.z, input.yaw, input.pitch, input.timeOfDay].every(
        Number.isFinite,
      ) ||
      input.timeOfDay < 0 ||
      input.timeOfDay >= 1
    ) {
      throw new Error('Invalid deterministic visual-scene configuration');
    }
    deps.setFrozen(true);
    deps.setMode(input.mode);
    deps.setDifficulty(input.difficulty);
    deps.changeDimension(input.dimension);
    const player = deps.getPlayer();
    player.x = input.x;
    player.y = input.y;
    player.z = input.z;
    player.yaw = input.yaw;
    player.pitch = input.pitch;
    player.vx = player.vy = player.vz = 0;
    player.fly = true;
    player.fallStart = null;
    deps.setSelected(input.selected);
    deps.hotbar[input.selected] = input.heldItem;
    if (input.heldItem > 0) deps.inventory[input.heldItem] = 1;
    deps.updateHotbar();
    deps.setTimeOfDay(input.timeOfDay);
    deps.setWeatherClear();
    deps.ensureAround(player.x, player.z);
    deps.streamChunks();
    deps.positionCamera(player.x, player.y, player.z, player.pitch, player.yaw);
    expected = { ...input };
    return snapshot();
  };
  const fixture: VisualFixture = { configure, snapshot, isSceneSettled: deps.isSceneSettled };
  Object.defineProperty(window, '__mauriceVisual', {
    configurable: false,
    enumerable: false,
    value: fixture,
    writable: false,
  });
}
