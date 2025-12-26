/**
 * Database Service with optional pluggable persistence backends.
 * - Default behavior remains compatible with existing synchronous API
 * - Supports backend: 'localStorage' (default), 'indexeddb', 'memory'
 * - Adds async helpers for consumers that want deterministic persistence
 */

const DB_PREFIX = "api_sim_db_";

/**
 * Detects if all IDs in a collection are numeric
 */
const isNumericIdStrategy = (ids: any[]): boolean => {
  return ids.length > 0 && ids.every((val: any) => typeof val === "number");
};

// Collections that should default to UUIDs when empty
const DEFAULT_UUID_COLLECTIONS = new Set<string>(["products", "items"]);

/**
 * Generates a numeric ID by finding the maximum and incrementing
 */
const generateNumericId = (ids: number[]): number => {
  const maxId = ids.reduce(
    (max: number, curr: number) => (curr > max ? curr : max),
    0
  );
  return maxId + 1;
};

/**
 * Generates a short UUID (first 8 characters)
 */
const generateShortUuid = (): string => {
  return crypto.randomUUID().split("-")[0];
};

// In-memory cache to keep synchronous API stable while persistence may be async
const cache: Record<string, any[]> = {};
let _backend: 'localStorage' | 'indexeddb' | 'memory' = 'localStorage';

