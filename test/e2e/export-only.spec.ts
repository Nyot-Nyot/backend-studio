import { expect, test } from '@playwright/test';

test('seed -> migrate -> export (export-only)', async ({ page }) => {
  await page.goto('/');
  // Seed data
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
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();

  const runBtn = page.getByRole('button', { name: /Run Migration/i }).first();
  if (await runBtn.count().then(c => c > 0) && await runBtn.isEnabled()) {
    await runBtn.click();
    await page.getByText(/Migration completed|Already migrated/i).waitFor({ timeout: 15000 });
  }

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export All Data/i }).click(),
  ]);
  const buf = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of buf!) chunks.push(chunk as Buffer);
  const json = JSON.parse(Buffer.concat(chunks as any).toString('utf-8'));

  // save for manual verification
  const os = await import('os');
  const pathMod = await import('path');
  const fs = await import('fs');
  const tmpFile = pathMod.join(os.tmpdir(), 'tmp_rovodev_export_only.json');
  fs.writeFileSync(tmpFile, JSON.stringify(json, null, 2));

  expect(Array.isArray(json.projects)).toBeTruthy();
});
