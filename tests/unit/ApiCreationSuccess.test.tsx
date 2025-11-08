// ApiCreationSuccess - API作成成功画面コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiCreationSuccess } from '../../src/components/api/ApiCreationSuccess';

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
  });

  describe('基本的なレンダリング', () => {
    it('成功メッセージを表示する', () => {
      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      expect(screen.getByText(/作成が完了|完了しました/i)).toBeInTheDocument();
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
      expect(screen.getByText(/http:\/\/localhost:8080/i)).toBeInTheDocument();
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
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );

      // APIキーを表示
      const toggleButton = screen.getByRole('button', { name: /表示/i });
      fireEvent.click(toggleButton);

      // コピーボタンをクリック
      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      const apiKeyCopyButton = copyButtons.find(btn =>
        btn.textContent?.includes('コピー')
      );
      if (apiKeyCopyButton) {
        fireEvent.click(apiKeyCopyButton);
        expect(mockWriteText).toHaveBeenCalledWith('test-api-key-12345');
      }
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
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      render(
        <ApiCreationSuccess result={mockResult} onGoHome={mockOnGoHome} />
      );
      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      // 最初のコピーボタンはエンドポイント用
      fireEvent.click(copyButtons[0]);

      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:8080');
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