const persistCollection = async (name: string, data: any[]) => {
  if (_backend === 'localStorage') {
    try {
      localStorage.setItem(DB_PREFIX + name, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving collection "${name}" to localStorage:`, e);
    }
    return;
  }

  if (_backend === 'indexeddb') {
    try {
      const mod = await import('./indexedDbService');
      await mod.indexedDbService.saveCollection(name, data);
    } catch (e) {
      console.warn(`Error saving collection "${name}" to IndexedDB:`, e);
    }
    return;
  }

  // memory backend: do nothing (cache already set)
};

const loadAllFromLocalStorage = () => {
  for (let i = 0; i < (localStorage.length || 0); i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DB_PREFIX)) {
      const name = key.replace(DB_PREFIX, "");
      try {
        cache[name] = JSON.parse(localStorage.getItem(key) || 'null') || [];
      } catch (e) {
        cache[name] = [];
      }
    }
  }
};

export const dbService = {
  /**
   * Get entire collection (synchronous API preserved)
   * Uses in-memory cache if available, otherwise falls back to localStorage.
   */
  getCollection: (name: string): any[] => {
    // If running in indexeddb mode and cache populated, prefer that for sync reads.
    if (_backend === 'indexeddb' && cache[name]) return cache[name];

    // Always read from localStorage for deterministic test behavior and to keep
    // behavior identical to previous implementation unless explicitly initialized
    // into indexeddb mode.
    try {
      const data = localStorage.getItem(DB_PREFIX + name);
      const parsed = data ? JSON.parse(data) : [];
      cache[name] = parsed;
      return parsed;
    } catch (error) {
      console.warn(`Error reading collection "${name}":`, error);
      cache[name] = [];
      return [];
    }
  },

  /**
   * Save entire collection (synchronous signature retained)
   * Persistence to backend is performed asynchronously in background.
   */
  saveCollection: (name: string, data: any[]): void => {
    cache[name] = data;
    (async () => {
      try {
        await persistCollection(name, data);
      } catch (err) {
        console.warn('Persist failed:', err);
      }
    })();
  },

  persistCollectionAsync: async (name: string, data: any[]): Promise<void> => {
    cache[name] = data;
    await persistCollection(name, data);
  },

  /**
   * Clear specific collection
   */
  clearCollection: (name: string): void => {
    delete cache[name];
    if (_backend === 'localStorage') {
      localStorage.removeItem(DB_PREFIX + name);
      return;
    }
    // async clear for indexedDB
    (async () => {
      if (_backend === 'indexeddb') {
        try {
          const mod = await import('./indexedDbService');
          await mod.indexedDbService.clearCollection(name);
        } catch (e) {
          console.warn('Error clearing collection in indexedDB:', e);
        }
      }
    })();
  },

  /**
   * List collections (from cache + localStorage fallback)
   */
  listCollections: (): string[] => {
    const names = new Set<string>(Object.keys(cache));
    for (let i = 0; i < (localStorage.length || 0); i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DB_PREFIX)) {
        names.add(key.replace(DB_PREFIX, ''));
      }
    }
    return Array.from(names);
  },

  find: (collection: string, id: string | number): any => {
    const list = dbService.getCollection(collection);
    return list.find((item: any) => item.id == id);
  },

  insert: (collection: string, item: any): any => {
    const list = dbService.getCollection(collection);

    if (item.id === undefined || item.id === null) {
      const existingIds = list
        .map((i: any) => i.id)
        .filter((val: any) => val !== undefined && val !== null);

      if (existingIds.length === 0) {
        if (DEFAULT_UUID_COLLECTIONS.has(collection)) {
          item.id = generateShortUuid();
        } else {
          item.id = 1;
        }
      } else if (isNumericIdStrategy(existingIds)) {
        item.id = generateNumericId(existingIds as number[]);
      } else {
        item.id = generateShortUuid();
      }
    }

    list.push(item);
    dbService.saveCollection(collection, list);
    return item;
  },

  update: (collection: string, id: string | number, updates: any): any => {
    const list = dbService.getCollection(collection);
    const index = list.findIndex((item: any) => item.id == id);

    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      dbService.saveCollection(collection, list);
      return list[index];
    }
    return null;
  },

  delete: (collection: string, id: string | number): boolean => {
    let list = dbService.getCollection(collection);
    const initialLen = list.length;

    list = list.filter((item: any) => item.id != id);

    if (list.length !== initialLen) {
      dbService.saveCollection(collection, list);
      return true;
    }
    return false;
  },

  getStats: (collection: string): { count: number; idType: 'numeric' | 'string' | 'mixed' } => {
    const list = dbService.getCollection(collection);

    if (list.length === 0) {
      return { count: 0, idType: 'mixed' };
    }

    const idTypes = new Set(list.map((item: any) => typeof item.id));
    let idType: 'numeric' | 'string' | 'mixed' = 'string';
    if (idTypes.size === 1) {
      idType = idTypes.has('number') ? 'numeric' : 'string';
    } else {
      idType = 'mixed';
    }

    return {
      count: list.length,
      idType,
    };
  },

  clearAllCollections: (): void => {
    const collections = dbService.listCollections();
    collections.forEach((col) => {
      dbService.clearCollection(col);
    });
  },

  /**
   * Initialize backends and optionally migrate data from localStorage to IndexedDB.
   * If backend is 'auto' it prefers IndexedDB when available.
   */
  init: async (opts?: { backend?: 'auto' | 'indexeddb' | 'localStorage' }) => {
    const backend = opts?.backend ?? 'auto';
    const hasIndexedDB = typeof (globalThis as any).indexedDB !== 'undefined';

    if (backend === 'indexeddb' || (backend === 'auto' && hasIndexedDB)) {
      try {
        _backend = 'indexeddb';
        const mod = await import('./indexedDbService');
        await mod.indexedDbService.init();

        // Try migration if localStorage has data
        const { migrated } = await mod.indexedDbService.migrateFromLocalStorage(DB_PREFIX);

        // Load all collections from indexedDB into cache for sync reads
        const cols = await mod.indexedDbService.listCollections();
        for (const c of cols) {
          cache[c] = await mod.indexedDbService.getCollection(c);
        }

        // Also pick up any leftover localStorage collections not migrated
        loadAllFromLocalStorage();

        return { migrated };
      } catch (error) {
        console.warn('IndexedDB init/migration failed:', error);
        // fallback to localStorage mode
        _backend = 'localStorage';
        loadAllFromLocalStorage();
        return { migrated: false };
      }
    }

    // localStorage mode: populate cache right away
    _backend = 'localStorage';
    loadAllFromLocalStorage();
    return { migrated: false };
  },

  // Async variants for new consumers
  getCollectionAsync: async (name: string) => {
    if (_backend === 'indexeddb') {
      try {
        const mod = await import('./indexedDbService');
        const data = await mod.indexedDbService.getCollection(name);
        cache[name] = data;
        return data;
      } catch (e) {
        console.warn('getCollectionAsync (indexeddb) failed:', e);
      }
    }
    // fallback to sync version
    return dbService.getCollection(name);
  },

};
