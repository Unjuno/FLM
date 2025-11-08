// SettingsExport - 設定エクスポート・インポートコンポーネント

import React, { useState, useRef, useTransition } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { logger } from '../../utils/logger';
import './SettingsExport.css';

/**
 * 設定エクスポート・インポートコンポーネントのプロパティ
 */
interface SettingsExportProps {
  selectedApiIds?: string[];
  onImportComplete?: (result: {
    imported: number;
    skipped: number;
    renamed: number;
    errors: string[];
  }) => void;
}

/**
 * 設定エクスポート・インポートコンポーネント
 * API設定をJSON形式でエクスポート・インポートします
 */
export const SettingsExport: React.FC<SettingsExportProps> = ({
  selectedApiIds,
  onImportComplete,
}) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  /**
   * 設定をエクスポート
   */
  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);
      setSuccessMessage(null);

      // export_api_settings IPCコマンドを呼び出し
      const jsonData = await safeInvoke<string>('export_api_settings', {
        request: {
          api_ids:
            selectedApiIds && selectedApiIds.length > 0 ? selectedApiIds : null,
        },
      });

      // Blob URLを使用してファイルをダウンロード
      const blob = new Blob([jsonData], {
        type: 'application/json;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const apiCount =
        selectedApiIds && selectedApiIds.length > 0
          ? selectedApiIds.length
          : 'all';
      link.download = `api-settings-${apiCount}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const apiCountText =
        selectedApiIds && selectedApiIds.length > 0
          ? `${selectedApiIds.length}件`
          : 'すべて';
      setSuccessMessage(`${apiCountText}のAPI設定をエクスポートしました`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'エクスポートに失敗しました'
      );
      logger.error('設定エクスポートエラー', err, 'SettingsExport');
    } finally {
      setExporting(false);
    }
  };

  /**
   * ファイル選択ダイアログを開く
   */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 設定をインポート
   */
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccessMessage(null);

      // ファイルを読み込み
      const fileContent = await file.text();

      // JSONの形式チェック（簡易）
      try {
        JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('無効なJSONファイルです');
      }

      // インポートを実行（デフォルトでskip方式を使用）
      await handleImportWithResolutionDirectly(fileContent, 'skip');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'インポートに失敗しました');
      logger.error('設定インポートエラー', err, 'SettingsExport');

      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setImporting(false);
      return;
    }
  };

  /**
   * インポートを実行（直接呼び出し用）
   */
  const handleImportWithResolutionDirectly = async (
    fileContent: string,
    conflictResolution: string
  ) => {
    try {
      setImporting(true);
      setError(null);
      setSuccessMessage(null);

      // import_api_settings IPCコマンドを呼び出し
      const result = await safeInvoke<{
        imported: number;
        skipped: number;
        renamed: number;
        errors: string[];
      }>('import_api_settings', {
        request: {
          json_data: fileContent,
          conflict_resolution: conflictResolution,
        },
      });

      // 結果を表示
      const messages: string[] = [];
      if (result.imported > 0) {
        messages.push(`${result.imported}件をインポート`);
      }
      if (result.skipped > 0) {
        messages.push(`${result.skipped}件をスキップ`);
      }
      if (result.renamed > 0) {
        messages.push(`${result.renamed}件をリネーム`);
      }
      if (result.errors.length > 0) {
        messages.push(`エラー: ${result.errors.length}件`);
        logger.error('インポートエラー', result.errors, 'SettingsExport');
      }

      if (messages.length > 0) {
        setSuccessMessage(messages.join(', '));
      } else {
        setSuccessMessage('インポートが完了しました');
      }

      // コールバックを呼び出し
      if (onImportComplete) {
        onImportComplete(result);
      }

      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'インポートに失敗しました');
      logger.error('設定インポートエラー', err, 'SettingsExport');

      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="settings-export">
      <div className="settings-export-buttons">
        <button
          onClick={() => {
            startTransition(() => {
              handleExport();
            });
          }}
          disabled={exporting || isPending}
          className="export-button settings-export-button"
          title={
            selectedApiIds && selectedApiIds.length > 0
              ? `選択した${selectedApiIds.length}件のAPI設定をエクスポート`
              : 'すべてのAPI設定をエクスポート'
          }
        >
          {exporting ? 'エクスポート中...' : '設定をエクスポート'}
        </button>
        <button
          onClick={handleImportClick}
          disabled={importing}
          className="import-button settings-import-button"
          title="JSONファイルからAPI設定をインポート"
        >
          {importing ? 'インポート中...' : '設定をインポート'}
        </button>
        <input
          id="settings-import-file"
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="file-input-hidden"
          aria-label="API設定JSONファイルを選択"
        />
      </div>
      {error && <div className="settings-export-error">{error}</div>}
      {successMessage && (
        <div className="settings-export-success">{successMessage}</div>
      )}
    </div>
  );
};
