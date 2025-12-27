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
const isNumericIdStrategy = (ids: unknown[]): boolean => {
  return ids.length > 0 && ids.every((val) => typeof val === "number");
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
const cache: Record<string, Record<string, unknown>[]> = {};
let _backend: 'localStorage' | 'indexeddb' | 'memory' = 'localStorage';

import { logger } from './logger';
const log = logger('dbService');

const persistCollection = async (name: string, data: Record<string, unknown>[]) => {
  if (_backend === 'localStorage') {
    try {
      localStorage.setItem(DB_PREFIX + name, JSON.stringify(data));
    } catch (e) {
      log.error(`Error saving collection "${name}" to localStorage:`, e);
    }
    return;
  }

  if (_backend === 'indexeddb') {
    try {
      const mod = await import('./indexedDbService');
      await mod.indexedDbService.saveCollection(name, data);
    } catch (e) {
      log.warn(`Error saving collection "${name}" to IndexedDB:`, e);
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
  getCollection: (name: string): Record<string, unknown>[] => {
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
      log.warn(`Error reading collection "${name}":`, error);
      cache[name] = [];
      return [];
    }
  },

  /**
   * Save entire collection.
   * - Default: synchronous signature (fire-and-forget background persistence) to preserve existing behavior.
   * - If `opts.await` is true, returns a Promise that resolves when persistence completes.
   */
  saveCollection: (name: string, data: Record<string, unknown>[], opts?: { await?: boolean }): void | Promise<void> => {
    cache[name] = data;

    if (opts && opts.await) {
      // Return a Promise that resolves when persistence completes
      return (async () => {
        try {
          await persistCollection(name, data);
        } catch (err) {
          log.warn('Persist failed:', err);
        }
      })();
    }

    // Fire-and-forget (backwards compatible)
    (async () => {
      try {
        await persistCollection(name, data);
      } catch (err) {
        console.warn('Persist failed:', err);
      }
    })();

  },

  persistCollectionAsync: async (name: string, data: Record<string, unknown>[]): Promise<void> => {
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
          log.warn('Error clearing collection in indexedDB:', e);
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

  find: (collection: string, id: string | number): Record<string, unknown> | undefined => {
    const list = dbService.getCollection(collection);
    return list.find((item) => (item as { id?: unknown }).id == id) as Record<string, unknown> | undefined;
  },

  insert: (collection: string, item: Record<string, unknown>): Record<string, unknown> & { id: string | number } => {
    const list = dbService.getCollection(collection);

    if ((item as { id?: unknown }).id === undefined || (item as { id?: unknown }).id === null) {
      const existingIds = list
        .map((i) => (i as { id?: unknown }).id)
        .filter((val) => val !== undefined && val !== null) as unknown[];

      if (existingIds.length === 0) {
        if (DEFAULT_UUID_COLLECTIONS.has(collection)) {
          (item as { id?: unknown }).id = generateShortUuid();
        } else {
          (item as { id?: unknown }).id = 1 as unknown;
        }
      } else if (isNumericIdStrategy(existingIds)) {
        (item as { id?: unknown }).id = generateNumericId(existingIds as number[]);
      } else {
        (item as { id?: unknown }).id = generateShortUuid();
      }
    }

    list.push(item);
    dbService.saveCollection(collection, list);
    return item as Record<string, unknown> & { id: string | number };
  },

  update: (collection: string, id: string | number, updates: Partial<Record<string, unknown>>): Record<string, unknown> | null => {
    const list = dbService.getCollection(collection);
    const index = list.findIndex((item) => (item as { id?: unknown }).id == id);

    if (index !== -1) {
      list[index] = { ...list[index], ...updates } as Record<string, unknown>;
      dbService.saveCollection(collection, list);
      return list[index] as Record<string, unknown>;
    }
    return null;
  },

  delete: (collection: string, id: string | number): boolean => {
    let list = dbService.getCollection(collection);
    const initialLen = list.length;

    list = list.filter((item) => (item as { id?: unknown }).id != id);

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

    const idTypes = new Set(list.map((item) => typeof (item as { id?: unknown }).id));
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
   * Async variant: clear all collections and wait for backend persistence to finish.
   * Useful for deterministic flows like factory reset or import where we need to guarantee
   * the storage state before proceeding.
   */
  clearAllCollectionsAsync: async (): Promise<void> => {
    const collections = dbService.listCollections();
    // If using indexeddb backend, call indexedDbService to ensure persistence
    if (_backend === 'indexeddb') {
      try {
        const mod = await import('./indexedDbService');
        for (const c of collections) {
          await mod.indexedDbService.clearCollection(c);
        }
      } catch (e) {
        console.warn('clearAllCollectionsAsync (indexeddb) failed:', e);
        // Fallback to clearing localStorage items that match prefix
        for (const c of collections) {
          localStorage.removeItem(DB_PREFIX + c);
        }
      }
    } else {
      // localStorage or memory: clear synchronously
      for (const c of collections) {
        localStorage.removeItem(DB_PREFIX + c);
        delete cache[c];
      }
    }
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
        log.warn('IndexedDB init/migration failed:', error);
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
        log.warn('getCollectionAsync (indexeddb) failed:', e);
      }
    }
    // fallback to sync version
    return dbService.getCollection(name);
  },

};
