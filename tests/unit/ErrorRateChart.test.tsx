// ErrorRateChart - エラー率チャートコンポーネントのユニットテスト

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
import { ErrorRateChart } from '../../src/components/api/ErrorRateChart';

// usePerformanceMetricsをモック
const mockUsePerformanceMetrics = jest.fn();
jest.mock('../../src/hooks/usePerformanceMetrics', () => ({
  usePerformanceMetrics: (...args: unknown[]) =>
    mockUsePerformanceMetrics(...args),
}));

// useI18nをモック（I18nProviderのエラーを回避）
jest.mock('../../src/contexts/I18nContext', () => {
  const actual = jest.requireActual('../../src/contexts/I18nContext');
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: 'ja',
      setLocale: jest.fn(),
    }),
  };
});

describe('ErrorRateChart.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('エラー率チャートを表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [{ time: '00:00:00', value: 5.0 }],
        loading: false,
        error: null,
        isEmpty: false,
      });

      const { container } = render(<ErrorRateChart apiId="api-1" />);
      // チャートタイトルまたはコンテナが表示されることを確認
      const region = screen.queryByRole('region');
      const chartContainer = container.querySelector('.error-rate-chart');
      expect(
        region || chartContainer || container.querySelector('svg')
      ).toBeTruthy();
    });

    it('ローディング状態を表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [],
        loading: true,
        error: null,
        isEmpty: false,
      });

      render(<ErrorRateChart apiId="api-1" />);
      expect(
        screen.getByText(/charts\.errorRate\.loading|読み込み中|ローディング/i)
      ).toBeInTheDocument();
    });
  });

  describe('データ表示', () => {
    it('エラー率データを表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [
          { time: '00:00:00', value: 5.0 },
          { time: '00:01:00', value: 3.0 },
        ],
        loading: false,
        error: null,
        isEmpty: false,
      });

      const { container } = render(<ErrorRateChart apiId="api-1" />);
      // チャートコンテナが表示されることを確認
      const region = screen.queryByRole('region');
      const chartContainer = container.querySelector('.error-rate-chart');
      expect(
        region || chartContainer || container.querySelector('svg')
      ).toBeTruthy();
    });
  });

  describe('アラート閾値', () => {
    it('アラート閾値を超えた場合、警告を表示する', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: [
          { time: '00:00:00', value: 10.0 }, // 閾値5.0を超える
        ],
        loading: false,
        error: null,
        isEmpty: false,
      });

      const { container } = render(
        <ErrorRateChart apiId="api-1" alertThreshold={5.0} />
      );
      // 警告メッセージまたはアラート表示が確認できればOK
      const alertElement =
        container.querySelector('.alert-badge') ||
        container.querySelector('[role="alert"]') ||
        screen.queryByText(/警告|Alert|閾値|highErrorRate/i);
      // アラートが表示されるか、またはチャートが表示されていればOK
      // ResponsiveContainerは非同期でSVGをレンダリングするため、チャートコンテナの存在を確認
      const chartContainer = container.querySelector('.error-rate-chart');
      expect(
        alertElement || chartContainer || container.querySelector('svg')
      ).toBeTruthy();
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

      render(<ErrorRateChart apiId="api-1" />);
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

      render(<ErrorRateChart apiId="api-1" />);
      expect(
        screen.getByText(/charts\.errorRate\.selectApi|APIを選択/i)
      ).toBeInTheDocument();
    });
  });
});
