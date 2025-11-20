/**
 * ApiCreate ページのユニットテスト
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ApiCreate } from '../../src/pages/ApiCreate';
import { useI18n } from '../../src/contexts/I18nContext';
import { useNotifications } from '../../src/contexts/NotificationContext';
import { safeInvoke } from '../../src/utils/tauri';

// モック
jest.mock('../../src/contexts/I18nContext');
jest.mock('../../src/contexts/NotificationContext');
jest.mock('../../src/utils/tauri');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
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
    id: 'new-api-id',
    name: 'New API',
    endpoint: 'http://localhost:8080',
    model_name: 'test-model',
    port: 8080,
    enable_auth: true,
    status: 'running',
    created_at: '2024-01-01T00:00:00Z',
  });
});

describe('ApiCreate', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ApiCreate />
      </BrowserRouter>
    );
  };

  it('should render API creation form', async () => {
    await act(async () => {
      renderComponent();
    });

    await waitFor(
      () => {
        expect(screen.getByLabelText(/API名/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it('should handle form input', async () => {
    await act(async () => {
      renderComponent();
    });

    await waitFor(
      () => {
        expect(screen.getByLabelText(/API名/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const nameInput = screen.getByLabelText(/API名/i);
    await act(async () => {
      await userEvent.type(nameInput, 'New Test API');
    });

    expect(nameInput).toHaveValue('New Test API');
  });

  it('should validate form fields', async () => {
    await act(async () => {
      renderComponent();
    });

    await waitFor(
      () => {
        expect(screen.getByLabelText(/API名/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const submitButton = screen.getByRole('button', { name: /作成/i });
    await act(async () => {
      await userEvent.click(submitButton);
    });

    // バリデーションエラーが表示されることを確認（実際の実装に応じて調整）
    await waitFor(
      () => {
        expect(mockShowError).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );
  });

  it('should handle API creation', async () => {
    await act(async () => {
      renderComponent();
    });

    await waitFor(
      () => {
        expect(screen.getByLabelText(/API名/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const nameInput = screen.getByLabelText(/API名/i);
    const submitButton = screen.getByRole('button', { name: /作成/i });

    await act(async () => {
      await userEvent.type(nameInput, 'New Test API');
      await userEvent.click(submitButton);
    });

    // API作成が成功したことを確認
    await waitFor(
      () => {
        expect(safeInvoke).toHaveBeenCalledWith(
          'create_api',
          expect.any(Object)
        );
      },
      { timeout: 5000 }
    );
  });
});
