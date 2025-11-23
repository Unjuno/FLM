// LogDetailContent - ログ詳細のコンテンツコンポーネント

import React, { useMemo, useTransition } from 'react';
import { HTTP_STATUS } from '../../constants/config';
import {
  formatDateTime,
  formatResponseTime,
  formatJSON,
} from '../../utils/formatters';
import type { RequestLogInfo } from './LogDetail';
import './LogDetail.css';

type LogDetailTab = 'request' | 'response';

/**
 * ステータスコードに応じたクラス名を取得
 */
const getStatusClass = (status: number | null): string => {
  if (status === null) return 'status-unknown';
  if (status >= HTTP_STATUS.OK && status < 300) return 'status-success';
  if (status >= 300 && status < HTTP_STATUS.MIN_ERROR_CODE)
    return 'status-redirect';
  if (status >= HTTP_STATUS.MIN_ERROR_CODE && status < 500)
    return 'status-client-error';
  if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) return 'status-server-error';
  return 'status-unknown';
};

/**
 * LogDetailContentのプロパティ
 */
interface LogDetailContentProps {
  log: RequestLogInfo;
  activeTab: LogDetailTab;
  onCopy: (text: string, fieldName: string) => void;
  copiedField: string | null;
  onTabChange: (tab: LogDetailTab) => void;
}

/**
 * ログ詳細のコンテンツコンポーネント
 */
export const LogDetailContent: React.FC<LogDetailContentProps> = ({
  log,
  activeTab,
  onCopy,
  copiedField,
  onTabChange,
}) => {
  const [isPending, startTransition] = useTransition();

  // JSONをフォーマット（メモ化）
  const formattedRequestBody = useMemo(
    () => formatJSON(log?.request_body || null),
    [log?.request_body]
  );

  return (
    <>
      {/* 基本情報 */}
      <section className="detail-section">
        <h3>基本情報</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">ID:</span>
            <span className="detail-value detail-id">{log.id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">メソッド:</span>
            <span className={`method-badge method-${log.method.toLowerCase()}`}>
              {log.method}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">パス:</span>
            <span className="detail-value detail-path">{log.path}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">ステータス:</span>
            <span
              className={`status-badge ${getStatusClass(log.response_status)}`}
            >
              {log.response_status || 'N/A'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">レスポンス時間:</span>
            <span className="detail-value">
              {formatResponseTime(log.response_time_ms)}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">日時:</span>
            <span className="detail-value">
              {formatDateTime(log.created_at)}
            </span>
          </div>
        </div>
        {log.error_message && (
          <div className="error-message-box">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{log.error_message}</span>
          </div>
        )}
      </section>

      {/* タブ切り替え */}
      <div className="tab-container">
        <button
          className={`tab-button ${activeTab === 'request' ? 'active' : ''}`}
          onClick={() => onTabChange('request')}
        >
          リクエスト
        </button>
        <button
          className={`tab-button ${activeTab === 'response' ? 'active' : ''}`}
          onClick={() => onTabChange('response')}
        >
          レスポンス
        </button>
      </div>

      {/* リクエスト情報 */}
      {activeTab === 'request' && (
        <section className="detail-section">
          <div className="section-header">
            <h3>リクエストボディ</h3>
            {formattedRequestBody && (
              <button
                className="copy-button"
                onClick={() => {
                  startTransition(() => {
                    onCopy(formattedRequestBody, 'request');
                  });
                }}
                disabled={isPending}
              >
                {copiedField === 'request' ? '✓ コピーしました' : '📋 コピー'}
              </button>
            )}
          </div>
          {formattedRequestBody ? (
            <pre className="json-viewer">{formattedRequestBody}</pre>
          ) : (
            <p className="empty-content">リクエストボディがありません</p>
          )}
        </section>
      )}

      {/* レスポンス情報 */}
      {activeTab === 'response' && (
        <section className="detail-section">
          <div className="section-header">
            <h3>レスポンス情報</h3>
          </div>
          <div className="response-info">
            <div className="info-row">
              <span className="info-label">ステータスコード:</span>
              <span
                className={`status-badge ${getStatusClass(log.response_status)}`}
              >
                {log.response_status || 'N/A'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">レスポンス時間:</span>
              <span className="info-value">
                {formatResponseTime(log.response_time_ms)}
              </span>
            </div>
            {log.error_message && (
              <div className="info-row">
                <span className="info-label">エラーメッセージ:</span>
                <span className="info-value error-text">
                  {log.error_message}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
};
