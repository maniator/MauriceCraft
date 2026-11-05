import * as THREE from 'three';
import { bg, bm, part } from './mob-models';

function leg(g: THREE.Group, x: number, y: number, z: number, color: number, height = 0.7): void {
  const joint = new THREE.Group();
  joint.position.set(x, y, z);
  const mesh = new THREE.Mesh(bg(0.21, height, 0.21), bm(color));
  mesh.position.y = -height / 2;
  joint.add(mesh);
  g.add(joint);
  (g.userData.legs as THREE.Group[]).push(joint);
}
function piglinModel(zombified = false): THREE.Group {
  const g = new THREE.Group(); g.userData.legs = [];
  const skin = zombified ? 0x7eab73 : 0xe6ae8d;
  const torso = zombified ? 0x51734d : 0x62442f;
  leg(g, -0.18, 0.86, 0, torso, 0.86); leg(g, 0.18, 0.86, 0, torso, 0.86);
  part(g, 0.67, 0.84, 0.37, torso, 0, 1.28, 0);
  part(g, 0.59, 0.62, 0.55, skin, 0, 1.99, 0.02);
  for (const side of [-1, 1]) {
    part(g, 0.23, 0.48, 0.16, skin, side * 0.38, 2.16, 0.02);
    part(g, 0.18, 0.62, 0.18, skin, side * 0.45, 1.33, 0.1);
    part(g, 0.065, 0.075, 0.02, 0x20252a, side * 0.13, 2.05, 0.31);
  }
  part(g, 0.30, 0.20, 0.23, skin, 0, 1.9, 0.33);
  part(g, 0.08, 0.09, 0.025, 0x643a41, -0.08, 1.9, 0.46);
  part(g, 0.08, 0.09, 0.025, 0x643a41, 0.08, 1.9, 0.46);
  if (zombified) part(g, 0.30, 0.13, 0.04, 0x5b6b59, 0, 2.24, 0.26);
  else {
    part(g, 0.13, 0.68, 0.12, 0xd4ab36, 0.55, 1.27, 0.40);
    part(g, 0.32, 0.10, 0.10, 0xcdbb83, 0.55, 1.52, 0.40);
  }
  return g;
}
export const makePiglin = (): THREE.Group => piglinModel();
export const makeZombifiedPiglin = (): THREE.Group => piglinModel(true);

export function makeHoglin(): THREE.Group {
  const g = new THREE.Group(); g.userData.legs = [];
  part(g, 1.25, 1.0, 1.65, 0x9e4d43, 0, 1.12, -0.10);
  part(g, 0.88, 0.84, 0.66, 0xc26b5c, 0, 1.41, 0.89);
  part(g, 0.59, 0.27, 0.21, 0x8e3836, 0, 1.2, 1.23);
  for (const side of [-1, 1]) {
    part(g, 0.16, 0.49, 0.19, 0xeed8ae, side * 0.35, 1.4, 1.24);
    leg(g, side * 0.38, 0.67, 0.52, 0x874035);
    leg(g, side * 0.38, 0.67, -0.62, 0x874035);
  }
  part(g, 0.15, 0.30, 1.2, 0x6f2b2a, 0, 1.88, -0.05);
  return g;
}
export function makeMagmaCube(): THREE.Group {
  const g = new THREE.Group(); g.userData.legs = [];
  part(g, 0.92, 0.83, 0.92, 0x342529, 0, 0.51, 0);
  part(g, 0.81, 0.18, 0.82, 0xe5621b, 0, 0.47, 0.01);
  part(g, 0.23, 0.09, 0.04, 0xffa62a, -0.21, 0.68, 0.48);
  part(g, 0.23, 0.09, 0.04, 0xffa62a, 0.21, 0.68, 0.48);
  return g;
}
export function makeBlaze(): THREE.Group {
  const g = new THREE.Group(); g.userData.legs = [];
  part(g, 0.52, 0.52, 0.52, 0xdaba4a, 0, 1.28, 0);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8;
    part(g, 0.16, 0.68, 0.16, i % 2 ? 0xf2b640 : 0xf58228,
      Math.cos(a) * 0.64, 1.2 + Math.sin(a * 3) * 0.22, Math.sin(a) * 0.64);
  }
  part(g, 0.08, 0.1, 0.06, 0x24150e, -0.12, 1.32, 0.27);
  part(g, 0.08, 0.1, 0.06, 0x24150e, 0.12, 1.32, 0.27);
  return g;
}
export function makeGhast(): THREE.Group {
  const g = new THREE.Group(); g.userData.legs = [];
  part(g, 2.1, 2.1, 2.1, 0xdedfe0, 0, 2.22, 0);
  for (let n = -1; n <= 1; n++) for (let m = -1; m <= 1; m++)
    part(g, 0.16, 1.38, 0.16, 0xbfc1c5, n * 0.62, 0.54, m * 0.62);
  part(g, 0.24, 0.26, 0.04, 0x4c5863, -0.49, 2.34, 1.07);
  part(g, 0.24, 0.26, 0.04, 0x4c5863, 0.49, 2.34, 1.07);
  part(g, 0.26, 0.72, 0.04, 0x6e3947, 0, 1.85, 1.07);
  return g;
}
export function makeStrider(): THREE.Group {
  const g = new THREE.Group(); g.userData.legs = [];
  part(g, 0.94, 0.96, 0.8, 0xb84f3a, 0, 1.15, 0);
  part(g, 0.21, 0.10, 0.04, 0xdba858, -0.28, 1.37, 0.42);
  part(g, 0.21, 0.10, 0.04, 0xdba858, 0.28, 1.37, 0.42);
  leg(g, -0.28, 0.65, 0, 0x7b3d36, 0.65);
  leg(g, 0.28, 0.65, 0, 0x7b3d36, 0.65);
  return g;
}
export function makeWitherSkeleton(): THREE.Group {
  const g = new THREE.Group(); g.userData.legs = [];
  leg(g, -0.15, 0.97, 0, 0x25272a, 0.97);
  leg(g, 0.15, 0.97, 0, 0x25272a, 0.97);
  part(g, 0.45, 0.91, 0.24, 0x2d3031, 0, 1.47, 0);
  part(g, 0.49, 0.51, 0.45, 0x242629, 0, 2.09, 0);
  for (const side of [-1, 1]) part(g, 0.11, 0.72, 0.12, 0x343639, side * 0.34, 1.46, 0.08);
  part(g, 0.08, 0.07, 0.05, 0x9faaa9, -0.13, 2.13, 0.24);
  part(g, 0.08, 0.07, 0.05, 0x9faaa9, 0.13, 2.13, 0.24);
  return g;
}
