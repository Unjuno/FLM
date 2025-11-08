// LogDetail - ログ詳細表示コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogDetail } from '../../src/components/api/LogDetail';

describe('LogDetail.tsx', () => {
  const mockLog = {
    id: 'log-1',
    api_id: 'api-1',
    method: 'POST',
    path: '/api/chat',
    request_body: JSON.stringify({ message: 'Hello' }),
    response_status: 200,
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('ログ詳細を表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(screen.getByText(/ログ詳細|詳細/i)).toBeInTheDocument();
    });

    it('HTTPメソッドを表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });

    it('パスを表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(screen.getByText('/api/chat')).toBeInTheDocument();
    });

    it('ステータスコードを表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('タイムスタンプを表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(screen.getByText(/2024-01-01/i)).toBeInTheDocument();
    });
  });

  describe('リクエストボディ表示', () => {
    it('リクエストボディを表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(screen.getByText(/request_body|リクエスト/i)).toBeInTheDocument();
    });

    it('JSON形式のリクエストボディをフォーマットして表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(screen.getByText(/Hello/i)).toBeInTheDocument();
    });

    it('リクエストボディがnullの場合、適切に処理する', () => {
      const logWithoutBody = {
        ...mockLog,
        request_body: null,
      };

      render(<LogDetail log={logWithoutBody} onClose={mockOnClose} />);
      expect(screen.getByText(/リクエストボディ|なし/i)).toBeInTheDocument();
    });
  });

  describe('エラーメッセージ表示', () => {
    it('エラーメッセージを表示する', () => {
      const logWithError = {
        ...mockLog,
        error_message: 'エラーが発生しました',
        response_status: 500,
      };

      render(<LogDetail log={logWithError} onClose={mockOnClose} />);
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    });

    it('エラーメッセージがnullの場合、エラーを表示しない', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      expect(
        screen.queryByText(/エラーが発生しました/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('閉じる機能', () => {
    it('閉じるボタンを表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      const closeButton = screen.getByRole('button', { name: /閉じる|×/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('閉じるボタンをクリックするとonCloseが呼ばれる', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      const closeButton = screen.getByRole('button', { name: /閉じる|×/i });
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('コピー機能', () => {
    it('コピーボタンを表示する', () => {
      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('ログ情報をクリップボードにコピーする', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      render(<LogDetail log={mockLog} onClose={mockOnClose} />);
      const copyButtons = screen.getAllByRole('button', { name: /コピー/i });
      if (copyButtons.length > 0) {
        fireEvent.click(copyButtons[0]);
        expect(mockWriteText).toHaveBeenCalled();
      }
    });
  });
});
