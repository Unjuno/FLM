import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUrl,
  isValidPort,
  isValidIpAddress,
  isValidTemperature,
  isValidMaxTokens,
  sanitizeString,
  sanitizeNumber,
  isNonEmptyString,
} from '../validation';

describe('validation', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('invalid@example')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:8080')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('://example.com')).toBe(false);
    });
  });

  describe('isValidPort', () => {
    it('should validate correct port numbers', () => {
      expect(isValidPort(1)).toBe(true);
      expect(isValidPort(8080)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
      expect(isValidPort('8080')).toBe(true);
    });

    it('should reject invalid port numbers', () => {
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
      expect(isValidPort('invalid')).toBe(false);
    });
  });

  describe('isValidIpAddress', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(isValidIpAddress('192.168.1.1')).toBe(true);
      expect(isValidIpAddress('127.0.0.1')).toBe(true);
      expect(isValidIpAddress('255.255.255.255')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      expect(isValidIpAddress('256.1.1.1')).toBe(false);
      expect(isValidIpAddress('192.168.1')).toBe(false);
      expect(isValidIpAddress('not-an-ip')).toBe(false);
    });
  });

  describe('isValidTemperature', () => {
    it('should validate correct temperature values', () => {
      expect(isValidTemperature(0.0)).toBe(true);
      expect(isValidTemperature(0.7)).toBe(true);
      expect(isValidTemperature(2.0)).toBe(true);
      expect(isValidTemperature('0.7')).toBe(true);
    });

    it('should reject invalid temperature values', () => {
      expect(isValidTemperature(-0.1)).toBe(false);
      expect(isValidTemperature(2.1)).toBe(false);
      expect(isValidTemperature('invalid')).toBe(false);
    });
  });

  describe('isValidMaxTokens', () => {
    it('should validate correct max tokens values', () => {
      expect(isValidMaxTokens(1)).toBe(true);
      expect(isValidMaxTokens(1000)).toBe(true);
      expect(isValidMaxTokens('1000')).toBe(true);
    });

    it('should reject invalid max tokens values', () => {
      expect(isValidMaxTokens(0)).toBe(false);
      expect(isValidMaxTokens(-1)).toBe(false);
      expect(isValidMaxTokens(1.5)).toBe(false);
      expect(isValidMaxTokens('invalid')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
      expect(sanitizeString('\ttest\n')).toBe('test');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });
  });

  describe('sanitizeNumber', () => {
    it('should parse and validate numbers', () => {
      expect(sanitizeNumber('123')).toBe(123);
      expect(sanitizeNumber('123.45')).toBe(123.45);
      expect(sanitizeNumber(123)).toBe(123);
    });

    it('should respect min and max constraints', () => {
      expect(sanitizeNumber('50', 0, 100)).toBe(50);
      expect(sanitizeNumber('150', 0, 100)).toBe(null);
      expect(sanitizeNumber('-10', 0, 100)).toBe(null);
    });

    it('should return null for invalid input', () => {
      expect(sanitizeNumber('invalid')).toBe(null);
      expect(sanitizeNumber('')).toBe(null);
    });
  });

  describe('isNonEmptyString', () => {
    it('should validate non-empty strings', () => {
      expect(isNonEmptyString('test')).toBe(true);
      expect(isNonEmptyString('  test  ')).toBe(true);
    });

    it('should reject empty or non-string values', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });
});
