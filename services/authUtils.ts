import { AuthConfig } from "../types";

export function maskToken(token?: string) {
  // Always return a masked string; do not expose raw tokens in UI
  if (!token) return "***";
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function formatAuthPreview(authConfig?: AuthConfig) {
  const type = authConfig?.type || "NONE";
  if (type === "BEARER_TOKEN") {
    const token = authConfig?.token;
    return `Authorization: Bearer ${maskToken(token)}`;
  }
  if (type === "API_KEY") {
    const header = authConfig?.headerKey || "x-api-key";
    const token = authConfig?.token;
    return `${header}: ${maskToken(token)}`;
  }
  return "Public";
}
