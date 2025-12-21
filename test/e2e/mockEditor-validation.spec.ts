import { expect, test } from '@playwright/test';

test('Route conflict disables Save and shows toast', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('h3', { hasText: 'Ping' })).toBeVisible();

  // Duplicate Ping route
  const pingCard = page.locator('h3:has-text("Ping")').locator('..').locator('..');
  await pingCard.locator('button[title="Duplicate"]').click();

  // New duplicated card should appear
  await expect(page.locator('h3', { hasText: 'Ping (Copy)' })).toBeVisible();

  // Open duplicate editor
  await page.click('h3:has-text("Ping (Copy)")');
  await expect(page.locator('text=Edit Definition')).toBeVisible();

  // Change path to match existing Ping -> should show conflict
  const pathInput = page.locator('input[placeholder="/api/v1/resource/:id"]');
  await pathInput.fill('/api/ping');

  await expect(page.locator('text=Route conflict:')).toBeVisible();

  // Save should be disabled
  await expect(page.locator('text=Save Route')).toBeDisabled();

  // Clicking is not possible because the button is disabled — the conflict message is shown instead
  await expect(page.locator('text=Route conflict:')).toBeVisible();
});


test('Invalid JSON prevents saving and shows Syntax Error', async ({ page }) => {
  await page.goto('/');

  // Open Ping
  await page.click('h3:has-text("Ping")');
  await expect(page.locator('text=Edit Definition')).toBeVisible();

  // Switch to JSON (code) mode
  await page.click('button:has-text("JSON")');

  // Insert invalid JSON
  const textarea = page.locator('textarea');
  await textarea.fill('{ "id": "123", ');

  // Footer should show Syntax Error
  await expect(page.locator('text=Syntax Error')).toBeVisible();

  // Save should be disabled
  await expect(page.locator('text=Save Route')).toBeDisabled();

  // Clicking is not possible because the button is disabled — the Syntax Error is shown in the footer
  await expect(page.locator('text=Syntax Error')).toBeVisible();
});


test('getErrorLine highlights an internal error line', async ({ page }) => {
  await page.goto('/');
  await page.click('h3:has-text("Ping")');
  await page.click('button:has-text("JSON")');

  // Create a multi-line invalid JSON so error is not on first line
  const invalid = `{
  "id": 1,
  "name": "John",
  "bio": "multi
line
text"
}`;
  await page.locator('textarea').fill(invalid);

  await expect(page.locator('text=Syntax Error')).toBeVisible();

  // There should be an highlighted line number (red) indicating the error
  const redLine = page.locator('div.text-red-500');
  await expect(redLine.first()).toBeVisible();
});


test('Code -> Visual rejects root null and primitive', async ({ page }) => {
  await page.goto('/');
  await page.click('h3:has-text("Ping")');
  await page.click('button:has-text("JSON")');

  // null case
  await page.locator('textarea').fill('null');
  await page.click('button:has-text("Visual")');
  await expect(page.getByText('Root cannot be null for Visual Editor', { exact: true })).toBeVisible();

  // primitive case
  await page.locator('textarea').fill('true');
  await page.click('button:has-text("Visual")');
  await expect(page.getByText('Root element must be an Object {} or Array [] for Visual Editing', { exact: true })).toBeVisible();
});


test('Format button shows error toast when JSON invalid', async ({ page }) => {
  await page.goto('/');
  await page.click('h3:has-text("Ping")');
  await page.click('button:has-text("JSON")');

  await page.locator('textarea').fill('{ "id": 1, ');
  await page.click('button:has-text("Format")');
  await expect(page.locator('text=Invalid JSON cannot be formatted')).toBeVisible();
});


test('Array root roundtrip preserved when switching modes', async ({ page }) => {
  await page.goto('/');
  await page.click('h3:has-text("Ping")');
  await page.click('button:has-text("JSON")');

  const arr = '[{"id":1,"name":"A"},{"id":2,"name":"B"}]';
  await page.locator('textarea').fill(arr);

  // Switch to visual and back to code
  await page.click('button:has-text("Visual")');
  await expect(page.locator('text=Schema Validated')).toBeVisible();
  await page.click('button:has-text("JSON")');

  const formatted = await page.locator('textarea').inputValue();
  const parsed = JSON.parse(formatted);
  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new Error('Array roundtrip failed');
  }
  if (parsed[0].name !== 'A' || parsed[1].name !== 'B') {
    throw new Error('Array contents changed during roundtrip');
  }
});


test('Visual edits reflect into responseBody (two-way sync)', async ({ page }) => {
  await page.goto('/');
  await page.click('h3:has-text("Ping")');
  await page.click('button:has-text("JSON")');

  const arr = '[{"id":1,"name":"A"},{"id":2,"name":"B"}]';
  await page.locator('textarea').fill(arr);

  // Switch to visual
  await page.click('button:has-text("Visual")');
  await expect(page.locator('text=Schema Validated')).toBeVisible();

  // Find nested input for the name 'A' and change it to 'Z'
  const nameInput = page.locator('input[value="A"]').first();
  await nameInput.fill('Z');

  // Switch back to JSON and verify
  await page.click('button:has-text("JSON")');
  const formatted = await page.locator('textarea').inputValue();
  const parsed = JSON.parse(formatted);
  if (parsed[0].name !== 'Z') {
    throw new Error('Change in visual editor did not reflect in responseBody');
  }
});


test('Nested object & array conversion preserves structure', async ({ page }) => {
  await page.goto('/');
  await page.click('h3:has-text("Ping")');
  await page.click('button:has-text("JSON")');

  const nested = '{"users":[{"id":1,"tags":["a","b"]},{"id":2,"tags":["c"]}],"meta":{"count":2}}';
  await page.locator('textarea').fill(nested);

  // Switch to visual, then change a nested array value
  await page.click('button:has-text("Visual")');
  await expect(page.locator('text=Schema Validated')).toBeVisible();

  // Arrays are represented as JSON strings in visual mode. Edit via code mode and verify result.
  await page.click('button:has-text("JSON")');
  let formatted = await page.locator('textarea').inputValue();
  formatted = formatted.replace('"a"', '"z"');
  await page.locator('textarea').fill(formatted);

  // Switch to Visual and back to ensure parsing roundtrip
  await page.click('button:has-text("Visual")');
  await page.click('button:has-text("JSON")');

  const parsed = JSON.parse(await page.locator('textarea').inputValue());
  if (parsed.users[0].tags[0] !== 'z') {
    throw new Error('Nested array element did not update correctly');
  }
});
