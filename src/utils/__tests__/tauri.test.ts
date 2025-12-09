import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeInvoke, extractCliError, isTauriAvailable } from '../tauri';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { mockInvoke } from '../../test/mocks/tauri';

// Mock Tauri API is already set up in src/test/setup.ts
// This test file uses the global mock setup

describe('tauri utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.__TAURI__ for tests that need to check availability
    // Note: src/test/setup.ts will restore it, but we need to test both cases
    delete (window as any).__TAURI__;
    // Ensure mockInvoke is used for invoke calls
    vi.mocked(tauriInvoke).mockImplementation(mockInvoke);
  });

  describe('isTauriAvailable', () => {
    it('should return false when Tauri is not available', () => {
      expect(isTauriAvailable()).toBe(false);
    });

    it('should return true when Tauri is available', () => {
      (window as any).__TAURI__ = {};
      expect(isTauriAvailable()).toBe(true);
    });
  });

  describe('safeInvoke', () => {
    it('should throw error when Tauri is not available', async () => {
      await expect(safeInvoke('test_command')).rejects.toThrow(
        'Tauri is not available'
      );
    });

    it('should invoke Tauri command when available', async () => {
      (window as any).__TAURI__ = {};
      vi.mocked(tauriInvoke).mockResolvedValue({ success: true });

      const result = await safeInvoke('test_command', { arg: 'value' });

      expect(tauriInvoke).toHaveBeenCalledWith('test_command', { arg: 'value' });
      expect(result).toEqual({ success: true });
    });

    it('should handle CLI errors with enhanced error information', async () => {
      (window as any).__TAURI__ = {};
      const cliError = {
        code: 'CLI_ERROR',
        message: 'Command failed',
        stderr: 'Error details',
      };
      vi.mocked(tauriInvoke).mockRejectedValue(cliError);

      await expect(safeInvoke('test_command')).rejects.toThrow(
        'CLI Error [CLI_ERROR]: Command failed'
      );

      try {
        await safeInvoke('test_command');
      } catch (error) {
        const extracted = extractCliError(error);
        expect(extracted).toEqual({
          code: 'CLI_ERROR',
          message: 'Command failed',
          stderr: 'Error details',
          originalError: cliError,
        });
      }
    });

    it('should handle network errors', async () => {
      (window as any).__TAURI__ = {};
      const networkError = new Error('network connection failed');
      vi.mocked(tauriInvoke).mockRejectedValue(networkError);

      await expect(safeInvoke('test_command')).rejects.toThrow(
        'Network error: network connection failed'
      );
    });

    it('should handle connection errors', async () => {
      (window as any).__TAURI__ = {};
      const connectionError = new Error('connection timeout');
      vi.mocked(tauriInvoke).mockRejectedValue(connectionError);

      await expect(safeInvoke('test_command')).rejects.toThrow(
        'Network error: connection timeout'
      );
    });

    it('should rethrow other errors as-is', async () => {
      (window as any).__TAURI__ = {};
      const otherError = new Error('Other error');
      vi.mocked(tauriInvoke).mockRejectedValue(otherError);

      await expect(safeInvoke('test_command')).rejects.toThrow('Other error');
    });
  });

  describe('extractCliError', () => {
    it('should return null for errors without cliError', () => {
      const error = new Error('Regular error');
      expect(extractCliError(error)).toBeNull();
    });

    it('should extract CLI error information from error object', () => {
      const cliError = {
        code: 'CLI_ERROR',
        message: 'Command failed',
        stderr: 'Error details',
        originalError: {},
      };
      const error = new Error('CLI Error');
      Object.defineProperty(error, 'cliError', {
        value: cliError,
        enumerable: true,
        writable: false,
      });

      const extracted = extractCliError(error);
      expect(extracted).toEqual(cliError);
    });

    it('should return null for invalid cliError structure', () => {
      const error = new Error('Error');
      Object.defineProperty(error, 'cliError', {
        value: { invalid: 'structure' },
        enumerable: true,
        writable: false,
      });

      expect(extractCliError(error)).toBeNull();
    });

    it('should return null for null error', () => {
      expect(extractCliError(null)).toBeNull();
    });

    it('should return null for undefined error', () => {
      expect(extractCliError(undefined)).toBeNull();
    });
  });
});
