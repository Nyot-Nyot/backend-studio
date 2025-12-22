import { expect, test } from '@playwright/test';

test('migrates localStorage collections to IndexedDB on bootstrap', async ({ page }) => {
  // Inject a script that runs before any page scripts to pre-populate localStorage
  await page.addInitScript(() => {
    localStorage.setItem('api_sim_db_migrtest', JSON.stringify([{ id: 1, name: 'Alice' }]));
  });

  // Navigate to app (index.tsx will call dbService.init on startup)
  await page.goto('/');

  // Open the Database view in the sidebar then verify the 'migrtest' collection is present
  await page.getByText('Database').click();

  const collectionButton = page.getByRole('button', { name: 'migrtest' });
  await expect(collectionButton).toBeVisible({ timeout: 5000 });

  // Open the collection and verify data is visible in the table
  await collectionButton.click();
  await expect(page.getByText('Alice')).toBeVisible();

  // Verify IndexedDB contains the migrated collection
  const idxData: any = await page.evaluate(async () => {
    const dbName = 'backendStudioDB';
    const req = indexedDB.open(dbName, 1);
    return await new Promise((res, rej) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('collections', 'readonly');
        const store = tx.objectStore('collections');
        const r = store.get('migrtest');
        r.onsuccess = () => res(r.result ? r.result.data : null);
        r.onerror = () => rej(r.error);
      };
      req.onerror = () => rej(req.error);
    });
  });

  expect(idxData).toBeTruthy();
  expect(Array.isArray(idxData)).toBe(true);
  expect(idxData.length).toBe(1);
  expect(idxData[0].name).toBe('Alice');
});
