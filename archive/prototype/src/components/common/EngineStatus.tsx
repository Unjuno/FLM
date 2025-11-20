// EngineStatus - 複数エンジンのステータス表示コンポーネント

import React, { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { logger } from '../../utils/logger';
import { extractErrorMessage } from '../../utils/errorHandler';
import './EngineStatus.css';

/**
 * エンジン名のマッピング
 */
export const ENGINE_NAMES: { [key: string]: string } = {
  ollama: 'Ollama',
  lm_studio: 'LM Studio',
  vllm: 'vLLM',
  llama_cpp: 'llama.cpp',
};

/**
 * エンジン検出結果の型定義
 */
export interface EngineDetectionResult {
  engine_type: string;
  installed: boolean;
  running: boolean;
  version?: string | null;
  path?: string | null;
  message?: string | null;
}

/**
 * エンジンステータスコンポーネントのプロパティ
 */
interface EngineStatusProps {
  /** 表示するエンジンタイプのリスト（省略時はすべて） */
  engineTypes?: string[];
  /** 自動検出を有効にするか */
  autoDetect?: boolean;
  /** 検出間隔（ミリ秒、0の場合は検出しない） */
  refreshInterval?: number;
}

/**
 * エンジンステータスコンポーネント
 * 複数のLLMエンジンの状態を表示します
 */
export const EngineStatus: React.FC<EngineStatusProps> = ({
  engineTypes = ['ollama', 'lm_studio', 'vllm', 'llama_cpp'],
  autoDetect = true,
  refreshInterval = 0,
}) => {
  const [detectionResults, setDetectionResults] = useState<
    Record<string, EngineDetectionResult | null>
  >({});
  const [detecting, setDetecting] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // エンジンを検出する関数
  const detectEngine = useCallback(async (engineType: string) => {
    setDetecting(prev => ({ ...prev, [engineType]: true }));
    setErrors(prev => ({ ...prev, [engineType]: null }));

    try {
      const result = await safeInvoke<EngineDetectionResult>('detect_engine', {
        engineType,
      });

      setDetectionResults(prev => ({
        ...prev,
        [engineType]: result,
      }));

      logger.info(
        `${ENGINE_NAMES[engineType] || engineType}の検出完了`,
        JSON.stringify(result),
        'EngineStatus'
      );
    } catch (err) {
      const errorMessage = extractErrorMessage(
        err,
        `${ENGINE_NAMES[engineType] || engineType}の検出に失敗しました`
      );
      setErrors(prev => ({
        ...prev,
        [engineType]: errorMessage,
      }));
      setDetectionResults(prev => ({
        ...prev,
        [engineType]: null,
      }));

      logger.error(
        `${ENGINE_NAMES[engineType] || engineType}の検出エラー`,
        err,
        'EngineStatus'
      );
    } finally {
      setDetecting(prev => ({ ...prev, [engineType]: false }));
    }
  }, []);

  // すべてのエンジンを検出
  const detectAllEngines = useCallback(async () => {
    const promises = engineTypes.map(engineType => detectEngine(engineType));
    await Promise.all(promises);
  }, [engineTypes, detectEngine]);

  // 初回検出
  useEffect(() => {
    if (autoDetect) {
      detectAllEngines();
    }
  }, [autoDetect, detectAllEngines]);

  // 定期更新
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        detectAllEngines();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, detectAllEngines]);

  // ステータスアイコンを取得
  const getStatusIcon = (result: EngineDetectionResult | null): string => {
    if (!result) return '❓';
    if (result.running) return '✅';
    if (result.installed) return '⚠️';
    return '❌';
  };

  // ステータスクラスを取得
  const getStatusClass = (result: EngineDetectionResult | null): string => {
    if (!result) return 'status unknown';
    if (result.running) return 'status success';
    if (result.installed) return 'status warning';
    return 'status error';
  };

  // ステータステキストを取得
  const getStatusText = (result: EngineDetectionResult | null): string => {
    if (!result) return '検出中...';
    if (result.running) return '稼働中';
    if (result.installed) return 'インストール済み（停止中）';
    return '未インストール';
  };

  return (
    <div className="engine-status">
      <div className="engine-status-grid">
        {engineTypes.map(engineType => {
          const engineName = ENGINE_NAMES[engineType] || engineType;
          const result = detectionResults[engineType];
          const isDetecting = detecting[engineType] || false;
          const error = errors[engineType];

          return (
            <div key={engineType} className="engine-status-card">
              <div className="engine-status-header">
                <span className="engine-status-icon">
                  {isDetecting ? '🔄' : getStatusIcon(result)}
                </span>
                <div className="engine-status-info">
                  <h3 className="engine-status-name">{engineName}</h3>
                  <p
                    className={`engine-status-state ${getStatusClass(result)}`}
                  >
                    {isDetecting ? '検出中...' : getStatusText(result)}
                  </p>
                </div>
              </div>

              {result && (
                <div className="engine-status-details">
                  {result.version && (
                    <div className="engine-status-detail">
                      <span className="detail-label">バージョン:</span>
                      <span className="detail-value">{result.version}</span>
                    </div>
                  )}
                  {result.path && (
                    <div className="engine-status-detail">
                      <span className="detail-label">パス:</span>
                      <span className="detail-value">{result.path}</span>
                    </div>
                  )}
                  {result.message && (
                    <div className="engine-status-message">
                      {result.message}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="engine-status-error">
                  <p className="error-text">{error}</p>
                  <button
                    className="retry-button"
                    onClick={() => detectEngine(engineType)}
                    disabled={isDetecting}
                  >
                    {isDetecting ? '検出中...' : '再検出'}
                  </button>
                </div>
              )}

              {!error && !isDetecting && (
                <button
                  className="refresh-button"
                  onClick={() => detectEngine(engineType)}
                  disabled={isDetecting}
                  title="状態を更新"
                >
                  🔄 更新
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
