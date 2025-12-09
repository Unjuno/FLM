import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  formatDate,
  formatProxyMode,
  formatEngineStatus,
} from '../formatters';

describe('formatters', () => {
  describe('formatDateTime', () => {
    it('should format date and time in Japanese locale', () => {
      const dateString = '2025-01-28T12:34:56Z';
      const result = formatDateTime(dateString);

      expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('should handle ISO date strings', () => {
      const dateString = '2025-01-28T12:34:56.789Z';
      const result = formatDateTime(dateString);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format different dates correctly', () => {
      const date1 = '2025-01-01T00:00:00Z';
      const date2 = '2025-12-31T23:59:59Z';

      const result1 = formatDateTime(date1);
      const result2 = formatDateTime(date2);

      expect(result1).not.toBe(result2);
      expect(result1).toContain('2025');
      expect(result2).toContain('2025');
    });
  });

  describe('formatDate', () => {
    it('should format date only in Japanese locale', () => {
      const dateString = '2025-01-28T12:34:56Z';
      const result = formatDate(dateString);

      expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/);
      expect(result).not.toMatch(/:/);
    });

    it('should handle ISO date strings', () => {
      const dateString = '2025-01-28T12:34:56.789Z';
      const result = formatDate(dateString);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format different dates correctly', () => {
      const date1 = '2025-01-01T00:00:00Z';
      const date2 = '2025-12-31T23:59:59Z';

      const result1 = formatDate(date1);
      const result2 = formatDate(date2);

      expect(result1).not.toBe(result2);
      expect(result1).toContain('2025');
      expect(result2).toContain('2025');
    });

    it('should not include time information', () => {
      const dateString = '2025-01-28T12:34:56Z';
      const result = formatDate(dateString);

      expect(result).not.toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('formatProxyMode', () => {
    it('should format string mode correctly', () => {
      expect(formatProxyMode('local-http')).toBe('Local HTTP');
      expect(formatProxyMode('dev-self-signed')).toBe('Dev Self-Signed');
      expect(formatProxyMode('https-acme')).toBe('HTTPS ACME');
      expect(formatProxyMode('packaged-ca')).toBe('Packaged CA');
    });

    it('should format object mode with LocalHttp', () => {
      expect(formatProxyMode({ LocalHttp: {} })).toBe('Local HTTP');
      expect(formatProxyMode({ 'local-http': {} })).toBe('Local HTTP');
    });

    it('should format object mode with DevSelfSigned', () => {
      expect(formatProxyMode({ DevSelfSigned: {} })).toBe('Dev Self-Signed');
      expect(formatProxyMode({ 'dev-self-signed': {} })).toBe('Dev Self-Signed');
    });

    it('should format object mode with HttpsAcme', () => {
      expect(formatProxyMode({ HttpsAcme: {} })).toBe('HTTPS ACME');
      expect(formatProxyMode({ 'https-acme': {} })).toBe('HTTPS ACME');
    });

    it('should format object mode with PackagedCa', () => {
      expect(formatProxyMode({ PackagedCa: {} })).toBe('Packaged CA');
      expect(formatProxyMode({ 'packaged-ca': {} })).toBe('Packaged CA');
    });

    it('should return Unknown for invalid mode', () => {
      expect(formatProxyMode(null as any)).toBe('Unknown');
      expect(formatProxyMode(undefined as any)).toBe('Unknown');
    });

    it('should return JSON string for unknown object mode', () => {
      const result = formatProxyMode({ UnknownMode: {} });
      expect(result).toContain('UnknownMode');
    });
  });

  describe('formatEngineStatus', () => {
    it('should format string status correctly', () => {
      expect(formatEngineStatus('installed-only')).toBe('Installed Only');
      expect(formatEngineStatus('running-healthy')).toBe('Running Healthy');
      expect(formatEngineStatus('running-degraded')).toBe('Running Degraded');
      expect(formatEngineStatus('error-network')).toBe('Network Error');
      expect(formatEngineStatus('error-api')).toBe('API Error');
    });

    it('should format tagged enum status with latency', () => {
      const status = {
        status: 'running-healthy',
        latency_ms: 100,
      };
      expect(formatEngineStatus(status)).toBe('Running Healthy (100ms)');
    });

    it('should format tagged enum status with reason', () => {
      const status = {
        status: 'error-network',
        reason: 'Connection timeout',
      };
      expect(formatEngineStatus(status)).toBe('Network Error: Connection timeout');
    });

    it('should format untagged enum status with RunningHealthy', () => {
      expect(formatEngineStatus({ RunningHealthy: { latency_ms: 50 } })).toBe(
        'Running Healthy (50ms)'
      );
      expect(formatEngineStatus({ 'running-healthy': { latency_ms: 50 } })).toBe(
        'Running Healthy (50ms)'
      );
    });

    it('should format untagged enum status with RunningDegraded', () => {
      const status = {
        RunningDegraded: { latency_ms: 200, reason: 'High latency' },
      };
      expect(formatEngineStatus(status)).toBe('Running Degraded (200ms): High latency');
    });

    it('should format untagged enum status with ErrorNetwork', () => {
      expect(formatEngineStatus({ ErrorNetwork: { reason: 'Timeout' } })).toBe(
        'Network Error: Timeout'
      );
    });

    it('should format untagged enum status with ErrorApi', () => {
      expect(formatEngineStatus({ ErrorApi: { reason: 'Invalid response' } })).toBe(
        'API Error: Invalid response'
      );
    });

    it('should return Unknown for invalid status', () => {
      expect(formatEngineStatus(null as any)).toBe('Unknown');
      expect(formatEngineStatus(undefined as any)).toBe('Unknown');
    });

    it('should return JSON string for unknown object status', () => {
      const result = formatEngineStatus({ UnknownStatus: {} });
      expect(result).toContain('UnknownStatus');
    });
  });
});
