import { FEATURES } from '../config/featureFlags';
import { GeneratedEndpointConfig } from '../types';
import { AIError, AIErrorCode } from './aiErrors';
import { openrouterGenerateEndpoint, openrouterGenerateMock } from './openrouterClient';

export async function generateMockData(path: string, context: string): Promise<string> {
  // prefer OpenRouter provider (check generic AI flag)
  // Allow tests to override by setting FORCE_ENABLE_AI=1 in process.env
  if (!FEATURES.AI() && process.env.FORCE_ENABLE_AI !== '1') {
    throw new AIError(AIErrorCode.OPENROUTER_DISABLED, 'OpenRouter provider disabled');
  }

  try {
    const res = await openrouterGenerateMock({ path, context });
    if (!res || typeof res.json !== 'string') throw new AIError(AIErrorCode.INVALID_AI_RESPONSE, 'Invalid AI response');
    return res.json;
  } catch (e) {
    // Surface a typed error for callers; attach original error as cause when available
    if (e instanceof AIError) throw e;
    throw new AIError(AIErrorCode.INVALID_AI_RESPONSE, 'Failed to generate mock data', { cause: e });
  }
}

export async function generateEndpointConfig(prompt: string): Promise<GeneratedEndpointConfig> {
  // Allow tests to override by setting FORCE_ENABLE_AI=1 in process.env
  if (!FEATURES.AI() && process.env.FORCE_ENABLE_AI !== '1') {
    throw new AIError(AIErrorCode.OPENROUTER_DISABLED, 'OpenRouter provider disabled');
  }

  try {
    const res = await openrouterGenerateEndpoint({ prompt });
    // Basic validation
    if (!res || !res.name || !res.path) throw new AIError(AIErrorCode.INVALID_AI_CONFIG, 'Invalid AI config');
    return res as GeneratedEndpointConfig;
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError(AIErrorCode.INVALID_AI_CONFIG, 'Failed to generate endpoint config', { cause: e });
  }
}
