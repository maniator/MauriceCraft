import { expect, test, type Page } from '@playwright/test';

interface SavedPortal {
  x: number; y: number; z: number; dimension: 'overworld' | 'nether';
}
interface SavedWorld {
  dimension?: string;
  generatorVersion?: number;
  portals?: SavedPortal[];
}

async function command(page: Page, value: string): Promise<void> {
  if (await page.locator('#btnCmd').isVisible()) await page.locator('#btnCmd').tap();
  else await page.keyboard.press('t');
  const input = page.locator('#cmdinput');
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.press('Enter');
  await expect(input).toBeHidden();
}

async function storedWorld(page: Page): Promise<SavedWorld> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('blockcraft-worlds');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const worlds = await new Promise<SavedWorld[]>((resolve, reject) => {
        const request = db.transaction('worlds', 'readonly').objectStore('worlds').getAll();
        request.onsuccess = () => resolve(request.result as SavedWorld[]);
        request.onerror = () => reject(request.error);
      });
      if (worlds.length !== 1) throw new Error('Expected one local test world');
      return worlds[0];
    } finally {
      db.close();
    }
  });
}

async function findPortal(page: Page, dimension: SavedPortal['dimension']): Promise<SavedPortal> {
  await expect.poll(async () => (await storedWorld(page)).portals?.some(p => p.dimension === dimension) ?? false, {
    timeout: 15_000,
  }).toBe(true);
  const portal = (await storedWorld(page)).portals?.find(p => p.dimension === dimension);
  if (!portal) throw new Error('Missing persisted ' + dimension + ' portal');
  return portal;
}

async function enterPortal(page: Page, portal: SavedPortal): Promise<void> {
  await command(page, `/tp ${portal.x + 0.5} ${portal.y + 1.05} ${portal.z + 0.5}`);
}

test('a real portal frame travels to the generated Nether, returns and survives reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#play').click();
  await expect(page.locator('#overlay')).toBeHidden();

  await command(page, '/portal build');
  const origin = await findPortal(page, 'overworld');
  await enterPortal(page, origin);
  await expect.poll(async () => (await storedWorld(page)).dimension, { timeout: 15_000 })
    .toBe('nether');
  expect((await storedWorld(page)).generatorVersion).toBe(5);

  const nether = await findPortal(page, 'nether');
  // Avoid the intentional cooldown that prevents immediate portal ping-pong.
  await page.waitForTimeout(2700);
  await enterPortal(page, nether);
  await expect.poll(async () => (await storedWorld(page)).dimension, { timeout: 15_000 })
    .toBe('overworld');

  await command(page, '/save');
  await page.reload();
  await expect(page.locator('#play')).toBeEnabled({ timeout: 15_000 });
  const restored = await storedWorld(page);
  expect(restored.dimension).toBe('overworld');
  expect(restored.portals?.some(p => p.dimension === 'nether')).toBe(true);
  expect(restored.portals?.some(p => p.dimension === 'overworld')).toBe(true);
  expect(errors).toEqual([]);
});
