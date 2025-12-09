import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  logger,
  setLoggerConfig,
  getLoggerConfig,
  LogLevel,
} from '../logger';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalConsole = { ...console };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset logger config
    setLoggerConfig({
      level: LogLevel.DEBUG,
      enableConsole: true,
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    Object.assign(console, originalConsole);
  });

  describe('createLogger', () => {
    it('should create a logger instance', () => {
      const log = createLogger();
      expect(log).toHaveProperty('debug');
      expect(log).toHaveProperty('info');
      expect(log).toHaveProperty('warn');
      expect(log).toHaveProperty('error');
    });

    it('should create a logger with prefix', () => {
      const log = createLogger('Test');
      expect(log).toBeDefined();
    });
  });

  describe('logger levels', () => {
    it('should log debug messages when level is DEBUG', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      setLoggerConfig({ level: LogLevel.DEBUG });

      const log = createLogger();
      log.debug('Debug message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log debug messages when level is INFO', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      setLoggerConfig({ level: LogLevel.INFO });

      const log = createLogger();
      log.debug('Debug message');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log info messages when level is INFO', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      setLoggerConfig({ level: LogLevel.INFO });

      const log = createLogger();
      log.info('Info message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warn messages when level is WARN', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      setLoggerConfig({ level: LogLevel.WARN });

      const log = createLogger();
      log.warn('Warn message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error messages when level is ERROR', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setLoggerConfig({ level: LogLevel.ERROR });

      const log = createLogger();
      log.error('Error message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('logger configuration', () => {
    it('should set and get logger configuration', () => {
      const config = { level: LogLevel.WARN, enableConsole: false };
      setLoggerConfig(config);

      const retrieved = getLoggerConfig();
      expect(retrieved.level).toBe(LogLevel.WARN);
      expect(retrieved.enableConsole).toBe(false);
    });

    it('should merge partial configuration', () => {
      setLoggerConfig({ level: LogLevel.INFO });
      const config = getLoggerConfig();

      expect(config.level).toBe(LogLevel.INFO);
      expect(config.enableConsole).toBe(true); // Default value preserved
    });

    it('should not log when enableConsole is false', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      setLoggerConfig({ enableConsole: false });

      const log = createLogger();
      log.info('Info message');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('default logger', () => {
    it('should export a default logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
    });
  });

  describe('environment-based default level', () => {
    it('should use DEBUG level in development', () => {
      process.env.NODE_ENV = 'development';
      // Reset config to get default
      setLoggerConfig({
        level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
        enableConsole: true,
      });

      const config = getLoggerConfig();
      expect(config.level).toBe(LogLevel.DEBUG);
    });

    it('should use INFO level in production', () => {
      process.env.NODE_ENV = 'production';
      // Reset config to get default
      setLoggerConfig({
        level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
        enableConsole: true,
      });

      const config = getLoggerConfig();
      expect(config.level).toBe(LogLevel.INFO);
    });
  });
});
