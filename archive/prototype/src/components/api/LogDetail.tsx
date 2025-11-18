// LogDetail - ログ詳細表示コンポーネント

import React, { useState, useRef } from 'react';
import { TIMEOUT } from '../../constants/config';
import { logger } from '../../utils/logger';
import { copyToClipboard } from '../../utils/clipboard';
import { extractErrorMessage } from '../../utils/errorHandler';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import { LogDetailContent } from './LogDetailContent';

type LogDetailTab = 'request' | 'response';
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
 * ログ詳細モーダルコンポーネント
 * リクエストログの詳細情報を表示します
 */
export const LogDetail: React.FC<LogDetailProps> = ({ log, onClose }) => {
  const [activeTab, setActiveTab] = useState<LogDetailTab>('request');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // フォーカストラップの実装
  useModalFocusTrap(!!log, onClose, modalRef);

  // コピー機能
  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await copyToClipboard(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), TIMEOUT.COPY_NOTIFICATION);
    } catch (err) {
      logger.error(
        'コピーに失敗しました',
        err instanceof Error ? err : new Error(extractErrorMessage(err)),
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
          <LogDetailContent
            log={log}
            activeTab={activeTab}
            onCopy={handleCopy}
            copiedField={copiedField}
            onTabChange={setActiveTab}
          />
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
