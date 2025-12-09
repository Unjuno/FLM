import { vi } from 'vitest';
import type { InvokeArgs } from '@tauri-apps/api/core';

export const mockInvoke = vi.fn<[string, InvokeArgs?], Promise<unknown>>();

/**
 * Setup Tauri mocks with default implementations
 */
export async function setupTauriMocks() {
  const { invoke } = await import('@tauri-apps/api/core');
  vi.mocked(invoke).mockImplementation(mockInvoke);
  
  // Set default behavior for common commands
  mockInvoke.mockImplementation(() => {
    // Default implementation returns undefined
    // Tests should override this with specific mock implementations
    return Promise.resolve(undefined);
  });
}

/**
 * Reset Tauri mocks to default state
 */
export function resetTauriMocks() {
  mockInvoke.mockReset();
  // Set default resolved value to avoid undefined errors
  mockInvoke.mockResolvedValue(undefined);
  
  // Ensure window.__TAURI__ is properly set
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, '__TAURI__', {
      value: {
        core: {
          invoke: mockInvoke,
        },
      },
      writable: true,
      configurable: true,
    });
  }
}

/**
 * Create a mock response helper for common IPC commands
 */
export function createMockResponse<T>(data: T) {
  return {
    version: '1.0',
    data,
  };
}

/**
 * Create a mock error response helper
 */
export function createMockError(code: string, message: string, stderr?: string) {
  return {
    code,
    message,
    stderr,
  };
}
