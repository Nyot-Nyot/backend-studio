import { checkRequired, getEnv, requiredEnv } from '../services/env';

(async () => {
  console.log('🧪 [env] Memastikan helper env bekerja');

  // Ensure getEnv returns an object
  const env = getEnv();
  if (typeof env !== 'object') throw new Error('getEnv harus mengembalikan object');

  // Set a test env and ensure requiredEnv reads it
  (process.env as any).VITE_TEST_FOO = 'bar';
  const v = requiredEnv('VITE_TEST_FOO');
  if (v !== 'bar') throw new Error('requiredEnv harus mengembalikan nilai yang benar');

  // checkRequired should warn (but not throw) in non-production
  const ok = checkRequired(['VITE_TEST_FOO', 'VITE_NOT_SET_TEST']);
  if (ok) throw new Error('checkRequired harus mengembalikan false jika ada variabel hilang');

  console.log('✅ PASS: env helper OK');
})();
