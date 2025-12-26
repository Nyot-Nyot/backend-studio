export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const priority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

let currentLevel: LogLevel = (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_LOG_LEVEL) || (typeof process !== 'undefined' && (process.env as any)?.VITE_LOG_LEVEL) || 'info';

export interface LoggerImpl {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

// Default implementation: use console with level filtering
const defaultImpl: LoggerImpl = {
  debug: (...args: any[]) => { if (priority[currentLevel as LogLevel] <= priority.debug) console.debug('[debug]', ...args); },
  info: (...args: any[]) => { if (priority[currentLevel as LogLevel] <= priority.info) console.info('[info]', ...args); },
  warn: (...args: any[]) => { if (priority[currentLevel as LogLevel] <= priority.warn) console.warn('[warn]', ...args); },
  error: (...args: any[]) => { if (priority[currentLevel as LogLevel] <= priority.error) console.error('[error]', ...args); },
};

let impl: LoggerImpl = defaultImpl;

export const setLevel = (level: LogLevel) => { currentLevel = level; };
export const getLevel = () => currentLevel;

export const setImpl = (newImpl: Partial<LoggerImpl> | null) => {
  if (!newImpl) {
    impl = defaultImpl;
    return;
  }
  impl = {
    debug: newImpl.debug || (() => { }),
    info: newImpl.info || (() => { }),
    warn: newImpl.warn || (() => { }),
    error: newImpl.error || (() => { }),
  };
};

export const logger = (name?: string) => ({
  debug: (...args: any[]) => impl.debug(name ? `[${name}]` : '', ...args),
  info: (...args: any[]) => impl.info(name ? `[${name}]` : '', ...args),
  warn: (...args: any[]) => impl.warn(name ? `[${name}]` : '', ...args),
  error: (...args: any[]) => impl.error(name ? `[${name}]` : '', ...args),
});

export default logger;
