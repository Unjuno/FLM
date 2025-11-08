// ProgressDisplay - 汎用的な進捗表示コンポーネント
// 長時間処理の進捗を表示します（残り時間、処理ステップ、キャンセルボタン付き）

import React, { useRef, useEffect, useMemo } from 'react';
import './ProgressDisplay.css';

/**
 * 進捗ステップ情報
 */
export interface ProgressStep {
  /** ステップ名 */
  label: string;
  /** 完了状態 */
  completed: boolean;
  /** 現在実行中かどうか */
  active?: boolean;
}

/**
 * 進捗情報
 */
export interface ProgressInfo {
  /** 現在のステップ名 */
  step: string;
  /** 進捗率（0-100） */
  progress: number;
  /** 処理ステップの詳細リスト */
  steps?: ProgressStep[];
  /** 残り時間（秒） */
  remainingTime?: number;
  /** 開始時刻（ミリ秒） */
  startTime?: number;
  /** 現在の速度（処理単位/秒） */
  speed?: number;
  /** 総処理量 */
  total?: number;
  /** 現在の処理量 */
  current?: number;
}

/**
 * 進捗表示コンポーネントのプロパティ
 */
export interface ProgressDisplayProps {
  /** 進捗情報 */
  progress: ProgressInfo;
  /** キャンセルボタンのクリックハンドラ */
  onCancel?: () => void;
  /** タイトル（デフォルト: "処理中..."） */
  title?: string;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * 汎用的な進捗表示コンポーネント
 */
export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  progress,
  onCancel,
  title = '処理中...',
  className = '',
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressPercent = Math.min(Math.max(Math.round(progress.progress), 0), 100);

  // プログレスバーの幅を更新
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.setProperty(
        '--progress',
        `${progressPercent}%`
      );
    }
  }, [progressPercent]);

  // 残り時間をフォーマット
  const formattedRemainingTime = useMemo(() => {
    if (progress.remainingTime === undefined || progress.remainingTime < 0) {
      return '計算中...';
    }

    const seconds = Math.floor(progress.remainingTime);
    if (seconds < 60) {
      return `${seconds}秒`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}分${remainingSeconds}秒`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}時間${remainingMinutes}分`;
  }, [progress.remainingTime]);

  // 処理量をフォーマット
  const formattedAmount = useMemo(() => {
    if (progress.current === undefined || progress.total === undefined) {
      return null;
    }
    return `${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`;
  }, [progress.current, progress.total]);

  // 速度をフォーマット
  const formattedSpeed = useMemo(() => {
    if (progress.speed === undefined) {
      return null;
    }
    return `${progress.speed.toFixed(1)}/秒`;
  }, [progress.speed]);

  return (
    <div className={`progress-display ${className}`}>
      <div className="progress-container">
        <div className="progress-header">
          <div className="progress-icon">
            <div className="spinner"></div>
          </div>
          <h2>{title}</h2>
          {onCancel && (
            <button
              className="progress-cancel-button"
              onClick={onCancel}
              aria-label="処理をキャンセル"
            >
              キャンセル
            </button>
          )}
        </div>

        <p className="progress-step">{progress.step}</p>

        <div className="progress-bar-container">
          <div
            ref={progressBarRef}
            className="progress-bar"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`進捗: ${progressPercent}%`}
          ></div>
        </div>
        <div className="progress-percentage">{progressPercent}%</div>

        {/* 詳細情報 */}
        <div className="progress-details">
          {formattedAmount && (
            <div className="progress-detail-item">
              <span className="detail-label">処理量:</span>
              <span className="detail-value">{formattedAmount}</span>
            </div>
          )}
          {formattedSpeed && (
            <div className="progress-detail-item">
              <span className="detail-label">速度:</span>
              <span className="detail-value">{formattedSpeed}</span>
            </div>
          )}
          {progress.remainingTime !== undefined && (
            <div className="progress-detail-item">
              <span className="detail-label">残り時間:</span>
              <span className="detail-value">{formattedRemainingTime}</span>
            </div>
          )}
        </div>

        {/* 処理ステップの詳細表示 */}
        {progress.steps && progress.steps.length > 0 && (
          <div className="progress-steps">
            {progress.steps.map((step, index) => (
              <div
                key={index}
                className={`progress-step-item ${
                  step.completed ? 'completed' : ''
                } ${step.active ? 'active' : ''}`}
              >
                <span className="step-number">{index + 1}</span>
                <span className="step-label">{step.label}</span>
                {step.completed && (
                  <span className="step-checkmark" aria-hidden="true">
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

