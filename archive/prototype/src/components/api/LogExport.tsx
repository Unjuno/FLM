// LogExport - ログエクスポートコンポーネント

import React, {
  useState,
  useCallback,
  useTransition,
  useEffect,
  useRef,
} from 'react';
import { safeInvoke } from '../../utils/tauri';
import { Tooltip } from '../common/Tooltip';
import { exportLogsToPdf } from '../../utils/pdfExport';
import { logger } from '../../utils/logger';
import { extractErrorMessage } from '../../utils/errorHandler';
import { ConfirmDialog } from '../common/ConfirmDialog';

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
  include_request_body?: boolean;
  mask_request_body?: boolean;
  encrypt?: boolean;
  password?: string | null;
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
import { HTTP_STATUS } from '../../constants/config';

const DEFAULT_ERROR_CODES: number[] = [...HTTP_STATUS.DEFAULT_ERROR_CODES];
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
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [includeRequestBody, setIncludeRequestBody] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'csv' | 'json' | null>(
    null
  );
  const [encryptFile, setEncryptFile] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const warningDialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  // 確認ダイアログの状態
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // ESCキー処理はConfirmDialogコンポーネント内で処理されるため削除

  /**
   * ステータスコードをフィルタリング
   */
  const getFilteredStatusCodes = useCallback((): number[] | null => {
    if (filter.errorsOnly) {
      const errorCodes =
        filter.statusCodes.length > 0
          ? filter.statusCodes.filter(
              code => code >= HTTP_STATUS.MIN_ERROR_CODE
            )
          : [...DEFAULT_ERROR_CODES];
      return errorCodes.length > 0 ? errorCodes : [...DEFAULT_ERROR_CODES];
    }
    return filter.statusCodes.length > 0 ? filter.statusCodes : null;
  }, [filter.errorsOnly, filter.statusCodes]);

  /**
   * エクスポートリクエストを構築
   */
  const buildExportRequest = useCallback(
    (format: string, includeBody: boolean = false): ExportRequest => {
      return {
        api_id: apiId,
        format,
        start_date: filter.startDate || null,
        end_date: filter.endDate || null,
        status_codes: getFilteredStatusCodes(),
        path_filter: filter.pathFilter || null,
        include_request_body: includeBody,
        mask_request_body: includeBody, // デフォルトでマスク処理を有効化
        encrypt: encryptFile,
        password: encryptFile && encryptionPassword ? encryptionPassword : null,
      };
    },
    [apiId, filter, getFilteredStatusCodes, encryptFile, encryptionPassword]
  );

  /**
   * ファイルをダウンロード
   */
  const downloadFile = useCallback((data: string, format: string): void => {
    // 暗号化ファイルの場合はMIMEタイプをapplication/octet-streamに設定
    const mimeType = format.endsWith('.encrypted')
      ? 'application/octet-stream'
      : format === 'csv'
        ? MIME_TYPES.csv
        : MIME_TYPES.json;

    const blob = new Blob([data], {
      type: mimeType,
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
  const exportToFile = useCallback(
    async (
      format: 'csv' | 'json',
      includeBody: boolean = false
    ): Promise<void> => {
      if (!apiId) {
        setError(ERROR_MESSAGES.NO_API);
        return;
      }

      try {
        setExporting(true);
        setError(null);

        const request = buildExportRequest(format, includeBody);
        const response = await safeInvoke<ExportResponse>('export_logs', {
          request,
        });

        // 暗号化されている場合は拡張子を変更
        const fileFormat = request.encrypt ? `${format}.encrypted` : format;
        downloadFile(response.data, fileFormat);

        logger.info(
          `ログデータをエクスポートしました: ${response.count}件 (${format.toUpperCase()})`,
          'LogExport'
        );

        if (onExportComplete) {
          onExportComplete(response.count);
        }
      } catch (err) {
        const errorMessage = extractErrorMessage(
          err,
          ERROR_MESSAGES.EXPORT_FAILED
        );
        setError(errorMessage);
        logger.error('ログエクスポートエラー', err, 'LogExport');
      } finally {
        setExporting(false);
        setShowWarning(false);
        setPendingFormat(null);
      }
    },
    [apiId, buildExportRequest, downloadFile, onExportComplete]
  );

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
      const errorMessage = extractErrorMessage(
        err,
        ERROR_MESSAGES.PDF_EXPORT_FAILED
      );
      setError(errorMessage);
      logger.error('PDFエクスポートエラー', err, 'LogExport');
    } finally {
      setExporting(false);
    }
  }, []);

  /**
   * ログデータをエクスポートします（警告表示付き）
   */
  const handleExport = useCallback(
    async (format: 'csv' | 'json' | 'pdf'): Promise<void> => {
      if (format === 'pdf') {
        await exportToPdf();
        return;
      }

      // 暗号化が有効な場合、パスワードを確認
      if (
        encryptFile &&
        (!encryptionPassword || encryptionPassword.length < 8)
      ) {
        setError(
          '暗号化を有効にする場合は、8文字以上のパスワードを入力してください。'
        );
        return;
      }

      // リクエストボディを含める場合、警告を表示
      if (includeRequestBody) {
        setPendingFormat(format);
        setShowWarning(true);
        return;
      }

      // 警告を表示（機密情報が含まれる可能性があることを通知）
      const warningMessage =
        '⚠️ プライバシー警告\n\n' +
        'エクスポートされるログデータには機密情報が含まれる可能性があります。\n' +
        'リクエストボディはデフォルトで除外されていますが、エクスポートファイルには\n' +
        'API ID、パス、エラーメッセージなどの情報が含まれます。\n\n' +
        (encryptFile ? 'ファイルは暗号化されます。\n\n' : '') +
        'エクスポートを続行しますか？';

      setConfirmDialog({
        isOpen: true,
        message: warningMessage,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          await exportToFile(format, false);
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        },
      });
    },
    [
      includeRequestBody,
      encryptFile,
      encryptionPassword,
      exportToPdf,
      exportToFile,
    ]
  );

  /**
   * 警告ダイアログで確認された場合のエクスポート実行
   */
  const handleConfirmExport = useCallback(() => {
    if (pendingFormat) {
      // 暗号化が有効な場合、パスワードを確認
      if (
        encryptFile &&
        (!encryptionPassword || encryptionPassword.length < 8)
      ) {
        setError(
          '暗号化を有効にする場合は、8文字以上のパスワードを入力してください。'
        );
        setShowWarning(false);
        setPendingFormat(null);
        return;
      }
      exportToFile(pendingFormat, includeRequestBody);
    }
  }, [
    pendingFormat,
    includeRequestBody,
    encryptFile,
    encryptionPassword,
    exportToFile,
  ]);

  /**
   * 警告ダイアログをキャンセル
   */
  const handleCancelExport = useCallback(() => {
    setShowWarning(false);
    setPendingFormat(null);
  }, []);

  // 警告ダイアログのフォーカストラップ実装
  useEffect(() => {
    if (!showWarning) return;

    // モーダルが開いたときの処理
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 最初のフォーカス可能な要素にフォーカスを移動
    const dialog = warningDialogRef.current;
    if (dialog) {
      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    // フォーカストラップのハンドラー
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: 逆方向
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: 順方向
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // ESCキーで閉じる
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelExport();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);

    // クリーンアップ: モーダルが閉じたときに元の要素にフォーカスを戻す
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [showWarning, handleCancelExport]);

  const isDisabled = exporting || !apiId;
  const buttonText = exporting ? 'エクスポート中...' : '';

  return (
    <div className="log-export">
      {/* エクスポートオプション */}
      <div className="log-export-options">
        <label className="log-export-option-label">
          <input
            type="checkbox"
            checked={includeRequestBody}
            onChange={e => setIncludeRequestBody(e.target.checked)}
            disabled={isDisabled}
            aria-label="リクエストボディを含める（機密情報が含まれる可能性があります）"
          />
          <span>
            リクエストボディを含める
            <Tooltip
              content="リクエストボディには機密情報（APIキー、パスワードなど）が含まれる可能性があります。含める場合は自動的にマスク処理されます。"
              position="top"
            >
              <span className="tooltip-trigger-icon">ℹ️</span>
            </Tooltip>
          </span>
        </label>
        <label className="log-export-option-label">
          <input
            type="checkbox"
            checked={encryptFile}
            onChange={e => {
              setEncryptFile(e.target.checked);
              if (!e.target.checked) {
                setEncryptionPassword('');
              }
            }}
            disabled={isDisabled}
            aria-label="エクスポートファイルを暗号化する"
          />
          <span>
            ファイルを暗号化する
            <Tooltip
              content="エクスポートファイルをパスワードで暗号化します。機密情報を含む場合に推奨されます。"
              position="top"
            >
              <span className="tooltip-trigger-icon">🔒</span>
            </Tooltip>
          </span>
        </label>
        {encryptFile && (
          <div className="log-export-password-input">
            <label htmlFor="encryption-password">
              暗号化パスワード:
              <input
                id="encryption-password"
                type="password"
                value={encryptionPassword}
                onChange={e => setEncryptionPassword(e.target.value)}
                disabled={isDisabled}
                placeholder="パスワードを入力"
                aria-label="暗号化パスワード"
                minLength={8}
              />
            </label>
            <span className="log-export-password-hint">
              8文字以上のパスワードを入力してください。このパスワードは復号時に必要です。
            </span>
          </div>
        )}
      </div>

      <div className="log-export-buttons">
        <Tooltip
          content="現在のフィルタ条件に一致するログをCSV形式でエクスポートします。Excelなどで開いて分析できます。"
          position="top"
        >
          <button
            onClick={() => {
              startTransition(() => {
                handleExport('csv');
              });
            }}
            disabled={isDisabled || isPending}
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
            onClick={() => {
              startTransition(() => {
                handleExport('json');
              });
            }}
            disabled={isDisabled || isPending}
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
            onClick={() => {
              startTransition(() => {
                handleExport('pdf');
              });
            }}
            disabled={isDisabled || isPending}
            className="export-button export-button-pdf"
            aria-label="PDF形式でログをエクスポート"
          >
            {buttonText || 'PDFでエクスポート'}
          </button>
        </Tooltip>
      </div>

      {/* 警告ダイアログ */}
      {showWarning && (
        <div
          className="log-export-warning-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div ref={warningDialogRef} className="log-export-warning-dialog">
            <div className="log-export-warning-header">
              <h3>⚠️ プライバシー警告</h3>
            </div>
            <div className="log-export-warning-content">
              <p>リクエストボディを含めてエクスポートしようとしています。</p>
              <p>
                <strong>注意事項：</strong>
              </p>
              <ul>
                <li>
                  リクエストボディには機密情報（APIキー、パスワード、トークンなど）が含まれる可能性があります
                </li>
                <li>
                  機密情報は自動的にマスク処理されますが、完全な保護を保証するものではありません
                </li>
                <li>
                  エクスポートファイルは適切に管理し、不要になったら削除してください
                </li>
                <li>
                  エクスポートファイルを共有する際は、機密情報が含まれていないことを確認してください
                </li>
              </ul>
              <p>本当にリクエストボディを含めてエクスポートしますか？</p>
            </div>
            <div className="log-export-warning-actions">
              <button
                onClick={handleCancelExport}
                className="log-export-warning-button log-export-warning-button-cancel"
                disabled={exporting}
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmExport}
                className="log-export-warning-button log-export-warning-button-confirm"
                disabled={exporting}
              >
                {exporting ? 'エクスポート中...' : 'エクスポートを続行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="export-error" role="alert">
          {error}
        </div>
      )}

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        title="確認"
        confirmLabel="確認"
        cancelLabel="キャンセル"
        confirmVariant="primary"
      />
    </div>
  );
};
