// Diagnostics - 診断ツールページ

import React, { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import { useOllamaDetection } from '../hooks/useOllama';
import { OllamaDetection } from '../components/common/OllamaDetection';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useI18n } from '../contexts/I18nContext';
import type { OllamaHealthStatus, OllamaStatus } from '../types/ollama';
import './Diagnostics.css';

type ApiStatus = 'running' | 'stopped' | 'error';

interface ApiInfo {
  id: string;
  name: string;
  port: number;
  status: ApiStatus;
  model_name: string;
  endpoint: string;
}

interface PortCheckResult {
  port: number;
  available: boolean | null;
  error?: string;
}

interface SystemResources {
  total_memory: number;
  available_memory: number;
  cpu_cores: number;
  cpu_usage: number;
  total_disk: number;
  available_disk: number;
  resource_level: string;
}

interface SecurityBlockDetection {
  backend_responding: boolean;
  port_1420_listening: boolean;
  process_running?: boolean;
  likely_blocked: boolean;
  issues: string[];
  recommendations: string[];
}

interface NetworkDiagnostics {
  internet_available: boolean;
  dns_resolution: boolean;
  local_network: boolean;
  issues: string[];
  recommendations: string[];
}

interface EnvironmentDiagnostics {
  os_info: string;
  os_version: string | null;
  architecture: string;
  rust_version: string | null;
  issues: string[];
}

interface FilesystemDiagnostics {
  write_permission: boolean;
  data_directory_writable: boolean;
  temp_directory_writable: boolean;
  disk_space_sufficient: boolean;
  available_disk_gb: number;
  issues: string[];
  recommendations: string[];
}

interface DatabaseIntegrityCheck {
  check_name: string;
  is_valid: boolean;
  message: string;
  issues: string[];
}

interface DatabaseIntegritySummary {
  checks: DatabaseIntegrityCheck[];
  is_valid: boolean;
  total_issues: number;
}

interface EngineDetectionResult {
  engine_type: string;
  installed: boolean;
  running: boolean;
  version?: string | null;
  path?: string | null;
  message?: string | null;
  portable?: boolean | null; // ポータブル版かどうか（Ollamaなどで使用）
}

interface InstalledModelInfo {
  id: string;
  name: string;
  engine_type: string;
  size_bytes?: number | null;
  installed_at?: string | null;
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string | null;
  enabled: boolean;
  plugin_type: string;
}

interface ScheduleTaskInfo {
  id: string;
  name: string;
  enabled: boolean;
  schedule_type: string;
  next_run?: string | null;
}

interface ComprehensiveDiagnostics {
  security: SecurityBlockDetection;
  network: NetworkDiagnostics;
  environment: EnvironmentDiagnostics;
  filesystem: FilesystemDiagnostics;
  resources: SystemResources;
  overall_health: string;
  total_issues: number;
  critical_issues: string[];
}

const BYTES_IN_GB = 1024 * 1024 * 1024;

