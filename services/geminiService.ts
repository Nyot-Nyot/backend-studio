// Deprecated: This adapter targets Google Gemini. New implementations should use OpenRouter via `services/aiService.ts`.
// Notes: This module now guards access to browser-only APIs and validates AI outputs before parsing.
import { GoogleGenAI } from "@google/genai";
import { HttpMethod } from "../types";

const STORAGE_KEY_API = 'api_sim_user_gemini_key';
let _testClient: any = null;
export function __setTestClient(c: any) { _testClient = c; }

function localStorageAllowed() {
  const allow = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV_ALLOW_CLIENT_KEY === '1') || process.env.DEV_ALLOW_CLIENT_KEY === '1';
  return allow && typeof window !== 'undefined' && typeof (window as any).localStorage !== 'undefined';
}

const getClient = () => {
  // Test client override (tests may set this)
  if (_testClient) return _testClient;

  // Priority 1: Environment variable (preferred)
  const envKey = process.env.GOOGLE_GENAI_API_KEY || process.env.API_KEY;
  if (envKey) return new GoogleGenAI({ apiKey: envKey });

  // Priority 2: User provided key in LocalStorage — only if explicitly enabled via DEV_ALLOW_CLIENT_KEY=1
  if (localStorageAllowed()) {
    try {
      const userKey = (window as any).localStorage.getItem(STORAGE_KEY_API);
      if (userKey) return new GoogleGenAI({ apiKey: userKey });
    } catch (e) {
      // ignore localStorage errors (privacy mode etc.)
    }
  }

  return null;
};

function extractJsonFromText(text: string): any {
  const trimmed = text.trim();
  // Try parse directly
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Try to find a JSON code block ```json ... ```
    const codeFenceMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    if (codeFenceMatch && codeFenceMatch[1]) {
      try {
        return JSON.parse(codeFenceMatch[1].trim());
      } catch (inner) {
        // fall through
      }
    }

    // Try to find first { ... } or [ ... ] block (naive balanced braces extraction)
    const braceMatch = /([\{\[][\s\S]*[\}\]])/.exec(text);
    if (braceMatch && braceMatch[1]) {
      try {
        return JSON.parse(braceMatch[1]);
      } catch (inner) {
        // fall through
      }
    }

    // Nothing worked - throw descriptive error
    const preview = text.length > 200 ? text.slice(0, 200) + '...' : text;
    const err: any = new Error('AI output is not valid JSON');
    err.raw = preview;
    throw err;
  }
}

export const generateMockData = async (path: string, context: string): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    throw new Error("MISSING_API_KEY");
  }

  const prompt = `
    You are a backend developer helper.
    Generate a realistic JSON response body for a REST API endpoint.

    Endpoint Path: "${path}"
    Context/Description: "${context}"

    Requirements:
    1. Output ONLY valid JSON.
    2. Do not include markdown formatting (like \`\`\`json).
    3. If the path implies a list (e.g., /users), return an array of 3-5 items.
    4. If the path implies a single resource (e.g., /users/1), return a single object.
    5. Use realistic data (names, dates, emails).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = extractJsonFromText(text);
    // Return a stable stringified JSON
    return JSON.stringify(parsed);
  } catch (error) {
    console.error("Gemini generation error:", error?.message || error);
    throw error; // Re-throw to handle in UI
  }
};

export interface GeneratedEndpointConfig {
  name: string;
  path: string;
  method: HttpMethod;
  statusCode: number;
  responseBody: string;
}

export const generateEndpointConfig = async (userPrompt: string): Promise<GeneratedEndpointConfig> => {
  const ai = getClient();
  if (!ai) throw new Error("MISSING_API_KEY");

  const systemPrompt = `
    You are an API Architect. Based on the user's description, generate a complete REST API endpoint configuration.
    User Description: "${userPrompt}"

    Return ONLY a raw JSON object (no markdown) with this structure:
    {
      "name": "Short descriptive name",
      "path": "/api/v1/resource-name",
      "method": "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
      "statusCode": 200 or 201 or 400 etc,
      "responseBody": "The JSON string of the response data (stringified)"
    }

    Ensure the path uses best practices (kebab-case).
    Ensure the responseBody is a valid stringified JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
    });

    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = extractJsonFromText(text);

    // Validate shape
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid endpoint config - not an object');
    const name = parsed.name;
    const path = parsed.path;
    const method = parsed.method as HttpMethod;
    const statusCode = Number(parsed.statusCode);
    let responseBody = parsed.responseBody;

    if (!name || !path || !method || !statusCode) {
      throw new Error('Invalid endpoint config - missing required fields');
    }

    // Ensure responseBody is a string (stringified JSON). If it's an object, stringify it.
    if (typeof responseBody === 'object') {
      responseBody = JSON.stringify(responseBody);
    } else if (typeof responseBody !== 'string') {
      responseBody = String(responseBody === undefined ? '{}' : responseBody);
    }

    return { name, path, method, statusCode, responseBody } as GeneratedEndpointConfig;
  } catch (error) {
    console.error("Gemini config generation error:", error?.message || error);
    throw error;
  }
};
