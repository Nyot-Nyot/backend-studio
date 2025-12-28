import { expect, test } from '@playwright/test';

// Keyboard navigation: focus + Enter/Space should activate nav items
test('Keyboard activates navigation items (Enter and Space)', async ({ page }) => {
  await page.goto('/');

  // Use Prototype Lab which is always present (role=button on div)
  const proto = page.getByRole('button', { name: 'Prototype Lab' });
  await proto.click();
  await expect(page.locator('text=API Prototype Lab')).toBeVisible();

  // Focus Overview and press Enter
  const overview = page.getByRole('button', { name: 'Overview' });
  await overview.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('h2')).toContainText('Overview');

  // Go back to Prototype Lab, then press Space to activate
  await proto.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('text=API Prototype Lab')).toBeVisible();
});

// Confirm dialog: dismissing should cancel deletion, accepting should delete
test('Delete workspace shows confirmation dialog and respects accept/dismiss', async ({ page }) => {
  await page.goto('/');

  // Create two workspaces to ensure delete button is present
  const nameA = 'spec-ws-a';
  const nameB = 'spec-ws-b';

  // Helper to create workspace if it doesn't exist
  const hasWorkspace = async (name: string) => {
    const text = await page.locator('select').innerText().catch(() => '');
    return text.includes(name);
  };

  if (!(await hasWorkspace(nameA))) {
    await page.click('text=New Workspace');
    await page.fill('input[placeholder="Workspace Name"]', nameA);
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Workspace \"${nameA}\" created`)).toBeVisible();
  }

  if (!(await hasWorkspace(nameB))) {
    await page.click('text=New Workspace');
    await page.fill('input[placeholder="Workspace Name"]', nameB);
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Workspace \"${nameB}\" created`)).toBeVisible();
  }

  // Select the second workspace
  await page.selectOption('select', { label: nameB });

  // Dismiss the confirm dialog (cancel) and ensure workspace remains
  page.once('dialog', dialog => dialog.dismiss());
  await page.click('button[title="Delete current workspace"]');
  await expect(page.locator('select')).toContainText(nameB);

  // Now accept the dialog and ensure workspace is removed
  page.once('dialog', dialog => dialog.accept());
  await page.click('button[title="Delete current workspace"]');

  await expect(page.locator('select')).not.toContainText(nameB);
});
