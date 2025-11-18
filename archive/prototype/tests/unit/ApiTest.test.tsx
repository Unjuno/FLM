/**
 * ApiTest ページのユニットテスト
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ApiTest } from '../../src/pages/ApiTest';
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
jest.mock('../../src/components/api/LLMTestRunner', () => ({
  LLMTestRunner: () => <div data-testid="llm-test-runner">LLM Test Runner</div>,
}));

const mockT = jest.fn((key: string) => key);
const mockShowError = jest.fn();

beforeEach(() => {
  (useI18n as jest.Mock).mockReturnValue({ t: mockT });
  (useNotifications as jest.Mock).mockReturnValue({
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

describe('ApiTest', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ApiTest />
      </BrowserRouter>
    );
  };

  it('should render loading state initially', async () => {
    (safeInvoke as jest.Mock).mockImplementation(() => new Promise(() => {})); // 永続的なPromise

    const { container } = renderComponent();

    // ページが表示されていることを確認
    const page = container.querySelector('.api-test-page');
    expect(page).toBeTruthy();
  });

  it('should render API test interface when loaded', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText('Test API')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should handle message input', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/メッセージ入力欄/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const textarea = screen.getByLabelText(/メッセージ入力欄/i);
    await act(async () => {
      await userEvent.type(textarea, 'Test message');
    });

    expect(textarea).toHaveValue('Test message');
  });

  it('should handle send message', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/メッセージ入力欄/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const textarea = screen.getByLabelText(/メッセージ入力欄/i);
    const sendButton = screen.getByLabelText(/メッセージを送信/i);

    await act(async () => {
      await userEvent.type(textarea, 'Test message');
      await userEvent.click(sendButton);
    });

    // メッセージが送信されたことを確認（実際の実装に応じて調整）
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    }, { timeout: 5000 });
  });

  it('should handle keyboard shortcuts', async () => {
    await act(async () => {
      renderComponent();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/メッセージ入力欄/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const textarea = screen.getByLabelText(/メッセージ入力欄/i);
    
    await act(async () => {
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');
    });

    // Enterキーでメッセージが送信されることを確認（実際の実装に応じて調整）
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    }, { timeout: 5000 });
  });
});

