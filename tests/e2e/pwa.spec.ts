import { expect, test } from '@playwright/test';

test('PWA manifest and correctly sized app icons are served on the Pages subpath', async ({
  page,
}) => {
  await page.goto('./');
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error('Missing web app manifest link');
    const response = await fetch(link.href);
    if (!response.ok) throw new Error('Cannot fetch web app manifest');
    return response.json() as Promise<{
      scope: string;
      start_url: string;
      icons: Array<{ src: string; sizes: string; purpose: string }>;
    }>;
  });
  expect(manifest.scope).toBe('/MauriceCraft/');
  expect(manifest.start_url).toBe('/MauriceCraft/');
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  expect(manifest.icons[2]?.purpose).toBe('maskable');

  for (const icon of manifest.icons) {
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = new URL(
        src,
        document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href,
      ).href;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, icon.src);
    const size = Number(icon.sizes.split('x')[0]);
    expect(dimensions).toEqual([size, size]);
  }
});

test('a fully cached production app starts without internet and keeps local worlds', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 20_000 });
  const before = await page.locator('.world').count();
  expect(before).toBeGreaterThan(0);

  // The service worker must finish caching every production chunk and claim the page.
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 30_000,
    })
    .toBe(true);

  const script = await page.evaluate(async () =>
    (await fetch(new URL('sw.js', document.baseURI))).text(),
  );
  expect(script).toContain('precacheAndRoute(');
  expect(script).toContain('/MauriceCraft/index.html');
  expect(script).toContain('icons/icon-512.png');
  expect(script).not.toContain('__MAURICECRAFT_');

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#play')).toBeEnabled({ timeout: 20_000 });
    await expect(page.locator('.world')).toHaveCount(before);
    // The deferred command chunk must still be available from Workbox offline.
    await page.locator('#play').click();
    await expect(page.locator('#overlay')).toBeHidden();
    if (await page.locator('#btnCmd').isVisible()) await page.locator('#btnCmd').tap();
    else await page.keyboard.press('t');
    const input = page.locator('#cmdinput');
    await expect(input).toBeVisible();
    await input.fill('/help');
    await input.press('Enter');
    await expect(page.locator('#chatlog')).toContainText('Commands:');
  } finally {
    await context.setOffline(false);
  }
});
