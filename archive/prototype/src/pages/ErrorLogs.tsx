// ErrorLogs - エラーログ一覧ページ

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import { extractErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { copyToClipboard } from '../utils/clipboard';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import {
  ErrorLogFilters,
  type ErrorLogFilters as ErrorLogFiltersType,
} from '../components/errorLogs/ErrorLogFilters';
import {
  ErrorLogExport,
  type ExportFormat,
} from '../components/errorLogs/ErrorLogExport';
import {
  ErrorLogStatistics,
  type ErrorLogInfo,
} from '../components/errorLogs/ErrorLogStatistics';
import { ErrorLogList } from '../components/errorLogs/ErrorLogList';
import './ErrorLogs.css';

/**
 * エラーログ一覧ページ
 */
export const ErrorLogs: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<ErrorLogFiltersType>({
    error_category: '',
    api_id: '',
    start_date: '',
    end_date: '',
  });

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('header.settings') || '設定', path: '/settings' },
      { label: t('errorLogs.title') || 'エラーログ' },
    ],
    [t]
  );

  // エラーログ一覧を取得する非同期操作
  const loadErrorLogsOperation = useCallback(async (): Promise<
    ErrorLogInfo[]
  > => {
    return await safeInvoke<ErrorLogInfo[]>('list_error_logs', {
      error_category: filters.error_category || null,
      api_id: filters.api_id || null,
      limit: 1000, // 最大1000件
      offset: 0,
      start_date: filters.start_date || null,
      end_date: filters.end_date || null,
    });
  }, [filters]);

  // 非同期操作フックを使用
  const {
    data: errorLogsData,
    loading,
    error,
    execute: loadErrorLogs,
    clearError,
  } = useAsyncOperation<ErrorLogInfo[]>(loadErrorLogsOperation, {
    autoExecute: false,
    logErrors: true,
    context: 'ErrorLogs',
  });

  // エラーログデータ（デフォルトは空配列）
  const errorLogs = useMemo(() => errorLogsData || [], [errorLogsData]);

  // 初回読み込みとフィルター変更時の再読み込み
  useEffect(() => {
    loadErrorLogs();
  }, [loadErrorLogs]);

  // エラーログをエクスポート
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      try {
        setExporting(true);
        clearError();

        const filePath = await safeInvoke<string>('export_error_logs', {
          format,
          error_category: filters.error_category || null,
          api_id: filters.api_id || null,
          start_date: filters.start_date || null,
          end_date: filters.end_date || null,
        });

        logger.info(
          `エラーログをエクスポートしました: ${filePath}`,
          '',
          'ErrorLogs'
        );

        // ファイルパスをクリップボードにコピー
        await copyToClipboard(filePath);
        showSuccess(
          `エラーログをエクスポートしました。ファイルパスをクリップボードにコピーしました。`
        );
      } catch (err) {
        const errorMessage = extractErrorMessage(
          err,
          'エラーログのエクスポートに失敗しました'
        );
        logger.error('エラーログのエクスポートエラー', err, 'ErrorLogs');
        showError('エクスポートに失敗しました', errorMessage);
      } finally {
        setExporting(false);
      }
    },
    [filters, clearError, showSuccess, showError]
  );

  // フィルタークリア
  const handleClearFilters = useCallback(() => {
    setFilters({
      error_category: '',
      api_id: '',
      start_date: '',
      end_date: '',
    });
  }, []);

  return (
    <AppLayout>
      <div className="error-logs-page">
        <div className="page-container error-logs-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header error-logs-header">
            <button
              className="back-button"
              onClick={() => navigate('/settings')}
            >
              ← 設定に戻る
            </button>
            <h1>エラーログ</h1>
            <ErrorLogExport
              exporting={exporting}
              hasLogs={errorLogs.length > 0}
              onExport={handleExport}
              onRefresh={loadErrorLogs}
            />
          </header>

          {error && (
            <ErrorMessage message={error} type="general" onClose={clearError} />
          )}

          <ErrorLogStatistics errorLogs={errorLogs} />

          <ErrorLogFilters
            filters={filters}
            onFiltersChange={setFilters}
            onApply={loadErrorLogs}
            onClear={handleClearFilters}
          />

          <section className="logs-section">
            <h2>エラーログ一覧 ({errorLogs.length}件)</h2>
            <ErrorLogList errorLogs={errorLogs} loading={loading} />
          </section>
        </div>
      </div>
    </AppLayout>
  );
};
