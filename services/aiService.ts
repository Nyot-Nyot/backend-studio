import { FEATURES } from '../config/featureFlags';
import { GeneratedEndpointConfig } from '../types';
import { openrouterGenerateEndpoint, openrouterGenerateMock } from './openrouterClient';

export async function generateMockData(path: string, context: string): Promise<string> {
  // prefer OpenRouter provider (check generic AI flag)
  // Allow tests to override by setting FORCE_ENABLE_AI=1 in process.env
  if (FEATURES.AI && !FEATURES.AI() && process.env.FORCE_ENABLE_AI !== '1') {
    throw new Error('OPENROUTER_DISABLED');
  }

  try {
    const res = await openrouterGenerateMock({ path, context });
    if (!res || typeof res.json !== 'string') throw new Error('INVALID_AI_RESPONSE');
    return res.json;
  } catch (e) {
    console.error('openrouter generateMockData error', e);
    throw e;
  }
}

export async function generateEndpointConfig(prompt: string): Promise<GeneratedEndpointConfig> {
  // Allow tests to override by setting FORCE_ENABLE_AI=1 in process.env
  if (FEATURES.AI && !FEATURES.AI() && process.env.FORCE_ENABLE_AI !== '1') {
    throw new Error('OPENROUTER_DISABLED');
  }

  try {
    const res = await openrouterGenerateEndpoint({ prompt });
    // Basic validation
    if (!res || !res.name || !res.path) throw new Error('INVALID_AI_CONFIG');
    return res as GeneratedEndpointConfig;
  } catch (e) {
    console.error('openrouter generateEndpointConfig error', e);
    throw e;
  }
}
