// FLM - ログエクスポートコンポーネント
// フロントエンドエージェント (FE) 実装
// F008: データ管理・ユーティリティ機能 - ログエクスポート機能実装

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * ログエクスポートコンポーネントのプロパティ
 */
interface LogExportProps {
  apiId: string | null;
  filter: {
    startDate: string;
    endDate: string;
    statusCodes: number[];
    pathFilter: string;
    errorsOnly: boolean;
  };
  onExportComplete?: (count: number) => void;
}

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
   * ログデータをエクスポートします
   */
  const handleExport = async (format: 'csv' | 'json') => {
    if (!apiId) {
      setError('APIが選択されていません');
      return;
    }

    try {
      setExporting(true);
      setError(null);

      // エクスポートリクエストを構築
      // errors_onlyフィルタは、status_codesで400以上を指定することで実現可能
      const request: {
        api_id: string | null;
        format: string;
        start_date: string | null;
        end_date: string | null;
        status_codes: number[] | null;
        path_filter: string | null;
      } = {
        api_id: apiId,
        format,
        start_date: filter.startDate || null,
        end_date: filter.endDate || null,
        status_codes: filter.errorsOnly 
          ? filter.statusCodes.length > 0 
            ? filter.statusCodes.filter(code => code >= 400)
            : [400, 401, 403, 404, 500, 502, 503]
          : filter.statusCodes.length > 0 
            ? filter.statusCodes 
            : null,
        path_filter: filter.pathFilter || null,
      };

      // export_logs IPCコマンドを呼び出し
      const response = await invoke<{
        data: string;
        format: string;
        count: number;
      }>('export_logs', { request });

      // Blob URLを使用してファイルをダウンロード
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;',
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `api-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // 成功メッセージを表示（オプション）
      console.log(`ログデータをエクスポートしました: ${response.count}件 (${format.toUpperCase()})`);
      
      // コールバックを呼び出し
      if (onExportComplete) {
        onExportComplete(response.count);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エクスポートに失敗しました');
      console.error('ログエクスポートエラー:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="log-export">
      <div className="log-export-buttons">
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting || !apiId}
          className="export-button export-button-csv"
        >
          {exporting ? 'エクスポート中...' : 'CSVでエクスポート'}
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={exporting || !apiId}
          className="export-button export-button-json"
        >
          {exporting ? 'エクスポート中...' : 'JSONでエクスポート'}
        </button>
      </div>
      {error && (
        <div className="export-error">
          {error}
        </div>
      )}
    </div>
  );
};
