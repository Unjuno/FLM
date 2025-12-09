import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createErrorHandler,
  COMMON_SILENT_PATTERNS,
} from '../errorHandler';
import { extractCliError } from '../tauri';

// Mock extractCliError
vi.mock('../tauri', () => ({
  extractCliError: vi.fn(),
}));

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createErrorHandler', () => {
    it('should create an error handler that shows errors by default', () => {
      const handler = createErrorHandler({
        defaultMessage: 'Test error',
      });

      const error = new Error('Something went wrong');
      const result = handler(error);

      expect(result.shouldShow).toBe(true);
      expect(result.message).toBe('Something went wrong');
    });

    it('should use default message when error has no message', () => {
      const handler = createErrorHandler({
        defaultMessage: 'Default error message',
      });

      const error = {};
      const result = handler(error);

      expect(result.shouldShow).toBe(true);
      expect(result.message).toBe('Default error message');
    });

    it('should silence errors matching silent patterns', () => {
      const handler = createErrorHandler({
        defaultMessage: 'Test error',
        silentPatterns: ['not found', 'not running'],
      });

      const error1 = new Error('Service not found');
      const result1 = handler(error1);
      expect(result1.shouldShow).toBe(false);

      const error2 = new Error('Service not running');
      const result2 = handler(error2);
      expect(result2.shouldShow).toBe(false);

      const error3 = new Error('Other error');
      const result3 = handler(error3);
      expect(result3.shouldShow).toBe(true);
    });

    it('should include stderr in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      vi.mocked(extractCliError).mockReturnValue({
        code: 'TEST_ERROR',
        message: 'Test error',
        stderr: 'Detailed error information',
      });

      const handler = createErrorHandler({
        defaultMessage: 'Test error',
      });

      const error = new Error('Test error');
      const result = handler(error);

      expect(result.message).toContain('詳細: Detailed error information');

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stderr in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.mocked(extractCliError).mockReturnValue({
        code: 'TEST_ERROR',
        message: 'Test error',
        stderr: 'Detailed error information',
      });

      const handler = createErrorHandler({
        defaultMessage: 'Test error',
      });

      const error = new Error('Test error');
      const result = handler(error);

      expect(result.message).not.toContain('詳細:');

      process.env.NODE_ENV = originalEnv;
    });

    it('should respect showStderr option', () => {
      vi.mocked(extractCliError).mockReturnValue({
        code: 'TEST_ERROR',
        message: 'Test error',
        stderr: 'Detailed error information',
      });

      const handler = createErrorHandler({
        defaultMessage: 'Test error',
        showStderr: false,
      });

      const error = new Error('Test error');
      const result = handler(error);

      expect(result.message).not.toContain('詳細:');
    });

    it('should include cliError in result', () => {
      const cliError = {
        code: 'TEST_ERROR',
        message: 'Test error',
        stderr: 'Detailed error information',
      };

      vi.mocked(extractCliError).mockReturnValue(cliError);

      const handler = createErrorHandler({
        defaultMessage: 'Test error',
      });

      const error = new Error('Test error');
      const result = handler(error);

      expect(result.cliError).toEqual(cliError);
    });
  });

  describe('COMMON_SILENT_PATTERNS', () => {
    it('should contain expected patterns', () => {
      expect(COMMON_SILENT_PATTERNS).toContain('not found');
      expect(COMMON_SILENT_PATTERNS).toContain('not running');
      expect(COMMON_SILENT_PATTERNS).toContain('CLI_BINARY_NOT_FOUND');
    });
  });
});
