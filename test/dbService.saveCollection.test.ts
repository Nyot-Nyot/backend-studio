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

// Test: saveCollection with await option should persist to localStorage
test('saveCollection with await option persists data to localStorage', async () => {
  const name = 'users_test';
  const data = [{ id: 1, name: 'Alice' }];

  await dbService.saveCollection(name, data, { await: true });

  const raw = localStorage.getItem('api_sim_db_' + name);
  assert(raw !== null, 'expected item in localStorage');
  const parsed = JSON.parse(raw as string);
  assert(Array.isArray(parsed), 'parsed should be array');
  assert(parsed.length === 1 && parsed[0].name === 'Alice', 'data persisted correctly');
});

// Test: saveCollection default (no await) returns void and schedules persistence
// We simulate by calling it and then checking that persistence eventually happened
test('saveCollection (fire-and-forget) does not throw and eventually persists', async () => {
  const name = 'users_async';
  const data = [{ id: 2, name: 'Bob' }];

  const ret = dbService.saveCollection(name, data);
  assert(ret === undefined, 'expected void return for fire-and-forget');

  // Wait a tiny bit for background task to complete
  await new Promise(r => setTimeout(r, 20));

  const raw = localStorage.getItem('api_sim_db_' + name);
  assert(raw !== null, 'expected item in localStorage after background persist');
  const parsed = JSON.parse(raw as string);
  assert(parsed.length === 1 && parsed[0].name === 'Bob', 'data persisted correctly');
});

(async function run() {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
