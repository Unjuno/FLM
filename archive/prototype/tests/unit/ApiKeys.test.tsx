/**
 * ApiKeys ページのユニットテスト
 */

import React from 'react';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ApiKeys } from '../../src/pages/ApiKeys';
import { useI18n } from '../../src/contexts/I18nContext';
import { useNotifications } from '../../src/contexts/NotificationContext';
import { safeInvoke } from '../../src/utils/tauri';

// モック
jest.mock('../../src/contexts/I18nContext');
jest.mock('../../src/contexts/NotificationContext');
jest.mock('../../src/utils/tauri');
jest.mock('../../src/hooks/useIsMounted', () => ({
  useIsMounted: () => () => true,
}));
jest.mock('../../src/utils/clipboard', () => ({
  copyToClipboard: jest.fn().mockResolvedValue(true),
}));
// useAsyncOperationは実際のフックを使用（モックしない）

const mockT = jest.fn((key: string) => key);
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();

beforeEach(() => {
  (useI18n as jest.Mock).mockReturnValue({ t: mockT });
  (useNotifications as jest.Mock).mockReturnValue({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  });
  (safeInvoke as jest.Mock).mockResolvedValue([]);
});

describe('ApiKeys', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ApiKeys />
      </BrowserRouter>
    );
  };

  it('should render loading state initially', async () => {
    (safeInvoke as jest.Mock).mockImplementation(() => new Promise(() => {})); // 永続的なPromise

    const { container } = renderComponent();

    // SkeletonLoaderが表示されていることを確認（api-keys-pageクラスが存在することを確認）
    const page = container.querySelector('.api-keys-page');
    expect(page).toBeTruthy();
  });

  it('should render API keys list when loaded', async () => {
    // list_apisコマンドの戻り値形式でモック
    const mockApis = [
      {
        id: '1',
        name: 'Test API',
        endpoint: 'http://localhost:8080',
        enable_auth: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    (safeInvoke as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd === 'list_apis') {
        return Promise.resolve(mockApis);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      renderComponent();
    });

    // useAsyncOperationのautoExecuteが実行されるまで待機
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText('Test API')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should handle copy API key', async () => {
    // list_apisコマンドの戻り値形式でモック
    const mockApis = [
      {
        id: '1',
        name: 'Test API',
        endpoint: 'http://localhost:8080',
        enable_auth: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    (safeInvoke as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd === 'list_apis') {
        return Promise.resolve(mockApis);
      }
      if (cmd === 'get_api_key') {
        return Promise.resolve('test-key-123');
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      renderComponent();
    });

    // useAsyncOperationのautoExecuteが実行されるまで待機
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText('Test API')).toBeInTheDocument();
    }, { timeout: 10000 });

    // 表示ボタンをクリックしてAPIキーを表示
    await act(async () => {
      const showButton = screen.getByText('表示');
      await userEvent.click(showButton);
    });

    await waitFor(() => {
      // コピーボタンが表示されることを確認
      const copyButton = screen.getByText('コピー');
      expect(copyButton).toBeInTheDocument();
    }, { timeout: 5000 });

    await act(async () => {
      const copyButton = screen.getByText('コピー');
      await userEvent.click(copyButton);
    });

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle regenerate API key', async () => {
    // list_apisコマンドの戻り値形式でモック
    const mockApis = [
      {
        id: '1',
        name: 'Test API',
        endpoint: 'http://localhost:8080',
        enable_auth: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    (safeInvoke as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd === 'list_apis') {
        return Promise.resolve(mockApis);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      renderComponent();
    });

    // useAsyncOperationのautoExecuteが実行されるまで待機
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText('Test API')).toBeInTheDocument();
    }, { timeout: 10000 });

    await act(async () => {
      const regenerateButton = screen.getByText('キーを再生成');
      await userEvent.click(regenerateButton);
    });

    // 確認ダイアログが表示されることを確認
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

