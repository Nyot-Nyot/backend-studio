export interface SchemaField {
  id: string;
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  children?: SchemaField[];
  isCollapsed?: boolean;
  error?: string;
}

const defaultGenerateId = () => (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `id_${Math.random().toString(36).slice(2, 9)}`);

export const deepClone = <T>(v: T): T => {
  if (typeof (globalThis as any).structuredClone === "function") {
    return (globalThis as any).structuredClone(v);
  }
  // Fallback simple deep clone for JSON-serializable structures
  return JSON.parse(JSON.stringify(v));
};

// Parse a JSON value (object or array) into a SchemaField tree. Accepts optional generateId for stable ids.
export const parseJsonToSchema = (data: unknown, generateId: () => string = defaultGenerateId): SchemaField[] => {
  if (typeof data !== "object" || data === null) return [];

  // If data is array, represent it as numeric-keyed object entries: 0..n-1
  if (Array.isArray(data)) {
    return (data as any[]).map((value, idx) => {
      const key = String(idx);
      return createFieldFromValue(key, value, generateId);
    });
  }

  return Object.entries(data as Record<string, unknown>).map(([key, value]) => createFieldFromValue(key, value, generateId));
};

const createFieldFromValue = (key: string, value: unknown, generateId: () => string): SchemaField => {
  const field: SchemaField = {
    id: generateId(),
    key,
    value: "",
    type: "string",
    children: [],
    isCollapsed: false,
  };

  if (value === null) {
    field.type = "null";
    field.value = "null";
  } else if (Array.isArray(value)) {
    field.type = "array";
    field.value = JSON.stringify(value);
  } else if (typeof value === "object") {
    field.type = "object";
    field.children = parseJsonToSchema(value, generateId);
  } else if (typeof value === "number") {
    field.type = "number";
    field.value = String(value);
  } else if (typeof value === "boolean") {
    field.type = "boolean";
    field.value = String(value);
  } else {
    field.type = "string";
    field.value = String(value as any);
  }

  return field;
};

export class SchemaConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaConversionError";
  }
}

// Convert SchemaField[] into JSON. Throws SchemaConversionError for invalid numbers/arrays.
export const convertSchemaToJson = (fields: SchemaField[], isRootArray = false): any => {
  const obj: Record<string, unknown> = {};

  for (const field of fields) {
    if (!field.key) continue;

    if (field.type === "object") {
      obj[field.key] = convertSchemaToJson(field.children || [], false);
    } else if (field.type === "number") {
      const n = parseFloat(field.value);
      if (isNaN(n)) throw new SchemaConversionError(`Invalid number for key '${field.key}': ${field.value}`);
      obj[field.key] = n;
    } else if (field.type === "boolean") {
      obj[field.key] = field.value === "true";
    } else if (field.type === "array") {
      try {
        obj[field.key] = JSON.parse(field.value);
      } catch (e) {
        throw new SchemaConversionError(`Invalid JSON array for key '${field.key}': ${(e as Error).message}`);
      }
    } else if (field.type === "null") {
      obj[field.key] = null;
    } else {
      obj[field.key] = field.value;
    }
  }

  if (isRootArray) {
    // If root is array, collect numeric keys in order
    const pairs = Object.entries(obj)
      .map(([k, v]) => ({ k, idx: Number(k), v }))
      .filter(p => !Number.isNaN(p.idx))
      .sort((a, b) => a.idx - b.idx);
    return pairs.map(p => p.v);
  }

  return obj;
};

// Move a field up/down within the tree, returning a new tree
export const moveFieldInTree = (fields: SchemaField[], id: string, direction: "up" | "down") => {
  const cloned = deepClone(fields);
  let moved = false;

  const helper = (list: SchemaField[]): boolean => {
    const idx = list.findIndex(f => f.id === id);
    if (idx !== -1) {
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx >= 0 && swapIdx < list.length) {
        [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
        moved = true;
      }
      return true;
    }
    for (const item of list) {
      if (item.children && helper(item.children)) return true;
    }
    return false;
  };

  helper(cloned);
  return { moved, result: cloned };
};

// Validate JSON structure and return a structured error with approximate line number when invalid
export const validateJsonStructure = (
  jsonString: string
): { message: string; position?: number; line?: number } | null => {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed === null) return { message: "Root cannot be null for Visual Editor" };
    if (typeof parsed !== "object") return { message: "Root element must be an Object {} or Array [] for Visual Editing" };
    return null;
  } catch (e) {
    const msg = (e as Error).message || "Invalid JSON";
    const pos = findErrorPosition(jsonString);
    const line = pos !== null ? jsonString.substring(0, pos).split("\n").length : undefined;
    return { message: msg, position: pos ?? undefined, line };
  }
};

// Find approximate first position where parsing breaks via binary search on the string length
const findErrorPosition = (s: string): number | null => {
  let low = 0;
  let high = s.length;
  let lastGood = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    try {
      JSON.parse(s.substring(0, mid));
      lastGood = mid;
      low = mid + 1;
    } catch (e) {
      high = mid - 1;
    }
  }

  if (lastGood === -1) return 0;
  return Math.min(s.length, lastGood + 1);
};
