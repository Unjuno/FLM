// Home page

import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { safeInvoke } from '../utils/tauri';
import { formatProxyMode, formatEngineStatus } from '../utils/formatters';
import {
  clearTimeoutRef,
  setTimeoutRef,
  clearAllTimeouts,
} from '../utils/timeout';
import { logger } from '../utils/logger';
import { createErrorHandler } from '../utils/errorHandler';
import {
  TIMING,
  SILENT_ERROR_PATTERNS,
  DEFAULT_PROXY_CONFIG,
} from '@/config/constants';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SuccessMessage } from '../components/common/SuccessMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import './Home.css';

type ProxyModeValue =
  | 'local-http'
  | 'dev-selfsigned'
  | 'https-acme'
  | 'packaged-ca';
type ProxyModeObject =
  | { LocalHttp?: unknown }
  | { DevSelfSigned?: unknown }
  | { HttpsAcme?: unknown }
  | { PackagedCa?: unknown };
type ProxyMode = ProxyModeValue | ProxyModeObject;

interface ProxyStatus {
  running: boolean;
  port?: number;
  mode?: ProxyMode;
}

type EngineStatusValue =
  | 'installed-only'
  | 'running-healthy'
  | 'running-degraded'
  | 'error-network'
  | 'error-api'
  | 'unknown';

interface EngineStatusObject {
  status?: EngineStatusValue;
  latency_ms?: number;
  reason?: string;
}

type EngineStatus =
  | EngineStatusValue
  | EngineStatusObject
  | { [key: string]: unknown };

interface EngineInfo {
  id: string;
  name: string;
  status: EngineStatus;
}

interface ProxyStatusResult {
  data?: Array<{ running: boolean; port?: number; mode?: ProxyMode }>;
}

const VALID_ENGINE_STATUSES = new Set<EngineStatusValue>([
  'installed-only',
  'running-healthy',
  'running-degraded',
  'error-network',
  'error-api',
  'unknown',
]);

function isProxyStatusResult(result: unknown): result is ProxyStatusResult {
  if (!result || typeof result !== 'object') {
    return false;
  }

  const obj = result as Record<string, unknown>;
  if (!('data' in obj)) {
    return false;
  }

  const data = obj.data;
  return Array.isArray(data) && data.length > 0;
}

function isDirectProxyStatus(result: unknown): result is ProxyStatus {
  return (
    result !== null &&
    typeof result === 'object' &&
    'running' in result &&
    typeof (result as ProxyStatus).running === 'boolean'
  );
}

