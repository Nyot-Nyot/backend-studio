import { GoogleGenAI } from "@google/genai";
import { HttpMethod } from "../types";

const STORAGE_KEY_API = 'api_sim_user_gemini_key';

const getClient = () => {
  // Priority 1: User provided key in LocalStorage
  const userKey = localStorage.getItem(STORAGE_KEY_API);
  if (userKey) return new GoogleGenAI({ apiKey: userKey });

  // Priority 2: Environment variable (Fallback)
  const envKey = process.env.API_KEY;
  if (envKey) return new GoogleGenAI({ apiKey: envKey });

  return null;
};

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
    
    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return text;
  } catch (error) {
    console.error("Gemini generation error:", error);
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

    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini config generation error:", error);
    throw error;
  }
};
