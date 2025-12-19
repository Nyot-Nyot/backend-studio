import { STORAGE_KEYS } from '../constants';

// IndexedDB Database configuration
const DB_NAME = 'BackendStudio';
const DB_VERSION = 1;

// Object store names
export const STORES = {
  PROJECTS: 'projects',
  MOCKS: 'mocks',
  ENV_VARS: 'envVars',
  LOGS: 'logs',
  EMAIL_OUTBOX: 'emailOutbox',
  EMAIL_INBOX: 'emailInbox'
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

// Database connection instance
let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initIndexedDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB initialization failed:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('IndexedDB initialized successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores with appropriate indexes

      // Projects store
      if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
        projectStore.createIndex('name', 'name', { unique: false });
      }

      // Mocks store
      if (!db.objectStoreNames.contains(STORES.MOCKS)) {
        const mockStore = db.createObjectStore(STORES.MOCKS, { keyPath: 'id' });
        mockStore.createIndex('projectId', 'projectId', { unique: false });
        mockStore.createIndex('path', 'path', { unique: false });
        mockStore.createIndex('method', 'method', { unique: false });
      }

      // Environment Variables store
      if (!db.objectStoreNames.contains(STORES.ENV_VARS)) {
        const envStore = db.createObjectStore(STORES.ENV_VARS, { keyPath: 'id' });
        envStore.createIndex('projectId', 'projectId', { unique: false });
        envStore.createIndex('key', 'key', { unique: false });
      }

      // Logs store
      if (!db.objectStoreNames.contains(STORES.LOGS)) {
        const logStore = db.createObjectStore(STORES.LOGS, { keyPath: 'id' });
        logStore.createIndex('createdAt', 'createdAt', { unique: false });
        logStore.createIndex('projectId', 'projectId', { unique: false });
        logStore.createIndex('method', 'method', { unique: false });
        logStore.createIndex('status', 'status', { unique: false });
      }

      // Email Outbox store
      if (!db.objectStoreNames.contains(STORES.EMAIL_OUTBOX)) {
        const outboxStore = db.createObjectStore(STORES.EMAIL_OUTBOX, { keyPath: 'id' });
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
        outboxStore.createIndex('to', 'to', { unique: false });
      }

      // Email Inbox store
      if (!db.objectStoreNames.contains(STORES.EMAIL_INBOX)) {
        db.createObjectStore(STORES.EMAIL_INBOX, { keyPath: 'id' });
      }

      console.log('IndexedDB stores created/upgraded successfully');
    };
  });
}

// Generic CRUD operations
export class IndexedDBService {
  private static async getDB(): Promise<IDBDatabase> {
    if (!dbInstance) {
      await initIndexedDB();
    }
    return dbInstance!;
  }

  // Get all records from a store
  static async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get a single record by ID
  static async getById<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get records by index
  static async getByIndex<T>(storeName: StoreName, indexName: string, value: string): Promise<T[]> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);

    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Put (add or update) a single record
  static async put<T>(storeName: StoreName, data: T): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Put multiple records (bulk operation)
  static async putMany<T>(storeName: StoreName, dataArray: T[]): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      let completed = 0;
      const total = dataArray.length;

      if (total === 0) {
        resolve();
        return;
      }

      const handleComplete = () => {
        completed++;
        if (completed === total) resolve();
      };

      dataArray.forEach(data => {
        const request = store.put(data);
        request.onsuccess = handleComplete;
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Delete a record by ID
  static async delete(storeName: StoreName, id: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all records from a store
  static async clear(storeName: StoreName): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Count records in a store
  static async count(storeName: StoreName): Promise<number> {
    const db = await this.getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Check if IndexedDB is available
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// Export and Import functionality for backup
export async function exportAllData(): Promise<{ [key: string]: any[] }> {
  const data: { [key: string]: any[] } = {};

  // mapping from store name to localStorage key for fallback
  const lsMap: Record<string, string> = {
    [STORES.PROJECTS]: STORAGE_KEYS.PROJECTS,
    [STORES.MOCKS]: STORAGE_KEYS.MOCKS,
    [STORES.ENV_VARS]: STORAGE_KEYS.ENV_VARS,
    [STORES.LOGS]: STORAGE_KEYS.LOGS,
    [STORES.EMAIL_OUTBOX]: STORAGE_KEYS.EMAIL_OUTBOX,
    [STORES.EMAIL_INBOX]: STORAGE_KEYS.EMAIL_INBOX,
  };

  for (const storeName of Object.values(STORES)) {
    try {
      const idbRecords = await IndexedDBService.getAll(storeName);
      if (Array.isArray(idbRecords) && idbRecords.length > 0) {
        data[storeName] = idbRecords;
      } else {
        // fallback: export from localStorage mirror if IDB empty
        const lsKey = lsMap[storeName];
        if (lsKey) {
          const raw = localStorage.getItem(lsKey);
          data[storeName] = raw ? JSON.parse(raw) : [];
        } else {
          data[storeName] = [];
        }
      }
    } catch (error) {
      console.warn(`Failed to export data from ${storeName}:`, error);
      // fallback to localStorage
      const lsKey = lsMap[storeName];
      if (lsKey) {
        const raw = localStorage.getItem(lsKey);
        data[storeName] = raw ? JSON.parse(raw) : [];
      } else {
        data[storeName] = [];
      }
    }
  }

  return data;
}

export async function importAllData(data: { [key: string]: any[] }): Promise<void> {
  for (const [storeName, records] of Object.entries(data)) {
    if (Object.values(STORES).includes(storeName as StoreName)) {
      try {
        console.log(`Importing ${records.length || 0} records into store ${storeName}`);
        await IndexedDBService.clear(storeName as StoreName);
        await IndexedDBService.putMany(storeName as StoreName, records);
        console.log(`Imported ${records.length || 0} records into store ${storeName} successfully`);
      } catch (error) {
        console.warn(`Failed to import data to ${storeName}:`, error);
      }
    }
  }
}
