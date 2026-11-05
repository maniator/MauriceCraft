import * as THREE from 'three';
import { raycastBlocks, type BlockReader, type Point3 } from '../world/raycast';

export type CameraViewMode = 'first-person' | 'third-person';

// Keep the boom independent of gaze pitch: looking upward would otherwise
// point the following camera down into terrain and inside the player mesh.
export function thirdPersonBoomDirection(yaw: number): Point3 {
  const len = Math.hypot(1, 0.2);
  return { x: Math.sin(yaw) / len, y: 0.2 / len, z: Math.cos(yaw) / len };
}

/** Keep the third-person camera on the player's side of walls and ceilings. */
export function unobstructedBoomDistance(
  eye: Point3,
  backward: Point3,
  desiredDistance: number,
  getBlock: BlockReader,
  solid: (blockId: number) => boolean,
  worldHeight: number,
): number {
  // The general-purpose block raycast hits water, torches, and other nonzero blocks.
  // Only camera-obstructing solid blocks may shorten the boom.
  const getObstruction: BlockReader = (x, y, z) => {
    const block = getBlock(x, y, z);
    return solid(block) ? block : 0;
  };
  const hit = raycastBlocks(eye, backward, desiredDistance, getObstruction, solid, worldHeight);
  // No forced minimum: a nearby wall must always win over the desired camera offset.
  return hit ? Math.max(0, hit.t - 0.15) : desiredDistance;
}

interface ViewDependencies {
  scene: THREE.Scene;
  camera: THREE.Camera;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  getBlock: BlockReader;
  solid: (blockId: number) => boolean;
  worldHeight: number;
  getMode: () => string;
  getSelectedItem: () => number;
  getItemCount: (itemId: number) => number;
  tileOf: (itemId: number) => number | undefined;
  atlasCanvas: HTMLCanvasElement;
}

