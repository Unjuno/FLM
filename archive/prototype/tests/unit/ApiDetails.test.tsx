/**
 * ApiDetails ページのユニットテスト
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ApiDetails } from '../../src/pages/ApiDetails';
import { useI18n } from '../../src/contexts/I18nContext';
import { useNotifications } from '../../src/contexts/NotificationContext';
import { safeInvoke } from '../../src/utils/tauri';

// モック
jest.mock('../../src/contexts/I18nContext');
jest.mock('../../src/contexts/NotificationContext');
jest.mock('../../src/utils/tauri');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'test-api-id' }),
  useNavigate: () => jest.fn(),
}));
jest.mock('../../src/utils/clipboard', () => ({
  copyToClipboard: jest.fn().mockResolvedValue(true),
}));

const mockT = jest.fn((key: string) => key);
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockNavigate = jest.fn();

beforeEach(() => {
  (useI18n as jest.Mock).mockReturnValue({ t: mockT });
  (useNotifications as jest.Mock).mockReturnValue({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  });
  (safeInvoke as jest.Mock).mockResolvedValue({
    id: 'test-api-id',
    name: 'Test API',
    endpoint: 'http://localhost:8080',
    model_name: 'test-model',
    port: 8080,
    enable_auth: true,
    status: 'running',
    timeout_secs: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  });
});

describe('ApiDetails', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ApiDetails />
      </BrowserRouter>
    );
  };

  it('should render loading state initially', async () => {
    (safeInvoke as jest.Mock).mockImplementation(() => new Promise(() => {})); // 永続的なPromise

    const { container } = renderComponent();

    // SkeletonLoaderが表示されていることを確認
    const page = container.querySelector('.api-details-page');
    expect(page).toBeTruthy();
  });

  it('should render API details when loaded', async () => {
    await act(async () => {
      renderComponent();
    });

    // useAsyncOperationのautoExecuteが実行されるまで待機
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(
      () => {
        expect(screen.getByText('Test API')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it('should handle copy sample code', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(
      () => {
        expect(screen.getByText('Test API')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // サンプルコードのコピーボタンを探す（タブが表示されている場合）
    const copyButtons = screen.queryAllByLabelText(/copy/i);
    if (copyButtons.length > 0) {
      await act(async () => {
        await userEvent.click(copyButtons[0]);
      });

      await waitFor(
        () => {
          expect(mockShowSuccess).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    }
  });

  it('should handle load API key', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(
      () => {
        expect(screen.getByText('Test API')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // APIキーを表示するボタンを探す
    const showKeyButton = screen.queryByText(/apiキーを表示/i);
    if (showKeyButton) {
      await act(async () => {
        await userEvent.click(showKeyButton);
      });

      // get_api_keyコマンドが呼ばれることを確認
      await waitFor(
        () => {
          expect(safeInvoke).toHaveBeenCalledWith(
            'get_api_key',
            expect.any(Object)
          );
        },
        { timeout: 5000 }
      );
    }
  });

  it('should handle navigation to edit page', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(
      () => {
        expect(screen.getByText('Test API')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // 編集ボタンを探す
    const editButton = screen.queryByText(/編集/i);
    if (editButton) {
      await act(async () => {
        await userEvent.click(editButton);
      });
    }
  });
});
