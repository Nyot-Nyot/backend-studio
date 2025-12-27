import { FEATURES } from '../config/featureFlags';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

console.log('🧪 Starting featureFlags tests\n');

test('LOG_VIEWER and SERVICE_WORKER are enabled by default', () => {
  assert(FEATURES.LOG_VIEWER() === true, 'LOG_VIEWER should be enabled by default');
  assert(FEATURES.SERVICE_WORKER() === true, 'SERVICE_WORKER should be enabled by default');
});

test('PROXY default is disabled', () => {
  assert(FEATURES.PROXY() === false, 'PROXY should be disabled by default');
});

// Simulate browser localStorage overrides
const originalWindow = (globalThis as any).window;
const fakeStore: Record<string, string> = {};
(globalThis as any).window = { localStorage: { getItem: (k: string) => fakeStore[k] ?? null, setItem: (k: string, v: string) => { fakeStore[k] = v; }, removeItem: (k: string) => { delete fakeStore[k]; } } };

test('localStorage true overrides default', () => {
  (globalThis as any).window.localStorage.setItem('feature_proxy', 'true');
  assert(FEATURES.PROXY() === true, 'PROXY should be true when localStorage sets it to true');
});

test('localStorage false overrides default true', () => {
  (globalThis as any).window.localStorage.setItem('feature_sw', 'false');
  assert(FEATURES.SERVICE_WORKER() === false, 'SERVICE_WORKER should be false when localStorage sets it to false');
});

// Cleanup
(globalThis as any).window = originalWindow;

console.log('\n🧪 featureFlags tests complete');

