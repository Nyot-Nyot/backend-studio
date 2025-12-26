export const getEnv = () => {
  // Support both Vite import.meta.env at runtime and Node process.env during tests
  const env: Record<string, string | undefined> = {};
  try {
    if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined') {
      Object.keys((import.meta as any).env).forEach((k) => {
        // Only pick Vite-prefixed envs
        if (String(k).startsWith('VITE_')) env[k] = (import.meta as any).env[k];
      });
    }
  } catch (e) {
    // ignore
  }

  // Merge with process.env for Node test runtime (process.env keys are not prefixed technically, but we allow both)
  if (typeof process !== 'undefined' && process.env) {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('VITE_')) env[k] = process.env[k];
    });
  }

  return env;
};

export const requiredEnv = (name: string): string => {
  const env = getEnv();
  const val = env[name];
  if (!val) throw new Error(`Required env ${name} is missing`);
  return val;
};

export const checkRequired = (names: string[]) => {
  const missing = names.filter((n) => !getEnv()[n]);
  if (missing.length > 0) {
    // In production we want to fail-fast; in dev we just warn
    const isProd = (typeof import.meta !== 'undefined' && !!(import.meta as any).env && !(import.meta as any).env.DEV) || (process.env.NODE_ENV === 'production');
    const msg = `Missing required env variables: ${missing.join(', ')}`;
    if (isProd) throw new Error(msg);
    // eslint-disable-next-line no-console
    console.warn(msg);
    return false;
  }
  return true;
};
