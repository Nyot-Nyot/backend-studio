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
    if (!/50/.test(String(e))) throw new Error('withTimeout error message should include timeout ms');
  }
  if (!timedOut) throw new Error('withTimeout harus timeout');

  // Test retry uses timeoutMs per attempt and retries the expected number of times
  let calls2 = 0;
  const slow = async () => {
    calls2++;
    // sleep 80ms which is longer than the timeout we will set (50ms)
    await new Promise((res) => setTimeout(res, 80));
    return 'ok';
  };

  let retryThrew = false;
  try {
    await retry(slow, { retries: 2, timeoutMs: 50, baseDelayMs: 1, factor: 1, maxDelayMs: 10 });
  } catch (e) {
    retryThrew = true;
    if (!/timeout/.test(String(e))) throw new Error('retry should fail with a timeout error');
  }
  if (!retryThrew) throw new Error('retry should have thrown after exhausting attempts');
  if (calls2 !== 3) throw new Error('retry did not attempt the expected number of times (retries+1)');

  console.log('✅ PASS: retry & withTimeout ok');
})();
