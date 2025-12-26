import { dbService } from "../services/dbService";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] || null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

let pass = 0;
let fail = 0;
const tests: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      mockLocalStorage.clear();
      await fn();
      console.log(`✅ PASS: ${name}`);
      pass++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      fail++;
    }
  });
}

function assert(cond: boolean, msg = "assert") {
  if (!cond) throw new Error(msg);
}

// Test clearAllCollectionsAsync clears persisted localStorage keys
test('clearAllCollectionsAsync removes all DB_PREFIX keys from localStorage', async () => {
  // Create two collections via saveCollection with await
  await dbService.saveCollection('users', [{ id: 1, name: 'A' }], { await: true } as any);
  await dbService.saveCollection('posts', [{ id: 1, title: 'X' }], { await: true } as any);

  // Sanity
  const keysBefore = [] as string[];
  for (let i = 0; i < (localStorage.length || 0); i++) keysBefore.push(localStorage.key(i) || '');
  assert(keysBefore.some(k => k?.includes('api_sim_db_users')));
  assert(keysBefore.some(k => k?.includes('api_sim_db_posts')));

  await dbService.clearAllCollectionsAsync();

  const keysAfter = [] as string[];
  for (let i = 0; i < (localStorage.length || 0); i++) keysAfter.push(localStorage.key(i) || '');
  assert(!keysAfter.some(k => k?.includes('api_sim_db_users')));
  assert(!keysAfter.some(k => k?.includes('api_sim_db_posts')));
});

(async function run() {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
