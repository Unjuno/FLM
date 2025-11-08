/// <reference types="vite/client" />

// Tauri環境の型定義
import type { invoke as tauriInvoke } from '@tauri-apps/api/core';

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: typeof tauriInvoke;
      };
      [key: string]: unknown;
    };
  }
}
