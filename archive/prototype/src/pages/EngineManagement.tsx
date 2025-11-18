// EngineManagement - エンジン管理ページ
// LLMエンジンの検出・起動・停止・設定管理

import React, { useState, useEffect, useTransition, useRef, useCallback } from 'react';
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
 * エンジン起動プログレスバーコンポーネント
 */
const EngineStartProgressBar: React.FC<{ progress: number; message?: string }> = ({ progress, message }) => {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress]);

  return (
    <div className="engine-start-progress" ref={progressRef}>
      <div className="engine-progress-bar">
        <div className="engine-progress-fill" />
      </div>
      <div className="engine-progress-text">
        {message || `${Math.round(progress)}%`}
      </div>
    </div>
  );
};

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
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not_installed' | 'running' | 'stopped'>('all');
  const [startProgress, setStartProgress] = useState<{
    [key: string]: { progress: number; message: string } | null;
  }>({});
  const [installProgress, setInstallProgress] = useState<{
    [key: string]: { progress: number; message: string } | null;
  }>({});

  useGlobalKeyboardShortcuts();

  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: t('engineManagement.title') || 'エンジン管理' },
  ], [t]);

  /**
   * エンジンを検索・フィルタリング
   * 検索クエリとステータスでフィルタリング
   */
  const filteredEngines = React.useMemo(() => {
    let filtered = [...engines];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(engine => {
        const engineName = ENGINE_NAMES[engine.engine_type] || engine.engine_type;
        return engineName.toLowerCase().includes(query) ||
               engine.engine_type.toLowerCase().includes(query) ||
               (engine.version && engine.version.toLowerCase().includes(query)) ||
               (engine.path && engine.path.toLowerCase().includes(query));
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(engine => {
        switch (statusFilter) {
          case 'installed':
            return engine.installed;
          case 'not_installed':
            return !engine.installed;
          case 'running':
            return engine.installed && engine.running;
          case 'stopped':
            return engine.installed && !engine.running;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [engines, searchQuery, statusFilter]);

  /**
   * エンジン一覧を読み込む
   */
  const loadEngines = useCallback(async () => {
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
  }, []);

  /**
   * エンジン設定一覧を読み込む
   */
  const loadEngineConfigs = useCallback(async () => {
    try {
      const configs = await safeInvoke<EngineConfig[]>('get_engine_configs', {
        engine_type: null,
      });
      setEngineConfigs(configs);
    } catch (err) {
      // エラーは静かに処理（設定がない場合もある）
      logger.warn('エンジン設定の読み込みに失敗しました', extractErrorMessage(err), 'EngineManagement');
    }
  }, []);

  useEffect(() => {
    loadEngines();
    loadEngineConfigs();
  }, [loadEngines, loadEngineConfigs]);

  /**
   * エンジンを再検出
   */
  const handleDetectEngines = useCallback(async () => {
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
  }, [loadEngines, showSuccess, showError]);

  /**
   * エンジンを起動
   */
  const handleStartEngine = useCallback(async (engineType: string) => {
    try {
      setStarting(engineType);
      setError(null);
      setStartProgress(prev => ({ ...prev, [engineType]: { progress: 0, message: '起動コマンドを実行中...' } }));

      try {
        setStartProgress(prev => ({ ...prev, [engineType]: { progress: 20, message: '起動コマンドを実行中...' } }));
        await safeInvoke('start_engine', {
          engineType: engineType,
          config: null,
        });
        setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動コマンドが完了しました' } }));
      } catch (err) {
        // タイムアウトエラーの場合、エンジンが実際に起動している可能性があるため確認を継続
        const errorMessage = extractErrorMessage(err);
        if (errorMessage.includes('タイムアウト')) {
          setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動処理は継続中です...' } }));
          logger.info(
            `${ENGINE_NAMES[engineType] || engineType}の起動コマンドがタイムアウトしましたが、起動処理は継続中です`,
            '',
            'EngineManagement'
          );
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw err;
        }
      }

      // 起動確認のため段階的に状態を確認
      setStartProgress(prev => ({ ...prev, [engineType]: { progress: 60, message: '起動確認中...' } }));
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStartProgress(prev => ({ ...prev, [engineType]: { progress: 70, message: 'エンジンの状態を確認中...' } }));
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStartProgress(prev => ({ ...prev, [engineType]: { progress: 80, message: '最終確認中...' } }));
      const detectedEngines = await safeInvoke<EngineDetectionResult[]>(
        'detect_all_engines',
        {}
      );
      const engine = detectedEngines.find(e => e.engine_type === engineType);
      setStartProgress(prev => ({ ...prev, [engineType]: { progress: 100, message: '確認完了' } }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setStartProgress(prev => ({ ...prev, [engineType]: null }));

      if (engine?.running) {
        showSuccess(`${ENGINE_NAMES[engineType] || engineType}を起動しました`);
      } else {
        showError('エンジンの起動に失敗しました。エンジンが起動しているか確認してください。');
      }
      // 状態を更新
      await loadEngines();
    } catch (err) {
      setStartProgress(prev => ({ ...prev, [engineType]: null }));
      const errorMessage = extractErrorMessage(err, 'エンジンの起動に失敗しました');
      // タイムアウトエラーは既に処理済みなので、エラーメッセージを表示しない
      if (!errorMessage.includes('タイムアウト')) {
        showError(errorMessage);
      }
    } finally {
      setStarting(null);
    }
  }, [loadEngines, showSuccess, showError]);

  /**
   * エンジンを停止
   */
  const handleStopEngine = useCallback(async (engineType: string) => {
    try {
      setStopping(engineType);
      setError(null);

      await safeInvoke('stop_engine', { engineType });
      showSuccess(`${ENGINE_NAMES[engineType] || engineType}を停止しました`);
      await loadEngines(); // 状態を更新
    } catch (err) {
      showError(
        extractErrorMessage(err, 'エンジンの停止に失敗しました')
      );
    } finally {
      setStopping(null);
    }
  }, [loadEngines, showSuccess, showError]);

  /**
   * エンジンを自動インストール
   */
  const handleInstallEngine = useCallback(async (engineType: string) => {
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
          setInstallProgress(prev => ({
            ...prev,
            [engineType]: {
              progress: progress,
              message: message || `インストール中... ${progress.toFixed(1)}%`,
            },
          }));
          logger.info(
            `インストール進捗: ${progress.toFixed(1)}%`,
            message || '',
            'EngineManagement'
          );
        }
      });

      try {
        // インストール実行
        try {
          await safeInvoke('install_engine', { engineType: engineType });
        } catch (installErr) {
          // タイムアウトエラーの場合、インストールが実際に完了しているか確認
          const errorMessage = installErr instanceof Error ? installErr.message : String(installErr);
          if (errorMessage.includes('タイムアウト')) {
            logger.info(
              `${ENGINE_NAMES[engineType] || engineType}のインストールコマンドがタイムアウトしましたが、インストール処理は継続中です`,
              '',
              'EngineManagement'
            );
            // インストール確認のため少し待機
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            // タイムアウト以外のエラーはそのままスロー
            throw installErr;
          }
        }

        // イベントリスナーを解除
        unlisten();
        setInstallProgress(prev => ({ ...prev, [engineType]: { progress: 100, message: 'インストール完了' } }));

        // 少し待ってからプログレスバーを非表示
        await new Promise(resolve => setTimeout(resolve, 500));
        setInstallProgress(prev => ({ ...prev, [engineType]: null }));

        // インストール後に再度検出して状態を確認（最大3回リトライ、各回で2秒待機）
        let engine: EngineDetectionResult | undefined = undefined;
        for (let retry = 0; retry < 3; retry++) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
          
          const detectedEngines = await safeInvoke<EngineDetectionResult[]>(
            'detect_all_engines',
            {}
          );
          engine = detectedEngines.find(e => e.engine_type === engineType);
          
          if (engine?.installed) {
            break;
          }
          
          logger.info(
            `${ENGINE_NAMES[engineType] || engineType}の検出試行 ${retry + 1} / 3: installed=${engine?.installed ?? false}`,
            '',
            'EngineManagement'
          );
        }
        
        // 状態を確認してから成功メッセージを表示
        if (engine?.installed) {
          showSuccess(
            `${ENGINE_NAMES[engineType] || engineType}のインストールが完了しました`
          );
        } else {
          // インストールに失敗した場合のみエラーを表示
          // インストールコマンド自体が失敗した場合は、catchブロックでエラーが表示される
          // ここでは検証に失敗した場合のメッセージを表示
          const errorMsg = engine?.message 
            ? `インストール後の検証に失敗しました。${engine.message}\n\n出力パネルのログを確認して、詳細なエラー情報を確認してください。`
            : 'インストール後の検証に失敗しました。エンジンがインストールされているか確認してください。\n\n出力パネルのログを確認して、詳細なエラー情報を確認してください。';
          showError(errorMsg);
        }
        
        // 状態を更新
        await loadEngines();
      } catch (installErr) {
        // イベントリスナーを解除
        unlisten();
        setInstallProgress(prev => ({ ...prev, [engineType]: null }));
        const errorMessage = installErr instanceof Error ? installErr.message : String(installErr);
        // タイムアウトエラーは既に処理済みなので、エラーメッセージを表示しない
        if (!errorMessage.includes('タイムアウト')) {
          throw installErr;
        }
      }
    } catch (err) {
      setInstallProgress(prev => ({ ...prev, [engineType]: null }));
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'エンジンのインストールに失敗しました';
      
      // エラーメッセージを改善
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('Python') || errorMessage.includes('python')) {
        userFriendlyMessage = `${ENGINE_NAMES[engineType] || engineType}のインストールにはPythonが必要です。\n\nPythonをインストールしてから、再度お試しください。\nPython公式サイト: https://www.python.org/`;
      } else if (errorMessage.includes('pip')) {
        userFriendlyMessage = `pipが見つかりません。Pythonとpipをインストールしてから、再度お試しください。`;
      } else if (errorMessage.includes('タイムアウト') || errorMessage.includes('timeout')) {
        userFriendlyMessage = `インストールに時間がかかっています。バックグラウンドで継続中です。\n\nしばらく待ってから、エンジンの状態を確認してください。`;
      } else if (errorMessage.includes('ダウンロード') || errorMessage.includes('download')) {
        userFriendlyMessage = `ダウンロードに失敗しました。ネットワーク接続を確認してから、再度お試しください。`;
      } else if (errorMessage.includes('権限') || errorMessage.includes('permission') || errorMessage.includes('access denied')) {
        userFriendlyMessage = `インストールに必要な権限がありません。\n\n管理者権限で実行するか、ユーザー権限でインストールする設定を確認してください。`;
      } else if (errorMessage.includes('ディスク') || errorMessage.includes('disk') || errorMessage.includes('容量')) {
        userFriendlyMessage = `ディスク容量が不足しています。\n\n空き容量を確保してから、再度お試しください。`;
      }
      
      showError(userFriendlyMessage);
      logger.error('エンジンインストールエラー', err, 'EngineManagement');
    } finally {
      setStarting(null);
    }
  }, [loadEngines, showSuccess, showError]);

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

            {/* 検索・フィルターUI */}
            <div className="engine-search-filters">
              <div className="engine-search-wrapper">
                <input
                  type="text"
                  placeholder="エンジン名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="engine-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="engine-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="検索をクリア"
                  >
                    ×
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="engine-status-filter"
                aria-label={t('engineManagement.statusFilter') || 'エンジンの状態でフィルタリング'}
              >
                <option value="all">すべての状態</option>
                <option value="installed">インストール済み</option>
                <option value="not_installed">未インストール</option>
                <option value="running">実行中</option>
                <option value="stopped">停止中</option>
              </select>
            </div>

            {/* 検索結果の件数表示 */}
            {searchQuery || statusFilter !== 'all' ? (
              <div className="engine-search-results-info">
                {filteredEngines.length}件のエンジンが見つかりました
                {engines.length !== filteredEngines.length && (
                  <span className="engine-search-total">（全{engines.length}件中）</span>
                )}
              </div>
            ) : null}

            {/* 検索結果が0件の場合 */}
            {filteredEngines.length === 0 && !loading && (
              <div className="engine-search-empty">
                <p>検索条件に一致するエンジンが見つかりませんでした</p>
                {(searchQuery || statusFilter !== 'all') && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  >
                    フィルターをリセット
                  </button>
                )}
              </div>
            )}

            <div className="engines-list">
              {filteredEngines.map(engine => (
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
                    {!engine.installed && (
                      <div className="engine-not-installed-message">
                        <div className="message-icon">📦</div>
                        <div className="message-content">
                          <p className="message-title">
                            {ENGINE_NAMES[engine.engine_type] || engine.engine_type}が未インストールです
                          </p>
                          <p className="message-description">
                            {engine.engine_type === 'ollama' && (
                              <>このアプリから自動的にインストールできます。ワンクリックでセットアップを開始します。</>
                            )}
                            {engine.engine_type === 'lm_studio' && (
                              <>LM Studioのインストーラーを自動ダウンロードして起動します。インストール後、LM Studioを起動してください。</>
                            )}
                            {engine.engine_type === 'vllm' && (
                              <>Pythonがインストールされている場合、自動的にvLLMをインストールします。Pythonが未インストールの場合は、先にPythonをインストールしてください。</>
                            )}
                            {engine.engine_type === 'llama_cpp' && (
                              <>llama.cppを自動ダウンロードしてセットアップします。アプリ内で完結します。</>
                            )}
                            {!['ollama', 'lm_studio', 'vllm', 'llama_cpp'].includes(engine.engine_type) && (
                              <>このアプリから自動的にインストールできます。ワンクリックでセットアップを開始します。</>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {engine.message && engine.installed && (
                      <div className="engine-message">
                        <p>{engine.message}</p>
                      </div>
                    )}
                    
                    {startProgress[engine.engine_type] && (
                      <EngineStartProgressBar
                        progress={startProgress[engine.engine_type]!.progress}
                        message={startProgress[engine.engine_type]!.message}
                      />
                    )}
                    
                    {installProgress[engine.engine_type] && (
                      <EngineStartProgressBar
                        progress={installProgress[engine.engine_type]!.progress}
                        message={installProgress[engine.engine_type]!.message}
                      />
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
                          className="button-primary button-install-large"
                          onClick={() => {
                            startTransition(() => {
                              handleInstallEngine(engine.engine_type);
                            });
                          }}
                          disabled={starting === engine.engine_type || isPending}
                        >
                          {starting === engine.engine_type ? (
                            <>
                              <span className="button-spinner">⏳</span>
                              <span>インストール中...</span>
                            </>
                          ) : (
                            <>
                              <span className="button-icon">🚀</span>
                              <span>自動インストール</span>
                            </>
                          )}
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
