// FLM - PDFエクスポートユーティリティのユニットテスト
// QA + FE 実装
// TEST-013-03: ユニットテスト追加

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { exportToPdf, exportLogsToPdf, exportPerformanceReportToPdf } from '../../src/utils/pdfExport';
import type { LogData, PerformanceReportData } from '../../src/utils/pdfExport';

// print.tsをモック
const mockPrintElement = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/utils/print', () => ({
  printElement: mockPrintElement,
}));

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
      
      expect(mockPrintElement).toHaveBeenCalled();
    });

    it('指定したセレクタの要素をエクスポートする', async () => {
      document.body.innerHTML = '<div class="target">ターゲット</div>';
      
      await exportToPdf({ targetElement: '.target' });
      
      expect(mockPrintElement).toHaveBeenCalledWith(
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
      
      expect(mockPrintElement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'カスタムタイトル',
        })
      );
    });

    it('存在しない要素の場合にエラーをスローする', async () => {
      await expect(exportToPdf({ targetElement: '#nonexistent' })).rejects.toThrow();
    });
  });

  describe('exportLogsToPdf', () => {
    it('ログデータが空の場合に警告を出力する', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      document.body.innerHTML = '<div class="api-logs-content">ログコンテンツ</div>';
      
      const logData: LogData[] = [];
      
      await exportLogsToPdf(logData);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('エクスポートするログデータがありません。');
      
      consoleWarnSpy.mockRestore();
    });

    it('ログデータがある場合にエクスポートを実行する', async () => {
      document.body.innerHTML = '<div class="api-logs-content">ログコンテンツ</div>';
      
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
      
      expect(mockPrintElement).toHaveBeenCalled();
    });

    it('カスタムオプションを指定できる', async () => {
      document.body.innerHTML = '<div class="api-logs-content">ログコンテンツ</div>';
      
      const logData: LogData[] = [];
      
      await exportLogsToPdf(logData, {
        title: 'カスタムログタイトル',
        filename: 'custom-logs',
      });
      
      expect(mockPrintElement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'カスタムログタイトル',
        })
      );
    });
  });

  describe('exportPerformanceReportToPdf', () => {
    it('パフォーマンスレポートをエクスポートする', async () => {
      document.body.innerHTML = '<div class="performance-dashboard-content">ダッシュボード</div>';
      
      const reportData: PerformanceReportData = {
        apiName: 'Test API',
        period: '24h',
        summary: {
          avgResponseTime: 100,
          totalRequests: 1000,
        },
      };
      
      await exportPerformanceReportToPdf(reportData);
      
      expect(mockPrintElement).toHaveBeenCalled();
    });

    it('API名を含むタイトルを生成する', async () => {
      document.body.innerHTML = '<div class="performance-dashboard-content">ダッシュボード</div>';
      
      const reportData: PerformanceReportData = {
        apiName: 'Test API',
        period: '24h',
        summary: {},
      };
      
      await exportPerformanceReportToPdf(reportData);
      
      expect(mockPrintElement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'パフォーマンスレポート - Test API',
        })
      );
    });

    it('API名が空の場合にデフォルトタイトルを使用する', async () => {
      document.body.innerHTML = '<div class="performance-dashboard-content">ダッシュボード</div>';
      
      const reportData: PerformanceReportData = {
        apiName: '',
        period: '24h',
        summary: {},
      };
      
      await exportPerformanceReportToPdf(reportData);
      
      expect(mockPrintElement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'パフォーマンスレポート',
        })
      );
    });

    it('カスタムオプションを指定できる', async () => {
      document.body.innerHTML = '<div class="performance-dashboard-content">ダッシュボード</div>';
      
      const reportData: PerformanceReportData = {
        apiName: 'Test API',
        period: '24h',
        summary: {},
      };
      
      await exportPerformanceReportToPdf(reportData, {
        title: 'カスタムレポートタイトル',
        filename: 'custom-report',
      });
      
      expect(mockPrintElement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'カスタムレポートタイトル',
        })
      );
    });
  });
});
