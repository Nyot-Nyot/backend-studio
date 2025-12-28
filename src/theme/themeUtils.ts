export type ThemeName = 'light' | 'dark';
const THEME_KEY = 'ui-theme';

export const getStoredTheme = (): ThemeName | null => {
  try {
    return (localStorage.getItem(THEME_KEY) as ThemeName) || null;
  } catch (e) {
    return null;
  }
};

export const storeTheme = (t: ThemeName) => {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (e) {
    // ignore
  }
};

export const prefersDark = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    return false;
  }
};

export const applyTheme = (theme: ThemeName) => {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.setAttribute('data-theme', theme);
};

export const setTheme = (theme: ThemeName) => {
  applyTheme(theme);
  storeTheme(theme);
};

export const applyStoredOrPreferredTheme = () => {
  const stored = getStoredTheme();
  if (stored === 'light' || stored === 'dark') {
    applyTheme(stored);
    return stored;
  }
  const pref = prefersDark() ? 'dark' : 'light';
  applyTheme(pref);
  return pref;
};

export const toggleTheme = (): ThemeName => {
  const current = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) as ThemeName;
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};
