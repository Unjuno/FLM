// tauri-mock - Tauri APIのモック設定（モジュール読み込み前に実行）
// このファイルはsetupFilesで読み込まれ、モジュール読み込み前に実行される

// ResizeObserverをモック（Rechartsなどのライブラリが使用、モジュール読み込み前に設定が必要）
if (
  typeof global !== 'undefined' &&
  typeof global.ResizeObserver === 'undefined'
) {
  // @ts-ignore
  global.ResizeObserver = class ResizeObserver {
    constructor(_callback?: ResizeObserverCallback) {}
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
    disconnect() {}
  };
}
if (
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as any).ResizeObserver === 'undefined'
) {
  // @ts-ignore
  (globalThis as any).ResizeObserver = class ResizeObserver {
    constructor(_callback?: ResizeObserverCallback) {}
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
    disconnect() {}
  };
}
if (
  typeof window !== 'undefined' &&
  typeof (window as any).ResizeObserver === 'undefined'
) {
  // @ts-ignore
  (window as any).ResizeObserver = class ResizeObserver {
    constructor(_callback?: ResizeObserverCallback) {}
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
    disconnect() {}
  };
}

// TextEncoder/TextDecoderのポリフィル（react-router-domなどで必要）
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// jsdom環境ではwindowが既に存在するため、直接設定する
// 注意: このコードはモジュール読み込み前に実行される必要がある

// テスト用のAPIストレージ（モック用）
// エクスポートしてテストからクリアできるようにする
export const mockApiStorage: Array<{
  id: string;
  name: string;
  endpoint: string;
  api_key: string | null;
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}> = [];

// テスト用のパフォーマンスメトリクスストレージ（モック用）
export const mockPerformanceMetricsStorage: Array<{
  id: number;
  api_id: string;
  metric_type: string;
  value: number;
  timestamp: string;
}> = [];

// モックストレージをクリアする関数
export const clearMockApiStorage = () => {
  mockApiStorage.length = 0;
  mockPerformanceMetricsStorage.length = 0;
};

