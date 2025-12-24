export const FEATURES = {
  GEMINI: () => (import.meta.env.VITE_ENABLE_GEMINI === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_gemini') === 'true'),
  SERVICE_WORKER: () => (import.meta.env.VITE_ENABLE_SW === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_sw') === 'true'),
  LOG_VIEWER: () => (import.meta.env.VITE_ENABLE_LOG_VIEWER === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_logviewer') === 'true'),
  PROXY: () => (import.meta.env.VITE_ENABLE_PROXY === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_proxy') === 'true'),
  EXPORT_SERVER: () => (import.meta.env.VITE_ENABLE_EXPORT === 'true') || (typeof window !== 'undefined' && window.localStorage?.getItem('feature_export') === 'true'),
};

export function enableFeatureInLocalStorage(featureKey: string) {
  if (typeof window !== 'undefined') window.localStorage?.setItem(featureKey, 'true');
}

export function disableFeatureInLocalStorage(featureKey: string) {
  if (typeof window !== 'undefined') window.localStorage?.removeItem(featureKey);
}
