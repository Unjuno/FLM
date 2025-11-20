// ApiOperationProgress - API操作の進捗表示コンポーネント

import React, { useRef, useEffect } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import './ApiOperationProgress.css';

/**
 * API操作の進捗情報
 */
interface ApiOperationProgressProps {
  /** 進捗パーセンテージ（0-100） */
  progress: number;
  /** 進捗ステップのテキスト */
  step: string;
  /** APIの現在のステータス */
  status: 'running' | 'preparing' | 'stopped' | 'error';
}

/**
 * API操作の進捗表示コンポーネント
 * useRefとuseEffectを使用してCSS変数を設定し、インラインスタイルを回避
 */
export const ApiOperationProgress: React.FC<ApiOperationProgressProps> = ({
  progress,
  step,
  status,
}) => {
  const { t } = useI18n();
  const progressFillRef = useRef<HTMLDivElement>(null);

  // 進捗パーセンテージを0-100の範囲に制限
  const progressPercent = Math.min(Math.max(Math.round(progress), 0), 100);

  // 進捗テキストを取得
  const progressText =
    step ||
    (status === 'running'
      ? t('apiList.status.stopping') || '停止中...'
      : status === 'preparing'
        ? t('apiList.status.preparing') || '起動準備中...'
        : t('apiList.status.starting') || '起動中...');

  // CSS変数を設定（インラインスタイルを回避）
  useEffect(() => {
    if (progressFillRef.current) {
      progressFillRef.current.style.setProperty(
        '--progress-width',
        `${progressPercent}%`
      );
    }
  }, [progressPercent]);

  return (
    <div className="api-operation-progress">
      <div className="progress-content">
        <div className="progress-bar">
          <div ref={progressFillRef} className="progress-fill"></div>
        </div>
        <span className="progress-text">{progressText}</span>
      </div>
    </div>
  );
};
