// ApiCreationSuccess - API作成成功画面コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiCreationSuccess } from '../../src/components/api/ApiCreationSuccess';

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// clipboardをモック
const mockCopyToClipboard = jest.fn().mockResolvedValue(true);
jest.mock('../../src/utils/clipboard', () => ({
  copyToClipboard: jest.fn((text: string) => mockCopyToClipboard(text)),
}));

// errorHandlerをモック
jest.mock('../../src/utils/errorHandler', () => ({
  extractErrorMessage: jest.fn((err: unknown) => {
    if (err instanceof Error) return err.message;
    return String(err);
  }),
}));

describe('ApiCreationSuccess.tsx', () => {
  const mockResult = {
    id: 'test-api-id',
    name: 'Test API',
    endpoint: 'http://localhost:8080',
    port: 8080,
    apiKey: 'test-api-key-12345',
  };

  const mockOnGoHome = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCopyToClipboard.mockClear();
    mockCopyToClipboard.mockResolvedValue(true);
  });

  describe('基本的なレンダリング', () => {
    it('成功メッセージを表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      const successMessages = screen.getAllByText(/作成が完了|完了しました/i);
      expect(successMessages.length).toBeGreaterThan(0);
    });

    it('API名を表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      expect(screen.getByText('Test API')).toBeInTheDocument();
    });

    it('エンドポイントURLを表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      // エンドポイントURLは複数箇所に表示される可能性があるため、getAllByTextを使用
      const endpoints = screen.getAllByText(/http:\/\/localhost:8080/i);
      expect(endpoints.length).toBeGreaterThan(0);
    });

    it('APIキーを表示する（認証が有効な場合）', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      // APIキーは初期状態では非表示
      const toggleButton = screen.getByRole('button', { name: /表示/i });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('APIキーのコピー機能', () => {
    it('APIキーをコピーするボタンを表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('APIキーをクリップボードにコピーする', async () => {
      await act(async () => {
        render(
          <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
        );
      });

      // APIキーを表示
      const toggleButton = screen.getByRole('button', { name: /表示/i });
      await act(async () => {
        fireEvent.click(toggleButton);
      });

      // APIキーが表示されるまで待つ
      await waitFor(() => {
        expect(screen.getByText('test-api-key-12345')).toBeInTheDocument();
      });

      // コピーボタンをクリック（APIキーセクション内のコピーボタン）
      await waitFor(() => {
        const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
        expect(copyButtons.length).toBeGreaterThan(1); // エンドポイントとAPIキーの両方がある
      });

      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      // APIキーのコピーボタンは2番目（最初はエンドポイント用、最後はサンプルコード用）
      // APIキーセクション内のコピーボタンを探す
      const apiKeySection = screen.getByText('APIキー').closest('.info-section');
      const apiKeyCopyButton = apiKeySection?.querySelector('button[class*="copy"]') as HTMLButtonElement;
      if (!apiKeyCopyButton) {
        // フォールバック: 2番目のコピーボタンを使用
        expect(copyButtons.length).toBeGreaterThanOrEqual(2);
        const apiKeyCopyButtonFallback = copyButtons[1];
        await act(async () => {
          fireEvent.click(apiKeyCopyButtonFallback);
        });
        await waitFor(() => {
          expect(mockCopyToClipboard).toHaveBeenCalledWith('test-api-key-12345');
        }, { timeout: 3000 });
        return;
      }

      await act(async () => {
        fireEvent.click(apiKeyCopyButton);
      });

      await waitFor(() => {
        // APIキーがコピーされたことを確認（サンプルコードのコピーではない）
        expect(mockCopyToClipboard).toHaveBeenCalledWith('test-api-key-12345');
      }, { timeout: 3000 });
    });
  });

  describe('エンドポイントURLのコピー機能', () => {
    it('エンドポイントURLをコピーするボタンを表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('エンドポイントURLをクリップボードにコピーする', async () => {
      await act(async () => {
        render(
          <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
        );
      });

      await waitFor(() => {
        const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
        expect(copyButtons.length).toBeGreaterThan(0);
      });

      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      // 最初のコピーボタンはエンドポイント用
      await act(async () => {
        fireEvent.click(copyButtons[0]);
      });

      await waitFor(() => {
        expect(mockCopyToClipboard).toHaveBeenCalledWith('http://localhost:8080');
      }, { timeout: 3000 });
    });
  });

  describe('ナビゲーション', () => {
    it('ホームに戻るボタンを表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      const homeButton = screen.getByRole('button', { name: /ホームに戻る/i });
      expect(homeButton).toBeInTheDocument();
    });

    it('ホームに戻るボタンをクリックするとonGoHomeが呼ばれる', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      const homeButton = screen.getByRole('button', { name: /ホームに戻る/i });
      fireEvent.click(homeButton);
      expect(mockOnGoHome).toHaveBeenCalledTimes(1);
    });
  });

  describe('警告メッセージ', () => {
    it('APIキーは一度だけ表示される警告を表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      expect(screen.getByText(/APIキー.*一度|安全/i)).toBeInTheDocument();
    });
  });

  describe('認証無効の場合', () => {
    it('APIキーが存在しない場合、APIキー表示をスキップする', () => {
      const resultWithoutKey = {
        ...mockResult,
        apiKey: undefined,
      };

      render(
        <ApiCreationSuccess result={resultWithoutKey} onGoHome={mockOnGoHome} />
      );
      expect(screen.queryByText(/APIキー/i)).not.toBeInTheDocument();
    });
  });

  describe('サンプルコード', () => {
    it('サンプルコードセクションを表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      expect(screen.getByText(/サンプルコード/i)).toBeInTheDocument();
    });

    it('コードタブを切り替えられる', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      const curlTab = screen.getByRole('button', { name: /cURL/i });
      const pythonTab = screen.getByRole('button', { name: /Python/i });
      const jsTab = screen.getByRole('button', { name: /JavaScript/i });

      expect(curlTab).toBeInTheDocument();
      expect(pythonTab).toBeInTheDocument();
      expect(jsTab).toBeInTheDocument();

      fireEvent.click(pythonTab);
      expect(pythonTab).toHaveClass('active');
    });
  });
});
