/**
 * Central helpers and consistent guards for feature flag resolution.
 *
 * Resolution precedence (high → low):
 *  1) localStorage explicit value ('true'/'false') if available in the browser
 *  2) explicit Vite env var `VITE_*` value if defined (`'true'` / `'false'`)
 *  3) built-in default for the feature
 */

function safeGetImportMetaEnvVar(name: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined') {
      return (import.meta as any).env && (import.meta as any).env[name];
    }
  } catch (e) {
    // import.meta may not be available in some runtimes — swallow and return undefined
  }
  return undefined;
}

function safeGetLocalStorage(key: string): string | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

const LOCAL_KEY_ALIASES: Record<string, string[]> = {
  SERVICE_WORKER: ['feature_sw', 'feature_service_worker'],
  LOG_VIEWER: ['feature_logviewer', 'feature_log_viewer'],
  EMAIL_EXPORT: ['feature_email_export', 'feature_email'],
  PROXY: ['feature_proxy'],
  AI: ['feature_ai'],
  OPENROUTER: ['feature_openrouter'],
  GEMINI: ['feature_gemini'],
  EXPORT_SERVER: ['feature_export']
};

function getLocalStorageForFeature(featureKey: string): string | null {
  const aliases = LOCAL_KEY_ALIASES[featureKey] || ['feature_' + featureKey.toLowerCase()];
  for (const k of aliases) {
    const v = safeGetLocalStorage(k);
    if (v !== null) return v;
  }
  return null;
}
function parseBooleanString(v: string | null | undefined): boolean | undefined {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

export const FEATURE_DEFAULTS: Record<string, boolean> = {
  // Defaults are intentionally documented here. Notes:
  // SERVICE_WORKER and LOG_VIEWER default to `true` to preserve their runtime behavior unless overridden.
  AI: false,
  OPENROUTER: false,
  GEMINI: false,
  SERVICE_WORKER: true,
  LOG_VIEWER: true,
  PROXY: false,
  EXPORT_SERVER: false,
  EMAIL_EXPORT: false,
};

export function resolveFlag(featureKey: keyof typeof FEATURE_DEFAULTS, envVar?: string): boolean {
  // 1) localStorage explicit true/false (support legacy aliases)
  const localRaw = getLocalStorageForFeature(String(featureKey));
  const localParsed = parseBooleanString(localRaw);
  if (localParsed !== undefined) return localParsed;

  // 2) environment variable
  if (envVar) {
    const envVal = safeGetImportMetaEnvVar(envVar);
    const envParsed = parseBooleanString(envVal);
    if (envParsed !== undefined) return envParsed;
  }

  // 3) default
  return FEATURE_DEFAULTS[featureKey as string] ?? false;
}

export const FEATURES = {
  AI: () => {
    // AI is enabled when either AI env var, OPENROUTER env var, OR AI provider 'openrouter' is set.
    const local = resolveFlag('AI', 'VITE_ENABLE_AI');
    if (local) return true;
    const openRouter = resolveFlag('OPENROUTER', 'VITE_ENABLE_OPENROUTER');
    if (openRouter) return true;
    const provider = safeGetImportMetaEnvVar('VITE_AI_PROVIDER');
    if (provider === 'openrouter') return true;
    return false;
  },
  OPENROUTER: () => resolveFlag('OPENROUTER', 'VITE_ENABLE_OPENROUTER'),
  GEMINI: () => resolveFlag('GEMINI', 'VITE_ENABLE_GEMINI'),
  SERVICE_WORKER: () => resolveFlag('SERVICE_WORKER', 'VITE_ENABLE_SW'),
  LOG_VIEWER: () => resolveFlag('LOG_VIEWER', 'VITE_ENABLE_LOG_VIEWER'),
  PROXY: () => resolveFlag('PROXY', 'VITE_ENABLE_PROXY'),
  EXPORT_SERVER: () => resolveFlag('EXPORT_SERVER', 'VITE_ENABLE_EXPORT'),
  EMAIL_EXPORT: () => resolveFlag('EMAIL_EXPORT', 'VITE_ENABLE_EMAIL'),
};

export function enableFeatureInLocalStorage(featureKey: string) {
  if (typeof window !== 'undefined') window.localStorage?.setItem(featureKey, 'true');
}

export function disableFeatureInLocalStorage(featureKey: string) {
  if (typeof window !== 'undefined') window.localStorage?.removeItem(featureKey);
}
