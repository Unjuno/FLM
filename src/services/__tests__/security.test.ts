import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchAuditLogs,
  fetchIntrusionAttempts,
  fetchAnomalyDetections,
  fetchBlockedIps,
  unblockIp,
  clearTemporaryBlocks,
  type AuditLogsFilter,
  type IntrusionFilter,
  type AnomalyFilter,
} from '../security';

// Mock Tauri utilities
vi.mock('../../utils/tauri', () => ({
  safeInvoke: vi.fn(),
}));

describe('security service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAuditLogs', () => {
    it('should fetch and normalize audit logs', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          logs: [
            {
              id: 1,
              request_id: 'req-123',
              api_key_id: 'key-456',
              endpoint: '/v1/chat/completions',
              status: 200,
              latency_ms: 150,
              event_type: 'api_request',
              severity: 'info',
              ip: '192.168.1.1',
              details: 'Success',
              created_at: '2025-01-28T12:00:00Z',
            },
          ],
          limit: 10,
          offset: 0,
        },
      });

      const result = await fetchAuditLogs();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        requestId: 'req-123',
        apiKeyId: 'key-456',
        endpoint: '/v1/chat/completions',
        status: 200,
        latencyMs: 150,
        eventType: 'api_request',
        severity: 'info',
        ip: '192.168.1.1',
        details: 'Success',
        createdAt: '2025-01-28T12:00:00Z',
      });
    });

    it('should apply filters when provided', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          logs: [],
          limit: 10,
          offset: 0,
        },
      });

      const filter: AuditLogsFilter = {
        eventType: 'api_request',
        severity: 'error',
        ip: '192.168.1.1',
        limit: 20,
        offset: 10,
      };

      await fetchAuditLogs(filter);

      expect(safeInvoke).toHaveBeenCalledWith('ipc_security_audit_logs', {
        event_type: 'api_request',
        severity: 'error',
        ip: '192.168.1.1',
        limit: 20,
        offset: 10,
      });
    });

    it('should return empty array when no logs', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          logs: [],
          limit: 10,
          offset: 0,
        },
      });

      const result = await fetchAuditLogs();

      expect(result).toEqual([]);
    });
  });

  describe('fetchIntrusionAttempts', () => {
    it('should fetch and normalize intrusion attempts', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          attempts: [
            {
              id: 'intrusion-1',
              ip: '192.168.1.100',
              pattern: 'sql_injection',
              score: 0.95,
              request_path: '/v1/chat/completions',
              user_agent: 'Mozilla/5.0',
              method: 'POST',
              created_at: '2025-01-28T12:00:00Z',
            },
          ],
          limit: 10,
          offset: 0,
        },
      });

      const result = await fetchIntrusionAttempts();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'intrusion-1',
        ip: '192.168.1.100',
        pattern: 'sql_injection',
        score: 0.95,
        requestPath: '/v1/chat/completions',
        userAgent: 'Mozilla/5.0',
        method: 'POST',
        createdAt: '2025-01-28T12:00:00Z',
      });
    });

    it('should apply filters when provided', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          attempts: [],
          limit: 10,
          offset: 0,
        },
      });

      const filter: IntrusionFilter = {
        ip: '192.168.1.100',
        minScore: 0.8,
        limit: 20,
        offset: 10,
      };

      await fetchIntrusionAttempts(filter);

      expect(safeInvoke).toHaveBeenCalledWith('ipc_security_intrusion', {
        ip: '192.168.1.100',
        min_score: 0.8,
        limit: 20,
        offset: 10,
      });
    });
  });

  describe('fetchAnomalyDetections', () => {
    it('should fetch and normalize anomaly detections', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          detections: [
            {
              id: 'anomaly-1',
              ip: '192.168.1.200',
              anomaly_type: 'rate_limit_exceeded',
              score: 0.85,
              details: 'Too many requests',
              created_at: '2025-01-28T12:00:00Z',
            },
          ],
          limit: 10,
          offset: 0,
        },
      });

      const result = await fetchAnomalyDetections();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'anomaly-1',
        ip: '192.168.1.200',
        anomalyType: 'rate_limit_exceeded',
        score: 0.85,
        details: 'Too many requests',
        createdAt: '2025-01-28T12:00:00Z',
      });
    });

    it('should apply filters when provided', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          detections: [],
          limit: 10,
          offset: 0,
        },
      });

      const filter: AnomalyFilter = {
        ip: '192.168.1.200',
        anomalyType: 'rate_limit_exceeded',
        limit: 20,
        offset: 10,
      };

      await fetchAnomalyDetections(filter);

      expect(safeInvoke).toHaveBeenCalledWith('ipc_security_anomaly', {
        ip: '192.168.1.200',
        anomaly_type: 'rate_limit_exceeded',
        limit: 20,
        offset: 10,
      });
    });
  });

  describe('fetchBlockedIps', () => {
    it('should fetch and normalize blocked IPs', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          blocked_ips: [
            {
              ip: '192.168.1.1',
              failure_count: 5,
              first_failure_at: '2025-01-28T10:00:00Z',
              blocked_until: null,
              permanent_block: true,
              last_attempt: '2025-01-28T12:00:00Z',
            },
            {
              ip: '192.168.1.2',
              failure_count: 3,
              first_failure_at: '2025-01-28T11:00:00Z',
              blocked_until: '2025-01-29T11:00:00Z',
              permanent_block: false,
              last_attempt: '2025-01-28T13:00:00Z',
            },
          ],
        },
      });

      const result = await fetchBlockedIps();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        ip: '192.168.1.1',
        failureCount: 5,
        firstFailureAt: '2025-01-28T10:00:00Z',
        blockedUntil: null,
        permanentBlock: true,
        lastAttempt: '2025-01-28T12:00:00Z',
      });
      expect(result[1]).toMatchObject({
        ip: '192.168.1.2',
        failureCount: 3,
        permanentBlock: false,
      });
    });

    it('should return empty array when no blocked IPs', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: {
          blocked_ips: [],
        },
      });

      const result = await fetchBlockedIps();

      expect(result).toEqual([]);
    });
  });

  describe('unblockIp', () => {
    it('should call unblock IP command', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce(undefined);

      await unblockIp('192.168.1.1');

      expect(safeInvoke).toHaveBeenCalledWith('ipc_security_ip_blocklist_unblock', {
        ip: '192.168.1.1',
      });
    });
  });

  describe('clearTemporaryBlocks', () => {
    it('should call clear temporary blocks command', async () => {
      const { safeInvoke } = await import('../../utils/tauri');
      vi.mocked(safeInvoke).mockResolvedValueOnce(undefined);

      await clearTemporaryBlocks();

      // safeInvokeは引数がない場合、undefinedを渡さない
      expect(safeInvoke).toHaveBeenCalled();
      const calls = vi.mocked(safeInvoke).mock.calls;
      expect(calls[0][0]).toBe('ipc_security_ip_blocklist_clear');
      expect(calls[0][1]).toBeUndefined();
    });
  });
});
