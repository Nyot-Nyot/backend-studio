import { ResourceField, ResourceSchema } from "../types";

const sampleNames = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"];

function genValueForField(field: ResourceField): any {
  const gen = field.generator || "";
  switch (gen) {
    case "uuid":
      return crypto.randomUUID();
    case "randomName":
      return sampleNames[Math.floor(Math.random() * sampleNames.length)];
    case "email":
      return `${sampleNames[Math.floor(Math.random() * sampleNames.length)].toLowerCase()}${Math.floor(
        Math.random() * 1000
      )}@example.com`;
    case "isoDate":
      return new Date().toISOString();
    case "number":
      return Math.floor(Math.random() * 1000);
    case "boolean":
      return Math.random() < 0.5;
    default:
      // Fallback: generate simple value by type
      switch (field.type) {
        case "string":
          return `${field.name}_${Math.floor(Math.random() * 10000)}`;
        case "number":
          return Math.floor(Math.random() * 1000);
        case "boolean":
          return Math.random() < 0.5;
        case "date":
          return new Date().toISOString();
        case "object":
        case "array":
          return null; // nested generation not implemented yet
        default:
          return null;
      }
  }
}

export function generateRecord(schema: ResourceSchema, fieldMap?: Record<string, ResourceField>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of schema.fields) {
    out[field.name] = genValueForField(field);
  }
  return out;
}

export function generateRecords(schema: ResourceSchema, count: number = 1): any[] {
  const res: any[] = [];
  for (let i = 0; i < count; i++) {
    res.push(generateRecord(schema));
  }
  return res;
}

export const GENERATOR_OPTIONS = ["uuid", "randomName", "email", "isoDate", "number", "boolean"];
