
// A simple LocalStorage-based DB Engine

const DB_PREFIX = 'api_sim_db_';

export const dbService = {
  // Get entire collection
  getCollection: (name: string): any[] => {
    try {
      const data = localStorage.getItem(DB_PREFIX + name);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Save entire collection
  saveCollection: (name: string, data: any[]) => {
    localStorage.setItem(DB_PREFIX + name, JSON.stringify(data));
  },

  // Clear specific collection
  clearCollection: (name: string) => {
    localStorage.removeItem(DB_PREFIX + name);
  },

  // List all active collections
  listCollections: (): string[] => {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(DB_PREFIX))
      .map(k => k.replace(DB_PREFIX, ''));
  },

  // CRUD Operations
  find: (collection: string, id: string | number) => {
    const list = dbService.getCollection(collection);
    // Loose comparison for string/number ID mismatch
    return list.find((item: any) => item.id == id);
  },

  insert: (collection: string, item: any) => {
    const list = dbService.getCollection(collection);
    
    // Auto-generate ID if missing
    // Check explicitly for undefined/null to allow ID '0'
    if (item.id === undefined || item.id === null) {
      const existingIds = list.map((i: any) => i.id).filter((val: any) => val !== undefined && val !== null);
      
      // Smart Strategy: If existing items have numeric IDs, use Auto-Increment
      const isNumericStrategy = existingIds.length > 0 && existingIds.every((val: any) => typeof val === 'number');

      if (isNumericStrategy) {
        const maxId = existingIds.reduce((max: number, curr: number) => (curr > max ? curr : max), 0);
        item.id = maxId + 1;
      } else {
        // Default Strategy: UUID (Short)
        item.id = crypto.randomUUID().split('-')[0];
      }
    }

    list.push(item);
    dbService.saveCollection(collection, list);
    return item;
  },

  update: (collection: string, id: string | number, updates: any) => {
    const list = dbService.getCollection(collection);
    const index = list.findIndex((item: any) => item.id == id);
    
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      dbService.saveCollection(collection, list);
      return list[index];
    }
    return null;
  },

  delete: (collection: string, id: string | number) => {
    let list = dbService.getCollection(collection);
    const initialLen = list.length;
    list = list.filter((item: any) => item.id != id);
    
    if (list.length !== initialLen) {
      dbService.saveCollection(collection, list);
      return true;
    }
    return false;
  }
};
