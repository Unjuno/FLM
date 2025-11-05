// ApiConfigForm - API設定フォームコンポーネント

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { Tooltip } from '../common/Tooltip';
import { ENGINE_NAMES } from './ModelSelection';
import type { SelectedModel, ApiConfig, ModelParameters, MemorySettings, MultimodalSettings } from '../../types/api';
import { loadWebModelConfig, findModelById } from '../../utils/webModelConfig';
import { PORT_RANGE, MODEL_PARAMETERS, MEMORY_SETTINGS, MULTIMODAL_SETTINGS, API_NAME, TIMEOUT } from '../../constants/config';
import { logger } from '../../utils/logger';
import './ApiConfigForm.css';

/**
 * API設定フォームコンポーネント
 */
interface ApiConfigFormProps {
  model: SelectedModel;
  defaultConfig: ApiConfig;
  onSubmit: (config: ApiConfig) => void;
  onBack: () => void;
}

export const ApiConfigForm: React.FC<ApiConfigFormProps> = ({
  model,
  defaultConfig,
  onSubmit,
  onBack,
}) => {
  const [config, setConfig] = useState<ApiConfig>({
    ...defaultConfig,
    engineType: defaultConfig.engineType || 'ollama',
    modelParameters: defaultConfig.modelParameters || {
      temperature: MODEL_PARAMETERS.TEMPERATURE.DEFAULT,
      top_p: MODEL_PARAMETERS.TOP_P.DEFAULT,
      top_k: MODEL_PARAMETERS.TOP_K.DEFAULT,
      max_tokens: MODEL_PARAMETERS.MAX_TOKENS.DEFAULT,
      repeat_penalty: MODEL_PARAMETERS.REPEAT_PENALTY.DEFAULT,
    },
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [availableEngines, setAvailableEngines] = useState<string[]>([]);
  const [loadingEngines, setLoadingEngines] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showMemorySettings, setShowMemorySettings] = useState(false);
  const [showMultimodalSettings, setShowMultimodalSettings] = useState(false);
  const [nameSuggesting, setNameSuggesting] = useState(false);
  const [engineDetectionResult, setEngineDetectionResult] = useState<{
    installed: boolean;
    running: boolean;
    message?: string;
  } | null>(null);
  const [checkingEngine, setCheckingEngine] = useState(false);

  // アンマウントチェック用のref（メモリリーク対策）
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 利用可能なエンジン一覧を取得（useCallbackでメモ化）
  const loadAvailableEngines = useCallback(async () => {
    try {
      setLoadingEngines(true);
      const engines = await safeInvoke<string[]>('get_available_engines');
      setAvailableEngines(engines);
    } catch (err) {
      logger.error('エンジン一覧の取得に失敗', err, 'ApiConfigForm');
      // デフォルトエンジンのみ使用可能とする
      setAvailableEngines(['ollama']);
    } finally {
      setLoadingEngines(false);
    }
  }, []);

  useEffect(() => {
    loadAvailableEngines();
  }, [loadAvailableEngines]);


  // 現在のポート番号の使用可能性をチェック
  const checkPortAvailability = useCallback(async (port: number) => {
    try {
      const isAvailable = await safeInvoke<boolean>('check_port_availability', { port });
      
      if (!isAvailable) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          port: `ポート ${port} は既に使用されています。別のポート番号を選択してください。`,
        }));
      } else {
        setErrors((prevErrors) => {
          const newErrors = { ...prevErrors };
          if (newErrors.port && newErrors.port.includes('既に使用されています')) {
            delete newErrors.port;
          }
          return newErrors;
        });
      }
    } catch (err) {
      logger.error('ポート確認エラー', err, 'ApiConfigForm');
    }
  }, []);

  // ポート番号が変更されたときに確認
  useEffect(() => {
    if (config.port && config.port >= PORT_RANGE.MIN && config.port <= PORT_RANGE.MAX) {
      const timeoutId = setTimeout(() => {
        checkPortAvailability(config.port);
      }, TIMEOUT.PORT_CHECK_DELAY);
      return () => clearTimeout(timeoutId);
    }
  }, [config.port, checkPortAvailability]);

  // エンジンタイプが変更されたときにインストール状態を確認
  const checkEngineInstallation = useCallback(async (engineType: string) => {
    if (!engineType || engineType === 'ollama') {
      // Ollamaは自動インストールされるため、特別なチェックは不要
      setEngineDetectionResult(null);
      return;
    }

    try {
      setCheckingEngine(true);
      const result = await safeInvoke<{
        engine_type: string;
        installed: boolean;
        running: boolean;
        version?: string | null;
        path?: string | null;
        message?: string | null;
      }>('detect_engine', { engine_type: engineType });

      if (isMountedRef.current) {
        setEngineDetectionResult({
          installed: result.installed,
          running: result.running,
          message: result.message || undefined,
        });
      }
    } catch (err) {
      logger.error('エンジン検出エラー', err, 'ApiConfigForm');
      if (isMountedRef.current) {
        setEngineDetectionResult({
          installed: false,
          running: false,
          message: 'エンジンの検出に失敗しました',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setCheckingEngine(false);
      }
    }
  }, []);

  // エンジンタイプが変更されたときにチェック
  useEffect(() => {
    if (config.engineType) {
      checkEngineInstallation(config.engineType);
    }
  }, [config.engineType, checkEngineInstallation]);

  // API名の自動生成（重複回避、useCallbackでメモ化）
  const suggestApiName = useCallback(async () => {
    try {
      setNameSuggesting(true);
      const result = await safeInvoke<{
        suggested_name: string;
        alternatives: string[];
        is_available: boolean;
      }>('suggest_api_name', { baseName: config.name });
      
      if (!result.is_available || result.suggested_name !== config.name) {
        setConfig((prevConfig) => ({ ...prevConfig, name: result.suggested_name }));
        setErrors((prevErrors) => ({ ...prevErrors, name: '' }));
      }
    } catch (err) {
      logger.error('API名提案エラー', err, 'ApiConfigForm');
    } finally {
      setNameSuggesting(false);
    }
  }, [config.name]);

  // モデルパラメータの更新
  const updateModelParameter = (key: keyof ModelParameters, value: number | undefined) => {
    setConfig({
      ...config,
      modelParameters: {
        ...config.modelParameters,
        [key]: value,
      },
    });
  };

  // メモリ設定の更新
  const updateMemorySetting = (key: keyof MemorySettings, value: number | boolean | undefined) => {
    setConfig({
      ...config,
      modelParameters: {
        ...config.modelParameters,
        memory: {
          ...config.modelParameters?.memory,
          [key]: value,
        },
      },
    });
  };

  // マルチモーダル設定の更新
  const updateMultimodalSetting = (key: keyof MultimodalSettings, value: boolean | number | string[] | undefined) => {
    setConfig({
      ...config,
      multimodal: {
        ...config.multimodal,
        [key]: value,
      },
    });
  };

  // Webサイト用モデルのデフォルト設定を適用（アンマウントチェックをuseRefで実装）
  useEffect(() => {
    if (!model.webModelId) {
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    loadWebModelConfig()
      .then((webConfig) => {
        if (!isMountedRef.current) return;
        
        const webModel = findModelById(webConfig, model.webModelId!);
        if (webModel && webModel.defaultSettings) {
          const defaultSettings = webModel.defaultSettings;
          
          setConfig((prevConfig) => {
            // 既に設定が適用されている場合はスキップ
            if (prevConfig.engineType === webModel.engine && 
                defaultSettings.port && prevConfig.port === defaultSettings.port) {
              return prevConfig;
            }

            const updatedConfig: ApiConfig = {
              ...prevConfig,
              port: defaultSettings.port ?? prevConfig.port,
              enableAuth: defaultSettings.enableAuth ?? prevConfig.enableAuth,
              engineType: webModel.engine || prevConfig.engineType,
            };

            // modelParametersをマージ
            if (defaultSettings.modelParameters) {
              updatedConfig.modelParameters = {
                ...prevConfig.modelParameters,
                ...defaultSettings.modelParameters,
                // memory設定もマージ（存在する場合）
                memory: defaultSettings.memory
                  ? { ...prevConfig.modelParameters?.memory, ...defaultSettings.memory }
                  : prevConfig.modelParameters?.memory,
              };
            }

            // multimodal設定をマージ
            if (defaultSettings.multimodal) {
              updatedConfig.multimodal = {
                ...prevConfig.multimodal,
                ...defaultSettings.multimodal,
              };
            }

            return updatedConfig;
          });
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          logger.error('Webサイト用モデル設定の読み込みに失敗', err, 'ApiConfigForm');
        }
      });
  }, [model.webModelId]);

  // モデルの機能に基づいてマルチモーダル設定を初期化（Webサイト用モデルでない場合のみ）
  useEffect(() => {
    if (model.webModelId) {
      return; // Webサイト用モデルの場合は、上のuseEffectで処理済み
    }

    if (!model.capabilities) {
      return; // capabilitiesがない場合は何もしない
    }

    setConfig((prevConfig) => {
      // 既にmultimodal設定がある場合はスキップ
      if (prevConfig.multimodal) {
        return prevConfig;
      }

      const defaultMultimodal: MultimodalSettings = {
        enableVision: model.capabilities?.vision || false,
        enableAudio: model.capabilities?.audio || false,
        enableVideo: model.capabilities?.video || false,
        maxImageSize: MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.DEFAULT,
        maxAudioSize: MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.DEFAULT,
        maxVideoSize: MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.DEFAULT,
        supportedImageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        supportedAudioFormats: ['mp3', 'wav', 'ogg', 'm4a'],
        supportedVideoFormats: ['mp4', 'webm', 'mov'],
      };

      return {
        ...prevConfig,
        multimodal: defaultMultimodal,
      };
    });
  }, [model.capabilities, model.webModelId]);

  // フォームバリデーション
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    const trimmedName = config.name.trim();
    if (!trimmedName) {
      newErrors.name = 'API名を入力してください';
    } else if (trimmedName.length < API_NAME.MIN_LENGTH) {
      newErrors.name = `API名は${API_NAME.MIN_LENGTH}文字以上で入力してください`;
    } else if (trimmedName.length > API_NAME.MAX_LENGTH) {
      newErrors.name = `API名は${API_NAME.MAX_LENGTH}文字以下で入力してください`;
    }

    if (config.port < PORT_RANGE.MIN || config.port > PORT_RANGE.MAX) {
      newErrors.port = `ポート番号は${PORT_RANGE.MIN}-${PORT_RANGE.MAX}の範囲で入力してください`;
    }

    // モデルパラメータのバリデーション
    if (config.modelParameters) {
      const params = config.modelParameters;
      
      if (params.temperature !== undefined && (params.temperature < MODEL_PARAMETERS.TEMPERATURE.MIN || params.temperature > MODEL_PARAMETERS.TEMPERATURE.MAX)) {
        newErrors.temperature = `温度は${MODEL_PARAMETERS.TEMPERATURE.MIN}-${MODEL_PARAMETERS.TEMPERATURE.MAX}の範囲で入力してください`;
      }
      
      if (params.top_p !== undefined && (params.top_p < MODEL_PARAMETERS.TOP_P.MIN || params.top_p > MODEL_PARAMETERS.TOP_P.MAX)) {
        newErrors.top_p = `Top-pは${MODEL_PARAMETERS.TOP_P.MIN}-${MODEL_PARAMETERS.TOP_P.MAX}の範囲で入力してください`;
      }
      
      if (params.top_k !== undefined && (params.top_k < MODEL_PARAMETERS.TOP_K.MIN || params.top_k > MODEL_PARAMETERS.TOP_K.MAX)) {
        newErrors.top_k = `Top-kは${MODEL_PARAMETERS.TOP_K.MIN}-${MODEL_PARAMETERS.TOP_K.MAX}の範囲で入力してください`;
      }
      
      if (params.max_tokens !== undefined && params.max_tokens < MODEL_PARAMETERS.MAX_TOKENS.MIN) {
        newErrors.max_tokens = `最大トークン数は${MODEL_PARAMETERS.MAX_TOKENS.MIN}以上の値を入力してください`;
      }
      
      if (params.repeat_penalty !== undefined && (params.repeat_penalty < MODEL_PARAMETERS.REPEAT_PENALTY.MIN || params.repeat_penalty > MODEL_PARAMETERS.REPEAT_PENALTY.MAX)) {
        newErrors.repeat_penalty = `繰り返しペナルティは${MODEL_PARAMETERS.REPEAT_PENALTY.MIN}-${MODEL_PARAMETERS.REPEAT_PENALTY.MAX}の範囲で入力してください`;
      }

      // メモリ設定のバリデーション
      if (params.memory) {
        const memory = params.memory;
        
        if (memory.context_window !== undefined) {
          if (memory.context_window < MEMORY_SETTINGS.CONTEXT_WINDOW.MIN) {
            newErrors.context_window = `コンテキストウィンドウサイズは${MEMORY_SETTINGS.CONTEXT_WINDOW.MIN}以上の値を入力してください`;
          } else if (memory.context_window > MEMORY_SETTINGS.CONTEXT_WINDOW.MAX) {
            newErrors.context_window = `コンテキストウィンドウサイズは${MEMORY_SETTINGS.CONTEXT_WINDOW.MAX}以下の値を入力してください`;
          }
        }
        
        if (memory.num_gpu_layers !== undefined) {
          if (memory.num_gpu_layers < MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN) {
            newErrors.num_gpu_layers = `GPUレイヤー数は${MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}以上の値を入力してください`;
          } else if (memory.num_gpu_layers > MEMORY_SETTINGS.NUM_GPU_LAYERS.MAX) {
            newErrors.num_gpu_layers = `GPUレイヤー数は${MEMORY_SETTINGS.NUM_GPU_LAYERS.MAX}以下の値を入力してください`;
          }
        }
        
        if (memory.num_threads !== undefined) {
          if (memory.num_threads < MEMORY_SETTINGS.NUM_THREADS.MIN) {
            newErrors.num_threads = `CPUスレッド数は${MEMORY_SETTINGS.NUM_THREADS.MIN}以上の値を入力してください`;
          } else if (memory.num_threads > MEMORY_SETTINGS.NUM_THREADS.MAX) {
            newErrors.num_threads = `CPUスレッド数は${MEMORY_SETTINGS.NUM_THREADS.MAX}以下の値を入力してください`;
          }
        }
        
        if (memory.batch_size !== undefined) {
          if (memory.batch_size < MEMORY_SETTINGS.BATCH_SIZE.MIN) {
            newErrors.batch_size = `バッチサイズは${MEMORY_SETTINGS.BATCH_SIZE.MIN}以上の値を入力してください`;
          } else if (memory.batch_size > MEMORY_SETTINGS.BATCH_SIZE.MAX) {
            newErrors.batch_size = `バッチサイズは${MEMORY_SETTINGS.BATCH_SIZE.MAX}以下の値を入力してください`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      // デバッグ: 送信する設定をログ出力（開発環境のみ）
      if (import.meta.env.DEV) {
        logger.debug('ApiConfigForm - 送信する設定', 'ApiConfigForm', {
          ...config,
          modelParameters: config.modelParameters,
        });
      }
      onSubmit(config);
    } else {
      if (import.meta.env.DEV) {
        logger.warn('ApiConfigForm - バリデーションエラー', 'ApiConfigForm', errors);
      }
    }
  };

  return (
    <div className="api-config-form">
      <div className="config-header">
        <h2>API設定</h2>
        <p className="config-description">
          選択したモデル: <strong>{model.name}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="config-form">
        <div className="form-group">
          <label htmlFor="api-name">
            API名 <span className="required">*</span>
            <Tooltip content="重複を回避したAPI名を自動生成します。">
              <span className="tooltip-trigger-icon">ℹ️</span>
            </Tooltip>
          </label>
          <div className="name-input-group">
            <input
              id="api-name"
              type="text"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="LocalAI API"
              maxLength={API_NAME.MAX_LENGTH}
              className={errors.name ? 'error' : ''}
            />
            <Tooltip content="重複を回避したAPI名を自動生成します。">
              <button
                type="button"
                className="name-suggest-button"
                onClick={suggestApiName}
                disabled={nameSuggesting}
                aria-label="API名を自動生成"
              >
                {nameSuggesting ? '生成中...' : '✨ 自動生成'}
              </button>
            </Tooltip>
          </div>
          {errors.name && <span className="error-message">{errors.name}</span>}
          <small className="form-hint">この名前でAPIを識別します</small>
        </div>

        <div className="form-group">
          <label htmlFor="engine-type">
            LLMエンジン <span className="required">*</span>
            <Tooltip
              content="使用するLLMエンジンを選択します。Ollama（デフォルト）、LM Studio、vLLM、llama.cppから選択できます。"
              position="right"
            >
              <span className="tooltip-trigger-icon">ℹ️</span>
            </Tooltip>
          </label>
          <select
            id="engine-type"
            value={config.engineType || 'ollama'}
            onChange={(e) => setConfig({ ...config, engineType: e.target.value })}
            className={errors.engineType ? 'error' : ''}
            disabled={loadingEngines}
          >
            {availableEngines.map((engine) => (
              <option key={engine} value={engine}>
                {ENGINE_NAMES[engine] || engine}
              </option>
            ))}
          </select>
          {errors.engineType && <span className="error-message">{errors.engineType}</span>}
          <small className="form-hint">LLM実行エンジン（デフォルト: Ollama）</small>
          
          {/* エンジンインストール状態の表示 */}
          {checkingEngine && (
            <div className="engine-check-status">
              <span className="checking-icon">⏳</span>
              <span>エンジンの状態を確認中...</span>
            </div>
          )}
          
          {engineDetectionResult && !checkingEngine && (
            <div className={`engine-status-message ${!engineDetectionResult.installed ? 'warning' : engineDetectionResult.running ? 'success' : 'info'}`}>
              {!engineDetectionResult.installed ? (
                <>
                  <span className="status-icon">⚠️</span>
                  <span className="status-text">
                    {ENGINE_NAMES[config.engineType || 'ollama'] || config.engineType}がインストールされていません。
                    {config.engineType === 'ollama' ? (
                      <> 自動インストールが開始されます。</>
                    ) : (
                      <> 手動でインストールしてからAPIを作成してください。</>
                    )}
                  </span>
                  {engineDetectionResult.message && (
                    <div className="status-detail">{engineDetectionResult.message}</div>
                  )}
                </>
              ) : !engineDetectionResult.running ? (
                <>
                  <span className="status-icon">ℹ️</span>
                  <span className="status-text">
                    {ENGINE_NAMES[config.engineType || 'ollama'] || config.engineType}が起動していません。
                    エンジンを起動してからAPIを作成してください。
                  </span>
                  {engineDetectionResult.message && (
                    <div className="status-detail">{engineDetectionResult.message}</div>
                  )}
                </>
              ) : (
                <>
                  <span className="status-icon">✅</span>
                  <span className="status-text">
                    {ENGINE_NAMES[config.engineType || 'ollama'] || config.engineType}は正常に動作しています。
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="api-port">
            ポート番号 <span className="required">*</span>
            <Tooltip
              content="APIエンドポイントが使用するポート番号です。1024-65535の範囲で指定してください。他のアプリケーションが使用していないポートを選択してください。"
              position="right"
            >
              <span className="tooltip-trigger-icon">ℹ️</span>
            </Tooltip>
          </label>
          <input
            id="api-port"
            type="number"
            value={config.port}
            onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || PORT_RANGE.DEFAULT })}
            min={PORT_RANGE.MIN}
            max={PORT_RANGE.MAX}
            className={errors.port ? 'error' : ''}
          />
          {errors.port && <span className="error-message">{errors.port}</span>}
          <small className="form-hint">APIエンドポイントのポート番号（デフォルト: {PORT_RANGE.DEFAULT}）</small>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <Tooltip
              content="認証を有効にすると、APIキーが必要になります。外部アプリケーションから使用する場合は有効にすることをおすすめします。ローカル環境のみで使用する場合は無効でも問題ありません。"
              position="right"
            >
              <input
                type="checkbox"
                checked={config.enableAuth}
                onChange={(e) => setConfig({ ...config, enableAuth: e.target.checked })}
              />
            </Tooltip>
            <span>認証を有効にする</span>
          </label>
          <small className="form-hint">
            認証を有効にすると、APIキーが必要になります（推奨）
          </small>
        </div>

        {/* 高度な設定: モデル生成パラメータ */}
        <div className="form-group">
          <div className="advanced-params-header">
            <button
              type="button"
              className="advanced-params-toggle"
              onClick={() => setShowAdvancedParams(!showAdvancedParams)}
              {...(showAdvancedParams ? { 'aria-expanded': 'true' as const } : { 'aria-expanded': 'false' as const })}
            >
              <span>{showAdvancedParams ? '▼' : '▶'}</span>
              <span>高度な設定: モデル生成パラメータ</span>
            </button>
            <Tooltip
              content="モデルの生成動作を調整するパラメータです。デフォルト値のままでも問題なく動作します。"
              position="right"
            >
              <span className="tooltip-trigger-icon">ℹ️</span>
            </Tooltip>
          </div>
          
          {showAdvancedParams && (
            <div className="advanced-params-content">
              <div className="param-row">
                <label htmlFor="temperature">
                  温度 (Temperature)
                  <Tooltip
                    content="出力のランダム性を制御します。値が高いほど創造的で多様な出力になります（推奨: 0.7）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="temperature"
                    type="number"
                    min={MODEL_PARAMETERS.TEMPERATURE.MIN}
                    max={MODEL_PARAMETERS.TEMPERATURE.MAX}
                    step="0.1"
                    value={config.modelParameters?.temperature ?? MODEL_PARAMETERS.TEMPERATURE.DEFAULT}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      updateModelParameter('temperature', value);
                    }}
                    className={errors.temperature ? 'error' : ''}
                  />
                  <small className="param-range">{MODEL_PARAMETERS.TEMPERATURE.MIN} - {MODEL_PARAMETERS.TEMPERATURE.MAX}</small>
                </div>
                {errors.temperature && <span className="error-message">{errors.temperature}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="top_p">
                  Top-p (Nucleus Sampling)
                  <Tooltip
                    content="確率質量の累積分布がこの値に達するまでのトークンを考慮します（推奨: 0.9）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="top_p"
                    type="number"
                    min={MODEL_PARAMETERS.TOP_P.MIN}
                    max={MODEL_PARAMETERS.TOP_P.MAX}
                    step="0.1"
                    value={config.modelParameters?.top_p ?? MODEL_PARAMETERS.TOP_P.DEFAULT}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      updateModelParameter('top_p', value);
                    }}
                    className={errors.top_p ? 'error' : ''}
                  />
                  <small className="param-range">{MODEL_PARAMETERS.TOP_P.MIN} - {MODEL_PARAMETERS.TOP_P.MAX}</small>
                </div>
                {errors.top_p && <span className="error-message">{errors.top_p}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="top_k">
                  Top-k
                  <Tooltip
                    content="最も確率の高いk個のトークンのみを考慮します（推奨: 40）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="top_k"
                    type="number"
                    min={MODEL_PARAMETERS.TOP_K.MIN}
                    max={MODEL_PARAMETERS.TOP_K.MAX}
                    step="1"
                    value={config.modelParameters?.top_k ?? MODEL_PARAMETERS.TOP_K.DEFAULT}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateModelParameter('top_k', value);
                    }}
                    className={errors.top_k ? 'error' : ''}
                  />
                  <small className="param-range">{MODEL_PARAMETERS.TOP_K.MIN} - {MODEL_PARAMETERS.TOP_K.MAX}</small>
                </div>
                {errors.top_k && <span className="error-message">{errors.top_k}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="max_tokens">
                  最大トークン数 (Max Tokens)
                  <Tooltip
                    content="生成される最大のトークン数です（推奨: 1024）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="max_tokens"
                    type="number"
                    min={MODEL_PARAMETERS.MAX_TOKENS.MIN}
                    step="1"
                    value={config.modelParameters?.max_tokens ?? MODEL_PARAMETERS.MAX_TOKENS.DEFAULT}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateModelParameter('max_tokens', value);
                    }}
                    className={errors.max_tokens ? 'error' : ''}
                  />
                  <small className="param-range">{MODEL_PARAMETERS.MAX_TOKENS.MIN}以上</small>
                </div>
                {errors.max_tokens && <span className="error-message">{errors.max_tokens}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="repeat_penalty">
                  繰り返しペナルティ (Repeat Penalty)
                  <Tooltip
                    content="同じトークンの繰り返しを抑制する強度です。値が高いほど繰り返しが減ります（推奨: 1.1）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="repeat_penalty"
                    type="number"
                    min={MODEL_PARAMETERS.REPEAT_PENALTY.MIN}
                    max={MODEL_PARAMETERS.REPEAT_PENALTY.MAX}
                    step="0.1"
                    value={config.modelParameters?.repeat_penalty ?? MODEL_PARAMETERS.REPEAT_PENALTY.DEFAULT}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      updateModelParameter('repeat_penalty', value);
                    }}
                    className={errors.repeat_penalty ? 'error' : ''}
                  />
                  <small className="param-range">{MODEL_PARAMETERS.REPEAT_PENALTY.MIN} - {MODEL_PARAMETERS.REPEAT_PENALTY.MAX}</small>
                </div>
                {errors.repeat_penalty && <span className="error-message">{errors.repeat_penalty}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="seed">
                  シード値 (Seed) <span className="optional">任意</span>
                  <Tooltip
                    content="出力の再現性を確保するためのシード値です。指定しない場合はランダムになります。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="seed"
                    type="number"
                    step="1"
                    value={config.modelParameters?.seed ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateModelParameter('seed', value);
                    }}
                    placeholder="未指定"
                  />
                  <small className="param-range">任意の整数</small>
                </div>
              </div>

              <div className="param-reset">
                <button
                  type="button"
                  className="param-reset-button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      modelParameters: {
                        temperature: MODEL_PARAMETERS.TEMPERATURE.DEFAULT,
                        top_p: MODEL_PARAMETERS.TOP_P.DEFAULT,
                        top_k: MODEL_PARAMETERS.TOP_K.DEFAULT,
                        max_tokens: MODEL_PARAMETERS.MAX_TOKENS.DEFAULT,
                        repeat_penalty: MODEL_PARAMETERS.REPEAT_PENALTY.DEFAULT,
                      },
                    });
                  }}
                >
                  デフォルト値にリセット
                </button>
              </div>
            </div>
          )}
        </div>

        {/* メモリ・リソース設定 */}
        <div className="form-group">
          <div className="advanced-params-header">
            <button
              type="button"
              className="advanced-params-toggle"
              onClick={() => setShowMemorySettings(!showMemorySettings)}
              {...(showMemorySettings ? { 'aria-expanded': 'true' as const } : { 'aria-expanded': 'false' as const })}
            >
              <span>{showMemorySettings ? '▼' : '▶'}</span>
              <span>メモリ・リソース設定</span>
            </button>
            <Tooltip
              content="モデルのメモリ使用量やパフォーマンスを調整する設定です。通常はデフォルト値のままでも問題なく動作します。"
              position="right"
            >
              <span className="tooltip-trigger-icon">ℹ️</span>
            </Tooltip>
          </div>
          
          {showMemorySettings && (
            <div className="advanced-params-content">
              <div className="param-row">
                <label htmlFor="context_window">
                  コンテキストウィンドウサイズ (Context Window)
                  <Tooltip
                    content="モデルが一度に処理できる最大のトークン数です。値を大きくすると長い文章を処理できますが、メモリ使用量が増加します（推奨: モデル依存）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="context_window"
                    type="number"
                    min={MEMORY_SETTINGS.CONTEXT_WINDOW.MIN}
                    max={MEMORY_SETTINGS.CONTEXT_WINDOW.MAX}
                    step="128"
                    value={config.modelParameters?.memory?.context_window ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateMemorySetting('context_window', value);
                    }}
                    placeholder="モデル依存"
                    className={errors.context_window ? 'error' : ''}
                  />
                  <small className="param-range">{MEMORY_SETTINGS.CONTEXT_WINDOW.MIN}-{MEMORY_SETTINGS.CONTEXT_WINDOW.MAX}（トークン数）</small>
                </div>
                {errors.context_window && <span className="error-message">{errors.context_window}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="num_gpu_layers">
                  GPUレイヤー数 (GPU Layers)
                  <Tooltip
                    content="GPUを使用するレイヤー数です。0にするとCPUのみで動作します。GPUが利用可能な場合、値を大きくすると高速化できますが、VRAM使用量が増加します（推奨: モデル依存、0=CPUのみ）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="num_gpu_layers"
                    type="number"
                    min={MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}
                    max={MEMORY_SETTINGS.NUM_GPU_LAYERS.MAX}
                    step="1"
                    value={config.modelParameters?.memory?.num_gpu_layers ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateMemorySetting('num_gpu_layers', value);
                    }}
                    placeholder="モデル依存（0=CPUのみ）"
                    className={errors.num_gpu_layers ? 'error' : ''}
                  />
                  <small className="param-range">{MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}-{MEMORY_SETTINGS.NUM_GPU_LAYERS.MAX}（{MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}=CPUのみ）</small>
                </div>
                {errors.num_gpu_layers && <span className="error-message">{errors.num_gpu_layers}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="num_threads">
                  CPUスレッド数 (CPU Threads)
                  <Tooltip
                    content="使用するCPUスレッド数です。通常はシステムのコア数に合わせて設定します。値を大きくすると処理速度が向上する場合があります（推奨: システム依存）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="num_threads"
                    type="number"
                    min={MEMORY_SETTINGS.NUM_THREADS.MIN}
                    max={MEMORY_SETTINGS.NUM_THREADS.MAX}
                    step="1"
                    value={config.modelParameters?.memory?.num_threads ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateMemorySetting('num_threads', value);
                    }}
                    placeholder="システム依存"
                    className={errors.num_threads ? 'error' : ''}
                  />
                  <small className="param-range">{MEMORY_SETTINGS.NUM_THREADS.MIN}-{MEMORY_SETTINGS.NUM_THREADS.MAX}</small>
                </div>
                {errors.num_threads && <span className="error-message">{errors.num_threads}</span>}
              </div>

              <div className="param-row">
                <label htmlFor="batch_size">
                  バッチサイズ (Batch Size)
                  <Tooltip
                    content="一度に処理するトークン数です。値を大きくすると処理速度が向上する場合がありますが、メモリ使用量が増加します（推奨: 512）。"
                    position="right"
                  >
                    <span className="tooltip-trigger-icon">ℹ️</span>
                  </Tooltip>
                </label>
                <div className="param-input-group">
                  <input
                    id="batch_size"
                    type="number"
                    min={MEMORY_SETTINGS.BATCH_SIZE.MIN}
                    max={MEMORY_SETTINGS.BATCH_SIZE.MAX}
                    step="1"
                    value={config.modelParameters?.memory?.batch_size ?? MEMORY_SETTINGS.BATCH_SIZE.DEFAULT}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      updateMemorySetting('batch_size', value);
                    }}
                    className={errors.batch_size ? 'error' : ''}
                  />
                  <small className="param-range">{MEMORY_SETTINGS.BATCH_SIZE.MIN}-{MEMORY_SETTINGS.BATCH_SIZE.MAX}（推奨: {MEMORY_SETTINGS.BATCH_SIZE.DEFAULT}）</small>
                </div>
                {errors.batch_size && <span className="error-message">{errors.batch_size}</span>}
              </div>

              <div className="param-row">
                <label className="checkbox-label">
                  <Tooltip
                    content="メモリマップドファイルを使用してモデルを読み込みます。有効にすると、起動時間が短縮され、メモリ使用量が削減されます（推奨: 有効）。"
                    position="right"
                  >
                    <input
                      type="checkbox"
                      checked={config.modelParameters?.memory?.use_mmap ?? true}
                      onChange={(e) => updateMemorySetting('use_mmap', e.target.checked)}
                    />
                  </Tooltip>
                  <span>メモリマップドファイルを使用 (Use MMAP)</span>
                </label>
              </div>

              <div className="param-row">
                <label className="checkbox-label">
                  <Tooltip
                    content="メモリをロックして、スワップに移行しないようにします。有効にすると、パフォーマンスが向上する場合がありますが、システムメモリが不足する可能性があります（推奨: 無効）。"
                    position="right"
                  >
                    <input
                      type="checkbox"
                      checked={config.modelParameters?.memory?.use_mlock ?? false}
                      onChange={(e) => updateMemorySetting('use_mlock', e.target.checked)}
                    />
                  </Tooltip>
                  <span>メモリをロック (Use MLock)</span>
                </label>
              </div>

              <div className="param-row">
                <label className="checkbox-label">
                  <Tooltip
                    content="低メモリモードを有効にします。メモリが少ない環境で使用しますが、パフォーマンスが低下する可能性があります（推奨: 無効）。"
                    position="right"
                  >
                    <input
                      type="checkbox"
                      checked={config.modelParameters?.memory?.low_mem ?? false}
                      onChange={(e) => updateMemorySetting('low_mem', e.target.checked)}
                    />
                  </Tooltip>
                  <span>低メモリモード (Low Memory Mode)</span>
                </label>
              </div>

              <div className="param-reset">
                <button
                  type="button"
                  className="param-reset-button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      modelParameters: {
                        ...config.modelParameters,
                        memory: {
                          batch_size: MEMORY_SETTINGS.BATCH_SIZE.DEFAULT,
                          use_mmap: true,
                          use_mlock: false,
                          low_mem: false,
                        },
                      },
                    });
                  }}
                >
                  メモリ設定をデフォルト値にリセット
                </button>
              </div>
            </div>
          )}
        </div>

        {/* マルチモーダル機能設定 */}
        {model.capabilities && (model.capabilities.vision || model.capabilities.audio || model.capabilities.video) && (
          <div className="form-group">
            <div className="advanced-params-header">
              <button
                type="button"
                className="advanced-params-toggle"
                onClick={() => setShowMultimodalSettings(!showMultimodalSettings)}
                {...(showMultimodalSettings ? { 'aria-expanded': 'true' as const } : { 'aria-expanded': 'false' as const })}
              >
                <span>{showMultimodalSettings ? '▼' : '▶'}</span>
                <span>マルチモーダル機能設定（画像・音声・動画）</span>
              </button>
              <Tooltip
                content="このモデルは画像・音声・動画を処理できます。各機能を有効化すると、対応するAPIエンドポイントが利用可能になります。"
                position="right"
              >
                <span className="tooltip-trigger-icon">ℹ️</span>
              </Tooltip>
            </div>
            
            {showMultimodalSettings && (
              <div className="advanced-params-content">
                {/* 機能の有効化 */}
                {model.capabilities.vision && (
                  <div className="param-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.multimodal?.enableVision ?? false}
                        onChange={(e) => updateMultimodalSetting('enableVision', e.target.checked)}
                      />
                      <span>🖼️ 画像処理機能を有効化</span>
                      <Tooltip
                        content="画像認識・画像説明・画像生成などの機能を有効化します。"
                        position="right"
                      >
                        <span className="tooltip-trigger-icon">ℹ️</span>
                      </Tooltip>
                    </label>
                  </div>
                )}

                {model.capabilities.audio && (
                  <div className="param-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.multimodal?.enableAudio ?? false}
                        onChange={(e) => updateMultimodalSetting('enableAudio', e.target.checked)}
                      />
                      <span>🎵 音声処理機能を有効化</span>
                      <Tooltip
                        content="音声認識・音声合成・音声変換などの機能を有効化します。"
                        position="right"
                      >
                        <span className="tooltip-trigger-icon">ℹ️</span>
                      </Tooltip>
                    </label>
                  </div>
                )}

                {model.capabilities.video && (
                  <div className="param-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.multimodal?.enableVideo ?? false}
                        onChange={(e) => updateMultimodalSetting('enableVideo', e.target.checked)}
                      />
                      <span>🎬 動画処理機能を有効化</span>
                      <Tooltip
                        content="動画認識・動画生成などの機能を有効化します。"
                        position="right"
                      >
                        <span className="tooltip-trigger-icon">ℹ️</span>
                      </Tooltip>
                    </label>
                  </div>
                )}

                {/* ファイルサイズ制限 */}
                {config.multimodal?.enableVision && (
                  <div className="param-row">
                    <label htmlFor="maxImageSize">
                      最大画像サイズ (MB)
                      <Tooltip
                        content="アップロード可能な画像の最大サイズです（デフォルト: 10MB）。"
                        position="right"
                      >
                        <span className="tooltip-trigger-icon">ℹ️</span>
                      </Tooltip>
                    </label>
                    <div className="param-input-group">
                      <input
                        id="maxImageSize"
                        type="number"
                        min={MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MIN}
                        max={MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MAX}
                        step="1"
                        value={config.multimodal?.maxImageSize ?? MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.DEFAULT}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                          updateMultimodalSetting('maxImageSize', value);
                        }}
                      />
                      <small className="param-range">{MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MIN}-{MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MAX} MB</small>
                    </div>
                  </div>
                )}

                {config.multimodal?.enableAudio && (
                  <div className="param-row">
                    <label htmlFor="maxAudioSize">
                      最大音声サイズ (MB)
                      <Tooltip
                        content="アップロード可能な音声ファイルの最大サイズです（デフォルト: 50MB）。"
                        position="right"
                      >
                        <span className="tooltip-trigger-icon">ℹ️</span>
                      </Tooltip>
                    </label>
                    <div className="param-input-group">
                      <input
                        id="maxAudioSize"
                        type="number"
                        min={MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MIN}
                        max={MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MAX}
                        step="1"
                        value={config.multimodal?.maxAudioSize ?? MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.DEFAULT}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                          updateMultimodalSetting('maxAudioSize', value);
                        }}
                      />
                      <small className="param-range">{MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MIN}-{MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MAX} MB</small>
                    </div>
                  </div>
                )}

                {config.multimodal?.enableVideo && (
                  <div className="param-row">
                    <label htmlFor="maxVideoSize">
                      最大動画サイズ (MB)
                      <Tooltip
                        content="アップロード可能な動画ファイルの最大サイズです（デフォルト: 100MB）。"
                        position="right"
                      >
                        <span className="tooltip-trigger-icon">ℹ️</span>
                      </Tooltip>
                    </label>
                    <div className="param-input-group">
                      <input
                        id="maxVideoSize"
                        type="number"
                        min={MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MIN}
                        max={MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MAX}
                        step="1"
                        value={config.multimodal?.maxVideoSize ?? MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.DEFAULT}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                          updateMultimodalSetting('maxVideoSize', value);
                        }}
                      />
                      <small className="param-range">{MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MIN}-{MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MAX} MB</small>
                    </div>
                  </div>
                )}

                <div className="param-reset">
                  <button
                    type="button"
                    className="param-reset-button"
                    onClick={() => {
                      setConfig({
                        ...config,
                        multimodal: {
                          enableVision: model.capabilities?.vision || false,
                          enableAudio: model.capabilities?.audio || false,
                          enableVideo: model.capabilities?.video || false,
                          maxImageSize: MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.DEFAULT,
                          maxAudioSize: MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.DEFAULT,
                          maxVideoSize: MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.DEFAULT,
                          supportedImageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                          supportedAudioFormats: ['mp3', 'wav', 'ogg', 'm4a'],
                          supportedVideoFormats: ['mp4', 'webm', 'mov'],
                        },
                      });
                    }}
                  >
                    マルチモーダル設定をデフォルト値にリセット
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onBack} className="button-secondary">
            戻る
          </button>
          <button type="submit" className="button-primary">
            作成
          </button>
        </div>
      </form>
    </div>
  );
};

