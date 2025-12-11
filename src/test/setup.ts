import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import { mockInvoke, resetTauriMocks } from './mocks/tauri';

// Mock window.matchMedia globally for all tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn((query: string) => {
    const mediaQueryList = {
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    return mediaQueryList;
  }),
});

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
      // eslint-disable-next-line no-console
      console.warn('Failed to import @tauri-apps/api/core in test setup:', error);
    }
  } catch (error) {
    // Log error but don't fail the test setup
    // eslint-disable-next-line no-console
    console.error('Error in test setup:', error);
  }
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  resetTauriMocks();
});
