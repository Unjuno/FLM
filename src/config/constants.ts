// Application constants

/**
 * Timing constants for UI operations
 */
export const TIMING = {
  STATUS_REFRESH_DELAY_MS: 1000,
  MESSAGE_AUTO_DISMISS_MS: 3000,
  STATUS_POLL_INTERVAL_MS: 30000,
} as const;

/**
 * Silent error patterns that should not be shown to users
 */
export const SILENT_ERROR_PATTERNS = [
  'not found',
  'not running',
  'CLI_BINARY_NOT_FOUND',
] as const;

/**
 * Default proxy configuration
 */
export const DEFAULT_PROXY_CONFIG = {
  MODE: 'dev-selfsigned' as const,
  PORT: 8080,
} as const;

/**
 * Default chat configuration
 */
export const DEFAULT_CHAT_CONFIG = {
  TEMPERATURE: 0.7,
  MAX_TOKENS: 1000,
} as const;

