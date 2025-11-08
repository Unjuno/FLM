// LogDelete - ログ削除コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogDelete } from '../../src/components/api/LogDelete';

// safeInvokeをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('LogDelete.tsx', () => {
  const mockOnDeleteComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('削除コンポーネントを表示する', () => {
      render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );
      expect(screen.getByText(/削除|ログ削除/i)).toBeInTheDocument();
    });

    it('削除ボタンを表示する', () => {
      render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );
      const deleteButton = screen.getByRole('button', { name: /削除|Delete/i });
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe('削除確認', () => {
    it('削除ボタンを表示する', () => {
      render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );
      const deleteButton = screen.getByRole('button', { name: /削除|Delete/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('削除日付入力フィールドを表示する', () => {
      const { container } = render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );
      // IDで直接取得（Tooltip内のラベルを回避）
      const dateInput = container.querySelector('#before-date');
      expect(dateInput).toBeTruthy();
      expect(dateInput).toBeInTheDocument();
    });

    it('確認テキスト入力フィールドを表示する', () => {
      const { container } = render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );
      // IDで直接取得（Tooltip内のラベルを回避）
      const confirmInput = container.querySelector('#confirm-text');
      expect(confirmInput).toBeTruthy();
      expect(confirmInput).toBeInTheDocument();
    });
  });

  describe('削除実行', () => {
    it('削除を実行するとsafeInvokeが呼ばれる', async () => {
      // window.confirmをモック
      window.confirm = jest.fn().mockReturnValue(true);
      mockSafeInvoke.mockResolvedValue({ deleted_count: 10 });

      const { container } = render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );

      // 日付を入力（IDで直接取得）
      const dateInput = container.querySelector(
        '#before-date'
      ) as HTMLInputElement;
      expect(dateInput).toBeTruthy();
      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });
      }

      // 確認テキストを入力（IDで直接取得）
      const confirmInput = container.querySelector(
        '#confirm-text'
      ) as HTMLInputElement;
      expect(confirmInput).toBeTruthy();
      if (confirmInput) {
        fireEvent.change(confirmInput, { target: { value: '削除' } });
      }

      const deleteButton = screen.getByRole('button', { name: /削除|Delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });
    });

    it('削除が成功するとonDeleteCompleteが呼ばれる', async () => {
      window.confirm = jest.fn().mockReturnValue(true);
      mockSafeInvoke.mockResolvedValue({ deleted_count: 10 });

      const { container } = render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );

      const dateInput = container.querySelector(
        '#before-date'
      ) as HTMLInputElement;
      expect(dateInput).toBeTruthy();
      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });
      }

      const confirmInput = container.querySelector(
        '#confirm-text'
      ) as HTMLInputElement;
      expect(confirmInput).toBeTruthy();
      if (confirmInput) {
        fireEvent.change(confirmInput, { target: { value: '削除' } });
      }

      const deleteButton = screen.getByRole('button', {
        name: /ログを削除|削除/i,
      });
      fireEvent.click(deleteButton);

      await waitFor(
        () => {
          expect(mockOnDeleteComplete).toHaveBeenCalledWith(10);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('削除に失敗した場合、エラーメッセージを表示する', async () => {
      window.confirm = jest.fn().mockReturnValue(true);
      mockSafeInvoke.mockRejectedValue(new Error('削除に失敗しました'));

      const { container } = render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );

      const dateInput = container.querySelector(
        '#before-date'
      ) as HTMLInputElement;
      expect(dateInput).toBeTruthy();
      if (dateInput) {
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });
      }

      const confirmInput = container.querySelector(
        '#confirm-text'
      ) as HTMLInputElement;
      expect(confirmInput).toBeTruthy();
      if (confirmInput) {
        fireEvent.change(confirmInput, { target: { value: '削除' } });
      }

      const deleteButton = screen.getByRole('button', {
        name: /ログを削除|削除/i,
      });
      fireEvent.click(deleteButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/削除に失敗|エラー|ログの削除に失敗/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('API IDがnullの場合、エラーメッセージを表示する', () => {
      render(
        <LogDelete apiId={null} onDeleteComplete={mockOnDeleteComplete} />
      );
      expect(screen.getByText(/APIが選択されていません/i)).toBeInTheDocument();
    });

    it('日付が入力されていない場合、エラーメッセージを表示する', async () => {
      render(
        <LogDelete apiId="api-1" onDeleteComplete={mockOnDeleteComplete} />
      );

      const deleteButton = screen.getByRole('button', {
        name: /ログを削除|削除/i,
      });
      fireEvent.click(deleteButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/日付を指定してください/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