function validateEngineData(data: unknown): EngineInfo | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // id の検証
  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    return null;
  }
  const id = obj.id.trim();

  // name の検証（オプショナル）
  const name =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : id;

  // status の検証（より厳密に）
  let status: EngineStatus = 'unknown';
  if (obj.status !== undefined) {
    if (typeof obj.status === 'string') {
      status = VALID_ENGINE_STATUSES.has(obj.status as EngineStatusValue)
        ? (obj.status as EngineStatusValue)
        : 'unknown';
    } else if (typeof obj.status === 'object' && obj.status !== null) {
      status = obj.status as EngineStatus;
    }
  }

  return { id, name, status };
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [enginesLoading, setEnginesLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const timeoutRef = useRef<{
    status?: NodeJS.Timeout;
    message?: NodeJS.Timeout;
    detect?: NodeJS.Timeout;
  }>({});

  const handleProxyStatusResult = useCallback((result: unknown) => {
    // 型ガード関数を使用
    if (isProxyStatusResult(result)) {
      const handles = result.data;
      if (handles && handles.length > 0) {
        const handle = handles[0];
        setProxyStatus({
          running: handle.running ?? false,
          port: handle.port,
          mode: handle.mode,
        });
        return;
      }
    }

    // フォールバック処理
    if (isDirectProxyStatus(result)) {
      setProxyStatus(result);
      return;
    }

    setProxyStatus({ running: false });
  }, []);

  const handleProxyStatusError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: 'プロキシステータスの取得に失敗しました',
        silentPatterns: SILENT_ERROR_PATTERNS,
      }),
    []
  );

  const loadProxyStatus = useCallback(async (): Promise<ProxyStatus | null> => {
    try {
      const result = await safeInvoke<{
        version?: string;
        data?: Array<{ running: boolean; port?: number; mode?: ProxyMode }>;
      }>('ipc_proxy_status');
      handleProxyStatusResult(result);
      setError(prevError => {
        if (prevError?.includes('プロキシステータス')) {
          return null;
        }
        return prevError;
      });
      // 結果を返す（自動起動の判断に使用）
      if (isProxyStatusResult(result)) {
        const handles = result.data;
        if (handles && handles.length > 0) {
          const handle = handles[0];
          return {
            running: handle.running ?? false,
            port: handle.port,
            mode: handle.mode,
          };
        }
      }
      if (isDirectProxyStatus(result)) {
        return result;
      }
      return { running: false };
    } catch (err) {
      // why: エラーが無視された場合（not found等）、プロキシは停止中とみなす
      // alt: 常にエラーを表示する（UXが悪化する可能性）
      // evidence: 既存の動作を維持するため
      const result = handleProxyStatusError(err);
      if (result.shouldShow) {
        setError(result.message);
      } else {
        setProxyStatus({ running: false });
      }
      return { running: false };
    }
  }, [handleProxyStatusResult, handleProxyStatusError]);

  const loadEngines = useCallback(async () => {
    setEnginesLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<{
        version?: string;
        data?: {
          engines?: Array<{ id: string; name: string; status: unknown }>;
        };
      }>('ipc_detect_engines', { fresh: false });
      // JSON形式: { version: "1.0", data: { engines: [...] } }
      if (
        result &&
        'data' in result &&
        result.data &&
        'engines' in result.data
      ) {
        const enginesData = result.data.engines;
        if (Array.isArray(enginesData)) {
          setEngines(
            enginesData
              .map(validateEngineData)
              .filter((e): e is EngineInfo => e !== null)
          );
        }
      } else if (
        result &&
        'engines' in result &&
        Array.isArray(result.engines)
      ) {
        // フォールバック: 直接enginesフィールドがある場合
        setEngines(
          result.engines
            .map(validateEngineData)
            .filter((e): e is EngineInfo => e !== null)
        );
      } else if (Array.isArray(result)) {
        // フォールバック: 配列が直接返される場合
        setEngines(
          result
            .map(validateEngineData)
            .filter((e): e is EngineInfo => e !== null)
        );
      } else {
        setEngines([]);
      }
    } catch (err) {
      // エンジン検出のエラーは致命的ではないため、エラーを設定しない
      logger.warn('エンジンの検出に失敗しました:', err);
      setEngines([]);
    } finally {
      setEnginesLoading(false);
    }
  }, []);

  const handleStartProxyError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('errors.generic'),
      }),
    [t]
  );

  const handleStopProxyError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('errors.generic'),
      }),
    [t]
  );

  const handleStartProxy = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // 既存のタイマーをクリア
    clearTimeoutRef(timeoutRef, 'status');
    clearTimeoutRef(timeoutRef, 'message');

    try {
      await safeInvoke('ipc_proxy_start', {
        mode: DEFAULT_PROXY_CONFIG.MODE,
        port: DEFAULT_PROXY_CONFIG.PORT,
        no_daemon: true,
      });
      setSuccessMessage(t('messages.proxyStarted'));

      setTimeoutRef(
        timeoutRef,
        'status',
        () => {
          void loadProxyStatus();
        },
        TIMING.STATUS_REFRESH_DELAY_MS
      );

      setTimeoutRef(
        timeoutRef,
        'message',
        () => {
          setSuccessMessage(null);
        },
        TIMING.MESSAGE_AUTO_DISMISS_MS
      );
    } catch (err) {
      const result = handleStartProxyError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
      setSuccessMessage(null);
    } finally {
      setLoading(false);
    }
  }, [loadProxyStatus, handleStartProxyError, t]);

  const handleStopProxy = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // 既存のタイマーをクリア
    clearTimeoutRef(timeoutRef, 'status');
    clearTimeoutRef(timeoutRef, 'message');

    // why: プロキシ停止にはportまたはhandle_idが必要
    // alt: 常に最新のステータスを取得してから停止（追加のAPI呼び出しが必要）
    // evidence: 現在のproxyStatusからportを取得する方が効率的
    if (!proxyStatus || !proxyStatus.running || !proxyStatus.port) {
      setError(t('errors.proxyNotRunning') || 'プロキシが実行されていません');
      setLoading(false);
      return;
    }

    try {
      await safeInvoke('ipc_proxy_stop', {
        port: proxyStatus.port,
      });
      setSuccessMessage(t('messages.proxyStopped'));

      setTimeoutRef(
        timeoutRef,
        'message',
        () => {
          setSuccessMessage(null);
        },
        TIMING.MESSAGE_AUTO_DISMISS_MS
      );

      setTimeoutRef(
        timeoutRef,
        'status',
        () => {
          void loadProxyStatus();
        },
        TIMING.STATUS_REFRESH_DELAY_MS
      );
    } catch (err) {
      const result = handleStopProxyError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
      setSuccessMessage(null);
    } finally {
      setLoading(false);
    }
  }, [proxyStatus, loadProxyStatus, handleStopProxyError, t]);

  const handleDetectEnginesError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('errors.generic'),
      }),
    [t]
  );

  const handleDetectEngines = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);

    // 既存のタイマーをクリア
    clearTimeoutRef(timeoutRef, 'detect');
    clearTimeoutRef(timeoutRef, 'message');

    try {
      await loadEngines();
      setSuccessMessage(t('messages.enginesDetected'));
      setTimeoutRef(
        timeoutRef,
        'detect',
        () => {
          setSuccessMessage(null);
        },
        TIMING.MESSAGE_AUTO_DISMISS_MS
      );
    } catch (err) {
      const result = handleDetectEnginesError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    }
  }, [loadEngines, handleDetectEnginesError, t]);

  useEffect(() => {
    void loadProxyStatus();
    void loadEngines();

    // 定期的にステータスを更新
    const statusInterval = setInterval(() => {
      void loadProxyStatus();
    }, TIMING.STATUS_POLL_INTERVAL_MS);

    return () => {
      clearInterval(statusInterval);
      // タイマーのクリーンアップ
      clearAllTimeouts(timeoutRef);
    };
  }, [loadProxyStatus, loadEngines]);

  // プロキシが起動していない場合、自動的に起動を試みる
  // why: ユーザーが手動で起動する必要がないようにするため
  // alt: 常に手動起動を要求する（UXが悪化）
  // evidence: 多くのアプリケーションで自動起動が標準的な動作
  useEffect(() => {
    const autoStartProxy = async () => {
      // プロキシの状態が確定してから実行（初回ロード完了を待つ）
      // proxyStatusがnullの場合はまだロード中なので、スキップ
      if (proxyStatus !== null && !proxyStatus.running) {
        try {
          await safeInvoke('ipc_proxy_start', {
            mode: DEFAULT_PROXY_CONFIG.MODE,
            port: DEFAULT_PROXY_CONFIG.PORT,
            no_daemon: true,
          });
          // 起動後、ステータスを更新
          setTimeout(() => {
            void loadProxyStatus();
          }, TIMING.STATUS_REFRESH_DELAY_MS);
        } catch (err) {
          // 自動起動に失敗した場合、エラーをログに記録するが、ユーザーには表示しない
          // why: 初回起動時など、プロキシ起動が失敗する可能性があるため
          // alt: エラーを表示する（UXが悪化）
          // evidence: 自動起動は「試みる」ものであり、失敗してもアプリは使用可能
          logger.warn('Failed to auto-start proxy:', err);
        }
      }
    };

    // 少し遅延させて実行（初回ロードが完了するのを待つ）
    const timeoutId = setTimeout(() => {
      void autoStartProxy();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [proxyStatus, loadProxyStatus]);

  const renderEngineStatus = useMemo(() => {
    if (enginesLoading) {
      return <LoadingSpinner size="small" message={t('common.loading')} />;
    }

    if (engines.length === 0) {
      return (
        <div className="status-info">
          <div className="status-badge status-stopped">
            {t('home.noEngines')}
          </div>
        </div>
      );
    }

    const displayedEngines = engines.slice(0, 3);
    const remainingCount = engines.length - 3;

    return (
      <div className="status-info">
        <div className="status-badge status-running">
          {t('home.enginesFound', { count: engines.length })}
        </div>
        <div className="engine-list">
          {displayedEngines.map(engine => (
            <div key={engine.id} className="engine-item">
              {engine.name} (
              {formatEngineStatus(
                engine.status as string | { [key: string]: unknown }
              )}
              )
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="engine-item">
              {t('common.others', { count: remainingCount })}
            </div>
          )}
        </div>
      </div>
    );
  }, [enginesLoading, engines, t]);

  return (
    <div className="home">
      <div className="page-header">
        <h1>{t('home.title')}</h1>
        <p className="page-subtitle">{t('home.subtitle')}</p>
      </div>

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {successMessage && (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          autoDismiss={TIMING.MESSAGE_AUTO_DISMISS_MS}
        />
      )}

      <div className="home-content">
        {/* システムステータス */}
        <section className="status-section">
          <h2>システムステータス</h2>
          <div className="status-cards">
            <div className="status-card">
              <h3>{t('home.proxyStatus')}</h3>
              {proxyStatus ? (
                <div className="status-info">
                  <div
                    className={`status-badge ${proxyStatus.running ? 'status-running' : 'status-stopped'}`}
                  >
                    {proxyStatus.running
                      ? t('home.running')
                      : t('home.stopped')}
                  </div>
                  {proxyStatus.running && proxyStatus.port && (
                    <div className="status-detail">
                      <span>
                        {t('home.port')}: {proxyStatus.port}
                      </span>
                      {proxyStatus.mode && (
                        <span>
                          {t('home.mode')}: {formatProxyMode(proxyStatus.mode)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <LoadingSpinner size="small" message={t('common.loading')} />
              )}
            </div>

            <div className="status-card">
              <h3>{t('home.engineStatus')}</h3>
              {renderEngineStatus}
            </div>
          </div>
        </section>

        {/* クイックアクション */}
        <section className="actions-section">
          <h2>{t('home.quickActions')}</h2>
          <div className="action-buttons">
            {proxyStatus?.running ? (
              <button
                className="button-danger action-button"
                onClick={handleStopProxy}
                disabled={loading}
              >
                {t('home.stopProxy')}
              </button>
            ) : (
              <button
                className="button-primary action-button"
                onClick={handleStartProxy}
                disabled={loading}
              >
                {t('home.startProxy')}
              </button>
            )}
            <button
              className="button-secondary action-button"
              onClick={handleDetectEngines}
              disabled={enginesLoading || loading}
            >
              {enginesLoading ? t('common.loading') : t('home.detectEngines')}
            </button>
            <button
              className="button-secondary action-button"
              onClick={() => navigate('/chat/tester')}
            >
              {t('home.chatTester')}
            </button>
            <button
              className="button-secondary action-button"
              onClick={() => navigate('/security/events')}
            >
              {t('home.securityEvents')}
            </button>
          </div>
        </section>

        {/* アプリケーション概要 */}
        <section className="info-section">
          <h2>{t('home.appOverview')}</h2>
          <div className="info-content">
            <p>{t('home.appDescription')}</p>
            <ul>
              <li>{t('home.feature1')}</li>
              <li>{t('home.feature2')}</li>
              <li>{t('home.feature3')}</li>
              <li>{t('home.feature4')}</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
