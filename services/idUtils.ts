export const DEFAULT_UUID_COLLECTIONS = new Set<string>(["products", "items"]);

export function generateShortUuid(): string {
  return crypto?.randomUUID ? crypto.randomUUID().split("-")[0] : Math.random().toString(36).slice(2, 10);
}

export function isNumericIdStrategy(ids: unknown[]): boolean {
  return ids.length > 0 && ids.every((v) => typeof v === 'number');
}

export function generateIdForCollection(existingIds: unknown[], collectionName?: string): string | number {
  if (!existingIds || existingIds.length === 0) {
    if (collectionName && DEFAULT_UUID_COLLECTIONS.has(collectionName)) return generateShortUuid();
    return 1;
  }

  if (isNumericIdStrategy(existingIds)) {
    const nums = existingIds as number[];
    const max = nums.reduce((a, b) => (b > a ? b : a), 0);
    return max + 1;
  }

  return generateShortUuid();
}
