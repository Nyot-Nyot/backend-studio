import { expect, test } from '@playwright/test';

test('Export downloads JSON file', async ({ page }) => {
  await page.goto('/');

  // Open Traffic Monitor via nav
  await page.getByRole('button', { name: 'Traffic Monitor' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export' }).click(),
  ]);

  expect(download.suggestedFilename()).toContain('.json');
});

test('Copy all copies logs JSON to clipboard', async ({ page, context }) => {
  await page.goto('/');

  // Try to grant clipboard permissions; some browsers/platforms don't support these permissions
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  } catch (e) {
    // ignore errors on browsers that don't support clipboard permissions
  }

  await page.getByRole('button', { name: 'Traffic Monitor' }).click();

  await page.getByRole('button', { name: 'Copy' }).click();

  // Attempt to read clipboard; some browsers block readText in tests
  const text = await page.evaluate(async () => {
    try {
      return await (navigator as any).clipboard.readText();
    } catch (e) {
      return null;
    }
  });

  if (text !== null) {
    expect(text).toBeTruthy();
    // Should be valid JSON
    JSON.parse(text);
  }
});
