// ModelSelection - モデル選択コンポーネント

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../../utils/tauri';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import type { SelectedModel, ModelCapabilities } from '../../types/api';
import { loadWebModelConfig } from '../../utils/webModelConfig';
import type { WebModelDefinition } from '../../types/webModel';
import { useOllamaProcess } from '../../hooks/useOllama';
import './ModelSelection.css';

/**
 * Ollamaモデル情報
 */
interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  family?: string;
  format?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

/**
 * モデル選択コンポーネント
 */
interface ModelSelectionProps {
  onModelSelected: (model: SelectedModel) => void;
  selectedModel: SelectedModel | null;
  engineType?: string; // エンジンタイプ（オプション）
  onEngineChange?: (engineType: string) => void; // エンジン変更時のコールバック（オプション）
}

// エンジン名のマッピング（共通定数としてエクスポート）
export const ENGINE_NAMES: { [key: string]: string } = {
  'ollama': 'Ollama',
  'lm_studio': 'LM Studio',
  'vllm': 'vLLM',
  'llama_cpp': 'llama.cpp',
};

export const ModelSelection: React.FC<ModelSelectionProps> = ({
  onModelSelected,
  selectedModel,
  engineType = 'ollama',
  onEngineChange,
}) => {
  const navigate = useNavigate();
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedModel, setLocalSelectedModel] = useState<OllamaModel | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>(engineType);
  const [availableEngines, setAvailableEngines] = useState<string[]>(['ollama']);
  const [mode] = useState<'all' | 'web'>('all'); // 'all': すべてのモデル, 'web': Webサイト用（将来の機能拡張用）
  const [webModels, setWebModels] = useState<WebModelDefinition[]>([]);
  const [webModelLoading, setWebModelLoading] = useState(false);
  // selectedWebModelは表示で使用されていますが、setSelectedWebModelは現在未使用です（将来の機能拡張用）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedWebModel, _setSelectedWebModel] = useState<WebModelDefinition | null>(null);
  
  // アンマウント状態を追跡するためのref
  const isMountedRef = useRef(true);
  
  // Ollamaプロセス管理フック
  const { start: startOllama, isStarting: isOllamaStarting } = useOllamaProcess();
  
  // 自動起動試行回数を追跡（無限ループを防ぐため）
  const autoStartAttemptedRef = useRef(false);
  
  // 推奨モデルのリスト
  const recommendedModels = ['llama3', 'llama3.2', 'mistral', 'codellama', 'phi3'];
  
  // モデルの機能を検出（モデル名から推測）
  const detectModelCapabilities = useCallback((modelName: string): ModelCapabilities => {
    const name = modelName.toLowerCase();
    return {
      vision: name.includes('llava') || name.includes('vision') || name.includes('clip') || name.includes('blip'),
      audio: name.includes('whisper') || name.includes('audio') || name.includes('speech') || name.includes('asr'),
      video: name.includes('video') || name.includes('video-') || name.includes('vid2vid'),
    };
  }, []);
  
  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // engineTypeプロップが変更されたときにselectedEngineを更新
  useEffect(() => {
    if (engineType && engineType !== selectedEngine) {
      setSelectedEngine(engineType);
      setLocalSelectedModel(null);
      setModels([]); // エンジン変更時はモデル一覧もクリア
      setError(null);
      setLoading(true); // エンジン変更時はローディング状態にする
      // モデル一覧の再読み込みは、selectedEngineの変更により自動的に行われる
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineType]);

  // 利用可能なエンジン一覧を取得（useCallbackでメモ化）
  const loadAvailableEngines = useCallback(async () => {
    try {
      const engines = await invoke<string[]>('get_available_engines');
      setAvailableEngines(engines);
    } catch (err) {
      console.error('エンジン一覧の取得に失敗:', err);
      setAvailableEngines(['ollama']);
    }
  }, []);

  // Webサイト用モデル設定を読み込む
  const loadWebModels = useCallback(async () => {
    try {
      setWebModelLoading(true);
      const config = await loadWebModelConfig();
      setWebModels(config.models);
    } catch (err) {
      console.error('Webサイト用モデル設定の読み込みに失敗:', err);
      setWebModels([]);
    } finally {
      setWebModelLoading(false);
    }
  }, []);

  // モード変更時にWebモデルを読み込む
  useEffect(() => {
    const modelsCount = webModels.length;
    const isLoading = webModelLoading;
    if (mode === 'web' && modelsCount === 0 && !isLoading) {
      loadWebModels();
    }
  }, [mode, webModels.length, webModelLoading, loadWebModels]);

  // 利用可能なエンジン一覧を取得
  useEffect(() => {
    loadAvailableEngines();
  }, [loadAvailableEngines]);

  // 既に選択されているモデルがある場合は、ローカル状態を初期化
  useEffect(() => {
    if (!selectedModel) {
      // selectedModelがnullの場合は、ローカル選択もクリア
      setLocalSelectedModel(null);
      return;
    }

    if (models.length > 0) {
      const found = models.find(m => m.name === selectedModel.name);
      if (found) {
        setLocalSelectedModel(found);
      } else {
        // 選択されたモデルが現在のエンジンのモデルリストに存在しない場合
        // ローカル選択をクリア（親コンポーネントのselectedModelはそのまま）
        setLocalSelectedModel(null);
      }
    }
    // selectedModelはあるが、modelsがまだ読み込まれていない場合は何もしない
    // modelsが読み込まれるとこのuseEffectが再実行される
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, models]);

  // モデル一覧を取得（useCallbackでメモ化）
  const loadModels = useCallback(async () => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    setLoading(true);
    setError(null);

    try {
      let result: Array<{
        name: string;
        size?: number | null;
        modified_at?: string | null;
        parameter_size?: string | null;
      }>;
      
      if (selectedEngine === 'ollama') {
        // 後方互換性のため、Ollamaの場合は既存のコマンドを使用
        // get_models_listはmodified_atがString（必須）として返す
        const ollamaResult = await safeInvoke<Array<{
          name: string;
          size?: number | null;
          modified_at: string; // 必須
          parameter_size?: string | null;
        }>>('get_models_list');
        
        // modified_atをOption<String>に統一
        result = ollamaResult.map(model => ({
          name: model.name,
          size: model.size,
          modified_at: model.modified_at || undefined,
          parameter_size: model.parameter_size,
        }));
      } else {
        // 他のエンジンの場合はエンジン別のコマンドを使用
        // get_engine_modelsはmodified_atがOption<String>として返す
        result = await safeInvoke<Array<{
          name: string;
          size?: number | null;
          modified_at?: string | null;
          parameter_size?: string | null;
        }>>('get_engine_models', {
          engine_type: selectedEngine,
        });
      }

      // レスポンスをOllamaModel形式に変換
      const modelsData: OllamaModel[] = result.map(model => ({
        name: model.name,
        size: model.size ?? 0, // null/undefinedの場合は0
        modified_at: model.modified_at ?? new Date().toISOString(), // null/undefinedの場合は現在時刻
        parameter_size: model.parameter_size ?? undefined,
      }));

      // アンマウントチェック
      if (!isMountedRef.current) return;
      setModels(modelsData);
      // 成功したらエラーをクリアし、自動起動試行フラグをリセット
      setError(null);
      autoStartAttemptedRef.current = false;
    } catch (err) {
      // アンマウントチェック
      if (!isMountedRef.current) return;
      
      // エラーの場合、ユーザーフレンドリーなメッセージを表示
      const errorMessage = err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました';
      const engineName = ENGINE_NAMES[selectedEngine] || selectedEngine;
      const errorLower = errorMessage.toLowerCase();
      
      // エンジンが起動していない可能性がある場合のチェック
      const isEngineNotRunningError = 
        errorLower.includes(selectedEngine.toLowerCase()) ||
        errorLower.includes(engineName.toLowerCase()) ||
        errorLower.includes('接続') ||
        errorLower.includes('起動') ||
        errorLower.includes('実行されていません') ||
        errorLower.includes('実行中か確認') ||
        errorLower.includes('running') ||
        errorLower.includes('start') ||
        errorLower.includes('connection') ||
        errorLower.includes('aiエンジン');
      
      // Ollamaの場合で、まだ自動起動を試していない場合は自動起動を試みる
      if (selectedEngine === 'ollama' && isEngineNotRunningError && !autoStartAttemptedRef.current && !isOllamaStarting) {
        autoStartAttemptedRef.current = true;
        try {
          // エラーを一時的にクリア（ローディング表示のため）
          setError(null);
          // Ollamaを自動起動
          await startOllama();
          // 起動成功後、少し待ってから再読み込み
          await new Promise(resolve => setTimeout(resolve, 2000));
          // 再読み込み（エラーはクリア済み）
          await loadModels();
          return; // 成功した場合はエラーを表示しない
        } catch (startErr) {
          // 起動に失敗した場合はエラーメッセージを表示
          const startErrorMessage = startErr instanceof Error ? startErr.message : 'Ollamaの起動に失敗しました';
          if (isMountedRef.current) {
            setError(`${engineName}が起動していません。自動起動を試みましたが失敗しました: ${startErrorMessage}`);
          }
        }
      } else if (isEngineNotRunningError) {
        if (isMountedRef.current) {
          setError(`${engineName}が起動していません。${engineName}を起動してから再度お試しください。`);
        }
      } else {
        if (isMountedRef.current) {
          setError(errorMessage);
        }
      }

      // 開発用: サンプルデータを表示（デバッグ時のみ）
      if (import.meta.env.DEV && isMountedRef.current) {
        setModels([
          {
            name: 'llama3:8b',
            size: 4649132864,
            modified_at: new Date().toISOString(),
            parameter_size: '8B',
          },
          {
            name: 'mistral:7b',
            size: 4117237760,
            modified_at: new Date().toISOString(),
            parameter_size: '7B',
          },
        ]);
      }
    } finally {
      // アンマウントチェック
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedEngine, startOllama, isOllamaStarting]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 検索フィルタ（useMemoでメモ化）
  const filteredModels = useMemo(() => {
    return models.filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [models, searchQuery]);

  // サイズをフォーマット
  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // 推奨モデルかどうか
  const isRecommended = (modelName: string): boolean => {
    return recommendedModels.some(rec => modelName.toLowerCase().includes(rec.toLowerCase()));
  };

  const handleModelSelect = (model: OllamaModel) => {
    setLocalSelectedModel(model);
  };

  const handleNext = () => {
    // mode は常に 'all' に設定されているため、selectedWebModel は使用されません（将来の機能拡張用）
    // if (mode === 'web' && selectedWebModel) {
    //   // Webサイト用モデルの場合
    //   onModelSelected({
    //     name: selectedWebModel.modelName,
    //     size: selectedWebModel.size,
    //     description: selectedWebModel.description,
    //     capabilities: selectedWebModel.capabilities,
    //     webModelId: selectedWebModel.id, // Webサイト用モデルのIDを保存
    //   });
    //   return;
    // }
    if (localSelectedModel) {
      // 通常のモデル選択の場合
      const capabilities = detectModelCapabilities(localSelectedModel.name);
      onModelSelected({
        name: localSelectedModel.name,
        size: localSelectedModel.size,
        description: localSelectedModel.parameter_size ? `${localSelectedModel.parameter_size} パラメータ` : undefined,
        capabilities: capabilities,
      });
    }
  };

  // Webサイト用モデル選択ハンドラ（将来の機能拡張用）
  // 現在は使用されていませんが、将来のUI拡張のために保持しています
  // const handleWebModelSelect = useCallback((webModel: WebModelDefinition) => {
  //   _setSelectedWebModel(webModel);
  // }, []);

  // カテゴリ表示名を取得（モデル名から推測）
  const getCategoryLabel = useCallback((modelName: string): string => {
    const name = modelName.toLowerCase();
    if (name.includes('code') || name.includes('coder')) return 'コード生成';
    if (name.includes('chat')) return 'チャット';
    return '汎用';
  }, []);

  // 日付文字列をフォーマット（エラーハンドリング付き）
  const formatDate = useCallback((dateString: string): string => {
    if (!dateString || dateString.trim() === '') {
      return '不明';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '不明';
      }
      return date.toLocaleDateString('ja-JP');
    } catch {
      return '不明';
    }
  }, []);

  // ローディング中はエラーメッセージを非表示にする（エラーがない場合のみローディング表示）
  const isLoading = loading || isOllamaStarting;
  
  if (isLoading && !error) {
    return (
      <div className="model-selection-loading">
        <div className="loading-spinner"></div>
        <p>
          {isOllamaStarting 
            ? 'Ollamaを起動しています...' 
            : 'モデル一覧を読み込んでいます...'}
        </p>
      </div>
    );
  }

  return (
    <div className="model-selection lmstudio-layout">
      {/* LM Studio風レイアウト: 左サイドバー + 右メインエリア */}
      <div className="lmstudio-sidebar">
        {/* サイドバーヘッダー */}
        <div className="sidebar-header">
          <input
            type="text"
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
          />
          <div className="sidebar-header-actions">
            <button
              onClick={() => navigate('/models', { state: { returnTo: 'api/create', selectedEngine } })}
              className="sidebar-search-models-button"
              title="モデルを検索・ダウンロード（LM Studioのように多様なモデルを検索できます）"
            >
              🔍
            </button>
            <button onClick={loadModels} className="sidebar-refresh-button" title="更新">
              🔄
            </button>
          </div>
        </div>

        {/* エンジン選択 */}
        <div className="sidebar-filters">
          <label htmlFor="engine-select" className="sidebar-filter-label">LLMエンジン</label>
          <select
            id="engine-select"
            value={selectedEngine}
            onChange={(e) => {
              const newEngineType = e.target.value;
              // エンジン変更を親コンポーネントに通知（最初に実行）
              if (onEngineChange) {
                onEngineChange(newEngineType);
              }
              // 状態をリセット
              setSelectedEngine(newEngineType);
              setLocalSelectedModel(null);
              setModels([]); // エンジン変更時はモデル一覧もクリア
              setError(null); // エンジン変更時にエラーをクリア
              setLoading(true); // エンジン変更時はローディング状態にする
              // モデル一覧の再読み込みは、selectedEngineの変更により自動的に行われる
            }}
            className="sidebar-filter"
            title="LLMエンジン"
            aria-label="LLMエンジン"
          >
            {availableEngines.map((engine) => (
              <option key={engine} value={engine}>
                {ENGINE_NAMES[engine] || engine}
              </option>
            ))}
          </select>
        </div>

        {/* モデル一覧（コンパクト） */}
        <div className="sidebar-model-list">
          {filteredModels.length === 0 && !loading && !error && (
            <div className="sidebar-empty">
              <p>モデルが見つかりませんでした</p>
              <button
                onClick={() => navigate('/models', { state: { returnTo: 'api/create', selectedEngine } })}
                className="sidebar-empty-search-button"
                title="モデルを検索・ダウンロード"
              >
                🔍 モデルを検索・ダウンロード
              </button>
            </div>
          )}
          {filteredModels.length === 0 && !loading && error && (
            <div className="sidebar-empty">
              <p>エラーが発生しました</p>
              <p className="sidebar-empty-submessage">
                詳細は右側のメインエリアをご確認ください
              </p>
            </div>
          )}
          {filteredModels.map((model) => (
            <div
              key={model.name}
              className={`sidebar-model-item ${
                localSelectedModel?.name === model.name ? 'active' : ''
              } ${isRecommended(model.name) ? 'recommended' : ''}`}
              onClick={() => handleModelSelect(model)}
            >
              <div className="sidebar-model-name">{model.name}</div>
              <div className="sidebar-model-meta">
                {model.size > 0 && (
                  <span className="sidebar-model-size">
                    {(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB
                  </span>
                )}
                {isRecommended(model.name) && <span className="sidebar-recommended-badge">⭐</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* メインエリア */}
      <div className="lmstudio-main">
        {/* エラーメッセージ */}
        {error && (() => {
          // エラーがエンジン起動に関するものかチェック
          const errorLower = error.toLowerCase();
          const isEngineError = 
            errorLower.includes('起動') || 
            errorLower.includes('接続') || 
            errorLower.includes('running') || 
            errorLower.includes('start') || 
            errorLower.includes('connection') ||
            errorLower.includes('aiエンジン') ||
            errorLower.includes('実行されていません') ||
            errorLower.includes('実行中か確認') ||
            errorLower.includes('not running') ||
            errorLower.includes('起動していません');
          
          // エンジン別の提案メッセージを生成
          const engineName = ENGINE_NAMES[selectedEngine] || selectedEngine;
          const suggestion = isEngineError 
            ? (selectedEngine === 'ollama'
                ? 'Ollamaを起動してから再度お試しください。Ollamaがインストールされていない場合は、ホーム画面から「Ollamaセットアップ」を実行してください。'
                : `${engineName}を起動してから再度お試しください。${engineName}がインストールされていない場合は、設定画面からセットアップを実行してください。`)
            : undefined;
          
          // エラータイプを決定（エンジンに応じて）
          const errorType: 'ollama' | 'model' = selectedEngine === 'ollama' ? 'ollama' : 'model';
          
          return (
            <ErrorMessage
              message={error}
              type={errorType}
              suggestion={suggestion}
              onRetry={() => {
                setError(null);
                loadModels();
              }}
            />
          );
        })()}

        {/* モデル詳細表示 */}
        {(localSelectedModel || selectedWebModel) ? (
          <div className="main-model-details">
            <div className="detail-header">
              <div className="detail-title-section">
                <h2 className="detail-model-name">
                  {selectedWebModel ? (
                    <>
                      {selectedWebModel.icon && <span className="model-icon-large">{selectedWebModel.icon}</span>}
                      {selectedWebModel.name}
                    </>
                  ) : (
                    localSelectedModel?.name ?? 'モデル名不明'
                  )}
                </h2>
                {(selectedWebModel?.recommended || (localSelectedModel && isRecommended(localSelectedModel.name))) && (
                  <span className="detail-recommended-badge">⭐ 推奨モデル</span>
                )}
              </div>
              <div className="detail-actions">
                <button
                  className="detail-action-button primary"
                  onClick={handleNext}
                  disabled={!localSelectedModel && !selectedWebModel}
                >
                  次へ →
                </button>
              </div>
            </div>

            <div className="detail-content">
              {/* Webサイト用モデルの場合 */}
              {selectedWebModel ? (
                <>
                  <InfoBanner
                    type="info"
                    title="Webサイト用モデル"
                    message={selectedWebModel.description}
                    dismissible
                  />

                  <div className="detail-info-grid">
                    <div className="detail-info-item">
                      <span className="detail-info-label">カテゴリ</span>
                      <span className="detail-info-value">
                        {selectedWebModel.category === 'chat' && '💬 チャット'}
                        {selectedWebModel.category === 'code' && '💻 コード'}
                        {selectedWebModel.category === 'vision' && '🖼️ 画像'}
                        {selectedWebModel.category === 'audio' && '🎵 音声'}
                        {selectedWebModel.category === 'multimodal' && '🎭 マルチモーダル'}
                      </span>
                    </div>

                    {selectedWebModel.capabilities && (
                      <div className="detail-info-item">
                        <span className="detail-info-label">対応機能</span>
                        <span className="detail-info-value">
                          <span className="capability-badges">
                            {selectedWebModel.capabilities.vision && <span className="capability-badge vision">🖼️ 画像</span>}
                            {selectedWebModel.capabilities.audio && <span className="capability-badge audio">🎵 音声</span>}
                            {selectedWebModel.capabilities.video && <span className="capability-badge video">🎬 動画</span>}
                          </span>
                        </span>
                      </div>
                    )}

                    {selectedWebModel.requirements && (
                      <>
                        {selectedWebModel.requirements.minMemory && (
                          <div className="detail-info-item">
                            <span className="detail-info-label">最小メモリ</span>
                            <span className="detail-info-value">
                              {selectedWebModel.requirements.minMemory}GB
                            </span>
                          </div>
                        )}
                        {selectedWebModel.requirements.recommendedMemory && (
                          <div className="detail-info-item">
                            <span className="detail-info-label">推奨メモリ</span>
                            <span className="detail-info-value">
                              {selectedWebModel.requirements.recommendedMemory}GB
                            </span>
                          </div>
                        )}
                        {selectedWebModel.requirements.gpuRecommended && (
                          <div className="detail-info-item">
                            <span className="detail-info-label">GPU</span>
                            <span className="detail-info-value">
                              {selectedWebModel.requirements.gpuRecommended ? '推奨' : '不要'}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {selectedWebModel.useCases && selectedWebModel.useCases.length > 0 && (
                      <div className="detail-info-item full-width">
                        <span className="detail-info-label">使用例</span>
                        <div className="detail-info-value">
                          <ul className="use-cases-list">
                            {selectedWebModel.useCases.map((useCase, index) => (
                              <li key={index}>{useCase}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="detail-note">
                    <p>💡 <strong>推奨設定が自動適用されます</strong></p>
                    <p>このモデルはWebサイト用途に最適化された設定でAPIが作成されます。</p>
                  </div>
                </>
              ) : localSelectedModel ? (
                <>
              {/* 初めての方へのガイダンス */}
              {localSelectedModel && isRecommended(localSelectedModel.name) && (
                <InfoBanner
                  type="tip"
                  title="推奨モデル"
                  message="このモデルは推奨モデルです。チャット用途やコード生成に最適化されています。"
                  dismissible
                />
              )}

              <div className="detail-info-grid">
                {localSelectedModel && localSelectedModel.size > 0 && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">サイズ</span>
                    <span className="detail-info-value">
                      {formatSize(localSelectedModel.size)}
                    </span>
                  </div>
                )}

                {localSelectedModel && localSelectedModel.parameter_size && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">パラメータ数</span>
                    <span className="detail-info-value">
                      {localSelectedModel.parameter_size}
                    </span>
                  </div>
                )}

                {localSelectedModel && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">カテゴリ</span>
                    <span className="detail-info-value">
                      {getCategoryLabel(localSelectedModel.name)}
                    </span>
                  </div>
                )}

                {/* マルチモーダル機能の表示 */}
                {localSelectedModel && (() => {
                  const model = localSelectedModel;
                  const capabilities = detectModelCapabilities(model.name);
                  const hasMultimodal = capabilities.vision || capabilities.audio || capabilities.video;
                  
                  if (hasMultimodal) {
                    return (
                      <div className="detail-info-item">
                        <span className="detail-info-label">対応機能</span>
                        <span className="detail-info-value">
                          <span className="capability-badges">
                            {capabilities.vision && <span className="capability-badge vision">🖼️ 画像</span>}
                            {capabilities.audio && <span className="capability-badge audio">🎵 音声</span>}
                            {capabilities.video && <span className="capability-badge video">🎬 動画</span>}
                          </span>
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {localSelectedModel && localSelectedModel.modified_at && localSelectedModel.modified_at.trim() !== '' && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">更新日時</span>
                    <span className="detail-info-value">
                      {formatDate(localSelectedModel.modified_at)}
                    </span>
                  </div>
                )}
              </div>
              </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="main-empty-state">
            <div className="empty-state-content">
              <h2>モデルを選択してください</h2>
              <p>左側のサイドバーからモデルを選択すると、詳細情報が表示されます。</p>
              
              {/* モデル検索ボタン */}
              <div className="empty-state-actions">
                <button
                  className="search-models-button"
                  onClick={() => navigate('/models', { state: { returnTo: 'api/create', selectedEngine } })}
                  title="モデル検索・ダウンロードページを開く"
                >
                  🔍 モデルを検索・ダウンロード
                </button>
                <p className="empty-state-hint">
                  LM Studioのように多様なモデルを検索してダウンロードできます
                </p>
              </div>

              <div className="empty-state-hints">
                <h3>推奨モデル</h3>
                <ul>
                  <li><strong>llama3:8b</strong> - 高性能な汎用チャットモデル</li>
                  <li><strong>codellama:7b</strong> - コード生成に特化</li>
                  <li><strong>mistral:7b</strong> - 効率的な多目的モデル</li>
                  <li><strong>phi3:mini</strong> - 軽量高性能モデル</li>
                </ul>
                <p className="hint-note">
                  💡 より多くのモデルを見つけるには、上の「モデルを検索・ダウンロード」ボタンから
                  外部リポジトリ（Ollamaライブラリ、Hugging Faceなど）を検索できます
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
