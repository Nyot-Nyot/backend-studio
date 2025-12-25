export const FEATURES = {
  // Generic AI flag (can be used to gate AI features broadly)
  AI: () => ((typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && ((import.meta as any).env.VITE_ENABLE_AI === 'true' || (import.meta as any).env.VITE_ENABLE_OPENROUTER === 'true' || (import.meta as any).env.VITE_AI_PROVIDER === 'openrouter')) || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_ai') === 'true')),
  // Provider-specific flag for OpenRouter (backwards compat with VITE_ENABLE_OPENROUTER)
  OPENROUTER: () => ((typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && (import.meta as any).env.VITE_ENABLE_OPENROUTER === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_openrouter') === 'true')),
  GEMINI: () => (import.meta.env.VITE_ENABLE_GEMINI === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_gemini') === 'true'),
  SERVICE_WORKER: () => {
    // Allow explicit control via localStorage: 'true'/'false' takes precedence
    if (typeof window !== 'undefined') {
      const val = window.localStorage?.getItem('feature_sw');
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
    // Honor explicit env var when present (guard for Node/test env where import.meta.env may be undefined)
    if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && typeof (import.meta.env as any).VITE_ENABLE_SW !== 'undefined') return (import.meta.env as any).VITE_ENABLE_SW === 'true';
    // Default: enabled (restore live interception behavior)
    return true;
  },
  LOG_VIEWER: () => {
    if (typeof window !== 'undefined') {
      const val = window.localStorage?.getItem('feature_logviewer');
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
    if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && typeof (import.meta.env as any).VITE_ENABLE_LOG_VIEWER !== 'undefined') return (import.meta.env as any).VITE_ENABLE_LOG_VIEWER === 'true';
    // Default: enabled (restore traffic monitor UI)
    return true;
  },
  PROXY: () => (import.meta.env.VITE_ENABLE_PROXY === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_proxy') === 'true'),
  EXPORT_SERVER: () => (import.meta.env.VITE_ENABLE_EXPORT === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_export') === 'true'),
  EMAIL_EXPORT: () => (import.meta.env.VITE_ENABLE_EMAIL === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_email_export') === 'true'),
};

export function enableFeatureInLocalStorage(featureKey: string) {
  if (typeof window !== 'undefined') window.localStorage?.setItem(featureKey, 'true');
}

export function disableFeatureInLocalStorage(featureKey: string) {
  if (typeof window !== 'undefined') window.localStorage?.removeItem(featureKey);
}
