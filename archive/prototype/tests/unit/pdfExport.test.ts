// pdfExport - PDFエクスポートユーティリティのユニットテスト

/**
 * @jest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// envをモック
jest.mock('../../src/utils/env', () => ({
  isDev: jest.fn(() => false),
  isTest: jest.fn(() => true),
  isProd: jest.fn(() => false),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// print.tsをモック
const mockPrint = jest
  .fn<(...args: unknown[]) => Promise<void>>()
  .mockResolvedValue(undefined);
jest.mock('../../src/utils/print', () => ({
  print: mockPrint,
}));

// pdfExportをモック後にインポート
import {
  exportToPdf,
  exportLogsToPdf,
  exportPerformanceReportToPdf,
} from '../../src/utils/pdfExport';
import type { LogData, PerformanceReportData } from '../../src/utils/pdfExport';

describe('pdfExport.ts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportToPdf', () => {
    it('デフォルトオプションでbodyをエクスポートする', async () => {
      document.body.innerHTML = '<div>コンテンツ</div>';

      await exportToPdf({});

      expect(mockPrint).toHaveBeenCalled();
    });

    it('指定したセレクタの要素をエクスポートする', async () => {
      document.body.innerHTML = '<div class="target">ターゲット</div>';

      await exportToPdf({ targetElement: '.target' });

      expect(mockPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          targetElement: expect.any(HTMLElement),
        })
      );
    });

    it('カスタムタイトルとファイル名を指定できる', async () => {
      document.body.innerHTML = '<div>コンテンツ</div>';

      await exportToPdf({
        title: 'カスタムタイトル',
        filename: 'custom-file',
      });

      expect(mockPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'カスタムタイトル',
        })
      );
    });

    it('存在しない要素の場合にエラーをスローする', async () => {
      await expect(
        exportToPdf({ targetElement: '#nonexistent' })
      ).rejects.toThrow();
    });
  });

  describe('exportLogsToPdf', () => {
    it('ログデータが空の場合でもエクスポートを実行する（将来の実装で警告を追加予定）', async () => {
      document.body.innerHTML =
        '<div class="api-logs-content">ログコンテンツ</div>';

      const logData: LogData[] = [];

      // 現在の実装では、ログデータが空でもエクスポート処理を実行する
      // 将来的にPDFライブラリを使用する際に警告を追加する予定（実装コメント参照）
      await exportLogsToPdf(logData);

      // printが呼ばれることを確認（現在の実装ではブラウザの印刷機能を使用）
      expect(mockPrint).toHaveBeenCalled();
    });

    it('ログデータがある場合にエクスポートを実行する', async () => {
      document.body.innerHTML =
        '<div class="api-logs-content">ログコンテンツ</div>';

      const logData: LogData[] = [
        {
          id: '1',
          api_id: 'api-1',
          method: 'GET',
          path: '/test',
          response_status: 200,
          response_time_ms: 100,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      await exportLogsToPdf(logData);

      expect(mockPrint).toHaveBeenCalled();
    });

    it('カスタムオプションを指定できる', async () => {
      document.body.innerHTML =
        '<div class="api-logs-content">ログコンテンツ</div>';

      const logData: LogData[] = [];

      await exportLogsToPdf(logData, {
        title: 'カスタムログタイトル',
        filename: 'custom-logs',
      });

      expect(mockPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'カスタムログタイトル',
        })
      );
    });
  });

  describe('exportPerformanceReportToPdf', () => {
    it('パフォーマンスレポートをエクスポートする', async () => {
      document.body.innerHTML =
        '<div class="performance-dashboard-content">ダッシュボード</div>';

      const reportData: PerformanceReportData = {
        apiName: 'Test API',
        period: '24h',
        summary: {
          avgResponseTime: 100,
          totalRequests: 1000,
        },
      };

      await exportPerformanceReportToPdf(reportData);

      expect(mockPrint).toHaveBeenCalled();
    });

    it('API名を含むタイトルを生成する', async () => {
      document.body.innerHTML =
        '<div class="performance-dashboard-content">ダッシュボード</div>';

      const reportData: PerformanceReportData = {
        apiName: 'Test API',
        period: '24h',
        summary: {},
      };

      await exportPerformanceReportToPdf(reportData);

      expect(mockPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'パフォーマンスレポート - Test API',
        })
      );
    });

    it('API名が空の場合にデフォルトタイトルを使用する', async () => {
      document.body.innerHTML =
        '<div class="performance-dashboard-content">ダッシュボード</div>';

      const reportData: PerformanceReportData = {
        apiName: '',
        period: '24h',
        summary: {},
      };

      await exportPerformanceReportToPdf(reportData);

      expect(mockPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'パフォーマンスレポート',
        })
      );
    });

    it('カスタムオプションを指定できる', async () => {
      document.body.innerHTML =
        '<div class="performance-dashboard-content">ダッシュボード</div>';

      const reportData: PerformanceReportData = {
        apiName: 'Test API',
        period: '24h',
        summary: {},
      };

      await exportPerformanceReportToPdf(reportData, {
        title: 'カスタムレポートタイトル',
        filename: 'custom-report',
      });

      expect(mockPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'カスタムレポートタイトル',
        })
      );
    });
  });
});
