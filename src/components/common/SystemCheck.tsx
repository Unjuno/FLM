// SystemCheck - システムリソースチェックコンポーネント

import React, { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { ErrorMessage } from './ErrorMessage';
import { FORMATTING } from '../../constants/config';
import { logger } from '../../utils/logger';
import './SystemCheck.css';

/**
 * システムリソース情報
 */
interface SystemResources {
  total_memory: number;
  available_memory: number;
  cpu_cores: number;
  cpu_usage: number;
  total_disk: number;
  available_disk: number;
  resource_level: string;
}

/**
 * モデル提案情報
 */
interface ModelRecommendation {
  recommended_model: string;
  reason: string;
  alternatives: string[];
  use_case_recommendations: UseCaseRecommendation[];
}

/**
 * 用途別推奨モデル
 */
interface UseCaseRecommendation {
  use_case: string;
  model: string;
  reason: string;
}

/**
 * システムチェックコンポーネントのプロパティ
 */
interface SystemCheckProps {
  onModelSelected?: (modelName: string) => void;
  showRecommendations?: boolean;
}

/**
 * システムチェックコンポーネント
 */
export const SystemCheck: React.FC<SystemCheckProps> = ({
  onModelSelected,
  showRecommendations = true,
}) => {
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // システムリソースを取得
  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // システムリソースを取得
        const resourcesData = await safeInvoke<SystemResources>('get_system_resources');
        setResources(resourcesData);

        // モデル提案を取得
        if (showRecommendations) {
          const recommendationData = await safeInvoke<ModelRecommendation>('get_model_recommendation');
          setRecommendation(recommendationData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'システム情報の取得に失敗しました';
        logger.error('システム情報の取得に失敗しました', err, 'SystemCheck');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadSystemInfo();
  }, [showRecommendations]);

  // バイト数をGBに変換（useCallbackでメモ化）
  const bytesToGB = useCallback((bytes: number): string => {
    return (bytes / FORMATTING.BYTES_PER_GB).toFixed(FORMATTING.DECIMAL_PLACES);
  }, []);

  // リソースレベルのラベルを取得（useCallbackでメモ化）
  const getResourceLevelLabel = useCallback((level: string): string => {
    switch (level) {
      case 'very_high':
        return '非常に高性能';
      case 'high':
        return '高性能';
      case 'medium':
        return '中程度';
      case 'low':
        return '低リソース';
      default:
        return '不明';
    }
  }, []);

  // 用途ラベルを取得（useCallbackでメモ化）
  const getUseCaseLabel = useCallback((useCase: string): string => {
    switch (useCase) {
      case 'chat':
        return 'チャット';
      case 'code':
        return 'コード生成';
      case 'translation':
        return '翻訳';
      case 'general':
        return '汎用';
      default:
        return useCase;
    }
  }, []);

  if (loading) {
    return (
      <div className="system-check-container">
        <div className="system-check-loading">
          <div className="loading-spinner"></div>
          <p>システム情報を取得しています...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-check-container">
        <ErrorMessage
          message={error}
          type="general"
          onClose={() => setError(null)}
        />
      </div>
    );
  }

  if (!resources) {
    return null;
  }

  return (
    <div className="system-check-container">
      <div className="system-check-header">
        <h3>💻 システム情報</h3>
        <div
          className={`resource-level-badge ${resources.resource_level === 'very_high' ? 'very-high' : resources.resource_level === 'high' ? 'high' : resources.resource_level === 'medium' ? 'medium' : resources.resource_level === 'low' ? 'low' : 'unknown'}`}
        >
          {getResourceLevelLabel(resources.resource_level)}
        </div>
      </div>

      <div className="system-resources-grid">
        <div className="resource-item">
          <div className="resource-icon">🧠</div>
          <div className="resource-info">
            <div className="resource-label">メモリ</div>
            <div className="resource-value">
              {bytesToGB(resources.total_memory)} GB
              <span className="resource-detail">
                （利用可能: {bytesToGB(resources.available_memory)} GB）
              </span>
            </div>
          </div>
        </div>

        <div className="resource-item">
          <div className="resource-icon">⚙️</div>
          <div className="resource-info">
            <div className="resource-label">CPU</div>
            <div className="resource-value">
              {resources.cpu_cores} コア
              <span className="resource-detail">
                （使用率: {resources.cpu_usage.toFixed(FORMATTING.DECIMAL_PLACES_SHORT)}%）
              </span>
            </div>
          </div>
        </div>

        <div className="resource-item">
          <div className="resource-icon">💾</div>
          <div className="resource-info">
            <div className="resource-label">ディスク</div>
            <div className="resource-value">
              {bytesToGB(resources.total_disk)} GB
              <span className="resource-detail">
                （利用可能: {bytesToGB(resources.available_disk)} GB）
              </span>
            </div>
          </div>
        </div>
      </div>

      {showRecommendations && recommendation && (
        <div className="model-recommendations">
          <h4>📊 推奨モデル</h4>
          <div className="recommended-model">
            <div className="recommended-model-name">{recommendation.recommended_model}</div>
            <div className="recommended-model-reason">{recommendation.reason}</div>
            {onModelSelected && (
              <button
                className="use-recommended-button"
                onClick={() => onModelSelected(recommendation.recommended_model)}
              >
                このモデルを使用
              </button>
            )}
          </div>

          {recommendation.use_case_recommendations.length > 0 && (
            <div className="use-case-recommendations">
              <h5>用途別推奨モデル</h5>
              <div className="use-case-grid">
                {recommendation.use_case_recommendations.map((uc, index) => (
                  <div key={index} className="use-case-item">
                    <div className="use-case-label">{getUseCaseLabel(uc.use_case)}</div>
                    <div className="use-case-model">{uc.model}</div>
                    <div className="use-case-reason">{uc.reason}</div>
                    {onModelSelected && (
                      <button
                        className="use-case-button"
                        onClick={() => onModelSelected(uc.model)}
                      >
                        使用
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recommendation.alternatives.length > 0 && (
            <div className="alternative-models">
              <h5>代替モデル</h5>
              <div className="alternatives-list">
                {recommendation.alternatives.map((alt, index) => (
                  <span
                    key={index}
                    className={`alternative-badge ${onModelSelected ? 'clickable' : 'not-clickable'}`}
                    onClick={() => onModelSelected?.(alt)}
                  >
                    {alt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

