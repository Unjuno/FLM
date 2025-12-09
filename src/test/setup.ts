import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import { mockInvoke, resetTauriMocks } from './mocks/tauri';

// Mock Tauri API - must be hoisted before imports
vi.mock('@tauri-apps/api/core', async () => {
  const actual = await vi.importActual<typeof import('@tauri-apps/api/core')>('@tauri-apps/api/core');
  return {
    ...actual,
    invoke: vi.fn(),
  };
});

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  open: vi.fn(),
}));

// Mock window.__TAURI__ - must be set before any Tauri API calls
Object.defineProperty(window, '__TAURI__', {
  value: {
    core: {
      invoke: mockInvoke,
    },
  },
  writable: true,
  configurable: true,
});

// Setup Tauri mocks before each test
beforeEach(async () => {
  try {
  // Reset all mocks
  vi.clearAllMocks();
  resetTauriMocks();
  
  // Ensure window.__TAURI__ is set
  if (!(window as Window & { __TAURI__?: unknown }).__TAURI__) {
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
  
    // Setup invoke mock implementation with error handling
    try {
  const { invoke } = await import('@tauri-apps/api/core');
  vi.mocked(invoke).mockImplementation(mockInvoke);
    } catch (error) {
      // If import fails, ensure mockInvoke is still available
      console.warn('Failed to import @tauri-apps/api/core in test setup:', error);
    }
  } catch (error) {
    // Log error but don't fail the test setup
    console.error('Error in test setup:', error);
  }
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  resetTauriMocks();
});
