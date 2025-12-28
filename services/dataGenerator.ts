import { ResourceField, ResourceSchema } from "../types";

const sampleNames = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"];

// Simple deterministic RNG utilities (seed optional). If no seed is provided, we fall back to Math.random
function xfnv1a(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) >>> 0;
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed?: string | number) {
  if (seed === undefined || seed === null) {
    return {
      random: () => Math.random(),
      randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
      choice: <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)],
    };
  }
  const seedNum = typeof seed === "number" ? seed : xfnv1a(String(seed));
  const rnd = mulberry32(seedNum);
  return {
    random: rnd,
    randomInt: (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min,
    choice: <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)],
  };
}

function deterministicUuid(rng: { random: () => number }) {
  // produce a v4-like pseudo-uuid deterministically from the RNG
  function hex(n: number) {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += Math.floor(rng.random() * 16).toString(16);
    }
    return s;
  }
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.floor(rng.random() * 4) + 8).toString(16))}${hex(3)}-${hex(
    12
  )}`;
}

function genValueForField(
  field: ResourceField,
  rng: ReturnType<typeof createRng>,
  schemaMap?: Record<string, ResourceSchema>,
  depth: number = 0,
  maxDepth: number = 3
): any {
  const gen = field.generator || "";
  switch (gen) {
    case "uuid":
      return rng.random === Math.random ? (crypto?.randomUUID ? crypto.randomUUID() : deterministicUuid(rng)) : deterministicUuid(rng);
    case "randomName":
      return rng.choice(sampleNames);
    case "email":
      return `${rng.choice(sampleNames).toLowerCase()}${rng.randomInt(0, 999)}@example.com`;
    case "isoDate":
      // deterministic date derived from RNG so repeated runs with the same seed are stable
      // base epoch: 2021-01-01 (1609459200000)
      return new Date(1609459200000 + Math.floor(rng.random() * 1000 * 60 * 60 * 24 * 365)).toISOString();
    case "number":
      return rng.randomInt(0, 1000);
    case "boolean":
      return rng.random() < 0.5;
    default:
      // Fallback: generate simple value by type
      switch (field.type) {
        case "string":
          return `${field.name}_${rng.randomInt(0, 9999)}`;
        case "number":
          return rng.randomInt(0, 1000);
        case "boolean":
          return rng.random() < 0.5;
        case "date":
          return new Date().toISOString();
        case "object": {
          if (depth >= maxDepth) return {};
          const nested = field.nestedSchemaId && schemaMap ? schemaMap[field.nestedSchemaId] : undefined;
          if (nested) return generateRecord(nested, undefined, { seed: undefined, schemaMap, rng, maxDepth, depth: depth + 1 });
          return {};
        }
        case "array": {
          if (depth >= maxDepth) return [];
          const nested = field.nestedSchemaId && schemaMap ? schemaMap[field.nestedSchemaId] : undefined;
          const len = rng.randomInt(1, 3);
          if (nested) {
            const arr = [] as any[];
            for (let i = 0; i < len; i++) {
              arr.push(generateRecord(nested, undefined, { seed: undefined, schemaMap, rng, maxDepth, depth: depth + 1 }));
            }
            return arr;
          }
          return [];
        }
        default:
          return null;
      }
  }
}

export type GenerateOptions = {
  seed?: string | number;
  schemaMap?: Record<string, ResourceSchema>;
  maxDepth?: number;
  // internal use: allow passing an existing rng or current recursion depth
  rng?: ReturnType<typeof createRng>;
  depth?: number;
};

export function generateRecord(
  schema: ResourceSchema,
  fieldMap?: Record<string, ResourceField>,
  opts: GenerateOptions = {}
): Record<string, any> {
  const out: Record<string, any> = {};
  const rng = opts.rng ?? createRng(opts.seed);
  const schemaMap = opts.schemaMap;
  const maxDepth = opts.maxDepth ?? 3;
  const depth = opts.depth ?? 0;

  for (const field of schema.fields) {
    out[field.name] = genValueForField(field, rng, schemaMap, depth, maxDepth);
  }
  return out;
}

export function generateRecords(schema: ResourceSchema, count: number = 1, opts: GenerateOptions = {}): any[] {
  const res: any[] = [];
  // If a seed is provided, we create an RNG for the whole batch so outputs are stable across runs
  const rng = opts.rng ?? createRng(opts.seed);
  for (let i = 0; i < count; i++) {
    res.push(generateRecord(schema, undefined, { ...opts, rng }));
  }
  return res;
}

export const GENERATOR_OPTIONS = ["uuid", "randomName", "email", "isoDate", "number", "boolean"];
