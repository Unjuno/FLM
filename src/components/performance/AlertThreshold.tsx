// AlertThreshold - アラート閾値設定コンポーネント

import React from 'react';
import './AlertThreshold.css';

/**
 * アラート閾値設定のプロパティ
 */
export interface AlertThresholdProps {
  /** メトリクスタイプ */
  type: 'response_time' | 'error_rate' | 'cpu_usage' | 'memory_usage';
  /** 現在の閾値 */
  threshold: number;
  /** 閾値変更ハンドラー */
  onChange: (value: number) => void;
  /** 有効化フラグ */
  enabled: boolean;
  /** 有効化変更ハンドラー */
  onEnabledChange: (enabled: boolean) => void;
  /** 最小値 */
  min?: number;
  /** 最大値 */
  max?: number;
  /** 単位 */
  unit?: string;
}

/**
 * アラート閾値設定コンポーネント
 */
export const AlertThreshold: React.FC<AlertThresholdProps> = ({
  type,
  threshold,
  onChange,
  enabled,
  onEnabledChange,
  min,
  max,
  unit = '',
}) => {
  // タイプに応じたデフォルト値
  const defaults = {
    response_time: { min: 100, max: 60000, unit: 'ms', label: 'レスポンス時間' },
    error_rate: { min: 0, max: 100, unit: '%', label: 'エラー率' },
    cpu_usage: { min: 0, max: 100, unit: '%', label: 'CPU使用率' },
    memory_usage: { min: 0, max: 100, unit: '%', label: 'メモリ使用率' },
  };

  const config = defaults[type];
  const minValue = min ?? config.min;
  const maxValue = max ?? config.max;
  const displayUnit = unit || config.unit;

  // エラー率の場合は0-1の範囲で扱うが、表示は0-100%で行う
  const displayValue = type === 'error_rate' ? threshold * 100 : threshold;
  const handleDisplayChange = (value: number) => {
    if (type === 'error_rate') {
      onChange(value / 100); // 0-1の範囲に変換
    } else {
      onChange(value);
    }
  };

  return (
    <div className="alert-threshold">
      <div className="alert-threshold-header">
        <label className="alert-threshold-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="alert-threshold-checkbox"
          />
          <span>{config.label}</span>
        </label>
      </div>
      {enabled && (
        <div className="alert-threshold-controls">
          <input
            type="number"
            min={type === 'error_rate' ? minValue * 100 : minValue}
            max={type === 'error_rate' ? maxValue * 100 : maxValue}
            step={type === 'error_rate' ? 0.1 : type === 'response_time' ? 100 : 1}
            value={displayValue}
            onChange={(e) => handleDisplayChange(parseFloat(e.target.value) || 0)}
            className="alert-threshold-input"
            disabled={!enabled}
            aria-label={`${config.label}の閾値`}
            title={`${config.label}の閾値を設定`}
          />
          <span className="alert-threshold-unit">{displayUnit}</span>
          <input
            type="range"
            min={type === 'error_rate' ? minValue * 100 : minValue}
            max={type === 'error_rate' ? maxValue * 100 : maxValue}
            step={type === 'error_rate' ? 0.1 : type === 'response_time' ? 100 : 1}
            value={displayValue}
            onChange={(e) => handleDisplayChange(parseFloat(e.target.value) || 0)}
            className="alert-threshold-slider"
            disabled={!enabled}
            aria-label={`${config.label}のスライダー`}
            title={`${config.label}の閾値をスライダーで設定`}
          />
        </div>
      )}
    </div>
  );
};

