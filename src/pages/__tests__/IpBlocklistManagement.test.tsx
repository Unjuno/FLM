import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '../../contexts/I18nContext';
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
interface MockConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
}
vi.mock('../../components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({
    message,
    onConfirm,
    onCancel,
    confirmText = '確認',
  }: MockConfirmDialogProps) => (
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
    // デフォルトのモックを設定（各テストで上書き可能）
    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue([]);
    vi.mocked(securityService.unblockIp).mockResolvedValue();
    vi.mocked(securityService.clearTemporaryBlocks).mockResolvedValue();
  });

  const renderIpBlocklistManagement = () => {
    return render(
      <BrowserRouter>
        <I18nProvider>
          <IpBlocklistManagement />
        </I18nProvider>
      </BrowserRouter>
    );
  };

  it('should render IP blocklist management page', async () => {
    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue([]);

    renderIpBlocklistManagement();

    await waitFor(() => {
      // i18nを使用しているため、柔軟にチェック
      expect(
        screen.getByText(/IPブロックリスト|blocklist/i)
      ).toBeInTheDocument();
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

    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue(
      mockBlockedIps
    );

    renderIpBlocklistManagement();

    await waitFor(() => {
      // IPアドレスはcode要素内に表示されるため、柔軟にチェック
      // getByTextはcode要素内のテキストも検索できるが、より確実にするためgetAllByTextを使用
      const ip1Elements = screen.getAllByText(/192.168.1.1/);
      const ip2Elements = screen.getAllByText(/192.168.1.2/);
      expect(ip1Elements.length).toBeGreaterThan(0);
      expect(ip2Elements.length).toBeGreaterThan(0);
    });
  });

  it('should display error when loading fails', async () => {
    vi.mocked(securityService.fetchBlockedIps).mockRejectedValue(
      new Error('Failed to fetch blocked IPs')
    );
    vi.mocked(tauriUtils.extractCliError).mockReturnValue(null);

    renderIpBlocklistManagement();

    await waitFor(() => {
      // Errorオブジェクトの場合はerr.messageが使用される
      expect(
        screen.getByText(/Failed to fetch blocked IPs/i)
      ).toBeInTheDocument();
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
        permanentBlock: false, // ブロック解除可能にする
        lastAttempt: '2025-01-28T12:00:00Z',
      },
    ];

    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue(
      mockBlockedIps
    );
    vi.mocked(securityService.unblockIp).mockResolvedValue();

    renderIpBlocklistManagement();

    await waitFor(
      () => {
        // IPアドレスはcode要素内に表示されるため、柔軟にチェック
        // getByTextはcode要素内のテキストも検索できるが、より確実にするためgetAllByTextを使用
        const ipElements = screen.getAllByText(/192.168.1.1/);
        expect(ipElements.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    // i18nを使用しているため、柔軟にチェック
    const unblockButtons = screen.getAllByText(/ブロック解除|unblock/i);
    await user.click(unblockButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      // i18nを使用しているため、柔軟にチェック
      // 確認ダイアログのメッセージは「IP 192.168.1.1 のブロックを解除しますか？」の形式
      const dialogMessage = screen.getByTestId('confirm-dialog').textContent;
      expect(dialogMessage).toMatch(/192.168.1.1/);
      expect(dialogMessage).toMatch(/ブロック.*解除|unblock/i);
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
        permanentBlock: false, // ブロック解除可能にする
        lastAttempt: '2025-01-28T12:00:00Z',
      },
    ];

    // 最初のロード時はデータを返し、unblock後の再ロード時は空配列を返す
    let callCount = 0;
    vi.mocked(securityService.fetchBlockedIps).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return mockBlockedIps;
      }
      return [];
    });
    vi.mocked(securityService.unblockIp).mockResolvedValue();

    renderIpBlocklistManagement();

    // ローディングが完了するまで待つ
    await waitFor(
      () => {
        expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // IPアドレスが表示されるまで待つ（code要素内に表示される）
    await waitFor(
      () => {
        const ipElements = screen.queryAllByText(/192.168.1.1/);
        expect(ipElements.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );

    // i18nを使用しているため、柔軟にチェック
    const unblockButtons = await waitFor(
      () => {
        const buttons = screen.getAllByText(/ブロック解除|unblock/i);
        expect(buttons.length).toBeGreaterThan(0);
        return buttons;
      },
      { timeout: 5000 }
    );

    await user.click(unblockButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('確認');
    await user.click(confirmButton);

    // unblockIpが呼ばれることを確認
    await waitFor(() => {
      expect(securityService.unblockIp).toHaveBeenCalledWith('192.168.1.1');
    });

    // loadBlockedIpsが再呼び出しされ、データが更新されるまで待つ
    await waitFor(
      () => {
        expect(securityService.fetchBlockedIps).toHaveBeenCalledTimes(2);
      },
      { timeout: 5000 }
    );

    // IPアドレスが消えることを確認
    await waitFor(
      () => {
        const ipElements = screen.queryAllByText(/192.168.1.1/);
        expect(ipElements.length).toBe(0);
      },
      { timeout: 5000 }
    );
  });

  it('should show confirm dialog when clear temporary blocks button is clicked', async () => {
    const user = userEvent.setup();
    // 一時ブロックを含むデータを返す（ボタンが表示されるようにする）
    const mockBlockedIps = [
      {
        ip: '192.168.1.2',
        failureCount: 3,
        firstFailureAt: '2025-01-28T11:00:00Z',
        blockedUntil: '2025-01-29T11:00:00Z',
        permanentBlock: false, // 一時ブロック
        lastAttempt: '2025-01-28T13:00:00Z',
      },
    ];
    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue(
      mockBlockedIps
    );
    vi.mocked(securityService.clearTemporaryBlocks).mockResolvedValue();

    renderIpBlocklistManagement();

    // データがロードされ、IPアドレスが表示されるまで待つ
    await waitFor(
      () => {
        const ipElements = screen.getAllByText(/192.168.1.2/);
        expect(ipElements.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );

    // i18nを使用しているため、柔軟にチェック
    // 一時ブロックがある場合のみボタンが表示される
    const clearButton = await waitFor(
      () => {
        const button = screen.queryByText(
          /一時ブロック.*解除|clear.*temporary/i
        );
        if (!button) {
          throw new Error('Clear button not found');
        }
        return button;
      },
      { timeout: 5000 }
    );

    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      // 確認ダイアログのメッセージは「すべての一時ブロックを解除しますか？永続ブロックは残ります。」
      // i18nが正しく動作していない場合、英語で表示される可能性があるため、柔軟にチェック
      const dialogMessage =
        screen.getByTestId('confirm-dialog').textContent || '';
      expect(dialogMessage).toMatch(/一時ブロック.*解除|temporary.*block/i);
    });
  });

  it('should clear temporary blocks when confirmed', async () => {
    const user = userEvent.setup();
    const mockBlockedIps = [
      {
        ip: '192.168.1.2',
        failureCount: 3,
        firstFailureAt: '2025-01-28T11:00:00Z',
        blockedUntil: '2025-01-29T11:00:00Z',
        permanentBlock: false, // 一時ブロック
        lastAttempt: '2025-01-28T13:00:00Z',
      },
    ];

    // 最初のロード時はデータを返し、clear後の再ロード時は空配列を返す
    let callCount = 0;
    vi.mocked(securityService.fetchBlockedIps).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return mockBlockedIps;
      }
      return [];
    });
    vi.mocked(securityService.clearTemporaryBlocks).mockResolvedValue();

    renderIpBlocklistManagement();

    // ローディングが完了するまで待つ
    await waitFor(
      () => {
        expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // データがロードされ、IPアドレスが表示されるまで待つ
    await waitFor(
      () => {
        const ipElements = screen.queryAllByText(/192.168.1.2/);
        expect(ipElements.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );

    // 一時ブロックがある場合のみボタンが表示される
    // データがロードされ、一時ブロックが計算されるまで待つ
    const clearButton = await waitFor(
      () => {
        const button = screen.queryByText(
          /一時ブロック.*解除|clear.*temporary/i
        );
        if (!button) {
          throw new Error('Clear button not found');
        }
        return button;
      },
      { timeout: 5000 }
    );

    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('確認');
    await user.click(confirmButton);

    // clearTemporaryBlocksが呼ばれることを確認
    await waitFor(() => {
      expect(securityService.clearTemporaryBlocks).toHaveBeenCalled();
    });

    // loadBlockedIpsが再呼び出しされ、データが更新されるまで待つ
    await waitFor(
      () => {
        expect(securityService.fetchBlockedIps).toHaveBeenCalledTimes(2);
      },
      { timeout: 5000 }
    );

    // IPアドレスが消えることを確認
    await waitFor(
      () => {
        const ipElements = screen.queryAllByText(/192.168.1.2/);
        expect(ipElements.length).toBe(0);
      },
      { timeout: 5000 }
    );
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

    vi.mocked(securityService.fetchBlockedIps).mockResolvedValue(
      mockBlockedIps
    );

    renderIpBlocklistManagement();

    await waitFor(() => {
      // i18nを使用しているため、柔軟にチェック
      // 「永続」「一時」が複数表示される可能性があるため、getAllByTextを使用
      const permanentElements = screen.getAllByText(/永続|permanent/i);
      const temporaryElements = screen.getAllByText(/一時|temporary/i);
      expect(permanentElements.length).toBeGreaterThan(0);
      expect(temporaryElements.length).toBeGreaterThan(0);
    });
  });
});
