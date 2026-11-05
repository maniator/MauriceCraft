import { expect, test, type Page } from '@playwright/test';

async function startWorld(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('#play')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#play').click();
  await expect(page.locator('#overlay')).toBeHidden();
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

test('clear requires confirmation; Cancel, Escape, and --force behave on desktop and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startWorld(page);
  await runCommand(page, '/gamemode survival');
  await runCommand(page, '/give stick 3');

  const count = page.locator('#hotbar .slot').first().locator('.cnt');
  await expect(count).toHaveText('3');

  await runCommand(page, '/clear');
  const dialog = page.getByRole('dialog', { name: 'Clear backpack?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('3 items');
  await expect(page.locator('#clearCancel')).toBeFocused();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(count).toHaveText('3');
  await page.locator('#clearCancel').click();
  await expect(dialog).toBeHidden();
  await expect(count).toHaveText('3');

  await runCommand(page, '/clear');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(count).toHaveText('3');

  await runCommand(page, '/clear');
  await page.locator('#clearAccept').click();
  await expect(dialog).toBeHidden();
  await expect(count).toHaveCount(0);

  await runCommand(page, '/give stick 2');
  await expect(count).toHaveText('2');
  await runCommand(page, '/clear --force');
  await expect(dialog).toBeHidden();
  await expect(count).toHaveCount(0);
  expect(errors).toEqual([]);
});
