// Logging utilities

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
}

const defaultConfig: LoggerConfig = {
  level:
    process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * Set logger configuration
 */
export function setLoggerConfig(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...config };
}

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return level >= config.level && config.enableConsole;
}

/**
 * Logger interface
 */
export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a logger instance
 */
export function createLogger(prefix?: string): Logger {
  const prefixStr = prefix ? `[${prefix}]` : '';

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog(LogLevel.DEBUG)) {
        // eslint-disable-next-line no-console
        console.debug(prefixStr, ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog(LogLevel.INFO)) {
        // eslint-disable-next-line no-console
        console.info(prefixStr, ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog(LogLevel.WARN)) {
        // eslint-disable-next-line no-console
        console.warn(prefixStr, ...args);
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog(LogLevel.ERROR)) {
        // eslint-disable-next-line no-console
        console.error(prefixStr, ...args);
      }
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger();
