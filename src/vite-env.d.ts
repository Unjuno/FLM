/// <reference types="vite/client" />

// Tauri global type definitions
interface Window {
  __TAURI__?: {
    core?: {
      invoke?: unknown;
    };
  };
}
