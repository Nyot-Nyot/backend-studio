import { openrouterGenerateEndpoint, openrouterGenerateMock } from "../../services/openrouterClient";

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

console.log("🧪 openrouterClient tests\n");

// Mock fetch
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

test('generate mock calls proxy and returns json string', async () => {
  const res = await openrouterGenerateMock({ path: '/users', context: 'list' });
  assert(typeof res.json === 'string', 'expected json string');
});

test('generate endpoint returns expected shape', async () => {
  const res = await openrouterGenerateEndpoint({ prompt: 'list users' });
  assert(res.name === 'Users list', 'name ok');
  assert(res.path === '/users', 'path ok');
  assert(res.statusCode === 200, 'status code ok');
});
