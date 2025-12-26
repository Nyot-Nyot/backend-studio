import * as ai from "../../services/aiService";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
  }
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("🧪 aiService tests\n");

// Mock global fetch for openrouter proxy used by openrouterClient
(globalThis as any).fetch = async (url: string, opts: any) => {
  if (url.endsWith('/openrouter/generate-mock')) {
    return {
      ok: true,
      json: async () => ({ json: '{"id":1,"name":"Alice"}' }),
    } as any;
  }
  if (url.endsWith('/openrouter/generate-endpoint')) {
    return {
      ok: true,
      json: async () => ({ name: 'Users list', path: '/users', method: 'GET', statusCode: 200, responseBody: '{"users":[]}' }),
    } as any;
  }
  return { ok: false, status: 404, text: async () => 'not found' } as any;
};

// Ensure OPENROUTER feature is considered enabled by toggling localStorage
if (typeof window !== 'undefined') window.localStorage?.setItem('feature_ai', 'true');

test('generateMockData returns JSON string', async () => {
  const json = await ai.generateMockData('/users', 'list');
  assert(typeof json === 'string' && json.includes('name'), 'returned json');
});

test('generateEndpointConfig returns parsed config', async () => {
  const cfg = await ai.generateEndpointConfig('list users');
  assert(cfg.path === '/users', 'path');
  assert(cfg.name === 'Users list', 'name');
});
