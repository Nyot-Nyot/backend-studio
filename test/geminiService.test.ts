import { __setTestClient, generateEndpointConfig, generateMockData } from "../services/geminiService";

function test(name: string, fn: () => Promise<void> | void) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === 'function') {
      return (res as any).then(() => console.log(`✅ PASS: ${name}`)).catch((e: any) => {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   ${e?.message || e}`);
      });
    }
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
  }
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

console.log('🧪 Starting geminiService tests\n');

// Mock client that returns given text
const makeMockClient = (text: string) => ({ models: { generateContent: async () => ({ text }) } });

// 1) Valid JSON output
__setTestClient(makeMockClient('{"foo": "bar"}'));

test('generateMockData returns stringified JSON for valid JSON', async () => {
  const res = await generateMockData('/users', 'test');
  assert(typeof res === 'string', 'should be string');
  const parsed = JSON.parse(res);
  assert(parsed.foo === 'bar', 'parsed content should match');
});

// 2) JSON within code fences
__setTestClient(makeMockClient('```json\n{"x":1}\n```'));

test('generateMockData extracts JSON from code fences', async () => {
  const res = await generateMockData('/x', 'ctx');
  const parsed = JSON.parse(res);
  assert(parsed.x === 1, 'should extract JSON inside code fence');
});

// 3) Invalid output -> should throw descriptive error
__setTestClient(makeMockClient('this is not json'));

test('generateMockData throws for non-JSON output', async () => {
  let thrown = false;
  try {
    await generateMockData('/bad', 'ctx');
  } catch (e: any) {
    thrown = true;
    assert(e.message && e.message.includes('AI output is not valid JSON'), 'error message should indicate invalid JSON');
  }
  assert(thrown, 'should throw for invalid output');
});

// 4) generateEndpointConfig with object in responseBody
__setTestClient(makeMockClient('{"name":"n","path":"/p","method":"GET","statusCode":200,"responseBody":{"ok":true}}'));

test('generateEndpointConfig stringifies object responseBody', async () => {
  const cfg = await generateEndpointConfig('create endpoint');
  assert(cfg.responseBody === JSON.stringify({ ok: true }), 'responseBody should be stringified');
  assert(cfg.name === 'n', 'name should be parsed');
});

console.log('\n🧪 geminiService tests finished');
