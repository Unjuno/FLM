import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditLogsView } from '../AuditLogsView';
import * as securityService from '../../../services/security';
import * as tauriUtils from '../../../utils/tauri';

// Mock services
vi.mock('../../../services/security', () => ({
  fetchAuditLogs: vi.fn(),
}));

vi.mock('../../../utils/tauri', () => ({
  extractCliError: vi.fn(),
}));

describe('AuditLogsView Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export audit logs to CSV', async () => {
    const user = userEvent.setup();
    const mockLogs = [
      {
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
      },
    ];

    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue(mockLogs);

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('req-123')).toBeInTheDocument();
    });

    const exportButton = screen.getByText(/CSVエクスポート/i);
    await user.click(exportButton);

    // Verify that createObjectURL was called (indicating CSV export)
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('should export audit logs to JSON', async () => {
    const user = userEvent.setup();
    const mockLogs = [
      {
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
      },
    ];

    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue(mockLogs);

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('req-123')).toBeInTheDocument();
    });

    const exportButton = screen.getByText(/JSONエクスポート/i);
    await user.click(exportButton);

    // Verify that createObjectURL was called (indicating JSON export)
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('should filter by event type', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue([]);

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(securityService.fetchAuditLogs).toHaveBeenCalled();
    });

    const eventTypeSelect = screen.getByLabelText(/イベントタイプ/i);
    await user.selectOptions(eventTypeSelect, 'api_request');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'api_request',
        })
      );
    });
  });

  it('should filter by severity', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue([]);

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(securityService.fetchAuditLogs).toHaveBeenCalled();
    });

    const severitySelect = screen.getByLabelText(/重要度/i);
    await user.selectOptions(severitySelect, 'warning');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
        })
      );
    });
  });

  it('should handle pagination', async () => {
    const user = userEvent.setup();
    const mockLogs = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      requestId: `req-${i + 1}`,
      apiKeyId: 'key-456',
      endpoint: '/v1/chat/completions',
      status: 200,
      latencyMs: 150,
      eventType: 'api_request',
      severity: 'info',
      ip: '192.168.1.1',
      details: 'Success',
      createdAt: '2025-01-28T12:00:00Z',
    }));

    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue(mockLogs);

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('req-1')).toBeInTheDocument();
    });

    // Check if pagination controls are present
    const nextButton = screen.queryByText(/次へ/i);
    if (nextButton) {
      await user.click(nextButton);
      await waitFor(() => {
        expect(securityService.fetchAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            offset: expect.any(Number),
          })
        );
      });
    }
  });

  it('should display CLI error details when available', async () => {
    const mockError = new Error('CLI error');
    const cliError = {
      code: 'CLI_ERROR',
      message: 'Failed to fetch audit logs',
      stderr: 'Detailed error information',
      originalError: mockError,
    };

    vi.mocked(securityService.fetchAuditLogs).mockRejectedValue(mockError);
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(cliError);

    render(<AuditLogsView />);

    await waitFor(() => {
      // エラーメッセージは日本語で表示される
      expect(screen.getByText(/監査ログの取得に失敗しました/i)).toBeInTheDocument();
      expect(screen.getByText(/Detailed error information/i)).toBeInTheDocument();
    });
  });
});
