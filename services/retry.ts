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
    timer = setTimeout(() => rej(new Error('timeout')), ms);
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

  let attempt = 0;
  let lastErr: any;
  while (attempt <= retries) {
    try {
      if (opts.timeoutMs) return await withTimeout(fn(), opts.timeoutMs);
      return await fn();
    } catch (e) {
      lastErr = e;
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
