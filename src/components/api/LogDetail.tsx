// LogDetail - ログ詳細表示コンポーネント

import React, { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { HTTP_STATUS, TIMEOUT } from '../../constants/config';
import {
  formatDateTime,
  formatResponseTime,
  formatJSON,
} from '../../utils/formatters';
import { logger } from '../../utils/logger';
import './LogDetail.css';

/**
 * リクエストログ情報
 */
export interface RequestLogInfo {
  id: string;
  api_id: string;
  method: string;
  path: string;
  request_body: string | null;
  response_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

/**
 * ログ詳細モーダルコンポーネントのプロパティ
 */
interface LogDetailProps {
  log: RequestLogInfo | null;
  onClose: () => void;
}

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
 * ログ詳細モーダルコンポーネント
 * リクエストログの詳細情報を表示します
 */
export const LogDetail: React.FC<LogDetailProps> = ({ log, onClose }) => {
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // フォーカストラップの実装
  useEffect(() => {
    if (!log) return;

    // モーダルが開いたときの処理
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 最初のフォーカス可能な要素にフォーカスを移動
    const modal = modalRef.current;
    if (modal) {
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    // フォーカストラップのハンドラー
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(
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
        onClose();
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
  }, [log, onClose]);

  // JSONをフォーマット（メモ化）
  const formattedRequestBody = useMemo(
    () => formatJSON(log?.request_body || null),
    [log?.request_body]
  );

  // コピー機能
  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), TIMEOUT.COPY_NOTIFICATION);
    } catch (err) {
      logger.error(
        'コピーに失敗しました',
        err instanceof Error ? err : new Error(String(err)),
        'LogDetail'
      );
    }
  };

  if (!log) return null;

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      onClose();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="log-detail-overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={modalRef}
        className="log-detail-modal"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>ログ詳細</h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="modal-content">
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
                <span
                  className={`method-badge method-${log.method.toLowerCase()}`}
                >
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
              onClick={() => setActiveTab('request')}
            >
              リクエスト
            </button>
            <button
              className={`tab-button ${activeTab === 'response' ? 'active' : ''}`}
              onClick={() => setActiveTab('response')}
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
                        handleCopy(formattedRequestBody, 'request');
                      });
                    }}
                    disabled={isPending}
                  >
                    {copiedField === 'request'
                      ? '✓ コピーしました'
                      : '📋 コピー'}
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
        </div>

        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
