import { AuthConfig } from "../types";

export function formatAuthPreview(authConfig?: AuthConfig) {
  const type = authConfig?.type || "NONE";
  if (type === "BEARER_TOKEN") {
    const token = authConfig?.token || "my-secret-token-12345";
    return `Authorization: Bearer ${token}`;
  }
  if (type === "API_KEY") {
    const header = authConfig?.headerKey || "x-api-key";
    const token = authConfig?.token || "sk-api-1234567890abcdef";
    return `${header}: ${token}`;
  }
  return "Public";
}
