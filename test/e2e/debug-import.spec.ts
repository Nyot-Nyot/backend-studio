import { test } from '@playwright/test';

test('debug migration panel', async ({ page }) => {
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
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/migration-panel.png', fullPage: true });
});