// グローバルスコープでwindow.__TAURI_INTERNALS__を確実に設定
const setupTauriInternals = () => {
  // jsdom環境ではwindowが既に存在する
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowObj = window as any;
    if (!windowObj.__TAURI__) {
      windowObj.__TAURI__ = {} as any;
    }
    // Tauri 2.xでは__TAURI_INTERNALS__が必要（モジュール読み込み前に設定）
    // 注意: 既存の値を上書きしないようにチェック
    if (!windowObj.__TAURI_INTERNALS__) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      windowObj.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: unknown, options?: unknown) => {
          // 実際のTauriアプリが起動している場合は、そのinvoke関数を使用
          if (windowObj.__TAURI__?.invoke) {
            return await windowObj.__TAURI__.invoke(cmd, args, options);
          }

          // テスト環境では、基本的なモック応答を返す（完全なモックではない）
          // 実際のテストでは、Tauriアプリの起動が必要
          if (
            process.env.NODE_ENV === 'test' &&
            !process.env.TAURI_APP_AVAILABLE
          ) {
            // 統合テスト向けの基本的なモック応答
            if (cmd === 'list_apis') {
              // モックストレージからAPI一覧を返す
              return mockApiStorage;
            }
            if (cmd === 'get_models_list') {
              return [];
            }
            if (cmd === 'get_app_info') {
              return { name: 'FLM', version: '1.0.0' };
            }
            if (cmd === 'get_installed_models') {
              return [];
            }
            // get_performance_metricsは下の方で詳細な実装があるため、ここでは削除
            if (cmd === 'get_log_statistics') {
              return {
                total_requests: 0,
                avg_response_time_ms: 0,
                error_rate: 0,
                status_code_distribution: [],
              };
            }
            if (cmd === 'get_request_logs') {
              return [];
            }
            if (cmd === 'create_api') {
              // モックのAPI IDを返す
              // 引数は { config: {...} } または { name, model_name, port, ... } の形式
              let config:
                | {
                    name?: string;
                    model_name?: string;
                    port?: number;
                    enable_auth?: boolean;
                  }
                | undefined;

              if (args) {
                const argsObj = args as
                  | {
                      config?: {
                        name?: string;
                        model_name?: string;
                        port?: number;
                        enable_auth?: boolean;
                      };
                    }
                  | {
                      name?: string;
                      model_name?: string;
                      port?: number;
                      enable_auth?: boolean;
                    };
                // 'config'プロパティがある場合（{ config: {...} }形式）
                if ('config' in argsObj && argsObj.config) {
                  config = argsObj.config;
                } else {
                  // 直接プロパティがある場合（{ name, model_name, ... }形式）
                  config = argsObj as {
                    name?: string;
                    model_name?: string;
                    port?: number;
                    enable_auth?: boolean;
                  };
                }
              }

              // 存在しないモデル名の場合、エラーを投げる（テスト用）
              const modelName = config?.model_name || 'llama3:8b';
              if (
                modelName.includes('nonexistent') ||
                modelName.includes('invalid')
              ) {
                throw new Error(
                  `選択されたAIモデル「${modelName}」が見つかりませんでした。\n\n先に「モデル管理」画面からこのモデルをダウンロードしてください。`
                );
              }

              const apiId = `test-api-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              // enable_authが明示的にfalseでない限り、デフォルトでtrueとする（実際のAPIの動作に合わせる）
              // 実際のRustコード: let enable_auth = config.enable_auth.unwrap_or(true);
              const enableAuth =
                config?.enable_auth !== undefined ? config.enable_auth : true;
              // 一意のAPIキーを生成（enable_authがtrueの場合、32文字以上）
              const apiKey = enableAuth
                ? `test-api-key-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
                : null;
              const apiData = {
                id: apiId,
                name: config?.name || 'Test API',
                endpoint: `http://localhost:${config?.port || 8080}`,
                api_key: apiKey,
                model_name: modelName,
                port: config?.port || 8080,
                enable_auth: enableAuth,
                status: 'stopped',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              // モックストレージに追加
              mockApiStorage.push(apiData);
              return apiData;
            }
            if (cmd === 'get_api_key') {
              // モックストレージからAPIキーを取得
              const argsObj = args as
                | { api_id?: string; apiId?: string }
                | undefined;
              const apiId = argsObj?.api_id || argsObj?.apiId;
              if (apiId) {
                const api = mockApiStorage.find(a => a.id === apiId);
                if (api) {
                  return api.api_key;
                }
              }
              return null;
            }
            if (cmd === 'regenerate_api_key') {
              // APIキーを再生成（モック）
              const argsObj = args as
                | { api_id?: string; apiId?: string }
                | undefined;
              const apiId = argsObj?.api_id || argsObj?.apiId;
              if (apiId) {
                const api = mockApiStorage.find(a => a.id === apiId);
                if (api) {
                  if (!api.enable_auth) {
                    throw new Error(
                      '認証が有効になっていないAPIのAPIキーは再生成できません'
                    );
                  }
                  // 新しいAPIキーを生成
                  const newApiKey = `test-api-key-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
                  api.api_key = newApiKey;
                  api.updated_at = new Date().toISOString();
                  return newApiKey;
                }
              }
              throw new Error(`APIが見つかりませんでした: ${apiId}`);
            }
            if (cmd === 'get_api_details') {
              // モックストレージからAPI詳細を取得
              const argsObj = args as
                | { api_id?: string; apiId?: string }
                | undefined;
              const apiId = argsObj?.api_id || argsObj?.apiId;
              if (apiId) {
                const api = mockApiStorage.find(a => a.id === apiId);
                if (api) {
                  // ポートが0の場合はデフォルト値（8080）を使用
                  const port = api.port > 0 ? api.port : 8080;
                  const endpoint = api.endpoint || `http://localhost:${port}`;
                  return {
                    id: api.id,
                    name: api.name,
                    endpoint: endpoint,
                    model_name: api.model_name,
                    port: port,
                    enable_auth: api.enable_auth,
                    status: api.status,
                    api_key: api.api_key,
                    created_at: api.created_at,
                    updated_at: api.updated_at,
                  };
                }
              }
              throw new Error(`APIが見つかりませんでした: ${apiId}`);
            }
            if (cmd === 'delete_api') {
              // モックストレージから削除
              const argsObj = args as
                | { api_id?: string; apiId?: string }
                | undefined;
              const apiId = argsObj?.api_id || argsObj?.apiId;
              if (apiId) {
                const index = mockApiStorage.findIndex(api => api.id === apiId);
                if (index !== -1) {
                  mockApiStorage.splice(index, 1);
                }
              }
              return { success: true };
            }
            if (cmd === 'start_api') {
              // モックストレージ内のAPIのステータスをrunningに更新
              const argsObj = args as
                | { api_id?: string; apiId?: string }
                | undefined;
              const apiId = argsObj?.api_id || argsObj?.apiId;
              if (apiId) {
                const api = mockApiStorage.find(a => a.id === apiId);
                if (api) {
                  api.status = 'running';
                  api.updated_at = new Date().toISOString();
                }
              }
              return { success: true };
            }
            if (cmd === 'stop_api') {
              // モックストレージ内のAPIのステータスをstoppedに更新
              const argsObj = args as
                | { api_id?: string; apiId?: string }
                | undefined;
              const apiId = argsObj?.api_id || argsObj?.apiId;
              if (apiId) {
                const api = mockApiStorage.find(a => a.id === apiId);
                if (api) {
                  api.status = 'stopped';
                  api.updated_at = new Date().toISOString();
                }
              }
              return { success: true };
            }
            if (cmd === 'update_api') {
              // API情報を更新（モック）
              // 引数形式: { api_id: string, config: { name?: string, port?: number, enable_auth?: boolean } }
              const argsObj = args as
                | {
                    api_id?: string;
                    apiId?: string;
                    config?: {
                      name?: string;
                      port?: number;
                      enable_auth?: boolean;
                    };
                  }
                | undefined;
              const apiId = argsObj?.api_id || argsObj?.apiId;
              const config = argsObj?.config;

              if (apiId) {
                const api = mockApiStorage.find(a => a.id === apiId);
                if (api && config) {
                  if (config.name !== undefined) {
                    api.name = config.name;
                    // エンドポイントも更新（ポートが変更された場合）
                    api.endpoint = `http://localhost:${api.port}`;
                  }
                  if (config.port !== undefined) {
                    api.port = config.port;
                    // エンドポイントを更新
                    api.endpoint = `http://localhost:${config.port}`;
                  }
                  if (config.enable_auth !== undefined) {
                    api.enable_auth = config.enable_auth;
                    // enable_authがfalseになった場合、api_keyをnullにする
                    if (!config.enable_auth) {
                      api.api_key = null;
                    } else if (!api.api_key) {
                      // enable_authがtrueになった場合、api_keyを生成
                      api.api_key = `test-api-key-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
                    }
                  }
                  api.updated_at = new Date().toISOString();
                }
              }
              return { success: true };
            }
            if (cmd === 'save_request_log') {
              // ログ保存は成功として扱う
              return { success: true };
            }
            if (cmd === 'delete_logs') {
              // ログ削除（モック）
              // 引数形式: { request: { api_id?: string | null; before_date?: string | null } }
              const argsObj = args as
                | {
                    request?: {
                      api_id?: string | null;
                      before_date?: string | null;
                    };
                  }
                | { api_id?: string | null; before_date?: string | null }
                | undefined;

              // { request: {...} }形式または直接プロパティ形式に対応
              let request:
                | { api_id?: string | null; before_date?: string | null }
                | undefined;
              if (argsObj) {
                if ('request' in argsObj && argsObj.request !== undefined) {
                  request = argsObj.request;
                } else {
                  request = argsObj as {
                    api_id?: string | null;
                    before_date?: string | null;
                  };
                }
              }

              // api_idとbefore_dateの両方がnullまたはundefinedの場合、エラーをスロー
              const apiId = request?.api_id;
              const beforeDate = request?.before_date;

              if (
                (apiId === null || apiId === undefined) &&
                (beforeDate === null || beforeDate === undefined)
              ) {
                throw new Error(
                  'API IDと日付の両方が指定されていません。安全のため、すべてのログを削除することは許可されていません。'
                );
              }

              // ログ削除は成功として扱う
              return { deleted_count: 0 };
            }
            if (cmd === 'record_performance_metric') {
              // パフォーマンスメトリクスの記録（モック）
              // 引数形式: { request: { api_id: string, metric_type: string, value: number } }
              const argsObj = args as
                | {
                    request?: {
                      api_id?: string;
                      metric_type?: string;
                      value?: number;
                    };
                  }
                | undefined;
              const request = argsObj?.request;

              if (!request) {
                throw new Error('リクエストパラメータが不正です');
              }

              // バリデーション: 有効なメトリクスタイプ
              const validTypes = [
                'request_count',
                'avg_response_time',
                'error_rate',
                'cpu_usage',
                'memory_usage',
                'token_usage',
              ];
              if (
                request.metric_type &&
                !validTypes.includes(request.metric_type)
              ) {
                throw new Error(
                  `無効なメトリクスタイプです。有効なタイプ: ${validTypes.join(', ')}`
                );
              }

              // バリデーション: 無効なAPI ID
              if (
                request.api_id &&
                (request.api_id.includes('invalid') || request.api_id === '')
              ) {
                throw new Error('APIが見つかりませんでした');
              }

              // メトリクスをストレージに保存
              if (
                request.api_id &&
                request.metric_type &&
                request.value !== undefined
              ) {
                const metricId = mockPerformanceMetricsStorage.length + 1;
                mockPerformanceMetricsStorage.push({
                  id: metricId,
                  api_id: request.api_id,
                  metric_type: request.metric_type,
                  value: request.value,
                  timestamp: new Date().toISOString(),
                });
                // デバッグ: 記録したメトリクスを確認
                if (process.env.JEST_DEBUG === '1') {
                  console.log(
                    `[record_performance_metric] メトリクスを記録しました: api_id=${request.api_id}, metric_type=${request.metric_type}, value=${request.value}, ストレージ内のメトリクス数: ${mockPerformanceMetricsStorage.length}`
                  );
                }
              }

              // 正常時は戻り値なし（void）
              return undefined;
            }
            if (cmd === 'get_performance_metrics') {
              // パフォーマンスメトリクスの取得（モック）
              // 引数形式: { request: { api_id: string, metric_type?: string, start_date?: string, end_date?: string } }
              const argsObj = args as
                | {
                    request?: {
                      api_id?: string;
                      metric_type?: string;
                      start_date?: string;
                      end_date?: string;
                    };
                  }
                | {
                    api_id?: string;
                    metric_type?: string;
                    start_date?: string;
                    end_date?: string;
                  }
                | undefined;

              // { request: {...} }形式または直接プロパティ形式に対応
              let request:
                | {
                    api_id?: string;
                    metric_type?: string;
                    start_date?: string;
                    end_date?: string;
                  }
                | undefined;
              if (argsObj) {
                if ('request' in argsObj && argsObj.request !== undefined) {
                  request = argsObj.request;
                } else {
                  request = argsObj as {
                    api_id?: string;
                    metric_type?: string;
                    start_date?: string;
                    end_date?: string;
                  };
                }
              }

              // デバッグ: 引数の状態を確認
              if (process.env.JEST_DEBUG === '1') {
                console.log(
                  `[get_performance_metrics] 引数: ${JSON.stringify(argsObj)}`
                );
                console.log(
                  `[get_performance_metrics] request: ${JSON.stringify(request)}`
                );
                console.log(
                  `[get_performance_metrics] request.api_id: ${request?.api_id}`
                );
                console.log(
                  `[get_performance_metrics] request.api_id === '': ${request?.api_id === ''}`
                );
              }

              // 空のAPI IDの場合はエラー（先にチェック）
              // request.api_idが空文字列の場合をチェック（undefinedやnullは除外）
              if (
                request &&
                typeof request.api_id === 'string' &&
                request.api_id === ''
              ) {
                if (process.env.JEST_DEBUG === '1') {
                  console.log(
                    `[get_performance_metrics] 空のAPI IDを検出しました。エラーをスローします。`
                  );
                }
                throw new Error('API IDが無効です');
              }

              if (!request || !request.api_id) {
                return [];
              }

              // API IDでフィルタリング
              // デバッグ: ストレージの状態を確認
              if (process.env.JEST_DEBUG === '1') {
                console.log(
                  `[get_performance_metrics] ストレージ内のメトリクス数: ${mockPerformanceMetricsStorage.length}`
                );
                console.log(
                  `[get_performance_metrics] 検索対象API ID: ${request.api_id}`
                );
                console.log(
                  `[get_performance_metrics] ストレージ内のAPI ID: ${mockPerformanceMetricsStorage.map(m => m.api_id).join(', ')}`
                );
              }
              let metrics = mockPerformanceMetricsStorage.filter(
                m => m.api_id === request.api_id
              );

              // メトリクスタイプでフィルタリング（指定されている場合）
              if (request.metric_type) {
                metrics = metrics.filter(
                  m => m.metric_type === request.metric_type
                );
              }

              // 日時範囲でフィルタリング（指定されている場合）
              if (request.start_date) {
                const startDate = new Date(request.start_date);
                metrics = metrics.filter(
                  m => new Date(m.timestamp) >= startDate
                );
              }
              if (request.end_date) {
                const endDate = new Date(request.end_date);
                metrics = metrics.filter(m => new Date(m.timestamp) <= endDate);
              }

              // PerformanceMetricInfo形式に変換
              return metrics.map(m => ({
                id: m.id,
                api_id: m.api_id,
                metric_type: m.metric_type,
                value: m.value,
                timestamp: m.timestamp,
              }));
            }
            if (cmd === 'get_performance_summary') {
              // パフォーマンスサマリーの取得（モック）
              // 引数形式: { request: { api_id: string, period: string } }
              const argsObj = args as
                | { request?: { api_id?: string; period?: string } }
                | { api_id?: string; period?: string }
                | undefined;

              // { request: {...} }形式または直接プロパティ形式に対応
              let request: { api_id?: string; period?: string } | undefined;
              if (argsObj) {
                if ('request' in argsObj && argsObj.request) {
                  request = argsObj.request;
                } else {
                  request = argsObj as { api_id?: string; period?: string };
                }
              }

              if (!request || !request.api_id) {
                return {
                  avg_response_time: 0,
                  max_response_time: 0,
                  min_response_time: 0,
                  request_count: 0,
                  error_rate: 0,
                  avg_cpu_usage: 0,
                  avg_memory_usage: 0,
                  total_token_usage: 0,
                };
              }

              // 期間のバリデーション
              const validPeriods = ['1h', '24h', '7d'];
              if (request.period && !validPeriods.includes(request.period)) {
                throw new Error(
                  `無効な期間です。有効な期間: ${validPeriods.join(', ')}`
                );
              }

              // 期間に応じたフィルタリング（簡易版）
              const periodHours =
                request.period === '1h'
                  ? 1
                  : request.period === '24h'
                    ? 24
                    : request.period === '7d'
                      ? 168
                      : 24;
              const startDate = new Date(
                Date.now() - periodHours * 60 * 60 * 1000
              );

              // API IDと期間でフィルタリング
              const metrics = mockPerformanceMetricsStorage.filter(
                m =>
                  m.api_id === request.api_id &&
                  new Date(m.timestamp) >= startDate
              );

              // 各メトリクスタイプの値を計算
              const responseTimeMetrics = metrics
                .filter(m => m.metric_type === 'avg_response_time')
                .map(m => m.value);
              const requestCountMetrics = metrics
                .filter(m => m.metric_type === 'request_count')
                .map(m => m.value);
              const errorRateMetrics = metrics
                .filter(m => m.metric_type === 'error_rate')
                .map(m => m.value);
              const cpuMetrics = metrics
                .filter(m => m.metric_type === 'cpu_usage')
                .map(m => m.value);
              const memoryMetrics = metrics
                .filter(m => m.metric_type === 'memory_usage')
                .map(m => m.value);
              const tokenMetrics = metrics
                .filter(m => m.metric_type === 'token_usage')
                .map(m => m.value);

              const avgResponseTime =
                responseTimeMetrics.length > 0
                  ? responseTimeMetrics.reduce((a, b) => a + b, 0) /
                    responseTimeMetrics.length
                  : 0;
              const maxResponseTime =
                responseTimeMetrics.length > 0
                  ? Math.max(...responseTimeMetrics)
                  : 0;
              const minResponseTime =
                responseTimeMetrics.length > 0
                  ? Math.min(...responseTimeMetrics)
                  : 0;
              // request_countは合計値として扱う（複数のメトリクスを合計）
              const requestCount =
                requestCountMetrics.length > 0
                  ? requestCountMetrics.reduce((a, b) => a + b, 0)
                  : 0;
              const errorRate =
                errorRateMetrics.length > 0
                  ? errorRateMetrics.reduce((a, b) => a + b, 0) /
                    errorRateMetrics.length
                  : 0;
              const avgCpuUsage =
                cpuMetrics.length > 0
                  ? cpuMetrics.reduce((a, b) => a + b, 0) / cpuMetrics.length
                  : 0;
              const avgMemoryUsage =
                memoryMetrics.length > 0
                  ? memoryMetrics.reduce((a, b) => a + b, 0) /
                    memoryMetrics.length
                  : 0;
              const totalTokenUsage =
                tokenMetrics.length > 0
                  ? tokenMetrics.reduce((a, b) => a + Math.round(b), 0)
                  : 0;

              return {
                avg_response_time: avgResponseTime,
                max_response_time: maxResponseTime,
                min_response_time: minResponseTime,
                request_count: requestCount,
                error_rate: errorRate,
                avg_cpu_usage: avgCpuUsage,
                avg_memory_usage: avgMemoryUsage,
                total_token_usage: totalTokenUsage,
              };
            }
            if (cmd === 'start_ollama') {
              // Ollama起動は成功として扱う（モック）
              return { success: true };
            }
          }

          throw new Error(
            `Tauriアプリケーションが起動していません。統合テストを実行するには、先にTauriアプリを起動してください。コマンド: ${cmd}`
          );
        },
      };
    }
  }

  // global.windowも確実に設定（jsdom環境でも参照される可能性がある）
  if (typeof globalThis !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalWindow = globalThis as any;
    // jsdom環境ではwindowが既に存在するため、それを参照
    if (typeof window !== 'undefined') {
      globalWindow.window = window;
      // __TAURI_INTERNALS__も確実に設定
      if (!globalWindow.window.__TAURI_INTERNALS__) {
        globalWindow.window.__TAURI_INTERNALS__ = (
          window as any
        ).__TAURI_INTERNALS__;
      }
    } else if (!globalWindow.window) {
      globalWindow.window = {} as any;
      // __TAURI_INTERNALS__も確実に設定
      if (!globalWindow.window.__TAURI_INTERNALS__) {
        globalWindow.window.__TAURI_INTERNALS__ = {
          invoke: async (cmd: string, _args?: unknown, _options?: unknown) => {
            throw new Error(
              `Tauriアプリケーションが起動していません。統合テストを実行するには、先にTauriアプリを起動してください。コマンド: ${cmd}`
            );
          },
        };
      }
    }
  }

  // globalも設定（Node.js環境用）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // globalThisはすべての環境で利用可能（Node.js、ブラウザ、jsdom）
  if (typeof globalThis !== 'undefined') {
    const globalObj = globalThis as any;
    if (!globalObj.window && typeof window !== 'undefined') {
      globalObj.window = window;
    } else if (!globalObj.window) {
      globalObj.window = {} as any;
    }
  }
};

// 即座に実行
setupTauriInternals();

// モジュール読み込み時にも再設定（念のため）
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowObj = window as any;
  if (!windowObj.__TAURI_INTERNALS__) {
    windowObj.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, _args?: unknown, _options?: unknown) => {
        throw new Error(
          `Tauriアプリケーションが起動していません。統合テストを実行するには、先にTauriアプリを起動してください。コマンド: ${cmd}`
        );
      },
    };
  }
}
