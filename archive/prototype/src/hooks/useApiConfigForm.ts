// SPDX-License-Identifier: MIT
// useApiConfigForm - API設定フォームの状態管理とロジック

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SelectedModel,
  ApiConfig,
  ModelParameters,
  MemorySettings,
  MultimodalSettings,
} from '../types/api';
import { loadWebModelConfig, findModelById } from '../utils/webModelConfig';
import {
  PORT_RANGE,
  MODEL_PARAMETERS,
  MEMORY_SETTINGS,
  MULTIMODAL_SETTINGS,
  API_NAME,
} from '../constants/config';
import { logger } from '../utils/logger';
import { usePortManagement } from './usePortManagement';
import { useEngineManagement } from './useEngineManagement';
import { useApiNameGeneration } from './useApiNameGeneration';
import { useFormAutosave } from './useFormAutosave';
import { useIsMounted } from './useIsMounted';

/**
 * API設定フォームの状態とロジックを管理するカスタムフック
 */
export const useApiConfigForm = (
  model: SelectedModel,
  defaultConfig: ApiConfig
) => {
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
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showMemorySettings, setShowMemorySettings] = useState(false);
  const [showMultimodalSettings, setShowMultimodalSettings] = useState(false);

  // ポート管理フック
  const portManagement = usePortManagement(
    config.port || PORT_RANGE.DEFAULT,
    useCallback((newPort: number) => {
      setConfig(prevConfig => ({ ...prevConfig, port: newPort }));
    }, [])
  );

  // エンジン管理フック
  const engineManagement = useEngineManagement(
    config.engineType || 'ollama',
    useCallback((newEngineType: string) => {
      setConfig(prevConfig => ({ ...prevConfig, engineType: newEngineType }));
    }, [])
  );

  // API名生成フック
  const nameGeneration = useApiNameGeneration(
    useCallback((generatedName: string) => {
      setConfig(prevConfig => ({ ...prevConfig, name: generatedName }));
      setErrors(prevErrors => ({ ...prevErrors, name: '' }));
    }, [])
  );

  // オートセーブフック
  const autosave = useFormAutosave({
    data: config,
    key: `api_config_${model.name || 'new'}`,
    delay: 2000,
    isValid: data => !!data.name,
    metadata: { modelName: model.name },
  });

  // アンマウントチェック用のフック（メモリリーク対策）
  const isMounted = useIsMounted();

  // オートセーブから復元（初回のみ）
  useEffect(() => {
    const restoredData = autosave.restore();
    if (restoredData) {
      // モデル名が一致する場合のみ復元
      const restoredConfig = restoredData as ApiConfig & { modelName?: string };
      if (restoredConfig.modelName === model.name) {
        setConfig(prevConfig => ({
          ...prevConfig,
          ...restoredConfig,
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // ポートエラーをポート管理フックから取得
  useEffect(() => {
    setErrors(prevErrors => {
      if (portManagement.portError) {
        return {
          ...prevErrors,
          port: portManagement.portError,
        };
      }

      if (!prevErrors.port) {
        return prevErrors;
      }

      const { port: _removed, ...rest } = prevErrors;
      return rest;
    });
  }, [portManagement.portError]);

  // ポートが変更されたときにconfigを更新（無限ループを防ぐため、前回の値を保持）
  const prevPortRef = useRef<number | null>(null);
  useEffect(() => {
    // 初回実行時またはポートが実際に変更された場合のみ更新
    if (
      prevPortRef.current === null ||
      portManagement.port !== prevPortRef.current
    ) {
      if (portManagement.port !== config.port) {
        prevPortRef.current = portManagement.port;
        setConfig(prevConfig => ({
          ...prevConfig,
          port: portManagement.port,
        }));
      } else {
        prevPortRef.current = portManagement.port;
      }
    }
  }, [portManagement.port, config.port]);

  // エンジンタイプが変更されたときにconfigを更新（無限ループを防ぐため、前回の値を保持）
  const prevAvailableEnginesRef = useRef<string[]>([]);
  useEffect(() => {
    // 利用可能なエンジンが実際に変更された場合のみ処理
    const enginesChanged =
      prevAvailableEnginesRef.current.length !==
        engineManagement.availableEngines.length ||
      prevAvailableEnginesRef.current.some(
        (eng: string, idx: number) =>
          eng !== engineManagement.availableEngines[idx]
      );

    if (enginesChanged && engineManagement.availableEngines.length > 0) {
      prevAvailableEnginesRef.current = [...engineManagement.availableEngines];
      const currentEngine = config.engineType || 'ollama';
      if (!engineManagement.availableEngines.includes(currentEngine)) {
        // 現在のエンジンが利用可能でない場合は、最初の利用可能なエンジンに変更
        setConfig(prevConfig => ({
          ...prevConfig,
          engineType: engineManagement.availableEngines[0],
        }));
      }
    } else if (enginesChanged) {
      prevAvailableEnginesRef.current = [...engineManagement.availableEngines];
    }
  }, [engineManagement.availableEngines, config.engineType]);

  // API名生成のラッパー
  const suggestApiName = useCallback(async () => {
    const generatedName = await nameGeneration.suggestApiName(
      config.name,
      model.name
    );
    if (generatedName) {
      // 名前はコールバックで既に設定されている
    }
  }, [nameGeneration, config.name, model.name]);

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

    if (!isMounted()) {
      return;
    }

    loadWebModelConfig()
      .then(webConfig => {
        if (!isMounted()) return;

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
        if (isMounted()) {
          logger.error(
            'Webサイト用モデル設定の読み込みに失敗',
            err,
            'useApiConfigForm'
          );
        }
      });
  }, [model.webModelId, isMounted]);

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

  // オートセーブはuseFormAutosaveフックで処理される

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

  return {
    config,
    setConfig,
    errors,
    availableEngines: engineManagement.availableEngines,
    loadingEngines: engineManagement.loadingEngines,
    showAdvancedParams,
    setShowAdvancedParams,
    showMemorySettings,
    setShowMemorySettings,
    showMultimodalSettings,
    setShowMultimodalSettings,
    nameSuggesting: nameGeneration.nameSuggesting,
    nameGenerated: nameGeneration.nameGenerated,
    portDetecting: portManagement.portDetecting,
    portDetected: portManagement.portDetected,
    engineDetectionResult: engineManagement.engineDetectionResult,
    checkingEngine: engineManagement.checkingEngine,
    detectAvailablePort: portManagement.detectAvailablePort,
    suggestApiName,
    updateModelParameter,
    updateMemorySetting,
    updateMultimodalSetting,
    validate,
  };
};
