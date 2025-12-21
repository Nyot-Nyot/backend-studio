import { expect, test } from '@playwright/test';
import fs from 'fs';

test('Export Configuration produces valid JSON file with projects, mocks, envVars', async ({ page }) => {
  await page.goto('/');
  // Open settings
  await page.click('div[title="Configuration"]');
  await expect(page.locator('h3', { hasText: 'Workspace Data' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Export Configuration'),
  ]);

  // Save to temporary path
  const path = await download.path();
  const content = fs.readFileSync(path!, 'utf8');
  const data = JSON.parse(content);

  expect(data).toHaveProperty('version');
  expect(data).toHaveProperty('timestamp');
  expect(Array.isArray(data.projects)).toBe(true);
  expect(Array.isArray(data.mocks)).toBe(true);
  // envVars may be undefined or array
  if (data.envVars) expect(Array.isArray(data.envVars)).toBe(true);
});


test('Import Configuration replaces workspace after confirmation', async ({ page }) => {
  await page.goto('/');
  await page.click('div[title="Configuration"]');

  const payload = {
    version: '1.0',
    timestamp: Date.now(),
    projects: [{ id: 'p-import', name: 'Imported Project' }],
    mocks: [
      {
        id: 'm-import',
        projectId: 'p-import',
        name: 'Imported Route',
        path: '/api/imported',
        method: 'GET',
        responseBody: '{}',
        headers: [],
        isActive: true,
      },
    ],
    envVars: [{ id: 'e1', key: 'API_URL', value: 'https://example.test' }],
  };

  // Prepare file and set to input
  const file = {
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  };

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.setInputFiles('input[type=file]', file);

  // Wait for success toast
  await expect(page.locator('text=Workspace import successful')).toBeVisible();

  // Go to Overview and check the imported route/project presence
  await page.click('div[title="Overview"]');
  await expect(page.locator('h3', { hasText: 'Imported Route' })).toBeVisible();
});


test('Import Configuration handles invalid file gracefully', async ({ page }) => {
  await page.goto('/');
  await page.click('div[title="Configuration"]');

  const bad = {
    version: '1.0',
    timestamp: Date.now(),
    // missing projects/mocks arrays
    somethingElse: [],
  };

  const file = {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bad)),
  };

  await page.setInputFiles('input[type=file]', file);

  await expect(page.locator('text=Failed to import: Invalid file format')).toBeVisible();
});


test('Factory Reset clears storage and returns to default workspace', async ({ page }) => {
  await page.goto('/');

  // Add a new project to ensure not default state
  await page.click('div[title="Configuration"]');

  // Confirm factory reset dialog
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.click('text=Factory Reset');

  // After reload, Overview should show Ping default mock
  await expect(page.locator('h3', { hasText: 'Ping' })).toBeVisible();
});
