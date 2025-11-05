// WebServiceSetup - Webサイトサービスセットアップページ

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectBestModel, getSystemResources } from '../utils/modelSelector';
import type { WebServiceRequirements, ModelSelectionResult, AutoApiCreationResult } from '../types/webService';
import { safeInvoke } from '../utils/tauri';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { logger } from '../utils/logger';
import './WebServiceSetup.css';

export const WebServiceSetup: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'requirements' | 'selection' | 'creating' | 'complete'>('requirements');
  const [requirements, setRequirements] = useState<WebServiceRequirements>({});
  const [systemResources, setSystemResources] = useState<{ availableMemory: number; hasGpu: boolean } | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelSelectionResult | null>(null);
  const [creationResult, setCreationResult] = useState<AutoApiCreationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useGlobalKeyboardShortcuts();

  // 初期化時にシステムリソースを取得
  useEffect(() => {
    loadSystemResources();
  }, []);

  // システムリソースを取得
  const loadSystemResources = async () => {
    try {
      setLoading(true);
      const resources = await getSystemResources();
      setSystemResources(resources);
      setRequirements((prev) => ({
        ...prev,
        availableMemory: prev.availableMemory || resources.availableMemory,
        hasGpu: prev.hasGpu ?? resources.hasGpu,
      }));
      setError(null); // 成功時はエラーをクリア
    } catch (err) {
      logger.error('システムリソース取得エラー', err, 'WebServiceSetup');
      const errorMessage = err instanceof Error ? err.message : 'システムリソースの取得に失敗しました';
      // Tauri環境が初期化されていない場合は、より明確なメッセージを表示
      if (errorMessage.includes('Tauri環境が初期化されていません')) {
        setError('Tauri環境が初期化されていません。アプリケーションを再起動してください。\n\n開発環境では次のコマンドを実行してください:\nnpm run tauri:dev');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // 要件入力完了 → モデル選定
  const handleRequirementsSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // システムリソースが未取得の場合は取得
      let currentResources = systemResources;
      if (!currentResources) {
        try {
          const resources = await getSystemResources();
          setSystemResources(resources);
          currentResources = resources;
        } catch (err) {
          setError('システムリソースの取得に失敗しました。ページを再読み込みしてください。');
          return;
        }
      }
      
      // requirementsにavailableMemoryが含まれていない場合は、systemResourcesから設定
      // systemResourcesが未取得の場合はエラーを表示（念のため再チェック）
      if (!currentResources) {
        setError('システムリソースの取得に失敗しました。ページを再読み込みしてください。');
        return;
      }
      
      const finalRequirements: WebServiceRequirements = {
        ...requirements,
        availableMemory: requirements.availableMemory ?? currentResources.availableMemory,
        hasGpu: requirements.hasGpu ?? currentResources.hasGpu,
      };
      
      // モデル選定
      const result = await selectBestModel(finalRequirements);
      
      if (!result) {
        setError('要件に合うモデルが見つかりませんでした。要件を調整してください。');
        return;
      }
      
      setSelectedModel(result);
      setStep('selection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'モデル選定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // API自動作成
  const handleCreateApi = async () => {
    if (!selectedModel || !selectedModel.model || !selectedModel.config) {
      setError('モデルが選択されていません');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setStep('creating');
      
      // API設定を構築
      const apiConfig: {
        name: string;
        model_name: string;
        engine_type?: string;
        port?: number;
        enable_auth?: boolean;
        engine_config?: string;
      } = {
        name: `Web Service API - ${selectedModel.model.name || 'Unknown Model'}`,
        model_name: selectedModel.model.modelName || '',
        engine_type: selectedModel.model.engine || 'ollama',
        port: selectedModel.config.port || 8080,
        enable_auth: selectedModel.config.enableAuth ?? true,
      };

      // engine_configを構築（ApiCreate.tsxと同じ形式）
      let engineConfigJson: string | null = null;
      if (selectedModel.config.modelParameters || selectedModel.config.memory || selectedModel.config.multimodal) {
        try {
          const mergedConfig: Record<string, any> = {};
          
          // modelParametersを追加
          if (selectedModel.config.modelParameters && Object.keys(selectedModel.config.modelParameters).length > 0) {
            mergedConfig.model_parameters = selectedModel.config.modelParameters;
          }
          
          // memory設定を追加（modelParameters内のmemoryとして）
          if (selectedModel.config.memory && Object.keys(selectedModel.config.memory).length > 0) {
            if (!mergedConfig.model_parameters) {
              mergedConfig.model_parameters = {};
            }
            mergedConfig.model_parameters.memory = selectedModel.config.memory;
          }
          
          // multimodal設定を追加
          if (selectedModel.config.multimodal && Object.keys(selectedModel.config.multimodal).length > 0) {
            mergedConfig.multimodal = selectedModel.config.multimodal;
          }
          
          if (Object.keys(mergedConfig).length > 0) {
            engineConfigJson = JSON.stringify(mergedConfig);
          }
        } catch (err) {
          logger.error('engine_configの構築に失敗', err, 'WebServiceSetup');
          // エラーが発生した場合は、基本的な設定のみを含める
          const fallbackConfig: Record<string, unknown> = {};
          if (selectedModel.config.modelParameters && Object.keys(selectedModel.config.modelParameters).length > 0) {
            fallbackConfig.model_parameters = selectedModel.config.modelParameters;
          }
          if (selectedModel.config.multimodal && Object.keys(selectedModel.config.multimodal).length > 0) {
            fallbackConfig.multimodal = selectedModel.config.multimodal;
          }
          if (Object.keys(fallbackConfig).length > 0) {
            engineConfigJson = JSON.stringify(fallbackConfig);
          }
        }
      }
      
      if (engineConfigJson) {
        apiConfig.engine_config = engineConfigJson;
      }
      
      // デバッグ: 送信するデータをログ出力（開発環境のみ）
      logger.debug('WebServiceSetup - API作成 - 送信する設定', 'WebServiceSetup', {
        ...apiConfig,
        engine_config: engineConfigJson,
        engine_config_length: engineConfigJson ? engineConfigJson.length : 0,
      });
      
      // API作成
      const result = await safeInvoke<{
        id: string;
        name: string;
        endpoint: string;
        api_key: string | null;
        model_name: string;
        port: number;
        status: string;
      }>('create_api', apiConfig);
      
      // API起動
      try {
        await safeInvoke('start_api', { apiId: result.id });
      } catch (startError) {
        logger.warn('API起動に失敗しましたが、作成は成功しています', 'WebServiceSetup', startError);
      }
      
      setCreationResult({
        apiId: result.id,
        apiName: result.name || apiConfig.name,
        endpoint: result.endpoint || `http://localhost:${selectedModel.config.port}`,
        apiKey: result.api_key || undefined,
        status: result.status === 'Running' ? 'running' : 'created',
        message: 'APIが正常に作成されました',
      });
      
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API作成に失敗しました');
      setStep('selection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="web-service-setup">
      <div className="web-service-container">
        <header className="web-service-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← ホームに戻る
          </button>
          <h1>🌐 Webサイトサービスセットアップ</h1>
          <p className="subtitle">要件を入力すると、最適なモデルを自動選定してAPIを作成します</p>
        </header>

        <div className="web-service-content">
          {error && (
            <div className="error-banner">
              <strong>エラー:</strong> {error}
            </div>
          )}

          {/* ステップ1: 要件入力 */}
          {step === 'requirements' && (
            <div className="requirements-form">
              <h2>📋 サービス要件を入力</h2>
              
              <div className="form-section">
                <label htmlFor="category">カテゴリ</label>
                <select
                  id="category"
                  value={requirements.category || ''}
                  onChange={(e) => setRequirements({ ...requirements, category: e.target.value as any })}
                >
                  <option value="">選択してください</option>
                  <option value="chat">💬 チャット</option>
                  <option value="code">💻 コード生成</option>
                  <option value="vision">🖼️ 画像処理</option>
                  <option value="audio">🎵 音声処理</option>
                  <option value="multimodal">🎭 マルチモーダル</option>
                </select>
              </div>

              <div className="form-section">
                <label htmlFor="useCase">用途（例: チャットボット、FAQ自動応答、画像説明生成）</label>
                <input
                  id="useCase"
                  type="text"
                  value={requirements.useCase || ''}
                  onChange={(e) => setRequirements({ ...requirements, useCase: e.target.value })}
                  placeholder="例: Webサイトのチャットボット"
                />
              </div>

              <div className="form-section">
                <label htmlFor="availableMemory">利用可能メモリ（GB）</label>
                <input
                  id="availableMemory"
                  type="number"
                  min="1"
                  max="128"
                  value={requirements.availableMemory || systemResources?.availableMemory || 8}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value)) {
                      setRequirements({ ...requirements, availableMemory: value });
                    }
                  }}
                />
                {systemResources && (
                  <p className="hint">システム検出値: {systemResources.availableMemory}GB</p>
                )}
                <button
                  type="button"
                  onClick={loadSystemResources}
                  disabled={loading}
                  className="detect-button"
                >
                  🔍 システムリソースを自動検出
                </button>
              </div>

              <div className="form-section">
                <label>
                  <input
                    type="checkbox"
                    checked={requirements.hasGpu ?? systemResources?.hasGpu ?? false}
                    onChange={(e) => setRequirements({ ...requirements, hasGpu: e.target.checked })}
                  />
                  GPUを利用可能
                </label>
              </div>

              <div className="form-section">
                <label>
                  <input
                    type="checkbox"
                    checked={requirements.needsVision ?? false}
                    onChange={(e) => setRequirements({ ...requirements, needsVision: e.target.checked })}
                  />
                  画像処理が必要
                </label>
              </div>

              <div className="form-section">
                <label>
                  <input
                    type="checkbox"
                    checked={requirements.needsAudio ?? false}
                    onChange={(e) => setRequirements({ ...requirements, needsAudio: e.target.checked })}
                  />
                  音声処理が必要
                </label>
              </div>

              <div className="form-section">
                <label>
                  <input
                    type="checkbox"
                    checked={requirements.needsVideo ?? false}
                    onChange={(e) => setRequirements({ ...requirements, needsVideo: e.target.checked })}
                  />
                  動画処理が必要
                </label>
              </div>

              <div className="form-actions">
                <button
                  onClick={handleRequirementsSubmit}
                  disabled={loading || !requirements.category}
                  className="primary-button"
                >
                  {loading ? '選定中...' : '最適なモデルを選定 →'}
                </button>
              </div>
            </div>
          )}

          {/* ステップ2: モデル選定結果 */}
          {step === 'selection' && selectedModel && (
            <div className="selection-result">
              <h2>✅ 最適なモデルが選定されました</h2>
              
              <div className="selected-model-card">
                <div className="model-header">
                  <h3>{selectedModel.model.name}</h3>
                  <div className="score-badge">
                    適合度: {selectedModel.score}点
                  </div>
                </div>
                
                <p className="model-description">{selectedModel.model.description}</p>
                
                <div className="selection-reason">
                  <strong>選定理由:</strong> {selectedModel.reason}
                </div>

                <div className="model-config-preview">
                  <h4>設定プレビュー</h4>
                  <ul>
                    <li>エンドポイント: <code>http://localhost:{selectedModel.config.port}</code></li>
                    <li>認証: {selectedModel.config.enableAuth ? '有効' : '無効'}</li>
                    <li>エンジン: {selectedModel.model.engine}</li>
                  </ul>
                </div>
              </div>

              <div className="form-actions">
                <button onClick={() => setStep('requirements')} className="secondary-button">
                  ← 要件を変更
                </button>
                <button onClick={handleCreateApi} disabled={loading} className="primary-button">
                  {loading ? '作成中...' : 'この設定でAPIを作成 →'}
                </button>
              </div>
            </div>
          )}

          {/* ステップ3: 作成中 */}
          {step === 'creating' && (
            <div className="creating-status">
              <div className="loading-spinner"></div>
              <h2>APIを作成しています...</h2>
              <p>しばらくお待ちください</p>
            </div>
          )}

          {/* ステップ4: 完了 */}
          {step === 'complete' && creationResult && (
            <div className="completion-status">
              <div className="success-icon">✅</div>
              <h2>API作成が完了しました！</h2>
              
              <div className="api-info-card">
                <h3>API情報</h3>
                <div className="info-item">
                  <strong>API名:</strong> {creationResult.apiName}
                </div>
                <div className="info-item">
                  <strong>エンドポイント:</strong> <code>{creationResult.endpoint}</code>
                </div>
                {creationResult.apiKey && (
                  <div className="info-item">
                    <strong>APIキー:</strong> <code className="api-key">{creationResult.apiKey}</code>
                  </div>
                )}
                <div className="info-item">
                  <strong>ステータス:</strong> <span className="status-running">稼働中</span>
                </div>
              </div>

              <div className="form-actions">
                <button onClick={() => navigate('/api/list')} className="primary-button">
                  API一覧を見る
                </button>
                <button onClick={() => navigate('/')} className="secondary-button">
                  ホームに戻る
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

