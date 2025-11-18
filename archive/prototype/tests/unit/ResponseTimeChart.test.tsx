// ResponseTimeChart - レスポンスタイムチャートコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */

// ResizeObserverをモック（テスト実行前に設定が必要）
// @ts-ignore
if (
  typeof global !== 'undefined' &&
  typeof global.ResizeObserver === 'undefined'
) {
  // @ts-ignore
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// @ts-ignore
if (
  typeof window !== 'undefined' &&
  typeof window.ResizeObserver === 'undefined'
) {
  // @ts-ignore
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResponseTimeChart } from '../../src/components/api/ResponseTimeChart';

// usePerformanceMetricsをモック
const mockUsePerformanceMetrics = jest.fn();
jest.mock('../../src/hooks/usePerformanceMetrics', () => ({
  usePerformanceMetrics: (...args: unknown[]) =>
    mockUsePerformanceMetrics(...args),
}));

// useI18nをモック
jest.mock('../../src/contexts/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('ResponseTimeChart.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('レスポンスタイムチャートを表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [{ time: '00:00:00', value: 100 }],
        loading: false,
        error: null,
        isEmpty: false,
      });

      const { container } = render(<ResponseTimeChart apiId="api-1" />);
      // チャートタイトルまたはコンテナが表示されることを確認
      const region = screen.queryByRole('region');
      const chartContainer = container.querySelector('.response-time-chart');
      // どちらかが存在することを確認
      if (!region && !chartContainer) {
        // データが表示されている場合はチャートが存在するはず
        const title = screen.queryByText(/charts\.responseTime\.title/i);
        expect(title || container.querySelector('svg')).toBeTruthy();
      } else {
        expect(true).toBe(true);
      }
    });

    it('ローディング状態を表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [],
        loading: true,
        error: null,
        isEmpty: false,
      });

      render(<ResponseTimeChart apiId="api-1" />);
      expect(
        screen.getByText(
          /charts\.responseTime\.loading|読み込み中|ローディング/i
        )
      ).toBeInTheDocument();
    });
  });

  describe('データ表示', () => {
    it('レスポンスタイムデータを表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [
          { time: '00:00:00', value: 100 },
          { time: '00:01:00', value: 150 },
        ],
        loading: false,
        error: null,
        isEmpty: false,
      });

      const { container } = render(<ResponseTimeChart apiId="api-1" />);
      // チャートコンテナが表示されることを確認
      const region = screen.queryByRole('region');
      const chartContainer = container.querySelector('.response-time-chart');
      expect(region || chartContainer).toBeTruthy();
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生した場合、エラーメッセージを表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [],
        loading: false,
        error: 'データの取得に失敗しました',
        isEmpty: false,
      });

      render(<ResponseTimeChart apiId="api-1" />);
      expect(
        screen.getByText(/データの取得に失敗|エラー|⚠️/i)
      ).toBeInTheDocument();
    });
  });

  describe('空の状態', () => {
    it('isEmptyがtrueの場合、空の状態を表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        isEmpty: true,
      });

      render(<ResponseTimeChart apiId="api-1" />);
      expect(
        screen.getByText(/charts\.responseTime\.selectApi|APIを選択/i)
      ).toBeInTheDocument();
    });
  });
});
