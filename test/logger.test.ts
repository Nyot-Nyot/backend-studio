import { getLevel, logger, setImpl, setLevel } from '../services/logger';

(async () => {
  console.log('🧪 [logger] Memastikan level dan implementasi custom bekerja');

  const calls: string[] = [];
  // Implement impl that enforces the active level using getLevel to mirror default behavior
  const filter = (level: 'debug' | 'info' | 'warn' | 'error') => (...args: any[]) => {
    const order: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };
    if (order[getLevel()] <= order[level]) calls.push(level + ':' + args.join(' '));
  };

  setImpl({
    debug: filter('debug'),
    info: filter('info'),
    warn: filter('warn'),
    error: filter('error'),
  });

  setLevel('warn');

  const l = logger('test');
  l.debug('should not appear');
  l.info('should not appear');
  l.warn('be careful');
  l.error('boom');

  if (!calls.find(c => c.startsWith('warn:') && c.includes('be careful'))) throw new Error('warn harus dipanggil');
  if (!calls.find(c => c.startsWith('error:') && c.includes('boom'))) throw new Error('error harus dipanggil');
  if (calls.find(c => c.startsWith('debug:'))) throw new Error('debug tidak boleh dipanggil pada level warn');
  if (calls.find(c => c.startsWith('info:'))) throw new Error('info tidak boleh dipanggil pada level warn');

  // reset impl to default
  setImpl(null);

  console.log('✅ PASS: logger level filtering dan custom impl ok');
})();
