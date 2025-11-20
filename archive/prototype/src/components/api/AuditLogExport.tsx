// AuditLogExport - 監査ログエクスポートコンポーネント

import React, { useState, useCallback, useTransition } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { Tooltip } from '../common/Tooltip';
import { logger } from '../../utils/logger';

/**
 * 監査ログエクスポートコンポーネントのプロパティ
 */
export interface AuditLogExportProps {
  onExportComplete?: (count: number) => void;
}

/**
 * エクスポートリクエストの型定義
 */
interface ExportAuditLogsRequest {
  format: string;
  api_id?: string | null;
  action?: string | null;
  resource_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  exclude_sensitive_info?: boolean;
}

const MIME_TYPES = {
  csv: 'text/csv;charset=utf-8;',
  json: 'application/json;charset=utf-8;',
  txt: 'text/plain;charset=utf-8;',
} as const;

/**
 * エラーメッセージ
 */
const ERROR_MESSAGES = {
  EXPORT_FAILED: 'エクスポートに失敗しました',
} as const;

/**
 * 監査ログエクスポートコンポーネント
 * 監査ログデータをCSV/JSON/TXT形式でエクスポートします
 */
export const AuditLogExport: React.FC<AuditLogExportProps> = ({
  onExportComplete,
}) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [excludeSensitiveInfo, setExcludeSensitiveInfo] = useState(true);

  /**
   * ファイルをダウンロード（ブラウザのダウンロード機能を使用）
   */
  const downloadFile = useCallback(
    async (data: string, format: 'csv' | 'json' | 'txt'): Promise<void> => {
      try {
        const extension =
          format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'txt';
        const filename = `audit-logs_${new Date().toISOString().split('T')[0]}.${extension}`;
        const mimeType = MIME_TYPES[format];

        // Blobを作成してダウンロード
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        logger.info(
          `監査ログをエクスポートしました: ${filename}`,
          'AuditLogExport'
        );
      } catch (err) {
        logger.error('ファイル保存エラー', err, 'AuditLogExport');
        throw err;
      }
    },
    []
  );

  /**
   * エクスポートを実行
   */
  const exportToFile = useCallback(
    async (format: 'csv' | 'json' | 'txt'): Promise<void> => {
      try {
        setExporting(true);
        setError(null);

        const request: ExportAuditLogsRequest = {
          format,
          api_id: null,
          action: null,
          resource_type: null,
          start_date: null,
          end_date: null,
          exclude_sensitive_info: excludeSensitiveInfo,
        };

        const data = await safeInvoke<string>('export_audit_logs', {
          request,
        });

        await downloadFile(data, format);

        logger.info(
          `監査ログデータをエクスポートしました (${format.toUpperCase()})`,
          'AuditLogExport'
        );

        if (onExportComplete) {
          // データから行数を推定（簡易的な方法）
          const count =
            data.split('\n').filter(line => line.trim().length > 0).length - 1; // ヘッダー行を除外
          onExportComplete(Math.max(0, count));
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : ERROR_MESSAGES.EXPORT_FAILED;
        setError(errorMessage);
        logger.error('監査ログエクスポートエラー', err, 'AuditLogExport');
      } finally {
        setExporting(false);
      }
    },
    [excludeSensitiveInfo, downloadFile, onExportComplete]
  );

  /**
   * エクスポートハンドラー
   */
  const handleExport = useCallback(
    (format: 'csv' | 'json' | 'txt') => {
      startTransition(() => {
        exportToFile(format);
      });
    },
    [exportToFile, startTransition]
  );

  const isDisabled = exporting || isPending;
  const buttonText = exporting ? 'エクスポート中...' : undefined;

  return (
    <div className="audit-log-export">
      <div className="audit-log-export-header">
        <h3>監査ログのエクスポート</h3>
        <p className="audit-log-export-description">
          監査ログをCSV、JSON、またはTXT形式でエクスポートできます。
        </p>
      </div>

      <div className="audit-log-export-options">
        <div className="audit-log-export-option">
          <label className="audit-log-export-checkbox-label">
            <input
              type="checkbox"
              checked={excludeSensitiveInfo}
              onChange={e => setExcludeSensitiveInfo(e.target.checked)}
              disabled={isDisabled}
              className="audit-log-export-checkbox"
            />
            <span>
              IPアドレスとユーザーエージェントを除外する（プライバシー保護）
            </span>
          </label>
          <p className="audit-log-export-hint">
            チェックを外すと、IPアドレスとユーザーエージェント情報がエクスポートに含まれます。
            プライバシー保護のため、デフォルトで除外することを推奨します。
          </p>
        </div>
      </div>

      {error && (
        <div className="audit-log-export-error">
          <p>{error}</p>
        </div>
      )}

      <div className="audit-log-export-buttons">
        <Tooltip
          content="監査ログをCSV形式でエクスポートします。Excelなどで開いて分析できます。"
          position="top"
        >
          <button
            onClick={() => handleExport('csv')}
            disabled={isDisabled}
            className="export-button export-button-csv"
            aria-label="CSV形式で監査ログをエクスポート"
          >
            {buttonText || 'CSVでエクスポート'}
          </button>
        </Tooltip>
        <Tooltip
          content="監査ログをJSON形式でエクスポートします。プログラムでの処理や分析に適しています。"
          position="top"
        >
          <button
            onClick={() => handleExport('json')}
            disabled={isDisabled}
            className="export-button export-button-json"
            aria-label="JSON形式で監査ログをエクスポート"
          >
            {buttonText || 'JSONでエクスポート'}
          </button>
        </Tooltip>
        <Tooltip
          content="監査ログをTXT形式でエクスポートします。テキストエディタで開いて確認できます。"
          position="top"
        >
          <button
            onClick={() => handleExport('txt')}
            disabled={isDisabled}
            className="export-button export-button-txt"
            aria-label="TXT形式で監査ログをエクスポート"
          >
            {buttonText || 'TXTでエクスポート'}
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
