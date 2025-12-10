// Helper functions for E2E tests

import { invoke } from '@tauri-apps/api/core';

/**
 * Check if Tauri is available
 */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI__;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Safely invoke a Tauri command
 */
export async function safeInvoke<T = any>(
  command: string,
  args?: Record<string, any>
): Promise<T | null> {
  if (!isTauriAvailable()) {
    console.warn(`Tauri not available, skipping command: ${command}`);
    return null;
  }
  
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.warn(`Command ${command} failed:`, error);
    return null;
  }
}

/**
 * Wait for proxy to be ready
 */
export async function waitForProxy(port: number = 8080, timeout: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const status = await safeInvoke('ipc_proxy_status');
      if (status) {
        // Check if proxy is running on the specified port
        const statusObj = status as any;
        if (statusObj.running || statusObj.port === port) {
          return true;
        }
      }
    } catch (error) {
      // Continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

/**
 * Clean up test resources
 */
export async function cleanupTestResources(): Promise<void> {
  // Stop any running proxies
  try {
    await safeInvoke('ipc_proxy_stop', { port: 8080 });
  } catch (error) {
    // Ignore errors
  }
  
  // Clean up test API keys if needed
  // This would require tracking created keys during tests
}

