// Error handling utilities

import { extractCliError, type CliError } from './tauri';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  defaultMessage: string;
  silentPatterns?: readonly string[];
  showStderr?: boolean;
}

/**
 * Error handler result
 */
export interface ErrorHandlerResult {
  message: string;
  shouldShow: boolean;
  cliError?: CliError;
}

/**
 * Create an error handler function
 */
export function createErrorHandler(config: ErrorHandlerConfig) {
  const {
    defaultMessage,
    silentPatterns = [],
    showStderr = process.env.NODE_ENV === 'development',
  } = config;

  return (err: unknown): ErrorHandlerResult => {
    const cliError = extractCliError(err);
    const errorMessage = err instanceof Error ? err.message : defaultMessage;

    const shouldSilence = silentPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );

    const finalMessage =
      cliError?.stderr && showStderr
        ? `${errorMessage}\n詳細: ${cliError.stderr}`
        : errorMessage;

    return {
      message: finalMessage,
      shouldShow: !shouldSilence,
      cliError: cliError ?? undefined,
    };
  };
}

/**
 * Common silent error patterns
 */
export const COMMON_SILENT_PATTERNS = [
  'not found',
  'not running',
  'CLI_BINARY_NOT_FOUND',
] as const;
