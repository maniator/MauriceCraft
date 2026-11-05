import { expect, test, type Page } from '@playwright/test';

async function startWorld(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#play').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#info')).toContainText('X ');
}

async function runCommand(page: Page, command: string): Promise<void> {
  if (await page.locator('#btnCmd').isVisible()) {
    await page.locator('#btnCmd').tap();
  } else {
    await page.keyboard.press('t');
  }
  const input = page.locator('#cmdinput');
  await expect(input).toBeVisible();
  await input.fill(command);
  await input.press('Enter');
  await expect(input).toBeHidden();
}

async function playerPosition(page: Page): Promise<{ x: number; y: number; z: number }> {
  const status = await page.locator('#info').innerText();
  const match = /X (-?\d+\.\d+)\s+Y (-?\d+\.\d+)\s+Z (-?\d+\.\d+)/.exec(status);
  if (!match) throw new Error('Player position missing from the running game HUD: ' + status);
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
}

test('a loaded world simulates player movement on desktop and touch devices', async ({ page, isMobile }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await startWorld(page);
  const before = await playerPosition(page);
  if (isMobile) {
    // Exercise the actual touchstart/move/end controls rather than a keyboard
    // shortcut on a mobile viewport. Synthetic touches are enough for the
    // game's canvas handlers, and keep the test deterministic.
    await page.evaluate(async () => {
      const canvas = document.querySelector<HTMLCanvasElement>('#view');
      if (!canvas) throw new Error('The game canvas is missing');
      function emit(type: string, x: number, y: number): void {
        const touch = new Touch({ identifier: 1, target: canvas!, clientX: x, clientY: y });
        const event = new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [touch],
          targetTouches: type === 'touchend' ? [] : [touch],
          changedTouches: [touch], bubbles: true, cancelable: true,
        });
        canvas!.dispatchEvent(event);
      }
      emit('touchstart', 48, 240);
      emit('touchmove', 48, 160);
      await new Promise(resolve => setTimeout(resolve, 850));
      emit('touchend', 48, 160);
    });
  } else {
    await page.keyboard.down('w');
    await page.waitForTimeout(850);
    await page.keyboard.up('w');
  }
  await expect.poll(async () => {
    const after = await playerPosition(page);
    return Math.hypot(after.x - before.x, after.z - before.z);
  }, { timeout: 5_000 }).toBeGreaterThan(0.3);
  expect(browserErrors).toEqual([]);
});

test('placing a block in a game world persists through save and full reload', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await startWorld(page);

  // Use the actual game command to mutate the loaded chunk. Block 3 (Stone)
  // is an established saved-world ID, never an arbitrary test-only value.
  await runCommand(page, '/setblock 0 45 0 stone');
  await expect(page.locator('#chatlog')).toContainText('Set 0 45 0 to Stone');
  await runCommand(page, '/save');

  async function persistedBlock(): Promise<number | null> {
    return page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('blockcraft-worlds');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const worlds = await new Promise<Array<{ id: string }>>((resolve, reject) => {
          const request = database.transaction('worlds', 'readonly').objectStore('worlds').getAll();
          request.onsuccess = () => resolve(request.result as Array<{ id: string }>);
          request.onerror = () => reject(request.error);
        });
        if (worlds.length !== 1) throw new Error('Expected one isolated test world');
        const record = await new Promise<{ data: Uint8Array } | undefined>((resolve, reject) => {
          const request = database.transaction('chunks', 'readonly')
            .objectStore('chunks').get(worlds[0].id + ':0,0');
          request.onsuccess = () => resolve(request.result as { data: Uint8Array } | undefined);
          request.onerror = () => reject(request.error);
        });
        return record?.data[(45 * 16) * 16] ?? null;
      } finally {
        database.close();
      }
    });
  }
  await expect.poll(persistedBlock, { timeout: 15_000 }).toBe(3);
  await page.reload();
  await expect(page.locator('#play')).toBeEnabled({ timeout: 15_000 });
  expect(await persistedBlock()).toBe(3);
  await page.locator('#play').click();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(browserErrors).toEqual([]);
});

