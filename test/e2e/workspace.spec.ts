import { expect, test } from '@playwright/test';

test('Create multiple workspaces and delete one, ensure at least one remains', async ({ page }) => {
  await page.goto('/');

  // Create first workspace (if not present) by using New Workspace
  await page.click('text=New Workspace');
  await page.fill('input[placeholder="Workspace Name"]', 'WS-A');
  await page.click('button:has-text("Create")');
  await expect(page.locator('text=Workspace "WS-A" created')).toBeVisible();

  // Create second workspace
  await page.click('text=New Workspace');
  await page.fill('input[placeholder="Workspace Name"]', 'WS-B');
  await page.click('button:has-text("Create")');
  await expect(page.locator('text=Workspace "WS-B" created')).toBeVisible();

  // Ensure both appear in selector
  await expect(page.locator('select')).toContainText('WS-A');
  await expect(page.locator('select')).toContainText('WS-B');

  // Select WS-B and delete it
  await page.selectOption('select', { label: 'WS-B' });
  // Delete button should be visible when >1 projects
  await expect(page.locator('button[title="Delete current workspace"]')).toBeVisible();
  // Accept the confirmation dialog that deletion triggers
  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  await page.click('button[title="Delete current workspace"]');

  // After deletion, WS-B should not appear
  await expect(page.locator('select')).not.toContainText('WS-B');

  // If only one workspace left, Delete button should be hidden
  const deleteButton = page.locator('button[title="Delete current workspace"]');
  const count = await page.locator('select option').count();
  if (count === 1) {
    await expect(deleteButton).toHaveCount(0);
  } else {
    await expect(deleteButton).toBeVisible();
  }
});

test('Switching workspace persists after reload', async ({ page }) => {
  await page.goto('/');

  // Create a dedicated workspace
  await page.click('text=New Workspace');
  await page.fill('input[placeholder="Workspace Name"]', 'WS-C');
  await page.click('button:has-text("Create")');
  await expect(page.locator('text=Workspace "WS-C" created')).toBeVisible();

  // Select WS-C
  await page.selectOption('select', { label: 'WS-C' });
  // Reload and verify the selection persists
  await page.reload();
  await expect(page.locator('select')).toContainText('WS-C');
});
