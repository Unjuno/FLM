// Input validation utilities

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate port number
 */
export function isValidPort(port: number | string): boolean {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
  return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
}

/**
 * Validate IP address (IPv4)
 */
export function isValidIpAddress(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

/**
 * Validate temperature value (0.0 to 2.0)
 */
export function isValidTemperature(temp: number | string): boolean {
  const tempNum = typeof temp === 'string' ? parseFloat(temp) : temp;
  return !isNaN(tempNum) && tempNum >= 0.0 && tempNum <= 2.0;
}

/**
 * Validate max tokens (positive integer)
 */
export function isValidMaxTokens(tokens: number | string): boolean {
  const tokensNum = typeof tokens === 'string' ? parseInt(tokens, 10) : tokens;
  return Number.isInteger(tokensNum) && tokensNum > 0;
}

/**
 * Sanitize string input (remove leading/trailing whitespace)
 */
export function sanitizeString(input: string): string {
  return input.trim();
}

/**
 * Sanitize number input (parse and validate)
 */
export function sanitizeNumber(input: string | number, min?: number, max?: number): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  if (isNaN(num)) {
    return null;
  }
  if (min !== undefined && num < min) {
    return null;
  }
  if (max !== undefined && num > max) {
    return null;
  }
  return num;
}

/**
 * Validate non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
