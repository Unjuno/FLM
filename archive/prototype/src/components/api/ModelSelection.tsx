// SPDX-License-Identifier: MIT
// ModelSelection - モデル選択コンポーネント

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { safeInvoke } from '../../utils/tauri';
// import { listen } from '@tauri-apps/api/event';
// import { ModelDownloadProgress } from '../models/ModelDownloadProgress';
import type { SelectedModel } from '../../types/api';
import { loadWebModelConfig } from '../../utils/webModelConfig';
import type { WebModelDefinition } from '../../types/webModel';
import { useOllamaProcess } from '../../hooks/useOllama';
import { FORMATTING } from '../../constants/config';
import { formatBytes, formatDate } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import { isDev } from '../../utils/env';
import { useI18n } from '../../contexts/I18nContext';
import { extractErrorMessage } from '../../utils/errorHandler';
import { useIsMounted } from '../../hooks/useIsMounted';
import { ModelSelectionSidebar } from './ModelSelectionSidebar';
import { ModelSelectionMain } from './ModelSelectionMain';
import type { OllamaModel } from './ModelSelectionSidebar';
import './ModelSelection.css';

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
  ollama: 'Ollama',
  lm_studio: 'LM Studio',
  vllm: 'vLLM',
  llama_cpp: 'llama.cpp',
};

