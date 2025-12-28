export type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  timeoutMs?: number; // optional per-attempt timeout
};

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const retry = async <T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> => {
  const retries = typeof opts.retries === 'number' ? opts.retries : 3;
  const base = typeof opts.baseDelayMs === 'number' ? opts.baseDelayMs : 200;
  const factor = typeof opts.factor === 'number' ? opts.factor : 2;
  const maxDelay = typeof opts.maxDelayMs === 'number' ? opts.maxDelayMs : 2000;

  // Enable debug logging when DEBUG_RETRY=1 or DEBUG_OPENROUTER=1
  const DEBUG = process.env.DEBUG_RETRY === '1' || process.env.DEBUG_OPENROUTER === '1';

  let attempt = 0;
  let lastErr: any;
  while (attempt <= retries) {
    try {
      if (DEBUG) console.log(`[retry] attempt ${attempt + 1}/${retries + 1} timeoutMs=${opts.timeoutMs ?? 'none'}`);
      if (opts.timeoutMs) return await withTimeout(fn(), opts.timeoutMs);
      return await fn();
    } catch (e) {
      lastErr = e;
      // If the error indicates we should not retry (eg. rate limit or client errors), rethrow immediately
      if ((e as any)?.noRetry) {
        if (DEBUG) console.warn(`[retry] not retrying due to noRetry flag: ${String(e)}`);
        throw e;
      }
      if (DEBUG) console.warn(`[retry] attempt ${attempt + 1} failed: ${String(e)}${attempt === retries ? ' (no more retries)' : ', will retry'}`);
      if (attempt === retries) break;
      const delay = Math.min(maxDelay, base * Math.pow(factor, attempt));
      // jitter
      const jitter = Math.floor(Math.random() * Math.min(100, delay));
      await sleep(delay + jitter);
      attempt++;
      continue;
    }
  }
  throw lastErr;
};

export default {
  sleep,
  withTimeout,
  retry,
};