test('switching dimensions preserves live gameplay and the saved world', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await startWorld(page);
  await runCommand(page, '/dimension nether');
  await expect(page.locator('#chatlog')).toContainText('Entered the nether');
  await expect(page.locator('#info')).toContainText('X ');
  await runCommand(page, '/dimension overworld');
  await expect(page.locator('#chatlog')).toContainText('Entered the overworld');
  await runCommand(page, '/save');
  await page.reload();
  await expect(page.locator('#play')).toBeEnabled({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('survival bag hides zero-count items and recipe book reveals partial recipes on desktop and mobile', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await startWorld(page);
  await runCommand(page, '/gamemode survival');
  await runCommand(page, '/give stick 1');
  await expect(page.locator('#hotbar .slot').first()).toHaveAttribute('aria-label', 'Stick, slot 1');
  await expect(page.locator('#hotbar .slot').first().locator('.cnt')).toHaveText('1');
  await expect(page.locator('#heldItem')).toBeVisible();
  await expect(page.locator('#heldItem')).toHaveAttribute('aria-label', 'Holding Stick');

  if (isMobile) await page.locator('#btnInv').tap();
  else await page.keyboard.press('i');
  await expect(page.locator('#inv')).toBeVisible();
  await expect(page.locator('#invGrid .itile')).toHaveCount(1);
  await expect(page.locator('#invGrid')).toContainText('Stick');
  await expect(page.locator('#invGrid')).not.toContainText('Stone');

  await page.getByRole('button', { name: 'Open crafting grid (C)' }).click();
  await expect(page.locator('#craftui')).toBeVisible();
  await expect(page.locator('#craftBook')).toContainText('Shovel');
  await expect(page.locator('#craftBook')).toContainText('Still need:');
  await expect(page.locator('#craftBook')).not.toContainText('Cooked Meat');
  expect(errors).toEqual([]);
});

test('first-person hand equips hotbar items and swings on desktop and mobile mining input', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await startWorld(page);
  const hand = page.locator('#heldHand');
  const heldItem = page.locator('#heldItem');
  await expect(hand).toBeVisible();
  await expect(heldItem).toBeHidden();

  await runCommand(page, '/gamemode survival');
  await runCommand(page, '/give stick 1');
  await expect(heldItem).toHaveAttribute('aria-label', 'Holding Stick');
  await expect(heldItem).toBeVisible();
  await runCommand(page, '/give stone 1');
  // Desktop pointer lock uses number keys; touch devices select hotbar buttons.
  if (isMobile) await page.locator('#hotbar .slot').nth(1).tap();
  else await page.keyboard.press('2');
  await expect(heldItem).toHaveAttribute('aria-label', 'Holding Stone');
  if (isMobile) await page.locator('#hotbar .slot').nth(0).tap();
  else await page.keyboard.press('1');
  await expect(heldItem).toHaveAttribute('aria-label', 'Holding Stick');

  if (isMobile) {
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#view');
      if (!canvas) throw new Error('Missing game canvas');
      const touch = new Touch({
        identifier: 42, target: canvas, clientX: innerWidth * 0.8, clientY: innerHeight * 0.4,
      });
      canvas.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touch], targetTouches: [touch], changedTouches: [touch], bubbles: true, cancelable: true,
      }));
    });
  } else {
    await page.locator('#view').dispatchEvent('mousedown', { button: 0 });
  }
  await expect(hand).toHaveClass(/swing/);
  if (isMobile) {
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#view');
      if (!canvas) throw new Error('Missing game canvas');
      const touch = new Touch({
        identifier: 42, target: canvas, clientX: innerWidth * 0.8, clientY: innerHeight * 0.4,
      });
      canvas.dispatchEvent(new TouchEvent('touchend', {
        touches: [], targetTouches: [], changedTouches: [touch], bubbles: true, cancelable: true,
      }));
    });
  } else await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));

  if (isMobile) await page.locator('#hotbar .slot').nth(2).tap();
  else await page.keyboard.press('3');
  await expect(heldItem).toBeHidden();
  await expect(hand).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile and desktop can return to menu and confirm a manual save', async ({ page, isMobile }) => {
  await startWorld(page);
  const menu = page.getByRole('button', { name: 'Return to main menu' });
  await expect(menu).toBeVisible();
  if (isMobile) await menu.click();
  else await page.keyboard.press('Escape'); // Releases desktop pointer lock and pauses.
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#saveWorld').click();
  await expect(page.locator('#sub')).toContainText('World saved successfully.');
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#play').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(menu).toBeVisible();
});

test('binary world export/import preserves changes and never overwrites an existing world', async ({ page, isMobile }) => {
  await startWorld(page);
  await runCommand(page, '/setblock 0 45 0 stone');
  await expect(page.locator('#chatlog')).toContainText('Set 0 45 0 to Stone');
  if (isMobile) await page.locator('#btnMenu').click();
  else await page.keyboard.press('Escape');
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#saveWorld').click();
  await expect(page.locator('#sub')).toContainText('World saved successfully.');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.world.on .wexport').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mcraft$/);
  const filePath = await download.path();
  if (!filePath) throw new Error('Missing downloaded world file');
  await page.locator('#importWorldFile').setInputFiles(filePath);
  await expect(page.locator('#sub')).toContainText('Imported ');
  await expect(page.locator('.world')).toHaveCount(2);

  const results = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('blockcraft-worlds');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const worlds = await new Promise<Array<{ id: string; seed: number; name: string }>>((resolve, reject) => {
        const request = db.transaction('worlds', 'readonly').objectStore('worlds').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const blocks: number[] = [];
      for (const world of worlds) {
        const chunk = await new Promise<{ data: Uint8Array } | undefined>((resolve, reject) => {
          const request = db.transaction('chunks', 'readonly').objectStore('chunks').get(world.id + ':0,0');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        blocks.push(chunk?.data[(45 * 16) * 16] ?? -1);
      }
      return { worlds, blocks };
    } finally {
      db.close();
    }
  });
  expect(new Set(results.worlds.map(w => w.id)).size).toBe(2);
  expect(new Set(results.worlds.map(w => w.seed)).size).toBe(1);
  expect(results.blocks).toEqual([3, 3]);

  // A second import must create a third independent ID, not replace either.
  await page.locator('#importWorldFile').setInputFiles(filePath);
  await expect(page.locator('.world')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.world')).toHaveCount(3);
});
