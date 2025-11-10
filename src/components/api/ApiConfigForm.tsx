// ApiConfigForm - API設定フォームコンポーネント

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../../utils/tauri';
import type {
  SelectedModel,
  ApiConfig,
  ModelParameters,
  MemorySettings,
  MultimodalSettings,
} from '../../types/api';
import { loadWebModelConfig, findModelById } from '../../utils/webModelConfig';
import {
  PORT_RANGE,
  MODEL_PARAMETERS,
  MEMORY_SETTINGS,
  MULTIMODAL_SETTINGS,
  API_NAME,
  TIMEOUT,
} from '../../constants/config';
import { logger } from '../../utils/logger';
import { isDev } from '../../utils/env';
import { ApiConfigBasicSettings } from './ApiConfigBasicSettings';
import { ApiConfigModelParameters } from './ApiConfigModelParameters';
import { ApiConfigMemorySettings } from './ApiConfigMemorySettings';
import { ApiConfigMultimodalSettings } from './ApiConfigMultimodalSettings';
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
  const [nameGenerated, setNameGenerated] = useState(false);
  const [portDetecting, setPortDetecting] = useState(false);
  const [portDetected, setPortDetected] = useState(false);
  const [engineDetectionResult, setEngineDetectionResult] = useState<{
    installed: boolean;
    running: boolean;
    message?: string;
  } | null>(null);
  const [checkingEngine, setCheckingEngine] = useState(false);

  // アンマウントチェック用のref（メモリリーク対策）
  const isMountedRef = useRef(true);

  // オートセーブ用のref（デバウンス処理）
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const AUTOSAVE_DELAY = 2000; // 2秒後に自動保存

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // クリーンアップ: タイマーをクリア
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
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

  // オートセーブから復元（初回のみ）
  useEffect(() => {
    const autosaveKey = `api_config_autosave_${model.name || 'new'}`;
    try {
      const savedData = localStorage.getItem(autosaveKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // 24時間以内の保存データのみ復元
        const savedTime = new Date(parsed.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24 && parsed.config) {
          // モデルIDが一致する場合のみ復元
          if (parsed.modelName === model.name) {
            setConfig(prevConfig => ({
              ...prevConfig,
              ...parsed.config,
            }));
            if (isDev()) {
              logger.debug('フォーム設定を自動復元しました', 'ApiConfigForm');
            }
          }
        } else {
          // 24時間以上経過したデータは削除
          localStorage.removeItem(autosaveKey);
        }
      }
    } catch (err) {
      // 復元エラーは無視
      logger.warn('オートセーブからの復元に失敗しました', 'ApiConfigForm', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // 現在のポート番号の使用可能性をチェック（将来使用予定）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _checkPortAvailability = useCallback(async (port: number) => {
    try {
      const isAvailable = await safeInvoke<boolean>('check_port_availability', {
        port,
      });

      if (!isAvailable) {
        setErrors(prevErrors => ({
          ...prevErrors,
          port: `ポート ${port} は既に使用されています。別のポート番号を選択してください。`,
        }));
      } else {
        setErrors(prevErrors => {
          const newErrors = { ...prevErrors };
          if (
            newErrors.port &&
            newErrors.port.includes('既に使用されています')
          ) {
            delete newErrors.port;
          }
          return newErrors;
        });
      }
    } catch (err) {
      logger.error('ポート確認エラー', err, 'ApiConfigForm');
    }
  }, []);

  // 利用可能なポートを自動検出して設定
  const autoDetectPort = useCallback(
    async (preferredPort?: number) => {
      try {
        const startPort = preferredPort || config.port || PORT_RANGE.DEFAULT;
        const result = await safeInvoke<{
          recommended_port: number;
          is_available: boolean;
          alternative_ports: number[];
        }>('find_available_port', { start_port: startPort });

        if (result && result.recommended_port) {
          setConfig(prevConfig => ({
            ...prevConfig,
            port: result.recommended_port,
          }));
          // エラーをクリア
          setErrors(prevErrors => {
            const newErrors = { ...prevErrors };
            delete newErrors.port;
            return newErrors;
          });
          return result.recommended_port;
        }
      } catch (err) {
        logger.error('ポート自動検出エラー', err, 'ApiConfigForm');
        // エラーが発生した場合は、デフォルトポートまたは現在のポートを返す
        return preferredPort || config.port || PORT_RANGE.DEFAULT;
      }
      // 検出に失敗した場合は、デフォルトポートまたは現在のポートを返す
      return preferredPort || config.port || PORT_RANGE.DEFAULT;
    },
    [config.port]
  );

  // ポート番号を自動検出（手動ボタン用）
  const detectAvailablePort = useCallback(async () => {
    try {
      setPortDetecting(true);
      setPortDetected(false);
      // エラーをクリア
      setErrors(prevErrors => {
        const newErrors = { ...prevErrors };
        delete newErrors.port;
        return newErrors;
      });

      const startPort = config.port || PORT_RANGE.DEFAULT;
      const result = await safeInvoke<{
        recommended_port: number;
        is_available: boolean;
        alternative_ports: number[];
      }>('find_available_port', { start_port: startPort });

      if (result && result.recommended_port) {
        const detectedPort = result.recommended_port;
        setConfig(prevConfig => ({
          ...prevConfig,
          port: detectedPort,
        }));
        setPortDetected(true);
        // 3秒後に成功メッセージを非表示
        setTimeout(() => setPortDetected(false), 3000);
      } else {
        // 検出に失敗した場合は、デフォルトポートを使用するか、現在のポートを維持
        if (!config.port) {
          setConfig(prevConfig => ({
            ...prevConfig,
            port: PORT_RANGE.DEFAULT,
          }));
        }
        logger.warn(
          'ポート検出で結果が取得できませんでした。デフォルトポートを使用します。',
          'ApiConfigForm'
        );
        setPortDetected(false);
      }
    } catch (err) {
      logger.error('ポート検出エラー', err, 'ApiConfigForm');
      // エラーが発生しても、デフォルトポートを使用して続行
      if (!config.port) {
        setConfig(prevConfig => ({
          ...prevConfig,
          port: PORT_RANGE.DEFAULT,
        }));
      }
      setPortDetected(false);
      // エラーメッセージは表示しない（非致命的なエラーとして扱う）
      // ユーザーは手動でポート番号を変更できる
    } finally {
      setPortDetecting(false);
    }
  }, [config.port]);

  // 初期化時にポートを自動検出（ポートが設定されていない場合、またはデフォルトポートが使用されている場合）
  useEffect(() => {
    const initializePort = async () => {
      // ポートが設定されていない場合、またはデフォルトポートの場合
      if (!config.port || config.port === PORT_RANGE.DEFAULT) {
        // デフォルトポートが使用可能かチェック
        const isDefaultAvailable = await safeInvoke<boolean>(
          'check_port_availability',
          {
            port: PORT_RANGE.DEFAULT,
          }
        );

        if (!isDefaultAvailable) {
          // デフォルトポートが使用中の場合は、自動的に利用可能なポートを検出
          await autoDetectPort(PORT_RANGE.DEFAULT);
        } else if (!config.port) {
          // ポートが設定されていない場合は、デフォルトポートを使用
          setConfig(prevConfig => ({
            ...prevConfig,
            port: PORT_RANGE.DEFAULT,
          }));
        }
      }
    };

    initializePort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // ポート番号が変更されたときに確認（使用中の場合は自動的に代替ポートを検出）
  useEffect(() => {
    if (
      config.port &&
      config.port >= PORT_RANGE.MIN &&
      config.port <= PORT_RANGE.MAX
    ) {
      const timeoutId = setTimeout(async () => {
        const isAvailable = await safeInvoke<boolean>(
          'check_port_availability',
          { port: config.port }
        );

        if (!isAvailable) {
          // ポートが使用中の場合は、自動的に代替ポートを検出
          try {
            const newPort = await autoDetectPort(config.port);
            if (newPort && newPort !== config.port) {
              // 代替ポートが見つかった場合、ユーザーに通知
              setErrors(prevErrors => ({
                ...prevErrors,
                port: `ポート ${config.port} は既に使用されています。自動的にポート ${newPort} に変更しました。`,
              }));
              // エラーメッセージを3秒後にクリア
              setTimeout(() => {
                setErrors(prevErrors => {
                  const newErrors = { ...prevErrors };
                  delete newErrors.port;
                  return newErrors;
                });
              }, 3000);
            } else {
              // 代替ポートが見つからない場合は、警告のみ表示（エラーではない）
              logger.warn(
                `ポート ${config.port} は使用中ですが、代替ポートの検出に失敗しました。API作成時に自動的に利用可能なポートが選択されます。`,
                'ApiConfigForm'
              );
            }
          } catch (err) {
            // 検出エラーが発生した場合は、警告のみ（API作成時に自動的に処理される）
            logger.warn(
              'ポート検出エラーが発生しましたが、API作成時に自動的に処理されます。',
              'ApiConfigForm',
              err
            );
          }
        } else {
          // ポートが使用可能な場合はエラーをクリア
          setErrors(prevErrors => {
            const newErrors = { ...prevErrors };
            if (
              newErrors.port &&
              newErrors.port.includes('既に使用されています')
            ) {
              delete newErrors.port;
            }
            return newErrors;
          });
        }
      }, TIMEOUT.PORT_CHECK_DELAY);
      return () => clearTimeout(timeoutId);
    }
  }, [config.port, autoDetectPort]);

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
      setNameGenerated(false);
      const result = await safeInvoke<{
        suggested_name: string;
        alternatives: string[];
        is_available: boolean;
      }>('suggest_api_name', { base_name: config.name });

      if (!result.is_available || result.suggested_name !== config.name) {
        setConfig(prevConfig => ({
          ...prevConfig,
          name: result.suggested_name,
        }));
        setErrors(prevErrors => ({ ...prevErrors, name: '' }));
        setNameGenerated(true);
        // 3秒後に成功メッセージを非表示
        setTimeout(() => setNameGenerated(false), 3000);
      } else {
        // 既に使用可能な名前の場合も成功として扱う
        setNameGenerated(true);
        setTimeout(() => setNameGenerated(false), 2000);
      }
    } catch (err) {
      logger.error('API名提案エラー', err, 'ApiConfigForm');
      setNameGenerated(false);
    } finally {
      setNameSuggesting(false);
    }
  }, [config.name]);

  // モデルパラメータの更新
  const updateModelParameter = (
    key: keyof ModelParameters,
    value: number | undefined
  ) => {
    setConfig({
      ...config,
      modelParameters: {
        ...config.modelParameters,
        [key]: value,
      },
    });
  };

  // メモリ設定の更新
  const updateMemorySetting = (
    key: keyof MemorySettings,
    value: number | boolean | undefined
  ) => {
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
  const updateMultimodalSetting = (
    key: keyof MultimodalSettings,
    value: boolean | number | string[] | undefined
  ) => {
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
      .then(webConfig => {
        if (!isMountedRef.current) return;

        const webModel = findModelById(webConfig, model.webModelId!);
        if (webModel && webModel.defaultSettings) {
          const defaultSettings = webModel.defaultSettings;

          setConfig(prevConfig => {
            // 既に設定が適用されている場合はスキップ
            if (
              prevConfig.engineType === webModel.engine &&
              defaultSettings.port &&
              prevConfig.port === defaultSettings.port
            ) {
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
                  ? {
                      ...prevConfig.modelParameters?.memory,
                      ...defaultSettings.memory,
                    }
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
      .catch(err => {
        if (isMountedRef.current) {
          logger.error(
            'Webサイト用モデル設定の読み込みに失敗',
            err,
            'ApiConfigForm'
          );
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

    setConfig(prevConfig => {
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

  // オートセーブ機能: configが変更されたときにlocalStorageに保存
  useEffect(() => {
    // 初回レンダリング時はスキップ
    if (!config.name) {
      return;
    }

    // 既存のタイマーをクリア
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    // デバウンス処理: 2秒後に保存
    autosaveTimeoutRef.current = setTimeout(() => {
      try {
        const autosaveKey = `api_config_autosave_${model.name || 'new'}`;
        const autosaveData = {
          config,
          modelName: model.name,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(autosaveKey, JSON.stringify(autosaveData));
        if (isDev()) {
          logger.debug('フォーム設定を自動保存しました', 'ApiConfigForm');
        }
      } catch (err) {
        // localStorageのエラーは無視（プライベートモードなど）
        logger.warn('オートセーブに失敗しました', 'ApiConfigForm', err);
      }
    }, AUTOSAVE_DELAY);

    // クリーンアップ
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [config, model.name]);

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

      if (
        params.temperature !== undefined &&
        (params.temperature < MODEL_PARAMETERS.TEMPERATURE.MIN ||
          params.temperature > MODEL_PARAMETERS.TEMPERATURE.MAX)
      ) {
        newErrors.temperature = `温度は${MODEL_PARAMETERS.TEMPERATURE.MIN}-${MODEL_PARAMETERS.TEMPERATURE.MAX}の範囲で入力してください`;
      }

      if (
        params.top_p !== undefined &&
        (params.top_p < MODEL_PARAMETERS.TOP_P.MIN ||
          params.top_p > MODEL_PARAMETERS.TOP_P.MAX)
      ) {
        newErrors.top_p = `Top-pは${MODEL_PARAMETERS.TOP_P.MIN}-${MODEL_PARAMETERS.TOP_P.MAX}の範囲で入力してください`;
      }

      if (
        params.top_k !== undefined &&
        (params.top_k < MODEL_PARAMETERS.TOP_K.MIN ||
          params.top_k > MODEL_PARAMETERS.TOP_K.MAX)
      ) {
        newErrors.top_k = `Top-kは${MODEL_PARAMETERS.TOP_K.MIN}-${MODEL_PARAMETERS.TOP_K.MAX}の範囲で入力してください`;
      }

      if (
        params.max_tokens !== undefined &&
        params.max_tokens < MODEL_PARAMETERS.MAX_TOKENS.MIN
      ) {
        newErrors.max_tokens = `最大トークン数は${MODEL_PARAMETERS.MAX_TOKENS.MIN}以上の値を入力してください`;
      }

      if (
        params.repeat_penalty !== undefined &&
        (params.repeat_penalty < MODEL_PARAMETERS.REPEAT_PENALTY.MIN ||
          params.repeat_penalty > MODEL_PARAMETERS.REPEAT_PENALTY.MAX)
      ) {
        newErrors.repeat_penalty = `繰り返しペナルティは${MODEL_PARAMETERS.REPEAT_PENALTY.MIN}-${MODEL_PARAMETERS.REPEAT_PENALTY.MAX}の範囲で入力してください`;
      }

      // メモリ設定のバリデーション
      if (params.memory) {
        const memory = params.memory;

        if (memory.context_window !== undefined) {
          if (memory.context_window < MEMORY_SETTINGS.CONTEXT_WINDOW.MIN) {
            newErrors.context_window = `コンテキストウィンドウサイズは${MEMORY_SETTINGS.CONTEXT_WINDOW.MIN}以上の値を入力してください`;
          } else if (
            memory.context_window > MEMORY_SETTINGS.CONTEXT_WINDOW.MAX
          ) {
            newErrors.context_window = `コンテキストウィンドウサイズは${MEMORY_SETTINGS.CONTEXT_WINDOW.MAX}以下の値を入力してください`;
          }
        }

        if (memory.num_gpu_layers !== undefined) {
          if (memory.num_gpu_layers < MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN) {
            newErrors.num_gpu_layers = `GPUレイヤー数は${MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}以上の値を入力してください`;
          } else if (
            memory.num_gpu_layers > MEMORY_SETTINGS.NUM_GPU_LAYERS.MAX
          ) {
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
      if (isDev()) {
        logger.debug('ApiConfigForm - 送信する設定', 'ApiConfigForm', {
          ...config,
          modelParameters: config.modelParameters,
        });
      }
      
      // オートセーブデータを削除
      try {
        const autosaveKey = `api_config_autosave_${model.name || 'new'}`;
        localStorage.removeItem(autosaveKey);
      } catch (err) {
        // 削除エラーは無視
        logger.warn('オートセーブデータの削除に失敗しました', 'ApiConfigForm', err);
      }
      
      onSubmit(config);
    } else {
      if (isDev()) {
        logger.warn(
          'ApiConfigForm - バリデーションエラー',
          'ApiConfigForm',
          errors
        );
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
        {/* 基本設定セクション */}
        <ApiConfigBasicSettings
          config={config}
          errors={errors}
          onConfigChange={(updates) => setConfig({ ...config, ...updates })}
          availableEngines={availableEngines}
          loadingEngines={loadingEngines}
          nameSuggesting={nameSuggesting}
          nameGenerated={nameGenerated}
          onSuggestName={suggestApiName}
          portDetecting={portDetecting}
          portDetected={portDetected}
          onDetectPort={detectAvailablePort}
          engineDetectionResult={engineDetectionResult}
          checkingEngine={checkingEngine}
        />

        {/* モデル生成パラメータセクション */}
        <ApiConfigModelParameters
          modelParameters={config.modelParameters || {}}
          errors={errors}
          onParameterChange={updateModelParameter}
          showAdvancedParams={showAdvancedParams}
          onToggleAdvancedParams={() => setShowAdvancedParams(!showAdvancedParams)}
        />

        {/* メモリ・リソース設定セクション */}
        <ApiConfigMemorySettings
          memorySettings={config.modelParameters?.memory}
          errors={errors}
          onMemorySettingChange={updateMemorySetting}
          showMemorySettings={showMemorySettings}
          onToggleMemorySettings={() => setShowMemorySettings(!showMemorySettings)}
          onReset={() => {
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
        />

        {/* マルチモーダル機能設定セクション */}
        <ApiConfigMultimodalSettings
          multimodal={config.multimodal}
          model={model}
          errors={errors}
          onMultimodalSettingChange={updateMultimodalSetting}
          showMultimodalSettings={showMultimodalSettings}
          onToggleMultimodalSettings={() =>
                    setShowMultimodalSettings(!showMultimodalSettings)
                  }
          onReset={() => {
                        setConfig({
                          ...config,
                          multimodal: {
                            enableVision: model.capabilities?.vision || false,
                            enableAudio: model.capabilities?.audio || false,
                            enableVideo: model.capabilities?.video || false,
                maxImageSize: MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.DEFAULT,
                maxAudioSize: MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.DEFAULT,
                maxVideoSize: MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.DEFAULT,
                            supportedImageFormats: [
                              'jpg',
                              'jpeg',
                              'png',
                              'gif',
                              'webp',
                            ],
                            supportedAudioFormats: ['mp3', 'wav', 'ogg', 'm4a'],
                            supportedVideoFormats: ['mp4', 'webm', 'mov'],
                          },
                        });
                      }}
        />

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
