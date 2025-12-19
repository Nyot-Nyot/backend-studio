import { expect, test } from '@playwright/test';

test('create -> export -> delete workspace -> import restores project and mocks', async ({ page }) => {
  await page.goto('/');

  // Create a new workspace via the sidebar
  await page.getByRole('button', { name: /New Workspace/i }).click();
  const input = page.locator('input[placeholder="Workspace Name"]').first();
  await input.fill('ToDeleteProject');
  await page.getByRole('button', { name: /Create/i }).click();

  // Create a new route
  await page.getByRole('button', { name: /Design Route/i }).click();
  const pathInput = page.locator('input[placeholder^="/api"]');
  await pathInput.fill('/delete/test-endpoint');
  const nameInput = page.getByPlaceholder('e.g. Fetch User Profile').first();
  await nameInput.fill('Delete Test Endpoint');
  await page.getByRole('button', { name: /Save Route/i }).click();
  await page.waitForTimeout(200);
  await expect(page.getByText('Route saved successfully')).toBeVisible({ timeout: 5000 });

  // Wait until the mocks mirror is updated (ensure the route persisted before exporting)
  await page.waitForFunction(() => {
    try {
      const raw = localStorage.getItem('api_sim_mocks');
      return raw && JSON.parse(raw).some((m: any) => m.path === '/delete/test-endpoint');
    } catch { return false; }
  }, null, { timeout: 5000 });

  // Export
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();

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
  const tmpFile = pathMod.join(os.tmpdir(), 'tmp_delete_export.json');
  fs.writeFileSync(tmpFile, JSON.stringify(exported, null, 2));

  // Delete the workspace via UI (Trash button in Sidebar)
  await page.getByTitle('Delete current workspace').click();

  // Confirm project removed from localStorage
  await page.waitForFunction(() => {
    try { const raw = localStorage.getItem('api_sim_projects'); return raw && !JSON.parse(raw).some((p: any) => p.name === 'ToDeleteProject'); } catch { return false; }
  }, null, { timeout: 5000 });

  // Re-open configuration and import using file input
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  page.on('console', m => console.log('PAGE LOG>', m.text()));

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(tmpFile);

  // The import handler triggers a reload; wait for navigation to finish and the migration flag
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => { });
  await page.waitForFunction(() => !!localStorage.getItem('api_sim_migration_completed') || !!localStorage.getItem('api_sim_localStorage_backup'), null, { timeout: 10000 });

  // Verify the imported project and mock exist in IndexedDB
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
  console.log('Post-import data:', JSON.stringify(result, null, 2));

  expect(result.projects.some((p: any) => p.name === 'ToDeleteProject')).toBeTruthy();
  expect(result.mocks.some((m: any) => m.path === '/delete/test-endpoint')).toBeTruthy();

  // Ensure UI selected the imported project automatically and shows the endpoint
  const activeProjectId = await page.evaluate(() => localStorage.getItem('api_sim_active_project'));
  const exportedProject = exported.projects && exported.projects.find((p: any) => p.name === 'ToDeleteProject');
  expect(exportedProject).toBeTruthy();
  expect(activeProjectId).toBe(exportedProject?.id);

  // Make sure the restored project is selected in the UI (select it explicitly if needed)
  const exportedProjectIdFinal = exported.projects && exported.projects.find((p: any) => p.name === 'ToDeleteProject')?.id;
  if (exportedProjectIdFinal) {
    await page.selectOption('select', exportedProjectIdFinal);
  }

  // Wait until IndexedDB contains the imported mock path for the restored project (ensures DB write finished)
  await page.waitForFunction(() => {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open('BackendStudio');
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains('mocks')) { resolve(false); return; }
            const tx = db.transaction('mocks', 'readonly');
            const store = tx.objectStore('mocks');
            const r = store.getAll();
            r.onsuccess = () => {
              const arr = r.result || [];
              resolve(arr.some((m: any) => m.path === '/delete/test-endpoint'));
            };
            r.onerror = () => resolve(false);
          } catch (e) { resolve(false); }
        };
        req.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }, null, { timeout: 10000 });

  // The Dashboard should show the route under the selected project
  await page.locator('nav').getByText('Overview').first().click();
  await page.waitForTimeout(200);
  await expect(page.getByText('Delete Test Endpoint')).toBeVisible({ timeout: 10000 });
});
