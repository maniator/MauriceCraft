import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deriveWorldSeed32 } from '../../src/game/world/seed64';
import type { VisualFixture, VisualSceneInput } from '../../src/game/testing/visual-fixture';
import { VISUAL_SCENES, type SeededVisualScene } from '../e2e/visual-scenes';

type FixtureWindow = Window & { __mauriceVisual?: VisualFixture };

async function seedIsolatedWorld(page: Page, scene: SeededVisualScene): Promise<number> {
  await page.goto('./');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 30_000 });
  const seed = deriveWorldSeed32(scene.seed64, 'terrain');
  // This context belongs only to this Playwright test. No real player storage is
  // touched. Add a clean world record rather than changing a saved world's
  // generator version (which would produce a terrain-version mismatch).
  const record = {
    id: 'visual-' + scene.id,
    name: 'Visual ' + scene.id,
    seed,
    seed64: scene.seed64,
    generatorVersion: scene.state.generatorVersion,
    created: 1_700_000_000_000,
    lastPlayed: 4_102_444_800_000,
    mode: scene.state.mode,
    difficulty: scene.state.difficulty,
    dimension: scene.state.dimension,
    player: {
      x: scene.state.x,
      y: scene.state.y,
      z: scene.state.z,
      yaw: scene.state.yaw,
      pitch: scene.state.pitch,
      fly: true,
    },
    hotbar: Array.from({ length: 9 }, () => 0),
    selected: scene.state.selected,
    tod: scene.state.timeOfDay,
    weather: { w: 'clear', t: 999999, r: 0 },
  };
  await page.evaluate(async (world) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('blockcraft-worlds');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('worlds', 'readwrite');
        tx.objectStore('worlds').put(world);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, record);
  await page.reload();
  await expect(page.locator('#play')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('#worlds')).toContainText('Terrain v' + scene.state.generatorVersion);
  await page.locator('#play').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.waitForFunction(() => Boolean((window as FixtureWindow).__mauriceVisual), {
    timeout: 10_000,
  });
  return seed;
}

function assertSemanticState(
  actual: ReturnType<VisualFixture['snapshot']>,
  expected: VisualSceneInput,
): void {
  expect(actual.ready, 'World must finish restoring before capture').toBe(true);
  expect(actual.frozen, 'Simulation must not advance during capture').toBe(true);
  expect(actual.seed, 'Wrong world seed').toBe(expected.seed);
  expect(actual.generatorVersion, 'Wrong terrain generation version').toBe(
    expected.generatorVersion,
  );
  expect(actual.dimension, 'Wrong dimension').toBe(expected.dimension);
  expect(actual.mode, 'Wrong game mode').toBe(expected.mode);
  expect(actual.difficulty, 'Wrong difficulty').toBe(expected.difficulty);
  expect(actual.selected, 'Wrong selected hotbar slot').toBe(expected.selected);
  expect(actual.heldItem, 'Wrong selected equipment').toBe(expected.heldItem);
  expect(actual.timeOfDay, 'Wrong daylight').toBe(expected.timeOfDay);
  for (const coordinate of ['x', 'y', 'z', 'yaw', 'pitch'] as const) {
    expect(actual[coordinate], 'Wrong player ' + coordinate).toBeCloseTo(expected[coordinate], 5);
  }
  expect(actual.visibleWorldMeshes, 'World geometry is absent').toBeGreaterThan(2);
  expect(actual.renderedTriangles, 'WebGL produced no geometry').toBeGreaterThan(40);
  expect(
    actual.distinctPixelSamples,
    'WebGL canvas rendered a flat or blank frame',
  ).toBeGreaterThan(2);
  expect(actual.averageBrightness, 'WebGL canvas is black or unlit').toBeGreaterThan(5);
}

for (const scene of VISUAL_SCENES) {
  test('seeded visual: ' + scene.id, async ({ page, isMobile }, testInfo) => {
    test.skip(
      isMobile !== scene.mobile,
      scene.mobile ? 'Capture only on Pixel 7' : 'Capture only on desktop',
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const seed = await seedIsolatedWorld(page, scene);
    const expected: VisualSceneInput = { ...scene.state, seed };
    await page.evaluate((input) => {
      const fixture = (window as FixtureWindow).__mauriceVisual;
      if (!fixture) throw new Error('visual-test build did not install the fixture');
      fixture.configure(input);
    }, expected);
    // Wait for deterministic game state, not an arbitrary sleep or a lucky
    // pair of screenshots. The streamer loads and meshes chunks in batches.
    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as FixtureWindow).__mauriceVisual?.isSceneSettled() ?? false),
        {
          timeout: 60_000,
          intervals: [250, 500, 1000],
        },
      )
      .toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => (window as FixtureWindow).__mauriceVisual?.snapshot().renderedTriangles ?? 0,
          ),
        {
          timeout: 30_000,
        },
      )
      .toBeGreaterThan(40);
    const state = await page.evaluate(() => (window as FixtureWindow).__mauriceVisual!.snapshot());
    assertSemanticState(state, expected);
    await expect(page.locator('#view')).toBeVisible();
    await expect(page.locator('#crosshair')).toBeVisible();
    if (expected.mode === 'survival') {
      await expect(page.locator('#hearts')).toBeVisible();
    }
    expect(errors).toEqual([]);

    // Two captures from a frozen but actually rendered game must match byte for
    // byte. This guard runs before any image can become an approved baseline.
    const first = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    const dir = testInfo.outputPath('visual-captures');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, scene.id + '-a.png'), first);
    const second = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    await writeFile(path.join(dir, scene.id + '-b.png'), second);
    expect(
      second.equals(first),
      scene.id + ' changed pixels with the same fixture; do not approve an unstable baseline',
    ).toBe(true);
    expect(errors).toEqual([]);

    const baseline = testInfo.snapshotPath(scene.id + '.png');
    if (existsSync(baseline)) {
      await expect(page).toHaveScreenshot(scene.id + '.png', {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.005,
      });
    } else {
      // Bootstrap review: CI publishes candidates but may not mint a baseline
      // automatically. A maintainer must deliberately commit approved PNGs.
      testInfo.annotations.push({ type: 'baseline-candidate', description: scene.id });
    }
  });
}
