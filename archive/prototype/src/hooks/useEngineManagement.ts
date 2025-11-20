// useEngineManagement - エンジン管理用カスタムフック

import { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import { useIsMounted } from './useIsMounted';

/**
 * エンジン検出結果
 */
export interface EngineDetectionResult {
  installed: boolean;
  running: boolean;
  message?: string;
}

/**
 * エンジン管理フックの戻り値
 */
export interface UseEngineManagementReturn {
  /** 利用可能なエンジン一覧 */
  availableEngines: string[];
  /** エンジン読み込み中かどうか */
  loadingEngines: boolean;
  /** エンジン検出結果 */
  engineDetectionResult: EngineDetectionResult | null;
  /** エンジン検出中かどうか */
  checkingEngine: boolean;
  /** エンジンタイプを設定 */
  setEngineType: (engineType: string) => void;
  /** エンジン一覧を読み込み */
  loadAvailableEngines: () => Promise<void>;
  /** エンジンのインストール状態を確認 */
  checkEngineInstallation: (engineType: string) => Promise<void>;
}

/**
 * エンジン管理用カスタムフック
 *
 * @param initialEngineType - 初期エンジンタイプ
 * @param onEngineTypeChange - エンジンタイプ変更時のコールバック
 */
export const useEngineManagement = (
  initialEngineType: string = 'ollama',
  onEngineTypeChange?: (engineType: string) => void
): UseEngineManagementReturn => {
  const [availableEngines, setAvailableEngines] = useState<string[]>([]);
  const [loadingEngines, setLoadingEngines] = useState(false);
  const [engineDetectionResult, setEngineDetectionResult] =
    useState<EngineDetectionResult | null>(null);
  const [checkingEngine, setCheckingEngine] = useState(false);
  const [currentEngineType, setCurrentEngineType] =
    useState<string>(initialEngineType);

  const isMounted = useIsMounted();

  // エンジンタイプを設定
  const setEngineType = useCallback(
    (engineType: string) => {
      setCurrentEngineType(engineType);
      onEngineTypeChange?.(engineType);
    },
    [onEngineTypeChange]
  );

  // 利用可能なエンジン一覧を取得
  const loadAvailableEngines = useCallback(async () => {
    try {
      setLoadingEngines(true);
      const engines = await safeInvoke<string[]>('get_available_engines');
      if (isMounted()) {
        setAvailableEngines(engines);
      }
    } catch (err) {
      logger.error('エンジン一覧の取得に失敗', err, 'useEngineManagement');
      // デフォルトエンジンのみ使用可能とする
      if (isMounted()) {
        setAvailableEngines(['ollama']);
      }
    } finally {
      if (isMounted()) {
        setLoadingEngines(false);
      }
    }
  }, [isMounted]);

  // エンジンのインストール状態を確認
  const checkEngineInstallation = useCallback(
    async (engineType: string) => {
      if (!engineType || engineType === 'ollama') {
        // Ollamaは自動インストールされるため、特別なチェックは不要
        if (isMounted()) {
          setEngineDetectionResult(null);
        }
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
        }>('detect_engine', { engineType });

        if (isMounted()) {
          setEngineDetectionResult({
            installed: result.installed,
            running: result.running,
            message: result.message || undefined,
          });
        }
      } catch (err) {
        logger.error('エンジン検出エラー', err, 'useEngineManagement');
        if (isMounted()) {
          setEngineDetectionResult({
            installed: false,
            running: false,
            message: 'エンジンの検出に失敗しました',
          });
        }
      } finally {
        if (isMounted()) {
          setCheckingEngine(false);
        }
      }
    },
    [isMounted]
  );

  // 初回読み込み時にエンジン一覧を取得
  useEffect(() => {
    loadAvailableEngines();
  }, [loadAvailableEngines]);

  // エンジンタイプが変更されたときにチェック
  useEffect(() => {
    if (currentEngineType) {
      checkEngineInstallation(currentEngineType);
    }
  }, [currentEngineType, checkEngineInstallation]);

  return {
    availableEngines,
    loadingEngines,
    engineDetectionResult,
    checkingEngine,
    setEngineType,
    loadAvailableEngines,
    checkEngineInstallation,
  };
};
