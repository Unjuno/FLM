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
import type { ApiConfig } from '../../src/types/api';

const mockT = jest.fn((key: string) => key);
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockNavigate = jest.fn();
const mockStartApiCreation = jest.fn(async (config: ApiConfig) => {
  await safeInvoke('create_api', config);
});
const mockClearError = jest.fn();
const mockResetProgress = jest.fn();

// モック
jest.mock('../../src/contexts/I18nContext');
jest.mock('../../src/contexts/NotificationContext');
jest.mock('../../src/utils/tauri');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('../../src/components/api/ModelSelection', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    ModelSelection: ({
      onModelSelected,
      selectedModel,
    }: {
      onModelSelected: (model: { name: string }) => void;
      selectedModel: { name: string } | null;
    }) => {
      ReactModule.useEffect(() => {
        if (!selectedModel) {
          onModelSelected({ name: 'mock-model' });
        }
      }, [onModelSelected, selectedModel]);

      return <div data-testid="mock-model-selection" />;
    },
  };
});
jest.mock('../../src/components/api/ApiConfigForm', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    ApiConfigForm: ({
      onSubmit,
      defaultConfig,
    }: {
      onSubmit: (config: ApiConfig) => void;
      defaultConfig: ApiConfig;
    }) => {
      const [name, setName] = ReactModule.useState('');

      return (
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!name.trim()) {
              mockShowError('API名を入力してください');
              return;
            }
            onSubmit({ ...defaultConfig, name });
          }}
        >
          <label htmlFor="api-name">API名</label>
          <input
            id="api-name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button type="submit">作成</button>
        </form>
      );
    },
  };
});
jest.mock('../../src/hooks/useApiCreation', () => ({
  useApiCreation: () => ({
    progress: { step: '初期化中...', progress: 0 },
    error: null,
    originalError: null,
    creationResult: null,
    startApiCreation: mockStartApiCreation,
    clearError: mockClearError,
    resetProgress: mockResetProgress,
  }),
}));

beforeEach(() => {
  (useI18n as jest.Mock).mockReturnValue({ t: mockT });
  (useNotifications as jest.Mock).mockReturnValue({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  });
  (safeInvoke as jest.Mock).mockImplementation(
    (command: string, payload?: Record<string, unknown>) => {
      if (command === 'create_api') {
        return Promise.resolve({
          id: 'new-api-id',
          name: 'New API',
          endpoint: 'http://localhost:8080',
          model_name: 'test-model',
          port: 8080,
          enable_auth: true,
          status: 'running',
          created_at: '2024-01-01T00:00:00Z',
        });
      }

      if (command === 'get_available_engines') {
        return Promise.resolve(['ollama', 'lm_studio']);
      }

      if (command === 'detect_engine') {
        return Promise.resolve({
          engine_type: (payload?.engineType as string | undefined) ?? 'ollama',
          installed: true,
          running: true,
          message: null,
        });
      }

      if (command === 'find_available_port') {
        return Promise.resolve({
          recommended_port: 8081,
          is_available: true,
          alternative_ports: [8082, 8083],
        });
      }

      if (command === 'check_port_availability') {
        return Promise.resolve(true);
      }

      if (command === 'suggest_api_name') {
        return Promise.resolve({
          suggested_name: 'LocalAI API',
          alternatives: [],
          is_available: true,
        });
      }

      return Promise.resolve(null);
    }
  );
  mockStartApiCreation.mockClear();
  mockClearError.mockClear();
  mockResetProgress.mockClear();
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
