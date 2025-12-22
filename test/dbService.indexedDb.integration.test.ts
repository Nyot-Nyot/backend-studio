import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { dbService } from '../services/dbService';

// localStorage shim (same as other tests)
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = (function () {
    const store: Record<string, string> = {};
    return {
      getItem: (key: string) => (store[key] === undefined ? null : store[key]),
      setItem: (key: string, v: string) => (store[key] = v + ''),
      removeItem: (key: string) => delete store[key],
      key: (i: number) => Object.keys(store)[i] || null,
      get length() {
        return Object.keys(store).length;
      },
      clear: () => {
        for (const key of Object.keys(store)) delete store[key];
      },
    };
  })();
}

async function run() {
  localStorage.setItem('api_sim_db_todos', JSON.stringify([{ id: 10, title: 'test' }]));
  const result = await dbService.init({ backend: 'indexeddb' });
  assert.equal(result.migrated, true);

  const mod = await import('../services/indexedDbService');
  const todos = await mod.indexedDbService.getCollection('todos');
  assert.equal(todos.length, 1);
  assert.equal(todos[0].id, 10);

  console.log('dbService indexedDB integration test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
