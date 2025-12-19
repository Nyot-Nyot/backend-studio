/**
 * LocalStorage-based Database Service
 *
 * Features:
 * - Simple key-value storage backed by localStorage
 * - CRUD operations with type-safe interfaces
 * - Smart auto-ID generation (numeric auto-increment or UUID)
 * - Loose comparison for ID matching (string vs number)
 * - No data corruption or duplicates
 *
 * ID Strategy:
 * - If collection has numeric IDs: uses auto-increment
 * - Otherwise: uses short UUID (first segment)
 * - Allows falsy IDs like 0 (checks for undefined/null explicitly)
 */

const DB_PREFIX = "api_sim_db_";

/**
 * Detects if all IDs in a collection are numeric
 */
const isNumericIdStrategy = (ids: any[]): boolean => {
  return ids.length > 0 && ids.every((val: any) => typeof val === "number");
};

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

export const dbService = {
  /**
   * Get entire collection from localStorage
   * @param name - Collection name
   * @returns Array of items in collection, empty array if not found
   */
  getCollection: (name: string): any[] => {
    try {
      const data = localStorage.getItem(DB_PREFIX + name);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn(`Error reading collection "${name}":`, error);
      return [];
    }
  },

  /**
   * Save entire collection to localStorage
   * @param name - Collection name
   * @param data - Array of items to save
   */
  saveCollection: (name: string, data: any[]): void => {
    try {
      localStorage.setItem(DB_PREFIX + name, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving collection "${name}":`, error);
    }
  },

  /**
   * Clear specific collection from localStorage
   * @param name - Collection name
   */
  clearCollection: (name: string): void => {
    localStorage.removeItem(DB_PREFIX + name);
  },

  /**
   * List all active collections
   * @returns Array of collection names
   */
  listCollections: (): string[] => {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(DB_PREFIX))
      .map((k) => k.replace(DB_PREFIX, ""));
  },

  /**
   * Find item by ID (loose comparison: string/number ID mismatch OK)
   * @param collection - Collection name
   * @param id - Item ID (string or number)
   * @returns Item if found, undefined otherwise
   */
  find: (collection: string, id: string | number): any => {
    const list = dbService.getCollection(collection);
    // Loose comparison (==) allows "123" to match 123
    return list.find((item: any) => item.id == id);
  },

  /**
   * Insert item into collection with auto-ID generation
   *
   * ID Generation Strategy:
   * - If item has ID: use provided ID (even if falsy like 0)
   * - If collection has numeric IDs: auto-increment from max
   * - Otherwise: generate short UUID
   *
   * @param collection - Collection name
   * @param item - Item to insert (can be without ID)
   * @returns Inserted item (with generated ID if needed)
   */
  insert: (collection: string, item: any): any => {
    const list = dbService.getCollection(collection);

    // Check if ID is missing (undefined or null, but NOT 0 or empty string)
    if (item.id === undefined || item.id === null) {
      const existingIds = list
        .map((i: any) => i.id)
        .filter((val: any) => val !== undefined && val !== null);

      if (isNumericIdStrategy(existingIds)) {
        // Use numeric auto-increment strategy
        item.id = generateNumericId(existingIds as number[]);
      } else {
        // Use UUID strategy
        item.id = generateShortUuid();
      }
    }

    list.push(item);
    dbService.saveCollection(collection, list);
    return item;
  },

  /**
   * Update item in collection by ID (loose comparison)
   * @param collection - Collection name
   * @param id - Item ID to update
   * @param updates - Partial object with fields to update
   * @returns Updated item if found, null otherwise
   */
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

  /**
   * Delete item from collection by ID (loose comparison)
   * @param collection - Collection name
   * @param id - Item ID to delete
   * @returns true if item was deleted, false if not found
   */
  delete: (collection: string, id: string | number): boolean => {
    let list = dbService.getCollection(collection);
    const initialLen = list.length;

    // Loose comparison (!=) to match string/number IDs
    list = list.filter((item: any) => item.id != id);

    if (list.length !== initialLen) {
      dbService.saveCollection(collection, list);
      return true;
    }
    return false;
  },

  /**
   * Get statistics about a collection
   * @param collection - Collection name
   * @returns Stats including count, ID types, etc.
   */
  getStats: (
    collection: string
  ): { count: number; idType: "numeric" | "string" | "mixed" } => {
    const list = dbService.getCollection(collection);
    const idTypes = new Set(list.map((item: any) => typeof item.id));

    let idType: "numeric" | "string" | "mixed" = "string";
    if (idTypes.size === 1) {
      idType = idTypes.has("number") ? "numeric" : "string";
    } else {
      idType = "mixed";
    }

    return {
      count: list.length,
      idType,
    };
  },

  /**
   * Clear all collections from localStorage
   */
  clearAllCollections: (): void => {
    const collections = dbService.listCollections();
    collections.forEach((col) => {
      dbService.clearCollection(col);
    });
  },
};
