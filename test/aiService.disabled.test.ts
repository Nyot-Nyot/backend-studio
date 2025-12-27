import { generateMockData, generateEndpointConfig } from "../services/aiService";
import { AIError, AIErrorCode } from "../services/aiErrors";

async function run() {
  console.log("🧪 aiService disabled tests");

  // Ensure AI disabled in feature flags and no FORCE_ENABLE_AI
  delete process.env.FORCE_ENABLE_AI;

  try {
    await generateMockData('/test', 'ctx');
    console.error('❌ generateMockData should have thrown when AI is disabled');
    process.exit(1);
  } catch (e) {
    if (!(e instanceof AIError) || e.code !== AIErrorCode.OPENROUTER_DISABLED) {
      console.error('❌ generateMockData threw unexpected error', e);
      process.exit(1);
    }
  }

  try {
    await generateEndpointConfig('make me an endpoint');
    console.error('❌ generateEndpointConfig should have thrown when AI is disabled');
    process.exit(1);
  } catch (e) {
    if (!(e instanceof AIError) || e.code !== AIErrorCode.OPENROUTER_DISABLED) {
      console.error('❌ generateEndpointConfig threw unexpected error', e);
      process.exit(1);
    }
  }

  console.log('✅ aiService disabled tests passed');
}

run().catch(e => { console.error(e); process.exit(1); });