import { dbService } from '../services/dbService';
import { setImpl } from '../services/logger';

(async () => {
  console.log('🧪 [dbService+logger] Memastikan error saat localStorage setItem melempar tercatat di logger');

  // Mock logger impl
  const logCalls: { level: string; args: any[] }[] = [];
  setImpl({
    debug: (...args: any[]) => logCalls.push({ level: 'debug', args }),
    info: (...args: any[]) => logCalls.push({ level: 'info', args }),
    warn: (...args: any[]) => logCalls.push({ level: 'warn', args }),
    error: (...args: any[]) => logCalls.push({ level: 'error', args }),
  });

  // Polyfill localStorage that throws on setItem
  if (typeof (globalThis as any).localStorage === 'undefined') {
    (globalThis as any).localStorage = (function () {
      const store: Record<string, string> = {};
      return {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { throw new Error('disk full'); },
        removeItem: (k: string) => { delete store[k]; },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length() { return Object.keys(store).length; }
      };
    })();
  }

  const coll = 'logger_error_test';
  // This will call saveCollection which should attempt to persist and cause error
  await dbService.saveCollection(coll, [{ id: 1, name: 'A' }], { await: true });

  const hasError = logCalls.find(c => c.level === 'error' || c.level === 'warn');
  if (!hasError) throw new Error('Expected logger to receive a warn/error on persist failure');

  // Cleanup
  setImpl(null);
  dbService.clearCollection(coll);

  console.log('✅ PASS: dbService logged persistence error as expected');
})();
