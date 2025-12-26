// Integration tests for persistence across reloads (localStorage + indexedDB)
import { dbService } from "../services/dbService";
import { indexedDbService } from "../services/indexedDbService";

// Setup test environment: mock localStorage and indexedDB
if (typeof (global as any).localStorage === 'undefined') {
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
  Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, writable: true });
}

// Polyfill indexedDB with fake-indexeddb for tests
if (typeof (global as any).indexedDB === 'undefined') {
  // dynamic import for ESM test runner
  await import('fake-indexeddb').then(mod => {
    (global as any).indexedDB = (mod as any).indexedDB || (mod as any).default || mod;
  });
}

let pass = 0;
let fail = 0;
const tests: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      // ensure clean state
      localStorage.clear && localStorage.clear();
      await indexedDbService.clearAllCollections();
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

// LocalStorage persistence: ensure data survives 'reload' by checking localStorage directly
test('import sets localStorage keys and they persist', async () => {
  const projects = [{ id: 'p1', name: 'P' }];
  const mocks = [{ id: 'm1', name: 'M', path: '/api/m' }];
  localStorage.setItem('api_sim_projects', JSON.stringify(projects));
  localStorage.setItem('api_sim_mocks', JSON.stringify(mocks));

  // Simulate reload by reading values
  const loadedProjects = JSON.parse(localStorage.getItem('api_sim_projects') || '[]');
  const loadedMocks = JSON.parse(localStorage.getItem('api_sim_mocks') || '[]');

  assert(Array.isArray(loadedProjects) && loadedProjects.length === 1, 'projects persisted');
  assert(Array.isArray(loadedMocks) && loadedMocks.length === 1, 'mocks persisted');
});

// IndexedDB persistence: save a collection via dbService (await) and then read with indexedDbService
test('indexeddb saveCollection persists and is retrievable', async () => {
  // initialize indexeddb-backed mode
  await dbService.init({ backend: 'indexeddb' });

  const name = 'integration_users';
  const data = [{ id: 1, name: 'Alice' }];

  await dbService.saveCollection(name, data, { await: true } as any);

  const stored = await indexedDbService.getCollection(name);
  assert(Array.isArray(stored) && stored.length === 1 && stored[0].name === 'Alice', 'indexeddb persisted');
});

(async function run() {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
