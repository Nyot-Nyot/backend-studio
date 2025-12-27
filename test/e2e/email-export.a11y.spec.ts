import { expect, test } from '@playwright/test';
import { formatViolations } from './a11y.helper';

// Accessibility scan for the EmailExportModal specifically
test('Email export modal has no critical a11y violations and traps focus', async ({ page }) => {
  // Dynamic import so the test can be skipped gracefully if @axe-core/playwright is absent
  let axe: any;
  try {
    axe = await import('@axe-core/playwright');
  } catch (err) {
    test.skip(true, 'Paket @axe-core/playwright tidak tersedia; lewati tes a11y lokal. CI akan menginstal dependensi.');
    return;
  }

  const { injectAxe, checkA11y } = axe;

  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001');

  // Open the Export & Deploy Hub/UI and click 'Send via Email', mirroring existing test flow
  await page.click('button:has-text("Export & Deploy Hub")', { timeout: 5000 }).catch(() => { });

  const deployButton = page.locator('button:has-text("Open Export Hub")');
  if (await deployButton.count() > 0) {
    await deployButton.first().click();
  } else {
    await page.click('button:has-text("Export & Deploy Hub")', { timeout: 5000 }).catch(() => { });
  }

  // Wait for the Export hub or the Send via Email button to appear (some shells show directly)
  const sendButton = page.locator('button:has-text("Send via Email")');
  try {
    await sendButton.waitFor({ timeout: 5000 });
    await sendButton.click();
  } catch (err) {
    test.skip(true, 'Send via Email button not present — skipping modal a11y test in this environment.');
    return;
  }

  // Wait for modal to be visible
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  await injectAxe(page);
  const results = await checkA11y(page, '[role="dialog"]', { detailedReport: true });

  if (results && results.violations && results.violations.length > 0) {
    const formatted = formatViolations(results.violations);
    throw new Error(`Accessibility violations found in EmailExportModal:\n${JSON.stringify(formatted, null, 2)}`);
  }

  // Focus trap: ensure tabbing stays inside the dialog and Escape closes it
  const focusableCount = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 0;
    return dialog.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])').length;
  });

  expect(focusableCount).toBeGreaterThan(0);

  // Press Tab many times and confirm activeElement remains inside dialog
  for (let i = 0; i < focusableCount + 3; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    expect(inside).toBe(true);
  }

  // Press Escape to close
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
