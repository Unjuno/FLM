import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { IpBlocklistManagement } from '../IpBlocklistManagement';
import * as securityService from '../../services/security';
import * as tauriUtils from '../../utils/tauri';

// Mock services
vi.mock('../../services/security', () => ({
  fetchBlockedIps: vi.fn(),
  unblockIp: vi.fn(),
  clearTemporaryBlocks: vi.fn(),
}));

vi.mock('../../utils/tauri', () => ({
  extractCliError: vi.fn(),
}));

// Mock ConfirmDialog - use actual component but make it testable
vi.mock('../../components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({ message, onConfirm, onCancel, confirmText = '確認' }: any) => (
    <div data-testid="confirm-dialog">
      <p>{message}</p>
      <button onClick={onConfirm}>{confirmText}</button>
      <button onClick={onCancel}>キャンセル</button>
    </div>
  ),
}));

describe('IpBlocklistManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderIpBlocklistManagement = () => {
    return render(
      <BrowserRouter>
        <IpBlocklistManagement />
      </BrowserRouter>
    );
  };

  it('should render IP blocklist management page', async () => {
    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue([]);

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(screen.getByText(/IPブロックリスト管理/i)).toBeInTheDocument();
    });
  });

  it('should display loading spinner while loading', () => {
    vi.mocked(securityService.fetchBlockedIps).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderIpBlocklistManagement();

    expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
  });

  it('should display blocked IPs when loaded', async () => {
    const mockBlockedIps = [
      {
        ip: '192.168.1.1',
        failureCount: 5,
        firstFailureAt: '2025-01-28T10:00:00Z',
        blockedUntil: null,
        permanentBlock: true,
        lastAttempt: '2025-01-28T12:00:00Z',
      },
      {
        ip: '192.168.1.2',
        failureCount: 3,
        firstFailureAt: '2025-01-28T11:00:00Z',
        blockedUntil: '2025-01-29T11:00:00Z',
        permanentBlock: false,
        lastAttempt: '2025-01-28T13:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue(mockBlockedIps);

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.2')).toBeInTheDocument();
    });
  });

  it('should display error when loading fails', async () => {
    vi.mocked(securityService.fetchBlockedIps).mockRejectedValue(
      new Error('Failed to fetch blocked IPs')
    );
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(null);

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(screen.getByText(/IPブロックリストの取得に失敗しました/i)).toBeInTheDocument();
    });
  });

  it('should show confirm dialog when unblock button is clicked', async () => {
    const user = userEvent.setup();
    const mockBlockedIps = [
      {
        ip: '192.168.1.1',
        failureCount: 5,
        firstFailureAt: '2025-01-28T10:00:00Z',
        blockedUntil: null,
        permanentBlock: true,
        lastAttempt: '2025-01-28T12:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue(mockBlockedIps);
    vi.mocked(securityService.unblockIp).mockResolvedValue();

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    const unblockButtons = screen.getAllByText(/ブロック解除/i);
    await user.click(unblockButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText(/IP 192.168.1.1 のブロックを解除しますか/i)).toBeInTheDocument();
    });
  });

  it('should unblock IP when confirmed', async () => {
    const user = userEvent.setup();
    const mockBlockedIps = [
      {
        ip: '192.168.1.1',
        failureCount: 5,
        firstFailureAt: '2025-01-28T10:00:00Z',
        blockedUntil: null,
        permanentBlock: true,
        lastAttempt: '2025-01-28T12:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchBlockedIps)
      .mockResolvedValueOnce(mockBlockedIps)
      .mockResolvedValueOnce([]);
    vi.mocked(securityService.unblockIp).mockResolvedValue();

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    const unblockButtons = screen.getAllByText(/ブロック解除/i);
    await user.click(unblockButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('確認');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(securityService.unblockIp).toHaveBeenCalledWith('192.168.1.1');
    });
  });

  it('should show confirm dialog when clear temporary blocks button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue([]);
    vi.mocked(securityService.clearTemporaryBlocks).mockResolvedValue();

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(securityService.fetchBlockedIps).toHaveBeenCalled();
    });

    const clearButton = screen.getByText(/一時ブロックをすべて解除/i);
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText(/すべての一時ブロックを解除しますか/i)).toBeInTheDocument();
    });
  });

  it('should clear temporary blocks when confirmed', async () => {
    const user = userEvent.setup();
    vi.mocked(securityService.fetchBlockedIps)
      .mockResolvedValueOnce([
        {
          ip: '192.168.1.2',
          failureCount: 3,
          firstFailureAt: '2025-01-28T11:00:00Z',
          blockedUntil: '2025-01-29T11:00:00Z',
          permanentBlock: false,
          lastAttempt: '2025-01-28T13:00:00Z',
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(securityService.clearTemporaryBlocks).mockResolvedValue();

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(securityService.fetchBlockedIps).toHaveBeenCalled();
    });

    const clearButton = screen.getByText(/一時ブロックをすべて解除/i);
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('確認');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(securityService.clearTemporaryBlocks).toHaveBeenCalled();
    });
  });

  it('should separate permanent and temporary blocks', async () => {
    const mockBlockedIps = [
      {
        ip: '192.168.1.1',
        failureCount: 5,
        firstFailureAt: '2025-01-28T10:00:00Z',
        blockedUntil: null,
        permanentBlock: true,
        lastAttempt: '2025-01-28T12:00:00Z',
      },
      {
        ip: '192.168.1.2',
        failureCount: 3,
        firstFailureAt: '2025-01-28T11:00:00Z',
        blockedUntil: '2025-01-29T11:00:00Z',
        permanentBlock: false,
        lastAttempt: '2025-01-28T13:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue(mockBlockedIps);

    renderIpBlocklistManagement();

    await waitFor(() => {
      expect(screen.getByText(/永続ブロック/i)).toBeInTheDocument();
      expect(screen.getByText(/一時ブロック/i)).toBeInTheDocument();
    });
  });
});
