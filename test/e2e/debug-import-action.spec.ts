import { expect, test } from '@playwright/test';

test('debug import action triggers import', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    const projects = [{ id: 'p-e2e', name: 'E2E Project', createdAt: Date.now() }];
    const mocks = [{ id: 'm-e2e', projectId: 'p-e2e', name: 'E2E', path: '/api/e2e', method: 'GET', statusCode: 200, delay: 0, responseBody: '{"ok":true}', isActive: true, version: '1.0', createdAt: Date.now(), requestCount: 0, headers: [{ key: 'Content-Type', value: 'application/json' }], storeName: '', authConfig: { type: 'NONE' } }];
    const envVars = [{ id: 'env-e2e', projectId: 'p-e2e', key: 'BASE_URL', value: 'http://localhost:3000' }];
    localStorage.setItem('api_sim_projects', JSON.stringify(projects));
    localStorage.setItem('api_sim_mocks', JSON.stringify(mocks));
    localStorage.setItem('api_sim_env_vars', JSON.stringify(envVars));
    localStorage.setItem('api_sim_active_project', 'p-e2e');
  });
  await page.reload();

  // Run migration to get a download file
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();
  const runBtn = page.getByRole('button', { name: /Run Migration/i }).first();
  if (await runBtn.count().then(c => c > 0) && await runBtn.isEnabled()) {
    await runBtn.click();
    await expect(page.getByText(/Migration completed|Already migrated/i)).toBeVisible({ timeout: 15000 });
  }

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export All Data/i }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const buf = await download.createReadStream();
  const chunks = [];
  for await (const chunk of buf!) chunks.push(chunk);
  const json = JSON.parse(Buffer.concat(chunks as any).toString('utf-8'));

  // Clear storage and reload
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('BackendStudio'); });
  await page.reload();

  // Re-open panel
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();

  // Debug: watch console
  page.on('console', m => console.log('PAGE LOG>', m.text()));

  // Set input files
  const tmp = await import('os');
  const pathMod = await import('path');
  const fs = await import('fs');
  const tmpFile = pathMod.join(tmp.tmpdir(), 'tmp_rovodev_import.json');
  fs.writeFileSync(tmpFile, JSON.stringify(json));

  const fileInput = page.locator('input[type="file"]').first();
  console.log('file input count', await fileInput.count());
  await fileInput.setInputFiles(tmpFile);
  console.log('setInputFiles invoked');

  // Wait for the import handler to set the migration completed flag
  const completed = await page.waitForFunction(() => !!localStorage.getItem('api_sim_migration_completed'), null, { timeout: 10000 });
  expect(await completed.jsonValue()).toBe(true);
});
