import { AuthConfig } from "../types";

export function maskToken(token?: string) {
  // Always return a masked string; do not expose raw tokens in UI
  if (!token) return "***";
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function formatAuthPreview(authConfig?: AuthConfig) {
  // Support both `jenis` (Bahasa Indonesia) and legacy `type` for compatibility
  const tipe = (authConfig as any)?.jenis ?? (authConfig as any)?.type ?? "NONE";
  if (tipe === "BEARER_TOKEN") {
    const token = (authConfig as any)?.token;
    return `Authorization: Bearer ${maskToken(token)}`;
  }
  if (tipe === "API_KEY") {
    const header = (authConfig as any)?.headerKey || "x-api-key";
    const token = (authConfig as any)?.token;
    return `${header}: ${maskToken(token)}`;
  }
  return "Public";
}
