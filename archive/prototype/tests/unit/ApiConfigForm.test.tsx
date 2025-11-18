// ApiConfigForm - API設定フォームコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiConfigForm } from '../../src/components/api/ApiConfigForm';
import type { SelectedModel, ApiConfig } from '../../src/types/api';

// safeInvokeをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
  isTauriAvailable: jest.fn(() => false),
  clearInvokeCache: jest.fn(),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('ApiConfigForm.tsx', () => {
  const mockModel: SelectedModel = {
    id: 'test-model',
    name: 'Test Model',
    engineType: 'ollama',
    capabilities: {
      chat: true,
      completion: true,
      embedding: false,
    },
  };

  const mockDefaultConfig: ApiConfig = {
    name: '',
    port: 8080,
    engineType: 'ollama',
    authEnabled: false,
    modelParameters: {
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      max_tokens: 2048,
      repeat_penalty: 1.1,
    },
  };

  const mockOnSubmit = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSafeInvoke.mockResolvedValue(['ollama', 'lmstudio']);
  });

  describe('基本的なレンダリング', () => {
    it('フォームを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      expect(screen.getByText('API設定')).toBeInTheDocument();
      expect(
        screen.getByText(/選択したモデル:.*Test Model/i)
      ).toBeInTheDocument();
    });

    it('API名入力フィールドを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const nameInput = screen.getByLabelText(/API名/i);
      expect(nameInput).toBeInTheDocument();
    });

    it('ポート番号入力フィールドを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const portInput = screen.getByLabelText(/ポート番号/i);
      expect(portInput).toBeInTheDocument();
    });
  });

  describe('バリデーション', () => {
    it('API名が空の場合、エラーメッセージを表示する', async () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const submitButton = screen.getByRole('button', { name: /作成|次へ/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/API名を入力してください/i)
        ).toBeInTheDocument();
      });
    });

    it('API名が短すぎる場合、エラーメッセージを表示する', async () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const nameInput = screen.getByLabelText(/API名/i);
      fireEvent.change(nameInput, { target: { value: 'A' } });

      const submitButton = screen.getByRole('button', { name: /作成|次へ/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/API名は.*文字以上/i)).toBeInTheDocument();
      });
    });

    it('ポート番号が範囲外の場合、エラーメッセージを表示する', async () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const portInput = screen.getByLabelText(/ポート番号/i);
      fireEvent.change(portInput, { target: { value: '100' } }); // 範囲外

      const submitButton = screen.getByRole('button', { name: /作成|次へ/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/ポート番号は.*の範囲/i)).toBeInTheDocument();
      });
    });
  });

  describe('API名自動生成', () => {
    it('API名自動生成ボタンを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const suggestButton = screen.getByRole('button', { name: /自動生成/i });
      expect(suggestButton).toBeInTheDocument();
    });

    it('API名自動生成ボタンをクリックするとAPI名が生成される', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce(['ollama'])
        .mockResolvedValueOnce('Generated API Name');

      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const suggestButton = screen.getByRole('button', { name: /自動生成/i });
      fireEvent.click(suggestButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('ポート番号検出', () => {
    it('ポート番号検出ボタンを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const detectButton = screen.getByRole('button', { name: /検出|ポート/i });
      expect(detectButton).toBeInTheDocument();
    });

    it('ポート番号検出ボタンをクリックするとポート番号が検出される', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce(['ollama'])
        .mockResolvedValueOnce(8081);

      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const detectButton = screen.getByRole('button', { name: /検出|ポート/i });
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('フォーム送信', () => {
    it('有効な入力でフォームを送信できる', async () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const nameInput = screen.getByLabelText(/API名/i);
      fireEvent.change(nameInput, { target: { value: 'Test API' } });

      const submitButton = screen.getByRole('button', { name: /作成|次へ/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('戻るボタンをクリックするとonBackが呼ばれる', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const backButton = screen.getByRole('button', { name: /戻る/i });
      fireEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('エンジン検出', () => {
    it('エンジン検出ボタンを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const checkButton = screen.getByRole('button', {
        name: /検出|エンジン/i,
      });
      expect(checkButton).toBeInTheDocument();
    });

    it('エンジン検出ボタンをクリックするとエンジン状態を確認する', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce(['ollama'])
        .mockResolvedValueOnce({ installed: true, running: true });

      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const checkButton = screen.getByRole('button', {
        name: /検出|エンジン/i,
      });
      fireEvent.click(checkButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('認証設定', () => {
    it('認証有効化チェックボックスを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const authCheckbox = screen.getByLabelText(/認証|APIキー/i);
      expect(authCheckbox).toBeInTheDocument();
    });

    it('認証を有効化できる', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const authCheckbox = screen.getByLabelText(/認証|APIキー/i);
      fireEvent.click(authCheckbox);

      expect(authCheckbox).toBeChecked();
    });
  });

  describe('高度なパラメータ', () => {
    it('高度なパラメータセクションを表示する', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const advancedButton = screen.getByRole('button', { name: /高度|詳細/i });
      expect(advancedButton).toBeInTheDocument();
    });

    it('高度なパラメータセクションを展開できる', () => {
      render(
        <ApiConfigForm
          model={mockModel}
          defaultConfig={mockDefaultConfig}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );

      const advancedButton = screen.getByRole('button', { name: /高度|詳細/i });
      fireEvent.click(advancedButton);

      // 展開後、パラメータ入力フィールドが表示される
      expect(screen.getByLabelText(/temperature|温度/i)).toBeInTheDocument();
    });
  });
});
