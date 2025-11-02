// FLM - ログエクスポートコンポーネント
// フロントエンドエージェント (FE) 実装
// F008: データ管理・ユーティリティ機能 - ログエクスポート機能実装

import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Tooltip } from '../common/Tooltip';
import { exportLogsToPdf } from '../../utils/pdfExport';

/**
 * ログフィルタの型定義
 */
export interface LogFilter {
  startDate: string;
  endDate: string;
  statusCodes: number[];
  pathFilter: string;
  errorsOnly: boolean;
}

/**
 * ログエクスポートコンポーネントのプロパティ
 */
export interface LogExportProps {
  apiId: string | null;
  filter: LogFilter;
  onExportComplete?: (count: number) => void;
}

/**
 * エクスポートリクエストの型定義
 */
interface ExportRequest {
  api_id: string | null;
  format: string;
  start_date: string | null;
  end_date: string | null;
  status_codes: number[] | null;
  path_filter: string | null;
}

/**
 * エクスポートレスポンスの型定義
 */
interface ExportResponse {
  data: string;
  format: string;
  count: number;
}

/**
 * 定数定義
 */
const DEFAULT_ERROR_CODES = [400, 401, 403, 404, 500, 502, 503];
const MIME_TYPES = {
  csv: 'text/csv;charset=utf-8;',
  json: 'application/json;charset=utf-8;',
} as const;

/**
 * エラーメッセージ
 */
const ERROR_MESSAGES = {
  NO_API: 'APIが選択されていません',
  EXPORT_FAILED: 'エクスポートに失敗しました',
  PDF_EXPORT_FAILED: 'PDFエクスポートに失敗しました',
} as const;

/**
 * ログエクスポートコンポーネント
 * ログデータをCSV/JSON形式でエクスポートします
 */
export const LogExport: React.FC<LogExportProps> = ({
  apiId,
  filter,
  onExportComplete,
}) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ステータスコードをフィルタリング
   */
  const getFilteredStatusCodes = useCallback((): number[] | null => {
    if (filter.errorsOnly) {
      const errorCodes = filter.statusCodes.length > 0
        ? filter.statusCodes.filter(code => code >= 400)
        : DEFAULT_ERROR_CODES;
      return errorCodes.length > 0 ? errorCodes : DEFAULT_ERROR_CODES;
    }
    return filter.statusCodes.length > 0 ? filter.statusCodes : null;
  }, [filter.errorsOnly, filter.statusCodes]);

  /**
   * エクスポートリクエストを構築
   */
  const buildExportRequest = useCallback((format: string): ExportRequest => {
    return {
      api_id: apiId,
      format,
      start_date: filter.startDate || null,
      end_date: filter.endDate || null,
      status_codes: getFilteredStatusCodes(),
      path_filter: filter.pathFilter || null,
    };
  }, [apiId, filter, getFilteredStatusCodes]);

  /**
   * ファイルをダウンロード
   */
  const downloadFile = useCallback((data: string, format: 'csv' | 'json'): void => {
    const blob = new Blob([data], {
      type: MIME_TYPES[format],
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * CSV/JSONエクスポートを実行
   */
  const exportToFile = useCallback(async (format: 'csv' | 'json'): Promise<void> => {
    if (!apiId) {
      setError(ERROR_MESSAGES.NO_API);
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const request = buildExportRequest(format);
      const response = await invoke<ExportResponse>('export_logs', { request });

      downloadFile(response.data, format);

      console.log(`ログデータをエクスポートしました: ${response.count}件 (${format.toUpperCase()})`);
      
      if (onExportComplete) {
        onExportComplete(response.count);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.EXPORT_FAILED;
      setError(errorMessage);
      console.error('ログエクスポートエラー:', err);
    } finally {
      setExporting(false);
    }
  }, [apiId, buildExportRequest, downloadFile, onExportComplete]);

  /**
   * PDFエクスポートを実行
   */
  const exportToPdf = useCallback(async (): Promise<void> => {
    try {
      setExporting(true);
      setError(null);
      
      await exportLogsToPdf([], {
        title: 'APIログ一覧',
        filename: `api-logs_${new Date().toISOString().split('T')[0]}`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.PDF_EXPORT_FAILED;
      setError(errorMessage);
      console.error('PDFエクスポートエラー:', err);
    } finally {
      setExporting(false);
    }
  }, []);

  /**
   * ログデータをエクスポートします
   */
  const handleExport = useCallback(async (format: 'csv' | 'json' | 'pdf'): Promise<void> => {
    if (format === 'pdf') {
      await exportToPdf();
      return;
    }
    await exportToFile(format);
  }, [exportToPdf, exportToFile]);

  const isDisabled = exporting || !apiId;
  const buttonText = exporting ? 'エクスポート中...' : '';

  return (
    <div className="log-export">
      <div className="log-export-buttons">
        <Tooltip 
          content="現在のフィルタ条件に一致するログをCSV形式でエクスポートします。Excelなどで開いて分析できます。" 
          position="top"
        >
          <button
            onClick={() => handleExport('csv')}
            disabled={isDisabled}
            className="export-button export-button-csv"
            aria-label="CSV形式でログをエクスポート"
          >
            {buttonText || 'CSVでエクスポート'}
          </button>
        </Tooltip>
        <Tooltip 
          content="現在のフィルタ条件に一致するログをJSON形式でエクスポートします。プログラムでの処理や分析に適しています。" 
          position="top"
        >
          <button
            onClick={() => handleExport('json')}
            disabled={isDisabled}
            className="export-button export-button-json"
            aria-label="JSON形式でログをエクスポート"
          >
            {buttonText || 'JSONでエクスポート'}
          </button>
        </Tooltip>
        <Tooltip 
          content="現在のログ一覧をPDF形式でエクスポートします。印刷ダイアログからPDFとして保存できます。" 
          position="top"
        >
          <button
            onClick={() => handleExport('pdf')}
            disabled={isDisabled}
            className="export-button export-button-pdf"
            aria-label="PDF形式でログをエクスポート"
          >
            {buttonText || 'PDFでエクスポート'}
          </button>
        </Tooltip>
      </div>
      {error && (
        <div className="export-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