/** Visual camera only. The gameplay tick aims and resolves actions from the player's eyes first. */
export function createThirdPersonView(deps: ViewDependencies) {
  let cameraMode: CameraViewMode = 'first-person';
  try {
    if (localStorage.getItem('mauricecraft-camera-view') === 'third-person')
      cameraMode = 'third-person';
  } catch {
    /* Private browsing can block storage; the view remains usable. */
  }
  const avatar = new THREE.Group();
  avatar.name = 'thirdPersonAvatar';
  avatar.visible = false;
  // Distinct colors on the six sides give the avatar readable 3D depth.
  // Use unlit materials: MauriceCraft deliberately has no Three.js scene lights.
  const shaded = (color: number): THREE.MeshBasicMaterial[] => {
    const base = new THREE.Color(color);
    return [0.8, 0.92, 1.06, 0.63, 0.91, 1.0].map(
      (intensity) => new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(intensity) }),
    );
  };
  const skin = shaded(0xbf8967);
  const sleeve = shaded(0x259caa);
  const pants = shaded(0x345479);
  const hair = shaded(0x48301d);
  const eyes = new THREE.MeshBasicMaterial({ color: 0x232e36 });
  function part(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material | THREE.Material[],
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    avatar.add(mesh);
    return mesh;
  }
  part(0.6, 0.72, 0.33, 0, 1.09, 0, sleeve);
  part(0.49, 0.49, 0.49, 0, 1.69, 0, skin);
  part(0.51, 0.16, 0.51, 0, 1.96, 0, hair);
  part(0.065, 0.065, 0.02, -0.12, 1.72, -0.255, eyes);
  part(0.065, 0.065, 0.02, 0.12, 1.72, -0.255, eyes);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.41, 1.4, 0);
  avatar.add(rightArm);
  const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.67, 0.27), skin);
  armMesh.position.y = -0.33;
  rightArm.add(armMesh);
  const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.28), sleeve);
  rightSleeve.position.y = -0.08;
  rightArm.add(rightSleeve);
  part(0.24, 0.67, 0.27, -0.42, 1.07, 0, skin);
  part(0.26, 0.24, 0.28, -0.42, 1.32, 0, sleeve);
  const leftLeg = part(0.27, 0.7, 0.29, -0.17, 0.35, 0, pants);
  const rightLeg = part(0.27, 0.7, 0.29, 0.17, 0.35, 0, pants);

  const itemSprite = document.createElement('canvas');
  itemSprite.width = itemSprite.height = 16;
  const itemContext = itemSprite.getContext('2d');
  if (!itemContext) throw new Error('Third-person held-item canvas unavailable');
  const heldItemContext: CanvasRenderingContext2D = itemContext;
  const itemTexture = new THREE.CanvasTexture(itemSprite);
  itemTexture.magFilter = THREE.NearestFilter;
  itemTexture.minFilter = THREE.NearestFilter;
  const itemMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshBasicMaterial({ map: itemTexture, transparent: true }),
  );
  itemMesh.position.set(0, -0.7, -0.19);
  rightArm.add(itemMesh);
  deps.scene.add(avatar);
  const backward = new THREE.Vector3();
  let previousDistance = 4;
  let previousItem = -1;
  let swingTime = 0;
  let walkTime = 0;
  let lastX = deps.player.x,
    lastZ = deps.player.z;
  const viewButton = document.getElementById('btnView');

  function syncButton(): void {
    if (!viewButton) return;
    const third = cameraMode === 'third-person';
    viewButton.textContent = third ? '1st Person' : '3rd Person';
    viewButton.setAttribute('aria-pressed', String(third));
    viewButton.setAttribute(
      'aria-label',
      third ? 'Switch to first-person view' : 'Switch to third-person view',
    );
  }
  function setMode(next: CameraViewMode): void {
    cameraMode = next;
    syncButton();
    if (next === 'first-person') avatar.visible = false;
    const hand = document.getElementById('heldHand');
    if (hand) hand.hidden = next === 'third-person' || deps.getMode() === 'spectator';
    try {
      localStorage.setItem('mauricecraft-camera-view', next);
    } catch {
      /* non-persistent mode */
    }
  }
  syncButton();

  function update(deltaSeconds: number): void {
    const third = cameraMode === 'third-person' && deps.getMode() !== 'spectator';
    if (!third) {
      avatar.visible = false;
      const hand = document.getElementById('heldHand');
      if (hand) hand.hidden = deps.getMode() === 'spectator';
      return;
    }

    const p = deps.player;
    avatar.position.set(p.x, p.y, p.z);
    avatar.rotation.y = p.yaw;
    const dx = p.x - lastX,
      dz = p.z - lastZ;
    const movement = Math.min(1, Math.hypot(dx, dz) / Math.max(deltaSeconds, 0.001) / 4);
    walkTime += Math.hypot(dx, dz) * 7;
    leftLeg.rotation.x = Math.sin(walkTime) * movement * 0.42;
    rightLeg.rotation.x = -leftLeg.rotation.x;
    lastX = p.x;
    lastZ = p.z;
    swingTime = Math.max(0, swingTime - deltaSeconds);
    rightArm.rotation.x =
      -0.12 - (swingTime > 0 ? Math.sin((1 - swingTime / 0.28) * Math.PI) * 1.2 : 0);

    const itemId = deps.getSelectedItem();
    const holding = itemId > 0 && (deps.getMode() !== 'survival' || deps.getItemCount(itemId) > 0);
    itemMesh.visible = holding;
    if (holding && previousItem !== itemId) {
      heldItemContext.clearRect(0, 0, 16, 16);
      heldItemContext.drawImage(
        deps.atlasCanvas,
        (deps.tileOf(itemId) ?? 0) * 16,
        0,
        16,
        16,
        0,
        0,
        16,
        16,
      );
      itemTexture.needsUpdate = true;
    }
    previousItem = holding ? itemId : -1;

    // Targeting was resolved from the eye in the gameplay tick. Move only
    // the rendering camera behind/above the avatar, not along its gaze pitch.
    const boom = thirdPersonBoomDirection(p.yaw);
    backward.set(boom.x, boom.y, boom.z);
    const eye = deps.camera.position;
    const allowed = unobstructedBoomDistance(
      eye,
      backward,
      4.1,
      deps.getBlock,
      deps.solid,
      deps.worldHeight,
    );
    // Snap in immediately at obstructions; move back smoothly when the wall clears.
    previousDistance = Math.min(allowed, previousDistance + deltaSeconds * 5);
    // Never put the viewpoint inside the avatar: near walls temporarily fall back
    // to an unobstructed first-person view until the follow camera fits again.
    const canShowAvatar = previousDistance >= 2.3;
    avatar.visible = canShowAvatar;
    const hand = document.getElementById('heldHand');
    if (hand) hand.hidden = canShowAvatar;
    if (canShowAvatar) eye.addScaledVector(backward, previousDistance);
  }

  return {
    get mode(): CameraViewMode {
      return cameraMode;
    },
    get isThirdPerson(): boolean {
      return cameraMode === 'third-person';
    },
    toggle: () => setMode(cameraMode === 'first-person' ? 'third-person' : 'first-person'),
    swing: () => {
      swingTime = 0.28;
    },
    update,
  };
}
