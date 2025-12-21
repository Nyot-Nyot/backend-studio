import { expect, test } from '@playwright/test';

test('Method badge colors and key labels present', async ({ page }) => {
  await page.goto('/');

  // Ensure Overview visible
  await expect(page.locator('h2', { hasText: 'Overview' })).toBeVisible();

  // Use stable test-id for Ping card and check method badge color for GET
  const card = page.getByTestId('mock-card-Ping');
  const methodBadge = card.getByText('GET');
  await expect(methodBadge).toBeVisible();
  const badgeClass = await methodBadge.getAttribute('class');
  expect(badgeClass).toContain('text-blue-700');

  // Check Export / Import labels in Settings
  await page.click('div[title="Configuration"]');
  await expect(page.locator('text=Export Configuration')).toBeVisible();
  await expect(page.locator('text=Import Configuration')).toBeVisible();

  // Check Factory Reset label in Danger Zone
  await expect(page.locator('text=Factory Reset')).toBeVisible();
});
