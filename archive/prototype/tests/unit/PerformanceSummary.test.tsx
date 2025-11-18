// PerformanceSummary - パフォーマンスサマリーコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PerformanceSummary } from '../../src/components/api/PerformanceSummary';

// errorHandlerをモック
jest.mock('../../src/utils/errorHandler', () => ({
  extractErrorMessage: jest.fn((err: unknown) => {
    if (err instanceof Error) return err.message;
    return String(err);
  }),
}));

// safeInvokeをモック
const mockSafeInvoke = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: jest.fn((...args: unknown[]) => mockSafeInvoke(...args)),
  isTauriAvailable: jest.fn(() => false),
  clearInvokeCache: jest.fn(),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('PerformanceSummary.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafeInvoke.mockResolvedValue({
      avg_response_time: 100,
      max_response_time: 200,
      min_response_time: 50,
      request_count: 1000,
      error_rate: 2.5,
      avg_cpu_usage: 50,
      avg_memory_usage: 60,
      total_token_usage: 100000,
    });
  });

  describe('基本的なレンダリング', () => {
    it('パフォーマンスサマリーを表示する', async () => {
      render(<PerformanceSummary apiId="api-1" period="1h" />);

      await waitFor(
        () => {
          expect(
            screen.getByText(/パフォーマンス統計|1時間/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('ローディング状態を表示する', () => {
      mockSafeInvoke.mockImplementation(() => new Promise(() => {})); // 永続的なPromise

      render(<PerformanceSummary apiId="api-1" period="1h" />);

      expect(
        screen.getByText(/パフォーマンス統計を読み込んでいます|読み込み中/i)
      ).toBeInTheDocument();
    });
  });

  describe('メトリクス表示', () => {
    it('平均レスポンスタイムを表示する', async () => {
      const { container } = render(
        <PerformanceSummary apiId="api-1" period="1h" />
      );

      await waitFor(
        () => {
          expect(screen.getByText(/平均レスポンス時間/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // 値も確認（フォーマットは小数点以下2桁）- より具体的なセレクタを使用
      await waitFor(
        () => {
          const cards = container.querySelectorAll('.summary-card');
          const avgResponseCard = Array.from(cards).find(card =>
            card.textContent?.includes('平均レスポンス時間')
          );
          expect(avgResponseCard).toBeTruthy();
          if (avgResponseCard) {
            // カード内に100が含まれていることを確認（100.00または100）
            expect(avgResponseCard.textContent).toMatch(/100/i);
          }
        },
        { timeout: 3000 }
      );
    });

    it('リクエスト数を表示する', async () => {
      const { container } = render(
        <PerformanceSummary apiId="api-1" period="1h" />
      );

      await waitFor(
        () => {
          expect(screen.getByText(/リクエスト数/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // 値も確認（toLocaleStringでカンマ区切り）- より具体的なセレクタを使用
      await waitFor(
        () => {
          const cards = container.querySelectorAll('.summary-card');
          const requestCountCard = Array.from(cards).find(card =>
            card.textContent?.includes('リクエスト数')
          );
          expect(requestCountCard).toBeTruthy();
          if (requestCountCard) {
            expect(requestCountCard.textContent).toMatch(/1,000|1000/i);
          }
        },
        { timeout: 3000 }
      );
    });

    it('エラー率を表示する', async () => {
      const { container } = render(
        <PerformanceSummary apiId="api-1" period="1h" />
      );

      await waitFor(
        () => {
          expect(screen.getByText(/エラー率/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // 値も確認（フォーマットは小数点以下2桁）- より具体的なセレクタを使用
      await waitFor(
        () => {
          const cards = container.querySelectorAll('.summary-card');
          const errorRateCard = Array.from(cards).find(card =>
            card.textContent?.includes('エラー率')
          );
          expect(errorRateCard).toBeTruthy();
          if (errorRateCard) {
            // エラー率は2.50として表示される（DECIMAL_PLACES=2のため）
            // データが読み込まれるまで待つ
            expect(errorRateCard.textContent).toMatch(/2\.\d{1,2}/i);
          }
        },
        { timeout: 3000 }
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生した場合、エラーメッセージを表示する', async () => {
      mockSafeInvoke.mockRejectedValue(new Error('データの取得に失敗しました'));

      render(<PerformanceSummary apiId="api-1" period="1h" />);

      await waitFor(
        () => {
          expect(
            screen.getByText(/データの取得に失敗|エラー/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