export const Diagnostics: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: '診断ツール' },
  ], [t]);
  const [apis, setApis] = useState<ApiInfo[]>([]);
  const [portChecks, setPortChecks] = useState<Record<string, PortCheckResult>>({});
  const [systemResources, setSystemResources] = useState<SystemResources | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaHealth, setOllamaHealth] = useState<OllamaHealthStatus | null>(null);
  const [securityBlock, setSecurityBlock] = useState<SecurityBlockDetection | null>(null);
  const [networkDiagnostics, setNetworkDiagnostics] = useState<NetworkDiagnostics | null>(null);
  const [environmentDiagnostics, setEnvironmentDiagnostics] = useState<EnvironmentDiagnostics | null>(null);
  const [filesystemDiagnostics, setFilesystemDiagnostics] = useState<FilesystemDiagnostics | null>(null);
  const [databaseIntegrity, setDatabaseIntegrity] = useState<DatabaseIntegritySummary | null>(null);
  const [comprehensiveDiagnostics, setComprehensiveDiagnostics] = useState<ComprehensiveDiagnostics | null>(null);
  const [allEngines, setAllEngines] = useState<EngineDetectionResult[]>([]);
  const [installedModels, setInstalledModels] = useState<InstalledModelInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTaskInfo[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const [fixingDatabase, setFixingDatabase] = useState(false);
  const [diagnosticProgress, setDiagnosticProgress] = useState<{
    current: string;
    completed: number;
    total: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const diagnosticCacheRef = useRef<{
    data: {
      comprehensive?: ComprehensiveDiagnostics;
      ollama?: OllamaStatus;
      ollamaHealth?: OllamaHealthStatus;
      apis?: ApiInfo[];
      database?: DatabaseIntegritySummary;
      engines?: EngineDetectionResult[];
      models?: InstalledModelInfo[];
      plugins?: PluginInfo[];
      tasks?: ScheduleTaskInfo[];
    };
    timestamp: number;
  } | null>(null);
  
  const CACHE_DURATION = 30000; // 30秒間キャッシュ
  const checkingRef = useRef(false); // 診断中の状態を追跡するためのref

  const formatBytesToGB = (bytes: number) => {
    return (bytes / BYTES_IN_GB).toFixed(1);
  };

  const getResourceLevelLabel = (level: string) => {
    switch (level) {
      case 'very_high':
        return '非常に高い';
      case 'high':
        return '高い';
      case 'medium':
        return '中程度';
      case 'low':
        return '低い';
      default:
        return level;
    }
  };

  const {
    status: detectionStatus,
    isDetecting: detectingOllama,
    error: detectionError,
    autoSteps,
    autoStatus,
    autoError,
    runAutoSetup,
  } = useOllamaDetection();

  const runDiagnostics = useCallback(async (forceRefresh = false) => {
    // 既に診断中の場合は実行しない（refを使用して最新の値を確認）
    if (checkingRef.current) {
      logger.debug('診断ツール: 既に診断中のためスキップ', '', 'Diagnostics');
      return;
    }
    
    logger.debug('診断ツール: 診断開始', `forceRefresh=${forceRefresh}`, 'Diagnostics');
    
    // キャッシュチェック（30秒以内で強制更新でない場合）
    const now = Date.now();
    if (!forceRefresh && diagnosticCacheRef.current) {
      const cacheAge = now - diagnosticCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        logger.debug('診断ツール: キャッシュから取得', `cacheAge=${cacheAge}ms`, 'Diagnostics');
        const cached = diagnosticCacheRef.current.data;
        if (cached.comprehensive) {
          setComprehensiveDiagnostics(cached.comprehensive);
          if (cached.comprehensive.security) setSecurityBlock(cached.comprehensive.security);
          if (cached.comprehensive.network) setNetworkDiagnostics(cached.comprehensive.network);
          if (cached.comprehensive.environment) setEnvironmentDiagnostics(cached.comprehensive.environment);
          if (cached.comprehensive.filesystem) setFilesystemDiagnostics(cached.comprehensive.filesystem);
          if (cached.comprehensive.resources) setSystemResources(cached.comprehensive.resources);
        }
        if (cached.ollama) setOllamaStatus(cached.ollama);
        if (cached.ollamaHealth) setOllamaHealth(cached.ollamaHealth);
        if (cached.apis) setApis(cached.apis);
        if (cached.database) setDatabaseIntegrity(cached.database);
        if (cached.engines) setAllEngines(cached.engines);
        if (cached.models) setInstalledModels(cached.models);
        if (cached.plugins) setPlugins(cached.plugins);
        if (cached.tasks) setScheduleTasks(cached.tasks);
        setLastChecked(new Date(diagnosticCacheRef.current.timestamp));
        return;
      } else {
        logger.debug('診断ツール: キャッシュが期限切れ', `cacheAge=${cacheAge}ms`, 'Diagnostics');
      }
    }
    
    checkingRef.current = true;
    setChecking(true);
    setError(null);
    setDiagnosticProgress({ current: '初期化中...', completed: 0, total: 6 });
    logger.debug('診断ツール: 診断処理開始', '', 'Diagnostics');

    try {
      // 段階的実行: 優先度の高い診断から順に実行
      
      // フェーズ1: 基本診断（高速）
      setDiagnosticProgress({ current: '基本診断を実行中...', completed: 0, total: 6 });
      const [ollamaResult, apiResult, healthResult] = await Promise.all([
        safeInvoke<OllamaStatus>('detect_ollama'),
        safeInvoke<
          Array<{
            id: string;
            name: string;
            endpoint: string;
            model_name: string;
            port: number;
            status: string;
          }>
        >('list_apis'),
        safeInvoke<OllamaHealthStatus>('check_ollama_health'),
      ]);
      
      setOllamaStatus(ollamaResult);
      setOllamaHealth(healthResult);
      setDiagnosticProgress({ current: '基本診断完了', completed: 1, total: 6 });
      
      // フェーズ2: 包括的診断（中速、重複を排除）
      setDiagnosticProgress({ current: '包括的診断を実行中...', completed: 1, total: 6 });
      const comprehensiveResult = await safeInvoke<ComprehensiveDiagnostics>('run_comprehensive_diagnostics').catch(err => {
        logger.warn('包括的診断に失敗しました', extractErrorMessage(err), 'Diagnostics');
        return null;
      });
      
      if (comprehensiveResult) {
        setComprehensiveDiagnostics(comprehensiveResult);
        setSecurityBlock(comprehensiveResult.security);
        setNetworkDiagnostics(comprehensiveResult.network);
        setEnvironmentDiagnostics(comprehensiveResult.environment);
        setFilesystemDiagnostics(comprehensiveResult.filesystem);
        setSystemResources(comprehensiveResult.resources);
      }
      setDiagnosticProgress({ current: '包括的診断完了', completed: 2, total: 6 });
      
      // フェーズ3: データベース診断（中速）
      setDiagnosticProgress({ current: 'データベース整合性をチェック中...', completed: 2, total: 6 });
      const databaseResult = await safeInvoke<DatabaseIntegritySummary>('check_database_integrity').catch(err => {
        logger.warn('データベース整合性チェックに失敗しました', extractErrorMessage(err), 'Diagnostics');
        return null;
      });
      
      if (databaseResult) {
        setDatabaseIntegrity(databaseResult);
      }
      setDiagnosticProgress({ current: 'データベース診断完了', completed: 3, total: 6 });
      
      // フェーズ4: API詳細診断（中速）
      setDiagnosticProgress({ current: 'API詳細を取得中...', completed: 3, total: 6 });
      const mappedApis: ApiInfo[] = apiResult.map(api => ({
        id: api.id,
        name: api.name,
        port: api.port,
        endpoint: api.endpoint,
        model_name: api.model_name,
        status:
          api.status === 'running'
            ? 'running'
            : api.status === 'stopped'
              ? 'stopped'
              : 'error',
      }));
      
      setApis(mappedApis);
      setDiagnosticProgress({ current: 'API詳細取得完了', completed: 4, total: 6 });
      
      // フェーズ5: ポートチェック（APIがある場合のみ）
      if (mappedApis.length > 0) {
        setDiagnosticProgress({ current: 'ポート使用状況を確認中...', completed: 4, total: 6 });
        const portCheckEntries = await Promise.all(
          mappedApis.map(async api => {
            try {
              const available = await safeInvoke<boolean>('check_port_availability', {
                port: api.port,
              });
              return [api.id, { port: api.port, available } as PortCheckResult] as const;
            } catch (err) {
              const message = extractErrorMessage(err, 'ポートの確認に失敗しました');
              logger.error('ポートチェックエラー', err, 'Diagnostics');
              return [
                api.id,
                {
                  port: api.port,
                  available: null,
                  error: message,
                } as PortCheckResult,
              ] as const;
            }
          })
        );
        setPortChecks(Object.fromEntries(portCheckEntries));
      }
      setDiagnosticProgress({ current: 'ポートチェック完了', completed: 5, total: 6 });
      
      // フェーズ6: 追加情報（低速、オプション）
      setDiagnosticProgress({ current: '追加情報を取得中...', completed: 5, total: 6 });
      const [enginesResult, modelsResult, pluginsResult, tasksResult] = await Promise.all([
        safeInvoke<EngineDetectionResult[]>('detect_all_engines').catch(err => {
          logger.warn('エンジン検出に失敗しました', extractErrorMessage(err), 'Diagnostics');
          return [];
        }),
        safeInvoke<InstalledModelInfo[]>('get_installed_models').catch(err => {
          logger.warn('インストール済みモデル取得に失敗しました', extractErrorMessage(err), 'Diagnostics');
          return [];
        }),
        safeInvoke<PluginInfo[]>('get_all_plugins').catch(err => {
          logger.warn('プラグイン取得に失敗しました', extractErrorMessage(err), 'Diagnostics');
          return [];
        }),
        safeInvoke<ScheduleTaskInfo[]>('get_schedule_tasks').catch(err => {
          logger.warn('スケジューラータスク取得に失敗しました', extractErrorMessage(err), 'Diagnostics');
          return [];
        }),
      ]);
      
      setAllEngines(enginesResult);
      setInstalledModels(modelsResult);
      setPlugins(pluginsResult);
      setScheduleTasks(tasksResult);
      setDiagnosticProgress({ current: '完了', completed: 6, total: 6 });
      
      // キャッシュに保存
      diagnosticCacheRef.current = {
        data: {
          comprehensive: comprehensiveResult || undefined,
          ollama: ollamaResult,
          ollamaHealth: healthResult,
          apis: mappedApis,
          database: databaseResult || undefined,
          engines: enginesResult,
          models: modelsResult,
          plugins: pluginsResult,
          tasks: tasksResult,
        },
        timestamp: now,
      };
      
      setLastChecked(new Date());
      setDiagnosticProgress(null);
      logger.debug('診断ツール: 診断完了', '', 'Diagnostics');
    } catch (err) {
      const message = extractErrorMessage(err, '診断の実行中にエラーが発生しました');
      setError(message);
      logger.error('診断ツールエラー', err, 'Diagnostics');
    } finally {
      checkingRef.current = false;
      setChecking(false);
      setLoading(false);
      logger.debug('診断ツール: 診断処理終了（クリーンアップ完了）', '', 'Diagnostics');
    }
  }, []); // 依存配列を空にして、関数を再作成しないようにする

  // マウント時のみ診断を実行
  useEffect(() => {
    // 初回マウント時のみ実行
    logger.debug('診断ツール: useEffect実行', `lastChecked=${lastChecked}, checking=${checking}`, 'Diagnostics');
    if (!lastChecked && !checking && !checkingRef.current) {
      logger.debug('診断ツール: 初回診断を開始', '', 'Diagnostics');
      startTransition(() => {
        runDiagnostics();
      });
    } else {
      logger.debug('診断ツール: 初回診断をスキップ', `lastChecked=${!!lastChecked}, checking=${checking}, checkingRef=${checkingRef.current}`, 'Diagnostics');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列でマウント時のみ実行

  const getApiPortStatus = (api: ApiInfo) => {
    const result = portChecks[api.id];
    if (!result) {
      return { label: '確認中...', status: 'pending' } as const;
    }

    if (result.error) {
      return { label: `エラー: ${result.error}`, status: 'error' } as const;
    }

    if (result.available === null) {
      return { label: '確認できませんでした', status: 'warning' } as const;
    }

    if (api.status === 'running') {
      return result.available
        ? {
            label: '警告: APIは起動中ですが、ポートが開放されています',
            status: 'warning',
          }
        : { label: '正常: ポートはAPIによって使用中です', status: 'success' };
    }

    if (api.status === 'stopped') {
      return result.available
        ? { label: '正常: ポートは未使用です', status: 'success' }
        : {
            label: '警告: APIは停止中ですが、ポートが占有されています',
            status: 'warning',
          };
    }

    return result.available
      ? { label: '情報: ポートは現在使用されていません', status: 'info' }
      : { label: '警告: ポートが占有されています', status: 'warning' };
  };

  const handleFixDatabase = useCallback(async () => {
    if (fixingDatabase) {
      logger.debug('診断ツール: データベース修正は既に実行中', '', 'Diagnostics');
      return;
    }
    
    logger.debug('診断ツール: データベース整合性の修正を開始', '', 'Diagnostics');
    setFixingDatabase(true);

    try {
      const result = await safeInvoke<DatabaseIntegritySummary>('fix_database_integrity');
      setDatabaseIntegrity(result);
      logger.info('データベース整合性の修正が完了しました', `問題数: ${result.total_issues}件`, 'Diagnostics');
      
      // 修正後、再度診断を実行（強制更新）
      logger.debug('診断ツール: データベース修正後、診断を再実行', '', 'Diagnostics');
      await runDiagnostics(true);
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'データベース整合性の修正に失敗しました');
      logger.error('データベース整合性の修正に失敗しました', errorMessage, 'Diagnostics');
      setError(`データベース整合性の修正に失敗しました: ${errorMessage}`);
    } finally {
      setFixingDatabase(false);
      logger.debug('診断ツール: データベース整合性の修正処理終了', '', 'Diagnostics');
    }
  }, [fixingDatabase, runDiagnostics]);

  return (
    <div className="diagnostics-page">
      <div className="diagnostics-container">
        <Breadcrumb items={breadcrumbItems} />
        <div className="diagnostics-header">
        <div className="diagnostics-header-left">
          <button
            className="back-button"
            onClick={() => navigate('/')}
            aria-label="ホームに戻る"
          >
            ← ホームに戻る
          </button>
          <div className="diagnostics-header-text">
            <h1>診断ツール</h1>
            <p>アプリケーションの主要コンポーネントとポート使用状況を確認します。</p>
          </div>
        </div>
        <div className="diagnostics-header-actions">
          <button
            className="diagnostics-refresh-button"
            onClick={() => {
              if (checking || checkingRef.current) {
                logger.debug('診断ツール: リフレッシュボタンクリック（既に診断中のためスキップ）', '', 'Diagnostics');
                return;
              }
              logger.debug('診断ツール: リフレッシュボタンクリック（強制更新）', '', 'Diagnostics');
              startTransition(() => {
                runDiagnostics(true);
              });
            }}
            disabled={checking || isPending || checkingRef.current}
          >
            {checking || isPending ? '診断中...' : '再診断'}
          </button>
        </div>
      </div>

      {lastChecked && (
        <p className="diagnostics-last-checked">
          最終診断: {lastChecked.toLocaleString('ja-JP')}
        </p>
      )}

      {loading && (
        <div className="diagnostics-loading">
          {diagnosticProgress ? (
            <div className="diagnostics-progress">
              <div className="diagnostics-progress-text">
                {diagnosticProgress.current} ({diagnosticProgress.completed}/{diagnosticProgress.total})
              </div>
              <div className="diagnostics-progress-bar">
                <div
                  className="diagnostics-progress-fill"
                  ref={(el) => {
                    if (el) {
                      el.style.setProperty('--progress-width', `${(diagnosticProgress.completed / diagnosticProgress.total) * 100}%`);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            '診断を実行しています...'
          )}
        </div>
      )}

      {error && (
        <ErrorMessage
          message={error}
          type="general"
          onClose={() => setError(null)}
        />
      )}

      {!loading && !error && (
        <div className="diagnostics-content">
          {comprehensiveDiagnostics && (
            <section className="diagnostics-section">
              <h2>診断サマリー</h2>
              <div className={`diagnostics-card comprehensive-summary ${comprehensiveDiagnostics.overall_health}`}>
                <div className="summary-header">
                  <h3>
                    総合的な健康状態: 
                    <span className={`health-status ${comprehensiveDiagnostics.overall_health}`}>
                      {comprehensiveDiagnostics.overall_health === 'healthy' ? '正常' : 
                       comprehensiveDiagnostics.overall_health === 'warning' ? '警告' : '重大'}
                    </span>
                  </h3>
                  <p className="summary-issues-count">
                    検出された問題: {comprehensiveDiagnostics.total_issues}件
                  </p>
                </div>
                {comprehensiveDiagnostics.critical_issues.length > 0 && (
                  <div className="critical-issues">
                    <h4>優先度の高い問題</h4>
                    <ul>
                      {comprehensiveDiagnostics.critical_issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="diagnostics-section">
            <h2>セキュリティソフトブロック検出</h2>
            {securityBlock ? (
              <div className="diagnostics-card">
                <div className={`diagnostics-status-grid ${securityBlock.likely_blocked ? 'security-warning' : ''}`}>
                  <div>
                    <span className="label">バックエンド応答</span>
                    <span className={securityBlock.backend_responding ? 'status success' : 'status error'}>
                      {securityBlock.backend_responding ? '正常' : '応答なし'}
                    </span>
                  </div>
                  <div>
                    <span className="label">ポート1420</span>
                    <span className={securityBlock.port_1420_listening ? 'status success' : 'status error'}>
                      {securityBlock.port_1420_listening ? 'リッスン中' : '未リッスン'}
                    </span>
                  </div>
                  {typeof securityBlock.process_running !== 'undefined' && (
                    <div>
                      <span className="label">プロセス実行中</span>
                      <span className={securityBlock.process_running ? 'status success' : 'status error'}>
                        {securityBlock.process_running ? '実行中' : '未実行'}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="label">ブロック可能性</span>
                    <span className={securityBlock.likely_blocked ? 'status error' : 'status success'}>
                      {securityBlock.likely_blocked ? 'ブロックされている可能性あり' : 'ブロックされていない'}
                    </span>
                  </div>
                </div>
                {securityBlock.issues.length > 0 && (
                  <div className="diagnostics-issues">
                    <h3>検出された問題</h3>
                    <ul>
                      {securityBlock.issues.map((issue, idx) => (
                        <li key={`security-issue-${idx}-${issue.substring(0, 20)}`}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {securityBlock.recommendations.length > 0 && (
                  <div className="diagnostics-recommendations">
                    <h3>推奨される対処法</h3>
                    <ul>
                      {securityBlock.recommendations.map((rec, idx) => (
                        <li key={`security-rec-${idx}-${rec.substring(0, 20)}`}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="diagnostics-card diagnostics-empty">
                セキュリティブロック検出を実行できませんでした。
              </div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>Ollama 自動セットアップ</h2>
            <OllamaDetection
              status={detectionStatus || ollamaStatus}
              isDetecting={detectingOllama}
              error={detectionError}
              autoSteps={autoSteps}
              autoStatus={autoStatus}
              autoError={autoError}
              onRetryAuto={runAutoSetup}
            />
          </section>

          <section className="diagnostics-section">
            <h2>Ollama の状態</h2>
            {ollamaStatus ? (
              <div className="diagnostics-card">
                <div className="diagnostics-status-grid">
                  <div>
                    <span className="label">インストール状態</span>
                    <span className={ollamaStatus.installed ? 'status success' : 'status error'}>
                      {ollamaStatus.installed ? 'インストール済み' : '未インストール'}
                    </span>
                  </div>
                  <div>
                    <span className="label">実行状態</span>
                    <span className={ollamaStatus.running ? 'status success' : 'status warning'}>
                      {ollamaStatus.running ? '実行中' : '停止中'}
                    </span>
                  </div>
                  <div>
                    <span className="label">ポータブル版</span>
                    <span className={ollamaStatus.portable ? 'status info' : 'status muted'}>
                      {ollamaStatus.portable ? '利用中' : '未使用'}
                    </span>
                  </div>
                  <div>
                    <span className="label">バージョン</span>
                    <span className="value">
                      {ollamaStatus.version || '不明'}
                    </span>
                  </div>
                </div>
                {(ollamaStatus.portable_path || ollamaStatus.system_path) && (
                  <div className="diagnostics-paths">
                    {ollamaStatus.portable_path && (
                      <div>
                        <span className="label">ポータブルパス</span>
                        <code>{ollamaStatus.portable_path}</code>
                      </div>
                    )}
                    {ollamaStatus.system_path && (
                      <div>
                        <span className="label">システムパス</span>
                        <code>{ollamaStatus.system_path}</code>
                      </div>
                    )}
                  </div>
                )}
                {ollamaHealth && (
                  <div className="diagnostics-health">
                    <div>
                      <span className="label">サービス応答</span>
                      <span
                        className={
                          ollamaHealth.running ? 'status success' : 'status error'
                        }
                      >
                        {ollamaHealth.running ? '応答あり' : '応答なし'}
                      </span>
                    </div>
                    <div>
                      <span className="label">ポート占有状況 (11434)</span>
                      <span
                        className={
                          ollamaHealth.port_available
                            ? 'status warning'
                            : 'status success'
                        }
                      >
                        {ollamaHealth.port_available
                          ? '未使用（応答が無い可能性）'
                          : '使用中（Ollamaが待機中）'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="diagnostics-card diagnostics-empty">
                Ollamaの状態を取得できませんでした。
              </div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>API とポート診断</h2>
            {apis.length === 0 ? (
              <div className="diagnostics-card diagnostics-empty">
                作成済みの API はありません。API を作成すると診断結果が表示されます。
              </div>
            ) : (
              <div className="diagnostics-card">
                <div className="diagnostics-table">
                  <div className="table-header">
                    <span>API 名</span>
                    <span>ポート</span>
                    <span>API 状態</span>
                    <span>ポート診断</span>
                  </div>
                  {apis.map(api => {
                    const portStatus = getApiPortStatus(api);
                    return (
                      <div key={api.id} className="table-row">
                        <span>
                          <strong>{api.name}</strong>
                          <small>{api.model_name}</small>
                        </span>
                        <span>
                          <code>{api.port}</code>
                        </span>
                        <span>
                          <span
                            className={`status ${
                              api.status === 'running'
                                ? 'success'
                                : api.status === 'stopped'
                                  ? 'muted'
                                  : 'error'
                            }`}
                          >
                            {api.status === 'running'
                              ? '稼働中'
                              : api.status === 'stopped'
                                ? '停止中'
                                : 'エラー'}
                          </span>
                        </span>
                        <span>
                          <span className={`status ${portStatus.status}`}>{portStatus.label}</span>
                          <small className="endpoint">{api.endpoint}</small>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>システムリソース</h2>
            {systemResources ? (
              <div className="diagnostics-card">
                <div className="diagnostics-status-grid">
                  <div>
                    <span className="label">メモリ合計</span>
                    <span className="value">{formatBytesToGB(systemResources.total_memory)} GB</span>
                  </div>
                  <div>
                    <span className="label">メモリ空き</span>
                    <span className="value">{formatBytesToGB(systemResources.available_memory)} GB</span>
                  </div>
                  <div>
                    <span className="label">CPU コア数</span>
                    <span className="value">{systemResources.cpu_cores}</span>
                  </div>
                  <div>
                    <span className="label">CPU 使用率</span>
                    <span className="value">{systemResources.cpu_usage.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="label">ディスク合計</span>
                    <span className="value">{formatBytesToGB(systemResources.total_disk)} GB</span>
                  </div>
                  <div>
                    <span className="label">ディスク空き</span>
                    <span className="value">{formatBytesToGB(systemResources.available_disk)} GB</span>
                  </div>
                  <div>
                    <span className="label">リソースレベル</span>
                    <span className="status info">{getResourceLevelLabel(systemResources.resource_level)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="diagnostics-card diagnostics-empty">システムリソース情報を取得できませんでした。</div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>ネットワーク診断</h2>
            {networkDiagnostics ? (
              <div className="diagnostics-card">
                <div className="diagnostics-status-grid">
                  <div>
                    <span className="label">インターネット接続</span>
                    <span className={networkDiagnostics.internet_available ? 'status success' : 'status error'}>
                      {networkDiagnostics.internet_available ? '利用可能' : '利用不可'}
                    </span>
                  </div>
                  <div>
                    <span className="label">DNS解決</span>
                    <span className={networkDiagnostics.dns_resolution ? 'status success' : 'status error'}>
                      {networkDiagnostics.dns_resolution ? '正常' : '異常'}
                    </span>
                  </div>
                  <div>
                    <span className="label">ローカルネットワーク</span>
                    <span className={networkDiagnostics.local_network ? 'status success' : 'status warning'}>
                      {networkDiagnostics.local_network ? '正常' : '確認できませんでした'}
                    </span>
                  </div>
                </div>
                {networkDiagnostics.issues.length > 0 && (
                  <div className="diagnostics-issues">
                    <h3>検出された問題</h3>
                    <ul>
                      {networkDiagnostics.issues.map((issue, idx) => (
                        <li key={`network-issue-${idx}-${issue.substring(0, 20)}`}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {networkDiagnostics.recommendations.length > 0 && (
                  <div className="diagnostics-recommendations">
                    <h3>推奨される対処法</h3>
                    <ul>
                      {networkDiagnostics.recommendations.map((rec, idx) => (
                        <li key={`network-rec-${idx}-${rec.substring(0, 20)}`}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="diagnostics-card diagnostics-empty">ネットワーク診断を実行できませんでした。</div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>環境情報</h2>
            {environmentDiagnostics ? (
              <div className="diagnostics-card">
                <div className="diagnostics-status-grid">
                  <div>
                    <span className="label">OS</span>
                    <span className="value">{environmentDiagnostics.os_info}</span>
                  </div>
                  <div>
                    <span className="label">OSバージョン</span>
                    <span className="value">{environmentDiagnostics.os_version || '不明'}</span>
                  </div>
                  <div>
                    <span className="label">アーキテクチャ</span>
                    <span className="value">{environmentDiagnostics.architecture}</span>
                  </div>
                  <div>
                    <span className="label">Rustバージョン</span>
                    <span className="value">{environmentDiagnostics.rust_version || '未検出（開発環境のみ）'}</span>
                  </div>
                </div>
                {environmentDiagnostics.issues.length > 0 && (
                  <div className="diagnostics-issues">
                    <h3>検出された問題</h3>
                    <ul>
                      {environmentDiagnostics.issues.map((issue, idx) => (
                        <li key={`env-issue-${idx}-${issue.substring(0, 20)}`}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="diagnostics-card diagnostics-empty">環境情報を取得できませんでした。</div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>ファイルシステム診断</h2>
            {filesystemDiagnostics ? (
              <div className="diagnostics-card">
                <div className="diagnostics-status-grid">
                  <div>
                    <span className="label">アプリディレクトリ書き込み</span>
                    <span className={filesystemDiagnostics.write_permission ? 'status success' : 'status error'}>
                      {filesystemDiagnostics.write_permission ? '可能' : '不可'}
                    </span>
                  </div>
                  <div>
                    <span className="label">データディレクトリ書き込み</span>
                    <span className={filesystemDiagnostics.data_directory_writable ? 'status success' : 'status error'}>
                      {filesystemDiagnostics.data_directory_writable ? '可能' : '不可'}
                    </span>
                  </div>
                  <div>
                    <span className="label">一時ディレクトリ書き込み</span>
                    <span className={filesystemDiagnostics.temp_directory_writable ? 'status success' : 'status error'}>
                      {filesystemDiagnostics.temp_directory_writable ? '可能' : '不可'}
                    </span>
                  </div>
                  <div>
                    <span className="label">ディスク容量</span>
                    <span className={filesystemDiagnostics.disk_space_sufficient ? 'status success' : 'status warning'}>
                      {filesystemDiagnostics.available_disk_gb.toFixed(1)} GB 利用可能
                    </span>
                  </div>
                </div>
                {filesystemDiagnostics.issues.length > 0 && (
                  <div className="diagnostics-issues">
                    <h3>検出された問題</h3>
                    <ul>
                      {filesystemDiagnostics.issues.map((issue, idx) => (
                        <li key={`fs-issue-${idx}-${issue.substring(0, 20)}`}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {filesystemDiagnostics.recommendations.length > 0 && (
                  <div className="diagnostics-recommendations">
                    <h3>推奨される対処法</h3>
                    <ul>
                      {filesystemDiagnostics.recommendations.map((rec, idx) => (
                        <li key={`fs-rec-${idx}-${rec.substring(0, 20)}`}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="diagnostics-card diagnostics-empty">ファイルシステム診断を実行できませんでした。</div>
            )}
          </section>

          <section className="diagnostics-section">
            <div className="diagnostics-section-header">
              <h2>データベース整合性</h2>
              {databaseIntegrity && !databaseIntegrity.is_valid && (
                <button
                  className="diagnostics-fix-button"
                  onClick={() => {
                    startTransition(() => {
                      handleFixDatabase();
                    });
                  }}
                  disabled={fixingDatabase || isPending}
                >
                  {fixingDatabase || isPending ? '修正中...' : '整合性を修正'}
                </button>
              )}
            </div>
            {databaseIntegrity ? (
              <div className="diagnostics-card">
                <div className="diagnostics-status-grid">
                  <div>
                    <span className="label">整合性状態</span>
                    <span className={databaseIntegrity.is_valid ? 'status success' : 'status error'}>
                      {databaseIntegrity.is_valid ? '正常' : '問題あり'}
                    </span>
                  </div>
                  <div>
                    <span className="label">検出された問題数</span>
                    <span className="value">{databaseIntegrity.total_issues}件</span>
                  </div>
                </div>
                {databaseIntegrity.checks.length > 0 && (
                  <div className="database-checks">
                    <h3>チェック結果</h3>
                    <div className="check-list">
                      {databaseIntegrity.checks.map((check, idx) => (
                        <div key={`db-check-${idx}-${check.check_name}`} className={`check-item ${check.is_valid ? 'valid' : 'invalid'}`}>
                          <div className="check-header">
                            <span className="check-name">{check.check_name}</span>
                            <span className={`status ${check.is_valid ? 'success' : 'error'}`}>
                              {check.is_valid ? '✓' : '✗'}
                            </span>
                          </div>
                          <p className="check-message">{check.message}</p>
                          {check.issues.length > 0 && (
                            <ul className="check-issues">
                              {check.issues.map((issue, issueIdx) => (
                                <li key={`db-check-${idx}-issue-${issueIdx}-${issue.substring(0, 20)}`}>{issue}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="diagnostics-card diagnostics-empty">データベース整合性チェックを実行できませんでした。</div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>LLMエンジン検出</h2>
            {allEngines.length === 0 ? (
              <div className="diagnostics-card diagnostics-empty">
                エンジンの検出を実行できませんでした。
              </div>
            ) : (
              <div className="diagnostics-card">
                <div className="diagnostics-table">
                  <div className="table-header">
                    <span>エンジン名</span>
                    <span>インストール状態</span>
                    <span>実行状態</span>
                    <span>バージョン</span>
                  </div>
                  {allEngines.map((engine, idx) => (
                    <div key={`engine-${idx}-${engine.engine_type}`} className="table-row">
                      <span>
                        <strong>
                          {engine.engine_type === 'ollama' ? 'Ollama' :
                           engine.engine_type === 'lm_studio' ? 'LM Studio' :
                           engine.engine_type === 'vllm' ? 'vLLM' :
                           engine.engine_type === 'llama_cpp' ? 'llama.cpp' :
                           engine.engine_type}
                        </strong>
                        {engine.portable && (
                          <small className="portable-badge">
                            （ポータブル版）
                          </small>
                        )}
                      </span>
                      <span>
                        <span className={`status ${engine.installed ? 'success' : 'error'}`}>
                          {engine.installed ? 'インストール済み' : '未インストール'}
                        </span>
                      </span>
                      <span>
                        <span className={`status ${engine.running ? 'success' : 'warning'}`}>
                          {engine.running ? '実行中' : '停止中'}
                        </span>
                      </span>
                      <span>
                        <span className="value">{engine.version || '不明'}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {allEngines.some(e => e.message) && (
                  <div className="diagnostics-issues">
                    <h3>検出された問題</h3>
                    <ul>
                      {allEngines.filter(e => e.message).map((engine, idx) => (
                        <li key={`engine-issue-${idx}-${engine.engine_type}`}>
                          <strong>{engine.engine_type}</strong>: {engine.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>インストール済みモデル</h2>
            {installedModels.length === 0 ? (
              <div className="diagnostics-card diagnostics-empty">
                インストール済みのモデルはありません。
              </div>
            ) : (
              <div className="diagnostics-card">
                <div className="diagnostics-table">
                  <div className="table-header">
                    <span>モデル名</span>
                    <span>エンジン</span>
                    <span>サイズ</span>
                    <span>インストール日時</span>
                  </div>
                  {installedModels.map(model => (
                    <div key={model.id} className="table-row">
                      <span>
                        <strong>{model.name}</strong>
                      </span>
                      <span>
                        <span className="value">
                          {model.engine_type === 'ollama' ? 'Ollama' :
                           model.engine_type === 'lm_studio' ? 'LM Studio' :
                           model.engine_type === 'vllm' ? 'vLLM' :
                           model.engine_type === 'llama_cpp' ? 'llama.cpp' :
                           model.engine_type}
                        </span>
                      </span>
                      <span>
                        <span className="value">
                          {model.size_bytes
                            ? `${formatBytesToGB(model.size_bytes)} GB`
                            : '不明'}
                        </span>
                      </span>
                      <span>
                        <span className="value">
                          {model.installed_at
                            ? new Date(model.installed_at).toLocaleString('ja-JP')
                            : '不明'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="diagnostics-summary">
                  <p>合計: {installedModels.length}個のモデルがインストールされています</p>
                  {installedModels.reduce((sum, m) => sum + (m.size_bytes || 0), 0) > 0 && (
                    <p>
                      合計サイズ: {formatBytesToGB(installedModels.reduce((sum, m) => sum + (m.size_bytes || 0), 0))} GB
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>プラグイン状態</h2>
            {plugins.length === 0 ? (
              <div className="diagnostics-card diagnostics-empty">
                登録されているプラグインはありません。
              </div>
            ) : (
              <div className="diagnostics-card">
                <div className="diagnostics-table">
                  <div className="table-header">
                    <span>プラグイン名</span>
                    <span>バージョン</span>
                    <span>タイプ</span>
                    <span>状態</span>
                  </div>
                  {plugins.map(plugin => (
                    <div key={plugin.id} className="table-row">
                      <span>
                        <strong>{plugin.name}</strong>
                        {plugin.description && <small>{plugin.description}</small>}
                      </span>
                      <span>
                        <span className="value">{plugin.version}</span>
                      </span>
                      <span>
                        <span className="value">
                          {plugin.plugin_type === 'Engine' ? 'エンジン' :
                           plugin.plugin_type === 'Model' ? 'モデル' :
                           plugin.plugin_type === 'Auth' ? '認証' :
                           plugin.plugin_type === 'Logging' ? 'ログ' :
                           plugin.plugin_type}
                        </span>
                      </span>
                      <span>
                        <span className={`status ${plugin.enabled ? 'success' : 'muted'}`}>
                          {plugin.enabled ? '有効' : '無効'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="diagnostics-summary">
                  <p>
                    合計: {plugins.length}個のプラグイン（有効: {plugins.filter(p => p.enabled).length}個、無効: {plugins.filter(p => !p.enabled).length}個）
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>スケジューラータスク</h2>
            {scheduleTasks.length === 0 ? (
              <div className="diagnostics-card diagnostics-empty">
                登録されているスケジューラータスクはありません。
              </div>
            ) : (
              <div className="diagnostics-card">
                <div className="diagnostics-table">
                  <div className="table-header">
                    <span>タスク名</span>
                    <span>スケジュールタイプ</span>
                    <span>状態</span>
                    <span>次回実行</span>
                  </div>
                  {scheduleTasks.map(task => (
                    <div key={task.id} className="table-row">
                      <span>
                        <strong>{task.name}</strong>
                      </span>
                      <span>
                        <span className="value">
                          {task.schedule_type === 'daily' ? '毎日' :
                           task.schedule_type === 'weekly' ? '毎週' :
                           task.schedule_type === 'monthly' ? '毎月' :
                           task.schedule_type === 'interval' ? '間隔' :
                           task.schedule_type}
                        </span>
                      </span>
                      <span>
                        <span className={`status ${task.enabled ? 'success' : 'muted'}`}>
                          {task.enabled ? '有効' : '無効'}
                        </span>
                      </span>
                      <span>
                        <span className="value">
                          {task.next_run
                            ? new Date(task.next_run).toLocaleString('ja-JP')
                            : '未設定'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="diagnostics-summary">
                  <p>
                    合計: {scheduleTasks.length}個のタスク（有効: {scheduleTasks.filter(t => t.enabled).length}個、無効: {scheduleTasks.filter(t => !t.enabled).length}個）
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="diagnostics-section">
            <h2>トラブルシューティングガイド</h2>
            <div className="diagnostics-card">
              <ul className="diagnostics-tips">
                <li>ポートが占有されている場合は、ExpressVPN などの常駐アプリが同じポートを使用していないか確認し、必要に応じて停止してください。</li>
                <li>API が停止中にもかかわらずポートが使用中の場合は、OS を再起動するか <code>netstat -ano | findstr {'<'}ポート番号{'>'}</code> でプロセスを特定してください。</li>
                <li>Ollama が未インストールの場合は、「Ollamaセットアップ」ページからインストールを行ってください。</li>
                <li>ダウンロードエラーが発生する場合は、インターネット接続と空き容量（推奨 10GB 以上）を確認し、必要に応じて別ドライブを指定してください。</li>
                <li>セキュリティソフトが `ollama.exe` や `flm.exe` をブロックしている場合は、許可リストに追加してから再実行してください。</li>
                <li>システムリソースが不足している場合は、モデルの縮小や同時実行数の調整を検討してください。</li>
              </ul>
            </div>
          </section>
        </div>
      )}
      </div>
    </div>
  );
};


