import { AIError, AIErrorCode } from "../services/aiErrors";
import { generateMockData } from "../services/aiService";

async function run() {
  console.log("🧪 aiService timeout tests");

  // Ensure AI feature is enabled by environment override for this test
  process.env.FORCE_ENABLE_AI = '1';
  // monkeypatch global.fetch to simulate proxy returning 504 with body 'proxy_timeout'
  const originalFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: string, opts: any) => ({ ok: false, status: 504, text: async () => 'proxy_timeout' });

  try {
    await generateMockData('/test', 'ctx');
    console.error('❌ generateMockData should have thrown when OpenRouter times out');
    (globalThis as any).fetch = originalFetch;
    delete process.env.FORCE_ENABLE_AI;
    process.exit(1);
  } catch (e) {
    (globalThis as any).fetch = originalFetch;
    delete process.env.FORCE_ENABLE_AI;
    if (!(e instanceof AIError) || e.code !== AIErrorCode.OPENROUTER_TIMEOUT) {
      console.error('❌ Unexpected error thrown', e);
      process.exit(1);
    }
  }

  console.log('✅ aiService timeout tests passed');
}

run().catch(e => { console.error(e); process.exit(1); });
