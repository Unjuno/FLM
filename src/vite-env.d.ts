/// <reference types="vite/client" />

// Tauri環境の型定義
interface Window {
  __TAURI__?: {
    [key: string]: unknown;
  };
}