const ModelSelectionComponent: React.FC<ModelSelectionProps> = ({
  onModelSelected,
  selectedModel,
  engineType = 'ollama',
  onEngineChange,
}) => {
  const { t } = useI18n();
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [catalogModels, setCatalogModels] = useState<
    Array<{
      name: string;
      description?: string | null;
      size?: number | null;
      parameters?: number | null;
      category?: string | null;
      recommended: boolean;
      author?: string | null;
      license?: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'installed' | 'catalog' | 'all'>(
    'all'
  );
  const [localSelectedModel, setLocalSelectedModel] =
    useState<OllamaModel | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>(engineType);
  const [availableEngines, setAvailableEngines] = useState<string[]>([
    'ollama',
  ]);
  const [mode] = useState<'all' | 'web'>('all');
  const [webModels, setWebModels] = useState<WebModelDefinition[]>([]);
  const [webModelLoading, setWebModelLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [catalogLoading, setCatalogLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedWebModel, _setSelectedWebModel] =
    useState<WebModelDefinition | null>(null);
  const [_installedModelNames, setInstalledModelNames] = useState<Set<string>>(
    new Set()
  );
  // installedModelNamesは将来使用予定（モデルのインストール状態を表示するため）
  // const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  // const [downloadProgress, setDownloadProgress] = useState<{ progress: number; status: string } | null>(null);

  // アンマウント状態を追跡するためのフック
  const isMounted = useIsMounted();

  // Ollamaプロセス管理フック
  const { start: startOllama, isStarting: isOllamaStarting } =
    useOllamaProcess();

  // エンジン起動状態を管理（すべてのエンジン対応）
  const [engineStarting, setEngineStarting] = useState<{
    [key: string]: boolean;
  }>({});
  const [engineStartingMessage, setEngineStartingMessage] = useState<
    string | null
  >(null);

  // 自動起動試行回数を追跡（無限ループを防ぐため）
  const autoStartAttemptedRef = useRef(false);

  // エンジン起動中のフラグ（連打防止）
  const isEngineStartingRef = useRef(false);

  // 推奨モデルのリスト
  const recommendedModels = [
    'llama3',
    'llama3.2',
    'mistral',
    'codellama',
    'phi3',
  ];

  // モデルの機能を検出（モデル名から推測）
  const detectModelCapabilities = useCallback(
    (
      modelName: string
    ): { vision: boolean; audio: boolean; video: boolean } => {
      const name = modelName.toLowerCase();
      return {
        vision:
          name.includes('llava') ||
          name.includes('vision') ||
          name.includes('clip') ||
          name.includes('blip'),
        audio:
          name.includes('whisper') ||
          name.includes('audio') ||
          name.includes('speech') ||
          name.includes('asr'),
        video:
          name.includes('video') ||
          name.includes('video-') ||
          name.includes('vid2vid'),
      };
    },
    []
  );

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
      const engines = await safeInvoke<string[]>('get_available_engines');
      setAvailableEngines(engines);
    } catch (err) {
      logger.error('エンジン一覧の取得に失敗', err, 'ModelSelection');
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
      if (isDev()) {
        logger.error(
          'Webサイト用モデル設定の読み込みに失敗',
          err instanceof Error ? err : new Error(extractErrorMessage(err)),
          'ModelSelection'
        );
      }
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

  // エンジン選択時にインストール状態を確認
  const [engineDetectionResult, setEngineDetectionResult] = useState<{
    installed: boolean;
    running: boolean;
    message?: string;
  } | null>(null);
  const [checkingEngine, setCheckingEngine] = useState(false);

  // エンジンタイプが変更されたときにインストール状態を確認し、必要なら自動起動
  // 高頻度レンダリングを防ぐため、前回のエンジンを保持して変更時のみチェック
  const prevEngineRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // エンジンが実際に変更された場合のみチェック（高頻度レンダリングを防ぐ）
    if (prevEngineRef.current === selectedEngine) {
      return;
    }

    // 既にチェック中の場合はスキップ
    if (isCheckingRef.current) {
      return;
    }

    prevEngineRef.current = selectedEngine;

    const checkEngineStatusAndAutoStart = async () => {
      if (!selectedEngine) {
        setEngineDetectionResult(null);
        isCheckingRef.current = false;
        return;
      }

      try {
        isCheckingRef.current = true;
        setCheckingEngine(true);
        const result = await safeInvoke<{
          engine_type: string;
          installed: boolean;
          running: boolean;
          version?: string | null;
          path?: string | null;
          message?: string | null;
        }>('detect_engine', { engineType: selectedEngine });

        if (isMounted()) {
          setEngineDetectionResult({
            installed: result.installed,
            running: result.running,
            message: result.message || undefined,
          });

          // エンジンがインストールされているが、起動していない場合は自動起動
          if (
            result.installed &&
            !result.running &&
            !isEngineStartingRef.current
          ) {
            // 自動起動を試みる（サイレント実行）
            isEngineStartingRef.current = true;
            setEngineStarting(prev => ({ ...prev, [selectedEngine]: true }));
            const engineName = ENGINE_NAMES[selectedEngine] || selectedEngine;
            setEngineStartingMessage(
              t('engine.starting.message', { engineName })
            );

            try {
              // 最大3回リトライ（大衆向けのため、より確実に起動させる）
              let startSuccess = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  if (selectedEngine === 'ollama') {
                    await startOllama();
                  } else {
                    // 他のエンジンの場合
                    await safeInvoke('start_engine', {
                      engineType: selectedEngine,
                      config: null,
                    });
                  }

                  // 起動確認のため待機（リトライ回数に応じて待機時間を延長）
                  const waitTime = 2000 + (attempt - 1) * 1000;
                  await new Promise(resolve => setTimeout(resolve, waitTime));

                  // 再検出して状態を更新
                  const recheckResult = await safeInvoke<{
                    engine_type: string;
                    installed: boolean;
                    running: boolean;
                    version?: string | null;
                    path?: string | null;
                    message?: string | null;
                  }>('detect_engine', { engineType: selectedEngine });

                  if (recheckResult.running) {
                    if (isMounted()) {
                      setEngineDetectionResult({
                        installed: recheckResult.installed,
                        running: recheckResult.running,
                        message: recheckResult.message || undefined,
                      });
                    }
                    startSuccess = true;
                    logger.info(
                      `${engineName}を自動起動しました（試行回数: ${attempt}）`,
                      'ModelSelection'
                    );
                    break;
                  } else if (attempt < 3) {
                    // 次の試行に進む
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                } catch (attemptErr) {
                  if (attempt < 3) {
                    // 次の試行に進む
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                  }
                  throw attemptErr;
                }
              }

              if (!startSuccess) {
                throw new Error(
                  `${engineName}の起動確認に失敗しました（3回試行）`
                );
              }
            } catch (startErr) {
              // 起動に失敗した場合、ユーザーに分かりやすいメッセージを表示
              const errorMessage =
                startErr instanceof Error ? startErr.message : String(startErr);
              logger.warn(
                `${engineName}の自動起動に失敗しました: ${errorMessage}`,
                'ModelSelection'
              );

              // エラー状態を設定（ユーザーに表示）
              if (isMounted()) {
                const friendlyMessage =
                  selectedEngine === 'ollama'
                    ? `${engineName}の自動起動に失敗しました。ホーム画面から「Ollamaセットアップ」を実行するか、Ollamaアプリケーションを起動してから再度お試しください。`
                    : `${engineName}の自動起動に失敗しました。${engineName}アプリケーションを起動してから再度お試しください。詳しい手順はヘルプページをご覧ください。`;
                setEngineDetectionResult(prev => ({
                  ...prev!,
                  running: false,
                  message: friendlyMessage,
                }));
              }
            } finally {
              if (isMounted()) {
                setEngineStarting(prev => {
                  const newState = { ...prev };
                  delete newState[selectedEngine];
                  return newState;
                });
                setEngineStartingMessage(null);
              }
              isEngineStartingRef.current = false;
            }
          }
        }
      } catch (err) {
        logger.error('エンジン検出エラー', err, 'ModelSelection');
        if (isMounted()) {
          // エラーメッセージを詳細に取得
          let errorMessage = t('engine.detectionFailed');
          if (err instanceof Error) {
            errorMessage = err.message || errorMessage;
          } else if (typeof err === 'string') {
            errorMessage = err;
          }

          // Ollamaの場合、より詳細なメッセージを追加
          if (selectedEngine === 'ollama') {
            errorMessage = t('engine.ollama.detectionFailed', { errorMessage });
          }

          setEngineDetectionResult({
            installed: false,
            running: false,
            message: errorMessage,
          });
        }
      } finally {
        isCheckingRef.current = false;
        if (isMounted()) {
          setCheckingEngine(false);
        }
      }
    };

    checkEngineStatusAndAutoStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEngine]); // isMounted, t, startOllamaは安定した参照なので依存配列から除外

  // 既に選択されているモデルがある場合は、ローカル状態を初期化
  // 高頻度レンダリングを防ぐため、前回の値を保持して変更時のみ更新
  const prevSelectedModelRef = useRef<SelectedModel | null>(null);
  const prevModelsLengthRef = useRef<number>(0);
  const prevLocalSelectedModelRef = useRef<OllamaModel | null>(null);

  useEffect(() => {
    // selectedModelが変更された場合のみ処理
    const selectedModelChanged =
      prevSelectedModelRef.current?.name !== selectedModel?.name;

    // modelsの長さが変更された場合のみ処理（参照の変更を無視）
    const modelsLengthChanged = prevModelsLengthRef.current !== models.length;

    // 両方とも変更されていない場合はスキップ
    if (!selectedModelChanged && !modelsLengthChanged) {
      return;
    }

    prevSelectedModelRef.current = selectedModel;
    prevModelsLengthRef.current = models.length;

    if (!selectedModel) {
      // selectedModelがnullの場合は、ローカル選択もクリア
      if (prevLocalSelectedModelRef.current !== null) {
        setLocalSelectedModel(null);
        prevLocalSelectedModelRef.current = null;
      }
      return;
    }

    if (models.length > 0) {
      const found = models.find(m => m.name === selectedModel.name);
      if (found) {
        // 見つかったモデルが前回のローカル選択と異なる場合のみ更新
        if (prevLocalSelectedModelRef.current?.name !== found.name) {
          setLocalSelectedModel(found);
          prevLocalSelectedModelRef.current = found;
        }
      } else {
        // 選択されたモデルが現在のエンジンのモデルリストに存在しない場合
        // ローカル選択をクリア（親コンポーネントのselectedModelはそのまま）
        if (prevLocalSelectedModelRef.current !== null) {
          setLocalSelectedModel(null);
          prevLocalSelectedModelRef.current = null;
        }
      }
    }
    // selectedModelはあるが、modelsがまだ読み込まれていない場合は何もしない
    // modelsが読み込まれるとこのuseEffectが再実行される
  }, [selectedModel, models.length]);

  // モデル一覧を取得（useCallbackでメモ化）
  const loadModels = useCallback(async () => {
    // アンマウントチェック
    if (!isMounted()) return;

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
        const ollamaResult = await safeInvoke<
          Array<{
            name: string;
            size?: number | null;
            modified_at: string; // 必須
            parameter_size?: string | null;
          }>
        >('get_models_list');

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
        result = await safeInvoke<
          Array<{
            name: string;
            size?: number | null;
            modified_at?: string | null;
            parameter_size?: string | null;
          }>
        >('get_engine_models', {
          engineType: selectedEngine,
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
      if (!isMounted()) return;
      setModels(modelsData);
      // 成功したらエラーをクリアし、自動起動試行フラグをリセット
      setError(null);
      autoStartAttemptedRef.current = false;
    } catch (err) {
      // アンマウントチェック
      if (!isMounted()) return;

      // エラーの場合、ユーザーフレンドリーなメッセージを表示
      const errorMessage =
        err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました';
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

      // エンジンが起動していない場合、自動起動を試みる（すべてのエンジン対応、複数回リトライ可能）
      if (isEngineNotRunningError && !isEngineStartingRef.current) {
        // 自動起動を試みる（最大3回）
        const maxRetries = 3;
        let lastError: Error | null = null;

        // 起動中フラグを設定（連打防止）
        isEngineStartingRef.current = true;
        setEngineStarting(prev => ({ ...prev, [selectedEngine]: true }));
        setEngineStartingMessage(`${engineName}を起動中...`);

        for (let retry = 0; retry < maxRetries; retry++) {
          try {
            // エラーを一時的にクリア
            setError(null);
            setLoading(true);

            // エンジンを自動起動
            if (selectedEngine === 'ollama') {
              await startOllama();
            } else {
              // 他のエンジンの場合
              await safeInvoke('start_engine', {
                engineType: selectedEngine,
                config: null,
              });
            }

            // 起動確認のため待機（リトライ回数に応じて待機時間を延長）
            await new Promise(resolve =>
              setTimeout(resolve, (retry + 1) * 2000)
            );

            // 再読み込み
            await loadModels();
            // 成功した場合は自動起動試行フラグをリセット
            autoStartAttemptedRef.current = false;

            // 起動中フラグを解除
            if (isMounted()) {
              setEngineStarting(prev => {
                const newState = { ...prev };
                delete newState[selectedEngine];
                return newState;
              });
              setEngineStartingMessage(null);
            }
            isEngineStartingRef.current = false;

            return; // 成功した場合は終了
          } catch (startErr) {
            lastError =
              startErr instanceof Error
                ? startErr
                : new Error(String(startErr));
            // 最後のリトライでも失敗した場合のみログに記録（サイレント失敗）
            if (retry === maxRetries - 1) {
              // 最大リトライ回数に達した場合のみログに記録（エラーメッセージは表示しない）
              logger.warn(
                `${engineName}の自動起動に失敗しました（${maxRetries}回試行）`,
                lastError instanceof Error
                  ? lastError.message
                  : String(lastError),
                'ModelSelection'
              );
              // エラーメッセージは表示しない（サイレント失敗）
            }
            // リトライのため少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // すべてのリトライが失敗した場合は、エラーメッセージを表示しない（サイレント失敗）
        autoStartAttemptedRef.current = false; // リセットして次回も試行可能にする

        // 起動中フラグを解除
        if (isMounted()) {
          setEngineStarting(prev => {
            const newState = { ...prev };
            delete newState[selectedEngine];
            return newState;
          });
          setEngineStartingMessage(null);
        }
        isEngineStartingRef.current = false;

        return;
      } else {
        // その他のエラーの場合
        if (isMounted()) {
          setError(errorMessage);
        }
      }

      // 開発用: サンプルデータを表示（デバッグ時のみ）
      if (isDev() && isMounted()) {
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
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [selectedEngine, startOllama, isMounted]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // インストール済みモデル名のリストを取得
  useEffect(() => {
    if (selectedEngine === 'ollama') {
      const loadInstalledModels = async () => {
        try {
          const installed = await safeInvoke<Array<{ name: string }>>(
            'get_installed_models'
          );
          setInstalledModelNames(new Set(installed.map(m => m.name)));
        } catch (err) {
          // エラーが発生しても続行（インストール済みリストが取得できないだけ）
          logger.warn(
            'インストール済みモデル一覧の取得に失敗',
            extractErrorMessage(err),
            'ModelSelection'
          );
        }
      };
      loadInstalledModels();
    }
  }, [selectedEngine]);

  // モデルがインストール済みかどうかを確認（将来使用予定）
  // const _isModelInstalled = useCallback((modelName: string): boolean => {
  //   return installedModelNames.has(modelName);
  // }, [installedModelNames]);

  // モデルカタログを取得
  const loadCatalogModels = useCallback(async () => {
    if (!isMounted()) return;

    setCatalogLoading(true);
    try {
      const catalogModels = await safeInvoke<
        Array<{
          name: string;
          description?: string | null;
          size?: number | null;
          parameters?: number | null;
          category?: string | null;
          recommended: boolean;
          author?: string | null;
          license?: string | null;
          modified_at?: string | null;
        }>
      >('get_model_catalog');

      if (isMounted()) {
        setCatalogModels(catalogModels || []);
      }
    } catch (err) {
      const errorMessage = extractErrorMessage(err);
      logger.warn(
        `モデルカタログの取得に失敗しました: ${errorMessage}`,
        'ModelSelection'
      );
      // カタログ取得失敗はエラーとして表示しない（オプション機能のため）
    } finally {
      if (isMounted()) {
        setCatalogLoading(false);
      }
    }
  }, [isMounted]);

  // コンポーネントマウント時にカタログモデルを読み込む
  useEffect(() => {
    loadCatalogModels();
  }, [loadCatalogModels]);

  // カタログモデルをOllamaModel形式に変換
  const catalogModelsAsOllama = useMemo(() => {
    return catalogModels.map(model => ({
      name: model.name,
      size: model.size ? Number(model.size) : 0,
      modified_at: new Date().toISOString(),
      parameter_size: model.parameters
        ? `${(model.parameters / 1_000_000_000).toFixed(1)}B`
        : undefined,
      family: model.category || undefined,
      description: model.description || undefined,
      recommended: model.recommended,
    }));
  }, [catalogModels]);

  // 表示するモデルリスト（インストール済み + カタログ）
  const displayModels = useMemo(() => {
    if (viewMode === 'installed') {
      return models;
    } else if (viewMode === 'catalog') {
      return catalogModelsAsOllama;
    } else {
      // 'all'モード: インストール済みとカタログを統合（重複を除去）
      const installedNames = new Set(models.map(m => m.name));
      const catalogOnly = catalogModelsAsOllama.filter(
        m => !installedNames.has(m.name)
      );
      return [...models, ...catalogOnly];
    }
  }, [models, catalogModelsAsOllama, viewMode]);

  // モデル名からカテゴリを取得
  const getCategoryFromName = useCallback((modelName: string): string => {
    const name = modelName.toLowerCase();
    // 埋め込みモデル（優先度: 高）
    if (
      name.includes('embed') ||
      name.includes('embedding') ||
      name.includes('nomic-embed') ||
      name.includes('bge') ||
      name.includes('e5') ||
      name.includes('all-minilm') ||
      name.includes('mxbai-embed')
    )
      return 'embedding';
    // 画像生成モデル
    if (
      name.includes('image') &&
      (name.includes('gen') ||
        name.includes('diffusion') ||
        name.includes('stable-diffusion'))
    )
      return 'image-generation';
    // 音声生成モデル
    if (
      name.includes('tts') ||
      (name.includes('audio') && name.includes('gen')) ||
      name.includes('voice')
    )
      return 'audio-generation';
    // 動画生成モデル
    if (
      name.includes('video') &&
      (name.includes('gen') || name.includes('generation'))
    )
      return 'video-generation';
    // 画像認識モデル
    if (
      name.includes('vision') ||
      name.includes('llava') ||
      name.includes('clip') ||
      name.includes('blip')
    )
      return 'vision';
    // 音声処理モデル
    if (
      name.includes('audio') ||
      name.includes('whisper') ||
      name.includes('speech') ||
      name.includes('asr')
    )
      return 'audio';
    // マルチモーダルモデル
    if (
      name.includes('multimodal') ||
      name.includes('bakllava') ||
      (name.includes('vision') && name.includes('audio'))
    )
      return 'multimodal';
    // コード生成モデル
    if (name.includes('code') || name.includes('coder')) return 'code';
    // チャットモデル
    if (name.includes('chat')) return 'chat';
    return 'other';
  }, []);

  // 検索フィルタ（useMemoでメモ化）
  const filteredModels = useMemo(() => {
    let filtered = displayModels;

    // 検索クエリでフィルタ
    if (searchQuery) {
      filtered = filtered.filter(
        model =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (model.description &&
            model.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // カテゴリでフィルタ
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(model => {
        const category = model.family || getCategoryFromName(model.name);
        return category === selectedCategory;
      });
    }

    // サイズでフィルタ
    if (selectedSizeFilter !== 'all') {
      filtered = filtered.filter(model => {
        if (!model.size || model.size === 0)
          return selectedSizeFilter === 'unknown';
        const sizeGB = model.size / (1024 * 1024 * 1024);
        switch (selectedSizeFilter) {
          case 'small':
            return sizeGB < 3;
          case 'medium':
            return sizeGB >= 3 && sizeGB < 10;
          case 'large':
            return sizeGB >= 10 && sizeGB < 30;
          case 'xlarge':
            return sizeGB >= 30;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [
    displayModels,
    searchQuery,
    selectedCategory,
    selectedSizeFilter,
    getCategoryFromName,
  ]);

  // formatSizeはformatBytesユーティリティを使用（メモ化不要）

  // 推奨モデルかどうか
  const isRecommended = (modelName: string): boolean => {
    return recommendedModels.some(rec =>
      modelName.toLowerCase().includes(rec.toLowerCase())
    );
  };

  const handleModelSelect = (model: OllamaModel) => {
    setLocalSelectedModel(model);
  };

  const handleNext = () => {
    if (localSelectedModel) {
      // 通常のモデル選択の場合
      const capabilities = detectModelCapabilities(localSelectedModel.name);
      const isInstalled = models.some(m => m.name === localSelectedModel.name);

      // カタログモデルで未インストールの場合、ダウンロードが必要であることを通知
      if (!isInstalled) {
        const catalogModel = catalogModels.find(
          m => m.name === localSelectedModel.name
        );
        if (catalogModel) {
          // カタログモデルの場合、ダウンロードが必要
          logger.info(
            `カタログモデル「${localSelectedModel.name}」を選択しました。ダウンロードが必要です。`,
            '',
            'ModelSelection'
          );
        }
      }

      onModelSelected({
        name: localSelectedModel.name,
        size: localSelectedModel.size,
        description:
          localSelectedModel.description ||
          (localSelectedModel.parameter_size
            ? `${localSelectedModel.parameter_size} パラメータ`
            : undefined),
        capabilities: capabilities,
      });
    }
  };

  // カテゴリ表示名を取得（モデル名から推測）
  const getCategoryLabel = useCallback(
    (modelName: string): string => {
      const category = getCategoryFromName(modelName);
      const categoryLabels: Record<string, string> = {
        chat: 'チャット',
        code: 'コード生成',
        translation: '翻訳',
        summarization: '要約',
        qa: '質問応答',
        vision: '画像認識',
        audio: '音声処理',
        multimodal: 'マルチモーダル',
        'image-generation': '画像生成',
        'audio-generation': '音声生成',
        embedding: '埋め込み',
        'video-generation': '動画生成',
        other: 'その他',
      };
      return categoryLabels[category] || 'その他';
    },
    [getCategoryFromName]
  );

  // ローディング中はエラーメッセージを非表示にする（エラーがない場合のみローディング表示）
  const isAnyEngineStarting =
    Object.values(engineStarting).some(v => v) || isOllamaStarting;
  const isLoading = loading || isAnyEngineStarting;

  if (isLoading && !error) {
    return (
      <div className="model-selection-loading">
        <div className="loading-spinner"></div>
        <p>
          {engineStartingMessage || isOllamaStarting
            ? engineStartingMessage || t('engine.starting.ollamaStarting')
            : t('modelSelection.loading')}
        </p>
      </div>
    );
  }

  return (
    <div className="model-selection lmstudio-layout">
      {/* LM Studio風レイアウト: 左サイドバー + 右メインエリア */}
      <ModelSelectionSidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedEngine={selectedEngine}
        availableEngines={availableEngines}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedSizeFilter={selectedSizeFilter}
        onSizeFilterChange={setSelectedSizeFilter}
        filteredModels={filteredModels}
        models={models}
        catalogModelsAsOllama={catalogModelsAsOllama}
        localSelectedModel={localSelectedModel}
        onModelSelect={handleModelSelect}
        isRecommended={isRecommended}
        loading={loading}
        error={error}
        isAnyEngineStarting={isAnyEngineStarting}
        checkingEngine={checkingEngine}
        onRefresh={loadModels}
        onEngineChange={newEngineType => {
          if (onEngineChange) {
            onEngineChange(newEngineType);
          }
          setSelectedEngine(newEngineType);
          setLocalSelectedModel(null);
          setModels([]);
          setError(null);
          setLoading(true);
        }}
      />
      <ModelSelectionMain
        selectedEngine={selectedEngine}
        engineDetectionResult={engineDetectionResult}
        checkingEngine={checkingEngine}
        isAnyEngineStarting={isAnyEngineStarting}
        engineStartingMessage={engineStartingMessage}
        error={error}
        onRetry={() => {
          setError(null);
          loadModels();
        }}
        localSelectedModel={localSelectedModel}
        selectedWebModel={selectedWebModel}
        onNext={handleNext}
        isRecommended={isRecommended}
        detectModelCapabilities={detectModelCapabilities}
        getCategoryLabel={getCategoryLabel}
        formatBytes={formatBytes}
        formatDate={formatDate}
        FORMATTING={FORMATTING}
      />
    </div>
  );
};

// メモ化して不要な再レンダリングを防ぐ
export const ModelSelection = React.memo(
  ModelSelectionComponent,
  (prevProps, nextProps) => {
    // プロップスが実際に変更された場合のみ再レンダリング
    return (
      prevProps.onModelSelected === nextProps.onModelSelected &&
      prevProps.selectedModel?.name === nextProps.selectedModel?.name &&
      prevProps.engineType === nextProps.engineType &&
      prevProps.onEngineChange === nextProps.onEngineChange
    );
  }
);
