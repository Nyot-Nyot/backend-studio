import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { indexedDbService } from '../services/indexedDbService';

// Simple in-memory localStorage shim for Node test environment
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
  await indexedDbService.init();

  // migrate existing localStorage entries
  // add a broken key to test error reporting
  localStorage.setItem('api_sim_db_broken', 'not-json');
  localStorage.setItem('api_sim_db_users', JSON.stringify([{ id: 1, name: 'Alice' }]));
  const mig = await indexedDbService.migrateFromLocalStorage('api_sim_db_');
  assert.equal(mig.migrated, true);
  assert.deepEqual(mig.migratedKeys, ['users']);
  // errors should include the broken key
  assert.ok(Array.isArray((mig as any).errors) && (mig as any).errors.length === 1, 'should report one error');
  assert.equal((mig as any).errors[0].key, 'api_sim_db_broken');

  const users = await indexedDbService.getCollection('users');
  assert.equal(users.length, 1);
  assert.equal(users[0].name, 'Alice');

  const inserted = await indexedDbService.insert('users', { name: 'Bob' });
  assert.ok(inserted.id !== undefined);

  const all = await indexedDbService.getCollection('users');
  assert.equal(all.length, 2);

  const updated = await indexedDbService.update('users', inserted.id, { name: 'Bobby' });
  assert.equal(updated.name, 'Bobby');

  const deleted = await indexedDbService.delete('users', 1);
  assert.equal(deleted, true);
  const afterDel = await indexedDbService.getCollection('users');
  assert.equal(afterDel.length, 1);

  // products collection should use short UUID for first id
  const prod = await indexedDbService.insert('products', { name: 'Widget' });
  assert.equal(typeof prod.id, 'string');

  console.log('indexedDbService tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
