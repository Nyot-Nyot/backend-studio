import { AuthConfig } from "../types";

export function maskToken(token?: string) {
  if (!token) return '***';
  if (token.length <= 8) return '*'.repeat(3);
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function formatAuthPreview(authConfig?: AuthConfig) {
  const type = authConfig?.type || "NONE";
  if (type === "BEARER_TOKEN") {
    const token = authConfig?.token || "my-secret-token-12345";
    return `Authorization: Bearer ${maskToken(token)}`;
  }
  if (type === "API_KEY") {
    const header = authConfig?.headerKey || "x-api-key";
    const token = authConfig?.token || "sk-api-1234567890abcdef";
    return `${header}: ${maskToken(token)}`;
  }
  return "Public";
}
