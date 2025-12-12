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

describe('AuditLogsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render audit logs view', async () => {
    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue([]);

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText(/監査ログ/i)).toBeInTheDocument();
    });
  });

  it('should display loading spinner while loading', () => {
    vi.mocked(securityService.fetchAuditLogs).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AuditLogsView />);

    expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
  });

  it('should display audit logs when loaded', async () => {
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

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('req-123')).toBeInTheDocument();
      expect(screen.getByText('/v1/chat/completions')).toBeInTheDocument();
    });
  });

  it('should display error when loading fails', async () => {
    vi.mocked(securityService.fetchAuditLogs).mockRejectedValue(
      new Error('Failed to fetch audit logs')
    );
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(null);

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText(/監査ログの取得に失敗しました/i)).toBeInTheDocument();
    });
  });

  it('should apply filters when filter button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue([]);

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(securityService.fetchAuditLogs).toHaveBeenCalled();
    });

    const ipInput = screen.getByPlaceholderText(/例: 192.168.1.1/i);
    await user.type(ipInput, '192.168.1.1');

    const filterButton = screen.getByText(/フィルター適用/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(securityService.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '192.168.1.1',
        })
      );
    });
  });

  it('should clear filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchAuditLogs).mockResolvedValue([]);

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(securityService.fetchAuditLogs).toHaveBeenCalled();
    });

    const ipInput = screen.getByPlaceholderText(/例: 192.168.1.1/i);
    await user.type(ipInput, '192.168.1.1');

    const clearButton = screen.getByText(/フィルタークリア/i);
    await user.click(clearButton);

    expect(ipInput).toHaveValue('');
  });
});
