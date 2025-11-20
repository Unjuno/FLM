// ErrorLogExport - エラーログエクスポートコンポーネント

import React from 'react';
import './ErrorLogExport.css';

/**
 * エクスポート形式
 */
export type ExportFormat = 'csv' | 'json' | 'txt';

/**
 * ErrorLogExportのプロパティ
 */
interface ErrorLogExportProps {
  exporting: boolean;
  hasLogs: boolean;
  onExport: (format: ExportFormat) => void;
  onRefresh: () => void;
}

/**
 * エラーログエクスポートコンポーネント
 */
export const ErrorLogExport: React.FC<ErrorLogExportProps> = ({
  exporting,
  hasLogs,
  onExport,
  onRefresh,
}) => {
  return (
    <div className="header-actions">
      <button
        className="export-button"
        onClick={() => onExport('csv')}
        disabled={exporting || !hasLogs}
      >
        {exporting ? 'エクスポート中...' : 'CSVエクスポート'}
      </button>
      <button
        className="export-button"
        onClick={() => onExport('json')}
        disabled={exporting || !hasLogs}
      >
        {exporting ? 'エクスポート中...' : 'JSONエクスポート'}
      </button>
      <button
        className="export-button"
        onClick={() => onExport('txt')}
        disabled={exporting || !hasLogs}
      >
        {exporting ? 'エクスポート中...' : 'TXTエクスポート'}
      </button>
      <button className="refresh-button" onClick={onRefresh}>
        更新
      </button>
    </div>
  );
};
