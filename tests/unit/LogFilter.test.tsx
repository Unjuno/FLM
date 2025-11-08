// LogFilter - ログフィルターコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogFilter } from '../../src/components/api/LogFilter';
import type { LogFilterState } from '../../src/components/api/LogFilter';

describe('LogFilter.tsx', () => {
  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('フィルターコンポーネントを表示する', () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      expect(screen.getByText(/フィルター|フィルタ/i)).toBeInTheDocument();
    });

    it('開始日入力フィールドを表示する', () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      const startDateInput = screen.getByLabelText(/開始|開始日/i);
      expect(startDateInput).toBeInTheDocument();
    });

    it('終了日入力フィールドを表示する', () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      const endDateInput = screen.getByLabelText(/終了|終了日/i);
      expect(endDateInput).toBeInTheDocument();
    });
  });

  describe('フィルター機能', () => {
    it('開始日を変更するとonFilterChangeが呼ばれる', async () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      const startDateInput = screen.getByLabelText(/開始|開始日/i);
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalled();
      });
    });

    it('終了日を変更するとonFilterChangeが呼ばれる', async () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      const endDateInput = screen.getByLabelText(/終了|終了日/i);
      fireEvent.change(endDateInput, { target: { value: '2024-01-31' } });

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalled();
      });
    });

    it('パスフィルターを変更するとonFilterChangeが呼ばれる', async () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      const pathInput = screen.getByLabelText(/パス|URL|パスフィルター/i);
      fireEvent.change(pathInput, { target: { value: '/api/test' } });

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalled();
      });
    });

    it('エラーのみチェックボックスを切り替えられる', async () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      const errorsOnlyCheckbox =
        screen.getByLabelText(/エラーのみ|エラーのみ表示/i);
      fireEvent.click(errorsOnlyCheckbox);

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalled();
      });
    });
  });

  describe('ステータスコードフィルター', () => {
    it('ステータスコードフィルターを表示する', () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      expect(
        screen.getByText(/ステータスコード|HTTP|200/i)
      ).toBeInTheDocument();
    });

    it('ステータスコードを選択できる', async () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      // ステータスコードのチェックボックスをクリック
      const status200 = screen.getByLabelText(/200.*OK/i);
      if (status200) {
        fireEvent.click(status200);
        await waitFor(() => {
          expect(mockOnFilterChange).toHaveBeenCalled();
        });
      }
    });
  });

  describe('フィルターリセット', () => {
    it('リセットボタンを表示する', () => {
      render(<LogFilter onFilterChange={mockOnFilterChange} />);

      const resetButton = screen.getByRole('button', { name: /リセット|🔄/i });
      expect(resetButton).toBeInTheDocument();
    });

    it('リセットボタンをクリックするとフィルターがリセットされる', async () => {
      render(
        <LogFilter
          initialFilter={{
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            statusCodes: [200],
            pathFilter: '/api/test',
            errorsOnly: true,
          }}
          onFilterChange={mockOnFilterChange}
        />
      );

      const resetButton = screen.getByRole('button', { name: /リセット|🔄/i });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalled();
      });
    });
  });
});
