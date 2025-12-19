import { expect, test } from '@playwright/test';

// Ensures export -> import preserves data integrity between stores
test('export -> import preserves projects and mocks', async ({ page }) => {
  await page.goto('/');

  // Seed data with distinct values
  await page.evaluate(() => {
    localStorage.clear();
    const projects = [{ id: 'p-integrity', name: 'Integrity Project', createdAt: Date.now() }];
    const mocks = [{ id: 'm-integrity', projectId: 'p-integrity', name: 'Integrity Mock', path: '/api/integrity', method: 'POST', statusCode: 201, delay: 10, responseBody: '{"ok":true}', isActive: true, version: '1.0', createdAt: Date.now(), requestCount: 0, headers: [{ key: 'Content-Type', value: 'application/json' }], storeName: '', authConfig: { type: 'NONE' } }];
    const envVars = [{ id: 'env-integrity', projectId: 'p-integrity', key: 'API_URL', value: 'https://api.local' }];
    localStorage.setItem('api_sim_projects', JSON.stringify(projects));
    localStorage.setItem('api_sim_mocks', JSON.stringify(mocks));
    localStorage.setItem('api_sim_env_vars', JSON.stringify(envVars));
    localStorage.setItem('api_sim_active_project', 'p-integrity');
  });

  await page.reload();

  // Navigate to config and export
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

  // Debug: print exported content
  console.log('Exported projects:', JSON.stringify(exported.projects, null, 2));
  console.log('Exported mocks:', JSON.stringify(exported.mocks, null, 2));

  // Write export to a temp file
  const os = await import('os');
  const pathMod = await import('path');
  const fs = await import('fs');
  const tmpFile = pathMod.join(os.tmpdir(), 'tmp_integrity_export.json');
  fs.writeFileSync(tmpFile, JSON.stringify(exported, null, 2));
  console.log('Wrote export file:', tmpFile);

  // Clear storage and reload
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('BackendStudio'); });
  await page.reload();

  // Re-open panel and import using file input
  await page.getByText('Configuration', { exact: true }).click();
  await page.getByText('Data Storage Migration').scrollIntoViewIfNeeded();

  page.on('console', msg => console.log('PAGE LOG>', msg.text()));

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(tmpFile);

  // After importing via file input, check IndexedDB immediately (before reload) to ensure data written
  const written = await page.waitForFunction((expectedIds) => {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open('BackendStudio');
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains('mocks')) { resolve(false); return; }
            const tx = db.transaction('mocks', 'readonly');
            const store = tx.objectStore('mocks');
            const getAll = store.getAll();
            getAll.onsuccess = () => {
              const arr = getAll.result || [];
              const ids = arr.map((m: any) => m.id);
              const allPresent = expectedIds.every((id: any) => ids.includes(id));
              resolve({ allPresent, arr });
            };
            getAll.onerror = () => resolve(false);
          } catch (e) { resolve(false); }
        };
        req.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }, [exported.mocks.map((m: any) => m.id)], { timeout: 10000 });

  const writtenVal = await written.jsonValue();
  console.log('IndexedDB after import (immediate):', JSON.stringify(writtenVal, null, 2));

  // Wait for migration flag or import completion and for any navigation to finish
  await page.waitForFunction(() => !!localStorage.getItem('api_sim_migration_completed') || !!localStorage.getItem('api_sim_localStorage_backup'), null, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Read back IndexedDB stores and localStorage mirrors using a waitForFunction so it retries after navigation
  const resultHandle = await page.waitForFunction(() => {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open('BackendStudio');
        req.onsuccess = () => {
          try {
            const db = req.result;
            const readStore = (name) => new Promise(res => {
              if (!db.objectStoreNames.contains(name)) { res([]); return; }
              const tx = db.transaction(name, 'readonly');
              const store = tx.objectStore(name);
              const getAll = store.getAll();
              getAll.onsuccess = () => res(getAll.result || []);
              getAll.onerror = () => res([]);
            });

            Promise.all([readStore('projects'), readStore('mocks')]).then(([projects, mocks]) => {
              const lsProjects = localStorage.getItem('api_sim_projects');
              const lsMocks = localStorage.getItem('api_sim_mocks');
              resolve({ projects, mocks, lsProjects, lsMocks });
            }).catch(() => resolve(null));
          } catch (e) { resolve(null); }
        };
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }, null, { timeout: 10000 });

  const result = await resultHandle.jsonValue();


  // Parse mirrors if present
  const mirrorProjects = result.lsProjects ? JSON.parse(result.lsProjects) : [];
  const mirrorMocks = result.lsMocks ? JSON.parse(result.lsMocks) : [];

  // Compare exported vs imported (IndexedDB and mirrors)
  // Sort by id for deterministic comparison
  const sortById = (arr: any[]) => arr.slice().sort((a, b) => (a.id || '').localeCompare(b.id || ''));

  expect(sortById(result.projects)).toEqual(sortById(exported.projects || []));
  expect(sortById(result.mocks)).toEqual(sortById(exported.mocks || []));
  expect(sortById(mirrorProjects)).toEqual(sortById(exported.projects || []));
  expect(sortById(mirrorMocks)).toEqual(sortById(exported.mocks || []));
});
