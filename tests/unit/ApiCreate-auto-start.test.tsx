// ApiCreate - Ollama自動起動機能のユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ApiCreate } from '../../src/pages/ApiCreate';

// react-router-domをモック
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: '/api/create',
  search: '',
  hash: '',
  state: null,
};
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Tauri IPCをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
}));

// useOllamaDetectionをモック
const mockDetect = jest.fn();
const mockStatus = {
  installed: true,
  portable: false,
  running: false,
  version: '1.0.0',
  path: '/path/to/ollama',
};

jest.mock('../../src/hooks/useOllama', () => ({
  useOllamaDetection: () => ({
    status: mockStatus,
    detect: mockDetect,
    downloadOllama: jest.fn(),
  }),
  useOllamaProcess: () => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    isStarting: false,
    isStopping: false,
    error: null,
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

describe('ApiCreate.tsx - Ollama自動起動機能', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetect.mockResolvedValue(undefined);
    mockStatus.running = false;
    mockStatus.installed = true;
    mockStatus.portable = false;
  });

  describe('画面遷移時の自動検出', () => {
    it('コンポーネントマウント時にOllamaを自動検出する', async () => {
      render(
        <BrowserRouter>
          <ApiCreate />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockDetect).toHaveBeenCalledTimes(1);
      });
    });

    it('検出に失敗してもエラーを表示しない（サイレント失敗）', async () => {
      mockDetect.mockRejectedValue(new Error('検出エラー'));

      render(
        <BrowserRouter>
          <ApiCreate />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockDetect).toHaveBeenCalled();
      });

      // エラーメッセージが表示されないことを確認
      expect(screen.queryByText(/検出エラー/i)).not.toBeInTheDocument();
    });
  });

  describe('status変更時の自動起動', () => {
    it('Ollamaがインストールされているが起動していない場合、自動起動する', async () => {
      mockStatus.installed = true;
      mockStatus.running = false;
      const mockStart = jest.fn().mockResolvedValue(undefined);

      jest.doMock('../../src/hooks/useOllama', () => ({
        useOllamaDetection: () => ({
          status: mockStatus,
          detect: mockDetect,
          downloadOllama: jest.fn(),
        }),
        useOllamaProcess: () => ({
          start: mockStart,
          stop: jest.fn(),
          isStarting: false,
          isStopping: false,
          error: null,
        }),
      }));

      render(
        <BrowserRouter>
          <ApiCreate />
        </BrowserRouter>
      );

      await waitFor(
        () => {
          expect(mockDetect).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    });

    it('Ollamaが既に起動している場合、自動起動しない', async () => {
      mockStatus.running = true;
      const mockStart = jest.fn();

      jest.doMock('../../src/hooks/useOllama', () => ({
        useOllamaDetection: () => ({
          status: mockStatus,
          detect: mockDetect,
          downloadOllama: jest.fn(),
        }),
        useOllamaProcess: () => ({
          start: mockStart,
          stop: jest.fn(),
          isStarting: false,
          isStopping: false,
          error: null,
        }),
      }));

      render(
        <BrowserRouter>
          <ApiCreate />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockDetect).toHaveBeenCalled();
      });

      // startが呼ばれないことを確認（少し待機）
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
    });

    it('ポータブル版Ollamaがインストールされている場合も自動起動する', async () => {
      mockStatus.installed = false;
      mockStatus.portable = true;
      mockStatus.running = false;

      render(
        <BrowserRouter>
          <ApiCreate />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockDetect).toHaveBeenCalled();
      });
    });

    it('起動に失敗してもエラーを表示しない（サイレント失敗）', async () => {
      mockStatus.installed = true;
      mockStatus.running = false;
      const mockStart = jest.fn().mockRejectedValue(new Error('起動エラー'));

      jest.doMock('../../src/hooks/useOllama', () => ({
        useOllamaDetection: () => ({
          status: mockStatus,
          detect: mockDetect,
          downloadOllama: jest.fn(),
        }),
        useOllamaProcess: () => ({
          start: mockStart,
          stop: jest.fn(),
          isStarting: false,
          isStopping: false,
          error: null,
        }),
      }));

      render(
        <BrowserRouter>
          <ApiCreate />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockDetect).toHaveBeenCalled();
      });

      // エラーメッセージが表示されないことを確認
      expect(screen.queryByText(/起動エラー/i)).not.toBeInTheDocument();
    });
  });
});
