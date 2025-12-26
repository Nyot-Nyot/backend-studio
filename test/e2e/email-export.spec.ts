import { expect, test } from '@playwright/test';

test('email export modal validation', async ({ page }) => {
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001');
  // Open the Export & Deploy modal via the sidebar
  await page.click('button:has-text("Export & Deploy Hub")', { timeout: 5000 }).catch(() => { });

  // If the Deploy button not directly exposed, click via the Export menu in the UI
  // Open the Export & Deploy Hub via the header action (fallback)
  const deployButton = page.locator('button:has-text("Open Export Hub")');
  if (await deployButton.count() > 0) {
    await deployButton.first().click();
  } else {
    // If not found, open via the settings/deploy button in sidebar
    await page.click('button:has-text("Export & Deploy Hub")', { timeout: 5000 }).catch(() => { });
  }

  // Wait for modal to open and click 'Send via Email'
  await page.waitForSelector('text=Export & Deploy Hub');
  await page.click('button:has-text("Send via Email")');

  // Click send without recipients
  await page.click('button:has-text("Send Email")');

  // Expect validation error
  await expect(page.locator('text=Enter at least one recipient email.')).toBeVisible();
});
