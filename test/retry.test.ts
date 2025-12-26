import { retry, withTimeout } from '../services/retry';

(async () => {
  console.log('🧪 [retry] Memastikan retry bekerja dan withTimeout menolak saat limit tercapai');

  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls < 3) throw new Error('fail');
    return 'ok';
  };

  const res = await retry(flaky, { retries: 3, baseDelayMs: 10, factor: 2, maxDelayMs: 50 });
  if (res !== 'ok') throw new Error('retry tidak mengembalikan hasil yang benar');
  if (calls !== 3) throw new Error('retry tidak mencoba jumlah yang benar');

  // Test timeout
  let timedOut = false;
  try {
    await withTimeout(new Promise((res) => setTimeout(() => res('x'), 200)), 50);
  } catch (e) {
    timedOut = true;
  }
  if (!timedOut) throw new Error('withTimeout harus timeout');

  console.log('✅ PASS: retry & withTimeout ok');
})();
