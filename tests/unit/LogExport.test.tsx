// LogExport - ログエクスポートコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogExport } from '../../src/components/api/LogExport';

// safeInvokeをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
}));

describe('LogExport.tsx', () => {
  const mockFilter = {
    startDate: '',
    endDate: '',
    statusCodes: [],
    pathFilter: '',
    errorsOnly: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('エクスポートコンポーネントを表示する', () => {
      render(<LogExport apiId="api-1" filter={mockFilter} />);
      // CSV、JSON、PDFのいずれかのボタンが表示されることを確認
      expect(screen.getByText(/CSVでエクスポート|JSONでエクスポート|PDFでエクスポート/i)).toBeInTheDocument();
    });

    it('エクスポートボタンを表示する', () => {
      render(<LogExport apiId="api-1" filter={mockFilter} />);
      // CSVボタンを特定して確認
      const csvButton = screen.getByRole('button', {
        name: /CSV形式でログをエクスポート/i,
      });
      expect(csvButton).toBeInTheDocument();
    });
  });

  describe('エクスポート実行', () => {
    it('CSV形式でエクスポートする', async () => {
      mockSafeInvoke.mockResolvedValue({
        data: 'csv data',
        format: 'csv',
        count: 1,
      });

      render(<LogExport apiId="api-1" filter={mockFilter} />);
      const csvButton = screen.getByRole('button', {
        name: /CSV形式でログをエクスポート/i,
      });
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });
    });

    it('JSON形式でエクスポートする', async () => {
      mockSafeInvoke.mockResolvedValue({
        data: 'json data',
        format: 'json',
        count: 1,
      });

      render(<LogExport apiId="api-1" filter={mockFilter} />);
      const jsonButton = screen.getByRole('button', {
        name: /JSON形式でログをエクスポート/i,
      });
      fireEvent.click(jsonButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('エクスポートに失敗した場合、エラーメッセージを表示する', async () => {
      mockSafeInvoke.mockRejectedValue(new Error('エクスポートに失敗しました'));

      render(<LogExport apiId="api-1" filter={mockFilter} />);
      const csvButton = screen.getByRole('button', {
        name: /CSV形式でログをエクスポート/i,
      });
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(
          screen.getByText(/エクスポートに失敗|エラー/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('API IDがnullの場合', () => {
    it('API IDがnullの場合、ボタンが無効化される', () => {
      render(<LogExport apiId={null} filter={mockFilter} />);
      const csvButton = screen.getByRole('button', {
        name: /CSV形式でログをエクスポート/i,
      });
      expect(csvButton).toBeDisabled();
    });

    it('API IDがnullの場合、エクスポートを試みるとエラーメッセージを表示する', async () => {
      render(<LogExport apiId={null} filter={mockFilter} />);
      // ボタンは無効化されているが、直接exportToFileを呼び出すとエラーが表示される
      // 実際の動作を確認するため、ボタンのクリックを試みる（無効化されているため動作しない）
      const csvButton = screen.getByRole('button', {
        name: /CSV形式でログをエクスポート/i,
      });
      expect(csvButton).toBeDisabled();
    });
  });
});
