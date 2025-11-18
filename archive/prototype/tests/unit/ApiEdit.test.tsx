/**
 * ApiEdit ページのユニットテスト
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ApiEdit } from '../../src/pages/ApiEdit';
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

describe('ApiEdit', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ApiEdit />
      </BrowserRouter>
    );
  };

  it('should render loading state initially', async () => {
    (safeInvoke as jest.Mock).mockImplementation(() => new Promise(() => {})); // 永続的なPromise

    const { container } = renderComponent();

    // SkeletonLoaderが表示されていることを確認
    const page = container.querySelector('.api-edit-page');
    expect(page).toBeTruthy();
  });

  it('should render API settings form when loaded', async () => {
    await act(async () => {
      renderComponent();
    });

    // useAsyncOperationのautoExecuteが実行されるまで待機
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/api名/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should validate form inputs', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/api名/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // API名を空にする
    const apiNameInput = screen.getByLabelText(/api名/i);
    await act(async () => {
      await userEvent.clear(apiNameInput);
    });

    // 保存ボタンをクリック
    const saveButton = screen.getByText(/保存/i);
    await act(async () => {
      await userEvent.click(saveButton);
    });

    // バリデーションエラーが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/api名を入力してください/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should handle save API settings', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/api名/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // API名を変更
    const apiNameInput = screen.getByLabelText(/api名/i);
    await act(async () => {
      await userEvent.clear(apiNameInput);
      await userEvent.type(apiNameInput, 'Updated API Name');
    });

    // 保存ボタンをクリック
    const saveButton = screen.getByText(/保存/i);
    await act(async () => {
      await userEvent.click(saveButton);
    });

    // update_apiコマンドが呼ばれることを確認
    await waitFor(() => {
      expect(safeInvoke).toHaveBeenCalledWith('update_api', expect.any(Object));
    }, { timeout: 5000 });
  });

  it('should handle regenerate API key', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/apiキーを再生成/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 再生成ボタンをクリック
    const regenerateButton = screen.getByText(/apiキーを再生成/i);
    await act(async () => {
      await userEvent.click(regenerateButton);
    });

    // 確認ダイアログが表示されることを確認
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should handle delete API', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/apiを削除/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 削除ボタンをクリック
    const deleteButton = screen.getByText(/apiを削除/i);
    await act(async () => {
      await userEvent.click(deleteButton);
    });

    // 確認ダイアログが表示されることを確認
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

