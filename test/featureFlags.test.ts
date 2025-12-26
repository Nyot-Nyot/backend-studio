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

