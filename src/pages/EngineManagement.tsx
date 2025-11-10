// EngineManagement - エンジン管理ページ
// LLMエンジンの検出・起動・停止・設定管理

import React, { useState, useEffect, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import { listen } from '@tauri-apps/api/event';
import './EngineManagement.css';

/**
 * エンジン検出結果
 */
interface EngineDetectionResult {
  engine_type: string;
  installed: boolean;
  running: boolean;
  version?: string | null;
  path?: string | null;
  message?: string | null;
  portable?: boolean | null;
}

/**
 * エンジン設定
 */
interface EngineConfig {
  id: string;
  engine_type: string;
  name: string;
  base_url: string;
  auto_detect: boolean;
  executable_path?: string;
  is_default: boolean;
}

/**
 * エンジン名のマッピング
 */
const ENGINE_NAMES: { [key: string]: string } = {
  ollama: 'Ollama',
  lm_studio: 'LM Studio',
  vllm: 'vLLM',
  llama_cpp: 'llama.cpp',
};

/**
 * エンジン管理ページ
 */
export const EngineManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();
  const [engines, setEngines] = useState<EngineDetectionResult[]>([]);
  const [engineConfigs, setEngineConfigs] = useState<EngineConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  // const [selectedEngine, setSelectedEngine] = useState<string | null>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: 'エンジン管理' },
  ], [t]);

  useEffect(() => {
    loadEngines();
    loadEngineConfigs();
  }, []);

  /**
   * エンジン一覧を読み込む
   */
  const loadEngines = async () => {
    try {
      setLoading(true);
      setError(null);

      const detectedEngines = await safeInvoke<EngineDetectionResult[]>(
        'detect_all_engines',
        {}
      );
      setEngines(detectedEngines);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'エンジン一覧の読み込みに失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * エンジン設定一覧を読み込む
   */
  const loadEngineConfigs = async () => {
    try {
      const configs = await safeInvoke<EngineConfig[]>('get_engine_configs', {
        engine_type: null,
      });
      setEngineConfigs(configs);
    } catch (err) {
      // エラーは静かに処理（設定がない場合もある）
      logger.warn('エンジン設定の読み込みに失敗しました', extractErrorMessage(err), 'EngineManagement');
    }
  };

  /**
   * エンジンを再検出
   */
  const handleDetectEngines = async () => {
    try {
      setDetecting(true);
      setError(null);

      await loadEngines();
      showSuccess('エンジンの検出が完了しました');
    } catch (err) {
      showError(
        extractErrorMessage(err, 'エンジンの検出に失敗しました')
      );
    } finally {
      setDetecting(false);
    }
  };

  /**
   * エンジンを起動
   */
  const handleStartEngine = async (engineType: string) => {
    try {
      setStarting(engineType);
      setError(null);

      await safeInvoke('start_engine', {
        engineType: engineType,
        config: null,
      });
      showSuccess(`${ENGINE_NAMES[engineType] || engineType}を起動しました`);
      await loadEngines(); // 状態を更新
    } catch (err) {
      showError(
        extractErrorMessage(err, 'エンジンの起動に失敗しました')
      );
    } finally {
      setStarting(null);
    }
  };

  /**
   * エンジンを停止
   */
  const handleStopEngine = async (engineType: string) => {
    try {
      setStopping(engineType);
      setError(null);

      await safeInvoke('stop_engine', { engine_type: engineType });
      showSuccess(`${ENGINE_NAMES[engineType] || engineType}を停止しました`);
      await loadEngines(); // 状態を更新
    } catch (err) {
      showError(
        extractErrorMessage(err, 'エンジンの停止に失敗しました')
      );
    } finally {
      setStopping(null);
    }
  };

  /**
   * エンジンを自動インストール
   */
  const handleInstallEngine = async (engineType: string) => {
    try {
      setStarting(engineType);
      setError(null);

      // 進捗イベントをリッスン
      const unlisten = await listen<{
        status: string;
        progress: number;
        downloaded_bytes: number;
        total_bytes: number;
        speed_bytes_per_sec: number;
        message?: string | null;
      }>('engine_install_progress', event => {
        if (event.payload) {
          const { progress, message } = event.payload;
          logger.info(
            `インストール進捗: ${progress.toFixed(1)}%`,
            message || '',
            'EngineManagement'
          );
        }
      });

      try {
        // インストール実行
        await safeInvoke('install_engine', { engineType: engineType });

        // イベントリスナーを解除
        unlisten();

        showSuccess(
          `${ENGINE_NAMES[engineType] || engineType}のインストールが完了しました`
        );

        // インストール後に再度検出して状態を更新
        await loadEngines();
      } catch (installErr) {
        // イベントリスナーを解除
        unlisten();
        throw installErr;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'エンジンのインストールに失敗しました';
      showError(errorMessage);
      logger.error('エンジンインストールエラー', err, 'EngineManagement');
    } finally {
      setStarting(null);
    }
  };

  if (loading) {
    return (
      <div className="engine-management-page">
        <div className="engine-management-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="engine-management-header">
            <button className="back-button" onClick={() => navigate('/settings')}>
              ← 戻る
            </button>
            <h1>エンジン管理</h1>
          </header>
          <div className="engine-management-content">
            <SkeletonLoader type="title" width="200px" />
            <SkeletonLoader type="paragraph" count={2} />
            <div className="margin-top-xl">
              <SkeletonLoader type="card" count={3} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="engine-management-page">
      <div className="engine-management-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="engine-management-header">
          <button className="back-button" onClick={() => navigate('/settings')}>
            ← 戻る
          </button>
          <h1>エンジン管理</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="engine-management-content">
          <div className="engine-info-banner">
            <h2>LLMエンジン管理</h2>
            <p>
              インストール済みのLLMエンジンを検出・管理できます。エンジンの起動・停止、設定の編集が可能です。
            </p>
          </div>

          <div className="engines-section">
            <div className="engines-header">
              <h2>エンジン一覧</h2>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  startTransition(() => {
                    handleDetectEngines();
                  });
                }}
                disabled={detecting}
              >
                {detecting ? '検出中...' : '再検出'}
              </button>
            </div>

            <div className="engines-list">
              {engines.map(engine => (
                <div key={engine.engine_type} className="engine-card">
                  <div className="engine-header">
                    <div className="engine-title-section">
                      <h3 className="engine-name">
                        {ENGINE_NAMES[engine.engine_type] || engine.engine_type}
                      </h3>
                      {engine.version && (
                        <span className="engine-version">
                          v{engine.version}
                        </span>
                      )}
                    </div>
                    <div className="engine-status-badge">
                      {engine.installed ? (
                        engine.running ? (
                          <span className="status-running">実行中</span>
                        ) : (
                          <span className="status-stopped">停止中</span>
                        )
                      ) : (
                        <span className="status-not-detected">未検出</span>
                      )}
                    </div>
                  </div>

                  <div className="engine-body">
                    {engine.message && (
                      <div className="engine-message">
                        <p>{engine.message}</p>
                      </div>
                    )}
                    <div className="engine-info">
                      {engine.path && (
                        <div className="engine-info-item">
                          <span className="info-label">パス:</span>
                          <span className="info-value">{engine.path}</span>
                        </div>
                      )}
                    </div>

                    <div className="engine-actions">
                      {!engine.installed && (
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => {
                            startTransition(() => {
                              handleInstallEngine(engine.engine_type);
                            });
                          }}
                          disabled={starting === engine.engine_type || isPending}
                        >
                          {starting === engine.engine_type
                            ? 'インストール中...'
                            : 'インストール'}
                        </button>
                      )}
                      {engine.installed && !engine.running && (
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => {
                            startTransition(() => {
                              handleStartEngine(engine.engine_type);
                            });
                          }}
                          disabled={starting === engine.engine_type || isPending}
                        >
                          {starting === engine.engine_type
                            ? '起動中...'
                            : '起動'}
                        </button>
                      )}
                      {engine.installed && engine.running && (
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => {
                            startTransition(() => {
                              handleStopEngine(engine.engine_type);
                            });
                          }}
                          disabled={stopping === engine.engine_type || isPending}
                        >
                          {stopping === engine.engine_type
                            ? '停止中...'
                            : '停止'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          navigate(`/engines/settings/${engine.engine_type}`);
                        }}
                      >
                        設定
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {engineConfigs.length > 0 && (
            <div className="engine-configs-section">
              <h2>保存されたエンジン設定</h2>
              <div className="engine-configs-list">
                {engineConfigs.map(config => (
                  <div key={config.id} className="engine-config-card">
                    <div className="config-header">
                      <h3>{config.name}</h3>
                      {config.is_default && (
                        <span className="default-badge">デフォルト</span>
                      )}
                    </div>
                    <div className="config-body">
                      <p className="config-type">
                        タイプ:{' '}
                        {ENGINE_NAMES[config.engine_type] || config.engine_type}
                      </p>
                      <p className="config-url">ベースURL: {config.base_url}</p>
                      {config.executable_path && (
                        <p className="config-path">
                          実行ファイル: {config.executable_path}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
