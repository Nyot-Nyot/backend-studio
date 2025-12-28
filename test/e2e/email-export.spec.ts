import { expect, test } from '@playwright/test';

test('email export modal validation', async ({ page }) => {
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001');
  // Ensure feature flags for export/email are enabled in localStorage for test
  await page.evaluate(() => {
    try {
      localStorage.setItem('feature_export', 'true');
      localStorage.setItem('feature_email', 'true');
    } catch (e) {
      // ignore
    }
  });
  await page.reload();

  // Click any button that opens the Export/Deploy UI (robust against label changes)
  const exportButton = page.getByRole('button', { name: /export/i }).first();
  await exportButton.click();

  // Wait for modal to open and click 'Send via Email' (allow animation time)
  await page.waitForSelector('text=Export & Deploy Hub', { timeout: 15000 });
  await page.click('button:has-text("Send via Email")');

  // Click send without recipients
  await page.click('button:has-text("Send Email")');

  // Expect validation error
  await expect(page.locator('text=Enter at least one recipient email.')).toBeVisible();
});
