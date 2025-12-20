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
  await expect(page.locator('text=Authorization: Bearer secret-xyz')).toBeVisible();

  // Save the route
  await page.click('text=Save Route');

  // Back on dashboard, re-open Ping and verify persisted value
  await expect(page.locator('h3', { hasText: 'Ping' })).toBeVisible();
  await page.click('h3:has-text("Ping")');

  await expect(page.locator('text=Authentication & Security')).toBeVisible();
  await expect(page.locator('text=Authorization: Bearer secret-xyz')).toBeVisible();
});
