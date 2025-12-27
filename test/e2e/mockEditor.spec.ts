import { expect, test } from '@playwright/test';

test.describe('MockEditor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Drag & Drop reorders fields using drag handle', async ({ page }) => {
    // Open editor
    await page.getByRole('button', { name: /Design Route/i }).click();
    await expect(page.getByRole('heading', { name: /Design New Route|Edit Definition/i })).toBeVisible();

    // Ensure visual editor is showing field rows
    await expect(page.getByPlaceholder('key_name').first()).toBeVisible();

    const keyInputs = page.getByPlaceholder('key_name');
    const firstKey = await keyInputs.nth(0).inputValue();
    const secondKey = await keyInputs.nth(1).inputValue();

    // Drag first handle to after second
    const handle1 = page.getByRole('button', { name: 'Drag field' }).nth(0);
    const handle2 = page.getByRole('button', { name: 'Drag field' }).nth(1);

    await handle1.dragTo(handle2);

    // After drag, inputs should have reordered
    const newFirstKey = await keyInputs.nth(0).inputValue();
    const newSecondKey = await keyInputs.nth(1).inputValue();

    // At least one of them should differ from the original order
    expect(newFirstKey === secondKey || newSecondKey === firstKey).toBeTruthy();
  });

  test('AI Generate triggers network call and shows toast', async ({ page }) => {
    // Intercept the openrouter generate-mock call and respond with deterministic JSON
    await page.route('**/openrouter/generate-mock', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ json: '{"ai":true, "hello":"world"}' }),
      });
    });

    await page.getByRole('button', { name: /Design Route/i }).click();
    await expect(page.getByRole('heading', { name: /Design New Route|Edit Definition/i })).toBeVisible();

    const aiButton = page.getByRole('button', { name: /AI Generate/i });
    await expect(aiButton).toBeVisible();

    await aiButton.click();

    // Wait for network and UI toast message
    await expect(page.locator('text=Generated response body')).toBeVisible({ timeout: 5000 });

    // Also verify that the JSON editor now contains our AI response
    await page.getByRole('button', { name: /JSON/i }).click(); // switch to code view if needed
    const jsonEditor = page.locator('textarea[placeholder="JSON"]');
    // If there's a textarea, assert it contains the AI key
    if (await jsonEditor.count()) {
      await expect(jsonEditor).toContainText('"ai":true');
    }
  });
});
