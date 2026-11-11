import type { VisualSceneInput } from '../../src/game/testing/visual-fixture';

export interface SeededVisualScene {
  id: string;
  reason: string;
  catches: string;
  seed64: string;
  mobile: boolean;
  cameraMode: 'first-person';
  state: Omit<VisualSceneInput, 'seed'>;
}

/**
 * Small canonical matrix. Add camera/animation cases after #28/#36/#41
 * integrate a typed test-only view/pose bridge with semantic avatar checks.
 * A screenshot alone never proves that third-person mode rendered correctly.
 */
export const VISUAL_SCENES: readonly SeededVisualScene[] = [
  {
    id: 'overworld-v7-day-empty',
    mobile: false,
    cameraMode: 'first-person',
    reason: 'Original daylight surface and empty first-person hand',
    catches: 'Missing terrain, broken lighting, clipped idle hand',
    seed64: '677',
    state: {
      generatorVersion: 7,
      dimension: 'overworld',
      x: 40.5,
      y: 32,
      z: 40.5,
      yaw: 0.7,
      pitch: -0.15,
      mode: 'creative',
      difficulty: 'peaceful',
      selected: 0,
      heldItem: 0,
      timeOfDay: 0.21,
    },
  },
  {
    id: 'overworld-v7-day-held',
    mobile: false,
    cameraMode: 'first-person',
    reason: 'Selected stone block is shown in the first-person hotbar/hand',
    catches: 'Disconnected held item or missing hand model',
    seed64: '677',
    state: {
      generatorVersion: 7,
      dimension: 'overworld',
      x: 40.5,
      y: 32,
      z: 40.5,
      yaw: 0.7,
      pitch: -0.15,
      mode: 'creative',
      difficulty: 'peaceful',
      selected: 0,
      heldItem: 3,
      timeOfDay: 0.21,
    },
  },
  {
    id: 'nether-v7-biomes',
    mobile: false,
    cameraMode: 'first-person',
    reason: 'New deterministic Nether decoration and glowstone',
    catches: 'Lost biome foliage, empty scenery, black WebGL canvas',
    seed64: '677',
    state: {
      generatorVersion: 7,
      dimension: 'nether',
      x: 48.5,
      y: 27,
      z: 40.5,
      yaw: 0.55,
      pitch: -0.05,
      mode: 'creative',
      difficulty: 'peaceful',
      selected: 0,
      heldItem: 0,
      timeOfDay: 0.21,
    },
  },
  {
    id: 'nether-v6-legacy',
    mobile: false,
    cameraMode: 'first-person',
    reason: 'An older generator-v6 world retains its distinct terrain',
    catches: 'Silently upgrading legacy worlds to v7 decorations',
    seed64: '677',
    state: {
      generatorVersion: 6,
      dimension: 'nether',
      x: 48.5,
      y: 27,
      z: 40.5,
      yaw: 0.55,
      pitch: -0.05,
      mode: 'creative',
      difficulty: 'peaceful',
      selected: 0,
      heldItem: 0,
      timeOfDay: 0.21,
    },
  },
  {
    id: 'mobile-survival-hud-empty',
    mobile: true,
    cameraMode: 'first-person',
    reason: 'Portrait hearts, crosshair and empty hand remain readable',
    catches: 'Hearts covering text, crosshair/hotbar overlap, disconnected hand',
    seed64: '6041988',
    state: {
      generatorVersion: 7,
      dimension: 'overworld',
      x: 16.5,
      y: 35,
      z: 16.5,
      yaw: 0.35,
      pitch: -0.1,
      mode: 'survival',
      difficulty: 'peaceful',
      selected: 0,
      heldItem: 0,
      timeOfDay: 0.21,
    },
  },
  {
    id: 'mobile-survival-hud-held',
    mobile: true,
    cameraMode: 'first-person',
    reason: 'Portrait selected block, hand and survival hearts coexist',
    catches: 'Mobile held item hiding the hotbar or covering the crosshair',
    seed64: '6041988',
    state: {
      generatorVersion: 7,
      dimension: 'overworld',
      x: 16.5,
      y: 35,
      z: 16.5,
      yaw: 0.35,
      pitch: -0.1,
      mode: 'survival',
      difficulty: 'peaceful',
      selected: 0,
      heldItem: 3,
      timeOfDay: 0.21,
    },
  },
];
