// Tauri IPC utilities

import { invoke as tauriInvoke, type InvokeArgs } from '@tauri-apps/api/core';

/**
 * Check if Tauri is available
 */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Enhanced error information
 */
export interface CliError {
  code: string;
  message: string;
  stderr?: string;
  originalError?: unknown;
}

/**
 * Safely invoke Tauri command with enhanced error handling
 */
export async function safeInvoke<T = unknown>(
  cmd: string,
  args?: InvokeArgs
): Promise<T> {
  if (!isTauriAvailable()) {
    throw new Error('Tauri is not available. Please ensure you are running this application in a Tauri environment.');
  }

  try {
    // Only pass args if it's defined to avoid passing undefined as second argument
    return args !== undefined ? await tauriInvoke<T>(cmd, args) : await tauriInvoke<T>(cmd);
  } catch (error) {
    // Enhanced error handling for CLI errors
    if (error && typeof error === 'object' && 'code' in error) {
      const cliError = error as { code: string; message: string; stderr?: string };
      const enhancedError = new Error(`CLI Error [${cliError.code}]: ${cliError.message}`);
      // Attach CLI error information to the error object
      Object.defineProperty(enhancedError, 'cliError', {
        value: {
          code: cliError.code,
          message: cliError.message,
          stderr: cliError.stderr,
          originalError: error,
        } as CliError,
        enumerable: true,
        writable: false,
      });
      throw enhancedError;
    }
    
    // Handle network or connection errors
    if (error instanceof Error) {
      const lowerMessage = error.message.toLowerCase();
      if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('fetch')) {
        throw new Error(`Network error: ${error.message}. Please check your connection and try again.`);
      }
    }
    
    throw error;
  }
}

/**
 * Extract CLI error information from an error object
 */
export function extractCliError(error: unknown): CliError | null {
  if (error && typeof error === 'object' && 'cliError' in error) {
    const cliError = (error as { cliError?: CliError }).cliError;
    if (cliError && typeof cliError === 'object' && 'code' in cliError && 'message' in cliError) {
      return cliError;
    }
  }
  return null;
}

