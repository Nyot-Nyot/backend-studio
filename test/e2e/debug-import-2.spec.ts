import { test } from '@playwright/test';

test('inspect import input', async ({ page }) => {
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
  await page.waitForTimeout(500);

  const label = page.locator('label:has-text("Import Data")').first();
  console.log('label count', await label.count());
  if (await label.count() > 0) {
    console.log('label outerHTML:\n', await label.evaluate(n => n.outerHTML));
    const input = label.locator('input[type="file"]').first();
    console.log('input count under label', await input.count());
    if (await input.count() > 0) {
      const attrs = await input.evaluate(n => ({
        type: n.type,
        accept: n.accept,
        disabled: n.disabled,
        hidden: n.hidden,
        class: n.getAttribute('class'),
        style: n.getAttribute('style'),
        visible: !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length),
      }));
      console.log('input attrs', attrs);
    }
  }

  const allInputs = page.locator('input[type="file"]');
  console.log('all input count', await allInputs.count());
  if (await allInputs.count() > 0) {
    console.log('first input outerHTML:\n', await allInputs.first().evaluate(n => n.outerHTML));
  }
});
