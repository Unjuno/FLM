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
      expect(screen.getByText(/エクスポート|出力/i)).toBeInTheDocument();
    });

    it('エクスポートボタンを表示する', () => {
      render(<LogExport apiId="api-1" filter={mockFilter} />);
      const exportButton = screen.getByRole('button', {
        name: /エクスポート|出力/i,
      });
      expect(exportButton).toBeInTheDocument();
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
      const exportButton = screen.getByRole('button', {
        name: /エクスポート|出力/i,
      });
      fireEvent.click(exportButton);

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
      const exportButton = screen.getByRole('button', {
        name: /エクスポート|出力/i,
      });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('エクスポートに失敗した場合、エラーメッセージを表示する', async () => {
      mockSafeInvoke.mockRejectedValue(new Error('エクスポートに失敗しました'));

      render(<LogExport apiId="api-1" filter={mockFilter} />);
      const exportButton = screen.getByRole('button', {
        name: /エクスポート|出力/i,
      });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(
          screen.getByText(/エクスポートに失敗|エラー/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('API IDがnullの場合', () => {
    it('API IDがnullの場合、エラーメッセージを表示する', () => {
      render(<LogExport apiId={null} filter={mockFilter} />);
      expect(screen.getByText(/APIが選択されていません/i)).toBeInTheDocument();
    });
  });
});
