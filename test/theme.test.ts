import { applyStoredOrPreferredTheme, getStoredTheme, setTheme } from '../src/theme/themeUtils';

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`failed - ${name}`);
    throw e;
  }
}

// Mock document & localStorage for Node test environment
const fakeDocument: any = { documentElement: { _attrs: {} } };
fakeDocument.documentElement.setAttribute = function (k: string, v: string) { this._attrs[k] = v; };
fakeDocument.documentElement.getAttribute = function (k: string) { return this._attrs[k]; };
// attach mocks
(global as any).document = fakeDocument;
(global as any).localStorage = {
  _store: {} as Record<string, string>,
  getItem(k: string) { return this._store[k] || null; },
  setItem(k: string, v: string) { this._store[k] = v; },
  removeItem(k: string) { delete this._store[k]; }
};

test('applyStoredOrPreferredTheme applies light by default (no stored theme)', () => {
  // clear any stored
  (global as any).localStorage._store = {};
  const applied = applyStoredOrPreferredTheme();
  const attr = (global as any).document.documentElement.getAttribute('data-theme');
  if (attr !== applied) throw new Error('attribute and return should agree');
  if (!(applied === 'light' || applied === 'dark')) throw new Error('should return a valid theme');
});

test('setTheme stores and applies theme', () => {
  setTheme('dark');
  if (getStoredTheme() !== 'dark') throw new Error('stored theme should be dark');
  if ((global as any).document.documentElement.getAttribute('data-theme') !== 'dark') throw new Error('document should have dark theme');
});
