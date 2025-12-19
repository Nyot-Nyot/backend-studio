import { expect, test } from '@playwright/test';

test('UI create project+endpoint -> export -> import preserves data', async ({ page }) => {
  await page.goto('/');

  // Create a new workspace via the sidebar
  await page.getByRole('button', { name: /New Workspace/i }).click();
  const input = page.locator('input[placeholder="Workspace Name"]').first();
  await input.fill('UI Project');
  await page.getByRole('button', { name: /Create/i }).click();

  // Ensure the project is present in storage
  await page.waitForFunction(() => {
    try { const raw = localStorage.getItem('api_sim_projects'); return raw && JSON.parse(raw).some((p: any) => p.name === 'UI Project'); } catch { return false; }
  }, null, { timeout: 5000 });
  const projectsRaw = await page.evaluate(() => localStorage.getItem('api_sim_projects'));
  const projects = JSON.parse(projectsRaw || '[]');
  const project = projects.find((p: any) => p.name === 'UI Project');
  expect(project).toBeTruthy();

  // Create a new route via Design Route
  await page.getByRole('button', { name: /Design Route/i }).click();

  // Fill Resource Path and Internal Name
  const pathInput = page.locator('input[placeholder^="/api"]');
  await pathInput.fill('/ui/test-endpoint');
  const nameInput = page.getByPlaceholder('e.g. Fetch User Profile').first();
  await nameInput.fill('UI Test Endpoint');

  // Save the route
  await page.getByRole('button', { name: /Save Route/i }).click();
  // Wait for toast or for Dashboard to show the route
  await page.waitForTimeout(500);
  await expect(page.getByText('Route saved successfully')).toBeVisible({ timeout: 5000 });

  // Export data via Configuration -> Export All Data
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export All Data/i }).click(),
  ]);

  const buf = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of buf!) chunks.push(chunk as Buffer);
  const exported = JSON.parse(Buffer.concat(chunks as any).toString('utf-8'));

  // Save export to tmp file
  const os = await import('os');
  const pathMod = await import('path');
  const fs = await import('fs');
  const tmpFile = pathMod.join(os.tmpdir(), 'tmp_ui_export.json');
  fs.writeFileSync(tmpFile, JSON.stringify(exported, null, 2));

  // Clear storage and reload
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('BackendStudio'); });
  await page.reload();

  // Import via UI
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(tmpFile);

  // Wait for import logs / completion
  page.on('console', m => console.log('PAGE LOG>', m.text()));
  await page.waitForFunction(() => !!localStorage.getItem('api_sim_migration_completed') || !!localStorage.getItem('api_sim_localStorage_backup'), null, { timeout: 10000 });

  // Read back IndexedDB to verify (use waitForFunction to survive reload)
  const resultHandle = await page.waitForFunction(() => {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open('BackendStudio');
        req.onsuccess = () => {
          try {
            const db = req.result;
            const read = (name) => new Promise(res => {
              if (!db.objectStoreNames.contains(name)) return res([]);
              const tx = db.transaction(name, 'readonly');
              const store = tx.objectStore(name);
              const r = store.getAll();
              r.onsuccess = () => res(r.result || []);
              r.onerror = () => res([]);
            });
            Promise.all([read('projects'), read('mocks')]).then(([projects, mocks]) => resolve({ projects, mocks }));
          } catch (e) { resolve(null); }
        };
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }, null, { timeout: 10000 });

  const result = await resultHandle.jsonValue();

  expect(Array.isArray(exported.projects) && exported.projects.some((p: any) => p.name === 'UI Project')).toBeTruthy();
  expect(Array.isArray(exported.mocks) && exported.mocks.some((m: any) => m.path === '/ui/test-endpoint')).toBeTruthy();

  expect(result.projects.some((p: any) => p.name === 'UI Project')).toBeTruthy();
  expect(result.mocks.some((m: any) => m.path === '/ui/test-endpoint')).toBeTruthy();
});
