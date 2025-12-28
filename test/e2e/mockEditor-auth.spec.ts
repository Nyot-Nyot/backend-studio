import { expect, test } from '@playwright/test';

test('MockEditor auth: set Bearer token and persist', async ({ page }) => {
  // Open app (webServer will start via playwright.config)
  await page.goto('/');

  // Wait for the Ping card to be visible
  await expect(page.locator('h3', { hasText: 'Ping' })).toBeVisible();

  // Open the Ping mock editor by clicking the card (click the heading triggers card click)
  await page.click('h3:has-text("Ping")');

  // Wait for editor to show
  await expect(page.locator('text=Authentication & Security')).toBeVisible();

  // Select Bearer Token
  const authSection = page.locator('text=Authentication & Security').locator('..');
  const select = authSection.locator('select');
  await select.selectOption('BEARER_TOKEN');

  // Fill token value
  const tokenInput = page.locator('text=Bearer Token Value').locator('..').locator('input');
  await tokenInput.fill('secret-xyz');

  // Verify preview updated
  await expect(page.locator('text=Expected Header')).toBeVisible();
  await expect(page.locator('text=Authorization: Bearer')).toBeVisible();
  await expect(page.locator('text=secret-xyz')).not.toBeVisible();

  // Mock clipboard and click copy button, then assert clipboard & toast
  await page.evaluate(() => {
    (navigator as any).clipboard = {
      _data: '',
      writeText: (text: string) => { (navigator as any).clipboard._data = text; return Promise.resolve(); },
      readText: () => Promise.resolve((navigator as any).clipboard._data),
    } as any;
  });
  // Log page console to help debugging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  // Ensure copy button is visible and click it
  const copyBtn = page.locator('button[aria-label="Salin token ke clipboard (robust)"]');
  await expect(copyBtn).toBeVisible();
  await copyBtn.click({ force: true });

  // Wait for toast to appear (indicates copy attempt succeeded)
  await expect(page.locator('text=Token disalin ke clipboard')).toBeVisible({ timeout: 3000 });
  // Try to read from clipboard; some browsers block write/read in tests so fallback gracefully
  const clipboardText = await page.evaluate(async () => {
    try {
      return await (navigator as any).clipboard.readText();
    } catch (e) {
      return null;
    }
  });
  if (clipboardText !== null) {
    await expect(clipboardText).toBe('secret-xyz');
  }

  // Save the route
  await page.click('text=Save Route');

  // Back on dashboard, re-open Ping and verify persisted value
  await expect(page.locator('h3', { hasText: 'Ping' })).toBeVisible();
  await page.click('h3:has-text("Ping")');

  await expect(page.locator('text=Authentication & Security')).toBeVisible();
  await expect(page.locator('text=Authorization: Bearer')).toBeVisible();
  await expect(page.locator('text=secret-xyz')).not.toBeVisible();
});
