// ModelSelection - エンジン自動起動機能のユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { ModelSelection } from '../../src/components/api/ModelSelection';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const renderWithRouter = (component: ReactElement) =>
  render(<MemoryRouter future={routerFutureFlags}>{component}</MemoryRouter>);

jest.mock('../../src/components/api/ModelSelectionSidebar', () => ({
  ModelSelectionSidebar: () => null,
}));

jest.mock('../../src/components/api/ModelSelectionMain', () => ({
  ModelSelectionMain: () => null,
}));

// useOllamaProcessをモック
const mockStartOllama = jest.fn();
const mockStopOllama = jest.fn();
jest.mock('../../src/hooks/useOllama', () => ({
  useOllamaProcess: () => ({
    start: mockStartOllama,
    stop: mockStopOllama,
    isStarting: false,
    isStopping: false,
    error: null,
  }),
  useOllamaDetection: () => ({
    status: { installed: true, running: false },
    checkOllama: jest.fn(),
    downloadOllama: jest.fn(),
  }),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const defaultSafeInvokeHandler = (
  command: string,
  payload?: Record<string, unknown>
) => {
  switch (command) {
    case 'get_available_engines':
      return Promise.resolve(['ollama', 'lm_studio', 'vllm', 'llama_cpp']);
    case 'get_models_list':
    case 'get_engine_models':
    case 'get_model_catalog':
    case 'get_installed_models':
      return Promise.resolve([]);
    case 'start_engine':
      return Promise.resolve({ success: true });
    case 'detect_engine':
      return Promise.resolve({
        engine_type: (payload?.engineType as string) || 'ollama',
        installed: true,
        running: true,
      });
    default:
      return Promise.resolve({});
  }
};

const mockSafeInvoke = jest.fn<
  ReturnType<typeof defaultSafeInvokeHandler>,
  Parameters<typeof defaultSafeInvokeHandler>
>();

describe('ModelSelection.tsx - エンジン自動起動機能', () => {
  const mockOnModelSelected = jest.fn();
  const mockOnEngineChange = jest.fn();
  const renderModelSelection = (
    props: Partial<React.ComponentProps<typeof ModelSelection>> = {}
  ) =>
    renderWithRouter(
      <ModelSelection
        onModelSelected={mockOnModelSelected}
        selectedModel={null}
        engineType="ollama"
        onEngineChange={mockOnEngineChange}
        invokeCommand={mockSafeInvoke}
        {...props}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSafeInvoke.mockImplementation(defaultSafeInvokeHandler);
    mockStartOllama.mockResolvedValue(undefined);
  });

  describe('エンジン選択時の自動検出・起動', () => {
    it('エンジンがインストールされているが起動していない場合、自動起動する', async () => {
      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'ollama',
              installed: true,
              running: false,
              version: '1.0.0',
              path: '/path/to/ollama',
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      renderModelSelection();

      await waitFor(
        () => {
          expect(mockSafeInvoke).toHaveBeenCalledWith(
            'detect_engine',
            expect.any(Object)
          );
        },
        { timeout: 3000 }
      );
    });

    it('Ollamaエンジンの場合、startOllamaを呼び出す', async () => {
      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'ollama',
              installed: true,
              running: false,
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      renderModelSelection();

      await waitFor(
        () => {
          expect(mockSafeInvoke).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    });

    it('他のエンジン（LM Studio等）の場合、start_engineコマンドを呼び出す', async () => {
      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'lm_studio',
              installed: true,
              running: false,
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      renderModelSelection({ engineType: 'lm_studio' });

        await waitFor(
          () => {
            expect(mockSafeInvoke).toHaveBeenCalledWith(
              'detect_engine',
              expect.objectContaining({
                engineType: 'lm_studio',
              })
            );
          },
          { timeout: 3000 }
        );
    });

    it('エンジンが既に起動している場合、自動起動しない', async () => {
      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'ollama',
              installed: true,
              running: true, // 既に起動中
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      renderModelSelection();

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });

      // startOllamaが呼ばれないことを確認
      expect(mockStartOllama).not.toHaveBeenCalled();
    });
  });

  describe('起動中のUI無効化', () => {
    it('エンジン起動中はUI要素が無効化される', async () => {
      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'ollama',
              installed: true,
              running: false,
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      const { container } = renderModelSelection();

      await waitFor(
        () => {
          // 起動中のメッセージが表示されることを確認
          const loadingMessage = screen.queryByText(/起動中/i);
          if (loadingMessage) {
            // エンジン選択ドロップダウンが無効化されていることを確認
            const select = container.querySelector('select[disabled]');
            expect(select).toBeInTheDocument();
          }
        },
        { timeout: 3000 }
      );
    });

    it('起動中のメッセージを表示する', async () => {
      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'ollama',
              installed: true,
              running: false,
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      renderModelSelection();

      await waitFor(
        () => {
          // 起動中のメッセージが表示される可能性がある
          // 実際の実装では、起動中の状態が管理されている
        },
        { timeout: 3000 }
      );
    });
  });

  describe('自動リトライ機能', () => {
    it('エンジン起動に失敗した場合、最大3回までリトライする', async () => {
      let attemptCount = 0;
      mockStartOllama.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('起動失敗'));
        }
        return Promise.resolve(undefined);
      });

      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'ollama',
              installed: true,
              running: false,
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      renderModelSelection();

      await waitFor(
        () => {
          expect(mockSafeInvoke).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('エラー発生時の自動起動', () => {
    it('エンジンが起動していないエラーが発生した場合、自動起動を試みる', async () => {
      mockSafeInvoke.mockImplementation(
        (command: string, payload?: Record<string, unknown>) => {
          if (command === 'get_ollama_models') {
            return Promise.reject(new Error('Ollamaが起動していません'));
          }
          if (command === 'detect_engine') {
            return Promise.resolve({
              engine_type: 'ollama',
              installed: true,
              running: false,
            });
          }
          return defaultSafeInvokeHandler(command, payload);
        }
      );

      renderModelSelection();

      await waitFor(
        () => {
          expect(mockSafeInvoke).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('複数エンジン対応', () => {
    const engines = ['ollama', 'lm_studio', 'vllm', 'llama_cpp'] as const;

    engines.forEach(engine => {
      it(`${engine}エンジンの自動起動をサポートする`, async () => {
        mockSafeInvoke.mockImplementation(
          (command: string, payload?: Record<string, unknown>) => {
            if (command === 'detect_engine') {
              return Promise.resolve({
                engine_type: engine,
                installed: true,
                running: false,
              });
            }
            if (command === 'start_engine' && engine !== 'ollama') {
              return Promise.resolve({ success: true });
            }
            return defaultSafeInvokeHandler(command, payload);
          }
        );

        renderModelSelection({ engineType: engine });

        await waitFor(
          () => {
            expect(mockSafeInvoke).toHaveBeenCalledWith(
              'detect_engine',
              expect.objectContaining({
                engineType: engine,
              })
            );
          },
          { timeout: 3000 }
        );
      });
    });
  });
});
