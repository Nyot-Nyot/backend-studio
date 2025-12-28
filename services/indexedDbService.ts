/* Minimal IndexedDB-backed service
 * - Uses a single object store `collections` keyed by collection name
 * - Provides Promise-based CRUD and migration helper
 * - Intentionally small/synchronous implementation to avoid extra dependencies
 */

const DEFAULT_DB_NAME = "backendStudioDB";
const DEFAULT_STORE_NAME = "collections";

import { generateIdForCollection } from './idUtils';

const hasIndexedDB = typeof indexedDB !== 'undefined';
const inMemoryStore: Record<string, any[]> = {};

const openDB = (dbName = DEFAULT_DB_NAME): Promise<IDBDatabase | null> => {
  if (!hasIndexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);

    req.onupgradeneeded = (ev: IDBVersionChangeEvent) => {
      const db = (ev.target as IDBOpenDBRequest).result as IDBDatabase;
      if (!db.objectStoreNames.contains(DEFAULT_STORE_NAME)) {
        db.createObjectStore(DEFAULT_STORE_NAME, { keyPath: "name" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const putRecord = async (db: IDBDatabase | null, name: string, data: any[]) => {
  if (!hasIndexedDB || db === null) {
    inMemoryStore[name] = data;
    return;
  }
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEFAULT_STORE_NAME, "readwrite");
    const store = tx.objectStore(DEFAULT_STORE_NAME);
    const req = store.put({ name, data });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const getRecord = async (db: IDBDatabase | null, name: string): Promise<any[] | null> => {
  if (!hasIndexedDB || db === null) {
    return inMemoryStore[name] ?? null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEFAULT_STORE_NAME, "readonly");
    const store = tx.objectStore(DEFAULT_STORE_NAME);
    const req = store.get(name);
    req.onsuccess = () => resolve(req.result ? req.result.data : null);
    req.onerror = () => reject(req.error);
  });
};

const getAllKeys = async (db: IDBDatabase | null): Promise<string[]> => {
  if (!hasIndexedDB || db === null) {
    return Object.keys(inMemoryStore);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEFAULT_STORE_NAME, "readonly");
    const store = tx.objectStore(DEFAULT_STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
};

export const indexedDbService = {
  init: async (dbName = DEFAULT_DB_NAME) => {
    await openDB(dbName); // ensure DB exists
  },

  getCollection: async (name: string): Promise<any[]> => {
    const db = await openDB();
    const data = await getRecord(db, name);
    return data || [];
  },

  saveCollection: async (name: string, data: any[]): Promise<void> => {
    const db = await openDB();
    await putRecord(db, name, data || []);
  },

  listCollections: async (): Promise<string[]> => {
    const db = await openDB();
    const keys = await getAllKeys(db);
    return keys.filter(Boolean);
  },

  clearCollection: async (name: string): Promise<void> => {
    const db = await openDB();
    if (!hasIndexedDB || db === null) {
      delete inMemoryStore[name];
      return;
    }
    await putRecord(db, name, []);
  },

  clearAllCollections: async (): Promise<void> => {
    const db = await openDB();
    if (!hasIndexedDB || db === null) {
      // clear in-memory store
      for (const k of Object.keys(inMemoryStore)) delete inMemoryStore[k];
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEFAULT_STORE_NAME, "readwrite");
      const store = tx.objectStore(DEFAULT_STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  insert: async (collection: string, item: any): Promise<any> => {
    const list = (await indexedDbService.getCollection(collection)) || [];
    // simple id generation if needed
    if (item.id === undefined || item.id === null) {
      const existingIds = list.map((i: any) => i.id).filter((v: any) => v !== undefined && v !== null);
      const generated = generateIdForCollection(existingIds, collection);
      item.id = generated;
    }
    list.push(item);
    await indexedDbService.saveCollection(collection, list);
    return item;
  },

  update: async (collection: string, id: string | number, updates: any): Promise<any | null> => {
    const list = (await indexedDbService.getCollection(collection)) || [];
    const idx = list.findIndex((it: any) => it.id == id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    await indexedDbService.saveCollection(collection, list);
    return list[idx];
  },

  delete: async (collection: string, id: string | number): Promise<boolean> => {
    const list = (await indexedDbService.getCollection(collection)) || [];
    const newList = list.filter((it: any) => it.id != id);
    if (newList.length === list.length) return false;
    await indexedDbService.saveCollection(collection, newList);
    return true;
  },

  bulkGet: async (collection: string, ids: (string | number)[]) => {
    const list = (await indexedDbService.getCollection(collection)) || [];
    return list.filter((it: any) => ids.includes(it.id));
  },

  // Simple migration helper that moves `localStorage` keys with given prefix
  migrateFromLocalStorage: async (prefix = "api_sim_db_") => {
    // if no localStorage available, nothing to migrate
    const hasLocalStorage = typeof (globalThis as any).localStorage !== 'undefined' && (globalThis as any).localStorage !== null;
    if (!hasLocalStorage) return { migrated: false, migratedKeys: [], errors: [] } as const;

    const migratedKeys: string[] = [];
    const errors: { key: string; message: string }[] = [];

    // Take a snapshot of existing keys to avoid issues if localStorage changes during iteration
    const keys: string[] = [];
    const ls = (globalThis as any).localStorage as Storage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k !== null) keys.push(k);
    }

    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;

      const name = key.replace(prefix, "");
      try {
        const raw = ls.getItem(key);
        const data = raw ? JSON.parse(raw) : null;
        await indexedDbService.saveCollection(name, data || []);
        migratedKeys.push(name);
      } catch (e: any) {
        // Record malformed data and continue to next key
        errors.push({ key, message: String(e?.message || e) });
        continue;
      }
    }

    return { migrated: migratedKeys.length > 0, migratedKeys, errors } as const;
  },
};
